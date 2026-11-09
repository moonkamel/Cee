// Contenus marketing (section 13, S17), lancé chaque minute par pg_cron tant que la file
// « marketing_generation » n'est pas vide. Réservé à la clé de service.
//
// Pour chaque chantier terminé et conforme, avec consentement au PV : l'IA choisit la paire
// avant/après sur les vignettes, puis repère sur les deux photos les zones à flouter (visages,
// plaques, numéros de rue) et rédige trois légendes. Le contenu attend ensuite dans la file
// « À valider » ; les visuels sont composés par le web. Erreur passagère : nouvel essai ;
// après 5, la demande est archivée.

import Anthropic from '@anthropic-ai/sdk';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  type CandidatePhoto,
  createClaudeMarketingAi,
  createFakeMarketingAi,
  type MarketingAi,
  type MarketingImage,
} from '../_shared/ai/marketing.ts';
import {
  captionLeaks,
  cityOf,
  cleanCaption,
  isTone,
  MARKETING_TONES,
  safeRegions,
} from '../_shared/marketing/index.ts';
import { json } from '../_shared/http.ts';
import { isServiceCall } from '../_shared/service.ts';

const BATCH = 2;
const VISIBILITY_S = 600;
const MAX_ATTEMPTS = 5;
/** Au plus 4 photos avant et 4 après pour le choix de la paire (coût, section 8). */
const MAX_PER_PHASE = 4;
const MAX_IMAGE_BYTES = 3_700_000;

type Message = { msg_id: number; read_ct: number; message: { jobsite_id: string } };
type Outcome = { jobsite_id: string; result: string };
type PhotoRow = {
  id: string;
  original_path: string;
  thumbnail_path: string | null;
  device_taken_at: string;
  proof_slots: { instruction: string; phase: string; applicable: boolean } | null;
};

function aiFromEnv(): MarketingAi | null {
  if (Deno.env.get('AI_PROVIDER') === 'fake') return createFakeMarketingAi();
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  return key ? createClaudeMarketingAi({ client: new Anthropic({ apiKey: key }) }) : null;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** Image réduite par le stockage si possible, sinon le fichier lui-même s'il n'est pas trop lourd. */
async function loadImage(
  db: SupabaseClient,
  path: string,
  size: number,
): Promise<MarketingImage | null> {
  const reduced = await db.storage
    .from('photos')
    .download(path, { transform: { width: size, height: size, resize: 'contain', quality: 80 } });
  const file = reduced.data ?? (await db.storage.from('photos').download(path)).data;
  if (!file) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES) return null;
  const png = bytes[0] === 0x89 && bytes[1] === 0x50;
  return { base64: toBase64(bytes), mediaType: png ? 'image/png' : 'image/jpeg' };
}

/** Photos avant et après du chantier : preuves applicables, non masquées au client. */
async function candidates(db: SupabaseClient, jobsiteId: string) {
  const { data } = await db
    .from('photos')
    .select(
      'id, original_path, thumbnail_path, device_taken_at, proof_slots ( instruction, phase, applicable )',
    )
    .eq('jobsite_id', jobsiteId)
    .eq('source', 'camera')
    .eq('client_hidden', false)
    .is('deleted_at', null)
    .not('proof_slot_id', 'is', null)
    .order('device_taken_at');
  const rows = ((data ?? []) as unknown as PhotoRow[]).filter((p) => p.proof_slots?.applicable);
  const pick = (phase: string) =>
    rows.filter((p) => p.proof_slots!.phase === phase).slice(-MAX_PER_PHASE);
  return [...pick('avant'), ...pick('apres')];
}

