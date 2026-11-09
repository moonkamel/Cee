import { canDecide } from '@preuvio/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { AnnotatedPhoto } from '@/components/AnnotatedPhoto';
import { DecisionForm } from '@/components/DecisionForm';
import { latestPhoto, type SlotRow } from '@/lib/dashboard';
import { currentUser } from '@/lib/dal';
import { loadSlot, signedPhotoUrls } from '@/lib/queries';

type SlotDetail = SlotRow & {
  jobsite_id: string;
  jobsites: {
    address: string;
    jobsite_assignees: { profile_id: string; profiles: { full_name: string } | null }[];
  } | null;
};

async function Decision({ params }: { params: PageProps<'/preuves/[id]'>['params'] }) {
  const { id } = await params;
  const [user, raw] = await Promise.all([currentUser(), loadSlot(id)]);
  if (!raw) notFound();
  const slot = raw as unknown as SlotDetail;
  const photo = latestPhoto(slot) as
    (ReturnType<typeof latestPhoto> & { annotations?: unknown }) | undefined;
  const url = photo
    ? (await signedPhotoUrls([photo.original_path])).get(photo.original_path)
    : undefined;
  const aiMessage = photo?.ai_result?.decision?.message ?? null;
  const recipients = (slot.jobsites?.jobsite_assignees ?? []).map((a) => ({
    id: a.profile_id,
    name: a.profiles?.full_name ?? 'Poseur',
  }));
  // Le poseur auteur de la photo d'abord : c'est lui qui est sur place.
  recipients.sort((a, b) => Number(b.id === photo?.author_id) - Number(a.id === photo?.author_id));
  return (
    <>
      <div className="flex flex-col gap-2">
        <Link href={`/chantiers/${slot.jobsite_id}`}>← {slot.jobsites?.address ?? 'Chantier'}</Link>
        <h1 className="text-[32px] font-bold">{slot.instruction}</h1>
        {aiMessage ? <p className="text-lg font-bold text-warn">IA : {aiMessage}</p> : null}
        {photo?.ai_kept_at ? (
          <p className="text-text-muted">Gardée par le poseur malgré l’alerte.</p>
        ) : null}
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {url ? (
          <AnnotatedPhoto src={url} alt={slot.instruction} annotations={photo?.annotations} />
        ) : (
          <p className="text-text-muted">Photo indisponible.</p>
        )}
        {slot.status === 'to_retake' && canDecide(user.role) ? (
          <DecisionForm
            slotId={slot.id}
            jobsiteId={slot.jobsite_id}
            recipients={recipients}
            aiMessage={aiMessage}
          />
        ) : (
          <p className="text-text-muted">
            {canDecide(user.role)
              ? 'Déjà tranchée.'
              : 'Trancher est réservé au chef, au bureau et au dirigeant.'}
          </p>
        )}
      </div>
    </>
  );
}

export default function DecisionPage(props: PageProps<'/preuves/[id]'>) {
  return (
    <Suspense fallback={<p className="text-text-muted">Chargement…</p>}>
      <Decision params={props.params} />
    </Suspense>
  );
}
