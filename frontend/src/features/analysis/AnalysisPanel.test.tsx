// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import fixture from '../../../../contracts/fixtures/analyze-partial.json';
import type { AnalysisResponse } from '../../api/types';
import { AnalysisPanel } from './AnalysisPanel';
const analysis = fixture as AnalysisResponse;
const timeUtc = analysis.samples[0].timeUtc;
afterEach(cleanup);
it('separates evidence levels, collapses metadata and explains unavailable summary once', () => {
  render(<AnalysisPanel analysis={analysis} timeUtc={timeUtc}/>);
  for (const name of ['1. Astronomical Position', '2. Regional Terrain Assessment', '3. Confirmed Visibility']) expect(screen.getByRole('heading', { name })).toBeTruthy();
  expect(screen.getByTestId('analysis-result').textContent).not.toContain('Unknown (Unknown)');
  expect(screen.getAllByText(/Visibility summary unavailable:/)).toHaveLength(1);
  expect(screen.getByText(/Synthetic test data/).closest('details')).toBeNull();
  expect(screen.getByText(/Technical metadata & quality warnings/).closest('details')?.open).toBe(false);
  expect(screen.getByRole('img', { name: /Local sky compass for slot A/ })).toBeTruthy();
});
it('never promotes negative regional clearance into confirmed blockage', () => {
  const regional: AnalysisResponse = { ...analysis, horizon: { points: [{ azimuthDeg: 0, elevationDeg: 3 }] }, samples: [{ ...analysis.samples[0], sun: { ...analysis.samples[0].sun, clearanceDeg: -2 } }] };
  render(<AnalysisPanel analysis={regional} timeUtc={timeUtc} slot="B"/>);
  expect(screen.getByText('Sun: Unknown')).toBeTruthy(); expect(screen.queryByText('Sun: Blocked')).toBeNull();
  expect(screen.getByText(/blockage is not confirmed without validated sampling and error bounds/)).toBeTruthy();
  expect(screen.getByRole('img', { name: /Local sky compass for slot B/ })).toBeTruthy();
  expect(screen.getByRole('img', { name: 'Terrain horizon profile: azimuth 0 to 360 degrees' })).toBeTruthy();
});
it('offers exact sample values only on hover or focus and switches chart quantity', () => {
  render(<AnalysisPanel analysis={analysis} timeUtc={timeUtc}/>);
  expect(screen.queryByRole('tooltip')).toBeNull();
  const target = screen.getByRole('button', { name: /Inspect sample/ });
  fireEvent.focus(target); expect(screen.getByRole('tooltip').textContent).toContain('00:00:00 UTC · Sun 8.00° · Earth 4.00°');
  fireEvent.blur(target); expect(screen.queryByRole('tooltip')).toBeNull();
  fireEvent.change(screen.getByLabelText('Chart quantity'), { target: { value: 'clearance' } });
  expect(screen.getByRole('img', { name: 'Sun and Earth clearance over UTC period in degrees' })).toBeTruthy();
  fireEvent.mouseEnter(target); expect(screen.getByRole('tooltip').textContent).toContain('Sun Unknown · Earth Unknown');
  fireEvent.mouseLeave(target); expect(screen.queryByRole('tooltip')).toBeNull();
});
it('does not interpolate a shared UTC between samples and suggests manual longer analysis for two samples', () => {
  const two = { ...analysis, samples: [...analysis.samples, { ...analysis.samples[0], timeUtc: '2026-11-14T01:00:00Z' }] };
  render(<AnalysisPanel analysis={two} timeUtc="2026-11-14T00:30:00Z"/>);
  expect(screen.getByText(/No exact sample/)).toBeTruthy();
  expect(screen.getByText(/manually choose a 12–24 h period/)).toBeTruthy();
  expect(screen.getByText('Sun: Unknown')).toBeTruthy();
});
it('uses API visibility even when clearance disagrees', () => {
  const confirmed = { ...analysis, samples: [{ ...analysis.samples[0], sun: { ...analysis.samples[0].sun, visible: false, clearanceDeg: 5 } }] };
  render(<AnalysisPanel analysis={confirmed} timeUtc={timeUtc}/>);
  expect(screen.getByText('Sun: Blocked')).toBeTruthy();
});
