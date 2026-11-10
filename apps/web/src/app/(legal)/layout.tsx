import Link from 'next/link';

// Pages légales (section 16) : publiques, lisibles sans compte.
export default function LegalLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <nav className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
          <Link href="/" className="text-xl font-bold text-brand no-underline">
            Preuvio
          </Link>
          <Link href="/mentions-legales">Mentions légales</Link>
          <Link href="/confidentialite">Confidentialité</Link>
          <Link href="/cgu">Conditions générales</Link>
          <Link href="/sous-traitants">Sous-traitants</Link>
        </nav>
      </header>
      <main className="legal mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
