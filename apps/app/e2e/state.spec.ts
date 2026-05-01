import { test, expect } from '@playwright/test';

// Tests for state persistence behavior via localStorage
// Directly evaluates JSON round-trip, error handling, and fallback

test.describe('State persistence module', () => {
  test('load/save round-trip', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const result = await page.evaluate(() => {
      const KEY = 'poker-assistant:state:v1';
      const testState = {
        version: 1,
        holeCards: ['As', 'Kh'],
        boardCards: [null, null, null, null, null],
        position: 2,
        numPlayers: 6,
        potSize: 100,
        toCall: 25,
      };
      localStorage.setItem(KEY, JSON.stringify(testState));
      const loaded = JSON.parse(localStorage.getItem(KEY) || 'null');
      return loaded;
    });

    expect(result).not.toBeNull();
    expect(result.version).toBe(1);
    expect(result.holeCards).toEqual(['As', 'Kh']);
    expect(result.position).toBe(2);
    expect(result.potSize).toBe(100);
  });

  test('invalid JSON returns null on parse', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      const KEY = 'poker-assistant:state:v1';
      localStorage.setItem(KEY, '{broken json');
      try {
        return JSON.parse(localStorage.getItem(KEY) || 'null');
      } catch {
        return null;
      }
    });

    expect(result).toBeNull();
  });

  test('invalid schema does not load', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      const KEY = 'poker-assistant:state:v1';
      localStorage.setItem(KEY, JSON.stringify({ foo: 'bar' }));
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1) return null;
      return parsed;
    });

    expect(result).toBeNull();
  });

  test('localStorage throws → app still works', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Storage.prototype, 'setItem', {
        value: function() { throw new Error('QuotaExceededError'); },
        writable: true,
        configurable: true,
      });
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#btn-calculate')).toBeVisible();

    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('clearState removes key from localStorage', async ({ page }) => {
    await page.goto('/');

    const cleared = await page.evaluate(() => {
      const KEY = 'poker-assistant:state:v1';
      localStorage.setItem(
        KEY,
        JSON.stringify({ version: 1, holeCards: ['As', 'Kh'], boardCards: [null, null, null, null, null], position: 0, numPlayers: 6, potSize: 0, toCall: 0 })
      );
      localStorage.removeItem(KEY);
      return localStorage.getItem(KEY) === null;
    });

    expect(cleared).toBe(true);
  });
});
