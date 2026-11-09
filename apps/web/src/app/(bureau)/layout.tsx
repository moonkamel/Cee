import Link from 'next/link';
import { Suspense } from 'react';
import { signOut } from '@/app/actions';
import { currentUser } from '@/lib/dal';

const ROLE: Record<string, string> = {
  owner: 'Dirigeant',
  admin: 'Admin',
  office: 'Bureau',
  lead: 'Chef d’équipe',
  installer: 'Poseur',
};

async function Who() {
  const user = await currentUser();
  return (
    <span className="text-base text-text-muted">
      {user.fullName} · {ROLE[user.role] ?? user.role}
      {user.companyName ? ` · ${user.companyName}` : ''}
    </span>
  );
}

export default function OfficeLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <nav className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="text-xl font-bold text-brand no-underline">
            Preuvio
          </Link>
          <Link href="/">Tableau de bord</Link>
          <Link href="/chantiers">Chantiers</Link>
          <Link href="/equipe">Équipe</Link>
          <span className="flex-1" />
          <Suspense fallback={null}>
            <Who />
          </Suspense>
          <form action={signOut}>
            <button className="min-h-10 rounded-lg border border-border px-3">
              Se déconnecter
            </button>
          </form>
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
