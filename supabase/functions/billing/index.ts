// Abonnement (section 15, S18) : ouvre une session Stripe Checkout ou le portail client Stripe.
// Réservé à l'admin et au dirigeant ; la clé Stripe ne quitte jamais le serveur.
//
// POST { action: "checkout", plan: "solo" | "team", interval: "month" | "year", origin }
// POST { action: "portal", origin }
// → { url } vers Stripe. Le webhook stripe-webhook enregistre ensuite l'abonnement.

import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  checkoutParams,
  priceLookupKey,
  safeReturnOrigin,
  type StripeInterval,
  type StripePlan,
  stripeForm,
} from '../_shared/billing/stripe.ts';
import { corsHeaders, json } from '../_shared/http.ts';

const STRIPE = 'https://api.stripe.com/v1';
const WEB_URL = Deno.env.get('WEB_URL') ?? 'https://preuvio-web.vercel.app';

async function stripe(path: string, init: { method?: string; body?: Record<string, unknown> } = {}) {
  const res = await fetch(`${STRIPE}${path}`, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: {
      Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: init.body ? stripeForm(init.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Stripe ${res.status}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Méthode non autorisée' });
  if (!Deno.env.get('STRIPE_SECRET_KEY')) return json(503, { error: 'Paiement pas encore configuré' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const asServer = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { data: claims } = await asCaller.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return json(401, { error: 'Connexion requise' });
  // Profil lu avec la session de l'appelant : la RLS garantit son entreprise.
  const { data: me } = await asCaller
    .from('profiles')
    .select('role, active, email, phone, company_id, companies ( id, name, stripe_customer_id )')
    .eq('id', uid)
    .maybeSingle();
  if (!me?.active || !['owner', 'admin'].includes(me.role)) {
    return json(403, { error: 'Réservé à l’admin et au dirigeant' });
  }
  const company = me.companies as unknown as {
    id: string;
    name: string;
    stripe_customer_id: string | null;
  };

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Requête illisible' });
  }
  const returnUrl = `${safeReturnOrigin(body.origin, WEB_URL)}/abonnement`;

  try {
    // Client Stripe de l'entreprise, créé une fois et gardé par le serveur.
    let customer = company.stripe_customer_id;
    if (!customer) {
      const created = await stripe('/customers', {
        body: {
          name: company.name,
          email: me.email ?? undefined,
          phone: me.phone ?? undefined,
          preferred_locales: ['fr'],
          metadata: { company_id: company.id },
        },
      });
      customer = created.id as string;
      const { error } = await asServer
        .from('companies')
        .update({ stripe_customer_id: customer })
        .eq('id', company.id)
        .is('stripe_customer_id', null);
      if (error) return json(500, { error: 'Client Stripe non enregistré' });
    }

    if (body.action === 'portal') {
      const session = await stripe('/billing_portal/sessions', {
        body: {
          customer,
          return_url: returnUrl,
          configuration: Deno.env.get('STRIPE_PORTAL_CONFIG') || undefined,
          locale: 'fr',
        },
      });
      return json(200, { url: session.url });
    }

    if (body.action === 'checkout') {
      const plan = body.plan as StripePlan;
      const interval = body.interval as StripeInterval;
      if (!['solo', 'team'].includes(plan) || !['month', 'year'].includes(interval)) {
        return json(400, { error: 'Offre inconnue' });
      }
      const { data: current } = await asServer
        .from('subscriptions')
        .select('status')
        .eq('company_id', company.id)
        .maybeSingle();
      if (current && ['active', 'trialing', 'past_due'].includes(current.status)) {
        return json(409, { error: 'Abonnement déjà actif : changez d’offre depuis le portail' });
      }
      const prices = await stripe(
        `/prices?active=true&lookup_keys[]=${priceLookupKey(plan, interval)}`,
      );
      const price = prices.data?.[0];
      if (!price) return json(503, { error: 'Prix introuvable : lancer scripts/stripe-setup.sh' });
      const session = await stripe('/checkout/sessions', {
        body: checkoutParams({
          customer,
          priceId: price.id,
          companyId: company.id,
          returnUrl,
          taxRateId: Deno.env.get('STRIPE_TAX_RATE_ID') || null,
        }),
      });
      return json(200, { url: session.url });
    }
    return json(400, { error: 'Action inconnue' });
  } catch (e) {
    return json(502, { error: `Stripe : ${e instanceof Error ? e.message : e}` });
  }
});
