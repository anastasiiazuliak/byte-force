import { describe, expect, it } from 'vitest';
import type { AnalysisResponse, BodyPosition } from '../../api/types';
import fixture from '../../../../contracts/fixtures/analyze-partial.json';
import { regionalPotentialWindows, regionalWindow } from './regionalWindow';

const time = (hour: number) => `2028-04-15T${String(hour).padStart(2, '0')}:00:00Z`;
const position = (clearanceDeg: number | null): BodyPosition => ({ azimuthDeg: 5, elevationDeg: 2, horizonDeg: 1, clearanceDeg, visible: null });
function analysis(sun: (number | null)[], earth = sun): AnalysisResponse {
  return { ...structuredClone(fixture) as AnalysisResponse,
    period: { startUtc: time(0), endUtc: time(3), stepMinutes: 60 },
    horizon: { points: [0, 5, 10].map(azimuthDeg => ({ azimuthDeg, elevationDeg: 1 })) },
    samples: sun.map((v, i) => ({ timeUtc: time(i), sun: position(v), earth: position(earth[i]) })) };
}
const track = (a: AnalysisResponse) => regionalPotentialWindows(a).tracks.sun;

describe('regional potential sample bins', () => {
  it('uses positive/negative endpoint signs without changing canonical visibility', () => {
    const a = analysis([1, 1, -1, -1]);
    const before = structuredClone(a);
    expect(track(a)).toMatchObject({ aboveHours: 1, belowHours: 1, unknownHours: 1 });
    expect(track(a).bins.map(b => b.state)).toEqual(['above-regional-skyline', 'unknown', 'at-or-below-regional-skyline']);
    expect(track(a).bins[1]).toMatchObject({ startUtc: '2028-04-15T01:00:00.000Z', endUtc: '2028-04-15T02:00:00.000Z', reason: 'transition-uncertain', sampleCount: 2 });
    expect(a).toEqual(before);
  });
  it('does not invent a crossing time or zero unknown hours from two samples', () => {
    const a = analysis([1, -1]); a.period.endUtc = time(1);
    expect(track(a)).toMatchObject({ aboveHours: null, abovePercent: null, unknownHours: 1 });
    expect(regionalWindow(a, 'sun')).toBeNull();
    a.samples[1].sun.clearanceDeg = 1;
    expect(track(a)).toMatchObject({ aboveHours: 1, unknownHours: 0 });
    expect(regionalWindow(a, 'sun')).toBeNull();
  });
  it('keeps leading/trailing extent and oversized steps unknown', () => {
    const a = analysis([1, 1, 1, 1]); a.samples = [a.samples[1], a.samples[2]];
    expect(track(a)).toMatchObject({ aboveHours: 1, unknownHours: 2 });
    a.samples = [analysis([1, 1, 1, 1]).samples[0], analysis([1, 1, 1, 1]).samples[3]];
    expect(track(a)).toMatchObject({ abovePercent: null, unknownHours: 3 });
  });
  it.each([null, 0, NaN, Infinity])('treats unusable clearance %s as unknown', value => {
    expect(track(analysis([value, value, value, value]))).toMatchObject({ aboveHours: null, abovePercent: null, unknownHours: 3 });
  });
  it('combines per-body bins conservatively, including changing blockers', () => {
    const a = analysis([1, 1, -1, -1], [-1, -1, 1, 1]);
    expect(regionalPotentialWindows(a).tracks.both).toMatchObject({ aboveHours: 0, belowHours: 2, unknownHours: 1 });
    a.samples[0].earth.clearanceDeg = null;
    expect(regionalPotentialWindows(a).tracks.both.bins[0].state).toBe('unknown');
    expect(regionalPotentialWindows(analysis([1, 1, 1, 1])).tracks.both.aboveHours).toBe(3);
  });
  it('requires finite horizon provenance, not terrainApplied', () => {
    const a = analysis([1, 1, 1, 1]); a.quality.terrainApplied = false;
    expect(track(a).aboveHours).toBe(3);
    a.samples.forEach(s => { s.sun.horizonDeg = null; });
    expect(track(a).unknownHours).toBe(3);
  });
  it('rejects missing, sparse, and nonfinite horizon profiles', () => {
    for (const horizon of [null, { points: [{ azimuthDeg: 0, elevationDeg: 1 }] }, { points: [0, 5, 10].map(azimuthDeg => ({ azimuthDeg, elevationDeg: NaN })) }]) {
      const a = analysis([1, 1, 1, 1]); a.horizon = horizon;
      expect(track(a)).toMatchObject({ unknownHours: 3, abovePercent: null });
    }
    const a = analysis([1, 1, 1, 1]); a.horizon!.points = [0, 90, 180].map(azimuthDeg => ({ azimuthDeg, elevationDeg: 1 }));
    expect(track(a).unknownHours).toBe(3);
  });
  it('does not interpolate across a missing bearing in a regular one-degree profile', () => {
    const a = analysis([1, 1, 1, 1]);
    a.horizon!.points = Array.from({ length: 360 }, (_, azimuthDeg) => ({ azimuthDeg, elevationDeg: 1 }))
      .filter(p => p.azimuthDeg !== 5);
    expect(track(a)).toMatchObject({ unknownHours: 3, abovePercent: null });
    a.samples.forEach(s => { s.sun.azimuthDeg = 4.5; });
    expect(track(a).unknownHours).toBe(3);
    a.samples.forEach(s => { s.sun.azimuthDeg = 3.5; });
    expect(track(a)).toMatchObject({ aboveHours: 3, unknownHours: 0 });
    a.samples.forEach(s => { s.sun.azimuthDeg = 4; });
    expect(track(a)).toMatchObject({ aboveHours: 3, unknownHours: 0 });
    a.horizon!.points.find(p => p.azimuthDeg === 4)!.elevationDeg = NaN;
    expect(track(a).unknownHours).toBe(3);
  });
  it.each(['duplicate', 'malformed', 'reversed', 'empty'])('does not bridge %s times', kind => {
    const a = analysis([1, 1, 1, 1]);
    if (kind === 'duplicate') a.samples[1].timeUtc = a.samples[0].timeUtc;
    if (kind === 'malformed') a.samples[1].timeUtc = 'not a time';
    if (kind === 'reversed') a.samples.reverse();
    if (kind === 'empty') a.samples = [];
    expect(track(a)).toMatchObject({ unknownHours: 3, abovePercent: null });
  });
  it('does not claim a duration for an invalid period or step', () => {
    const a = analysis([1, 1, 1, 1]); a.period.startUtc = 'invalid';
    expect(track(a)).toMatchObject({ unknownHours: null, abovePercent: null });
    a.period.startUtc = time(0); a.period.stepMinutes = NaN;
    expect(track(a)).toMatchObject({ unknownHours: 3, abovePercent: null });
  });
  it('preserves legacy export shape only for complete multi-bin estimates', () => {
    expect(regionalWindow(analysis([1, 1, 1, 1]), 'sun')).toEqual({ hours: 3, percent: 100, method: 'sample-bin-estimate' });
    expect(regionalWindow(analysis([-1, -1, -1, -1]), 'sun')?.percent).toBe(0);
    expect(regionalWindow(analysis([1, 1, null, 1]), 'sun')).toBeNull();
  });
});
