'use server';

import {
  applyDecision,
  applyEdits,
  contentChanged,
  normalizeFrenchPhone,
  parseContent,
  permissions,
  REPORT_SECTIONS,
  type ReportEdits,
  retakeMessage,
  ROLES,
  type Role,
} from '@preuvio/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/dal';
import { inviteErrorMessage } from '@/lib/onboarding/invite';
import { loadReport } from '@/lib/reports';
import { supabaseServer } from '@/lib/supabase/server';

export type FormState = { error?: string; ok?: boolean; phone?: string } | null;

// --- Connexion par code SMS (comme l'appli) ------------------------------------------------
export async function sendCode(_: FormState, form: FormData): Promise<FormState> {
  const phone = normalizeFrenchPhone(String(form.get('phone') ?? ''));
  if (!phone) return { error: 'Numéro de portable invalide' };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: false },
  });
  if (error) return { error: 'Numéro inconnu ou SMS impossible pour le moment', phone };
  return { ok: true, phone };
}

export async function verifyCode(_: FormState, form: FormData): Promise<FormState> {
  const phone = normalizeFrenchPhone(String(form.get('phone') ?? ''));
  const token = String(form.get('code') ?? '').replace(/\D/g, '');
  if (!phone || token.length !== 6)
    return { error: 'Code à 6 chiffres', phone: phone ?? undefined };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
  if (error) return { error: 'Code faux ou expiré', phone };
  redirect('/');
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect('/connexion');
}

// --- Décision sur une photo orange (section 8) ---------------------------------------------
export async function decide(_: FormState, form: FormData): Promise<FormState> {
  const user = await currentUser();
  const slotId = String(form.get('slotId') ?? '');
  const choice = String(form.get('choice') ?? '');
  const supabase = await supabaseServer();
  const result =
    choice === 'validate'
      ? await applyDecision(supabase, { kind: 'validate', slotId }, user.id)
      : await applyDecision(
          supabase,
          {
            kind: 'retake',
            slotId,
            jobsiteId: String(form.get('jobsiteId') ?? ''),
            recipientId: String(form.get('recipientId') ?? ''),
            message: retakeMessage(
              String(form.get('message') ?? ''),
              String(form.get('aiMessage') ?? ''),
            ),
          },
          user.id,
        );
  if (!result.ok)
    return { error: 'Décision refusée : droits insuffisants ou preuve déjà tranchée' };
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function validateWaiver(form: FormData) {
  await currentUser();
  const supabase = await supabaseServer();
  await supabase
    .from('proof_slots')
    .update({ waiver_validated_at: new Date().toISOString() })
    .eq('id', String(form.get('slotId') ?? ''));
  revalidatePath('/', 'layout');
}

export async function markItemDone(form: FormData) {
  await currentUser();
  const supabase = await supabaseServer();
  await supabase
    .from('note_items')
    .update({ status: 'done' })
    .eq('id', String(form.get('itemId') ?? ''));
  revalidatePath('/', 'layout');
}

// --- Équipe (section 14) -------------------------------------------------------------------
export async function inviteMember(_: FormState, form: FormData): Promise<FormState> {
  await currentUser();
  const phone = normalizeFrenchPhone(String(form.get('phone') ?? ''));
  const fullName = String(form.get('fullName') ?? '').trim();
  const role = String(form.get('role') ?? 'installer') as Role;
  if (!phone || !fullName || !ROLES.includes(role))
    return { error: 'Nom, portable et rôle requis' };
  const supabase = await supabaseServer();
  const { error } = await supabase.functions.invoke('invite-member', {
    body: { phone, full_name: fullName, role },
  });
  if (error) return { error: await inviteErrorMessage(error) };
  revalidatePath('/equipe');
  return { ok: true };
}

export async function setRole(form: FormData) {
  await currentUser();
  const role = String(form.get('role') ?? '') as Role;
  if (!ROLES.includes(role)) return;
  const supabase = await supabaseServer();
  await supabase
    .from('profiles')
    .update({ role })
    .eq('id', String(form.get('profileId') ?? ''));
  revalidatePath('/equipe');
}

export async function setActive(form: FormData) {
  await currentUser();
  const supabase = await supabaseServer();
  await supabase
    .from('profiles')
    .update({ active: form.get('active') === 'true' })
    .eq('id', String(form.get('profileId') ?? ''));
  revalidatePath('/equipe');
}

// --- Rapports (section 9) ------------------------------------------------------------------
/** Fin de chantier à rédiger (de nouveau) ou dossier de litige sur les photos cochées. */
export async function requestReport(_: FormState, form: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!permissions(user.role).decide)
    return { error: 'Réservé au chef, au bureau et au dirigeant' };
  const jobsiteId = String(form.get('jobsiteId') ?? '');
  const kind = String(form.get('kind') ?? '');
  const photoIds = form.getAll('photoId').map(String).filter(Boolean);
  if (kind === 'dispute' && photoIds.length === 0) return { error: 'Cochez au moins une photo' };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('request_report', {
    p_jobsite: jobsiteId,
    p_kind: kind,
    p_photo_ids: kind === 'dispute' ? photoIds : null,
  });
  if (error) return { error: 'Demande refusée' };
  return { ok: true };
}

/** Texte relu par le bureau : enregistré comme version suivante, l'ancienne reste. */
export async function saveReportVersion(_: FormState, form: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!permissions(user.role).decide)
    return { error: 'Réservé au chef, au bureau et au dirigeant' };
  const loaded = await loadReport(String(form.get('reportId') ?? ''));
  if (!loaded) return { error: 'Rapport introuvable' };
  const { report, versions } = loaded;
  const content = parseContent(report.content, report.kind);
  const edits: ReportEdits = { texts: {}, added: {} };
  for (const key of REPORT_SECTIONS) {
    edits.texts[key] = content.sections[key].map((_s, i) => String(form.get(`${key}.${i}`) ?? ''));
    edits.added![key] = String(form.get(`${key}.new`) ?? '');
  }
  const next = applyEdits(content, edits);
  if (!contentChanged(content, next)) return { error: 'Aucune modification' };
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from('reports')
    .insert({
      jobsite_id: report.jobsite_id,
      kind: report.kind,
      series_id: report.series_id,
      period: report.period,
      version: Math.max(...versions.map((v) => v.version)) + 1,
      content: next,
    })
    .select('id')
    .single();
  if (error || !data)
    return { error: 'Version non enregistrée (une autre vient peut-être de l’être)' };
  revalidatePath(`/chantiers/${report.jobsite_id}`);
  redirect(`/rapports/${data.id}`);
}
