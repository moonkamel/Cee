import { permissions } from '@preuvio/shared';
import Link from 'next/link';
import { Suspense } from 'react';
import { ImportWizard } from '@/components/ImportWizard';
import { currentUser } from '@/lib/dal';

async function Import() {
  const user = await currentUser();
  if (!permissions(user.role).export) {
    return <p className="text-text-muted">Réservé au bureau et au dirigeant.</p>;
  }
  return (
    <>
      <div className="flex flex-col gap-2">
        <Link href="/chantiers">← Chantiers</Link>
        <h1 className="text-[32px] font-bold">Importer des chantiers</h1>
        <p className="text-text-muted">
          Un chantier par ligne. Les adresses sont retrouvées dans la Base Adresse Nationale et les
          checklists créées selon les types de travaux.{' '}
          <a href="/chantiers/import/modele.csv">Télécharger le modèle de fichier</a>
        </p>
      </div>
      <ImportWizard />
    </>
  );
}

export default function ImportPage() {
  return (
    <Suspense fallback={<p className="text-text-muted">Chargement…</p>}>
      <Import />
    </Suspense>
  );
}
