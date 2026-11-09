// Page client et PV de réception (section 12, S16). Le client n'a pas de compte : chaque appel
// porte le jeton du lien, vérifié en base (fonctions réservées à la clé de service). Appelée par
// le serveur web, jamais directement par le navigateur.
//
// POST { action, token, … }
//   view       données de la page et liens signés (1 h) vers photos et documents
//   send_code  code SMS de confirmation (si le lien l'exige)
//   sign       signature du PV : image rangée, empreinte du contenu, PV enregistré, PDF composé
//              ici (rien n'est fourni par le navigateur) puis envoyé au client
//   send_link  (bureau connecté) envoi du lien au client par SMS

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { brevoConfigured, sendEmail, sendSms } from '../_shared/brevo.ts';
import { canonicalJson, newSmsCode, pvContent } from '../_shared/client/index.ts';
import { corsHeaders, json } from '../_shared/http.ts';
import { renderPv } from './pv-pdf.ts';

const URL_TTL = 3600;

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const text = (s: string) => new TextEncoder().encode(s);
const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

type Portal = {
  link: { id: string; require_sms: boolean; expires_at: string; purpose: string };
  company: {
    id: string;
    name: string;
    phone: string | null;
    logo_path: string | null;
    rge: unknown;
  };
  jobsite: {
    id: string;
    reference: string | null;
    address: string;
    client_name: string | null;
    operations: string[];
  };
  photos: { id: string; thumbnail_path: string | null; original_path: string }[];
  report: { pdf_path: string | null } | null;
  signature: { id: string; pdf_path: string | null } | null;
};

async function signedUrls(db: SupabaseClient, bucket: string, paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data } = await db.storage.from(bucket).createSignedUrls(unique, URL_TTL);
  return Object.fromEntries(
    (data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl]] : [])),
  );
}

async function portal(db: SupabaseClient, token: string): Promise<Portal | null> {
  const { data } = await db.rpc('client_portal', { p_token: token });
  return (data as Portal | null) ?? null;
}

