import type { AnalysisResponse, AnalysisSample } from '../../api/types';

export type RegionalBody = 'sun' | 'earth' | 'both';
export type RegionalState = 'above-regional-skyline' | 'at-or-below-regional-skyline' | 'unknown';
export type RegionalBin = {
  startUtc: string; endUtc: string; state: RegionalState;
  reason: 'sample-supported' | 'transition-uncertain' | 'missing-or-invalid' | 'gap';
  sampleCount: number;
};
export type RegionalTrack = {
  bins: RegionalBin[]; aboveHours: number | null; belowHours: number | null;
  unknownHours: number | null; abovePercent: number | null; supportedPercent: number | null;
};
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const utc = (value: string) => typeof value === 'string' && /(?:Z|[+-]00:00)$/.test(value) ? Date.parse(value) : NaN;

/** Client-only sampling assessment, not a visibility result or continuous-time bound. */
export function regionalPotentialWindows(analysis: AnalysisResponse) {
  const start = utc(analysis.period.startUtc), end = utc(analysis.period.endUtc);
  const validPeriod = finite(start) && finite(end) && end > start;
  const step = analysis.period.stepMinutes * 60000;
  const times = analysis.samples.map(s => utc(s.timeUtc));
  // Never silently reorder, drop duplicates, or bridge an unlocatable sample.
  const validSequence = times.every((t, i) => finite(t) && (i === 0 || t > times[i - 1]));
  const points = analysis.horizon?.points ?? [];
  const validPoints = points.filter(p => finite(p.azimuthDeg) && p.azimuthDeg >= 0 && p.azimuthDeg < 360 && finite(p.elevationDeg));
  const bearings = new Set(validPoints.map(p => p.azimuthDeg));
  const profileUsable = bearings.size >= 3 && bearings.size === validPoints.length;
  const ordered = points.filter(q => finite(q.azimuthDeg) && q.azimuthDeg >= 0 && q.azimuthDeg < 360)
    .sort((a, b) => a.azimuthDeg - b.azimuthDeg);
  const spacings = ordered.map((q, i) => (ordered[(i + 1) % ordered.length].azimuthDeg - q.azimuthDeg + 360) % 360)
    .filter(gap => gap > 0);
  const minimumSpacing = Math.min(...spacings);
  const spacingTolerance = minimumSpacing * 1e-8;
  const nominalSpacing = minimumSpacing <= 10 && spacings.filter(gap => Math.abs(gap - minimumSpacing) <= spacingTolerance).length >= 2
    ? minimumSpacing : null;
  function clearance(sample: AnalysisSample, body: 'sun' | 'earth'): number | null {
    const p = sample[body];
    if (!profileUsable || !finite(p.azimuthDeg) || !finite(p.elevationDeg) ||
        !finite(p.horizonDeg) || !finite(p.clearanceDeg)) return null;
    const az = ((p.azimuthDeg % 360) + 360) % 360;
    // Exact finite bearings remain usable; interpolation requires the repeated
    // minimum observed spacing so missing bearings cannot be bridged.
    const exact = ordered.find(q => q.azimuthDeg === az);
    if (exact) return finite(exact.elevationDeg) ? p.clearanceDeg : null;
    const rightIndex = ordered.findIndex(q => q.azimuthDeg > az);
    const left = ordered[rightIndex === -1 || rightIndex === 0 ? ordered.length - 1 : rightIndex - 1];
    const right = ordered[rightIndex === -1 ? 0 : rightIndex];
    if (!left || !right || !finite(left.elevationDeg) || !finite(right.elevationDeg)) return null;
    const gap = (right.azimuthDeg - left.azimuthDeg + 360) % 360;
    return nominalSpacing !== null && gap > 0 && gap <= nominalSpacing + spacingTolerance ? p.clearanceDeg : null;
  }
  function endpoint(sample: AnalysisSample, body: RegionalBody): RegionalState {
    const values = (body === 'both' ? ['sun', 'earth'] as const : [body]).map(b => clearance(sample, b));
    if (values.some(v => v === null || v === 0)) return 'unknown';
    return values.every(v => v! > 0) ? 'above-regional-skyline' : 'at-or-below-regional-skyline';
  }
  const tracks = {} as Record<RegionalBody, RegionalTrack>;
  for (const body of ['sun', 'earth', 'both'] as const) {
    const bins: RegionalBin[] = [];
    const add = (a: number, b: number, state: RegionalState, reason: RegionalBin['reason'], sampleCount: number) => {
      if (b > a) bins.push({ startUtc: new Date(a).toISOString(), endUtc: new Date(b).toISOString(), state, reason, sampleCount });
    };
    if (validPeriod) {
      if (!validSequence || !finite(step) || step <= 0) add(start, end, 'unknown', 'missing-or-invalid', 0);
      else {
        let cursor = start;
        for (let i = 1; i < times.length; i++) {
          const a = Math.max(start, times[i - 1]), b = Math.min(end, times[i]);
          if (b <= a) continue;
          if (a > cursor) add(cursor, a, 'unknown', 'gap', 0);
          const bodies = body === 'both' ? ['sun', 'earth'] as const : [body];
          const pairs = bodies.map(target => [endpoint(analysis.samples[i - 1], target), endpoint(analysis.samples[i], target)] as const);
          const gap = times[i] - times[i - 1] > step;
          const transition = pairs.some(([left, right]) => left !== 'unknown' && right !== 'unknown' && left !== right);
          const uncertain = pairs.some(([left, right]) => left === 'unknown' || right === 'unknown' || left !== right);
          const state: RegionalState = gap || uncertain ? 'unknown' : pairs.every(([left]) => left === 'above-regional-skyline') ? 'above-regional-skyline' : 'at-or-below-regional-skyline';
          add(a, b, state, gap ? 'gap' : transition ? 'transition-uncertain' : state === 'unknown' ? 'missing-or-invalid' : 'sample-supported', 2);
          cursor = b;
        }
        if (cursor < end) add(cursor, end, 'unknown', 'gap', 0);
      }
    }
    const hours = (state: RegionalState) => bins.filter(b => b.state === state).reduce((n, b) => n + (Date.parse(b.endUtc) - Date.parse(b.startUtc)) / 3600000, 0);
    const above = hours('above-regional-skyline'), below = hours('at-or-below-regional-skyline');
    const supported = above + below;
    const total = (end - start) / 3600000;
    tracks[body] = { bins, aboveHours: supported > 0 ? above : null, belowHours: supported > 0 ? below : null,
      unknownHours: validPeriod ? hours('unknown') : null,
      abovePercent: supported > 0 ? above / total * 100 : null,
      supportedPercent: supported > 0 ? supported / total * 100 : null };
  }
  return { startUtc: analysis.period.startUtc, endUtc: analysis.period.endUtc,
    sampleCount: analysis.samples.length, maxStepMinutes: finite(step) && step > 0 ? step / 60000 : null,
    temporalUncertainty: 'Whole sample bin; no scientific error bound or continuous-availability guarantee.', tracks };
}

/** Legacy export compatibility: only complete, multi-bin sample estimates qualify. */
export function regionalWindow(analysis: AnalysisResponse, body: RegionalBody) {
  const result = regionalPotentialWindows(analysis);
  const track = result.tracks[body];
  if (result.sampleCount < 3 || track.unknownHours !== 0 || track.aboveHours === null || track.abovePercent === null) return null;
  return { hours: track.aboveHours, percent: track.abovePercent, method: 'sample-bin-estimate' as const };
}
