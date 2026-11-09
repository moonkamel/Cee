// Hook « Send SMS » de Supabase Auth : envoie le code de connexion par Brevo (section 4).
// Supabase ne gère pas Brevo nativement ; ce hook remplace le fournisseur SMS intégré.
//
// À activer (config.toml [auth.hook.send_sms] en local, tableau de bord Supabase en ligne) avec :
//   SEND_SMS_HOOK_SECRETS  secret du hook, au format « v1,whsec_… » (fourni par Supabase)
//   BREVO_API_KEY          clé API Brevo (jamais dans l'appli mobile)
//   BREVO_SMS_SENDER       nom d'expéditeur, 11 caractères max (ex. « Preuvio »)

import { Webhook } from 'npm:standardwebhooks@1.0.0';
import { sendSms } from '../_shared/brevo.ts';
import { json } from '../_shared/http.ts';

type SendSmsPayload = { user: { phone: string }; sms: { otp: string } };

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Méthode non autorisée' });

  const secret = Deno.env.get('SEND_SMS_HOOK_SECRETS')?.replace('v1,whsec_', '');
  if (!secret) return json(500, { error: { http_code: 500, message: 'Hook SMS non configuré' } });

  // Vérifie que l'appel vient bien de Supabase Auth (signature Standard Webhooks).
  const body = await req.text();
  let payload: SendSmsPayload;
  try {
    payload = new Webhook(secret).verify(body, Object.fromEntries(req.headers)) as SendSmsPayload;
  } catch {
    return json(401, { error: { http_code: 401, message: 'Signature invalide' } });
  }

  try {
    await sendSms(payload.user.phone, `Preuvio : votre code est ${payload.sms.otp}`);
  } catch (e) {
    console.error('Envoi du code SMS impossible', e instanceof Error ? e.message : e);
    return json(502, { error: { http_code: 502, message: 'Envoi du SMS impossible' } });
  }
  return json(200, {});
});