async function clientContact(db: SupabaseClient, jobsiteId: string) {
  const { data } = await db
    .from('jobsites')
    .select('clients ( phone, email ), companies ( name, siret )')
    .eq('id', jobsiteId)
    .maybeSingle();
  return data as unknown as {
    clients: { phone: string | null; email: string | null } | null;
    companies: { name: string; siret: string | null };
  } | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Méthode non autorisée' });
  const url = Deno.env.get('SUPABASE_URL')!;
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const token = typeof body.token === 'string' ? body.token : '';
  if (!token) return json(400, { error: 'Lien incomplet' });

  try {
    switch (body.action) {
      case 'view': {
        const p = await portal(db, token);
        if (!p) return json(404, { error: 'Lien invalide ou expiré' });
        const photoUrls = await signedUrls(
          db,
          'photos',
          p.photos.flatMap((ph) => [ph.thumbnail_path ?? '', ph.original_path]),
        );
        const docUrls = await signedUrls(db, 'documents', [
          p.company.logo_path ?? '',
          p.report?.pdf_path ?? '',
          p.signature?.pdf_path ?? '',
        ]);
        return json(200, { ...p, urls: { ...photoUrls, ...docUrls } });
      }

      case 'send_code': {
        if (!brevoConfigured()) return json(503, { error: 'Envoi de SMS indisponible' });
        const code = newSmsCode();
        const { data: phone, error } = await db.rpc('client_code_set', {
          p_token: token,
          p_code_hash: await sha256Hex(text(code)),
        });
        if (error || !phone) return json(400, { error: error?.message ?? 'Code impossible' });
        await sendSms(
          phone as string,
          `Votre code de signature : ${code}. Il expire dans 10 minutes.`,
        );
        return json(200, { ok: true });
      }

      case 'sign': {
        const p = await portal(db, token);
        if (!p) return json(404, { error: 'Lien invalide ou expiré' });
        if (p.signature) return json(409, { error: 'Le PV de ce chantier est déjà signé' });
        const png = typeof body.signature_png === 'string' ? fromBase64(body.signature_png) : null;
        if (!png || png.length < 100 || png[0] !== 0x89)
          return json(400, { error: 'Signature manquante' });
        const contact = await clientContact(db, p.jobsite.id);
        const signer = String(body.signer ?? '').trim();
        const pv = pvContent({
          company: {
            name: p.company.name,
            siret: contact?.companies.siret ?? null,
            rge: p.company.rge,
          },
          client: p.jobsite.client_name,
          address: p.jobsite.address,
          reference: p.jobsite.reference,
          operations: p.jobsite.operations,
          reserves: typeof body.reserves === 'string' ? body.reserves : null,
          signer,
          signedAt: new Date().toISOString(),
          marketingConsent: body.marketing_consent === true,
          smsVerified: p.link.require_sms,
        });
        const path = `${p.company.id}/pv/${crypto.randomUUID()}.png`;
        const up = await db.storage
          .from('documents')
          .upload(path, png, { contentType: 'image/png' });
        if (up.error) return json(500, { error: 'Signature non enregistrée' });
        const { data: id, error } = await db.rpc('client_sign', {
          p_token: token,
          p_signer_name: signer,
          p_reserves: pv.reserves,
          p_signature_path: path,
          p_document_sha256: await sha256Hex(text(canonicalJson(pv))),
          p_pv: pv,
          p_marketing_consent: pv.marketingConsent,
          p_code: typeof body.code === 'string' ? body.code : null,
          p_ip: typeof body.ip === 'string' && body.ip ? body.ip : null,
          p_user_agent: typeof body.user_agent === 'string' ? body.user_agent : null,
        });
        if (error) return json(400, { error: error.message });
        if (!id) return json(401, { error: 'Code faux ou expiré' });

        // PDF du PV : gabarit fixe, composé ici, rangé une fois avec son empreinte.
        const pdf = await renderPv(pv, png, await sha256Hex(text(canonicalJson(pv))));
        const pdfPath = `${p.company.id}/pv/${id}.pdf`;
        const stored = await db.storage
          .from('documents')
          .upload(pdfPath, pdf, { contentType: 'application/pdf' });
        if (!stored.error) {
          await db.rpc('client_store_pv', {
            p_token: token,
            p_signature: id,
            p_pdf_path: pdfPath,
            p_pdf_sha256: await sha256Hex(pdf),
          });
        }
        // Envoi au client : lien vers sa page, où le PV signé se télécharge.
        const pageUrl = typeof body.page_url === 'string' ? body.page_url : '';
        const message = `${p.company.name} : votre PV de réception signé est disponible : ${pageUrl}`;
        const sent: string[] = [];
        if (brevoConfigured() && pageUrl && p.link.purpose === 'client') {
          if (contact?.clients?.phone) {
            await sendSms(contact.clients.phone, message)
              .then(() => sent.push('sms'))
              .catch(() => undefined);
          }
          if (contact?.clients?.email) {
            await sendEmail({
              to: contact.clients.email,
              senderName: p.company.name,
              subject: 'Votre PV de réception signé',
              text: `Bonjour,\n\n${message}\n`,
            })
              .then(() => sent.push('email'))
              .catch(() => undefined);
          }
        }
        return json(200, { signature_id: id, pdf: !stored.error, sent });
      }

      case 'send_link': {
        // Le bureau est connecté : sa session vérifie qu'il voit ce lien (RLS).
        const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
          global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
        });
        const { data: link } = await asCaller
          .from('share_links')
          .select('id, jobsite_id')
          .eq('token_hash', await sha256Hex(text(token)))
          .maybeSingle();
        if (!link) return json(403, { error: 'Lien introuvable ou réservé au bureau' });
        if (!brevoConfigured()) return json(503, { error: 'Envoi de SMS indisponible' });
        const contact = await clientContact(db, link.jobsite_id);
        if (!contact?.clients?.phone)
          return json(400, { error: 'Pas de téléphone pour ce client' });
        const pageUrl = String(body.page_url ?? '');
        await sendSms(
          contact.clients.phone,
          `${contact.companies.name} : suivez vos travaux et signez votre PV de réception : ${pageUrl}`,
        );
        return json(200, { ok: true });
      }

      default:
        return json(400, { error: 'Action inconnue' });
    }
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : 'Erreur' });
  }
});
