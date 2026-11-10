import { describe, expect, it } from 'vitest';
import {
  checkoutParams,
  planFromLookupKey,
  priceLookupKey,
  safeReturnOrigin,
  stripeForm,
  stripeSignature,
  subscriptionRow,
  verifyStripeSignature,
} from './stripe';

describe('prix et formulaires Stripe', () => {
  it('clé de recherche des prix', () => {
    expect(priceLookupKey('team', 'year')).toBe('team_year');
    expect(planFromLookupKey('solo_month')).toEqual({ plan: 'solo', interval: 'month' });
    expect(planFromLookupKey('enterprise_month')).toBeNull();
    expect(planFromLookupKey(null)).toBeNull();
  });

  it('session Checkout : TVA, numéro de TVA, retour sur l’abonnement', () => {
    const params = checkoutParams({
      customer: 'cus_1',
      priceId: 'price_1',
      companyId: 'c1',
      returnUrl: 'https://preuvio-web.vercel.app/abonnement',
      taxRateId: 'txr_1',
    });
    const body = new URLSearchParams(stripeForm(params));
    expect(body.get('mode')).toBe('subscription');
    expect(body.get('line_items[0][price]')).toBe('price_1');
    expect(body.get('subscription_data[metadata][company_id]')).toBe('c1');
    expect(body.get('subscription_data[default_tax_rates][0]')).toBe('txr_1');
    expect(body.get('tax_id_collection[enabled]')).toBe('true');
    expect(body.get('success_url')).toBe('https://preuvio-web.vercel.app/abonnement?paiement=ok');
    const noTax = new URLSearchParams(
      stripeForm(
        checkoutParams({
          ...{ customer: 'c', priceId: 'p', companyId: 'x', returnUrl: 'u' },
          taxRateId: null,
        }),
      ),
    );
    expect(noTax.has('subscription_data[default_tax_rates][0]')).toBe(false);
  });

  it('retour seulement vers le tableau de bord', () => {
    const fallback = 'https://preuvio-web.vercel.app';
    expect(safeReturnOrigin('https://preuvio-web-git-main-x.vercel.app', fallback)).toBe(
      'https://preuvio-web-git-main-x.vercel.app',
    );
    expect(safeReturnOrigin('http://localhost:3000', fallback)).toBe('http://localhost:3000');
    expect(safeReturnOrigin('https://evil.example', fallback)).toBe(fallback);
    expect(safeReturnOrigin(undefined, fallback)).toBe(fallback);
  });
});

describe('signature des webhooks', () => {
  const secret = 'whsec_test';
  const payload = '{"id":"evt_1"}';
  it('accepte la bonne signature, refuse le reste', async () => {
    const t = 1_794_300_000;
    const v1 = await stripeSignature(payload, t, secret);
    expect(await verifyStripeSignature(payload, `t=${t},v1=bad,v1=${v1}`, secret, t + 10)).toBe(
      true,
    );
    expect(await verifyStripeSignature(`${payload} `, `t=${t},v1=${v1}`, secret, t)).toBe(false);
    expect(await verifyStripeSignature(payload, `t=${t},v1=${v1}`, 'autre', t)).toBe(false);
    expect(await verifyStripeSignature(payload, `t=${t},v1=${v1}`, secret, t + 301)).toBe(false);
    expect(await verifyStripeSignature(payload, `t=${t}`, secret, t)).toBe(false);
    expect(await verifyStripeSignature(payload, 'v1=abc', secret, t)).toBe(false);
    expect(await verifyStripeSignature(payload, null, secret, t)).toBe(false);
    expect(await verifyStripeSignature(payload, `t=${t},v1=${v1}`, '', t)).toBe(false);
  });
});

describe('abonnement Stripe → base', () => {
  const sub = {
    id: 'sub_1',
    customer: 'cus_1',
    status: 'active',
    cancel_at_period_end: true,
    metadata: { company_id: 'c1' },
    items: {
      data: [
        {
          current_period_end: 1_796_000_000,
          price: { id: 'price_1', lookup_key: 'team_year', recurring: { interval: 'year' } },
        },
      ],
    },
  };
  it('offre, période et résiliation programmée', () => {
    expect(subscriptionRow(sub)).toEqual({
      stripe_customer_id: 'cus_1',
      stripe_subscription_id: 'sub_1',
      plan: 'team',
      billing_interval: 'year',
      stripe_price_id: 'price_1',
      status: 'active',
      current_period_end: '2026-11-30T00:53:20.000Z',
      cancel_at_period_end: true,
      company_id: 'c1',
    });
  });
  it('ancienne forme de l’API, client développé ; prix inconnu ignoré', () => {
    const old = {
      ...sub,
      customer: { id: 'cus_2' },
      metadata: undefined,
      cancel_at_period_end: undefined,
      current_period_end: 1_796_000_000,
      items: { data: [{ price: { id: 'p', lookup_key: 'solo_month' } }] },
    };
    expect(subscriptionRow(old)).toMatchObject({
      stripe_customer_id: 'cus_2',
      plan: 'solo',
      cancel_at_period_end: false,
      company_id: null,
      current_period_end: '2026-11-30T00:53:20.000Z',
    });
    expect(
      subscriptionRow({ ...old, current_period_end: undefined })?.current_period_end,
    ).toBeNull();
    expect(
      subscriptionRow({ ...sub, items: { data: [{ price: { id: 'p', lookup_key: 'x' } }] } }),
    ).toBeNull();
    expect(subscriptionRow({ ...sub, items: undefined })).toBeNull();
  });
});
