import type { AnalysisResponse } from '../../api/types';

export function differentPeriods(a?: AnalysisResponse, b?: AnalysisResponse): boolean {
  return Boolean(a && b && (Date.parse(a.period.startUtc) !== Date.parse(b.period.startUtc) || Date.parse(a.period.endUtc) !== Date.parse(b.period.endUtc)));
}

/** Map the shared A selection without changing cached timestamps or interpolating samples. */
export function comparisonTime(timeUtc: string, a?: AnalysisResponse, b?: AnalysisResponse): string {
  if (!a || !b || !differentPeriods(a, b)) return timeUtc;
  const mapped = Date.parse(b.period.startUtc) + Date.parse(timeUtc) - Date.parse(a.period.startUtc);
  return Number.isFinite(mapped) ? new Date(mapped).toISOString() : timeUtc;
}

export function clearanceStats(analysis: AnalysisResponse, body: 'sun' | 'earth') {
  const start = Date.parse(analysis.period.startUtc), end = Date.parse(analysis.period.endUtc);
  const seen = new Set<number>();
  const values: number[] = [];
  let sampleCount = 0;
  for (const sample of analysis.samples) {
    const time = Date.parse(sample.timeUtc);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || !Number.isFinite(time) || time < start || time > end || seen.has(time)) continue;
    seen.add(time);
    sampleCount++;
    const value = sample[body].clearanceDeg;
    if (typeof value === 'number' && Number.isFinite(value)) values.push(value);
  }
  return { sampleCount, finiteCount: values.length,
    mean: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
    min: values.length ? values.reduce((min, value) => Math.min(min, value), Infinity) : null };
}
