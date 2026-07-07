import { describe, it, expect } from 'vitest';
import { VPIP_RANGE_NODES } from './vpip-ranges';

describe('vpip-ranges (узлы интерполяции VPIP → % диапазона)', () => {
  it('узлы упорядочены по возрастанию VPIP', () => {
    for (let i = 1; i < VPIP_RANGE_NODES.length; i++) {
      expect(VPIP_RANGE_NODES[i].vpip).toBeGreaterThan(VPIP_RANGE_NODES[i - 1].vpip);
    }
  });

  it('rangePct монотонно не убывает (лузовее игрок → шире диапазон)', () => {
    for (let i = 1; i < VPIP_RANGE_NODES.length; i++) {
      expect(VPIP_RANGE_NODES[i].rangePct).toBeGreaterThanOrEqual(VPIP_RANGE_NODES[i - 1].rangePct);
    }
  });

  it('первый узел — нит (низкий VPIP), последний — лузовый', () => {
    expect(VPIP_RANGE_NODES[0].vpip).toBeLessThan(20);
    expect(VPIP_RANGE_NODES[VPIP_RANGE_NODES.length - 1].vpip).toBeGreaterThan(40);
  });

  it('все VPIP и rangePct в диапазоне 0..100', () => {
    for (const n of VPIP_RANGE_NODES) {
      expect(n.vpip).toBeGreaterThanOrEqual(0);
      expect(n.vpip).toBeLessThanOrEqual(100);
      expect(n.rangePct).toBeGreaterThanOrEqual(0);
      expect(n.rangePct).toBeLessThanOrEqual(100);
    }
  });
});
