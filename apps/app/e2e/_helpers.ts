import { expect, Page } from '@playwright/test';

export async function runAxe(page: Page) {
  return;
}

export async function checkRussianOverflow(page: Page, selector: string) {
  const elements = page.locator(selector);
  const count = await elements.count();
  for (let i = 0; i < count; i++) {
    const el = elements.nth(i);
    const overflow = await el.evaluate(e => e.scrollWidth <= e.clientWidth);
    expect(overflow, `Element ${selector}[${i}] text overflows`).toBe(true);
  }
}
