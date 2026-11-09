// Envoi des alertes par e-mail (sections 10 et 14), lancé toutes les 5 minutes par pg_cron.
// Réservé à la clé de service. Récapitulatif des photos orange, lot proche du seuil,
// qualification RGE bientôt expirée. Sans adresse e-mail, l'alerte est déjà partie en push
// (app.notify) ; une adresse retirée entre-temps est notée « no_email ».

import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendEmail } from '../_shared/brevo.ts';
import { json } from '../_shared/http.ts';
import { isServiceCall } from '../_shared/service.ts';

const BATCH = 50;

type Pending = {
  id: string;
  kind: string;
  channel: string;
  payload: { title?: string; body?: string; jobsite_id?: string; batch_id?: string };
  profiles: { email: string | null } | null;
};

/** Écran utile dans le tableau de bord (section 14 : chaque alerte ouvre le bon écran). */
function link(base: string, n: Pending): string {
  if (n.payload.batch_id) return `${base}/lots/${n.payload.batch_id}`;
  if (n.payload.jobsite_id) return `${base}/chantiers/${n.payload.jobsite_id}`;
  if (n.kind === 'orange_overdue') return `${base}/chantiers?filtre=photos-orange`;
  return base;
}

Deno.serve(async (req) => {
  if (!isServiceCall(req)) return json(403, { error: 'Réservé au serveur' });
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    {
      auth: { persistSession: false },
    },
  );
  const base = (Deno.env.get('PREUVIO_WEB_URL') ?? 'https://preuvio-web.vercel.app').replace(
    /\/$/,
    '',
  );
  const { data, error } = await db
    .from('notifications')
    .select('id, kind, channel, payload, profiles ( email )')
    .is('email_sent_at', null)
    .neq('channel', 'push')
    .gt('created_at', new Date(Date.now() - 86_400_000).toISOString())
    .order('created_at')
    .limit(BATCH);
  if (error) return json(500, { error: error.message });

  let sent = 0;
  for (const n of (data ?? []) as unknown as Pending[]) {
    const now = new Date().toISOString();
    // Une alerte « e-mail seulement » est aussi close pour le push.
    const done = (delivery: 'email' | 'no_email' | 'failed') =>
      db
        .from('notifications')
        .update({
          email_sent_at: now,
          email_delivery: delivery,
          ...(n.channel === 'email' ? { sent_at: now } : {}),
        })
        .eq('id', n.id);
    const to = n.profiles?.email;
    if (!to) {
      await done('no_email');
      continue;
    }
    try {
      await sendEmail({
        to,
        senderName: 'Preuvio',
        subject: n.payload.title ?? 'Alerte Preuvio',
        text: [
          n.payload.body ?? '',
          '',
          `Ouvrir : ${link(base, n)}`,
          '',
          'Réglez vos alertes dans Preuvio, page Réglages.',
        ].join('\n'),
      });
      await done('email');
      sent += 1;
    } catch (e) {
      // Clé Brevo absente : rien n'est perdu, l'envoi reprendra quand elle sera configurée.
      if (e instanceof Error && e.message.includes('manquante'))
        return json(503, { error: e.message });
      await done('failed');
    }
  }
  return json(200, { pending: data?.length ?? 0, sent });
});
