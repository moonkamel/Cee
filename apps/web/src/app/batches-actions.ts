'use server';

import {
  effectiveMuted,
  INSPECTION_RESULTS,
  type InspectionResult,
  matchReferences,
  normalizeEmail,
  parseCsv,
  parseDate,
  permissions,
  referenceColumn,
} from '@preuvio/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/dal';
import { supabaseServer } from '@/lib/supabase/server';
import type { FormState } from './actions';

// Lots CEE, contrôles, reprises (section 10) et réglages des alertes (section 14).

async function office() {
  const user = await currentUser();
  if (!permissions(user.role).export) throw new Error('Réservé au bureau et au dirigeant');
  return user;
}

export async function createBatch(_: FormState, form: FormData): Promise<FormState> {
  await office();
  const code = String(form.get('code') ?? '')
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{3}-[A-Z]{2}-\d{3}$/.test(code)) return { error: 'Fiche au format BAR-TH-171' };
  const start = String(form.get('start') ?? '') || null;
  const end = String(form.get('end') ?? '') || null;
  if (start && end && end < start) return { error: 'Fin de période avant le début' };
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from('cee_batches')
    .insert({
      operation_code: code,
      period_start: start,
      period_end: end,
      delegataire_id: String(form.get('delegataireId') ?? '') || null,
    })
    .select('id')
    .single();
  if (error || !data) return { error: 'Lot non créé' };
  redirect(`/lots/${data.id}`);
}

export async function addToBatch(form: FormData) {
  await office();
  const batchId = String(form.get('batchId') ?? '');
  const ids = form.getAll('jobsiteId').map(String).filter(Boolean);
  if (ids.length) {
    const supabase = await supabaseServer();
    await supabase.from('cee_batch_jobsites').upsert(
      ids.map((jobsite_id) => ({ batch_id: batchId, jobsite_id })),
      { ignoreDuplicates: true },
    );
  }
  revalidatePath(`/lots/${batchId}`);
}

export async function removeFromBatch(form: FormData) {
  await office();
  const batchId = String(form.get('batchId') ?? '');
  const supabase = await supabaseServer();
  await supabase
    .from('cee_batch_jobsites')
    .delete()
    .eq('batch_id', batchId)
    .eq('jobsite_id', String(form.get('jobsiteId') ?? ''));
  revalidatePath(`/lots/${batchId}`);
}

export type ImportBatchState = { error?: string; added?: number; missing?: string[] } | null;

/** Fichier du délégataire : une colonne de références (chantier ou devis), reconnue seule. */
export async function importBatch(_: ImportBatchState, form: FormData): Promise<ImportBatchState> {
  await office();
  const batchId = String(form.get('batchId') ?? '');
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choisissez un fichier CSV' };
  const rows = parseCsv(await file.text());
  const supabase = await supabaseServer();
  const { data: jobsites } = await supabase
    .from('jobsites')
    .select('id, reference, quote_reference');
  const known = jobsites ?? [];
  const col = referenceColumn(rows, known);
  const values = rows.map((r) => r[col] ?? '');
  // En-tête du fichier (« Dossier », « Référence ») : pas une référence manquante.
  if (values[0] && !/\d/.test(values[0])) values.shift();
  const { found, missing } = matchReferences(values, known);
  if (found.length) {
    await supabase.from('cee_batch_jobsites').upsert(
      found.map((j) => ({ batch_id: batchId, jobsite_id: j.id })),
      { ignoreDuplicates: true },
    );
  }
  revalidatePath(`/lots/${batchId}`);
  // La ligne d'en-tête n'est pas une référence manquante.
  return { added: found.length, missing };
}

export async function addInspection(_: FormState, form: FormData): Promise<FormState> {
  await office();
  const batchId = String(form.get('batchId') ?? '');
  const result = String(form.get('result') ?? '') as InspectionResult;
  const date = parseDate(String(form.get('date') ?? ''));
  if (!INSPECTION_RESULTS.includes(result)) return { error: 'Résultat requis' };
  if (!date) return { error: 'Date du contrôle requise' };
  const supabase = await supabaseServer();
  const { error } = await supabase.from('inspections').insert({
    batch_id: batchId,
    jobsite_id: String(form.get('jobsiteId') ?? ''),
    kind: String(form.get('kind') ?? 'on_site'),
    body: String(form.get('body') ?? '').trim() || null,
    inspected_on: date,
    result,
    findings: String(form.get('findings') ?? '').trim() || null,
  });
  if (error) return { error: 'Contrôle non enregistré' };
  revalidatePath(`/lots/${batchId}`);
  return { ok: true };
}

export async function planCorrection(_: FormState, form: FormData): Promise<FormState> {
  await office();
  const slotIds = form.getAll('slotId').map(String).filter(Boolean);
  if (slotIds.length === 0) return { error: 'Cochez les preuves à refaire' };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('plan_correction', {
    p_inspection: String(form.get('inspectionId') ?? ''),
    p_slot_ids: slotIds,
  });
  if (error) return { error: 'Reprise refusée' };
  revalidatePath(`/lots/${String(form.get('batchId') ?? '')}`);
  return { ok: true };
}

export async function markCorrected(form: FormData) {
  await office();
  const supabase = await supabaseServer();
  await supabase
    .from('inspections')
    .update({ corrected_on: new Date().toISOString().slice(0, 10) })
    .eq('id', String(form.get('inspectionId') ?? ''));
  revalidatePath(`/lots/${String(form.get('batchId') ?? '')}`);
}

/** Réglages de chacun : e-mail facultatif, alertes coupées (sauf les critiques du dirigeant). */
export async function saveAlertSettings(_: FormState, form: FormData): Promise<FormState> {
  const user = await currentUser();
  const email = normalizeEmail(String(form.get('email') ?? ''));
  if (email === 'invalid') return { error: 'Adresse e-mail invalide' };
  // Cases cochées : alertes gardées ; les autres alertes réglables sont coupées.
  const kept = new Set(form.getAll('kept').map(String));
  const muted = form
    .getAll('all')
    .map(String)
    .filter((k) => !kept.has(k));
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from('profiles')
    .update({ email, muted_alerts: effectiveMuted(muted, user.role) })
    .eq('id', user.id);
  if (error) return { error: 'Réglages non enregistrés' };
  revalidatePath('/reglages');
  return { ok: true };
}
