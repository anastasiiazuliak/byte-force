import { test, expect } from '@playwright/test';
import fixture from '../../contracts/fixtures/analyze-partial.json' with { type: 'json' };

for (const width of [390, 1440]) {
  test(`fixture date comparison preserves drafts and uses elapsed UTC with regional bins at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const errors: string[] = [], failures: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => failures.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`));
    let comparisons = 0, analyses = 0;
    page.on('request', request => { if (request.url().endsWith('/api/v1/analyze')) analyses++; });
    await page.route('**/api/v1/compare', route => {
      comparisons++;
      const input = route.request().postDataJSON();
      expect(input.scenarios.map((s: any) => s.location)).toEqual([
        { latitude: -89.5, longitude: 25 }, { latitude: -89.5, longitude: 25 },
      ]);
      return route.fulfill({ json: {
        scenarios: input.scenarios.map((s: any) => ({ id: s.id, analysis: {
          ...structuredClone(fixture), location: s.location, period: s.period,
          horizon: { points: Array.from({ length: 360 }, (_, azimuthDeg) => ({ azimuthDeg, elevationDeg: 5 })) },
          samples: [2, 2, -2].map((clearanceDeg, i) => ({
            ...structuredClone(fixture.samples[0]),
            timeUtc: new Date(Date.parse(s.period.startUtc) + i * 1800000).toISOString(),
            sun: { ...fixture.samples[0].sun, azimuthDeg: 90, elevationDeg: 5 + clearanceDeg, horizonDeg: 5, clearanceDeg, visible: null },
            earth: { ...fixture.samples[0].earth, azimuthDeg: 180, elevationDeg: 8, horizonDeg: 5, clearanceDeg: 3, visible: null },
          })),
        } })), differences: { sunVisibleHours: null, earthVisibleHours: null, bothVisibleHours: null },
      } });
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    for (const slot of ['A', 'B']) {
      const date = slot === 'A' ? '2026-11-14' : '2026-11-15';
      await page.getByLabel(`Latitude ${slot}`, { exact: true }).fill(slot === 'A' ? '-89.5' : '-88');
      await page.getByLabel(`Longitude ${slot}`, { exact: true }).fill(slot === 'A' ? '25' : '45');
      await page.getByLabel(`Start UTC ${slot}`, { exact: true }).fill(`${date}T00:00`);
      await page.getByLabel(`End UTC ${slot}`, { exact: true }).fill(`${date}T01:00`);
      await page.getByLabel(`Step minutes ${slot}`, { exact: true }).fill('30');
    }
    await page.getByRole('button', { name: 'Compare dates at Site A', exact: true }).click();
    await expect(page.getByLabel('Latitude B', { exact: true })).toHaveValue('-89.5');
    await expect(page.getByLabel('Longitude B', { exact: true })).toHaveValue('25');
    await expect(page.getByLabel('Start UTC B', { exact: true })).toHaveValue('2026-11-15T00:00');
    await expect(page.getByLabel('End UTC B', { exact: true })).toHaveValue('2026-11-15T01:00');
    expect(comparisons).toBe(0); expect(analyses).toBe(0);
    await page.getByRole('button', { name: 'Compare scenarios', exact: true }).click();
    const results = page.getByTestId('analysis-result');
    await expect(results).toHaveCount(2);
    const bins = results.first().getByRole('region', { name: 'Sun regional bins', exact: true });
    await expect(bins).toContainText('Sample-bin estimated above: 0.5 h (~50% of selected period)');
    await expect(bins).toContainText('Unknown: 0.5 h');
    await bins.getByText('UTC bins and transition brackets (2)', { exact: true }).click();
    await expect(bins).toContainText('transition uncertain throughout this bracket');
    await page.getByRole('slider', { name: 'Selected UTC sample' }).fill('1');
    await expect(page.getByTestId('selected-utc')).toHaveText('2026-11-14T00:30:00.000Z');
    await expect(results.nth(1).locator('.analysis-time time')).toHaveAttribute('datetime', '2026-11-15T00:30:00.000Z');
    await expect(results.nth(1).getByTestId('sun-horizon-marker')).toHaveCount(1);
    await expect(page.getByTestId('comparison-differences')).toContainText('Unknown');
    expect(comparisons).toBe(1); expect(analyses).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await results.first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`date-comparison-${width}.png`), fullPage: true });
        await results.first().getByRole('group', { name: 'Terrain horizon and exact astronomical positions', exact: true })
          .screenshot({ path: testInfo.outputPath(`horizon-${width}.png`) });
    await testInfo.attach('browser-diagnostics', { body: JSON.stringify({ errors, failures, comparisons, analyses }), contentType: 'application/json' });
    expect(errors).toEqual([]); expect(failures).toEqual([]);
  });
}
