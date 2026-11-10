import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers';

test.describe('pages publiques', () => {
  for (const path of [
    '/connexion',
    '/inscription',
    '/confidentialite',
    '/cgu',
    '/sous-traitants',
    '/mentions-legales',
  ]) {
    test(`${path} s'ouvre sans compte et reste accessible`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      await expectAccessible(page);
    });
  }

  test('une page du tableau de bord renvoie vers la connexion', async ({ page }) => {
    await page.goto('/exports');
    await expect(page).toHaveURL(/\/connexion$/);
  });
});
