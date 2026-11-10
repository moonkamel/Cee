import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers';

// Code de confirmation lu avec la clé de service locale (jamais en production).
const admin = () =>
  createClient(
    process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321',
    process.env.E2E_SERVICE_ROLE_KEY ?? '',
    {
      auth: { persistSession: false },
    },
  );

test('une entreprise s’inscrit seule et trouve son chantier de démonstration', async ({ page }) => {
  test.skip(!process.env.E2E_SERVICE_ROLE_KEY, 'E2E_SERVICE_ROLE_KEY absente');
  const email = `e2e-${Date.now()}@preuvio.example`;
  await page.goto('/inscription');
  await page.locator('input[name=contact]').fill(email);
  await page.getByRole('button', { name: 'Recevoir le code' }).click();
  await expect(page.locator('input[name=code]')).toBeVisible();
  const { data } = await admin().auth.admin.generateLink({ type: 'magiclink', email });
  await page.locator('input[name=code]').fill(data.properties!.email_otp);
  await page.getByRole('button', { name: 'Confirmer' }).click();

  await page.waitForURL('**/inscription/entreprise');
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Pas de SIRET pour l’instant' }).click();
  await page.locator('input[name=name]').fill('Entreprise E2E');
  await page.getByPlaceholder('Organisme (Qualibat…)').fill('Qualibat');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'PAC air/eau' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.locator('input[name=fullName]').fill('Dirigeant E2E');
  await page.getByRole('button', { name: 'Créer mon entreprise' }).click();

  await page.waitForURL('**/inscription/equipe', { timeout: 60_000 });
  await page.getByRole('link', { name: 'Plus tard' }).click();
  await expect(page.getByText(/Essai gratuit : 30 jour/)).toBeVisible();
  // Chantier de démonstration : déjà rempli, toutes ses preuves validées.
  await page.goto('/chantiers');
  await expect(page.getByRole('link', { name: /Rezé .*100 %/ })).toBeVisible();
});
