import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createApiClient } from '../api/client';
import type { AnalysisResponse, AnalysisSample } from '../api/types';
import { createMockTransport, mockConfig } from '../mocks/transport';
import fixture from '../../../contracts/fixtures/analyze-partial.json';
import { MissionApp } from './MissionApp';
import { AnalysisPanel } from '../features/analysis/AnalysisPanel';
import { compare, difference } from '../features/compare/compare';
import { defaultDraft, utc, validate } from '../features/scenario-form/scenario';
import { advance, axisFor, interpolateAngle, sampleAt, within } from '../features/timeline/time';

const location = { latitude: -89.5, longitude: 25 };
const period = fixture.period;
const start = Date.parse(period.startUtc);
const end = Date.parse(period.endUtc);
const partial: AnalysisResponse = { ...fixture, status: 'partial' };
const complete: AnalysisResponse = {
  ...partial, status: 'complete',
  summary: { sunVisibleHours: 0, earthVisibleHours: 24, bothVisibleHours: 0, sunVisiblePercent: 0, earthVisiblePercent: 100 },
};

describe('scenario form', () => {
  it('accepts decimal commas and serializes the configured UTC period', () => {
    const request = validate({ ...defaultDraft, latitude: '-89,5', longitude: '+25' }, mockConfig);
    expect(request).toMatchObject({ location, period: { startUtc: '2028-04-15T16:00:00.000Z' } });
    expect(utc('2028-02-30T01:00')).toBeNull();
  });

  it('rejects invalid coordinates, reversed periods, fractional steps, and excess samples', () => {
    const valid = { ...defaultDraft, latitude: '-89.5', longitude: '25' };
    for (const override of [{ latitude: '80' }, { longitude: '1e2' }, { end: valid.start }, { step: '12.5' }, { end: '2029-01-01T00:00', step: '10' }]) {
      expect(typeof validate({ ...valid, ...override }, mockConfig)).toBe('string');
    }
  });

  it('exposes manual input and explicit demo labeling while services are loading', () => {
    const page = renderToStaticMarkup(<MissionApp mode="demo" client={createApiClient({ transport: createMockTransport() })} />);
    expect(page).toContain('Demo · Synthetic');
    expect(page).toContain('Latitude');
    expect(page).toContain('Loading');
    expect(page).toContain('Waiting for analysis');
  });
});

describe('analysis and playback', () => {
  it('uses a half-open UTC window across midnight and clamps playback at the end', () => {
    expect(within(period, start)).toBe(true);
    expect(within(period, end)).toBe(false);
    expect(advance(end - 1000, 1000, 16, end)).toBe(end);
    const later = { ...complete, period: { ...period, startUtc: '2026-11-15T00:00:00Z', endUtc: '2026-11-16T00:00:00Z' } };
    expect(axisFor([complete, later], false)?.end).toBe(end + (end - start));
    expect(axisFor([complete, later], true)).toEqual({ start: 0, end: end - start });
  });

  it('interpolates the shortest angle and leaves visibility unknown between samples and in gaps', () => {
    expect(interpolateAngle(359, 1, 0.5)).toBe(0);
    const first = partial.samples[0];
    const samples: AnalysisSample[] = [
      { ...first, sun: { ...first.sun, azimuthDeg: 359, visible: true } },
      { ...first, timeUtc: new Date(start + 3_600_000).toISOString(), sun: { ...first.sun, azimuthDeg: 1, visible: false } },
    ];
    expect(sampleAt(samples, start + 1_800_000, 60)).toMatchObject({ estimated: true, sun: { azimuthDeg: 0, visible: null } });
    expect(sampleAt(samples, start + 1_800_000, 30)).toBeNull();
    expect(sampleAt([], end, 60)).toBeNull();
  });

  it('keeps partial data unknown and preserves legitimate zero and full visibility durations', () => {
    const html = renderToStaticMarkup(<AnalysisPanel result={partial} time={start} advanced />);
    expect(html).toContain('Terrain not considered');
    expect(html).toContain('Unknown');
    expect(html).toContain('SYNTHETIC');
    expect(renderToStaticMarkup(<AnalysisPanel result={complete} time={start} advanced={false} />)).toContain('24.00 h (100.0%)');
  });
});

describe('comparison', () => {
  it('calculates signed B − A and keeps partial or failed scenarios unknown', () => {
    expect(difference(complete, complete)).toEqual({ sunVisibleHours: 0, earthVisibleHours: 0, bothVisibleHours: 0 });
    expect(difference(complete, { ...complete, summary: { ...complete.summary, earthVisibleHours: 12 } }).earthVisibleHours).toBe(-12);
    expect(difference(complete, partial).earthVisibleHours).toBeNull();
    expect(difference(null, complete).sunVisibleHours).toBeNull();
  });

  it('falls back only when compare is unavailable and retains a successful sibling', async () => {
    const transport = createMockTransport();
    const requestUrls: string[] = [];
    const client = createApiClient({ transport: async (url, init) => {
      requestUrls.push(String(url));
      if (String(url).endsWith('/compare')) return new Response(null, { status: 501 });
      if (JSON.parse(String(init?.body)).location.longitude === 80) return new Response(null, { status: 503 });
      return transport(url, init);
    } });
    const outcome = await compare(client, [
      { id: 'A', location, period }, { id: 'B', location: { ...location, longitude: 80 }, period },
    ], new AbortController().signal);
    expect(requestUrls).toEqual(['/api/v1/compare', '/api/v1/analyze', '/api/v1/analyze']);
    expect(outcome.results[0]?.status).toBe('partial');
    expect(outcome.results[1]).toBeNull();
    expect(outcome.errors[1]).toBe('HTTP 503');
  });
});
