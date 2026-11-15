import { test, expect, type Page } from '@playwright/test';

async function pick(page: Page, x = .5, y = .5) {
  const canvas = page.getByTestId('lunar-terrain-viewer').locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width * x, box!.y + box!.height * y);
}
async function ready(page: Page) {
  await expect(page.getByText('Terrain: Ready (GLB)', { exact: true })).toBeVisible();
}
async function period(page: Page, slot = 'A') {
  await page.getByLabel(`Start UTC ${slot}`, { exact: true }).fill('2026-11-14T00:00');
  await page.getByLabel(`End UTC ${slot}`, { exact: true }).fill('2026-11-14T01:00');
  await page.getByLabel(`Step minutes ${slot}`, { exact: true }).fill('60');
}

test('reviewed native geometry: pick A/B, real surface markers and patch replacement', async ({ page, request }) => {
  test.skip(process.env.LUNAR_REVIEWED_E2E !== '1', 'Requires proof-checked local NASA assets, never generated from synthetic data in CI.');
  const map = await request.get('/api/v1/map/metadata'); expect(map.status()).toBe(200);
  const data = await map.json(); expect(data.terrainDataset.metadataVerified).toBe(true);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await ready(page);
  const viewer = page.getByTestId('lunar-terrain-viewer');
  await expect(viewer).toHaveAttribute('data-selected-asset-key', /connecting-ridge/);
  await pick(page);
  const latitude = await page.getByLabel('Latitude A', { exact: true }).inputValue();
  const longitude = await page.getByLabel('Longitude A', { exact: true }).inputValue();
  expect(Number(latitude)).toBeGreaterThan(-90); expect(Number(latitude)).toBeLessThan(-89);
  expect(Number(longitude)).toBeLessThan(-110); expect(Number(longitude)).toBeGreaterThan(-170);
  await expect(page.getByRole('button', { name: /^Site A:/ })).toBeVisible();
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await page.getByRole('button', { name: /^Site B(?:\s|$)/ }).click();
  await pick(page, .6, .57);
  await expect(page.getByLabel('Latitude B', { exact: true })).not.toHaveValue('');
  const bLongitude = await page.getByLabel('Longitude B', { exact: true }).inputValue();
  expect(bLongitude).not.toBe(longitude);
  await expect(page.getByRole('button', { name: /^Site B:/ })).toBeVisible();
  await page.getByLabel('Exploratory patch', { exact: true }).selectOption('near-shackleton');
  await expect(viewer).toHaveAttribute('data-selected-asset-key', /near-shackleton/); await ready(page);
  await expect(page.getByLabel('Latitude A', { exact: true })).toHaveValue('-89.9');
  await expect(page.getByRole('button', { name: /^Site B:/ })).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.screenshot({ path: '../.validation/reviewed-3d-picking.png', fullPage: true });
});

test('live reviewed DEM profile and local Horizons light follow cached UTC', async ({ page }) => {
  test.skip(process.env.LUNAR_REVIEWED_E2E !== '1' || process.env.LUNAR_RUN_LIVE_E2E !== '1', 'Explicit opt-in required for real DEM and NASA requests.');
  await page.goto('/'); await ready(page); await pick(page); await period(page);
  const done = page.waitForResponse(response => response.url().endsWith('/api/v1/analyze') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Analyze site', exact: true }).click();
  const response = await done; expect(response.status()).toBe(200); const result = await response.json();
  expect(result.status).toBe('partial'); expect(result.horizon.points).toHaveLength(360);
  expect(result.samples[0].sun.horizonDeg).not.toBeNull(); expect(result.samples[0].sun.clearanceDeg).not.toBeNull();
  expect(result.samples.every((sample: any) => sample.sun.visible === null && sample.earth.visible === null)).toBe(true);
  expect(Object.values(result.summary).every(value => value === null)).toBe(true);
  const article = page.getByTestId('analysis-result'); await expect(article).toContainText('REGIONAL ESTIMATE');
  await expect(page.getByRole('img', { name: 'Terrain horizon profile: azimuth 0 to 360 degrees' })).toBeVisible();
  const viewer = page.getByTestId('lunar-terrain-viewer'); await expect(viewer).toHaveAttribute('data-sunlight-source', 'horizons-local');
  const first = await viewer.getAttribute('data-solar-direction');
  let requests = 0; page.on('request', r => { if (r.url().includes('/api/v1/')) requests++; });
  await page.getByRole('slider', { name: 'Selected UTC sample' }).fill('1');
  await expect(viewer).not.toHaveAttribute('data-solar-direction', first!);
  await expect(viewer).toHaveAttribute('data-time-utc', /01:00:00/);
  await page.waitForTimeout(300); // Permit the cached visual light's damping frames; no data requests.
  expect(requests).toBe(0);
  await page.screenshot({ path: '../.validation/reviewed-horizons-lighting.png', fullPage: true });
});
