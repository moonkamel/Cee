import { permissions } from '@preuvio/shared';
import Link from 'next/link';
import { Suspense } from 'react';
import { currentUser } from '@/lib/dal';
import { supabaseServer } from '@/lib/supabase/server';

// Export complet des données de l'entreprise (section 15) : un dossier ZIP par chantier, composé
// à la demande (photos originales filigranées, pièces, PV, synthèse PDF, métadonnées CSV,
// manifeste d'empreintes), et la liste de tous les chantiers en CSV.

async function Archive({
  searchParams,
}: {
  searchParams: PageProps<'/abonnement/donnees'>['searchParams'];
}) {
  const { lot } = await searchParams;
  const batch = typeof lot === 'string' ? lot : undefined;
  const user = await currentUser();
  if (!permissions(user.role).manageTeam) return <p>Réservé à l’admin et au dirigeant.</p>;
  const supabase = await supabaseServer();
  let query = supabase
    .from('exports')
    .select('id, batch_id, status, zip_size, created_at, jobsite_ids')
    .eq('purpose', 'archive')
    .order('created_at', { ascending: false })
    .limit(500);
  if (batch) query = query.eq('batch_id', batch);
  const { data: rows } = await query;
  const ids = [...new Set((rows ?? []).map((r) => r.jobsite_ids[0]))];
  const { data: jobsites } = ids.length
    ? await supabase.from('jobsites').select('id, reference, address').in('id', ids)
    : { data: [] };
  const label = new Map((jobsites ?? []).map((j) => [j.id, j.reference ?? j.address]));
  return (
    <>
      <a
        href="/abonnement/donnees/csv"
        className="min-h-12 self-start rounded-xl border border-border px-4 py-3 font-bold no-underline"
      >
        Télécharger la liste des chantiers (CSV)
      </a>
      {rows?.length ? (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3">
              <span className="font-bold">{label.get(r.jobsite_ids[0]) ?? 'Chantier'}</span>
              <a href={`/exports/${r.id}/zip`}>
                {r.status === 'ready' ? 'Télécharger le dossier' : 'Préparer et télécharger'}
              </a>
              {r.zip_size ? (
                <span className="text-text-muted">{Math.ceil(r.zip_size / 1_000_000)} Mo</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-text-muted">Aucun export complet préparé.</p>
      )}
    </>
  );
}

export default function ArchivePage({ searchParams }: PageProps<'/abonnement/donnees'>) {
  return (
    <>
      <Link href="/abonnement">← Abonnement</Link>
      <h1 className="text-[32px] font-bold">Toutes mes données</h1>
      <p className="text-text-muted">
        Chaque dossier se prépare au premier clic (quelques secondes par chantier), puis reste
        disponible.
      </p>
      <Suspense fallback={<p className="text-text-muted">Chargement…</p>}>
        <Archive searchParams={searchParams} />
      </Suspense>
    </>
  );
}
