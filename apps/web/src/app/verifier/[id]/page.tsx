// Vérification d'un rapport (QR code du PDF, section 9) : page publique, sans connexion.
// Elle n'affiche que la référence du chantier, l'entreprise, la version et l'empreinte.
import { formatParis, REPORT_TITLES, type ReportKind } from '@preuvio/shared';
import { createClient } from '@supabase/supabase-js';
import { Suspense } from 'react';
import { HashCheck } from '@/components/HashCheck';
import { supabaseEnv } from '@/lib/supabase/env';

type Verified = {
  reference: string | null;
  company: string;
  kind: ReportKind;
  version: number;
  pdf_created_at: string;
  pdf_sha256: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Verification({ params }: { params: PageProps<'/verifier/[id]'>['params'] }) {
  const { id } = await params;
  let found: Verified | null = null;
  if (UUID.test(id)) {
    const { url, key } = supabaseEnv();
    const anon = createClient(url, key, { auth: { persistSession: false } });
    const { data } = await anon.rpc('verify_report', { p_id: id }).maybeSingle<Verified>();
    found = data ?? null;
  }
  if (!found) {
    return (
      <p role="alert" className="text-xl font-bold text-ko">
        Aucun document émis ne correspond à ce lien.
      </p>
    );
  }
  return (
    <>
      <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4">
        <span className="text-xl font-bold">
          {REPORT_TITLES[found.kind]} · version {found.version}
        </span>
        <span>
          {found.company} · chantier {found.reference ?? 'sans référence'}
        </span>
        <span className="text-text-muted">Émis le {formatParis(found.pdf_created_at)}</span>
        <span className="text-text-muted">Empreinte SHA-256 du document d’origine :</span>
        <code className="break-all text-base">{found.pdf_sha256}</code>
      </div>
      <HashCheck expected={found.pdf_sha256} />
    </>
  );
}

export default function VerifyPage(props: PageProps<'/verifier/[id]'>) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-[32px] font-bold text-brand">Vérifier un document Preuvio</h1>
      <Suspense fallback={<p className="text-text-muted">Vérification…</p>}>
        <Verification params={props.params} />
      </Suspense>
    </main>
  );
}
