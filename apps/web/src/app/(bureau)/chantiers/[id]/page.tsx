import { permissions, proofTone } from '@preuvio/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { markItemDone } from '@/app/actions';
import { AnnotatedPhoto } from '@/components/AnnotatedPhoto';
import { StatePill } from '@/components/StatePill';
import { jobsiteView, latestPhoto } from '@/lib/dashboard';
import { currentUser } from '@/lib/dal';
import { loadJobsite, signedPhotoUrls } from '@/lib/queries';
import { localToday } from '@/lib/today';

const TONE_WORD = {
  ok: 'Validée',
  warn: 'À reprendre',
  ko: 'Manquante',
  pending: 'En analyse',
  waived: 'Dispensée',
} as const;
const TONE_CLASS = {
  ok: 'text-ok',
  warn: 'text-warn',
  ko: 'text-ko',
  pending: 'text-text-muted',
  waived: 'text-text-muted',
} as const;

async function Jobsite({ params }: { params: PageProps<'/chantiers/[id]'>['params'] }) {
  const { id } = await params;
  const [user, { jobsite, notes, items }] = await Promise.all([currentUser(), loadJobsite(id)]);
  if (!jobsite) notFound();
  const view = jobsiteView(jobsite, localToday());
  const slots = jobsite.proof_slots.filter((s) => s.applicable);
  const photos = slots.map((s) => ({ slot: s, photo: latestPhoto(s) }));
  const urls = await signedPhotoUrls(
    photos.flatMap((p) => (p.photo ? [p.photo.original_path] : [])),
  );
  const can = permissions(user.role);
  return (
    <>
      <div className="flex flex-col gap-2">
        <Link href="/chantiers">← Chantiers</Link>
        <h1 className="text-[32px] font-bold">{view.label}</h1>
        <p className="text-text-muted">
          {[view.client, view.installers.join(', ')].filter(Boolean).join(' · ')}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <StatePill state={view.state} />
          <span className="text-lg font-bold">
            Score : {view.score.ok}/{view.score.total} · {view.score.percent} %
          </span>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Fil photo</h2>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map(({ slot, photo }) => {
            const tone = proofTone(slot.status);
            const url = photo ? urls.get(photo.original_path) : undefined;
            return (
              <li
                key={slot.id}
                className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3"
              >
                {url ? (
                  <AnnotatedPhoto
                    src={url}
                    alt={slot.instruction}
                    annotations={(photo as { annotations?: unknown }).annotations}
                  />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-border text-text-muted">
                    {photo ? 'Photo en cours d’envoi' : 'Pas encore de photo'}
                  </div>
                )}
                <span className="font-bold">{slot.instruction}</span>
                <span className={`text-base font-bold ${TONE_CLASS[tone]}`}>{TONE_WORD[tone]}</span>
                {photo?.ai_result?.decision?.message ? (
                  <span className="text-base text-text-muted">
                    IA : {photo.ai_result.decision.message}
                  </span>
                ) : null}
                {slot.status === 'to_retake' && can.decide ? (
                  <Link
                    href={`/preuves/${slot.id}`}
                    className="inline-flex min-h-12 items-center justify-center rounded-xl bg-action font-bold text-on-action no-underline"
                  >
                    Trancher
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Notes vocales</h2>
        {notes.length === 0 ? <p className="text-text-muted">Aucune note.</p> : null}
        <ul className="flex flex-col gap-3">
          {notes.map((n) => (
            <li
              key={n.id}
              className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4"
            >
              <span className="text-base text-text-muted">
                {Math.round(Number(n.duration_s))} s
              </span>
              <span>{n.transcript_clean ?? n.transcript ?? 'Transcription en attente'}</span>
              {items
                .filter((i) => i.voice_note_id === n.id)
                .map((i) => (
                  <form
                    key={i.id}
                    action={markItemDone}
                    className="flex flex-wrap items-center gap-3"
                  >
                    <input type="hidden" name="itemId" value={i.id} />
                    <span
                      className={i.kind === 'problem' ? 'font-bold text-ko' : 'text-text-muted'}
                    >
                      {i.kind === 'problem' ? 'Problème : ' : 'À commander : '}
                      {[i.quantity, i.unit, i.summary]
                        .filter((v) => v !== null && v !== '')
                        .join(' ')}
                    </span>
                    {i.status === 'open' && can.decide ? (
                      <button className="min-h-10 rounded-lg border-2 border-brand px-3 font-bold text-brand">
                        {i.kind === 'material' ? 'Commandé' : 'Traité'}
                      </button>
                    ) : (
                      <span className="text-base text-ok">{i.status === 'done' ? 'Fait' : ''}</span>
                    )}
                  </form>
                ))}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export default function JobsitePage(props: PageProps<'/chantiers/[id]'>) {
  return (
    <Suspense fallback={<p className="text-text-muted">Chargement…</p>}>
      <Jobsite params={props.params} />
    </Suspense>
  );
}
