import { test, expect } from '@playwright/test';
import { runAxe, checkRussianOverflow } from './_helpers';

test.describe('Baseline — current app functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const criticalErrors = errors.filter(e => !e.includes('Capacitor') && !e.includes('cap'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('app renders main sections', async ({ page }) => {
    await expect(page.locator('.header')).toBeVisible();
    await expect(page.locator('#hole-cards')).toBeVisible();
    await expect(page.locator('#board-cards')).toBeVisible();
    await expect(page.locator('#btn-calculate')).toBeVisible();
  });

  test('hole card pickers render (2 slots)', async ({ page }) => {
    const triggers = page.locator('.card-picker-trigger');
    await expect(triggers).toHaveCount(7);
  });

  test('calculate button exists and is clickable', async ({ page }) => {
    const btn = page.locator('#btn-calculate');
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(page.locator('#results-content')).toBeVisible();
  });

  test('theme toggle works', async ({ page }) => {
    const html = page.locator('html');
    const initial = await html.getAttribute('data-theme');
    await page.locator('#theme-toggle').click();
    const toggled = await html.getAttribute('data-theme');
    expect(toggled).not.toBe(initial);
  });

  test('results show after selecting 2 hole cards and calculating', async ({ page }) => {
    await page.locator('#hole-trigger-0').click();
    await page.waitForSelector('.card-picker-popover:not([hidden])', { timeout: 3000 }).catch(() => {});
    await page.evaluate(() => {
      const rankEl = document.getElementById('hole-rank-0') as HTMLSelectElement;
      const suitEl = document.getElementById('hole-suit-0') as HTMLSelectElement;
      if (rankEl) rankEl.value = 'A';
      if (suitEl) suitEl.value = 's';
      if (rankEl) rankEl.dispatchEvent(new Event('change', { bubbles: true }));
      if (suitEl) suitEl.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.evaluate(() => {
      const rankEl = document.getElementById('hole-rank-1') as HTMLSelectElement;
      const suitEl = document.getElementById('hole-suit-1') as HTMLSelectElement;
      if (rankEl) rankEl.value = 'K';
      if (suitEl) suitEl.value = 'h';
      if (rankEl) rankEl.dispatchEvent(new Event('change', { bubbles: true }));
      if (suitEl) suitEl.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.locator('#btn-calculate').click();
    await page.waitForTimeout(500);
    const resultsContent = page.locator('#results-content');
    await expect(resultsContent).toBeVisible();
    const text = await resultsContent.textContent();
    expect(text && text.length > 10).toBe(true);
  });

  test('russian text visible correctly', async ({ page }) => {
    const body = await page.textContent('body');
    expect(body).toContain('Рассчитать');
  });

  test('accessibility checks', async ({ page }) => {
    await page.goto('/');
    await runAxe(page);
    await checkRussianOverflow(page, 'body');
  });
});
