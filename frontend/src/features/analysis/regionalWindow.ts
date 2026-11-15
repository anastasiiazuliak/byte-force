import type { AnalysisResponse } from '../../api/types';

type Body = 'sun' | 'earth' | 'both';

function positiveRange(a: number, b: number): [number, number] {
  if (a <= 0 && b <= 0) return [0, 0];
  if (a >= 0 && b >= 0) return [0, 1];
  const crossing = a / (a - b);
  return a > 0 ? [0, crossing] : [crossing, 1];
}

export function regionalWindow(analysis: AnalysisResponse, body: Body) {
  const { period, samples } = analysis;
  const start = Date.parse(period.startUtc);
  const end = Date.parse(period.endUtc);
  if (!(end > start) || samples.length < 2 || Date.parse(samples[0].timeUtc) !== start ||
      Date.parse(samples[samples.length - 1].timeUtc) !== end) return null;

  let duration = 0;
  for (let i = 1; i < samples.length; i++) {
    const left = samples[i - 1], right = samples[i];
    const dt = Date.parse(right.timeUtc) - Date.parse(left.timeUtc);
    if (!(dt > 0 && dt <= period.stepMinutes * 60000)) return null;
    let from = 0, to = 1;
    for (const target of ['sun', 'earth'] as const) {
      if (body !== 'both' && body !== target) continue;
      const a = left[target].clearanceDeg, b = right[target].clearanceDeg;
      if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
      const range = positiveRange(a, b);
      from = Math.max(from, range[0]);
      to = Math.min(to, range[1]);
    }
    duration += dt * Math.max(0, to - from);
  }
  return { hours: duration / 3600000, percent: duration / (end - start) * 100 };
}
