import { test, expect, type Page } from '@playwright/test';

async function pick(page: Page, x = .5, y = .5) {
  const canvas = page.getByTestId('lunar-terrain-viewer').locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width * x, box!.y + box!.height * y);
}
async function ready(page: Page) {
  await expect(page.getByText('Terrain: Ready (GLB)', { exact: true })).toBeVisible({ timeout: 60000 });
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
  await page.goto('/'); await page.getByRole('button', { name: 'Terrain View', exact: true }).click(); await page.getByLabel('Exploratory patch', { exact: true }).selectOption('connecting-ridge'); await ready(page);
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
  await page.goto('/'); await page.getByRole('button', { name: 'Terrain View', exact: true }).click(); await page.getByLabel('Exploratory patch', { exact: true }).selectOption('connecting-ridge'); await ready(page); await pick(page); await period(page);
  const done = page.waitForResponse(response => response.url().endsWith('/api/v1/analyze') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Analyze site', exact: true }).click();
  const response = await done; expect(response.status()).toBe(200); const result = await response.json();
  expect(result.status).toBe('partial'); expect(result.horizon.points).toHaveLength(360);
  expect(result.samples[0].sun.horizonDeg).not.toBeNull(); expect(result.samples[0].sun.clearanceDeg).not.toBeNull();
  expect(result.samples.every((sample: any) => sample.sun.visible === null && sample.earth.visible === null)).toBe(true);
  expect(Object.values(result.summary).every(value => value === null)).toBe(true);
  const article = page.getByTestId('analysis-result'); await expect(article).toContainText('REGIONAL ESTIMATE');
  await article.getByText('Samples & horizon (degrees, UTC)', { exact: true }).click();
  await expect(page.getByRole('img', { name: 'Terrain horizon profile: azimuth 0 to 360 degrees' })).toBeVisible();
  await expect(article.getByRole('img', { name: /Local sky compass for slot A/ })).toBeVisible();
  await article.getByRole('button', { name: /Inspect sample/ }).first().click();
  await expect(article.getByRole('tooltip')).toContainText(`Sun ${result.samples[0].sun.elevationDeg.toFixed(2)}° · Earth ${result.samples[0].earth.elevationDeg.toFixed(2)}°`);
  const compass = article.getByRole('img', { name: /Local sky compass for slot A/ });
  const sunMarker = compass.locator('g.sun-key circle');
  const az = result.samples[0].sun.azimuthDeg * Math.PI / 180;
  expect(Number(await sunMarker.getAttribute('cx'))).toBeCloseTo(70 + 42 * Math.sin(az), 5);
  expect(Number(await sunMarker.getAttribute('cy'))).toBeCloseTo(70 - 42 * Math.cos(az), 5);
  await article.getByLabel('Chart quantity').selectOption('clearance');
  await expect(article.getByRole('img', { name: 'Sun and Earth clearance over UTC period in degrees' })).toBeVisible();
  await article.getByRole('button', { name: /Inspect sample/ }).first().click();
  await expect(article.getByRole('tooltip')).toContainText(`Sun ${result.samples[0].sun.clearanceDeg.toFixed(2)}° · Earth ${result.samples[0].earth.clearanceDeg.toFixed(2)}°`);
  await page.getByLabel('Scientific Sun Lighting', { exact: true }).check();
  const viewer = page.getByTestId('lunar-terrain-viewer'); await expect(viewer).toHaveAttribute('data-sunlight-source', 'horizons-local');
  const first = await viewer.getAttribute('data-solar-direction');
  let requests = 0; page.on('request', r => { if (r.url().includes('/api/v1/')) requests++; });
  await page.getByRole('slider', { name: 'Selected UTC sample' }).fill('1');
  await expect(viewer).not.toHaveAttribute('data-solar-direction', first!);
  await expect(viewer).toHaveAttribute('data-time-utc', /01:00:00/);
  await page.waitForTimeout(300); // Permit the cached visual light's damping frames; no data requests.
  const coordinates = await page.getByLabel('Latitude A', { exact: true }).inputValue();
  for (const mode of ['Globe View', 'Terrain View']) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    await expect(viewer).toHaveAttribute('data-selected-asset-key', mode === 'Globe View' ? /globe\/terrain.glb/ : /connecting-ridge/);
    await ready(page);
    await expect(page.getByLabel('Latitude A', { exact: true })).toHaveValue(coordinates);
    await expect(viewer).toHaveAttribute('data-time-utc', /01:00:00/);
    await expect(article).toContainText('JPL Horizons');
    if (mode === 'Globe View') {
      await expect(page.getByLabel('Scientific Sun Lighting', { exact: true })).toBeDisabled();
      await expect(viewer).toHaveAttribute('data-sky-registration', 'measured-site-directions');
      await expect(viewer).toHaveAttribute('data-sky-site', 'A');
      const sunWorld = await viewer.getAttribute('data-sun-world-position');
      const earthWorld = await viewer.getAttribute('data-earth-world-position');
      const origin = JSON.parse((await viewer.getAttribute('data-sky-origin'))!) as number[];
      const sunPosition = JSON.parse(sunWorld!) as number[];
      const up = [origin[0], origin[1] + 1737400, origin[2]];
      const direction = sunPosition.map((value, i) => value - origin[i]);
      const elevationSine = direction.reduce((sum, value, i) => sum + value * up[i], 0) / Math.hypot(...direction) / Math.hypot(...up);
      expect(elevationSine).toBeCloseTo(Math.sin(result.samples[1].sun.elevationDeg * Math.PI / 180), 7);
      await page.getByRole('button', { name: 'Close-up (2)', exact: true }).click();
      await page.waitForTimeout(500);
      await expect(viewer).toHaveAttribute('data-sun-world-position', sunWorld!);
      await expect(viewer).toHaveAttribute('data-earth-world-position', earthWorld!);
      const canvas = viewer.locator('canvas');
      await canvas.scrollIntoViewIfNeeded();
      const box = (await canvas.boundingBox())!;
      await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * .58, box.y + box.height * .54, { steps: 8 });
      await page.mouse.up();
      await expect(viewer).toHaveAttribute('data-sun-world-position', sunWorld!);
      await expect(viewer).toHaveAttribute('data-earth-world-position', earthWorld!);
      await page.getByRole('slider', { name: 'Selected UTC sample' }).fill('0');
      await expect(viewer).not.toHaveAttribute('data-sun-world-position', sunWorld!);
      await expect(viewer).toHaveAttribute('data-sky-time-utc', /00:00:00/);
      await page.getByRole('slider', { name: 'Selected UTC sample' }).fill('1');
      await expect(viewer).toHaveAttribute('data-sun-world-position', sunWorld!);
      await page.screenshot({ path: '../.validation/measured-sky-closeup.png', fullPage: true });
    }
  }
  expect(requests).toBe(0);
  await page.screenshot({ path: '../.validation/reviewed-horizons-lighting.png', fullPage: true });
});
