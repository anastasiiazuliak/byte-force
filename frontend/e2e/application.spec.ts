import { test, expect, type Page } from '@playwright/test';
import fixture from '../../contracts/fixtures/analyze-partial.json' with { type: 'json' };

async function form(page: Page, slot = 'A') {
  await page.getByLabel(`Latitude ${slot}`, { exact: true }).fill('-89.5');
  await page.getByLabel(`Longitude ${slot}`, { exact: true }).fill('25');
  await page.getByLabel(`Start UTC ${slot}`, { exact: true }).fill('2026-11-14T00:00');
  await page.getByLabel(`End UTC ${slot}`, { exact: true }).fill('2026-11-14T01:00');
  await page.getByLabel(`Step minutes ${slot}`, { exact: true }).fill('30');
}
function synthetic(request: any) {
  const result = structuredClone(fixture);
  result.location = { ...request.location, elevationM: null }; result.period = request.period;
  result.samples = [0, 30, 60].map(minutes => ({ ...structuredClone(fixture.samples[0]), timeUtc: new Date(Date.parse(request.period.startUtc) + minutes * 60000).toISOString() }));
  return result;
}
test('real local API, static GLB and WebGL render; picking follows dataset review', async ({ page, request }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const health = await request.get('/api/v1/health'); expect(health.ok()).toBeTruthy(); expect((await health.json()).status).toBe('ok');
  const asset = await request.get('/terrain/0/0/0.glb'); expect(asset.headers()['content-type']).toContain('model/gltf-binary'); expect((await asset.body()).subarray(0,4).toString()).toBe('glTF');
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Lunar Site Navigator' })).toBeVisible();
  await expect(page.getByTestId('lunar-terrain-viewer').locator('canvas')).toBeVisible();
  await expect(page.getByText('Terrain: Ready (GLB)')).toBeVisible({ timeout: 30000 });
  const rendered = await page.locator('canvas').first().evaluate((canvas: HTMLCanvasElement) => !!canvas.getContext('webgl2'));
  expect(rendered).toBeTruthy();
  await page.getByRole('button', { name: 'Top-Down (T)', exact: true }).click();
  await page.getByRole('button', { name: 'Reset (R)', exact: true }).click();
  await page.getByTestId('lunar-terrain-viewer').locator('canvas').click();
  const map = await request.get('/api/v1/map/metadata');
  if (map.ok() && (await map.json()).terrainDataset.metadataVerified) {
    await expect(page.getByLabel('Latitude A', { exact: true })).not.toHaveValue('');
  } else await expect(page.getByLabel('Latitude A', { exact: true })).toHaveValue('');
  expect(errors).toEqual([]); await page.screenshot({ path: '../.validation/lunar-browser.png', fullPage: true });
});
test('synthetic response: analyze, graphs, cached UTC scrub and A/B compare', async ({ page }) => {
  let analyses = 0, comparisons = 0;
  await page.route('**/api/v1/analyze', async route => { analyses++; await route.fulfill({ json: synthetic(route.request().postDataJSON()) }); });
  await page.route('**/api/v1/compare', async route => { comparisons++; const input = route.request().postDataJSON(); await route.fulfill({ json: { scenarios: input.scenarios.map((s: any) => ({ id: s.id, analysis: synthetic(s) })), differences: { sunVisibleHours: null, earthVisibleHours: null, bothVisibleHours: null } } }); });
  await page.goto('/'); await form(page); await page.getByRole('button', { name: 'Analyze site', exact: true }).click();
  await expect(page.getByTestId('analysis-result')).toContainText('SYNTHETIC');
  await expect(page.getByRole('img', { name: 'Sun and Earth altitude over UTC period in degrees' })).toBeVisible();
  const slider = page.getByRole('slider', { name: 'Selected UTC sample' }); await slider.fill('1');
  await expect(page.getByTestId('selected-utc')).toHaveText('2026-11-14T00:30:00.000Z');
  await slider.fill('0'); await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByTestId('selected-utc')).toHaveText('2026-11-14T00:30:00.000Z');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  expect(analyses).toBe(1);
  await page.getByRole('button', { name: 'Compare', exact: true }).click(); await page.getByRole('button', { name: 'Copy A to B', exact: true }).click();
  await page.getByRole('button', { name: 'Compare scenarios', exact: true }).click();
  await expect(page.getByTestId('analysis-result')).toHaveCount(2); await expect(page.getByTestId('comparison-differences')).toContainText('Unknown');
  expect(comparisons).toBe(1); expect(analyses).toBe(1);
});
test('network failure and NASA error are visible, never synthetic fallback', async ({ page }) => {
  await page.route('**/api/v1/analyze', route => route.abort('failed'));
  await page.goto('/'); await form(page); await page.getByRole('button', { name: 'Analyze site', exact: true }).click();
  await expect(page.getByTestId('analysis-error')).toContainText('Network request failed'); await expect(page.getByTestId('analysis-result')).toHaveCount(0);
  await page.unroute('**/api/v1/analyze');
  await page.route('**/api/v1/analyze', route => route.fulfill({ status: 503, json: { error: { code: 'EPHEMERIS_UNAVAILABLE', message: 'NASA unavailable — explicit browser fixture' } } }));
  await page.getByRole('button', { name: 'Analyze site', exact: true }).click(); await expect(page.getByTestId('analysis-error')).toContainText('EPHEMERIS_UNAVAILABLE');
  await expect(page.getByTestId('analysis-result')).toHaveCount(0);
});

