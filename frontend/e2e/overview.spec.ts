import { test, expect } from '@playwright/test';

test('whole-pole default, verified picking and native detail round trip', async ({ page }) => {
  test.skip(process.env.LUNAR_REVIEWED_E2E !== '1', 'Requires locally proof-published real NASA overview; no synthetic replacement in CI.');
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  const viewer = page.getByTestId('lunar-terrain-viewer');
  await expect(viewer).toHaveAttribute('data-selected-asset-key', /overview\/terrain.glb/);
  await expect(page.getByText('Terrain: Ready (GLB)', { exact: true })).toBeVisible();
  await page.waitForTimeout(1400);
  await expect(page.getByRole('button', { name: 'Fit Terrain (F)', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Top-Down (T)', exact: true }).click();
  await page.waitForTimeout(1200);
  const canvas = viewer.locator('canvas'), box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width * .55, box.y + box.height * .5);
  const latitude = await page.getByLabel('Latitude A', { exact: true }).inputValue();
  expect(Number(latitude)).toBeGreaterThanOrEqual(-90); expect(Number(latitude)).toBeLessThanOrEqual(-80);
  await page.screenshot({ path: 'test-results/overview-default.png', fullPage: true });
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await page.getByLabel('Latitude B', { exact: true }).fill('-88');
  await page.getByLabel('Longitude B', { exact: true }).fill('45');
  await page.route('**/static/near-shackleton/terrain.glb', async route => {
    await new Promise(resolve => setTimeout(resolve, 700)); await route.continue();
  });
  await page.getByLabel('Exploratory patch', { exact: true }).selectOption('near-shackleton');
  await expect(page.getByText('Loading Terrain...', { exact: true })).toBeVisible();
  await expect(canvas).toBeVisible();
  await expect(viewer).toHaveAttribute('data-selected-asset-key', /near-shackleton/);
  await expect(page.getByText('Terrain: Ready (GLB)', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Latitude A', { exact: true })).toHaveValue('-89.9');
  await page.getByRole('button', { name: 'South Pole Overview', exact: true }).click();
  await expect(viewer).toHaveAttribute('data-selected-asset-key', /overview\/terrain.glb/);
  await expect(page.getByLabel('Latitude A', { exact: true })).toHaveValue('-89.9');
  await expect(page.getByText('Terrain: Ready (GLB)', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Latitude B', { exact: true })).toHaveValue('-88');
  await expect(page.getByLabel('Longitude B', { exact: true })).toHaveValue('45');
  expect(errors).toEqual([]);
});

for (const width of [390, 768, 1024, 1440]) {
  test(`real overview remains usable at ${width}px`, async ({ page }) => {
    test.skip(process.env.LUNAR_REVIEWED_E2E !== '1', 'Requires proof-published NASA overview.');
    await page.setViewportSize({ width, height: width < 800 ? 844 : 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('/');
    const viewer = page.getByTestId('lunar-terrain-viewer');
    await expect(viewer).toHaveAttribute('data-selected-asset-key', /overview\/terrain.glb/);
    await expect(page.getByText('Terrain: Ready (GLB)', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Top-Down (T)', exact: true }).click();
    await page.waitForTimeout(400);
    const canvas = viewer.locator('canvas');
    await canvas.scrollIntoViewIfNeeded();
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + box.width * .55, box.y + box.height * .52);
    const latitude = Number(await page.getByLabel('Latitude A', { exact: true }).inputValue());
    expect(latitude).toBeLessThanOrEqual(-80); expect(latitude).toBeGreaterThanOrEqual(-90);
    await page.getByRole('button', { name: 'Focus Site A', exact: true }).click();
    await page.getByRole('button', { name: 'Fit Terrain (F)', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const button of await viewer.getByRole('toolbar', { name: 'Camera Controls' }).getByRole('button').all()) {
      expect(await button.evaluate(el => {
        const bounds = el.closest('[data-testid="lunar-terrain-viewer"]')!.getBoundingClientRect();
        const b = el.getBoundingClientRect();
        return b.left >= bounds.left && b.right <= bounds.right && b.top >= bounds.top && b.bottom <= bounds.bottom;
      })).toBe(true);
    }
    await page.getByRole('button', { name: 'Top-Down (T)', exact: true }).click();
    await page.waitForTimeout(400);
    await viewer.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/overview-${width}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}

test('a late overview catalog never replaces an explicit user-selected patch', async ({ page }) => {
  test.skip(process.env.LUNAR_REVIEWED_E2E !== '1', 'Requires reviewed runtime catalog.');
  let releaseCatalog!: () => void;
  const gate = new Promise<void>(resolve => { releaseCatalog = resolve; });
  await page.route('**/static/metadata/explorer-sites.json', async route => {
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response });
  });
  const pending = page.waitForRequest('**/static/metadata/explorer-sites.json');
  await page.goto('/'); await pending;
  await page.getByLabel('Exploratory patch', { exact: true }).selectOption('near-shackleton');
  releaseCatalog();
  await expect(page.getByRole('button', { name: 'South Pole Overview', exact: true })).toBeEnabled();
  await expect(page.getByTestId('lunar-terrain-viewer')).toHaveAttribute('data-selected-asset-key', /near-shackleton/);
  await expect(page.getByText('Terrain: Ready (GLB)', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Exploratory patch', { exact: true })).toHaveValue('near-shackleton');
});

test('missing overview stays unavailable and cannot produce geographic picks', async ({ page }) => {
  test.skip(process.env.LUNAR_REVIEWED_E2E !== '1', 'Requires reviewed catalog to request overview.');
  await page.route('**/static/overview/terrain.glb', route => route.fulfill({ status: 404, body: 'Asset intentionally missing for regression test' }));
  await page.goto('/');
  await expect(page.getByText('Terrain unavailable · retained view / fallback', { exact: true })).toBeVisible();
  await page.getByTestId('lunar-terrain-viewer').locator('canvas').click();
  await expect(page.getByLabel('Latitude A', { exact: true })).toHaveValue('');
  await page.getByLabel('Latitude A', { exact: true }).fill('-89');
  await page.getByLabel('Longitude A', { exact: true }).fill('25');
  await expect(page.getByRole('button', { name: 'Analyze site', exact: true })).toBeEnabled();
});
