import { expect, test } from '@playwright/test';

test.skip(process.env.LUNAR_REVIEWED_E2E !== '1', 'Requires locally published real DEM cartography.');

for (const width of [390, 768, 1024, 1440]) {
  test(`polar globe has no screen-fixed celestial decorations at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: width < 800 ? 844 : 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const texture = await request.get('/static/polar/relief.png');
    expect(texture.ok()).toBe(true);
    expect((await texture.body()).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    await page.goto('/');
    await expect(page.getByText('Terrain: Ready (GLB)', { exact: true })).toBeVisible({ timeout: 30000 });
    const viewer = page.getByTestId('lunar-terrain-viewer');
    await expect(viewer).toHaveAttribute('data-sky-registration', 'unavailable');
    await expect(page.getByText('Analyze a site to place Sun/Earth directions. No screen-fixed decorations.', { exact: true })).toBeVisible();
    const canvas = viewer.locator('canvas');
    await canvas.scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    const screenshot = await canvas.screenshot();
    const pixels = await page.evaluate(async data => {
      const image = new Image(); image.src = data; await image.decode();
      const raster = document.createElement('canvas');
      raster.width = image.width; raster.height = image.height;
      const context = raster.getContext('2d')!;
      context.drawImage(image, 0, 0);
      const rgba = context.getImageData(0, 0, raster.width, raster.height).data;
      let sun = 0, earth = 0, stars = 0;
      for (let y = 0; y < raster.height; y++) for (let x = 0; x < raster.width; x++) {
        const i = (y * raster.width + x) * 4;
        const [r, g, b] = [rgba[i], rgba[i + 1], rgba[i + 2]];
        if (x < raster.width * .25 && y > raster.height * .55 && r > 120 && r > g * 1.15) sun++;
        if (x > raster.width * .7 && y < raster.height * .5 && b > 70 && b > r * 1.4) earth++;
        if (x < raster.width * .12 && y > raster.height * .15 && y < raster.height * .5 && r > 110 && g > 110 && b > 110) stars++;
      }
      return { sun, earth, stars };
    }, `data:image/png;base64,${screenshot.toString('base64')}`);
    expect(pixels.sun).toBeLessThan(15);
    expect(pixels.earth).toBeLessThan(15);
    expect(pixels.stars).toBeGreaterThan(5);
    await page.screenshot({ path: `../.validation/registered-sky-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Close-up (2)', exact: true }).click();
    await page.waitForTimeout(1100);
    await expect(viewer).toHaveAttribute('data-sky-registration', 'unavailable');
    await expect(viewer).not.toHaveAttribute('data-sun-world-position', /./);
    await expect(viewer).not.toHaveAttribute('data-earth-world-position', /./);
    await expect(page.getByLabel('Latitude A', { exact: true })).toHaveValue('');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({ path: `../.validation/registered-closeup-${width}.png`, fullPage: true });
  });
}
