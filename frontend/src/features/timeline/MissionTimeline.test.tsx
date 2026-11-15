// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { AnalysisResponse } from '../../api/types';
import fixture from '../../../../contracts/fixtures/analyze-partial.json';
import { MissionTimeline } from './MissionTimeline';

afterEach(cleanup);
function analysis(): AnalysisResponse {
  const a = structuredClone(fixture) as AnalysisResponse;
  a.period = { startUtc: '2028-04-15T00:00:00Z', endUtc: '2028-04-15T02:00:00Z', stepMinutes: 60 };
  a.horizon = { points: [0, 5, 10].map(azimuthDeg => ({ azimuthDeg, elevationDeg: 1 })) };
  a.samples = [0, 1, 2].map(hour => ({ timeUtc: `2028-04-15T0${hour}:00:00Z`,
    sun: { azimuthDeg: 5, elevationDeg: 2, horizonDeg: 1, clearanceDeg: hour === 2 ? -1 : 1, visible: null },
    earth: { azimuthDeg: 5, elevationDeg: 2, horizonDeg: 1, clearanceDeg: 1, visible: null } }));
  return a;
}
it('renders regional tracks and selects a UTC bin without promoting API visibility', () => {
  const a = analysis(), onTime = vi.fn();
  render(<MissionTimeline analyses={[a]} timeUtc={a.samples[1].timeUtc} onTime={onTime} />);
  const buttons = screen.getAllByRole('button', { name: /2028-04-15T01:00:00.000Z.*transition-uncertain/ });
  expect(buttons[0].getAttribute('aria-current')).toBe('time');
  fireEvent.click(buttons[0]);
  expect(onTime).toHaveBeenCalledWith('2028-04-15T01:00:00.000Z');
  expect(screen.getAllByText(/Terrain visibility unknown/)).toHaveLength(2);
  expect(screen.getByText(/short events may be missed/)).toBeTruthy();
  expect(a.summary.sunVisibleHours).toBeNull();
  expect(a.samples.every(s => s.sun.visible === null)).toBe(true);
});
it('shows unknown full-period bins even with no samples', () => {
  const a = analysis(); a.samples = [];
  render(<MissionTimeline analyses={[a]} timeUtc={a.period.startUtc} onTime={vi.fn()} />);
  expect(screen.getAllByText(/Unknown: 2 h/)).toHaveLength(3);
  expect(screen.getByRole('button', { name: 'Play' }).hasAttribute('disabled')).toBe(true);
  expect(screen.getAllByRole('button', { name: /missing|gap/ })).toHaveLength(3);
});
