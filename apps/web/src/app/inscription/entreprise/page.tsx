import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { CompanyWizard } from '@/components/SignupForms';
import { supabaseServer } from '@/lib/supabase/server';

export const metadata = { title: 'Votre entreprise · Preuvio' };

async function Wizard() {
  const supabase = await supabaseServer();
  const { data: claims } = await supabase.auth.getClaims();
  const id = claims?.claims?.sub;
  if (!id) redirect('/inscription');
  const { data: profile } = await supabase.from('profiles').select('id').eq('id', id).maybeSingle();
  if (profile) redirect('/');
  return <CompanyWizard />;
}

export default function CompanyPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-[32px] font-bold text-brand">Votre entreprise</h1>
      <Suspense fallback={<p className="text-text-muted">Chargement…</p>}>
        <Wizard />
      </Suspense>
    </main>
  );
}
