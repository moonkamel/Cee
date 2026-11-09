'use server';

import {
  applyDecision,
  normalizeFrenchPhone,
  retakeMessage,
  ROLES,
  type Role,
} from '@preuvio/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/dal';
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
  if (error) return { error: 'Invitation refusée (numéro déjà inscrit ou droits insuffisants)' };
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
