// Envoi des notifications push (section 14), lancé chaque minute par pg_cron tant que des
// notifications récentes attendent. Réservé à la clé de service. Heures calmes (20 h – 7 h) :
// seules les alertes de seuil et de contrôle partent, les autres attendent le matin.
// Les jetons viennent de l'appli (Expo) ; sans appareil enregistré, la notification reste
// visible dans l'appli à la synchronisation.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { json } from '../_shared/http.ts';
import { expoMessages, shouldSendNow, type PushNotification } from '../_shared/notify/push.ts';
import { isServiceCall } from '../_shared/service.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100;

Deno.serve(async (req) => {
  if (!isServiceCall(req)) return json(403, { error: 'Réservé au serveur' });
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    {
      auth: { persistSession: false },
    },
  );
  const now = new Date().toISOString();
  const { data: pending, error } = await db
    .from('notifications')
    .select('id, kind, payload, recipient_id')
    .is('sent_at', null)
    .gt('created_at', new Date(Date.now() - 86_400_000).toISOString())
    .order('created_at')
    .limit(BATCH);
  if (error) return json(500, { error: error.message });

  let sent = 0;
  let held = 0;
  for (const n of pending ?? []) {
    if (!shouldSendNow(n.kind, now)) {
      held += 1;
      continue;
    }
    const { data: tokens } = await db
      .from('push_tokens')
      .select('token')
      .eq('profile_id', n.recipient_id);
    const list = (tokens ?? []).map((t) => t.token as string);
    let delivery: 'push' | 'no_device' | 'failed' = 'no_device';
    if (list.length > 0) {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(expoMessages(n as PushNotification, list)),
      }).catch(() => null);
      if (!res) continue; // réseau : nouvel essai à la minute suivante
      delivery = res.ok ? 'push' : 'failed';
      if (res.ok) sent += 1;
    }
    await db.from('notifications').update({ sent_at: now, delivery }).eq('id', n.id);
  }
  return json(200, { pending: pending?.length ?? 0, sent, held });
});
