'use server';

import {
  extendedExpiry,
  isTone,
  LINK_DAYS,
  newLinkToken,
  normalizeFrenchPhone,
  permissions,
  sha256Hex,
} from '@preuvio/shared';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { currentUser } from '@/lib/dal';
import { supabaseServer } from '@/lib/supabase/server';
import type { FormState } from './actions';

// Espace client vu du bureau (section 12) : liens sécurisés, photos montrées, réglages.

export type LinkState = {
  error?: string;
  url?: string;
  smsSent?: boolean;
  smsError?: string;
} | null;

async function deciders() {
  const user = await currentUser();
  if (!permissions(user.role).decide) throw new Error('Réservé au chef, au bureau et au dirigeant');
  return user;
}

/** Nouveau lien : le jeton n'est montré qu'une fois ; seule son empreinte est enregistrée. */
export async function createClientLink(_: LinkState, form: FormData): Promise<LinkState> {
  await deciders();
  const jobsiteId = String(form.get('jobsiteId') ?? '');
  const token = newLinkToken();
  const supabase = await supabaseServer();
  const { error } = await supabase.from('share_links').insert({
    jobsite_id: jobsiteId,
    token_hash: await sha256Hex(new TextEncoder().encode(token)),
    expires_at: new Date(Date.now() + LINK_DAYS * 86_400_000).toISOString(),
    require_sms: form.get('requireSms') === 'on',
  });
  if (error) return { error: 'Lien non créé' };
  const h = await headers();
  const url = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}/c/${token}`;
  revalidatePath(`/chantiers/${jobsiteId}`);
  if (form.get('sendSms') !== 'on') return { url };
  const sent = await supabase.functions.invoke('client-portal', {
    body: { action: 'send_link', token, page_url: url },
  });
  return sent.error ? { url, smsError: 'SMS non envoyé : copiez le lien' } : { url, smsSent: true };
}

export async function extendClientLink(form: FormData) {
  await deciders();
  const supabase = await supabaseServer();
  const id = String(form.get('linkId') ?? '');
  const { data } = await supabase
    .from('share_links')
    .select('expires_at, jobsite_id')
    .eq('id', id)
    .maybeSingle();
  if (!data) return;
  await supabase
    .from('share_links')
    .update({ expires_at: extendedExpiry(data.expires_at, new Date().toISOString()) })
    .eq('id', id);
  revalidatePath(`/chantiers/${data.jobsite_id}`);
}

export async function revokeClientLink(form: FormData) {
  await deciders();
  const supabase = await supabaseServer();
  await supabase
    .from('share_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', String(form.get('linkId') ?? ''));
  revalidatePath(`/chantiers/${String(form.get('jobsiteId') ?? '')}`);
}

/** Photo montrée ou masquée au client (preuve : masquée ; photo libre : montrée). */
export async function setClientPhoto(form: FormData) {
  await deciders();
  const show = form.get('show') === 'true';
  const proof = form.get('proof') === 'true';
  const supabase = await supabaseServer();
  await supabase
    .from('photos')
    .update(proof ? { client_hidden: !show } : { client_visible: show })
    .eq('id', String(form.get('photoId') ?? ''));
  revalidatePath(`/chantiers/${String(form.get('jobsiteId') ?? '')}`);
}

/**
 * Droit à l'effacement du client (section 16) : la base efface ses coordonnées ; s'il a un
 * chantier, la preuve des travaux est gardée et l'accès restreint.
 */
export async function eraseClient(_: FormState, form: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!permissions(user.role).manageTeam) return { error: 'Réservé à l’admin et au dirigeant' };
  if (form.get('confirm') !== 'on') return { error: 'Cochez la case pour confirmer' };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('erase_client', {
    p_client: String(form.get('clientId') ?? ''),
  });
  if (error) return { error: 'Effacement refusé' };
  revalidatePath(`/chantiers/${String(form.get('jobsiteId') ?? '')}`);
  return { ok: true };
}

/** Téléphone de l'entreprise, lien de sa fiche Google, ton des légendes et conservation. */
export async function saveCompanySettings(_: FormState, form: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!permissions(user.role).manageTeam) return { error: 'Réservé à l’admin et au dirigeant' };
  const phoneRaw = String(form.get('phone') ?? '').trim();
  const phone = phoneRaw ? normalizeFrenchPhone(phoneRaw) : null;
  if (phoneRaw && !phone) return { error: 'Numéro de téléphone invalide' };
  const review = String(form.get('review') ?? '').trim() || null;
  if (review && !/^https:\/\/\S+$/.test(review))
    return { error: 'Le lien Google doit commencer par https://' };
  const tone = form.get('tone');
  if (!isTone(tone)) return { error: 'Choisissez un ton' };
  const retention = Number(form.get('retention'));
  if (!Number.isInteger(retention) || retention < 5 || retention > 30)
    return { error: 'Conservation : entre 5 et 30 ans' };
  const supabase = await supabaseServer();
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single();
  const { error } = await supabase
    .from('companies')
    .update({
      phone,
      google_review_url: review,
      marketing_tone: tone,
      retention_years: retention,
    })
    .eq('id', profile!.company_id);
  if (error) return { error: 'Réglages non enregistrés' };
  revalidatePath('/reglages');
  return { ok: true };
}
