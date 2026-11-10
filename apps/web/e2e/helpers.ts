import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

// Données de démo de supabase/seed.sql (Thermi Rénov) : code SMS fixe 123456 en local.
export const OWNER_PHONE = '06 39 98 00 01';
export const MARTIN_JOBSITE = '50000000-0000-4000-8000-000000000001';
export const OWNER_STATE = 'e2e/.auth/owner.json';

export async function signIn(page: Page, phone = OWNER_PHONE) {
  await page.goto('/connexion');
  await page.locator('input[name=phone]').fill(phone);
  await page.getByRole('button', { name: 'Recevoir le code' }).click();
  await page.locator('input[name=code]').fill('123456');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('/');
}

/** Audit d'accessibilité (WCAG 2.1 AA) : aucune violation grave ou critique. */
export async function expectAccessible(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('.maplibregl-canvas')
    .analyze();
  const serious = result.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(
    serious.map(
      (v) => `${v.id} : ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
    ),
  ).toEqual([]);
}
