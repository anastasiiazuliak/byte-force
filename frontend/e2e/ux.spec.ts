import { test, expect } from '@playwright/test';
import partialFixture from '../../contracts/fixtures/analyze-partial.json' with { type: 'json' };

// These startup/control tests do not intercept scientific responses.
for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 1000 }]) {
  test(`exploratory controls and keyboard fit ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to site and time' })).toBeFocused();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Terrain View', exact: true }).click();
    await page.getByLabel('Exploratory patch', { exact: true }).selectOption('connecting-ridge');
    await expect(page.getByLabel('Latitude A', { exact: true })).toHaveValue('-89.45');
    await expect(page.getByLabel('Longitude A', { exact: true })).toHaveValue('-137.31');
    await page.getByRole('button', { name: 'Prepare patch comparison' }).click();
    await expect(page.getByLabel('Latitude B', { exact: true })).toHaveValue('-89.9');
    await expect(page.getByRole('button', { name: 'Compare scenarios', exact: true })).toBeEnabled();
    await page.getByLabel('Exploratory patch', { exact: true }).selectOption('near-de-gerlache');
    await expect(page.getByLabel('Latitude A', { exact: true })).toHaveValue('-88.7');
    await expect(page.getByLabel('Latitude B', { exact: true })).toHaveValue('-89.9');
    await page.getByLabel('Latitude A', { exact: true }).fill('-89');
    await expect(page.getByLabel('Exploratory patch', { exact: true })).toHaveValue('');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (viewport.width > 800) {
      const formPanel = page.locator('#site-time .panel-body');
      expect(await formPanel.evaluate(el => el.clientHeight <= Math.max(560, Math.min(innerHeight * .8, 900)) + 1 && el.scrollHeight > el.clientHeight)).toBe(true);
      await page.getByRole('button', { name: 'Compare scenarios', exact: true }).scrollIntoViewIfNeeded();
      await expect(page.getByRole('button', { name: 'Compare scenarios', exact: true })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Learn', exact: true }).click();
    await expect(page.locator('#learn')).toContainText('Unknown visibility is not zero visible time');
  });
}

// Layout-only intercepted data: not evidence of real NASA/DEM analysis.
for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1440, height: 1000 }]) {
  test(`synthetic post-analysis layout fits ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/api/v1/ephemeris**', route => route.fulfill({ status: 503, json: { error: { code: 'FIXTURE_ONLY', message: 'Layout test; no live ephemeris requested' } } }));
    await page.route('**/api/v1/analyze', route => {
      const input = route.request().postDataJSON();
      const result = {
        ...structuredClone(partialFixture), location: input.location, period: input.period,
        samples: Array.from({ length: 7 }, (_, i) => ({
          ...structuredClone(partialFixture.samples[0]),
          timeUtc: new Date(Date.parse(input.period.startUtc) + i * 600000).toISOString(),
        })),
        horizon: { points: Array.from({ length: 360 }, (_, azimuthDeg) => ({ azimuthDeg, elevationDeg: 5 })) },
      };
      result.quality.warnings.push(...Array.from({ length: 20 }, (_, i) => `Synthetic layout warning ${i + 1}: distant terrain and sampling uncertainty remain unknown.`));
      return route.fulfill({ json: result });
    });
    await page.goto('/'); await page.getByRole('button', { name: 'Terrain View', exact: true }).click();
    await page.getByLabel('Latitude A', { exact: true }).fill('-89.5');
    await page.getByLabel('Longitude A', { exact: true }).fill('25');
    await page.getByLabel('Start UTC A', { exact: true }).fill('2026-11-14T00:00');
    await page.getByLabel('End UTC A', { exact: true }).fill('2026-11-14T01:00');
    await page.getByLabel('Step minutes A', { exact: true }).fill('10');
    await page.getByRole('button', { name: 'Analyze site', exact: true }).click();
    const result = page.getByTestId('analysis-result');
    await expect(result).toContainText('SYNTHETIC FIXTURE (NOT NASA)');
    await expect(result).toContainText('far-field visibility unknown');
    await expect(result).toContainText('Visibility summary unavailable: terrain coverage or validation is insufficient to determine visible durations.');
    await expect(result).not.toContainText('Unknown (Unknown)');
    await expect(result.getByRole('img', { name: /Local sky compass for slot A/ })).toBeVisible();
    const warnings = result.locator('details').filter({ has: page.getByText(/Technical metadata & quality warnings/) });
    await expect(warnings).not.toHaveAttribute('open');
    await warnings.locator('summary').click();
    await expect(warnings.getByText(/Ephemeris:/)).toBeVisible();
    await expect(warnings).toContainText('DO NOT DISPLAY AS REAL SCIENCE');
    await warnings.locator('summary').click();
    await result.getByText('Samples & horizon (degrees, UTC)', { exact: true }).click();
    await expect(result.getByRole('img')).toHaveCount(3);
    // Measure the horizon's outer SVG, not its inner role=img group.
        const horizon = result.getByRole('group', { name: 'Terrain horizon and exact astronomical positions', exact: true });
        await expect(horizon).toBeVisible();
        for (const chart of [horizon, ...await result.locator('svg[role="img"]').all()]) {
      const fits = await chart.evaluate(svg => {
        const rect = svg.getBoundingClientRect();
        const parent = svg.parentElement!.getBoundingClientRect();
        const maxHeight = svg.getAttribute('role') === 'group' ? 400 : 230;
                return rect.width > 0 && rect.height > 0 && rect.height <= maxHeight && rect.left >= parent.left - 1 && rect.right <= parent.right + 1;
      });
      expect(fits).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const panel = page.locator('#analysis .panel-body');
    if (viewport.width > 800) {
      expect(await panel.evaluate(el => el.clientHeight <= Math.max(560, Math.min(innerHeight * .8, 900)) + 1 && el.scrollHeight > el.clientHeight)).toBe(true);
      await result.getByRole('img').last().scrollIntoViewIfNeeded();
      await expect(result.getByRole('img').last()).toBeVisible();
    } else {
      expect(await panel.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    }
    await page.getByRole('slider', { name: 'Selected UTC sample' }).fill('1');
    await expect(page.getByTestId('selected-utc')).toContainText('00:10:00');
  });
}
