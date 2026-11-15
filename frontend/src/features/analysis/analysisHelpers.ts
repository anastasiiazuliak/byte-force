import type { AnalysisResponse, Visibility } from '../../api/types';
export const metric = (value: number | null | undefined, unit = '') => value == null || !Number.isFinite(value) ? 'Unknown' : `${value.toFixed(2)}${unit}`;
export const visibility = (value: Visibility | undefined) => value == null ? 'Unknown' : value ? 'Visible' : 'Blocked';
export function utcLabel(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString().replace('T', ' ').replace(/\.000Z$/, ' UTC').replace(/Z$/, ' UTC') : value;
}
export function humanWarning(warning: string) {
  if (/^[A-Z][A-Z_]+$/.test(warning)) {
    if (/MISSING|UNAVAILABLE|NO_DEM|NOT_FOUND/.test(warning)) return 'Terrain data is missing or unavailable. Visibility remains unknown.';
    if (/UNVERIFIED|UNREVIEWED|DATUM|ALIGNMENT/.test(warning)) return 'Terrain reference or alignment has not been reviewed. Visibility remains unknown.';
    if (/REGIONAL|FAR_FIELD/.test(warning)) return 'Only nearby terrain was sampled. Distant terrain is unknown.';
  }
  return warning.replace(/_/g, ' ');
}
export type PlotMode = 'altitude' | 'clearance';
export function plotGeometry(analysis: AnalysisResponse, mode: PlotMode) {
  const field: 'elevationDeg' | 'clearanceDeg' = mode === 'altitude' ? 'elevationDeg' : 'clearanceDeg';
  const values = analysis.samples.flatMap(s => [s.sun[field], s.earth[field]]).filter((v): v is number => v != null && Number.isFinite(v));
  const low = Math.min(0, ...values), high = Math.max(0, ...values);
  const padding = Math.max((high - low) * .1, .5);
  const min = low - padding, max = high + padding;
  const start = Date.parse(analysis.period.startUtc), duration = Date.parse(analysis.period.endUtc) - start;
  const x = (time: string) => 30 + 300 * (Date.parse(time) - start) / (duration > 0 ? duration : 1);
  const y = (value: number) => 150 - 130 * (value - min) / (max - min);
  const path = (body: 'sun' | 'earth') => {
    let previous = -Infinity;
    return analysis.samples.map(s => {
      const time = Date.parse(s.timeUtc), value = s[body][field];
      if (!Number.isFinite(time) || value == null || !Number.isFinite(value)) { previous = -Infinity; return ''; }
      const command = time > previous && time - previous <= analysis.period.stepMinutes * 60000 ? 'L' : 'M';
      previous = time;
      return `${command}${x(s.timeUtc)},${y(value)}h0.01`;
    }).join(' ');
  };
  return { min, max, x, y, path, field };
}
export function compassPoint(azimuth: number) {
  const radians = azimuth * Math.PI / 180;
  return { x: 70 + 42 * Math.sin(radians), y: 70 - 42 * Math.cos(radians) };
}
