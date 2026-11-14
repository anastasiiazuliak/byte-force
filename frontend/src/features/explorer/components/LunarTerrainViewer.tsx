import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
  useEffect,
} from 'react';
import * as THREE from 'three';
import type {
  LunarTerrainViewerProps,
  TerrainSceneCommands,
  SceneStatus,
  CameraPreset,
} from '../types';
import { SceneCanvas } from './SceneCanvas';
import { ViewerOverlay } from './ViewerOverlay';
import { SiteSlotSelector } from './SiteSlotSelector';
import { WebGLFallback } from './WebGLFallback';
import { LoadingSkeleton } from './LoadingSkeleton';
import { checkWebGLSupport } from '../scene/webgl';
import {
  CAMERA_PRESETS,
  DEFAULT_CAMERA_PRESET,
  getFlyToTransform,
} from '../scene/camera';
import type { CameraAnimationState } from '../scene/camera';
import type { SiteSlot } from '../types';
import styles from '../styles/explorer.module.css';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class CanvasErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: (error?: Error) => React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; fallback: (error?: Error) => React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('CanvasErrorBoundary caught WebGL/Render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback(this.state.error);
    }
    return this.props.children;
  }
}

export const LunarTerrainViewer = forwardRef<
  TerrainSceneCommands,
  LunarTerrainViewerProps
