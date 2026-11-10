import Link from 'next/link';
import { SignupCodeForm } from '@/components/SignupForms';

export const metadata = { title: 'Inscription · Preuvio' };

// Inscription du dirigeant (section 15) : sans commercial, en moins de 10 minutes.
export default function SignupPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-[32px] font-bold text-brand">Créer mon entreprise</h1>
        <p className="text-text-muted">
          Essai gratuit de 30 jours ou 10 chantiers, sans carte bancaire.
        </p>
      </div>
      <SignupCodeForm />
      <Link href="/connexion">Déjà un compte ? Se connecter</Link>
    </main>
  );
}
