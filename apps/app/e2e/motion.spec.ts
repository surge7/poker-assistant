import { test, expect } from '@playwright/test';

test.describe('Animations — reduced-motion support', () => {

  test('utility class .animate-fade-in applies animation', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const el = document.createElement('div');
      el.className = 'animate-fade-in';
      el.id = 'motion-test';
      el.textContent = 'test';
      document.body.appendChild(el);
    });
    const animName = await page.evaluate(() => {
      const el = document.getElementById('motion-test')!;
      return getComputedStyle(el).animationName;
    });
    expect(animName).toContain('fade-in');
  });

  test('reduced-motion: animations are near-zero duration', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.evaluate(() => {
      const el = document.createElement('div');
      el.className = 'animate-fade-in';
      el.id = 'motion-test-reduced';
      document.body.appendChild(el);
    });
    const duration = await page.evaluate(() => {
      const el = document.getElementById('motion-test-reduced')!;
      return getComputedStyle(el).animationDuration;
    });
    const ms = parseFloat(duration);
    expect(ms).toBeLessThan(50);
  });

  test('only transform/opacity in keyframes — no box-shadow or background', async ({ page }) => {
    await page.goto('/');
    const cssContent = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      let keyframesText = '';
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules || []);
          for (const rule of rules) {
            if (rule.constructor.name === 'CSSKeyframesRule') {
              keyframesText += rule.cssText + '\n';
            }
          }
        } catch { /* cross-origin */ }
      }
      return keyframesText;
    });
    const forbidden = ['box-shadow', 'background-color', 'width:', 'height:', 'filter:'];
    for (const prop of forbidden) {
      expect(cssContent, `Forbidden property in keyframes: ${prop}`).not.toContain(prop);
    }
  });

});
