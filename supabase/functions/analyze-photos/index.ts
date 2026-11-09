// Pré-contrôle IA des photos de preuve (section 8, S10), lancé chaque minute par pg_cron
// tant que la file « photo_analysis » n'est pas vide. Réservé à la clé de service.
//
// Pour chaque message : quota de l'entreprise, image réduite (~1 500 px), appel IA derrière
// l'interface remplaçable de packages/shared/ai, verdict validé par zod, statut de la preuve.
// Erreur passagère : le message réapparaît (nouvel essai), au-delà de 5 essais le bureau tranche.
// L'IA signale, elle ne bloque jamais : aucune action du poseur n'attend ce verdict.

import Anthropic from '@anthropic-ai/sdk';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { PhotoAnalyzer, PhotoImage } from '../_shared/ai/analyzer.ts';
import { createClaudeAnalyzer } from '../_shared/ai/claude.ts';
import { createFakeAnalyzer, failVerdict } from '../_shared/ai/fake.ts';
import type { PhotoTask } from '../_shared/ai/prompt.ts';
import {
  decideVerdict,
  EXTRACT_FIELDS,
  type AiDecision,
  type ExtractField,
} from '../_shared/ai/verdict.ts';
import { json } from '../_shared/http.ts';

const BATCH = 5;
const VISIBILITY_S = 180;
const MAX_ATTEMPTS = 5;
/** Limite de l'API pour une image (en base64) : au-delà, la photo part au bureau. */
const MAX_IMAGE_BYTES = 3_700_000;
const DEFAULT_CHECKS = ['sharp', 'well_lit'];

type Message = { msg_id: number; read_ct: number; photo_id: string };
type Outcome = { photo_id: string; result: string };

function analyzerFromEnv(): PhotoAnalyzer | null {
  // Démonstration et CI : « Plaque… » passe en orange, le reste en vert, sans appel externe.
  if (Deno.env.get('AI_PROVIDER') === 'fake') {
    return createFakeAnalyzer([
      {
        match: /^Plaque/,
        result: (checks) => ({
          ok: true,
          verdict: failVerdict(
            checks.length ? checks : ['plate_readable'],
            checks[0] ?? 'plate_readable',
            'Plaque illisible, rapprochez-vous',
          ),
          model: 'fake',
          inputTokens: 0,
          outputTokens: 0,
        }),
      },
    ]);
  }
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  return apiKey ? createClaudeAnalyzer({ client: new Anthropic({ apiKey }) }) : null;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** Version réduite par le stockage si l'offre le permet, sinon l'original s'il n'est pas trop lourd. */
async function loadImage(db: SupabaseClient, path: string): Promise<PhotoImage | 'too_big' | null> {
  const reduced = await db.storage
    .from('photos')
    .download(path, { transform: { width: 1500, height: 1500, resize: 'contain', quality: 80 } });
  const file = reduced.data ?? (await db.storage.from('photos').download(path)).data;
  if (!file) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES) return 'too_big';
  return { base64: toBase64(bytes), mediaType: 'image/jpeg' };
}

/** Consigne et contrôles de la preuve, depuis le modèle figé de l'opération. */
async function taskFor(db: SupabaseClient, slotId: string): Promise<PhotoTask | null> {
  const { data: slot } = await db
    .from('proof_slots')
    .select('instruction, item_key, jobsite_operations ( template_snapshot )')
    .eq('id', slotId)
    .maybeSingle<{
      instruction: string;
      item_key: string;
      jobsite_operations: { template_snapshot: { items?: Record<string, unknown>[] } } | null;
    }>();
  if (!slot) return null;
  const key = slot.item_key.split('#')[0];
  const item = slot.jobsite_operations?.template_snapshot?.items?.find((i) => i.key === key);
  const checks = Array.isArray(item?.ai_checks) ? (item.ai_checks as string[]) : [];
  const extract = (Array.isArray(item?.extract) ? (item.extract as string[]) : []).filter(
    (f): f is ExtractField => (EXTRACT_FIELDS as readonly string[]).includes(f),
  );
  return {
    instruction: slot.instruction,
    hint: typeof item?.hint === 'string' ? item.hint : null,
    checks: checks.length > 0 ? checks : DEFAULT_CHECKS,
    extract,
  };
}

/** Statut de la preuve d'après toutes ses photos (une preuve peut demander plusieurs vues). */
async function updateSlot(db: SupabaseClient, slotId: string): Promise<void> {
  const { data: slot } = await db.from('proof_slots').select('status').eq('id', slotId).single();
  // Une décision humaine (validée, dispensée) ou une reprise déjà demandée n'est jamais écrasée.
  if (!slot || !['analyzing', 'captured'].includes(slot.status)) return;
  const { data: photos } = await db
    .from('photos')
    .select('ai_status, ai_result')
    .eq('proof_slot_id', slotId)
    .is('deleted_at', null);
  const decisions = (photos ?? []).map((p) =>
    p.ai_status === 'done'
      ? ((p.ai_result as { decision?: AiDecision })?.decision?.kind ?? 'review')
      : p.ai_status,
  );
  const status = decisions.includes('retake')
    ? 'to_retake'
    : decisions.some((d) => d === 'pending' || d === 'analyzing')
      ? 'analyzing'
      : decisions.length > 0 && decisions.every((d) => d === 'compliant')
        ? 'compliant'
        : 'captured'; // au moins un doute : le bureau vérifie, pas de pastille verte
  await db.from('proof_slots').update({ status }).eq('id', slotId);
}

