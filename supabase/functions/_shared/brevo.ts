// Envoi de SMS transactionnels par Brevo (prestataire français, section 4).
// Non testé de bout en bout : l'URL de l'API SMS est à confirmer dans la doc Brevo
// lors de la première mise en service avec une vraie clé.

const BREVO_SMS_URL = 'https://api.brevo.com/v3/transactionalSMS/sms';

/** Vrai si une clé Brevo est configurée dans les secrets des Edge Functions. */
export function brevoConfigured(): boolean {
  return Boolean(Deno.env.get('BREVO_API_KEY'));
}

/** Envoie un SMS. Le numéro est au format +33… ; le contenu n'est jamais journalisé. */
export async function sendSms(phone: string, content: string): Promise<void> {
  const apiKey = Deno.env.get('BREVO_API_KEY');
  if (!apiKey) throw new Error('BREVO_API_KEY manquante');
  const res = await fetch(BREVO_SMS_URL, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: Deno.env.get('BREVO_SMS_SENDER') ?? 'Preuvio',
      recipient: phone.replace(/^\+/, ''),
      content,
      type: 'transactional',
    }),
  });
  if (!res.ok) throw new Error(`Brevo a refusé l'envoi (HTTP ${res.status})`);
}
