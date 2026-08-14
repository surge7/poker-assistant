import { describe, it, expect } from 'vitest';
import { explanationRow, formatExplanationPct, formatGapPp, actionClass, equityClass } from './format';

describe('formatExplanationPct', () => {
  it('integer without fraction', () => expect(formatExplanationPct(50)).toBe('50'));
  it('one decimal', () => expect(formatExplanationPct(52.25)).toBe('52.3'));
  it('rounds to one decimal', () => expect(formatExplanationPct(33.34)).toBe('33.3'));
});

describe('formatGapPp', () => {
  it('positive with plus', () => expect(formatGapPp(12.5)).toBe('+12.5'));
  it('negative with unicode minus', () => expect(formatGapPp(-5)).toBe('−5'));
});

describe('actionClass', () => {
  it('fold → --fold', () => expect(actionClass('fold')).toContain('--fold'));
  it('check → --neutral', () => expect(actionClass('check')).toContain('--neutral'));
  it('other → --positive', () => expect(actionClass('raise')).toContain('--positive'));
});

describe('equityClass', () => {
  it('low equity → --low', () => expect(equityClass(20)).toContain('--low'));
  it('normal equity → no --low', () => expect(equityClass(50)).not.toContain('--low'));
});

describe('explanationRow', () => {
  it('renders note when provided', () => {
    expect(explanationRow('L', 'V', 'N')).toContain('explanation-note');
  });
  it('omits note when absent', () => {
    expect(explanationRow('L', 'V')).not.toContain('explanation-note');
  });
});