async function finish(
  db: SupabaseClient,
  photoId: string,
  slotId: string,
  result: Record<string, unknown>,
) {
  await db.from('photos').update({ ai_status: 'done', ai_result: result }).eq('id', photoId);
  await updateSlot(db, slotId);
}

async function handle(db: SupabaseClient, analyzer: PhotoAnalyzer, m: Message): Promise<Outcome> {
  const done = async (result: string) => {
    await db.rpc('ai_queue_delete', { id: m.msg_id });
    return { photo_id: m.photo_id, result };
  };
  const { data: photo } = await db
    .from('photos')
    .select('id, company_id, proof_slot_id, original_path, deleted_at, ai_status')
    .eq('id', m.photo_id)
    .maybeSingle();
  if (
    !photo ||
    photo.deleted_at ||
    !photo.proof_slot_id ||
    ['done', 'skipped'].includes(photo.ai_status)
  ) {
    return done('ignorée');
  }
  const slotId = photo.proof_slot_id as string;
  const review = (reason: string) =>
    finish(db, photo.id, slotId, {
      decision: { kind: 'review', reason },
      analyzed_at: new Date().toISOString(),
    });

  if (m.read_ct > MAX_ATTEMPTS) {
    await db.from('photos').update({ ai_status: 'failed' }).eq('id', photo.id);
    await updateSlot(db, slotId);
    await db.rpc('ai_queue_archive', { id: m.msg_id });
    return { photo_id: m.photo_id, result: 'échec, au bureau' };
  }

  const task = await taskFor(db, slotId);
  if (!task) return done('preuve introuvable');

  const { data: allowed } = await db.rpc('ai_quota_take', { p_company: photo.company_id });
  if (!allowed) {
    // Quota du jour atteint : la photo attend, le compteur repart le lendemain.
    await db.rpc('ai_queue_delay', { id: m.msg_id, seconds: 3600 });
    return { photo_id: m.photo_id, result: 'quota atteint' };
  }

  await db.from('photos').update({ ai_status: 'analyzing' }).eq('id', photo.id);
  const image = await loadImage(db, photo.original_path);
  if (image === null) return { photo_id: m.photo_id, result: 'fichier indisponible, nouvel essai' };
  if (image === 'too_big') {
    await review('photo trop lourde pour l’analyse');
    return done('trop lourde, au bureau');
  }

  const analysis = await analyzer.analyze(image, task);
  if (!analysis.ok) {
    if (analysis.kind === 'retry') {
      await db.from('photos').update({ ai_status: 'pending' }).eq('id', photo.id);
      return { photo_id: m.photo_id, result: `nouvel essai : ${analysis.message}` };
    }
    await review(analysis.message);
    return done(`au bureau : ${analysis.message}`);
  }
  await db.rpc('ai_usage_add_tokens', {
    p_company: photo.company_id,
    p_input: analysis.inputTokens,
    p_output: analysis.outputTokens,
  });
  const decision = decideVerdict(analysis.verdict);
  await finish(db, photo.id, slotId, {
    verdict: analysis.verdict,
    decision,
    model: analysis.model,
    analyzed_at: new Date().toISOString(),
  });
  return done(decision.kind);
}

/** Comparaison en temps constant de la clé reçue. */
function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

Deno.serve(async (req) => {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (!sameSecret(req.headers.get('Authorization') ?? '', `Bearer ${serviceKey}`)) {
    return json(403, { error: 'Réservé au serveur' });
  }
  const analyzer = analyzerFromEnv();
  // Sans clé, rien ne se perd : les photos restent « analyse en attente ».
  if (!analyzer) return json(503, { error: 'ANTHROPIC_API_KEY absente' });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, {
    auth: { persistSession: false },
  });
  const { data: messages, error } = await db.rpc('ai_queue_read', {
    batch: BATCH,
    visibility_s: VISIBILITY_S,
  });
  if (error) return json(500, { error: error.message });

  const outcomes: Outcome[] = [];
  for (const m of (messages ?? []) as Message[]) {
    try {
      outcomes.push(await handle(db, analyzer, m));
    } catch (e) {
      // Le message réapparaîtra après le délai de visibilité : nouvel essai automatique.
      outcomes.push({
        photo_id: m.photo_id,
        result: `erreur : ${e instanceof Error ? e.message : e}`,
      });
    }
  }
  return json(200, { processed: outcomes.length, outcomes });
});
