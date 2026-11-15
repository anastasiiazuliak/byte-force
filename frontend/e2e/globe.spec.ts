import { test, expect, type Page } from '@playwright/test';
import fixture from '../../contracts/fixtures/analyze-partial.json' with { type: 'json' };

test.skip(process.env.LUNAR_REVIEWED_E2E !== '1', 'Requires locally proof-published real NASA spherical assets; no synthetic globe in CI.');

const viewer = (page: Page) => page.getByTestId('lunar-terrain-viewer');
async function ready(page: Page) {
  await expect(viewer(page)).toHaveAttribute('data-selected-asset-key', /\/static\/globe\/terrain.glb/);
  await expect(page.getByText('Terrain: Ready (GLB)', { exact: true })).toBeVisible();
}
async function pick(page: Page, x: number, y: number) {
  const canvas = viewer(page).locator('canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width * x, box!.y + box!.height * y);
}

test('default actual Globe GLB, sphere A/B picks and surface markers', async ({ page }) => {
  const asset = page.waitForResponse('**/static/globe/terrain.glb');
  await page.goto('/');
  const response = await asset;
  expect(response.status()).toBe(200);
  expect((await response.body()).subarray(0, 4).toString()).toBe('glTF');
  await ready(page);
  await expect(page.getByRole('button', { name: 'Globe View', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Scientific Sun Lighting', { exact: true })).toBeDisabled();
  await expect(viewer(page)).toHaveAttribute('data-sunlight-source', 'illustrative');
  await page.getByRole('button', { name: 'Top-Down (T)', exact: true }).click();
  await page.waitForTimeout(1200);
  await pick(page, .5, .5);
  const a = await page.getByLabel('Latitude A', { exact: true }).inputValue();
  expect(a).not.toBe(''); expect(Number(a)).toBeGreaterThanOrEqual(-90); expect(Number(a)).toBeLessThanOrEqual(-80);
  await expect(page.getByRole('button', { name: /^Site A:/ })).toBeVisible();
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await page.getByRole('button', { name: /^Site B(?:\s|$)/ }).click();
  await pick(page, .6, .52);
  const b = await page.getByLabel('Latitude B', { exact: true }).inputValue();
  expect(b).not.toBe(''); expect(Number(b)).toBeGreaterThanOrEqual(-90); expect(Number(b)).toBeLessThanOrEqual(-80);
  expect(b).not.toBe(a);
  await expect(page.getByRole('button', { name: /^Site B:/ })).toBeVisible();
});

test('representation and native patch round trip preserves cached analysis, coordinates and UTC without API requests', async ({ page }) => {
  let analyses = 0;
  await page.route('**/api/v1/analyze', route => {
    analyses++;
    const input = route.request().postDataJSON();
    const result = structuredClone(fixture);
    result.location = input.location; result.period = input.period;
    result.samples = [0, 60].map(minutes => ({ ...structuredClone(fixture.samples[0]), timeUtc: new Date(Date.parse(input.period.startUtc) + minutes * 60000).toISOString() }));
    return route.fulfill({ json: result });
  });
  await page.goto('/'); await ready(page);
  await page.getByLabel('Exploratory patch', { exact: true }).selectOption('connecting-ridge');
  await page.getByLabel('Start UTC A', { exact: true }).fill('2026-11-14T00:00');
  await page.getByLabel('End UTC A', { exact: true }).fill('2026-11-14T01:00');
  await page.getByLabel('Step minutes A', { exact: true }).fill('60');
  await page.getByRole('button', { name: 'Analyze site', exact: true }).click();
  await expect(page.getByTestId('analysis-result')).toContainText('SYNTHETIC');
  await page.getByRole('slider', { name: 'Selected UTC sample' }).fill('1');
  const utc = await page.getByTestId('selected-utc').textContent();
  const analysis = await page.getByTestId('analysis-result').textContent();
  const requests: string[] = [];
  page.on('request', r => { if (r.url().includes('/api/v1/')) requests.push(r.url()); });
  for (const mode of ['Terrain View', 'Globe View', 'Terrain View']) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    await expect(viewer(page)).toHaveAttribute('data-selected-asset-key', mode === 'Globe View' ? /globe\/terrain.glb/ : /connecting-ridge/);
    await expect(page.getByText('Terrain: Ready (GLB)', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Latitude A', { exact: true })).toHaveValue('-89.45');
    await expect(page.getByLabel('Longitude A', { exact: true })).toHaveValue('-137.31');
    await expect(page.getByTestId('selected-utc')).toHaveText(utc!);
    await expect(page.getByTestId('analysis-result')).toHaveText(analysis!);
    if (mode === 'Globe View') await expect(page.getByLabel('Scientific Sun Lighting', { exact: true })).toBeDisabled();
  }
  expect(analyses).toBe(1); expect(requests).toEqual([]);
});

test('missing Globe GLB fails closed for picks while manual analysis remains available', async ({ page }) => {
  await page.route('**/static/globe/terrain.glb', route => route.fulfill({ status: 404, body: 'Deliberately missing Globe regression asset' }));
  await page.goto('/');
  await expect(page.getByText('Terrain unavailable · retained view / fallback', { exact: true })).toBeVisible();
  await pick(page, .5, .5);
  await expect(page.getByLabel('Latitude A', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Longitude A', { exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: /^Site A:/ })).toHaveCount(0);
  await page.getByLabel('Latitude A', { exact: true }).fill('-89');
  await page.getByLabel('Longitude A', { exact: true }).fill('25');
  await expect(page.getByRole('button', { name: 'Analyze site', exact: true })).toBeEnabled();
});

for (const width of [390, 768, 1024, 1440]) {
  test(`Globe controls remain inside viewport and viewer at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 800 ? 844 : 1000 });
    await page.goto('/'); await ready(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const controls = viewer(page).getByRole('toolbar', { name: 'Camera Controls' }).getByRole('button');
    expect(await controls.count()).toBeGreaterThan(0);
    for (const button of await controls.all()) {
      expect(await button.evaluate(el => {
        const b = el.getBoundingClientRect(), v = el.closest('[data-testid="lunar-terrain-viewer"]')!.getBoundingClientRect();
        return b.width > 0 && b.height > 0 && b.left >= v.left && b.right <= v.right && b.top >= v.top && b.bottom <= v.bottom && b.left >= 0 && b.right <= innerWidth;
      })).toBe(true);
    }
    for (const name of ['Globe View', 'Terrain View']) {
      const button = page.getByRole('button', { name, exact: true });
      expect(await button.evaluate(el => { const b = el.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth; })).toBe(true);
    }
    if (width === 390 || width === 1440) await page.screenshot({ path: `test-results/globe-${width === 390 ? 'mobile' : 'desktop'}.png`, fullPage: true });
  });
}
