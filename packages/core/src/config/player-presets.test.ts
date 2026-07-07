import { describe, it, expect } from 'vitest';
import { PLAYER_PRESETS, getPreset, type PlayerPresetKey } from './player-presets';

describe('player-presets (5 типов игроков)', () => {
  it('содержит 6 записей (unknown + 5 типов)', () => {
    expect(PLAYER_PRESETS).toHaveLength(6);
    const keys = PLAYER_PRESETS.map(p => p.key);
    expect(keys).toEqual(['unknown', 'nit', 'tag', 'lag', 'fish', 'maniac']);
  });

  it('первая запись — unknown (VPIP=0, PFR=0)', () => {
    expect(PLAYER_PRESETS[0].key).toBe('unknown');
    expect(PLAYER_PRESETS[0].vpip).toBe(0);
    expect(PLAYER_PRESETS[0].pfr).toBe(0);
  });

  it('TAG: VPIP=22, PFR=18 (эталонный агрессивно-тайтовый)', () => {
    const tag = getPreset('tag');
    expect(tag.vpip).toBe(22);
    expect(tag.pfr).toBe(18);
  });

  it('все VPIP и PFR в диапазоне 0..100, pfr <= vpip', () => {
    for (const p of PLAYER_PRESETS) {
      expect(p.vpip).toBeGreaterThanOrEqual(0);
      expect(p.vpip).toBeLessThanOrEqual(100);
      expect(p.pfr).toBeGreaterThanOrEqual(0);
      expect(p.pfr).toBeLessThanOrEqual(p.vpip); // PFR не превышает VPIP
    }
  });

  it('getPreset возвращает unknown для неизвестного ключа', () => {
    const r = getPreset('nonexistent' as PlayerPresetKey);
    expect(r.key).toBe('unknown');
  });

  it('Нит самый тайтовый (мин VPIP), Маньяк самый лузовый (макс VPIP)', () => {
    const nit = getPreset('nit');
    const maniac = getPreset('maniac');
    const nonUnknown = PLAYER_PRESETS.filter(p => p.key !== 'unknown');
    const minVpip = Math.min(...nonUnknown.map(p => p.vpip));
    const maxVpip = Math.max(...nonUnknown.map(p => p.vpip));
    expect(nit.vpip).toBe(minVpip);
    expect(maniac.vpip).toBe(maxVpip);
  });
});
