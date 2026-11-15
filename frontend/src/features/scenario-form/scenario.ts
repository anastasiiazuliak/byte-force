import type { AnalysisRequest, ConfigResponse, Coordinates } from '../../api/types';

export interface Draft {
  siteId: string;
  latitude: string;
  longitude: string;
  start: string;
  end: string;
  step: string;
}
export const defaultDraft: Draft = {
  siteId: '', latitude: '', longitude: '', start: '2028-04-15T16:00', end: '2028-04-16T16:00', step: '60',
};

function decimal(text: string) {
  return /^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(text.trim()) ? Number(text.replace(',', '.')) : NaN;
}

export function utc(text: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) return null;
  const date = new Date(text + ':00Z');
  return Number.isFinite(+date) && date.toISOString().slice(0, 16) === text ? date.toISOString() : null;
}

export function coordinates(draft: Draft, region?: ConfigResponse['region']): Coordinates | null {
  const latitude = decimal(draft.latitude);
  const longitude = decimal(draft.longitude);
  const minLat = Math.max(-90, region?.latitudeMin ?? -90);
  const maxLat = Math.min(-80, region?.latitudeMax ?? -80);
  const minLon = Math.max(-180, region?.longitudeMin ?? -180);
  const maxLon = Math.min(180, region?.longitudeMax ?? 180);
  return latitude >= minLat && latitude <= maxLat && longitude >= minLon && longitude <= maxLon
    ? { latitude, longitude } : null;
}

export function validate(draft: Draft, config?: ConfigResponse): AnalysisRequest | string {
  const location = coordinates(draft, config?.region);
  if (!location) return 'Enter valid coordinates for the south polar region (80°–90° S).';
  const startUtc = utc(draft.start);
  const endUtc = utc(draft.end);
  if (!startUtc || !endUtc || endUtc <= startUtc) return 'Enter a valid UTC period with the end after the start.';
  const stepMinutes = Number(draft.step);
  if (!config) return 'Analysis limits are unavailable. Retry loading configuration.';
  const { minStepMinutes, maxStepMinutes, maxSamples } = config.analysis;
  if (!/^\d+$/.test(draft.step) || !Number.isSafeInteger(stepMinutes) || stepMinutes <= 0 ||
      stepMinutes < minStepMinutes || stepMinutes > maxStepMinutes) {
    return `Use a whole-minute step between ${minStepMinutes} and ${maxStepMinutes}.`;
  }
  if (Math.ceil((Date.parse(endUtc) - Date.parse(startUtc)) / (stepMinutes * 60_000)) + 1 > maxSamples) {
    return `Shorten the period or increase the step to stay within ${maxSamples} samples.`;
  }
  return { location, period: { startUtc, endUtc, stepMinutes }, options: { terrainModel: 'lola', includeHorizon: true } };
}
