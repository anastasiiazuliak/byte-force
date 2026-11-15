// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import fixture from '../../../../contracts/fixtures/analyze-partial.json';
import type { AnalysisResponse, HorizonProfile } from '../../api/types';
import { AnalysisPanel } from './AnalysisPanel';
import { HorizonProfileChart, horizonGeometry } from './HorizonProfileChart';

const analysis = fixture as AnalysisResponse;
const sample = analysis.samples[0];
const profile = (azimuths: number[]): HorizonProfile => ({ points: azimuths.map(azimuthDeg => ({ azimuthDeg, elevationDeg: 3 })) });
afterEach(cleanup);

it('plots fixture azimuth/elevation at known axis positions, includes zero and adapts to negative altitudes', () => {
  const selected = { ...sample, sun: { ...sample.sun, azimuthDeg: 90, elevationDeg: 8 }, earth: { ...sample.earth, azimuthDeg: 270, elevationDeg: -4 } };
  const geometry = horizonGeometry(profile([0, 5, 10]), selected);
  expect(geometry.x(0)).toBe(54); expect(geometry.x(360)).toBe(666);
  expect(geometry.min).toBeLessThan(-4); expect(geometry.max).toBeGreaterThan(8);
  render(<HorizonProfileChart profile={profile([0, 5, 10])} sample={selected} timeUtc={sample.timeUtc}/>);
  expect(screen.getByTestId('sun-horizon-marker').getAttribute('cx')).toBe('207');
  expect(Number(screen.getByTestId('sun-horizon-marker').getAttribute('cy'))).toBeCloseTo(geometry.y(8));
  expect(screen.getByTestId('earth-horizon-marker').getAttribute('d')).toContain('M513 ');
  expect(screen.getByRole('img', { name: 'Terrain horizon profile: azimuth 0 to 360 degrees' }).closest('details')).toBeNull();
});

it('breaks missing azimuth and NoData segments, keeps sparse points isolated', () => {
  const missing = horizonGeometry(profile([0, 5, 10, 25, 30]));
  expect(missing.segments.map(s => s.map(p => p.azimuthDeg))).toEqual([[0, 5, 10], [25, 30]]);
  const noData = profile([0, 5, 10, 15, 20]);
  noData.points[2].elevationDeg = null as unknown as number;
  expect(horizonGeometry(noData).segments.map(s => s.map(p => p.azimuthDeg))).toEqual([[0, 5], [15, 20]]);
  expect(horizonGeometry(profile([0, 90, 180, 270])).segments.every(s => s.length === 1)).toBe(true);
  expect(horizonGeometry(profile([0, 5])).segments.every(s => s.length === 1)).toBe(true);
});

it('closes the cyclic seam only with repeated fine spacing and valid neighboring elevations', () => {
  expect(horizonGeometry(profile([0, 5, 10, 355])).segments.some(s => s.length === 2 && s[1].azimuthDeg === 360)).toBe(true);
  expect(horizonGeometry(profile([5, 10, 15, 360])).segments.some(s => s.length === 2 && s[0].azimuthDeg === 0)).toBe(true);
  const completeNeighbors = profile([2, 7, 12, 357]);
  const segments = horizonGeometry(completeNeighbors).segments;
  expect(segments.some(s => s.length === 2 && s[1].azimuthDeg === 360)).toBe(true);
  expect(segments.some(s => s.length === 2 && s[0].azimuthDeg === 0)).toBe(true);
  expect(horizonGeometry(profile([20, 25, 30, 340])).segments.some(s => s.some(p => p.azimuthDeg === 360))).toBe(false);
  completeNeighbors.points[3].elevationDeg = Number.NaN;
  expect(horizonGeometry(completeNeighbors).segments.some(s => s.some(p => p.azimuthDeg === 360))).toBe(false);
});

it('shows cached values without null-to-zero or visibility inference on hover, focus, click and keyboard', () => {
  render(<HorizonProfileChart profile={null} sample={{ ...sample, sun: { ...sample.sun, horizonDeg: null, clearanceDeg: null, visible: false } }} timeUtc={sample.timeUtc}/>);
  expect(screen.getByText(/Terrain horizon unavailable/)).toBeTruthy();
  const marker = screen.getByRole('button', { name: 'Inspect Sun horizon position' });
  expect(marker.getAttribute('tabindex')).toBe('0');
  expect(screen.queryByRole('tooltip')).toBeNull();
  fireEvent.focus(marker);
  expect(screen.getByRole('tooltip').textContent).toContain('horizon Unknown · clearance Unknown');
  expect(screen.getByRole('tooltip').textContent).toContain(`azimuth ${sample.sun.azimuthDeg.toFixed(2)}°`);
  expect(screen.getByRole('tooltip').textContent).not.toMatch(/Blocked|Visible|false/);
  expect(marker.getAttribute('aria-describedby')).toBe(screen.getByRole('tooltip').id);
  fireEvent.keyDown(marker, { key: 'Escape' }); expect(screen.queryByRole('tooltip')).toBeNull();
  fireEvent.keyDown(marker, { key: 'Enter' }); expect(screen.getByRole('tooltip')).toBeTruthy();
  fireEvent.blur(marker); expect(screen.queryByRole('tooltip')).toBeNull();
  fireEvent.keyDown(marker, { key: ' ' }); expect(screen.getByRole('tooltip')).toBeTruthy();
  fireEvent.mouseLeave(marker); fireEvent.mouseEnter(marker); expect(screen.getByRole('tooltip')).toBeTruthy();
  fireEvent.mouseLeave(marker); fireEvent.click(marker); expect(screen.getByRole('tooltip')).toBeTruthy();
});

it('moves markers only to the exact selected cached UTC and clears stale tooltips', () => {
  const later = { ...sample, timeUtc: '2026-11-14T01:00:00Z', sun: { ...sample.sun, azimuthDeg: 180, elevationDeg: -2 } };
  const data = { ...analysis, samples: [sample, later] };
  const { rerender } = render(<AnalysisPanel analysis={data} timeUtc={sample.timeUtc}/>);
  fireEvent.focus(screen.getByRole('button', { name: 'Inspect Sun horizon position' }));
  expect(screen.getByRole('tooltip')).toBeTruthy();
  rerender(<AnalysisPanel analysis={data} timeUtc={later.timeUtc}/>);
  expect(screen.queryByRole('tooltip')).toBeNull();
  expect(screen.getByTestId('sun-horizon-marker').getAttribute('cx')).toBe('360');
  fireEvent.click(screen.getByRole('button', { name: 'Inspect Sun horizon position' }));
  expect(screen.getByRole('tooltip').textContent).toContain('01:00:00 UTC');
  expect(screen.getByRole('tooltip').textContent).toContain('elevation -2.00°');
  rerender(<AnalysisPanel analysis={data} timeUtc="2026-11-14T00:30:00Z"/>);
  expect(screen.queryByTestId('sun-horizon-marker')).toBeNull();
  expect(screen.queryByTestId('earth-horizon-marker')).toBeNull();
});

it('omits invalid astronomical markers instead of plotting null as zero', () => {
  render(<HorizonProfileChart profile={null} sample={{ ...sample, sun: { ...sample.sun, elevationDeg: null as unknown as number }, earth: { ...sample.earth, azimuthDeg: Number.NaN } }} timeUtc={sample.timeUtc}/>);
  expect(screen.queryByRole('button')).toBeNull();
});
