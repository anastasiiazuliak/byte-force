import { createApiClient } from '../api/client';
export { createApiClient } from '../api/client';

export async function createConfiguredClient() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';
  if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true') {
    const { createMockTransport } = await import('../mocks/transport');
    return createApiClient({ baseUrl, transport: createMockTransport(baseUrl) });
  }
  return createApiClient({ baseUrl });
}
