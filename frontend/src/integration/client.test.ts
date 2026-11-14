import { it, expect, vi } from 'vitest';
import { ApiClientError, createApiClient } from '../api/client';
import { createMockTransport } from '../mocks/transport';
import { analysisCacheKey } from '../api/keys';

it('uses configured URL, POST JSON and forwards AbortSignal', async () => {
  const transport = vi.fn(async () => new Response('{}'));
  const signal = new AbortController().signal;
  const client = createApiClient({ baseUrl: 'https://example.invalid/api/v1/', transport });
  await client.getEphemeris({ startUtc: '2026-11-14T00:00:00Z', endUtc: '2026-11-15T00:00:00Z', stepMinutes: 60 }, signal);
  expect(transport).toHaveBeenCalledWith('https://example.invalid/api/v1/ephemeris', expect.objectContaining({ method: 'POST', signal, headers: expect.objectContaining({ 'Content-Type': 'application/json' }) }));
});
it('classifies JSON and non-JSON HTTP errors, network failures and malformed success responses', async () => {
  for (const body of ['unavailable', JSON.stringify({ error: { code: 'EPHEMERIS_UNAVAILABLE', message: 'offline' } })]) {
    await expect(createApiClient({ transport: async () => new Response(body, { status: 503 }) }).health()).rejects.toMatchObject({ kind: 'http', status: 503 });
  }
  await expect(createApiClient({ transport: async () => { throw new TypeError('offline'); } }).health()).rejects.toMatchObject({ kind: 'network' });
  await expect(createApiClient({ transport: async () => new Response('not JSON') }).health()).rejects.toBeInstanceOf(ApiClientError);
});
it('preserves cancellation and never calls transport for a pre-aborted request', async () => {
  const controller = new AbortController(); controller.abort();
  const transport = vi.fn(createMockTransport());
  await expect(createApiClient({ transport }).getConfig(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(transport).not.toHaveBeenCalled();
});
it('keeps unknown mock visibility null and never provides fake ephemerides', async () => {
  const client = createApiClient({ transport: createMockTransport() });
  const result = await client.analyze({ location: { latitude: -88, longitude: 10 }, period: { startUtc: '2026-11-14T00:00:00Z', endUtc: '2026-11-15T00:00:00Z', stepMinutes: 60 } });
  expect(result.quality.ephemerisSource).toContain('SYNTHETIC');
  expect(result.samples[0].sun.visible).toBeNull();
  expect(result.location.latitude).toBe(-88);
  await expect(client.getEphemeris(result.period)).rejects.toMatchObject({ status: 503 });
});
it('creates stable keys across property order and distinct keys for distinct options', () => {
  const period = { startUtc: '2026-11-14T00:00:00Z', endUtc: '2026-11-15T00:00:00Z', stepMinutes: 60 };
  const a = { location: { latitude: -89, longitude: 25 }, period };
  expect(analysisCacheKey(a)).toBe(analysisCacheKey({ period, location: { longitude: 25, latitude: -89 } }));
  expect(analysisCacheKey(a)).not.toBe(analysisCacheKey({ ...a, options: { terrainModel: 'lola', includeHorizon: false } }));
});
it('dev opt-in uses mock transport with a custom API base without network calls', async () => {
  vi.stubEnv('DEV', true); vi.stubEnv('VITE_USE_MOCKS', 'true'); vi.stubEnv('VITE_API_BASE_URL', '/custom');
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
  try {
    const { createConfiguredClient } = await import('./client');
    expect((await (await createConfiguredClient()).getConfig()).region.name).toContain('SYNTHETIC');
    expect(fetchMock).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); vi.unstubAllEnvs(); }
});
it('production configuration ignores mock opt-in', async () => {
  vi.stubEnv('DEV', false); vi.stubEnv('VITE_USE_MOCKS', 'true');
  const fetchMock = vi.fn(async () => new Response('{"status":"ok","version":"real"}'));
  vi.stubGlobal('fetch', fetchMock);
  try {
    const { createConfiguredClient } = await import('./client');
    expect((await (await createConfiguredClient()).health()).version).toBe('real');
    expect(fetchMock).toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); vi.unstubAllEnvs(); }
});
