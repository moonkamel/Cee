import { permissions, requiredDocuments } from '@preuvio/shared';
import { Suspense } from 'react';
import { DelegataireForm } from '@/components/ExportForms';
import { currentUser } from '@/lib/dal';
import { loadDelegataires } from '@/lib/exports/queries';

async function Delegataires() {
  const user = await currentUser();
  if (!permissions(user.role).export) {
    return <p className="text-text-muted">Réservé au bureau et au dirigeant.</p>;
  }
  const delegataires = await loadDelegataires();
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-[32px] font-bold">Délégataires</h1>
        <p className="text-text-muted">
          Nom des photos et pièces exigées, propres à chaque délégataire. Sans délégataire, l’export
          suit les règles par défaut.
        </p>
      </div>
      <section className="flex flex-col gap-4">
        {delegataires.map((d) =>
          d.company_id ? (
            <DelegataireForm
              key={d.id}
              delegataire={{
                id: d.id,
                name: d.name,
                naming_pattern: d.naming_pattern,
                required: requiredDocuments(d.required_documents),
              }}
            />
          ) : (
            <p key={d.id} className="rounded-xl border border-border bg-surface p-4">
              <strong>{d.name}</strong> (maintenu par Preuvio) · {d.naming_pattern}
            </p>
          ),
        )}
        <h2 className="text-2xl font-bold">Ajouter un délégataire</h2>
        <DelegataireForm />
      </section>
    </>
  );
}

export default function DelegatairesPage() {
  return (
    <Suspense fallback={<p className="text-text-muted">Chargement…</p>}>
      <Delegataires />
    </Suspense>
  );
}
