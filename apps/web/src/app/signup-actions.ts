'use server';

import {
  companySearchUrl,
  type CompanyIdentity,
  normalizeEmail,
  normalizeFrenchPhone,
  normalizeSiret,
  parseCompanySearch,
  parseRgeLines,
  type RgeRow,
  rgeSearchUrl,
  WORK_TYPES,
} from '@preuvio/shared';
import { redirect } from 'next/navigation';
import { createDemoJobsite } from '@/lib/onboarding/demo';
import { inviteErrorMessage } from '@/lib/onboarding/invite';
import { supabaseServer } from '@/lib/supabase/server';

// Inscription du dirigeant (section 15) : compte par code, entreprise, démonstration, équipe.

export type SignupState = {
  error?: string;
  sent?: boolean;
  channel?: 'phone' | 'email';
  target?: string;
} | null;

function contact(form: FormData): { channel: 'phone' | 'email'; target: string } | null {
  const raw = String(form.get('contact') ?? '').trim();
  if (raw.includes('@')) {
    const email = normalizeEmail(raw);
    return email && email !== 'invalid' ? { channel: 'email', target: email } : null;
  }
  const phone = normalizeFrenchPhone(raw);
  return phone ? { channel: 'phone', target: phone } : null;
}

/** 1. Téléphone ou e-mail : un code de confirmation est envoyé (compte créé s'il n'existe pas). */
export async function sendSignupCode(_: SignupState, form: FormData): Promise<SignupState> {
  const who = contact(form);
  if (!who) return { error: 'Numéro de portable ou adresse e-mail invalide' };
  const supabase = await supabaseServer();
  const { error } =
    who.channel === 'phone'
      ? await supabase.auth.signInWithOtp({
          phone: who.target,
          options: { shouldCreateUser: true },
        })
      : await supabase.auth.signInWithOtp({
          email: who.target,
          options: { shouldCreateUser: true },
        });
  if (error) return { error: 'Envoi du code impossible pour le moment', ...who };
  return { sent: true, ...who };
}

export async function verifySignupCode(_: SignupState, form: FormData): Promise<SignupState> {
  const channel = form.get('channel') === 'email' ? 'email' : 'phone';
  const target = String(form.get('target') ?? '');
  const token = String(form.get('code') ?? '').replace(/\D/g, '');
  if (token.length !== 6) return { error: 'Code à 6 chiffres', sent: true, channel, target };
  const supabase = await supabaseServer();
  const { error } =
    channel === 'phone'
      ? await supabase.auth.verifyOtp({ phone: target, token, type: 'sms' })
      : await supabase.auth.verifyOtp({ email: target, token, type: 'email' });
  if (error) return { error: 'Code faux ou expiré', sent: true, channel, target };
  redirect('/inscription/entreprise');
}

async function fetchJson(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), cache: 'no-store' });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export type SiretLookup = {
  error?: string;
  siret?: string;
  identity?: CompanyIdentity | null;
  rge?: RgeRow[];
};

/** 2 et 3. SIRET → nom et adresse (registre public), qualifications trouvées dans la liste ADEME. */
export async function lookupSiret(raw: string): Promise<SiretLookup> {
  const siret = normalizeSiret(raw);
  if (!siret) return { error: 'SIRET invalide : 14 chiffres' };
  const [company, rge] = await Promise.all([
    fetchJson(companySearchUrl(siret)),
    fetchJson(rgeSearchUrl(siret)),
  ]);
  return { siret, identity: parseCompanySearch(company, siret), rge: parseRgeLines(rge) };
}

/** 4 à 6. Entreprise, métiers, logo et couleur ; puis chantier de démonstration. */
export async function createCompany(_: SignupState, form: FormData): Promise<SignupState> {
  const supabase = await supabaseServer();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect('/inscription');

  const name = String(form.get('name') ?? '').trim();
  const fullName = String(form.get('fullName') ?? '').trim();
  if (!name || !fullName) return { error: 'Nom de l’entreprise et votre nom requis' };
  const siretRaw = String(form.get('siret') ?? '').trim();
  const siret = siretRaw ? normalizeSiret(siretRaw) : null;
  if (siretRaw && !siret) return { error: 'SIRET invalide : 14 chiffres' };
  const color = String(form.get('color') ?? '');
  let rge: unknown[] = [];
  try {
    rge = JSON.parse(String(form.get('rge') ?? '[]'));
  } catch {
    return { error: 'Qualifications illisibles' };
  }
  const workTypes = form
    .getAll('workType')
    .map(String)
    .filter((w) => (WORK_TYPES as readonly string[]).includes(w));

  const { data: companyId, error } = await supabase.rpc('create_company', {
    p_name: name,
    p_siret: siret,
    p_address: String(form.get('address') ?? ''),
    p_rge: Array.isArray(rge) ? rge.slice(0, 20) : [],
    p_work_types: workTypes,
    p_brand_color: /^#[0-9A-Fa-f]{6}$/.test(color) ? color : null,
    p_full_name: fullName,
  });
  if (error || !companyId) {
    return {
      error: error?.message.includes('déjà')
        ? 'Ce compte a déjà une entreprise'
        : 'Entreprise non créée',
    };
  }

  // Logo facultatif : rangé dans les documents privés de l'entreprise.
  const logo = form.get('logo');
  if (logo instanceof File && logo.size > 0) {
    const type = logo.type === 'image/png' ? 'png' : logo.type === 'image/jpeg' ? 'jpg' : null;
    if (type && logo.size <= 2_000_000) {
      const path = `${companyId}/logo.${type}`;
      const upload = await supabase.storage
        .from('documents')
        .upload(path, logo, { contentType: logo.type, upsert: true });
      if (!upload.error)
        await supabase.from('companies').update({ logo_path: path }).eq('id', companyId);
    }
  }
  await createDemoJobsite(userId, companyId as string);
  redirect('/inscription/equipe');
}

export type InviteState = {
  error?: string;
  results?: { phone: string; ok: boolean; message: string }[];
} | null;

/** 6. Invitation des poseurs par SMS (même fonction que la page Équipe). */
export async function inviteTeam(_: InviteState, form: FormData): Promise<InviteState> {
  const names = form.getAll('fullName').map(String);
  const phones = form.getAll('phone').map(String);
  const rows = phones
    .map((p, i) => ({ phone: p.trim(), fullName: (names[i] ?? '').trim() }))
    .filter((r) => r.phone || r.fullName);
  if (rows.length === 0) redirect('/');
  const supabase = await supabaseServer();
  const results: NonNullable<InviteState>['results'] = [];
  for (const row of rows) {
    const phone = normalizeFrenchPhone(row.phone);
    if (!phone || !row.fullName) {
      results.push({ phone: row.phone, ok: false, message: 'Nom et portable requis' });
      continue;
    }
    const { error } = await supabase.functions.invoke('invite-member', {
      body: { phone, full_name: row.fullName, role: 'installer' },
    });
    results.push({
      phone: row.phone,
      ok: !error,
      message: error ? await inviteErrorMessage(error) : 'Invitation envoyée par SMS',
    });
  }
  return { results };
}
