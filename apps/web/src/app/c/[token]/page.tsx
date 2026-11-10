// Page client (section 12) : pensée pour le téléphone, aux couleurs de l'entreprise, sans compte.
// Le jeton du lien fait foi ; la page est exclue des moteurs de recherche.
import {
  equipmentFrom,
  formatParis,
  galleries,
  GALLERY_TITLES,
  offerReview,
  parseContent,
} from '@preuvio/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ClientSignForm } from '@/components/ClientSignForm';
import { portalCall, type PortalView } from '@/lib/client-portal';
import { companyColor } from '@/lib/pdf/build';

export const metadata: Metadata = {
  title: 'Vos travaux',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

const day = (d: string | null) => (d ? formatParis(`${d}T12:00:00Z`, false) : '');

function rgeMention(raw: unknown): string | null {
  const list = (Array.isArray(raw) ? raw : []) as { organisme?: string; numero?: string }[];
  const names = list.map((q) => [q.organisme, q.numero].filter(Boolean).join(' ')).filter(Boolean);
  return names.length ? `Entreprise qualifiée RGE (${names.join(', ')})` : null;
}

async function Portal({ params }: { params: PageProps<'/c/[token]'>['params'] }) {
  const { token } = await params;
  const res = await portalCall<PortalView>({ action: 'view', token });
  if (!res.ok) {
    return (
      <p role="alert" className="text-xl font-bold text-ko">
        {res.status === 404
          ? 'Ce lien n’est plus valable. Demandez-en un nouveau à l’entreprise.'
          : 'Page indisponible pour le moment. Réessayez dans quelques minutes.'}
      </p>
    );
  }
  const v = res.data;
  const color = companyColor(v.company.brand_color);
  const url = (path: string | null | undefined) => (path ? v.urls[path] : undefined);
  const report = v.report ? parseContent(v.report.content, 'completion') : null;
  const summary = report
    ? [...report.sections.summary, ...report.sections.works].map((s) => s.text)
    : [];
  const equipment = equipmentFrom(
    v.photos.map((p) => ({
      label: p.label,
      phase: p.phase,
      ai_result: { verdict: { extracted: p.extracted } },
    })),
  );
  const rge = rgeMention(v.company.rge);
  const tel = v.company.phone?.replace(/[^\d+]/g, '');

  return (
    <>
      <header className="flex items-center gap-3 border-b-4 pb-3" style={{ borderColor: color }}>
        {url(v.company.logo_path) ? (
          // eslint-disable-next-line @next/next/no-img-element -- lien signé temporaire du stockage privé
          <img src={url(v.company.logo_path)} alt="" className="h-12 w-auto" />
        ) : null}
        <div className="flex flex-col">
          <span className="text-2xl font-bold" style={{ color }}>
            {v.company.name}
          </span>
          {rge ? <span className="text-base text-text-muted">{rge}</span> : null}
        </div>
      </header>

      <section className="flex flex-col gap-1">
        <h1 className="text-[28px] font-bold">Vos travaux</h1>
        {v.jobsite.client_name ? <p className="text-lg">{v.jobsite.client_name}</p> : null}
        <p className="text-lg">{v.jobsite.address}</p>
        {v.jobsite.planned_start ? (
          <p className="text-text-muted">
            {v.jobsite.planned_end && v.jobsite.planned_end !== v.jobsite.planned_start
              ? `Du ${day(v.jobsite.planned_start)} au ${day(v.jobsite.planned_end)}`
              : `Le ${day(v.jobsite.planned_start)}`}
          </p>
        ) : null}
      </section>

      {tel ? (
        <section className="grid grid-cols-2 gap-3">
          <a
            href={`tel:${tel}`}
            className="flex min-h-14 items-center justify-center rounded-xl bg-action text-lg font-bold text-on-action no-underline"
          >
            Appeler
          </a>
          <a
            href={`sms:${tel}`}
            className="flex min-h-14 items-center justify-center rounded-xl border-2 border-brand text-lg font-bold text-brand no-underline"
          >
            Envoyer un SMS
          </a>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold">Les travaux</h2>
        <ul className="list-inside list-disc text-lg">
          {v.jobsite.operations.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
        {summary.map((s, i) => (
          <p key={i}>{s}</p>
        ))}
        {equipment.length ? (
          <>
            <h3 className="text-xl font-bold">Équipements posés</h3>
            <ul className="list-inside list-disc">
              {equipment.map((e, i) => (
                <li key={i}>
                  {[e.brand, e.model].filter(Boolean).join(' ')}
                  {e.serialNumber ? ` · n° ${e.serialNumber}` : ''}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      {galleries(v.photos).map((g) => (
        <section key={g.phase} className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">{GALLERY_TITLES[g.phase]}</h2>
          <ul className="grid grid-cols-2 gap-2">
            {g.photos.map((p) => (
              <li key={p.id} className="flex flex-col gap-1">
                <a href={url(p.original_path)} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- lien signé temporaire */}
                  <img
                    src={url(p.thumbnail_path ?? p.original_path)}
                    alt={p.label || 'Photo du chantier'}
                    loading="lazy"
                    className="aspect-[4/3] w-full rounded-lg object-cover"
                  />
                </a>
                <span className="text-base text-text-muted">{p.label}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Documents</h2>
        {url(v.signature?.pdf_path) ? (
          <a href={url(v.signature?.pdf_path)} className="text-lg font-bold">
            PV de réception signé (PDF)
          </a>
        ) : null}
        {url(v.report?.pdf_path) ? (
          <a href={url(v.report?.pdf_path)} className="text-lg font-bold">
            Rapport de fin de chantier (PDF)
          </a>
        ) : null}
        {!v.signature && !v.report?.pdf_path ? (
          <p className="text-text-muted">Les documents apparaîtront ici.</p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">PV de réception</h2>
        {v.signature ? (
          <>
            <p className="text-lg">
              Signé le {formatParis(v.signature.signed_at)} par {v.signature.signer_name},{' '}
              {v.signature.has_reserves ? 'avec réserves.' : 'sans réserve.'}
            </p>
            {offerReview(v.signature, v.company.google_review_url) ? (
              <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
                <p className="text-lg">Satisfait des travaux ? Votre avis aide l’entreprise.</p>
                <a
                  href={v.company.google_review_url!}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-14 items-center justify-center rounded-xl border-2 border-brand text-lg font-bold text-brand no-underline"
                >
                  Laisser un avis Google
                </a>
              </div>
            ) : null}
          </>
        ) : (
          <ClientSignForm
            token={token}
            defaultName={v.jobsite.client_name ?? ''}
            requireSms={v.link.require_sms}
            works={v.jobsite.operations}
          />
        )}
      </section>

      <footer className="pt-6 text-base text-text-muted">
        Lien personnel, valable jusqu’au {formatParis(v.link.expires_at, false)}. Ne le partagez
        pas.
      </footer>
    </>
  );
}

export default function ClientPage(props: PageProps<'/c/[token]'>) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6">
      <Suspense fallback={<p className="text-text-muted">Chargement…</p>}>
        <Portal params={props.params} />
      </Suspense>
    </main>
  );
}
