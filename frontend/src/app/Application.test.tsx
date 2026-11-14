// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Application } from './Application';
import { ApiClientError } from '../api/client';
import fixture from '../../../contracts/fixtures/analyze-partial.json';
const api = vi.hoisted(() => ({ health: vi.fn(), config: vi.fn(), landingSites: vi.fn(), mapMetadata: vi.fn(), analyze: vi.fn(), compare: vi.fn(), ephemeris: vi.fn() }));
vi.mock('../integration/client', () => ({ createConfiguredClient: async () => api }));
vi.mock('../features/explorer', () => ({ LunarTerrainViewer: ({ timeUtc }: { timeUtc: string }) => <div data-testid="scene-time">{timeUtc}</div> }));
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  api.health.mockResolvedValue({ status: 'ok' }); api.config.mockRejectedValue(new Error('offline')); api.landingSites.mockResolvedValue({ sites: [] }); api.mapMetadata.mockRejectedValue(new Error('missing metadata'));
  api.analyze.mockResolvedValue(fixture);
  api.ephemeris.mockRejectedValue(new ApiClientError('HTTP 503', 'http', 503, { error: { code: 'EPHEMERIS_UNAVAILABLE', message: 'No validated Moon-fixed vectors' } }));
});
async function fillA() {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Analyze site' }).hasAttribute('disabled')).toBe(false));
  fireEvent.change(screen.getByLabelText('Latitude A'), { target: { value: '-89.5' } });
  fireEvent.change(screen.getByLabelText('Longitude A'), { target: { value: '0' } });
}
describe('live workspace composition', () => {
  it('submits UTC, renders partial/unknown honestly and exposes ephemeris 503', async () => {
    render(<Application />); await fillA();
    fireEvent.click(screen.getByRole('button', { name: 'Analyze site' }));
    await screen.findByText('Partial analysis');
    expect(api.analyze.mock.calls[0][0].period.startUtc).toBe('2028-04-15T00:00:00.000Z');
    expect(screen.getByTestId('ephemeris-status').textContent).toContain('EPHEMERIS_UNAVAILABLE (HTTP 503)');
    expect(screen.getByTestId('analysis-result').textContent).toContain('Terrain not considered');
    expect(screen.getByTestId('analysis-result').textContent).toContain('Unknown');
    expect(screen.getByText(/Map metadata unavailable/)).toBeTruthy();
  });
  it('ignores late analysis after coordinates change, even if transport ignores abort', async () => {
    let resolve!: (value: unknown) => void; api.analyze.mockImplementation(() => new Promise(r => { resolve = r; }));
    render(<Application />); await fillA(); fireEvent.click(screen.getByRole('button', { name: 'Analyze site' }));
    await waitFor(() => expect(api.analyze).toHaveBeenCalledOnce());
    const signal = api.analyze.mock.calls[0][1] as AbortSignal;
    fireEvent.change(screen.getByLabelText('Longitude A'), { target: { value: '10' } });
    await act(async () => resolve(fixture));
    expect(signal.aborted).toBe(true); expect(screen.queryByText('Partial analysis')).toBeNull();
  });
  it('compares A=B using /compare and scrubs the scene without network requests', async () => {
    const analysis = { ...fixture, samples: [...fixture.samples, { ...fixture.samples[0], timeUtc: '2026-11-14T01:00:00Z' }] };
    api.compare.mockResolvedValue({ scenarios: [{ id: 'A', analysis }, { id: 'B', analysis }], differences: { sunVisibleHours: null, earthVisibleHours: null, bothVisibleHours: null } });
    render(<Application />); await fillA(); fireEvent.click(screen.getByRole('button', { name: /^Compare$/ })); fireEvent.click(screen.getByRole('button', { name: 'Copy A to B' })); fireEvent.click(screen.getByRole('button', { name: 'Compare scenarios' }));
    await screen.findByTestId('comparison-differences');
    expect(api.compare.mock.calls[0][0].scenarios[0].location).toEqual(api.compare.mock.calls[0][0].scenarios[1].location);
    fireEvent.change(screen.getByLabelText('Selected UTC sample'), { target: { value: '1' } });
    expect(screen.getByTestId('selected-utc').textContent).toBe('2026-11-14T01:00:00Z');
    expect(screen.getByTestId('scene-time').textContent).toBe(screen.getByTestId('selected-utc').textContent);
    expect(api.compare).toHaveBeenCalledOnce(); expect(api.analyze).not.toHaveBeenCalled(); expect(api.ephemeris).toHaveBeenCalledOnce();
    expect(screen.getByTestId('comparison-differences').textContent).toContain('Unknown');
  });
  it('retains structured scientific API errors rather than fabricating results', async () => {
    api.analyze.mockRejectedValue(new ApiClientError('HTTP 503', 'http', 503, { error: { code: 'EPHEMERIS_UNAVAILABLE', message: 'Horizons offline' } }));
    render(<Application />); await fillA(); fireEvent.click(screen.getByRole('button', { name: 'Analyze site' }));
    expect((await screen.findByTestId('analysis-error')).textContent).toContain('EPHEMERIS_UNAVAILABLE (HTTP 503): Horizons offline');
    expect(screen.queryByTestId('analysis-result')).toBeNull();
  });
});
