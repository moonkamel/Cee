// Stripe sans SDK (section 15, S18) : appels REST en formulaire, signature des webhooks vérifiée
// avec WebCrypto, abonnement Stripe → ligne `subscriptions`. Utilisé par les Edge Functions.
// Fichier recopié pour les Edge Functions (voir ai/deno-copy.ts) : aucun import.

export type StripePlan = 'solo' | 'team';
export type StripeInterval = 'month' | 'year';

/** Clé de recherche des prix créés par scripts/stripe-setup.sh : « solo_month », « team_year »… */
export function priceLookupKey(plan: StripePlan, interval: StripeInterval): string {
  return `${plan}_${interval}`;
}

export function planFromLookupKey(
  key: string | null | undefined,
): { plan: StripePlan; interval: StripeInterval } | null {
  const m = /^(solo|team)_(month|year)$/.exec(key ?? '');
  return m ? { plan: m[1] as StripePlan, interval: m[2] as StripeInterval } : null;
}

/** Corps de formulaire Stripe : objets et tableaux imbriqués en `a[b][0]=c`. */
export function stripeForm(params: Record<string, unknown>): string {
  const out = new URLSearchParams();
  const walk = (prefix: string, value: unknown) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) value.forEach((v, i) => walk(`${prefix}[${i}]`, v));
    else if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>))
        walk(`${prefix}[${k}]`, v);
    } else out.append(prefix, String(value));
  };
  for (const [k, v] of Object.entries(params)) walk(k, v);
  return out.toString();
}

/** Session Stripe Checkout d'un abonnement : TVA française, numéro de TVA de l'entreprise. */
export function checkoutParams(input: {
  customer: string;
  priceId: string;
  companyId: string;
  returnUrl: string;
  taxRateId: string | null;
}): Record<string, unknown> {
  return {
    mode: 'subscription',
    customer: input.customer,
    client_reference_id: input.companyId,
    line_items: [{ price: input.priceId, quantity: 1 }],
    subscription_data: {
      metadata: { company_id: input.companyId },
      default_tax_rates: input.taxRateId ? [input.taxRateId] : undefined,
    },
    tax_id_collection: { enabled: true },
    customer_update: { name: 'auto', address: 'auto' },
    billing_address_collection: 'required',
    locale: 'fr',
    success_url: `${input.returnUrl}?paiement=ok`,
    cancel_url: `${input.returnUrl}?paiement=annule`,
  };
}

/** Adresse de retour : seulement le tableau de bord (production, aperçus Vercel, poste local). */
export function safeReturnOrigin(origin: unknown, fallback: string): string {
  const value = typeof origin === 'string' ? origin : '';
  return /^https:\/\/preuvio-web(-[a-z0-9-]+)?\.vercel\.app$/.test(value) ||
    /^http:\/\/localhost:\d+$/.test(value)
    ? value
    : fallback;
}

// --- Webhooks ---------------------------------------------------------------------------------

const hex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Comparaison en temps constant. */
function sameText(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export async function stripeSignature(payload: string, timestamp: number, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`),
  );
  return hex(mac);
}

/**
 * En-tête `Stripe-Signature` (`t=…,v1=…`) : HMAC SHA-256 du corps brut avec le secret du
 * webhook, et horodatage de moins de 5 minutes (rejeu refusé).
 */
export async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  nowSeconds: number,
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = header.split(',').map((p) => p.trim().split('='));
  const t = Number(parts.find(([k]) => k === 't')?.[1]);
  const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v ?? '');
  if (!Number.isFinite(t) || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - t) > toleranceSeconds) return false;
  const expected = await stripeSignature(payload, t, secret);
  return signatures.some((s) => sameText(s, expected));
}

// --- Abonnement Stripe → base --------------------------------------------------------------------

type StripeSubscription = {
  id: string;
  customer: string | { id: string };
  status: string;
  cancel_at_period_end?: boolean;
  current_period_end?: number;
  metadata?: Record<string, string>;
  items?: {
    data?: {
      current_period_end?: number;
      price?: { id: string; lookup_key?: string | null; recurring?: { interval?: string } };
    }[];
  };
};

export type SubscriptionRow = {
  stripe_customer_id: string;
  stripe_subscription_id: string;
  plan: StripePlan;
  billing_interval: StripeInterval;
  stripe_price_id: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  /** Entreprise indiquée à la création de la session (sinon : retrouvée par le client Stripe). */
  company_id: string | null;
};

/** Abonnement Stripe → ligne à enregistrer ; null si le prix n'est pas une offre Preuvio. */
export function subscriptionRow(sub: StripeSubscription): SubscriptionRow | null {
  const item = sub.items?.data?.[0];
  const price = item?.price;
  const offer = planFromLookupKey(price?.lookup_key);
  if (!price || !offer) return null;
  // Selon la version de l'API, la fin de période est sur l'abonnement ou sur la ligne.
  const end = item?.current_period_end ?? sub.current_period_end ?? null;
  return {
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    plan: offer.plan,
    billing_interval: offer.interval,
    stripe_price_id: price.id,
    status: sub.status,
    current_period_end: end ? new Date(end * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end === true,
    company_id: sub.metadata?.company_id ?? null,
  };
}

/** Événements qui changent l'abonnement ; les autres sont acquittés sans rien faire. */
export const SUBSCRIPTION_EVENTS = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
] as const;
