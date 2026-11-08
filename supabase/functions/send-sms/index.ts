// Hook « Send SMS » de Supabase Auth : envoie le code de connexion par Brevo (section 4).
// Supabase ne gère pas Brevo nativement ; ce hook remplace le fournisseur SMS intégré.
//
// À activer (config.toml [auth.hook.send_sms] en local, tableau de bord Supabase en ligne) avec :
//   SEND_SMS_HOOK_SECRETS  secret du hook, au format « v1,whsec_… » (fourni par Supabase)
//   BREVO_API_KEY          clé API Brevo (jamais dans l'appli mobile)
//   BREVO_SMS_SENDER       nom d'expéditeur, 11 caractères max (ex. « Preuvio »)
//
// Non testé de bout en bout : à vérifier avec un vrai compte Brevo en session S4
// (notamment l'URL de l'API SMS transactionnelle, à confirmer dans la doc Brevo).

import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

const BREVO_SMS_URL = 'https://api.brevo.com/v3/transactionalSMS/sms';

type SendSmsPayload = { user: { phone: string }; sms: { otp: string } };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Méthode non autorisée' });

  const secret = Deno.env.get('SEND_SMS_HOOK_SECRETS')?.replace('v1,whsec_', '');
  const apiKey = Deno.env.get('BREVO_API_KEY');
  if (!secret || !apiKey)
    return json(500, { error: { http_code: 500, message: 'Hook SMS non configuré' } });

  // Vérifie que l'appel vient bien de Supabase Auth (signature Standard Webhooks).
  const body = await req.text();
  let payload: SendSmsPayload;
  try {
    payload = new Webhook(secret).verify(body, Object.fromEntries(req.headers)) as SendSmsPayload;
  } catch {
    return json(401, { error: { http_code: 401, message: 'Signature invalide' } });
  }

  const res = await fetch(BREVO_SMS_URL, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: Deno.env.get('BREVO_SMS_SENDER') ?? 'Preuvio',
      recipient: payload.user.phone.replace(/^\+/, ''),
      content: `Preuvio : votre code est ${payload.sms.otp}`,
      type: 'transactional',
    }),
  });

  if (!res.ok) {
    // Le code n'est jamais journalisé.
    console.error("Brevo a refusé l'envoi du SMS", res.status);
    return json(502, { error: { http_code: 502, message: 'Envoi du SMS impossible' } });
  }
  return json(200, {});
});
