import { SUBPROCESSORS, UPDATED } from '@/lib/legal/info';

export const metadata = { title: 'Sous-traitants · Preuvio' };

export default function Subprocessors() {
  return (
    <>
      <h1 className="text-[32px] font-bold">Sous-traitants ultérieurs</h1>
      <p className="text-text-muted">Mise à jour : {UPDATED}</p>
      <p>
        Preuvio fait appel aux prestataires suivants pour fournir le service. Toute modification de
        cette liste est annoncée aux entreprises clientes au moins 30 jours à l’avance ; elles
        peuvent s’y opposer en résiliant leur abonnement.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-base">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 pr-3">Prestataire</th>
              <th className="py-2 pr-3">Rôle</th>
              <th className="py-2 pr-3">Localisation</th>
              <th className="py-2">Garanties</th>
            </tr>
          </thead>
          <tbody>
            {SUBPROCESSORS.map((s) => (
              <tr key={s.name} className="border-b border-border align-top">
                <td className="py-2 pr-3 font-bold">{s.name}</td>
                <td className="py-2 pr-3">{s.role}</td>
                <td className="py-2 pr-3">{s.location}</td>
                <td className="py-2">{s.safeguards}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
