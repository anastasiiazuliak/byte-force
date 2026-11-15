import { describe, expect, it } from 'vitest';
import { ignoreSkyRaycast, makeStarData } from './skyVisuals';

describe('illustrative sky distribution', () => {
  it('is deterministic, dense and distributed on the unit sky sphere', () => {
    const data = makeStarData();
    expect(data.position.length).toBe(26000 * 3);
    expect(makeStarData().position).toEqual(data.position);
    let positive = 0;
    for (let i = 0; i < data.position.length; i += 3) {
      expect(Math.hypot(data.position[i], data.position[i + 1], data.position[i + 2])).toBeCloseTo(1, 6);
      if (data.position[i + 2] > 0) positive++;
    }
    expect(positive / 26000).toBeGreaterThan(0.47);
    expect(positive / 26000).toBeLessThan(0.53);
  });

  it('keeps stars visible but bounds the bright large-star population', () => {
    const { appearance } = makeStarData();
    let bright = 0;
    for (let i = 0; i < appearance.length; i += 3) {
      expect(appearance[i]).toBeGreaterThanOrEqual(1.5);
      expect(appearance[i]).toBeLessThanOrEqual(4.5);
      expect(appearance[i + 1]).toBeGreaterThanOrEqual(0.35);
      expect(appearance[i + 1]).toBeLessThanOrEqual(1);
      expect(appearance[i + 2]).toBeGreaterThanOrEqual(0);
      expect(appearance[i + 2]).toBeLessThanOrEqual(1);
      if (appearance[i] > 3) bright++;
    }
    expect(bright / 26000).toBeGreaterThan(0.015);
    expect(bright / 26000).toBeLessThan(0.035);
  });

  it('does not add intersections to scientific picking', () => {
    const intersections: unknown[] = [];
    // Three calls raycast with a raycaster and an intersections array.
    (ignoreSkyRaycast as (...args: unknown[]) => void)({}, intersections);
    expect(intersections).toEqual([]);
  });
});
