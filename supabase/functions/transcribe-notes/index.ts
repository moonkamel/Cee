// Transcription des notes vocales (section 9, S11), lancée chaque minute par pg_cron tant que
// la file « voice_transcription » n'est pas vide. Réservé à la clé de service.
//
// Pour chaque note : audio du stockage, transcription (Mistral Voxtral, API européenne), puis
// nettoyage par Claude : ponctuation, vocabulaire du métier, problèmes et matériel repérés pour
// le bureau. L'audio d'origine est conservé. Erreur passagère : nouvel essai ; après 5, échec.

import Anthropic from '@anthropic-ai/sdk';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { createMistralTranscriber } from '../_shared/ai/mistral.ts';
import {
  createClaudeNoteCleaner,
  createFakeNoteCleaner,
  createFakeTranscriber,
  type NoteCleaner,
} from '../_shared/ai/note.ts';
import { TRADE_VOCABULARY, type Transcriber } from '../_shared/ai/transcriber.ts';
import { json } from '../_shared/http.ts';
import { isServiceCall } from '../_shared/service.ts';

const BATCH = 5;
const VISIBILITY_S = 300;
const MAX_ATTEMPTS = 5;

type Message = { msg_id: number; read_ct: number; voice_note_id: string };
type Outcome = { voice_note_id: string; result: string };

function providersFromEnv(): { transcriber: Transcriber | null; cleaner: NoteCleaner | null } {
  if (Deno.env.get('AI_PROVIDER') === 'fake') {
    return { transcriber: createFakeTranscriber(), cleaner: createFakeNoteCleaner() };
  }
  const mistralKey = Deno.env.get('MISTRAL_API_KEY');
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  return {
    transcriber: mistralKey ? createMistralTranscriber({ apiKey: mistralKey }) : null,
    // Sans clé Anthropic, la note reste lisible : transcription brute, sans nettoyage.
    cleaner: anthropicKey
      ? createClaudeNoteCleaner({ client: new Anthropic({ apiKey: anthropicKey }) })
      : null,
  };
}

function mediaTypeOf(path: string): string {
  if (path.endsWith('.webm')) return 'audio/webm';
  if (path.endsWith('.mp3')) return 'audio/mpeg';
  if (path.endsWith('.aac')) return 'audio/aac';
  return 'audio/mp4';
}

async function handle(
  db: SupabaseClient,
  transcriber: Transcriber,
  cleaner: NoteCleaner | null,
  m: Message,
): Promise<Outcome> {
  const out = (result: string) => ({ voice_note_id: m.voice_note_id, result });
  const done = async (result: string) => {
    await db.rpc('voice_queue_delete', { id: m.msg_id });
    return out(result);
  };
  const { data: note } = await db
    .from('voice_notes')
    .select('id, company_id, jobsite_id, audio_path, status, deleted_at')
    .eq('id', m.voice_note_id)
    .maybeSingle();
  if (!note || note.deleted_at || note.status === 'done') return done('ignorée');

  if (m.read_ct > MAX_ATTEMPTS) {
    await db.from('voice_notes').update({ status: 'failed' }).eq('id', note.id);
    await db.rpc('voice_queue_archive', { id: m.msg_id });
    return out('échec, au bureau');
  }

  // Une note compte pour une analyse dans le quota IA du jour de l'entreprise.
  const { data: allowed } = await db.rpc('ai_quota_take', { p_company: note.company_id });
  if (!allowed) {
    await db.rpc('voice_queue_delay', { id: m.msg_id, seconds: 3600 });
    return out('quota atteint');
  }

  await db.from('voice_notes').update({ status: 'transcribing' }).eq('id', note.id);
  const { data: file } = await db.storage.from('voice-notes').download(note.audio_path);
  if (!file) {
    await db.from('voice_notes').update({ status: 'pending' }).eq('id', note.id);
    return out('audio indisponible, nouvel essai');
  }
  const transcript = await transcriber.transcribe(
    {
      bytes: new Uint8Array(await file.arrayBuffer()),
      mediaType: mediaTypeOf(note.audio_path),
      fileName: note.audio_path.split('/').pop() ?? 'note.m4a',
    },
    { language: 'fr', vocabulary: [...TRADE_VOCABULARY] },
  );
  if (!transcript.ok) {
    if (transcript.kind === 'retry') {
      await db.from('voice_notes').update({ status: 'pending' }).eq('id', note.id);
      return out(`nouvel essai : ${transcript.message}`);
    }
    await db.from('voice_notes').update({ status: 'failed' }).eq('id', note.id);
    return done(`échec : ${transcript.message}`);
  }

  let clean: string | null = null;
  let items: Record<string, unknown>[] = [];
  if (cleaner && transcript.text) {
    const result = await cleaner.clean(transcript.text);
    if (result.ok) {
      clean = result.cleanup.clean_text;
      items = [
        ...result.cleanup.problems.map((p) => ({ kind: 'problem', summary: p.summary })),
        ...result.cleanup.materials.map((mat) => ({
          kind: 'material',
          summary: mat.item,
          quantity: mat.quantity,
          unit: mat.unit,
        })),
      ];
      await db.rpc('ai_usage_add_tokens', {
        p_company: note.company_id,
        p_input: result.inputTokens,
        p_output: result.outputTokens,
      });
    } else if (result.kind === 'retry') {
      await db.from('voice_notes').update({ status: 'pending' }).eq('id', note.id);
      return out(`nouvel essai du nettoyage : ${result.message}`);
    }
    // Refus ou réponse illisible : la transcription brute suffit, le bureau lit la note.
  }

  // Un nouvel essai après coupure ne crée pas deux fois les mêmes alertes.
  const { count } = await db
    .from('note_items')
    .select('id', { count: 'exact', head: true })
    .eq('voice_note_id', note.id);
  if (items.length > 0 && !count) {
    await db.from('note_items').insert(
      items.map((i) => ({
        ...i,
        company_id: note.company_id,
        jobsite_id: note.jobsite_id,
        voice_note_id: note.id,
      })),
    );
  }
  await db
    .from('voice_notes')
    .update({ status: 'done', transcript: transcript.text, transcript_clean: clean })
    .eq('id', note.id);
  return done(`transcrite (${items.length} élément(s) repéré(s))`);
}

Deno.serve(async (req) => {
  if (!isServiceCall(req)) return json(403, { error: 'Réservé au serveur' });
  const { transcriber, cleaner } = providersFromEnv();
  // Sans clé, rien ne se perd : les notes restent « transcription en attente ».
  if (!transcriber) return json(503, { error: 'MISTRAL_API_KEY absente' });

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    {
      auth: { persistSession: false },
    },
  );
  const { data: messages, error } = await db.rpc('voice_queue_read', {
    batch: BATCH,
    visibility_s: VISIBILITY_S,
  });
  if (error) return json(500, { error: error.message });

  const outcomes: Outcome[] = [];
  for (const m of (messages ?? []) as Message[]) {
    try {
      outcomes.push(await handle(db, transcriber, cleaner, m));
    } catch (e) {
      outcomes.push({
        voice_note_id: m.voice_note_id,
        result: `erreur : ${e instanceof Error ? e.message : e}`,
      });
    }
  }
  return json(200, { processed: outcomes.length, outcomes });
});
