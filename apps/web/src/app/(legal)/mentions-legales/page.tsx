import { EDITOR, UPDATED } from '@/lib/legal/info';

export const metadata = { title: 'Mentions légales · Preuvio' };

export default function LegalNotice() {
  return (
    <>
      <h1 className="text-[32px] font-bold">Mentions légales</h1>
      <p className="text-text-muted">Mise à jour : {UPDATED}</p>
      <h2 className="text-2xl font-bold">Éditeur</h2>
      <p>
        {EDITOR.name}, {EDITOR.legalForm} au capital de {EDITOR.capital}, SIREN {EDITOR.siren}, dont
        le siège est situé {EDITOR.address}. Directeur de la publication : {EDITOR.director}.
        Contact : {EDITOR.contact}.
      </p>
      <h2 className="text-2xl font-bold">Hébergement</h2>
      <p>
        Tableau de bord : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis,
        exécuté dans la région de Paris (France). Données et fichiers : Supabase Inc., hébergés dans
        la région de Paris (France).
      </p>
      <h2 className="text-2xl font-bold">Propriété intellectuelle</h2>
      <p>
        L’application, ses textes, ses visuels et son code sont la propriété de {EDITOR.name}. Les
        photos, documents et données saisis par les entreprises clientes restent leur propriété.
      </p>
      <h2 className="text-2xl font-bold">Données personnelles</h2>
      <p>
        Voir la <a href="/confidentialite">politique de confidentialité</a> et la{' '}
        <a href="/sous-traitants">liste des sous-traitants</a>.
      </p>
    </>
  );
}
