import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnalysisResponse } from '../../api/types';
import fixture from '../../../../contracts/fixtures/analyze-partial.json';
import { ExportActions } from './ExportActions';
import { canExport, createCsv, type ExportRun } from './exportData';

const partial: AnalysisResponse = { ...fixture, status: 'partial' };
const demo: ExportRun = { mode: 'demo', apiVersion: 'synthetic-mock', scenarios: [{ id: 'A', analysis: partial }] };

function csvRows(csv: string) {
  const lines = csv.slice(1).trimEnd().split('\r\n');
  const headers = lines.shift()!.split(',');
  return lines.map(line => {
    const fields = line.match(/"(?:[^"]|"")*"|[^,]+|(?<=,)(?=,|$)/g) ?? [];
    return Object.fromEntries(headers.map((key, index) => [key, fields[index]?.replace(/^"|"$/g, '').replaceAll('""', '"')]));
  });
}

describe('P2-02 exports', () => {
  it('exports each API sample, both scenario summaries and the B minus A duration differences', () => {
    const second: AnalysisResponse = {
      ...partial,
      status: 'complete',
      samples: [
        { ...partial.samples[0], timeUtc: '2026-11-14T01:00:00+01:00', sun: { ...partial.samples[0].sun, visible: false } },
        { ...partial.samples[0], timeUtc: '2026-11-14T01:00:00Z' },
      ],
      summary: { ...partial.summary, bothVisibleHours: 0 },
    };
    const rows = csvRows(createCsv({
      ...demo, scenarios: [...demo.scenarios, { id: 'B', analysis: second }],
      differences: { sunVisibleHours: -2, earthVisibleHours: 0, bothVisibleHours: null },
    }));
    expect(rows.filter(row => row.record_type === 'sample')).toMatchObject([
      { scenario: 'A', time_utc: '2026-11-14T00:00:00.000Z', latitude_deg: '-89.5', sun_visible: 'unknown', earth_visible: 'unknown' },
      { scenario: 'B', time_utc: '2026-11-14T00:00:00.000Z', sun_visible: 'false' },
      { scenario: 'B', time_utc: '2026-11-14T01:00:00.000Z', sun_visible: 'unknown' },
    ]);
    expect(rows.filter(row => row.record_type === 'summary')).toMatchObject([
      { scenario: 'A', status: 'partial', terrain_applied: 'false', dem_resolution_m: 'unknown', step_minutes: '60',
        visibility_method: partial.quality.visibilityMethod, api_version: 'synthetic-mock' },
      { scenario: 'B', status: 'complete', both_visible_hours: '0' },
    ]);
    expect(rows.at(-1)).toMatchObject({ record_type: 'difference', sun_visible_hours: '-2', earth_visible_hours: '0', both_visible_hours: 'unknown' });
  });

  it('keeps UTF-8 warnings and escapes quotes, commas, newlines and formula-like text', () => {
    const unsafe = { ...partial, quality: { ...partial.quality, warnings: ['Сонце, «рельєф» "DEM"\r\nUpdate', ' =SUM(1,2)', '\tCommand', '@test', '+test', '-test'] } };
    const csv = createCsv({ ...demo, scenarios: [{ id: 'A', analysis: unsafe }] });
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"Сонце, «рельєф» ""DEM""\r\nUpdate"');
    for (const text of [' =SUM(1,2)', '\tCommand', '@test', '+test', '-test']) expect(csv).toContain('"\'' + text + '"');
    expect(csv).toContain(',-89.5,25,');
  });

  it('records a failed sibling, and applies the same synthetic-data guard to CSV and print', () => {
    const run: ExportRun = { ...demo, scenarios: [...demo.scenarios, { id: 'B', analysis: null, error: 'Analysis timed out.' }] };
    expect(csvRows(createCsv(run)).find(row => row.scenario === 'B')).toMatchObject({ status: 'unavailable', message: 'Analysis timed out.' });
    const report = renderToStaticMarkup(<ExportActions run={run} />);
    expect(report).toContain('Demo · Synthetic data');
    expect(report).toContain('Analysis timed out.');
    expect(report).toContain(partial.quality.warnings[0]);
    expect(canExport({ ...run, mode: 'real' })).toBe(false);
    expect(() => createCsv({ ...run, mode: 'real' })).toThrow();
    expect(renderToStaticMarkup(<ExportActions run={{ ...run, mode: 'real' }} />)).not.toContain('Download CSV');
    const real = { ...partial, quality: { ...partial.quality, ephemerisSource: 'JPL Horizons', warnings: [] } };
    expect(canExport({ mode: 'real', scenarios: [{ id: 'A', analysis: real }] })).toBe(true);
  });
});
