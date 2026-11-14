import type { AnalysisRequest, ConfigResponse } from '../api/types';
export interface ScenarioDraft { latitude: string; longitude: string; start: string; end: string; step: string }
export const initialDraft: ScenarioDraft = { latitude: '', longitude: '', start: '2028-04-15T00:00', end: '2028-04-16T00:00', step: '60' };
export function parseScenario(draft: ScenarioDraft, config?: ConfigResponse | null): AnalysisRequest {
  const number = (value: string) => value.trim() === '' ? NaN : Number(value.replace(',', '.'));
  const latitude = number(draft.latitude), longitude = number(draft.longitude), stepMinutes = number(draft.step);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > -80 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('Enter latitude −90 to −80 and longitude −180 to 180 (degrees).');
  const utc = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Enter valid UTC dates and times.');
    const date = new Date(value + ':00Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 16) !== value || date.getUTCFullYear() < 1962) throw new Error('Enter valid UTC dates and times.');
    return date.toISOString();
  };
  const startUtc = utc(draft.start), endUtc = utc(draft.end);
  const limits = config?.analysis ?? { minStepMinutes: 10, maxStepMinutes: 1440, maxSamples: 2000 };
  if (endUtc <= startUtc) throw new Error('End UTC must be after start UTC.');
  if (!Number.isInteger(stepMinutes) || stepMinutes < limits.minStepMinutes || stepMinutes > limits.maxStepMinutes) throw new Error('Step is outside the allowed minute range.');
  if (Math.ceil((Date.parse(endUtc) - Date.parse(startUtc)) / (stepMinutes * 60000)) + 1 > limits.maxSamples) throw new Error(`Period exceeds ${limits.maxSamples} samples.`);
  return { location: { latitude, longitude }, period: { startUtc, endUtc, stepMinutes }, options: { terrainModel: 'lola', includeHorizon: true } };
}
/** Abort plus identity prevents stale publication even when a transport ignores AbortSignal. */
export class LatestRequest {
  private controller?: AbortController;
  begin() { this.cancel(); const controller = new AbortController(); this.controller = controller; return { signal: controller.signal, current: () => this.controller === controller && !controller.signal.aborted }; }
  cancel() { this.controller?.abort(); this.controller = undefined; }
}
