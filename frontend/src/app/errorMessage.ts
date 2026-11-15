import { ApiClientError } from '../api/client';

export function errorMessage(error: unknown) {
  if (error instanceof ApiClientError)
    return `${error.apiError?.error.code ?? error.kind}${error.status ? ` (HTTP ${error.status})` : ''}: ${error.apiError?.error.message ?? error.message}`;
  return error instanceof Error ? error.message : 'Request failed';
}
