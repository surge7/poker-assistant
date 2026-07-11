import { test, expect } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Тест single-HTML сборки (build:single-html).
 *
 * Без фикса: equity-worker.js не встраивается в HTML, воркер не грузится,
 * requestEquity() Promise зависает навсегда, кнопка "Рассчитать" остаётся
 * в is-calculating, а на экране — initial empty-state от первого updateResults().
 *
 * С фиксом: error-событие воркера ловится, fallback на sync calcEquitySync,
 * результат отрисовывается как обычно.
 */
test.describe('Single-HTML build — portable worker fallback', () => {
  let server: ChildProcess;
  const singleHtmlPath = path.join(__dirname, '..', 'poker-assistant.html');
  const port = 4174;

  test.beforeAll(async () => {
    // Поднимаем static server на нужном порту под single HTML.
    server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
      cwd: path.dirname(singleHtmlPath),
      stdio: 'pipe',
    });
    // Подождём, пока сервер реально начнёт отвечать.
    for (let i = 0; i < 50; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/poker-assistant.html`);
        if (res.ok) return;
      } catch { /* not yet */ }
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error('server did not start in time');
  });

  test.afterAll(async () => {
    server?.kill('SIGTERM');
  });

  test('calculation completes when worker URL is broken (single-HTML)', async ({ page }) => {
    const workerRequests: string[] = [];
    page.on('requestfailed', req => {
      if (req.url().includes('equity-worker')) workerRequests.push(req.url());
    });

    await page.goto(`http://127.0.0.1:${port}/poker-assistant.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Подтверждаем репро: воркер действительно не грузится (URL битый).
    // (Если URL окажется валидным — тест всё равно проверит основной сценарий.)

    // Программно выставляем карты (имитация пользовательского ввода).
    await page.evaluate(() => {
      function setSlot(prefix: string, idx: number, card: string) {
        const r = document.getElementById(`${prefix}-rank-${idx}`) as HTMLSelectElement;
        const s = document.getElementById(`${prefix}-suit-${idx}`) as HTMLSelectElement;
        r.value = card[0];
        s.value = card[1];
        r.dispatchEvent(new Event('change', { bubbles: true }));
        s.dispatchEvent(new Event('change', { bubbles: true }));
      }
      setSlot('hole', 0, 'Kc');
      setSlot('hole', 1, 'Kd');
      setSlot('board', 0, '3d');
      setSlot('board', 1, 'Kh');
      setSlot('board', 2, '4h');
    });

    await page.locator('#btn-calculate').click();

    // Главное: в течение 5 секунд должен появиться результат (НЕ empty state).
    // До фикса кнопка оставалась в is-calculating и empty state висел вечно.
    await expect(page.locator('#results-content .results-hero')).toBeVisible({ timeout: 5000 });

    // Кнопка вышла из loading-состояния.
    await expect(page.locator('#btn-calculate')).not.toHaveClass(/is-calculating/);
    await expect(page.locator('#btn-calculate')).toBeEnabled();

    // Конкретный сценарий: топ-сет королей на 3♦K♥4♥ → сильный совет (RAISE / CALL).
    const actionText = await page.locator('.results-action').textContent();
    expect(actionText?.trim().toUpperCase()).toMatch(/RAISE|CALL/);
  });
});
