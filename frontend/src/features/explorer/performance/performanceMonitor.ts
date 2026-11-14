export type QualityTier = 'high' | 'medium' | 'low' | 'auto';

export interface QualitySettings {
  tier: QualityTier;
  maxDpr: number;
  shadowMapSize: number;
  antialias: boolean;
  enableSkirts: boolean;
  segments: number;
  powerPreference: 'high-performance' | 'default' | 'low-power';
}

export const QUALITY_PRESETS: Record<'high' | 'medium' | 'low', QualitySettings> = {
  high: {
    tier: 'high',
    maxDpr: 2.0,
    shadowMapSize: 2048,
    antialias: true,
    enableSkirts: true,
    segments: 160,
    powerPreference: 'high-performance',
  },
  medium: {
    tier: 'medium',
    maxDpr: 1.5,
    shadowMapSize: 1024,
    antialias: true,
    enableSkirts: true,
    segments: 100,
    powerPreference: 'default',
  },
  low: {
    tier: 'low',
    maxDpr: 1.0,
    shadowMapSize: 512,
    antialias: false,
    enableSkirts: false,
    segments: 60,
    powerPreference: 'low-power',
  },
};

/**
 * Detects whether the user has requested reduced motion in their OS / browser.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Resolves automatic quality tier based on device hardware characteristics.
 */
export function resolveAutoQuality(): QualitySettings {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return QUALITY_PRESETS.medium;
  }

  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const hardwareConcurrency = navigator.hardwareConcurrency || 4;

  if (isMobile || hardwareConcurrency <= 2) {
    return QUALITY_PRESETS.medium;
  }

  return QUALITY_PRESETS.high;
}

/**
 * Real-time FPS and Frame Duration Tracker.
 */
export class FrameRateTracker {
  private frameCount = 0;
  private lastTime = performance.now();
  private currentFps = 60;
  private frameTimes: number[] = [];

  public update(): number {
    this.frameCount++;
    const now = performance.now();
    const delta = now - this.lastTime;

    this.frameTimes.push(delta);
    if (this.frameTimes.length > 60) {
      this.frameTimes.shift();
    }

    if (delta >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / delta);
      this.frameCount = 0;
      this.lastTime = now;
    }

    return this.currentFps;
  }

  public getFps(): number {
    return this.currentFps;
  }

  public getAverageFrameTimeMs(): number {
    if (this.frameTimes.length === 0) return 16.6;
    const sum = this.frameTimes.reduce((acc, v) => acc + v, 0);
    return Number((sum / this.frameTimes.length).toFixed(1));
  }
}
