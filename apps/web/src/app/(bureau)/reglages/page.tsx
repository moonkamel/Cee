import { Suspense } from 'react';
import { permissions } from '@preuvio/shared';
import { AlertSettingsForm } from '@/components/BatchForms';
import { CompanySettingsForm } from '@/components/ClientSpaceForms';
import { currentUser } from '@/lib/dal';
import { supabaseServer } from '@/lib/supabase/server';

async function Settings() {
  const user = await currentUser();
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('profiles')
    .select('email, muted_alerts')
    .eq('id', user.id)
    .maybeSingle();
  const { data: company } = permissions(user.role).manageTeam
    ? await supabase.from('companies').select('phone, google_review_url').maybeSingle()
    : { data: null };
  return (
    <>
      <AlertSettingsForm
        role={user.role}
        email={data?.email ?? null}
        muted={data?.muted_alerts ?? []}
      />
      {company ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold">Entreprise</h2>
          <CompanySettingsForm phone={company.phone} review={company.google_review_url} />
        </section>
      ) : null}
    </>
  );
}

export default function SettingsPage() {
  return (
    <>
      <h1 className="text-[32px] font-bold">Réglages</h1>
      <p className="text-text-muted">
        Heures calmes de 20 h à 7 h : seules les alertes de seuil et de contrôle passent la nuit.
      </p>
      <Suspense fallback={<p className="text-text-muted">Chargement…</p>}>
        <Settings />
      </Suspense>
    </>
  );
}
