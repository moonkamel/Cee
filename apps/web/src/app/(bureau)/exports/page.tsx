import { type CheckStatus, formatParis, permissions } from '@preuvio/shared';
import Link from 'next/link';
import { Suspense } from 'react';
import { CreateExportForm, ExportRunner, SendLinkForm } from '@/components/ExportForms';
import { currentUser } from '@/lib/dal';
import { loadCandidates, loadDelegataires, loadExports } from '@/lib/exports/queries';

const DOT: Record<CheckStatus, string> = { ok: 'text-ok', warn: 'text-warn', ko: 'text-ko' };
const MARK: Record<CheckStatus, string> = { ok: '✓', warn: '!', ko: '✗' };
const STATUS: Record<string, string> = {
  pending: 'En attente',
  building: 'En fabrication',
  ready: 'Prêt',
  sent: 'Envoyé',
  failed: 'Échec',
};

async function Exports({ searchParams }: { searchParams: PageProps<'/exports'>['searchParams'] }) {
  const params = await searchParams;
  const user = await currentUser();
  if (!permissions(user.role).export) {
    return <p className="text-text-muted">Les exports sont réservés au bureau et au dirigeant.</p>;
  }
  const delegataires = await loadDelegataires();
  const chosen = delegataires.find((d) => d.id === params.d) ?? null;
  const [candidates, history] = await Promise.all([loadCandidates(chosen), loadExports()]);
  const lot = typeof params.lot === 'string' ? params.lot : null;
  const running = lot
    ? history
        .filter((e) => e.batch_id === lot && (e.status === 'pending' || e.status === 'building'))
        .map((e) => ({ id: e.id, label: e.reference ?? 'Chantier' }))
    : [];

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-[32px] font-bold">Exports</h1>
        <p className="text-text-muted">
          Un ZIP par chantier : synthèse, photos filigranées et nommées, pièces, métadonnées et
          manifeste d’empreintes. <Link href="/delegataires">Gérer les délégataires</Link>
        </p>
      </div>

      {running.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">Export en cours</h2>
          <ExportRunner items={running} />
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <form className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-bold">Délégataire</span>
            <select
              name="d"
              defaultValue={chosen?.id ?? ''}
              className="min-h-12 rounded-lg border border-border bg-surface px-3"
            >
              <option value="">Règles par défaut</option>
              {delegataires.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <button className="min-h-12 rounded-xl border-2 border-brand px-4 font-bold text-brand">
            Vérifier pour ce délégataire
          </button>
        </form>
        {candidates.length === 0 ? (
          <p className="text-text-muted">Aucun chantier commencé à exporter.</p>
        ) : null}
        <ul className="flex flex-col gap-3">
          {candidates.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4"
            >
              <label className="flex min-h-10 items-center gap-3">
                <input
                  type="checkbox"
                  name="jobsiteId"
                  value={c.id}
                  form="export-form"
                  className="h-6 w-6"
                />
                <span className="text-lg font-bold">{c.reference ?? c.address}</span>
                <span className="text-text-muted">
                  {[c.client, c.address].filter(Boolean).join(' · ')}
                </span>
              </label>
              <ul className="flex flex-col gap-1 pl-9">
                {c.checks.map((k) => (
                  <li key={k.key}>
                    <span className={`font-bold ${DOT[k.status]}`} aria-hidden>
                      {MARK[k.status]}
                    </span>{' '}
                    <span className="font-bold">{k.label}</span> : {k.detail}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        {candidates.length ? <CreateExportForm delegataireId={chosen?.id ?? null} /> : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Historique</h2>
        {history.length === 0 ? <p className="text-text-muted">Aucun export.</p> : null}
        <ul className="flex flex-col gap-3">
          {history.map((e) => (
            <li
              key={e.id}
              className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4"
            >
              <span>
                <strong>{e.reference ?? 'Chantier'}</strong> ·{' '}
                {e.delegataires?.name ?? 'règles par défaut'} · {formatParis(e.created_at)} ·{' '}
                {STATUS[e.status] ?? e.status}
                {e.incomplete ? <strong className="text-ko"> · incomplet</strong> : null}
                {e.zip_size ? ` · ${(e.zip_size / 1_048_576).toFixed(1)} Mo` : ''}
              </span>
              {e.error ? <span className="text-ko">{e.error}</span> : null}
              {e.sent_to ? (
                <span className="text-text-muted">
                  Lien envoyé à {e.sent_to}
                  {e.sent_at ? ` le ${formatParis(e.sent_at)}` : ''}
                  {e.link_expires_at ? `, valable jusqu’au ${formatParis(e.link_expires_at)}` : ''}
                </span>
              ) : null}
              {e.status === 'ready' || e.status === 'sent' ? (
                <div className="flex flex-wrap items-center gap-3">
                  <a href={`/exports/${e.id}/zip`} className="font-bold">
                    Télécharger le ZIP
                  </a>
                  <SendLinkForm exportId={e.id} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export default function ExportsPage(props: PageProps<'/exports'>) {
  return (
    <Suspense fallback={<p className="text-text-muted">Chargement…</p>}>
      <Exports searchParams={props.searchParams} />
    </Suspense>
  );
}
