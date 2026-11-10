import { createClient } from '@supabase/supabase-js';
import { test as setup } from '@playwright/test';
import { MARTIN_JOBSITE, OWNER_STATE, signIn } from './helpers';

// Une seule connexion pour toute la suite : un code SMS au plus toutes les 30 s par numéro.
setup('connexion de la dirigeante de démo', async ({ page }) => {
  await signIn(page);
  await page.context().storageState({ path: OWNER_STATE });
});

// Chantier des Martin commencé : il devient exportable (clé de service locale seulement).
setup('chantier des Martin commencé', async () => {
  const key = process.env.E2E_SERVICE_ROLE_KEY;
  setup.skip(!key, 'E2E_SERVICE_ROLE_KEY absente');
  const db = createClient(process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321', key!, {
    auth: { persistSession: false },
  });
  const { error } = await db
    .from('jobsites')
    .update({ status: 'in_progress' })
    .eq('id', MARTIN_JOBSITE);
  if (error) throw error;
});
