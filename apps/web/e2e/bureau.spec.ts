import { expect, test } from '@playwright/test';
import { expectAccessible, MARTIN_JOBSITE, OWNER_STATE } from './helpers';

test.describe('bureau et dirigeant', () => {
  test.use({ storageState: OWNER_STATE });
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('tableau de bord : compteurs, liste à traiter, essai', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible();
    await expect(page.getByText('Chantiers en cours')).toBeVisible();
    await expect(page.getByText(/Essai gratuit|Offre/)).toBeVisible();
    await expectAccessible(page);
  });

  test('fiche chantier et lien client : le client signe son PV', async ({ page, browser }) => {
    await page.goto(`/chantiers/${MARTIN_JOBSITE}`);
    await expectAccessible(page);
    await page.locator('input[name=sendSms]').uncheck();
    await page.getByRole('button', { name: 'Créer un lien client (90 jours)' }).click();
    const link = page.locator('text=/\\/c\\/[A-Za-z0-9_-]{20,}/').first();
    await expect(link).toBeVisible();
    const url = new URL((await link.textContent())!.trim());

    // Le client, sur son téléphone.
    const phone = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    });
    const client = await phone.newPage();
    await client.goto(url.pathname);
    await expect(client.getByRole('heading', { name: 'Vos travaux' })).toBeVisible();
    await expectAccessible(client);
    await client.locator('input[name=reception]').first().check();
    await client.locator('input[name=signer]').fill('M. Martin');
    const pad = client.locator('canvas');
    await pad.scrollIntoViewIfNeeded();
    const box = (await pad.boundingBox())!;
    await client.mouse.move(box.x + 20, box.y + box.height / 2);
    await client.mouse.down();
    for (let i = 1; i <= 8; i += 1) {
      await client.mouse.move(
        box.x + (box.width * i) / 9,
        box.y + box.height * (i % 2 ? 0.3 : 0.7),
        { steps: 4 },
      );
    }
    await client.mouse.up();
    await client.getByRole('button', { name: 'Signer le PV' }).click();
    await expect(client.getByText(/Signé le .* par M\. Martin/)).toBeVisible({ timeout: 30_000 });
    await phone.close();

    await page.reload();
    await expect(page.getByText(/PV signé le .* par M\. Martin/)).toBeVisible();
  });

  test('export délégataire : vérifications puis ZIP prêt', async ({ page }) => {
    await page.goto('/exports');
    await expectAccessible(page);
    await page.locator('input[name=jobsiteId]').first().check();
    await page.getByRole('button', { name: 'Exporter les chantiers cochés' }).click();
    await expect(page.getByText('Prêt').first()).toBeVisible({ timeout: 60_000 });
  });

  test('abonnement et pages réservées', async ({ page }) => {
    await page.goto('/abonnement');
    await expect(page.getByRole('heading', { name: 'Choisir une offre' })).toBeVisible();
    await expectAccessible(page);
    await page.goto('/reglages');
    await expect(page.getByText('Conservation des chantiers et des photos')).toBeVisible();
  });
});
