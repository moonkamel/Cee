import { accessBanner, permissions, PLAN_INFO } from '@preuvio/shared';
import Link from 'next/link';
import { Suspense } from 'react';
import { ArchiveButton, PlanPicker, PortalButton } from '@/components/BillingForms';
import { companyAccess } from '@/lib/access';
import { currentUser } from '@/lib/dal';
import { supabaseServer } from '@/lib/supabase/server';

// Offres, paiement et résiliation en libre-service (section 15).

async function Billing({
  searchParams,
}: {
  searchParams: PageProps<'/abonnement'>['searchParams'];
}) {
  const { paiement } = await searchParams;
  const paid = typeof paiement === 'string' ? paiement : undefined;
  const user = await currentUser();
  if (!permissions(user.role).manageTeam) {
    return <p>Abonnement géré par l’admin et le dirigeant.</p>;
  }
  const access = await companyAccess();
  const supabase = await supabaseServer();
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status, billing_interval, current_period_end, cancel_at_period_end')
    .maybeSingle();
  const active = access.kind === 'active' ? access.plan : null;
  const end = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })
    : null;
  return (
    <>
      {paid === 'ok' ? (
        <p role="status" className="font-bold text-ok">
          Paiement reçu : l’abonnement s’active dans quelques secondes.
        </p>
      ) : null}
      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold">Situation</h2>
        <p>
          {active
            ? `Offre ${PLAN_INFO[active].label}${sub?.billing_interval === 'year' ? ', annuelle' : ', mensuelle'}${
                end
                  ? sub?.cancel_at_period_end
                    ? ` : résiliée, active jusqu’au ${end}`
                    : ` : renouvellement le ${end}`
                  : ''
              }.`
            : accessBanner(access)}
        </p>
        {sub?.status === 'past_due' ? (
          <p className="font-bold text-warn">
            Paiement en retard : mettez à jour votre moyen de paiement.
          </p>
        ) : null}
        {sub ? <PortalButton /> : null}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">{active ? 'Changer d’offre' : 'Choisir une offre'}</h2>
        {active ? (
          <p className="text-text-muted">
            Changement d’offre et résiliation depuis le portail ci-dessus.
          </p>
        ) : null}
        <PlanPicker current={active} />
        <p className="text-base text-text-muted">
          Prix hors taxes. Carte bancaire ou prélèvement SEPA, factures avec TVA. Stockage des
          photos et analyses IA inclus.
        </p>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Vos données</h2>
        <p>
          Partir est simple : exportez à tout moment toutes vos données (photos originales, PDF,
          CSV), puis résiliez en un clic depuis le portail.
        </p>
        <ArchiveButton />
        <Link href="/abonnement/donnees">Exports déjà préparés</Link>
      </section>
    </>
  );
}

export default function BillingPage({ searchParams }: PageProps<'/abonnement'>) {
  return (
    <>
      <h1 className="text-[32px] font-bold">Abonnement</h1>
      <Suspense fallback={<p className="text-text-muted">Chargement…</p>}>
        <Billing searchParams={searchParams} />
      </Suspense>
    </>
  );
}
