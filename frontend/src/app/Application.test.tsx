import * as siteCatalog from './siteCatalog';
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Application, errorMessage as applicationErrorMessage } from './Application';
import { errorMessage } from './errorMessage';
import { ApiClientError } from '../api/client';
import fixture from '../../../contracts/fixtures/analyze-partial.json';
const api = vi.hoisted(() => ({ health: vi.fn(), config: vi.fn(), landingSites: vi.fn(), mapMetadata: vi.fn(), analyze: vi.fn(), compare: vi.fn(), ephemeris: vi.fn() }));
vi.mock('../integration/client', () => ({ createConfiguredClient: async () => api }));
vi.mock('../features/explorer', () => ({ LunarTerrainViewer: ({ timeUtc, globe }: { timeUtc: string; globe?: boolean }) => <div data-testid="scene-time" data-view={globe ? 'globe' : 'terrain'}>{timeUtc}</div> }));
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
  it('retains the entry-point error formatter export', () => {
    expect(applicationErrorMessage).toBe(errorMessage);
  });
  it('shows indeterminate progress until the analysis finishes', async () => {
    let finish!: (value: typeof fixture) => void;
    api.analyze.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(<Application />); await fillA();
    expect(screen.queryByRole('progressbar')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Analyze site' }));
    const progress = screen.getByRole('progressbar', { name: 'Calculating analysis…' });
    expect(progress.hasAttribute('aria-valuenow')).toBe(false);
    await act(async () => finish(fixture));
    await screen.findByTestId('analysis-result');
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
  it('submits UTC, renders partial/unknown honestly and exposes ephemeris 503', async () => {
    render(<Application />); await fillA();
    fireEvent.click(screen.getByRole('button', { name: 'Analyze site' }));
    await screen.findByText('Partial analysis');
    expect(api.analyze.mock.calls[0][0].period.startUtc).toBe('2026-11-15T00:00:00.000Z');
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
    fireEvent.click(screen.getByRole('button', { name: 'Terrain View' }));
    expect((await screen.findByTestId('scene-time')).textContent).toBe(screen.getByTestId('selected-utc').textContent);
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

it('renders regional data even when global visibility is unverified, and cancels loading', async () => {
  api.analyze.mockResolvedValue({ ...fixture, horizon: { points: [{ azimuthDeg: 0, elevationDeg: 2 }, { azimuthDeg: 180, elevationDeg: 3 }] } });
  render(<Application />); await fillA();
  fireEvent.click(screen.getByRole('button', { name: 'Analyze site' }));
  await screen.findByText('REGIONAL ESTIMATE · far-field visibility unknown');
  expect(screen.getByRole('img', { name: 'Terrain horizon profile: azimuth 0 to 360 degrees' })).toBeTruthy();
  expect(screen.getByTestId('analysis-result').textContent).not.toContain('Terrain not considered');
  api.analyze.mockImplementation(() => new Promise(() => {}));
  fireEvent.click(screen.getByRole('button', { name: 'Analyze site' }));
  await screen.findByRole('button', { name: 'Cancel analysis' });
  expect(screen.getByRole('progressbar')).toBeTruthy();
  const signal = api.analyze.mock.calls[1][1] as AbortSignal;
  fireEvent.click(screen.getByRole('button', { name: 'Cancel analysis' }));
  expect(signal.aborted).toBe(true);
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(screen.queryByTestId('analysis-result')).toBeNull();
});

it('prepares exploratory A/B coordinates without submitting or losing UTC drafts', async () => {
  render(<Application />); await fillA();
  fireEvent.click(screen.getByRole('button', { name: 'Prepare patch comparison' }));
  expect((screen.getByLabelText('Latitude A') as HTMLInputElement).value).toBe('-89.45');
  expect((screen.getByLabelText('Latitude B') as HTMLInputElement).value).toBe('-89.9');
  expect((screen.getByLabelText('Start UTC A') as HTMLInputElement).value).toBe('2026-11-15T00:00');
  expect(api.compare).not.toHaveBeenCalled();
});

it('announces reviewed regional map metadata without claiming complete visibility', async () => {
  const { default: map } = await import('../../../contracts/fixtures/map-metadata-real.json');
  api.mapMetadata.mockResolvedValue({ ...map.metadata, terrainDataset: { ...map.metadata.terrainDataset, metadataVerified: true } });
  render(<Application />);
  await screen.findByText('Reviewed regional map');
  expect(screen.queryByText('Complete analysis')).toBeNull();
});

it('quick-compares two explicit exploratory coordinates with only two samples per site', async () => {
  api.compare.mockResolvedValue({ scenarios: [{ id: 'A', analysis: fixture }, { id: 'B', analysis: fixture }], differences: { sunVisibleHours: null, earthVisibleHours: null, bothVisibleHours: null } });
  render(<Application />); await fillA();
  fireEvent.click(screen.getByRole('button', { name: 'Quick compare · 2 samples/site' }));
  await screen.findByTestId('comparison-differences');
  expect(api.compare).toHaveBeenCalledOnce();
  const [a,b] = api.compare.mock.calls[0][0].scenarios;
  expect(a.location).toEqual({ latitude: -89.45, longitude: -137.31 });
  expect(b.location).toEqual({ latitude: -89.9, longitude: 0 });
  expect(Date.parse(a.period.endUtc)-Date.parse(a.period.startUtc)).toBe(3600000);
  expect(a.period.stepMinutes).toBe(60);
});

it('quick comparison rejects incomplete UTC without a request or uncaught event error', async () => {
  render(<Application />); await fillA();
  fireEvent.change(screen.getByLabelText('Start UTC A'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Quick compare · 2 samples/site' }));
  expect((await screen.findByTestId('analysis-error')).textContent).toContain('UTC');
  expect(api.compare).not.toHaveBeenCalled();
});

it('defaults to catalog overview and returning to it preserves both scenario drafts', async () => {
  const { default: map } = await import('../../../contracts/fixtures/map-metadata-real.json');
  api.mapMetadata.mockResolvedValue(map.metadata);
  const loader = vi.spyOn(siteCatalog, 'loadSiteCatalog').mockImplementation(async (_signal, _reviewed, publish) => {
    publish?.({ id: 'south-pole-overview', label: 'Overview', description: 'Coarse overview', metadata: map.metadata as import('../api/types').MapMetadataResponse });
    return siteCatalog.exploratoryPatches;
  });
  try {
    render(<Application />);
    await waitFor(() => expect((screen.getByLabelText('Exploratory patch') as HTMLSelectElement).value).toBe('south-pole-overview'));
    await fillA();
    fireEvent.click(screen.getByRole('button', { name: /^Compare$/ }));
    fireEvent.change(screen.getByLabelText('Latitude B'), { target: { value: '-88' } });
    fireEvent.change(screen.getByLabelText('Longitude B'), { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: /^South Pole Overview$/ }));
    expect((screen.getByLabelText('Latitude A') as HTMLInputElement).value).toBe('-89.5');
    expect((screen.getByLabelText('Latitude B') as HTMLInputElement).value).toBe('-88');
    expect((screen.getByLabelText('Longitude B') as HTMLInputElement).value).toBe('45');
    expect(api.analyze).not.toHaveBeenCalled(); expect(api.compare).not.toHaveBeenCalled();
  } finally { loader.mockRestore(); }
});

it('defaults to fail-closed Globe and preserves results and inputs across representation switches', async () => {
  render(<Application />); await fillA();
  expect(screen.getByRole('button', { name: 'Globe View' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByText(/Reviewed Globe catalog unavailable/)).toBeTruthy();
  expect((await screen.findByTestId('scene-time')).getAttribute('data-view')).toBe('globe');
  expect((screen.getByRole('checkbox', { name: 'Scientific Sun Lighting' }) as HTMLInputElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Analyze site' }));
  await screen.findByTestId('analysis-result');
  const before = screen.getByTestId('analysis-result').textContent;
  for (const name of ['Terrain View', 'Globe View', 'Terrain View']) fireEvent.click(screen.getByRole('button', { name }));
  expect(screen.getByTestId('analysis-result').textContent).toBe(before);
  expect((screen.getByLabelText('Latitude A') as HTMLInputElement).value).toBe('-89.5');
  expect(api.analyze).toHaveBeenCalledOnce();
});
