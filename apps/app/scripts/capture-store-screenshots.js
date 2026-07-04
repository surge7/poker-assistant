#!/usr/bin/env node
/**
 * Делает скриншоты приложения 1080×1920 для RuStore.
 * Требует запущенный preview: npm run build && npm run preview -- --host 127.0.0.1 --port 4173
 */

import { chromium } from '@playwright/test';
import { mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'store-screenshots-input');
const BASE_URL = process.env.STORE_SCREENSHOT_URL || 'http://127.0.0.1:4173';
/** Логический размер телефона; deviceScaleFactor даёт 1080×1920 без зелёных полей по бокам */
const VIEWPORT = { width: 480, height: 853 };
const DEVICE_SCALE = 2.25; // 480×2.25=1080, 853×2.25≈1920

const STORAGE_KEY = 'poker-assistant:state:v1';

async function seedState(page, state) {
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    { key: STORAGE_KEY, value: state },
  );
}

async function openFresh(page, state) {
  await page.goto('about:blank');
  await seedState(page, state);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('#btn-calculate', { timeout: 15000 });
  await page.addStyleTag({ content: 'body { min-height: auto !important; }' });
}

async function calculateAndWait(page) {
  await page.locator('#btn-calculate').click();
  await page.waitForSelector('#results-content:not(:empty)', { timeout: 10000 });
  await page.waitForTimeout(600);
}

async function screenshot(page, name, { fullPage = false } = {}) {
  const file = path.join(OUT_DIR, name);
  await page.screenshot({ path: file, fullPage });
  console.log('Captured:', file);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE,
    locale: 'ru-RU',
    colorScheme: 'dark',
  });

  const flopAdvice = {
    version: 1,
    holeCards: ['Ah', 'Kh'],
    boardCards: ['Qd', 'Jc', 'Ts', null, null],
    position: 5,
    numPlayers: 8,
    potSize: 185,
    toCall: 42,
    handHidden: false,
  };

  const preflopStrong = {
    version: 1,
    holeCards: ['As', 'Ad'],
    boardCards: [null, null, null, null, null],
    position: 7,
    numPlayers: 6,
    potSize: 45,
    toCall: 12,
    handHidden: false,
  };

  // 1 — флоп, сильная рука, совет
  {
    const page = await context.newPage();
    await openFresh(page, flopAdvice);
    await calculateAndWait(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await screenshot(page, '01-flop-advice.png', { fullPage: true });
    await page.close();
  }

  // 2 — префлоп AA, позиция и игроки
  {
    const page = await context.newPage();
    await openFresh(page, preflopStrong);
    await calculateAndWait(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await screenshot(page, '02-preflop-aces.png', { fullPage: true });
    await page.close();
  }

  // 3 — выбор карты (попап)
  {
    const page = await context.newPage();
    await openFresh(page, {
      version: 1,
      holeCards: [null, null],
      boardCards: [null, null, null, null, null],
      position: 2,
      numPlayers: 9,
      potSize: 0,
      toCall: 0,
      handHidden: false,
    });
    await page.locator('#hole-trigger-0').click();
    await page.waitForSelector('.card-picker-popover:not([hidden])', { timeout: 5000 });
    await page.waitForTimeout(400);
    await screenshot(page, '03-card-picker.png', { fullPage: false });
    await page.close();
  }

  // 4 — светлая тема с результатами
  {
    const page = await context.newPage();
    await openFresh(page, flopAdvice);
    await page.locator('#theme-toggle').click();
    await page.waitForTimeout(300);
    await calculateAndWait(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await screenshot(page, '04-light-theme.png', { fullPage: true });
    await page.close();
  }

  await browser.close();
  console.log('\nГотово. Запустите: npm run store-screenshots');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
