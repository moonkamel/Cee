import { Suspense } from 'react';
import { AlertSettingsForm } from '@/components/BatchForms';
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
  return (
    <AlertSettingsForm
      role={user.role}
      email={data?.email ?? null}
      muted={data?.muted_alerts ?? []}
    />
  );
}

export default function SettingsPage() {
  return (
    <>
      <h1 className="text-[32px] font-bold">Réglages des alertes</h1>
      <p className="text-text-muted">
        Heures calmes de 20 h à 7 h : seules les alertes de seuil et de contrôle passent la nuit.
      </p>
      <Suspense fallback={<p className="text-text-muted">Chargement…</p>}>
        <Settings />
      </Suspense>
    </>
  );
}
