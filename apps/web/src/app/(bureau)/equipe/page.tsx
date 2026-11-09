import { formatFrenchPhone, permissions } from '@preuvio/shared';
import { Suspense } from 'react';
import { setActive, setRole } from '@/app/actions';
import { InviteForm } from '@/components/InviteForm';
import { currentUser } from '@/lib/dal';
import { loadTeam } from '@/lib/queries';

export const metadata = { title: 'Équipe · Preuvio' };

const ROLES = [
  ['installer', 'Poseur'],
  ['lead', 'Chef d’équipe'],
  ['office', 'Bureau'],
  ['admin', 'Admin'],
  ['owner', 'Dirigeant'],
] as const;

async function Team() {
  const [user, team] = await Promise.all([currentUser(), loadTeam()]);
  const can = permissions(user.role).manageTeam;
  return (
    <>
      {can ? (
        <InviteForm />
      ) : (
        <p className="text-text-muted">
          La gestion de l’équipe est réservée à l’admin et au dirigeant.
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {team.map((m) => (
          <li
            key={m.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4"
          >
            <span className="flex flex-1 flex-col">
              <span
                className={`text-lg font-bold ${m.active ? '' : 'text-text-muted line-through'}`}
              >
                {m.full_name}
              </span>
              <span className="text-base text-text-muted">
                {m.phone ? formatFrenchPhone(m.phone) : ''}
              </span>
            </span>
            {can && m.id !== user.id && m.role !== 'owner' ? (
              <>
                <form action={setRole} className="flex items-center gap-2">
                  <input type="hidden" name="profileId" value={m.id} />
                  <select
                    name="role"
                    defaultValue={m.role}
                    aria-label={`Rôle de ${m.full_name}`}
                    className="min-h-10 rounded-lg border-2 border-brand bg-surface px-2"
                  >
                    {ROLES.filter(([r]) => r !== 'owner').map(([r, label]) => (
                      <option key={r} value={r}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button className="min-h-10 rounded-lg border border-border px-3">Changer</button>
                </form>
                <form action={setActive}>
                  <input type="hidden" name="profileId" value={m.id} />
                  <input type="hidden" name="active" value={m.active ? 'false' : 'true'} />
                  <button
                    className={`min-h-10 rounded-lg border-2 px-3 font-bold ${m.active ? 'border-ko text-ko' : 'border-ok text-ok'}`}
                  >
                    {m.active ? 'Désactiver' : 'Réactiver'}
                  </button>
                </form>
              </>
            ) : (
              <span className="text-base text-text-muted">
                {ROLES.find(([r]) => r === m.role)?.[1]}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="text-base text-text-muted">
        Un salarié désactivé ne peut plus se connecter ; ses photos et notes restent dans
        l’entreprise.
      </p>
    </>
  );
}

export default function TeamPage() {
  return (
    <>
      <h1 className="text-[32px] font-bold">Équipe</h1>
      <Suspense fallback={<p className="text-text-muted">Chargement…</p>}>
        <Team />
      </Suspense>
    </>
  );
}
