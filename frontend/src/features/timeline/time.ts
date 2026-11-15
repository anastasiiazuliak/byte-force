import type { AnalysisResponse, AnalysisSample, BodyPosition, Interval } from '../../api/types';

export const utcLabel = (time: number) => new Date(time).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
export const within = (interval: Interval, time: number) => Date.parse(interval.startUtc) <= time && time < Date.parse(interval.endUtc);

export function interpolateAngle(a: number, b: number, ratio: number) {
  const delta = ((b - a + 540) % 360) - 180;
  return ((a + delta * ratio) % 360 + 360) % 360;
}

export function sampleAt(samples: AnalysisSample[], time: number, step: number) {
  let low = 0;
  let high = samples.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (Date.parse(samples[mid].timeUtc) < time) low = mid + 1;
    else high = mid;
  }
  const next = samples[low];
  if (next && Date.parse(next.timeUtc) === time) return { ...next, estimated: false };
  const previous = samples[low - 1];
  if (!next || !previous) return null;
  const start = Date.parse(previous.timeUtc);
  const duration = Date.parse(next.timeUtc) - start;
  if (duration <= 0 || duration > step * 60_000) return null;
  const ratio = (time - start) / duration;
  const linear = (a: number, b: number) => a + (b - a) * ratio;
  const nullable = (a: number | null, b: number | null) => a == null || b == null ? null : linear(a, b);
  function body(a: BodyPosition, b: BodyPosition): BodyPosition {
    return {
      azimuthDeg: interpolateAngle(a.azimuthDeg, b.azimuthDeg, ratio),
      elevationDeg: linear(a.elevationDeg, b.elevationDeg),
      horizonDeg: nullable(a.horizonDeg, b.horizonDeg),
      clearanceDeg: nullable(a.clearanceDeg, b.clearanceDeg),
      visible: null,
    };
  }
  return { timeUtc: new Date(time).toISOString(), sun: body(previous.sun, next.sun), earth: body(previous.earth, next.earth), estimated: true };
}

export function axisFor(results: (AnalysisResponse | null)[], relative: boolean) {
  const periods = results.flatMap(result => result ? [result.period] : []);
  if (!periods.length) return null;
  return relative
    ? { start: 0, end: Math.max(...periods.map(period => Date.parse(period.endUtc) - Date.parse(period.startUtc))) }
    : { start: Math.min(...periods.map(period => Date.parse(period.startUtc))), end: Math.max(...periods.map(period => Date.parse(period.endUtc))) };
}

export function advance(time: number, elapsed: number, speed: number, end: number) {
  return Math.min(end, time + elapsed * speed * 60);
}
