'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { portalCall } from '@/lib/client-portal';

// Actions du client sur sa page (section 12) : pas de compte, le jeton du lien fait foi.

export type SignState = { error?: string; ok?: boolean; codeSent?: boolean } | null;

export async function sendSignCode(_: SignState, form: FormData): Promise<SignState> {
  const res = await portalCall({ action: 'send_code', token: String(form.get('token') ?? '') });
  return res.ok ? { codeSent: true } : { error: res.error };
}

export async function signPv(_: SignState, form: FormData): Promise<SignState> {
  const token = String(form.get('token') ?? '');
  const signer = String(form.get('signer') ?? '').trim();
  const withReserves = form.get('reception') === 'reserves';
  const reserves = withReserves ? String(form.get('reserves') ?? '').trim() : '';
  const signature = String(form.get('signature') ?? '');
  if (!signer) return { error: 'Indiquez votre nom' };
  if (withReserves && !reserves) return { error: 'Décrivez les réserves' };
  if (!signature.startsWith('data:image/png;base64,')) return { error: 'Signez dans le cadre' };
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const res = await portalCall({
    action: 'sign',
    token,
    signer,
    reserves: reserves || null,
    marketing_consent: form.get('consent') === 'on',
    code: String(form.get('code') ?? '').replace(/\D/g, '') || null,
    signature_png: signature.slice('data:image/png;base64,'.length),
    ip: (h.get('x-forwarded-for') ?? '').split(',')[0]!.trim() || null,
    user_agent: h.get('user-agent'),
    page_url: host ? `${proto}://${host}/c/${token}` : null,
  });
  if (!res.ok) return { error: res.error };
  revalidatePath(`/c/${token}`);
  return { ok: true };
}
