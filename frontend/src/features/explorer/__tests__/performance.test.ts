import { describe, it, expect } from 'vitest';
import {
  QUALITY_PRESETS,
  resolveAutoQuality,
  FrameRateTracker,
  prefersReducedMotion,
} from '../performance/performanceMonitor';

describe('Performance Monitoring and Quality Tiers (QA-02)', () => {
  it('provides sensible quality presets for all tiers', () => {
    expect(QUALITY_PRESETS.high.maxDpr).toBe(2.0);
    expect(QUALITY_PRESETS.high.shadowMapSize).toBe(2048);
    expect(QUALITY_PRESETS.medium.maxDpr).toBe(1.5);
    expect(QUALITY_PRESETS.low.maxDpr).toBe(1.0);
    expect(QUALITY_PRESETS.low.shadowMapSize).toBe(512);
  });

  it('resolves auto quality cleanly based on environment', () => {
    const quality = resolveAutoQuality();
    expect(quality).toBeDefined();
    expect(quality.maxDpr).toBeGreaterThanOrEqual(1.0);
  });

  it('tracks frame rates and average frame time smoothly', () => {
    const tracker = new FrameRateTracker();
    expect(tracker.getFps()).toBe(60);
    expect(tracker.getAverageFrameTimeMs()).toBeGreaterThan(0);
  });

  it('detects prefersReducedMotion setting safely in node/browser', () => {
    expect(typeof prefersReducedMotion()).toBe('boolean');
  });
});
