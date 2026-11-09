// Configuration publique (variables NEXT_PUBLIC_*). Aucune clé secrète côté web : la clé
// « publishable » est faite pour le navigateur, la RLS protège les données.
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Configuration Supabase manquante : NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (apps/web/.env).',
    );
  }
  return { url, key };
}