>(function LunarTerrainViewer(
  {
    metadata,
    selectedA,
    selectedB,
    timeUtc,
    sunDirectionMoonFixed,
    onSelectSite,
    onStatus,
    className,
    style,
    enableKeyboardControls = true,
    showOverlayControls = true,
    initialPresetId = 'oblique',
    onCameraPresetChange,
    testId = 'lunar-terrain-viewer',
  },
  ref
) {
  const [sceneStatus, setSceneStatus] = useState<SceneStatus>('loading');
  const [activeSlot, setActiveSlot] = useState<SiteSlot>('A');
  const [outOfBoundsError, setOutOfBoundsError] = useState<string | null>(null);
  const [currentPreset, setCurrentPreset] = useState<CameraPreset>(
    CAMERA_PRESETS[initialPresetId] || DEFAULT_CAMERA_PRESET
  );
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null);
  const [webglError, setWebglError] = useState<string | undefined>(undefined);

  const animationStateRef = useRef<CameraAnimationState | null>(null);
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    const check = checkWebGLSupport();
    setWebglSupported(check.supported);
    if (!check.supported) {
      setWebglError(check.error);
      setSceneStatus('error');
      onStatus?.('error');
    }
  }, [onStatus]);

  const handleStatusChange = useCallback(
    (newStatus: SceneStatus) => {
      setSceneStatus(newStatus);
      onStatus?.(newStatus);
    },
    [onStatus]
  );

  const triggerAnimationTo = useCallback(
    (targetPos: [number, number, number], targetLookAt: [number, number, number], durationMs: number = 1000) => {
      const controls = controlsRef.current;
      if (!controls) return;

      const camera = controls.object as THREE.Camera;
      const curPos = camera ? camera.position.clone() : new THREE.Vector3(...DEFAULT_CAMERA_PRESET.position);
      const curLook = controls.target ? controls.target.clone() : new THREE.Vector3(...DEFAULT_CAMERA_PRESET.target);

      animationStateRef.current = {
        isAnimating: true,
        startPosition: curPos,
        targetPosition: new THREE.Vector3(...targetPos),
        startLookAt: curLook,
        targetLookAt: new THREE.Vector3(...targetLookAt),
        progress: 0,
        durationMs,
        startTime: performance.now(),
      };
    },
    []
  );

  const reset = useCallback(() => {
    const preset = CAMERA_PRESETS.oblique;
    triggerAnimationTo(preset.position, preset.target, 900);
    setCurrentPreset(preset);
    onCameraPresetChange?.(preset);
  }, [triggerAnimationTo, onCameraPresetChange]);

  const setTopDown = useCallback(() => {
    const preset = CAMERA_PRESETS.topDown;
    triggerAnimationTo(preset.position, preset.target, 900);
    setCurrentPreset(preset);
    onCameraPresetChange?.(preset);
  }, [triggerAnimationTo, onCameraPresetChange]);

  const fitRegion = useCallback(() => {
    const preset = CAMERA_PRESETS.fitRegion;
    triggerAnimationTo(preset.position, preset.target, 1100);
    setCurrentPreset(preset);
    onCameraPresetChange?.(preset);
  }, [triggerAnimationTo, onCameraPresetChange]);

  const flyTo = useCallback(
    (location: { latitude: number; longitude: number }, elevationM: number = 0) => {
      const transform = getFlyToTransform(location, elevationM);
      triggerAnimationTo(transform.position, transform.target, 1200);
    },
    [triggerAnimationTo]
  );

  useImperativeHandle(
    ref,
    () => ({
      flyTo: (location) => flyTo(location),
      reset,
      setTopDown,
      fitRegion,
    }),
    [flyTo, reset, setTopDown, fitRegion]
  );

  if (webglSupported === false) {
    return (
      <div
        className={`${styles.viewerWrapper} ${className || ''}`}
        style={style}
        data-testid={testId}
      >
        <WebGLFallback
          error={webglError}
          onRetry={() => {
            const check = checkWebGLSupport();
            setWebglSupported(check.supported);
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`${styles.viewerWrapper} ${className || ''}`}
      style={style}
      data-testid={testId}
      tabIndex={0}
      role="region"
      aria-label="Interactive 3D Lunar South Pole Terrain Viewer"
    >
      <CanvasErrorBoundary
        fallback={(err) => (
          <WebGLFallback
            error={err?.message || 'WebGL Context Lost'}
            onRetry={() => {
              setWebglSupported(null);
              setTimeout(() => {
                const check = checkWebGLSupport();
                setWebglSupported(check.supported);
              }, 100);
            }}
          />
        )}
      >
        <SceneCanvas
          metadata={metadata}
          selectedA={selectedA}
          selectedB={selectedB}
          activeSlot={activeSlot}
          timeUtc={timeUtc}
          sunDirectionMoonFixed={sunDirectionMoonFixed}
          onStatus={handleStatusChange}
          onSelectSite={(site) => {
            setOutOfBoundsError(null);
            onSelectSite?.(site);
          }}
          onOutOfBounds={(err) => setOutOfBoundsError(err)}
          onPresetChange={(preset) => {
            setCurrentPreset(preset);
            onCameraPresetChange?.(preset);
          }}
          enableKeyboard={enableKeyboardControls}
          animationStateRef={animationStateRef}
          controlsRef={controlsRef}
        />
      </CanvasErrorBoundary>

      {sceneStatus === 'loading' && <LoadingSkeleton />}

      {showOverlayControls && (
        <SiteSlotSelector
          activeSlot={activeSlot}
          onSlotChange={setActiveSlot}
          selectedA={selectedA}
          selectedB={selectedB}
          outOfBoundsError={outOfBoundsError}
          onDismissError={() => setOutOfBoundsError(null)}
          onFlyToSite={(slot) => {
            const coords = slot === 'A' ? selectedA : selectedB;
            if (coords) {
              flyTo(coords);
            }
          }}
        />
      )}

      {showOverlayControls && (
        <ViewerOverlay
          status={sceneStatus}
          currentPreset={currentPreset}
          isHorizonsLighting={Boolean(sunDirectionMoonFixed)}
          onReset={reset}
          onTopDown={setTopDown}
          onFitRegion={fitRegion}
          onSelectPreset={(presetId) => {
            const preset = CAMERA_PRESETS[presetId];
            if (preset) {
              triggerAnimationTo(preset.position, preset.target, 1000);
              setCurrentPreset(preset);
              onCameraPresetChange?.(preset);
            }
          }}
        />
      )}
    </div>
  );
});
