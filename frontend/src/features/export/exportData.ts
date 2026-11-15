import type { AnalysisResponse, ComparisonDifferences, ScenarioId } from '../../api/types';

export interface ExportScenario {
  id: ScenarioId;
  analysis: AnalysisResponse | null;
  error?: string | null;
}
export interface ExportRun {
  mode: 'real' | 'demo';
  apiVersion?: string;
  scenarios: ExportScenario[];
  differences?: ComparisonDifferences;
}

const synthetic = /\b(?:synthetic|mock|demo|fixture)\b/i;

export function canExport(run: ExportRun) {
  return run.scenarios.some(({ analysis }) => analysis !== null) &&
    (run.mode === 'demo' || !run.scenarios.some(({ analysis }) =>
      analysis && [analysis.quality.ephemerisSource, analysis.quality.terrainSource].some(source => source && synthetic.test(source)),
    ));
}

const headers = [
  'record_type', 'scenario', 'data_mode', 'api_version', 'status',
  'time_utc', 'latitude_deg', 'longitude_deg', 'site_elevation_m', 'start_utc', 'end_utc', 'step_minutes',
  'sun_azimuth_deg', 'sun_elevation_deg', 'sun_horizon_deg', 'sun_clearance_deg', 'sun_visible',
  'earth_azimuth_deg', 'earth_elevation_deg', 'earth_horizon_deg', 'earth_clearance_deg', 'earth_visible',
  'sun_visible_hours', 'earth_visible_hours', 'both_visible_hours', 'sun_visible_percent', 'earth_visible_percent',
  'ephemeris_source', 'terrain_source', 'terrain_applied', 'dem_resolution_m', 'visibility_method', 'message',
] as const;
type Cell = string | number | boolean | null | undefined;
type Row = Partial<Record<typeof headers[number], Cell>>;

function csvCell(value: Cell): string {
  if (value == null) return '';
  if (typeof value !== 'string') return String(value);
  // Prefix formula-like text only. Numeric cells can retain their negative signs.
  const safe = /^(?:[\s\u0000-\u001f]*[=+\-@＝＋－＠]|[\t\r\n])/.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}

const iso = (value: string) => new Date(value).toISOString();
const known = <T,>(value: T | null) => value ?? 'unknown';

export function createCsv(run: ExportRun): string {
  if (!canExport(run)) throw new Error('No exportable analysis data.');
  const rows: Row[] = [];
  const common = { data_mode: run.mode === 'demo' ? 'demo / synthetic' : 'real', api_version: run.apiVersion ?? 'unknown' };
  for (const { id, analysis, error } of run.scenarios) {
    if (!analysis) {
      rows.push({ ...common, record_type: 'summary', scenario: id, status: 'unavailable', message: error ?? 'Scenario result unavailable.' });
      continue;
    }
    const { location, period, quality, summary } = analysis;
    const scenario: Row = {
      ...common, scenario: id, status: analysis.status,
      latitude_deg: location.latitude, longitude_deg: location.longitude, site_elevation_m: known(location.elevationM),
      start_utc: iso(period.startUtc), end_utc: iso(period.endUtc), step_minutes: period.stepMinutes,
    };
    rows.push({
      ...scenario, record_type: 'summary',
      sun_visible_hours: known(summary.sunVisibleHours), earth_visible_hours: known(summary.earthVisibleHours),
      both_visible_hours: known(summary.bothVisibleHours), sun_visible_percent: known(summary.sunVisiblePercent),
      earth_visible_percent: known(summary.earthVisiblePercent),
      ephemeris_source: quality.ephemerisSource, terrain_source: known(quality.terrainSource),
      terrain_applied: quality.terrainApplied, dem_resolution_m: known(quality.terrainResolutionMeters),
      visibility_method: quality.visibilityMethod,
    });
    for (const warning of quality.warnings) rows.push({ ...common, record_type: 'warning', scenario: id, status: analysis.status, message: warning });
    for (const { timeUtc, sun, earth } of analysis.samples) {
      rows.push({
        ...scenario, record_type: 'sample', time_utc: iso(timeUtc),
        sun_azimuth_deg: sun.azimuthDeg, sun_elevation_deg: sun.elevationDeg, sun_horizon_deg: known(sun.horizonDeg),
        sun_clearance_deg: known(sun.clearanceDeg), sun_visible: known(sun.visible),
        earth_azimuth_deg: earth.azimuthDeg, earth_elevation_deg: earth.elevationDeg, earth_horizon_deg: known(earth.horizonDeg),
        earth_clearance_deg: known(earth.clearanceDeg), earth_visible: known(earth.visible),
      });
    }
  }
  if (run.differences) {
    const { sunVisibleHours, earthVisibleHours, bothVisibleHours } = run.differences;
    rows.push({
      ...common, record_type: 'difference', scenario: 'B minus A',
      sun_visible_hours: known(sunVisibleHours), earth_visible_hours: known(earthVisibleHours), both_visible_hours: known(bothVisibleHours),
    });
  }
  return '\uFEFF' + [headers.join(','), ...rows.map(row => headers.map(header => csvCell(row[header])).join(','))].join('\r\n') + '\r\n';
}
