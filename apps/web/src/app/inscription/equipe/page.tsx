import { TeamInviteForm } from '@/components/SignupForms';

export const metadata = { title: 'Votre équipe · Preuvio' };

export default function TeamPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-12">
      <h1 className="text-[32px] font-bold text-brand">Invitez vos poseurs</h1>
      <p className="text-text-muted">
        Ils reçoivent un SMS : un toucher sur le lien, l’appli s’installe et ils sont connectés.
      </p>
      <TeamInviteForm />
    </main>
  );
}
