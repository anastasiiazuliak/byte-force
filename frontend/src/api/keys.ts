import type { AnalysisRequest } from './types';

/** Stable across object property ordering; includes all analysis input dimensions. */
export function analysisCacheKey(request: AnalysisRequest): string {
  return JSON.stringify([
    'analyze', request.location.latitude, request.location.longitude,
    request.period.startUtc, request.period.endUtc, request.period.stepMinutes,
    request.options?.terrainModel ?? 'lola', request.options?.includeHorizon ?? true,
  ]);
}
