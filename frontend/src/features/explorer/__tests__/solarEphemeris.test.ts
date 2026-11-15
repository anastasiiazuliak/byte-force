import { describe, it, expect } from 'vitest';
import {
  slerpUnitVectors,
  vectorToPolarHorizontal,
  interpolateEphemeris,
} from '../lighting/solarEphemeris';
import type { EphemerisSample } from '../../../api/types';

describe('Solar Ephemeris and Lighting Interpolation', () => {
  it('interpolates unit vectors with slerp without magnitude loss', () => {
    const v0: [number, number, number] = [1, 0, 0];
    const v1: [number, number, number] = [0, 1, 0];

    const mid = slerpUnitVectors(v0, v1, 0.5);
    expect(mid[0]).toBeCloseTo(Math.SQRT1_2, 3);
    expect(mid[1]).toBeCloseTo(Math.SQRT1_2, 3);
    expect(mid[2]).toBeCloseTo(0, 3);

    const length = Math.hypot(mid[0], mid[1], mid[2]);
    expect(length).toBeCloseTo(1.0, 4);
  });

  it('converts Moon-fixed vectors to horizontal coordinates at the South Pole', () => {
    // Vector pointing along +X (0° lon), slightly above horizon (negative z)
    // Low grazing sun at ~2.86° elevation
    const sunVec: [number, number, number] = [1.0, 0.0, -0.05];
    const horiz = vectorToPolarHorizontal(sunVec);

    expect(horiz.elevationDeg).toBeGreaterThan(0);
    expect(horiz.elevationDeg).toBeLessThan(5);
    expect(horiz.azimuthDeg).toBeCloseTo(0, 1);
  });

  it('interpolates between discrete ephemeris samples smoothly without HTTP calls', () => {
    const samples: EphemerisSample[] = [
      {
        timeUtc: '2026-11-14T00:00:00Z',
        sunDirection: [1, 0, -0.03],
        earthDirection: [-0.8, 0.6, -0.08],
      },
      {
        timeUtc: '2026-11-14T02:00:00Z',
        sunDirection: [0.99, 0.1, -0.03],
        earthDirection: [-0.82, 0.58, -0.08],
      },
    ];

    // Midpoint at 01:00:00Z
    const interp = interpolateEphemeris(samples, '2026-11-14T01:00:00Z');
    expect(interp).not.toBeNull();
    expect(interp?.isInterpolated).toBe(true);
    expect(interp?.sunDirection[0]).toBeGreaterThan(0.99);
    expect(interp?.sunDirection[1]).toBeGreaterThan(0);
    expect(interp?.sunDirection[1]).toBeLessThan(0.1);
  });
});
