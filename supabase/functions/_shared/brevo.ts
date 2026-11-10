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

const BREVO_EMAIL_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Envoie un e-mail transactionnel. Expéditeur : BREVO_EMAIL_SENDER (adresse validée chez
 * Brevo), au nom de l'entreprise. Le contenu n'est jamais journalisé.
 */
export async function sendEmail(mail: {
  to: string;
  senderName: string;
  subject: string;
  text: string;
}): Promise<void> {
  const apiKey = Deno.env.get('BREVO_API_KEY');
  const sender = Deno.env.get('BREVO_EMAIL_SENDER');
  if (!apiKey || !sender) throw new Error('BREVO_API_KEY ou BREVO_EMAIL_SENDER manquante');
  const res = await fetch(BREVO_EMAIL_URL, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: sender, name: mail.senderName },
      to: [{ email: mail.to }],
      subject: mail.subject,
      textContent: mail.text,
    }),
  });
  if (!res.ok) throw new Error(`Brevo a refusé l'envoi (HTTP ${res.status})`);
}

type Rpc = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

/** Plafond quotidien de SMS de l'entreprise (section 16 : le SMS a un coût direct). */
export async function smsQuotaTake(db: Rpc, companyId: string): Promise<boolean> {
  const { data, error } = await db.rpc('sms_quota_take', { p_company: companyId });
  return !error && data === true;
}
