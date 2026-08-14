import { describe, it, expect } from 'vitest';
import { EquityClient } from './equity-client';

const URL_STR = new URL('file:///equity-worker');
const AA = { holeCards: ['As' as const, 'Ah' as const], board: [] as never[], numOpponents: 1, iterations: 1000 };

/** Воркер-заглушка: postMessage молчит, никогда не отвечает. */
class SilentWorker {
  addEventListener() {}
  removeEventListener() {}
  postMessage() {}
  terminate() {}
}

/** Воркер с ручным ответом: слушатели складываются в список. */
class ManualWorker {
  // Пары (тип события, колбэк): reply() дёргает только 'message'-слушателей,
  // иначе ответ воркера ошибочно запускает error-обработчик клиента (disable).
  handlers: [string, (e: { data: unknown }) => void][] = [];
  sent: { id: number }[] = [];
  addEventListener(t: string, cb: (e: { data: unknown }) => void) { this.handlers.push([t, cb]); }
  removeEventListener(_t: string, cb: (e: { data: unknown }) => void) {
    this.handlers = this.handlers.filter(([, h]) => h !== cb);
  }
  postMessage(msg: { id: number }) { this.sent.push(msg); }
  reply(id: number, percent = 50) {
    for (const [, h] of this.handlers.filter(([t]) => t === 'message')) h({ data: { id, percent, low: 40, high: 60 } });
  }
  terminate() {}
}

describe('EquityClient', () => {
  it('falls back to sync when worker never responds (watchdog)', async () => {
    const client = new EquityClient(URL_STR, {
      workerFactory: () => new SilentWorker() as unknown as Worker,
      timeoutMs: 20,
    });
    const r = await client.request({ ...AA });
    // AA против 1 оппонента ≈ 85% эквити; sync-fallback считает честно.
    expect(r.percent).toBeGreaterThan(50);
    expect(r.isStale).toBe(false);
  }, 10_000);

  it('falls back to sync when worker factory throws', async () => {
    const client = new EquityClient(URL_STR, {
      workerFactory: () => { throw new Error('no workers here'); },
    });
    const r = await client.request({ ...AA });
    expect(r.percent).toBeGreaterThan(50);
  }, 10_000);

  it('marks late answer stale when a newer request exists', async () => {
    const w = new ManualWorker();
    const client = new EquityClient(URL_STR, {
      workerFactory: () => w as unknown as Worker,
      timeoutMs: 60_000,
    });
    const p1 = client.request({ ...AA, iterations: 10 });
    const p2 = client.request({ ...AA, iterations: 10 });
    w.reply(2);
    w.reply(1);
    const [r2, r1] = await Promise.all([p2, p1]);
    expect(r2.isStale).toBe(false);
    expect(r1.isStale).toBe(true);
    expect(r1.percent).toBe(50);
  });

  it('watchdog terminates the worker after timeout', async () => {
    const w = new ManualWorker();
    let terminated = false;
    w.terminate = () => { terminated = true; };
    const client = new EquityClient(URL_STR, {
      workerFactory: () => w as unknown as Worker,
      timeoutMs: 20,
    });
    await client.request({ ...AA, iterations: 100 });
    expect(terminated).toBe(true);
  }, 10_000);
});
