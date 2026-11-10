// Webhook Stripe (section 15, S18) : abonnement créé, modifié ou résilié → table subscriptions
// et offre de l'entreprise. Appelé par Stripe, sans session : la signature fait foi.

import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  SUBSCRIPTION_EVENTS,
  subscriptionRow,
  verifyStripeSignature,
} from '../_shared/billing/stripe.ts';
import { json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Méthode non autorisée' });
  const payload = await req.text();
  const ok = await verifyStripeSignature(
    payload,
    req.headers.get('Stripe-Signature'),
    Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '',
    Math.floor(Date.now() / 1000),
  );
  if (!ok) return json(400, { error: 'Signature invalide' });

  const event = JSON.parse(payload) as { type: string; data: { object: unknown } };
  if (!(SUBSCRIPTION_EVENTS as readonly string[]).includes(event.type)) {
    return json(200, { ignored: event.type });
  }
  const row = subscriptionRow(event.data.object as Parameters<typeof subscriptionRow>[0]);
  if (!row) return json(200, { ignored: 'prix hors offre' });

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
  // Entreprise : celle du client Stripe enregistré (la métadonnée ne sert que de contrôle).
  const { data: company } = await db
    .from('companies')
    .select('id')
    .eq('stripe_customer_id', row.stripe_customer_id)
    .maybeSingle();
  if (!company || (row.company_id && row.company_id !== company.id)) {
    return json(200, { ignored: 'client inconnu' });
  }
  const paying = ['active', 'trialing', 'past_due'].includes(row.status);
  // Ancien abonnement résilié après un nouvel abonnement : il n'écrase pas le nouveau.
  const { data: current } = await db
    .from('subscriptions')
    .select('stripe_subscription_id, status')
    .eq('company_id', company.id)
    .maybeSingle();
  if (
    current &&
    current.stripe_subscription_id !== row.stripe_subscription_id &&
    ['active', 'trialing', 'past_due'].includes(current.status) &&
    !paying
  ) {
    return json(200, { ignored: 'ancien abonnement' });
  }
  const { company_id: _hint, ...fields } = row;
  const { error } = await db
    .from('subscriptions')
    .upsert({ company_id: company.id, ...fields }, { onConflict: 'company_id' });
  if (error) return json(500, { error: error.message });
  await db
    .from('companies')
    .update({ plan: paying ? row.plan : 'trial' })
    .eq('id', company.id);
  return json(200, { company: company.id, status: row.status });
});
