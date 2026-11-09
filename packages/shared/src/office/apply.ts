// Application d'une décision du bureau avec la session de l'utilisateur : la RLS et les
// triggers vérifient le droit de trancher (chef, bureau, admin, dirigeant).
import type { SupabaseClient } from '@supabase/supabase-js';
import { decisionWrites, type Decision } from './decision';

export type ApplyResult = { ok: true } | { ok: false; message: string };

export async function applyDecision(
  client: SupabaseClient,
  decision: Decision,
  userId: string,
): Promise<ApplyResult> {
  const writes = decisionWrites(decision, userId);
  const slot = await client
    .from('proof_slots')
    .update({ status: writes.slot.status })
    .eq('id', writes.slot.id)
    .select('id');
  if (slot.error) return { ok: false, message: slot.error.message };
  if (!slot.data?.length)
    return { ok: false, message: 'Preuve introuvable ou hors de vos chantiers' };
  if (writes.request) {
    const req = await client.from('photo_requests').insert(writes.request);
    if (req.error) return { ok: false, message: req.error.message };
  }
  return { ok: true };
}
