import 'server-only';
import { supabaseEnv } from './supabase/env';

// Appels à la fonction serveur client-portal (section 12) : le client n'a pas de compte, le
// jeton du lien fait foi. Seule la clé publique est utilisée ici.

export type PortalPhoto = {
  id: string;
  phase: string;
  label: string;
  taken_at: string;
  thumbnail_path: string | null;
  original_path: string;
  extracted: Record<string, string | null> | null;
};

export type PortalView = {
  link: { id: string; require_sms: boolean; expires_at: string; purpose: 'client' | 'client_mode' };
  company: {
    id: string;
    name: string;
    phone: string | null;
    logo_path: string | null;
    brand_color: string | null;
    google_review_url: string | null;
    rge: unknown;
  };
  jobsite: {
    id: string;
    reference: string | null;
    address: string;
    planned_start: string | null;
    planned_end: string | null;
    client_name: string | null;
    has_phone: boolean;
    has_email: boolean;
    operations: string[];
  };
  photos: PortalPhoto[];
  report: { pdf_path: string | null; content: unknown } | null;
  signature: {
    id: string;
    signed_at: string;
    signer_name: string;
    has_reserves: boolean;
    reserves: string | null;
    pdf_path: string | null;
  } | null;
  urls: Record<string, string>;
};

export async function portalCall<T>(
  body: Record<string, unknown>,
  authorization?: string,
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const { url, key } = supabaseEnv();
  try {
    const res = await fetch(`${url}/functions/v1/client-portal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: authorization ?? `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    return res.ok
      ? { ok: true, data }
      : { ok: false, status: res.status, error: data.error ?? 'Service indisponible' };
  } catch {
    return { ok: false, status: 503, error: 'Service indisponible' };
  }
}
