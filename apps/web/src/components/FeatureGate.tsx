import { accessBanner, type Feature, hasFeature } from '@preuvio/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { companyAccess } from '@/lib/access';

const LABEL: Record<Feature, string> = {
  batches: 'Le suivi des lots CEE',
  marketing: 'Le recyclage marketing des photos',
};

/** Fonction réservée à l'offre Équipe (tableau de la section 15) ; ouverte pendant l'essai. */
export async function FeatureGate({
  feature,
  children,
}: {
  feature: Feature;
  children: ReactNode;
}) {
  if (hasFeature(await companyAccess(), feature)) return <>{children}</>;
  return (
    <p className="rounded-xl border border-border bg-surface p-4">
      {LABEL[feature]} est inclus dans l’offre Équipe.{' '}
      <Link href="/abonnement">Voir les offres</Link>
    </p>
  );
}

/** Bandeau d'essai ou de lecture seule, en haut de chaque page du tableau de bord. */
export async function AccessBanner() {
  const access = await companyAccess();
  const text = accessBanner(access);
  if (!text) return null;
  const urgent = access.kind !== 'trial';
  return (
    <div
      role={urgent ? 'alert' : 'status'}
      className={`border-b border-border px-4 py-2 text-center font-bold ${urgent ? 'bg-warn text-on-action' : 'bg-surface'}`}
    >
      {text} <Link href="/abonnement">{urgent ? 'Choisir une offre' : 'Voir les offres'}</Link>
    </div>
  );
}
