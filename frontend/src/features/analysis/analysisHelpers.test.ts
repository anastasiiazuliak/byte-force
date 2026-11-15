import { describe, expect, it } from 'vitest';
import fixture from '../../../../contracts/fixtures/analyze-partial.json';
import type { AnalysisResponse } from '../../api/types';
import { compassPoint, metric, plotGeometry, utcLabel, visibility } from './analysisHelpers';
const analysis = fixture as AnalysisResponse;
describe('analysis presentation helpers', () => {
  it('keeps null unknown and preserves authoritative false', () => {
    expect(visibility(null)).toBe('Unknown'); expect(visibility(false)).toBe('Blocked');
    expect(metric(null)).toBe('Unknown'); expect(metric(NaN)).toBe('Unknown'); expect(metric(-2, '°')).toBe('-2.00°');
  });
  it('uses north zero and east ninety', () => {
    expect(compassPoint(0)).toEqual({ x: 70, y: 28 });
    expect(compassPoint(90).x).toBe(112); expect(compassPoint(90).y).toBeCloseTo(70);
  });
  it('adapts altitude range and includes zero', () => {
    const plot = plotGeometry(analysis, 'altitude');
    expect(plot.min).toBeLessThan(0); expect(plot.max).toBeGreaterThan(8); expect(plot.max).toBeLessThan(10);
    expect(plot.path('sun')).not.toContain('NaN');
    expect(plotGeometry(analysis, 'clearance').path('sun')).toBe('');
  });
  it('breaks paths at nulls and missing time steps', () => {
    const base = { ...analysis.samples[0], sun: { ...analysis.samples[0].sun, clearanceDeg: 2 } };
    const samples = [base, { ...base, timeUtc: '2026-11-14T01:00:00Z', sun: { ...base.sun, clearanceDeg: null } }, { ...base, timeUtc: '2026-11-14T02:00:00Z' }, { ...base, timeUtc: '2026-11-14T05:00:00Z' }];
    const path = plotGeometry({ ...analysis, samples }, 'clearance').path('sun');
    expect(path.match(/M/g)).toHaveLength(3); expect(path).not.toContain('L');
  });
  it('formats UTC explicitly', () => expect(utcLabel(analysis.samples[0].timeUtc)).toBe('2026-11-14 00:00:00 UTC'));
});
