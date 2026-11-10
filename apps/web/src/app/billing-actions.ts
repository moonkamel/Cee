'use server';

import { permissions } from '@preuvio/shared';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/dal';
import { supabaseServer } from '@/lib/supabase/server';
import type { FormState } from './actions';

// Abonnement (section 15) : Stripe Checkout et portail client, ouverts par l'Edge Function
// « billing » (la clé Stripe reste sur le serveur). Export complet avant de partir.

async function billingUrl(body: Record<string, unknown>): Promise<string | { error: string }> {
  const user = await currentUser();
  if (!permissions(user.role).manageTeam) return { error: 'Réservé à l’admin et au dirigeant' };
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
  const supabase = await supabaseServer();
  const { data, error } = await supabase.functions.invoke('billing', { body: { ...body, origin } });
  if (error || !data?.url) {
    let message = 'Paiement indisponible pour le moment';
    try {
      const detail = await (error as { context?: Response })?.context?.json();
      if (detail?.error) message = detail.error;
    } catch {
      // message général
    }
    return { error: message };
  }
  return data.url as string;
}

export async function startCheckout(_: FormState, form: FormData): Promise<FormState> {
  const result = await billingUrl({
    action: 'checkout',
    plan: String(form.get('plan') ?? ''),
    interval: form.get('interval') === 'year' ? 'year' : 'month',
  });
  if (typeof result !== 'string') return result;
  redirect(result);
}

export async function openPortal(): Promise<FormState> {
  const result = await billingUrl({ action: 'portal' });
  if (typeof result !== 'string') return result;
  redirect(result);
}

/** Export complet : un dossier ZIP par chantier (photos, PDF, CSV), sans toucher aux chantiers. */
export async function createArchive(): Promise<FormState> {
  const user = await currentUser();
  if (!permissions(user.role).manageTeam) return { error: 'Réservé à l’admin et au dirigeant' };
  const supabase = await supabaseServer();
  const { data: jobsites } = await supabase.from('jobsites').select('id').eq('is_demo', false);
  if (!jobsites?.length) return { error: 'Aucun chantier à exporter' };
  const batch = crypto.randomUUID();
  const { error } = await supabase
    .from('exports')
    .insert(jobsites.map((j) => ({ batch_id: batch, jobsite_ids: [j.id], purpose: 'archive' })));
  if (error) return { error: 'Export refusé' };
  redirect(`/abonnement/donnees?lot=${batch}`);
}