async function handle(db: SupabaseClient, ai: MarketingAi, m: Message): Promise<Outcome> {
  const jobsiteId = m.message.jobsite_id;
  const out = (result: string) => ({ jobsite_id: jobsiteId, result });
  const done = async (result: string) => {
    await db.rpc('marketing_queue_delete', { id: m.msg_id });
    return out(result);
  };
  if (m.read_ct > MAX_ATTEMPTS) {
    await db.rpc('marketing_queue_archive', { id: m.msg_id });
    return out('échec, archivé');
  }
  // La règle est revérifiée : une preuve a pu repasser à reprendre depuis la mise en file.
  const { data: eligible } = await db.rpc('marketing_is_eligible', { p_jobsite: jobsiteId });
  if (!eligible) return done('plus éligible ou déjà proposé');

  const { data: jobsite } = await db
    .from('jobsites')
    .select(
      'id, company_id, address, clients ( full_name ), jobsite_operations ( label ), companies ( name, marketing_tone )',
    )
    .eq('id', jobsiteId)
    .maybeSingle();
  if (!jobsite) return done('chantier inconnu');
  const company = jobsite.companies as unknown as { name: string; marketing_tone: string };
  const client = (jobsite.clients as unknown as { full_name: string } | null)?.full_name ?? null;
  const works = ((jobsite.jobsite_operations as { label: string }[]) ?? []).map((o) => o.label);
  const city = cityOf(jobsite.address);

  const rows = await candidates(db, jobsiteId);
  if (!rows.some((p) => p.proof_slots!.phase === 'avant')) return done('aucune photo avant');
  if (!rows.some((p) => p.proof_slots!.phase === 'apres')) return done('aucune photo après');

  const { data: allowed } = await db.rpc('ai_quota_take', { p_company: jobsite.company_id });
  if (!allowed) {
    await db.rpc('marketing_queue_delay', { id: m.msg_id, seconds: 3600 });
    return out('quota atteint');
  }

  const loaded: CandidatePhoto[] = [];
  for (const p of rows) {
    const image = await loadImage(db, p.thumbnail_path ?? p.original_path, 512);
    if (image) {
      loaded.push({
        id: p.id,
        phase: p.proof_slots!.phase as 'avant' | 'apres',
        label: p.proof_slots!.instruction,
        image,
      });
    }
  }
  let tokens = { input: 0, output: 0 };
  const pair = await ai.choosePair(loaded);
  if (!pair.ok) {
    if (pair.kind === 'retry') return out(`nouvel essai : ${pair.message}`);
    return done(`paire non choisie : ${pair.message}`);
  }
  tokens = { input: pair.inputTokens, output: pair.outputTokens };

  // Zones repérées sur une version assez grande pour lire un numéro de rue.
  const byId = new Map(rows.map((p) => [p.id, p]));
  const [before, after] = await Promise.all(
    [pair.beforeId, pair.afterId].map((id) => loadImage(db, byId.get(id)!.original_path, 1500)),
  );
  if (!before || !after) return out('nouvel essai : photo illisible');
  const composed = await ai.compose(before, after, { works, city, company: company.name });
  if (!composed.ok) {
    if (composed.kind === 'retry') return out(`nouvel essai : ${composed.message}`);
    return done(`contenu non préparé : ${composed.message}`);
  }
  tokens = {
    input: tokens.input + composed.inputTokens,
    output: tokens.output + composed.outputTokens,
  };
  await db.rpc('ai_usage_add_tokens', {
    p_company: jobsite.company_id,
    p_input: tokens.input,
    p_output: tokens.output,
  });

  // Légende qui laisserait deviner l'adresse ou le client : remplacée par une phrase neutre.
  const neutral = `Chantier terminé${city ? ` à ${city}` : ''} : ${works.join(', ') || 'rénovation énergétique'}.`;
  const captions = Object.fromEntries(
    MARKETING_TONES.map((t) => {
      const text = cleanCaption(composed.draft.captions[t] ?? '');
      const ok = text && !captionLeaks(text, { address: jobsite.address, client });
      return [t, ok ? text : neutral];
    }),
  );
  const tone = isTone(company.marketing_tone) ? company.marketing_tone : 'sobre';
  const { error } = await db.from('marketing_assets').insert({
    company_id: jobsite.company_id,
    jobsite_id: jobsiteId,
    before_photo_id: pair.beforeId,
    after_photo_id: pair.afterId,
    city,
    captions,
    tone,
    generated_text: captions[tone],
    before_regions: safeRegions(composed.draft.before_regions),
    after_regions: safeRegions(composed.draft.after_regions),
    choice_reason: pair.reason,
    ai_model: composed.model,
  });
  if (error) return out(`enregistrement impossible : ${error.message}`);
  return done('proposé');
}

Deno.serve(async (req) => {
  if (!isServiceCall(req)) return json(403, { error: 'Réservé au serveur' });
  const ai = aiFromEnv();
  // Sans clé, rien ne se perd : les demandes attendent dans la file.
  if (!ai) return json(503, { error: 'ANTHROPIC_API_KEY absente' });

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
  const { data: messages, error } = await db.rpc('marketing_queue_read', {
    batch: BATCH,
    visibility_s: VISIBILITY_S,
  });
  if (error) return json(500, { error: error.message });

  const outcomes: Outcome[] = [];
  for (const m of (messages ?? []) as Message[]) {
    try {
      outcomes.push(await handle(db, ai, m));
    } catch (e) {
      outcomes.push({
        jobsite_id: m.message.jobsite_id,
        result: `erreur : ${e instanceof Error ? e.message : e}`,
      });
    }
  }
  return json(200, { processed: outcomes.length, outcomes });
});
