// Envoi d'un export au délégataire (section 11) : lien de téléchargement signé, valable 7 jours,
// envoyé par e-mail (Brevo). Réservé au bureau, à l'admin et au dirigeant.
//
// POST { export_id, email }
//   1. lit l'export AVEC LA SESSION DE L'APPELANT : la RLS réserve les exports au bureau ;
//   2. crée le lien signé avec la clé serveur (le web n'en a pas) ;
//   3. envoie l'e-mail, puis note l'envoi dans l'historique (toujours avec la session).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendEmail } from '../_shared/brevo.ts';
import { corsHeaders, json } from '../_shared/http.ts';

const LINK_DAYS = 7;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Méthode non autorisée' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const asServer = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const body = (await req.json().catch(() => null)) as {
    export_id?: string;
    email?: string;
  } | null;
  const email = body?.email?.trim() ?? '';
  if (!body?.export_id || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { error: 'Export et adresse e-mail requis' });
  }

  const { data: exp } = await asCaller
    .from('exports')
    .select('id, zip_path, jobsite_ids, companies ( name ), delegataires ( name )')
    .eq('id', body.export_id)
    .maybeSingle<{
      id: string;
      zip_path: string | null;
      jobsite_ids: string[];
      companies: { name: string } | null;
      delegataires: { name: string } | null;
    }>();
  if (!exp) return json(403, { error: 'Export introuvable ou réservé au bureau' });
  if (!exp.zip_path) return json(409, { error: 'Export pas encore prêt' });
  const { data: jobsite } = await asCaller
    .from('jobsites')
    .select('reference, address')
    .eq('id', exp.jobsite_ids[0])
    .maybeSingle<{ reference: string | null; address: string }>();

  const expiresAt = new Date(Date.now() + LINK_DAYS * 86_400_000);
  const { data: link } = await asServer.storage
    .from('documents')
    .createSignedUrl(exp.zip_path, LINK_DAYS * 86_400, {
      download: `${jobsite?.reference ?? 'dossier'}.zip`,
    });
  if (!link?.signedUrl) return json(502, { error: 'Lien impossible à créer' });

  const company = exp.companies?.name ?? 'Preuvio';
  const label = jobsite?.reference ?? jobsite?.address ?? 'chantier';
  try {
    await sendEmail({
      to: email,
      senderName: company,
      subject: `Dossier ${label} — ${company}`,
      text: [
        'Bonjour,',
        '',
        `${company} vous transmet le dossier du chantier ${label}${
          jobsite?.address && jobsite.reference ? ` (${jobsite.address})` : ''
        }.`,
        '',
        `Téléchargement (valable jusqu’au ${expiresAt.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}) :`,
        link.signedUrl,
        '',
        'Le fichier manifest.json du dossier donne l’empreinte SHA-256 de chaque pièce.',
      ].join('\n'),
    });
  } catch (e) {
    return json(503, { error: e instanceof Error ? e.message : 'Envoi impossible' });
  }

  await asCaller
    .from('exports')
    .update({
      status: 'sent',
      sent_to: email,
      sent_at: new Date().toISOString(),
      link_expires_at: expiresAt.toISOString(),
    })
    .eq('id', exp.id);
  return json(200, { ok: true, expires_at: expiresAt.toISOString() });
});
