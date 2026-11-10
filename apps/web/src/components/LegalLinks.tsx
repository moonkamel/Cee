import Link from 'next/link';

/** Liens légaux en pied de page (section 16). */
export function LegalLinks() {
  return (
    <footer className="mx-auto flex w-full max-w-6xl flex-wrap gap-x-5 gap-y-1 px-4 py-4 text-base text-text-muted">
      <Link href="/mentions-legales">Mentions légales</Link>
      <Link href="/confidentialite">Confidentialité</Link>
      <Link href="/cgu">Conditions générales</Link>
      <Link href="/sous-traitants">Sous-traitants</Link>
    </footer>
  );
}
