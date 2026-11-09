import {
  formatParis,
  parseContent,
  permissions,
  photoNumbers,
  REPORT_SECTIONS,
  REPORT_TITLES,
  SECTION_TITLES,
} from '@preuvio/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ReportEditor } from '@/components/ReportForms';
import { currentUser } from '@/lib/dal';
import { loadReport, loadReportSources } from '@/lib/reports';

function refsLabel(photos: number[], notes: number[]): string {
  const parts = [
    photos.length ? `photo${photos.length > 1 ? 's' : ''} ${photos.join(', ')}` : '',
    notes.length ? `note${notes.length > 1 ? 's' : ''} ${notes.join(', ')}` : '',
  ].filter(Boolean);
  return parts.length ? `Justifié par : ${parts.join(' · ')}` : 'Ajout du bureau';
}

async function Report({ params }: { params: PageProps<'/rapports/[id]'>['params'] }) {
  const { id } = await params;
  const [user, loaded] = await Promise.all([currentUser(), loadReport(id)]);
  if (!loaded) notFound();
  const { report, versions } = loaded;
  const content = parseContent(report.content, report.kind);
  const { photos, notes } = await loadReportSources(content.photo_ids, content.note_ids);
  // Mêmes numéros que dans le PDF : ordre de prise de vue, ordre de dictée.
  const photoOrder = [...photos]
    .sort((a, b) => a.device_taken_at.localeCompare(b.device_taken_at))
    .map((p) => p.id);
  const noteOrder = [...notes]
    .filter((n) => (n.transcript_clean ?? n.transcript ?? '').trim())
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((n) => n.id);
  const refs = Object.fromEntries(
    REPORT_SECTIONS.map((key) => [
      key,
      content.sections[key].map((s) =>
        refsLabel(photoNumbers(s.photo_ids, photoOrder), photoNumbers(s.note_ids, noteOrder)),
      ),
    ]),
  );
  const latest = versions[0]?.version ?? report.version;
  const canEdit = permissions(user.role).decide;

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link href={`/chantiers/${report.jobsite_id}`}>← Chantier {report.jobsites.reference}</Link>
        <h1 className="text-[32px] font-bold">{REPORT_TITLES[report.kind]}</h1>
        <p className="text-text-muted">
          Version {report.version} · {formatParis(report.created_at)}
          {report.period ? ` · journée du ${formatParis(`${report.period}T12:00:00Z`, false)}` : ''}
          {content.written_by === 'bureau' ? ' · modifiée par le bureau' : ''}
        </p>
        {report.version < latest ? (
          <p role="status" className="font-bold text-warn">
            Une version plus récente existe (version {latest}).
          </p>
        ) : null}
        {content.dropped > 0 ? (
          <p className="text-text-muted">
            {content.dropped} phrase(s) de l’IA écartée(s) faute de photo ou de note qui la
            justifie.
          </p>
        ) : null}
      </div>

      <section className="flex flex-wrap items-center gap-3">
        {canEdit ? (
          <a
            href={`/rapports/${report.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 items-center rounded-xl bg-action px-4 text-lg font-bold text-on-action no-underline"
          >
            {report.pdf_path ? 'Ouvrir le PDF' : 'Produire le PDF'}
          </a>
        ) : null}
        <span className="text-base text-text-muted">
          {report.pdf_path
            ? `PDF définitif, émis le ${formatParis(report.pdf_created_at ?? report.created_at)}.`
            : 'Le PDF d’une version est définitif : relisez avant de le produire.'}
          {report.pdf_path && canEdit && report.version === latest
            ? ' Une correction crée une nouvelle version, avec son propre PDF.'
            : ''}
        </span>
      </section>

      {canEdit && report.version === latest ? (
        <ReportEditor reportId={report.id} content={content} refs={refs} />
      ) : (
        <section className="flex flex-col gap-4">
          {REPORT_SECTIONS.map((key) => (
            <div key={key} className="flex flex-col gap-2">
              <h2 className="text-2xl font-bold">{SECTION_TITLES[key]}</h2>
              {content.sections[key].length === 0 ? (
                <p className="text-text-muted">Rien à signaler.</p>
              ) : null}
              {content.sections[key].map((s, i) => (
                <p key={i}>
                  {s.text} <span className="text-base text-text-muted">({refs[key]?.[i]})</span>
                </p>
              ))}
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold">Versions</h2>
        <ul className="flex flex-col gap-1">
          {versions.map((v) => (
            <li key={v.id}>
              {v.id === report.id ? (
                <strong>Version {v.version}</strong>
              ) : (
                <Link href={`/rapports/${v.id}`}>Version {v.version}</Link>
              )}{' '}
              · {formatParis(v.created_at)} {v.pdf_path ? '· PDF émis' : ''}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export default function ReportPage(props: PageProps<'/rapports/[id]'>) {
  return (
    <Suspense fallback={<p className="text-text-muted">Chargement…</p>}>
      <Report params={props.params} />
    </Suspense>
  );
}
