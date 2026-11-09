// Configuration publique, lue au build (variables EXPO_PUBLIC_*).
// Aucune clé secrète dans l'appli : tout appel externe passe par une Edge Function.

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Configuration Supabase manquante : renseignez EXPO_PUBLIC_SUPABASE_URL et ' +
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY dans apps/mobile/.env.local (voir .env.example).',
  );
}

// Page client du mode client (section 12) : le tableau de bord web en production par défaut.
const webUrl = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://preuvio-web.vercel.app').replace(
  /\/$/,
  '',
);

export const config = { supabaseUrl, supabasePublishableKey, webUrl };
