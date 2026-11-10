import Link from 'next/link';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Connexion · Preuvio' };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-[32px] font-bold text-brand">Preuvio</h1>
        <p className="text-text-muted">Tableau de bord du bureau et du dirigeant.</p>
      </div>
      <LoginForm />
      <Link href="/inscription">Pas encore de compte ? Créer mon entreprise</Link>
      <p className="text-base text-text-muted">
        <Link href="/confidentialite">Confidentialité</Link> ·{' '}
        <Link href="/mentions-legales">Mentions légales</Link>
      </p>
    </main>
  );
}
