import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
  useEffect,
} from 'react';
import * as THREE from 'three';
import { GLOBE_CENTER, globeCloseupPosition, globeFitDistance, globeOverviewPosition } from '../scene/polarGlobe';
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
import { terrainAssetKey } from '../scene/metadata';
import { sampleTerrainSurface, type TerrainSurface } from '../scene/surface';
import { checkWebGLSupport } from '../scene/webgl';
import { skyBodyPosition } from '../scene/skyDirections';
import {
  CAMERA_PRESETS,
  DEFAULT_CAMERA_PRESET,
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
    globe = false,
    selectedA,
    selectedB,
    timeUtc,
    sunDirectionScene,
    sunlightLabel,
    skyDirections,
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
  const surfaceRef = useRef<TerrainSurface | null>(null);
  const handleSurface = useCallback((surface: TerrainSurface | null) => { surfaceRef.current = surface; }, []);
  const finiteSolar = sunDirectionScene?.length === 3 && sunDirectionScene.every(Number.isFinite) && Math.hypot(...sunDirectionScene) > 0;
  const diagnostics = {
    'data-sunlight-source': finiteSolar ? 'horizons-local' : 'illustrative',
    'data-solar-direction': finiteSolar ? JSON.stringify(sunDirectionScene) : undefined,
    'data-time-utc': timeUtc ?? undefined,
    'data-selected-asset-key': terrainAssetKey(metadata) ?? undefined,
    'data-sky-registration': skyDirections ? 'measured-site-directions' : 'unavailable',
    'data-sky-site': skyDirections?.slot,
    'data-sky-origin': skyDirections ? JSON.stringify(skyDirections.origin) : undefined,
    'data-sky-time-utc': skyDirections?.timeUtc,
    'data-sun-world-position': skyDirections ? JSON.stringify(skyBodyPosition(skyDirections.origin, skyDirections.sun)) : undefined,
    'data-earth-world-position': skyDirections ? JSON.stringify(skyBodyPosition(skyDirections.origin, skyDirections.earth)) : undefined,
  };
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

  const fitTerrain = useCallback((topDown = false) => {
    const surface = surfaceRef.current;
    const controls = controlsRef.current;
    if (!controls) return;
    const camera = controls.object as THREE.PerspectiveCamera;
    if (globe) {
      triggerAnimationTo(globeOverviewPosition(globeFitDistance(camera.fov, camera.aspect)).toArray(), GLOBE_CENTER, 900);
      return;
    }
    if (!surface) return;
    const box = new THREE.Box3().setFromObject(surface.group);
    const center = box.getCenter(new THREE.Vector3());
    const extent = box.getSize(new THREE.Vector3());
    const radius = metadata?.assets.demoMeshUrl?.match(/\/(overview|globe)\/terrain\.glb$/)
      ? Math.hypot(Math.max(extent.x, extent.z), extent.y) / 2 : extent.length() / 2;
    const angle = Math.min(camera.fov * Math.PI / 360, Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect));
    const offset = new THREE.Vector3(0, topDown ? 1 : 0.36, topDown ? 0.001 : 0.933).normalize().multiplyScalar(radius / Math.sin(angle) * 1.1);
    triggerAnimationTo(center.clone().add(offset).toArray(), center.toArray(), 900);
  }, [triggerAnimationTo, metadata?.assets.demoMeshUrl, globe]);
  const reset = useCallback(() => fitTerrain(), [fitTerrain]);
  const fitRegion = reset;
  const setTopDown = useCallback(() => fitTerrain(true), [fitTerrain]);

  const flyTo = useCallback(
    (location: { latitude: number; longitude: number }) => {
      const point = sampleTerrainSurface(metadata, surfaceRef.current, location);
      if (!point) return;
      if (globe) triggerAnimationTo(globeCloseupPosition(point).toArray(), GLOBE_CENTER, 1200);
      else triggerAnimationTo([point.x, point.y + 4000, point.z + 6000], [point.x, point.y, point.z], 1200);
    },
    [triggerAnimationTo, metadata, globe]
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
        {...diagnostics}
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
        {...diagnostics}
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
          key={globe ? 'globe' : 'terrain'}
          globe={globe}
          onFitCamera={fitTerrain}
          metadata={metadata}
          selectedA={selectedA}
          selectedB={selectedB}
          activeSlot={activeSlot}
          timeUtc={timeUtc}
          sunDirectionScene={sunDirectionScene}
          skyDirections={skyDirections}
          onStatus={handleStatusChange}
          onSurfaceReady={handleSurface}
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
          isHorizonsLighting={Boolean(sunDirectionScene)}
          sunlightLabel={sunlightLabel}
          onReset={reset}
          onTopDown={setTopDown}
          onFitRegion={fitRegion}
          onSelectPreset={(presetId) => {
            const preset = CAMERA_PRESETS[presetId];
            if (preset) {
              if (presetId === 'shackleton') {
                if (selectedA) flyTo(selectedA);
                else if (controlsRef.current) {
                  const c = controlsRef.current;
                  triggerAnimationTo(c.target.clone().add(c.object.position.clone().sub(c.target).multiplyScalar(0.25)).toArray(), c.target.toArray());
                }
              } else fitTerrain(presetId === 'topDown');
              setCurrentPreset(preset);
              onCameraPresetChange?.(preset);
            }
          }}
        />
      )}
    </div>
  );
});