test('real NASA through browser, partial analysis, compare and honest exports', async ({ page }) => {
  test.skip(process.env.LUNAR_RUN_LIVE_E2E !== '1', 'Explicit opt-in: real NASA network requests; offline CI never fabricates this result.');
  await page.goto('/'); await form(page); await page.getByLabel('Step minutes A', { exact: true }).fill('60');
  const response = page.waitForResponse(r => r.url().endsWith('/api/v1/analyze') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Analyze site', exact: true }).click();
  const actual = await response; expect(actual.status()).toBe(200); const result = await actual.json();
  expect(result.status).toBe('partial'); expect(result.quality.ephemerisSource).toBe('JPL Horizons'); expect(result.quality.terrainApplied).toBe(false);
  expect(result.samples.length).toBe(2); expect(result.samples[0].sun.visible).toBeNull();
  await expect(page.getByTestId('analysis-result')).toContainText('JPL Horizons');
  await page.getByRole('slider', { name: 'Selected UTC sample' }).fill('1');
  await expect(page.getByTestId('selected-utc')).toContainText('01:00:00');
  await page.screenshot({ path: '../.validation/real-nasa-analysis.png', fullPage: true });
  await page.getByRole('button', { name: 'Compare', exact: true }).click(); await page.getByRole('button', { name: 'Copy A to B', exact: true }).click();
  await page.getByLabel('Longitude B', { exact: true }).fill('26');
  const comparison = page.waitForResponse(r => r.url().endsWith('/api/v1/compare') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Compare scenarios', exact: true }).click();
  const compared = await comparison; expect(compared.status()).toBe(200);
  const values = (await compared.json()).scenarios; expect(values[0].analysis.location.longitude).toBe(25); expect(values[1].analysis.location.longitude).toBe(26);
  expect(values[1].analysis.samples[0].sun.azimuthDeg).not.toBe(values[0].analysis.samples[0].sun.azimuthDeg);
  await expect(page.getByTestId('analysis-result')).toHaveCount(2);
  await expect(page.getByTestId('comparison-differences')).toContainText('Unknown');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('lunar-compare.csv');
  expect(await download.failure()).toBeNull();
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString('utf8');
  expect(csv).toContain('JPL Horizons');
  expect(csv).toContain('unknown');
  expect(csv).toContain('B minus A');
  await page.getByRole('button', { name: 'Print report', exact: true }).click();
  const report = page.getByRole('dialog');
  await expect(report).toBeVisible();
  await expect(report).toContainText('Partial results');
  await expect(report).toContainText('Unknown');
  await page.emulateMedia({ media: 'print' });
  await expect(report).toBeVisible();
  await page.emulateMedia({ media: 'screen' });
  await report.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(report).not.toBeVisible();
});
