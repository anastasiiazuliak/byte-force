import { describe, expect, it } from 'vitest';
import type { AnalysisResponse } from '../../api/types';
import fixture from '../../../../contracts/fixtures/analyze-partial.json';
import { clearanceStats, comparisonTime, differentPeriods } from './comparisonInsights';

const a = fixture as AnalysisResponse;
const b = { ...a, period: { ...a.period, startUtc: '2026-12-14T00:00:00Z', endUtc: '2026-12-15T00:00:00Z' } };
describe('cached comparison insights', () => {
  it('maps equal elapsed time across different dates without touching caches', () => {
    expect(differentPeriods(a, b)).toBe(true);
    expect(comparisonTime('2026-11-14T01:00:00Z', a, b)).toBe('2026-12-14T01:00:00.000Z');
    expect(comparisonTime('2026-11-14T01:00:00Z', a, a)).toBe('2026-11-14T01:00:00Z');
    expect(b.samples[0].timeUtc).toBe(a.samples[0].timeUtc);
  });
  it('keeps missing clearance unknown rather than zero', () => {
    expect(clearanceStats(a, 'sun')).toEqual({ sampleCount: 1, finiteCount: 0, mean: null, min: null });
  });
  it('uses finite unique in-period exact samples, not visibility or duration', () => {
    const sample = (timeUtc: string, clearanceDeg: number | null) => ({ ...a.samples[0], timeUtc, sun: { ...a.samples[0].sun, clearanceDeg } });
    const analysis = { ...a, samples: [sample(a.period.startUtc, -2), sample(a.period.startUtc, 99), sample('2026-11-14T01:00:00Z', 4), sample('2026-11-14T02:00:00Z', NaN), sample('2026-11-14T03:00:00Z', null), sample('2026-11-16T00:00:00Z', 99)] };
    expect(clearanceStats(analysis, 'sun')).toEqual({ sampleCount: 4, finiteCount: 2, mean: 1, min: -2 });
  });
});
