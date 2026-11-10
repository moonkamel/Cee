// Santé du service (section 17), appelée par la supervision externe (disponibilité 99,5 %).
// Répond 200 si tout va bien, 503 si la base ne répond pas ou si l'analyse IA a plus de
// 5 minutes de retard. Aucune donnée d'entreprise : seulement des compteurs.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { json } from '../_shared/http.ts';
import { healthStatus, type QueueHealth } from '../_shared/telemetry/index.ts';

Deno.serve(async () => {
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await db.rpc('queue_health');
  if (error) return json(503, { ok: false, alerts: ['base injoignable'] });
  const queues = data as QueueHealth;
  const status = healthStatus(queues);
  return json(status.ok ? 200 : 503, { ...status, queues, at: new Date().toISOString() });
});
