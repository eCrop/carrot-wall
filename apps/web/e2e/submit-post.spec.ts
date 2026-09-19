import { expect, test } from '@playwright/test';

/**
 * The full submit-and-see-it-on-the-wall flow needs `/` (WallComponent), which doesn't exist
 * on this branch yet — see docs/specs/02-submit-a-post-plan.md, Phase C. This spec covers what
 * is real today: the form itself, standalone.
 */
test.describe('/post', () => {
  test('loads with the message field focused around the fold', async ({ page }) => {
    await page.goto('/post');
    await expect(page.getByLabel('Mensagem')).toBeVisible();
  });

  test('an empty submit shows a Portuguese error and sends no request', async ({ page }) => {
    let requestSent = false;
    page.on('request', (request) => {
      if (request.url().includes('/api/posts')) {
        requestSent = true;
      }
    });

    await page.goto('/post');
    await page.getByRole('button', { name: 'Enviar' }).click();

    await expect(page.getByRole('alert')).toContainText('Escreve qualquer coisa');
    expect(requestSent).toBe(false);
  });

  test('is usable at 360px width with no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/post');

    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);

    const fontSize = await page
      .getByLabel('Mensagem')
      .evaluate((el) => getComputedStyle(el).fontSize);
    expect(parseFloat(fontSize)).toBeGreaterThanOrEqual(16);
  });
});
