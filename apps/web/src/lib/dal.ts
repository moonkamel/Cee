import 'server-only';
import type { Role } from '@preuvio/shared';
import { redirect } from 'next/navigation';
import { supabaseServer } from './supabase/server';

// Couche d'accès aux données (DAL) : l'utilisateur courant, lu une fois par requête.

export type CurrentUser = { id: string; fullName: string; role: Role; companyName: string | null };

export async function currentUser(): Promise<CurrentUser> {
  const supabase = await supabaseServer();
  const { data: claims } = await supabase.auth.getClaims();
  const id = claims?.claims?.sub;
  if (!id) redirect('/connexion');
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, active, companies ( name )')
    .eq('id', id)
    .maybeSingle<{
      id: string;
      full_name: string;
      role: Role;
      active: boolean;
      companies: { name: string } | null;
    }>();
  // Compte confirmé sans entreprise : l'inscription continue.
  if (!profile) redirect('/inscription/entreprise');
  if (!profile.active) redirect('/connexion?inactif=1');
  return {
    id,
    fullName: profile.full_name,
    role: profile.role,
    companyName: profile.companies?.name ?? null,
  };
}
