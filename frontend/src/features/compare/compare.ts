import { ApiClientError, type HttpLunarApiClient } from '../../api/client';
import type { AnalysisResponse, ComparisonDifferences, CompareRequest } from '../../api/types';

export type Results = [AnalysisResponse | null, AnalysisResponse | null];
export function difference(a: AnalysisResponse | null, b: AnalysisResponse | null): ComparisonDifferences {
  function delta(metric: keyof ComparisonDifferences) {
    if (a?.status !== 'complete' || b?.status !== 'complete') return null;
    const first = a.summary[metric];
    const second = b.summary[metric];
    return first == null || second == null ? null : second - first;
  }
  return { sunVisibleHours: delta('sunVisibleHours'), earthVisibleHours: delta('earthVisibleHours'), bothVisibleHours: delta('bothVisibleHours') };
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) return error.apiError?.error.message ?? error.message;
  return 'Unable to complete the request.';
}

export async function compare(client: HttpLunarApiClient, scenarios: CompareRequest['scenarios'], signal: AbortSignal) {
  try {
    const response = await client.compare({ scenarios }, signal);
    const results: Results = [
      response.scenarios.find(item => item.id === 'A')?.analysis ?? null,
      response.scenarios.find(item => item.id === 'B')?.analysis ?? null,
    ];
    return { results, errors: results.map(result => result ? null : 'Scenario result unavailable.') };
  } catch (error) {
    if (!(error instanceof ApiClientError) || ![404, 405, 501].includes(error.status ?? 0)) throw error;
    const [a, b] = await Promise.allSettled(scenarios.map(({ location, period, options }) =>
      client.analyze({ location, period, options }, signal),
    ));
    const results: Results = [a.status === 'fulfilled' ? a.value : null, b.status === 'fulfilled' ? b.value : null];
    const errors = [a, b].map(result => result.status === 'rejected' ? errorMessage(result.reason) : null);
    return { results, errors };
  }
}
