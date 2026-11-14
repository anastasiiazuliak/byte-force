import type { ApiError, LunarApiClient, HealthResponse, ConfigResponse, LandingSitesResponse, MapMetadataResponse, AnalysisRequest, AnalysisResponse, CompareRequest, CompareResponse, EphemerisRequest, EphemerisResponse } from './types';

export type Transport = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export class ApiClientError extends Error {
  /** Structured server error when the frozen error envelope is recognized. */
  readonly apiError?: ApiError;
  constructor(message: string, public readonly kind: 'http' | 'network' | 'decode', public readonly status?: number, public readonly body?: unknown, options?: ErrorOptions) {
    super(message, options); this.name = 'ApiClientError';
        if (typeof body === 'object' && body !== null && 'error' in body) {
          const error = body.error;
          if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error &&
              typeof error.message === 'string' && ['VALIDATION_ERROR', 'LOCATION_OUT_OF_BOUNDS', 'TERRAIN_DATA_UNAVAILABLE', 'EPHEMERIS_UNAVAILABLE', 'ANALYSIS_TIMEOUT', 'INTERNAL_ERROR'].includes(String(error.code))) {
            this.apiError = body as ApiError;
          }
        }
  }
}
export function createApiClient({ baseUrl = '/api/v1', transport = globalThis.fetch.bind(globalThis) }: { baseUrl?: string; transport?: Transport } = {}) {
  async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    signal?.throwIfAborted();
    let response: Response;
    try {
      response = await transport(`${baseUrl.replace(/\/$/, '')}/${path}`, {
        method: body === undefined ? 'GET' : 'POST', signal,
        headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (cause) {
      if (signal?.aborted || (cause instanceof Error && cause.name === 'AbortError')) throw cause;
      throw new ApiClientError('Network request failed', 'network', undefined, undefined, { cause });
    }
    let text: string;
        try { text = await response.text(); }
        catch (cause) {
          if (signal?.aborted || (cause instanceof Error && cause.name === 'AbortError')) throw cause;
          throw new ApiClientError('Failed to read response body', 'network', response.status, undefined, { cause });
        }
    let data: unknown;
    try { data = text ? JSON.parse(text) : null; }
    catch (cause) {
      if (!response.ok) throw new ApiClientError(`HTTP ${response.status}`, 'http', response.status, text);
      throw new ApiClientError('Invalid JSON response', 'decode', response.status, text, { cause });
    }
    if (!response.ok) throw new ApiClientError(`HTTP ${response.status}`, 'http', response.status, data);
    return data as T;
  }
  const client = {
    health: (signal?: AbortSignal) => request<HealthResponse>('health', undefined, signal),
    config: (signal?: AbortSignal) => request<ConfigResponse>('config', undefined, signal),
    landingSites: (signal?: AbortSignal) => request<LandingSitesResponse>('landing-sites', undefined, signal),
    mapMetadata: (signal?: AbortSignal) => request<MapMetadataResponse>('map/metadata', undefined, signal),
    analyze: (body: AnalysisRequest, signal?: AbortSignal) => request<AnalysisResponse>('analyze', body, signal),
    compare: (body: CompareRequest, signal?: AbortSignal) => request<CompareResponse>('compare', body, signal),
    ephemeris: (body: EphemerisRequest, signal?: AbortSignal) => request<EphemerisResponse>('ephemeris', body, signal),
  } satisfies LunarApiClient;
  return { ...client, getConfig: client.config, getLandingSites: client.landingSites, getMapMetadata: client.mapMetadata, getEphemeris: client.ephemeris };
}
export type HttpLunarApiClient = ReturnType<typeof createApiClient>;
