import Link from 'next/link';
import { Suspense } from 'react';
import { StatePill } from '@/components/StatePill';
import { filterJobsites, jobsiteView, TILE_FILTERS, type TileFilter } from '@/lib/dashboard';
import { loadDashboard } from '@/lib/queries';

export const metadata = { title: 'Chantiers · Preuvio' };

const TITLES: Record<TileFilter, string> = {
  'en-cours': 'Chantiers en cours',
  'a-risque': 'Chantiers à risque',
  'photos-orange': 'Photos à trancher',
};

async function List({ searchParams }: { searchParams: PageProps<'/chantiers'>['searchParams'] }) {
  const { filtre } = await searchParams;
  const filter = TILE_FILTERS.includes(filtre as TileFilter) ? (filtre as TileFilter) : null;
  const data = await loadDashboard();
  const views = filterJobsites(
    data.jobsites.map((j) => jobsiteView(j, data.today)),
    data.jobsites,
    filter,
  );
  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-[32px] font-bold">{filter ? TITLES[filter] : 'Chantiers'}</h1>
        <Link href="/chantiers/import">Importer un fichier CSV</Link>
      </div>
      {views.length === 0 ? <p className="text-text-muted">Aucun chantier.</p> : null}
      <ul className="flex flex-col gap-3">
        {views.map((v) => (
          <li key={v.id}>
            <Link
              href={`/chantiers/${v.id}`}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4 no-underline"
            >
              <span className="flex flex-1 flex-col">
                <span className="text-lg font-bold text-text">{v.label}</span>
                <span className="text-base text-text-muted">
                  {[v.client, v.installers.join(', ')].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="text-base text-text-muted">
                {v.score.ok}/{v.score.total} preuves · {v.score.percent} %
              </span>
              <StatePill state={v.state} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function JobsitesPage(props: PageProps<'/chantiers'>) {
  return (
    <Suspense fallback={<p className="text-text-muted">Chargement…</p>}>
      <List searchParams={props.searchParams} />
    </Suspense>
  );
}
