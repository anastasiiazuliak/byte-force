import { describe, expect, it } from 'vitest';
import { ApiClientError } from '../api/client';
import { errorMessage } from './errorMessage';

describe('workspace error formatting', () => {
  it('preserves structured API codes, HTTP status, and server messages', () => {
    const error = new ApiClientError('HTTP 503', 'http', 503, {
      error: { code: 'EPHEMERIS_UNAVAILABLE', message: 'Horizons offline' },
    });
    expect(errorMessage(error)).toBe(
      'EPHEMERIS_UNAVAILABLE (HTTP 503): Horizons offline',
    );
  });

  it('falls back to client details without inventing an HTTP status', () => {
    const error = new ApiClientError('Connection unavailable', 'network');
    expect(errorMessage(error)).toBe('network: Connection unavailable');
  });

  it('handles ordinary errors and unknown thrown values', () => {
    expect(errorMessage(new Error('Invalid UTC'))).toBe('Invalid UTC');
    expect(errorMessage(null)).toBe('Request failed');
    expect(errorMessage('unstructured rejection')).toBe('Request failed');
  });
});
