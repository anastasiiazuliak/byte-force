import React, { useRef, useCallback, useMemo, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Lighting } from './Lighting';
import { TerrainMesh } from './TerrainMesh';
import { SceneControls } from './SceneControls';
import { SiteMarkers } from './SiteMarkers';
import { DEFAULT_CAMERA_PRESET } from '../scene/camera';
import type { CameraAnimationState } from '../scene/camera';
import type { CameraPreset, SceneStatus, SceneSelectedSite, SiteSlot } from '../types';
import { sampleTerrainSurface, type TerrainSurface } from '../scene/surface';
import { validateLunarCoordinates } from '../selection/selectionManager';
import { canUseGeographicTerrain } from '../scene/metadata';
import { verifiedTerrainPick } from '../selection/verifiedPick';
import { AdaptiveDpr } from '@react-three/drei';
import { DragDetector } from '../selection/dragDetector';
import type { MapMetadataResponse, Coordinates, IsoUtc } from '../../../api/types';

export interface SceneCanvasProps {
  metadata?: MapMetadataResponse | null;
  selectedA?: Coordinates | null;
  selectedB?: Coordinates | null;
  activeSlot?: SiteSlot;
  timeUtc?: IsoUtc | null;
  sunDirectionScene?: [number, number, number] | null;
  sunDirectionMoonFixed?: [number, number, number] | null;
  onSurfaceReady?: (surface: TerrainSurface | null) => void;
  onStatus?: (status: SceneStatus) => void;
  onSelectSite?: (site: SceneSelectedSite) => void;
  onOutOfBounds?: (message: string) => void;
  onPresetChange?: (preset: CameraPreset) => void;
  enableKeyboard?: boolean;
  animationStateRef: React.MutableRefObject<CameraAnimationState | null>;
  controlsRef: React.MutableRefObject<any>;
}

export const SceneCanvas: React.FC<SceneCanvasProps> = ({
  metadata,
  selectedA,
  selectedB,
  activeSlot = 'A',
  timeUtc: _timeUtc,
  sunDirectionScene,
  onStatus,
  onSurfaceReady,
  onSelectSite,
  onOutOfBounds,
  onPresetChange,
  enableKeyboard = true,
  animationStateRef,
  controlsRef,
}) => {
  const [surface, setSurface] = useState<TerrainSurface | null>(null);
  const handleSurface = useCallback((group: THREE.Group | null, key: string | null) => {
    const next = group && key ? { group, key } : null;
    setSurface(next); onSurfaceReady?.(next);
  }, [onSurfaceReady]);
  const positionA = useMemo(() => selectedA ? sampleTerrainSurface(metadata, surface, selectedA) : null, [metadata, surface, selectedA]);
  const positionB = useMemo(() => selectedB ? sampleTerrainSurface(metadata, surface, selectedB) : null, [metadata, surface, selectedB]);
  const [meshStatus, setMeshStatus] = useState<SceneStatus>('loading');
  const geographicReady = meshStatus === 'ready' && canUseGeographicTerrain(metadata);
  const handleStatus = useCallback((status: SceneStatus) => { setMeshStatus(status); onStatus?.(status); }, [onStatus]);
  const dragDetector = useMemo(() => new DragDetector({ maxMoveDistancePixels: 6 }), []);
  const isPointerDownValidClick = useRef(true);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragDetector.onPointerDown(e.clientX, e.clientY);
      isPointerDownValidClick.current = true;
    },
    [dragDetector]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      isPointerDownValidClick.current = dragDetector.isClick(e.clientX, e.clientY);
    },
    [dragDetector]
  );

  const handleMeshClick = useCallback(
    (intersection: THREE.Intersection, loadedAssetKey: string | null) => {
      if (!isPointerDownValidClick.current) return;
      if (!geographicReady) { onOutOfBounds?.('Geographic picking unavailable: mesh or coordinate metadata is unverified. Enter coordinates manually.'); return; }

      const point = intersection.point;
      if (!point || !onSelectSite) return;

      const geo = verifiedTerrainPick(metadata, loadedAssetKey, point);
      if (!geo) { onOutOfBounds?.('Pick unavailable: stale asset, unverified mapping, or outside terrain bounds.'); return; }

      const validation = validateLunarCoordinates(geo.latitude, geo.longitude);
      if (!validation.valid) {
        if (onOutOfBounds && validation.error) {
          onOutOfBounds(validation.error);
        }
        return;
      }

      onSelectSite({
        slot: activeSlot,
        location: {
          latitude: Number(geo.latitude.toFixed(5)),
          longitude: Number(geo.longitude.toFixed(5)),
        },
        scenePosition: {
          x: point.x,
          y: point.y,
          z: point.z,
        },
        elevationM: geo.elevationM != null ? Math.round(geo.elevationM) : null,
      });
    },
    [metadata, geographicReady, onSelectSite, onOutOfBounds, activeSlot]
  );

  return (
    <Canvas
      shadows
      camera={{
        fov: DEFAULT_CAMERA_PRESET.fov || 48,
        near: 2,
        far: 600000,
        position: DEFAULT_CAMERA_PRESET.position,
      }}
      dpr={[0.75, typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches ? 1.25 : 1.75]}
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      style={{ width: '100%', height: '100%', outline: 'none' }}
    >
      <color attach="background" args={['#040608']} />

      <AdaptiveDpr pixelated />
      <Lighting sunDirectionScene={sunDirectionScene} />

      <FittedTerrain controlsRef={controlsRef}
        metadata={metadata}
        onStatus={handleStatus}
        onMeshClick={handleMeshClick}
        onSurfaceReady={handleSurface}
      />

      {geographicReady && <SiteMarkers
        positionA={positionA}
        positionB={positionB}
        selectedA={selectedA}
        selectedB={selectedB}
        activeSlot={activeSlot}
        onMarkerClick={(_slot, coords) => {
          const targetPt = sampleTerrainSurface(metadata, surface, coords);
          if (!targetPt) return;
          const controls = controlsRef.current;
          if (controls) {
            animationStateRef.current = {
              isAnimating: true,
              startPosition: controls.object.position.clone(),
              targetPosition: new THREE.Vector3(targetPt.x, targetPt.y + 4000, targetPt.z + 6000),
              startLookAt: controls.target.clone(),
              targetLookAt: new THREE.Vector3(targetPt.x, targetPt.y, targetPt.z),
              progress: 0,
              durationMs: 900,
              startTime: performance.now(),
            };
          }
        }}
      />}

      <SceneControls
        enableKeyboard={enableKeyboard}
        onPresetChange={onPresetChange}
        animationStateRef={animationStateRef}
        controlsRef={controlsRef}
      />
    </Canvas>
  );
};

function FittedTerrain({ controlsRef, ...props }: React.ComponentProps<typeof TerrainMesh> & { controlsRef: React.MutableRefObject<any> }) {
  const { camera, size } = useThree();
  const fit = useCallback((box: THREE.Box3) => {
    if (box.isEmpty() || !(camera instanceof THREE.PerspectiveCamera)) return;
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() / 2;
    const angle = Math.min(camera.fov * Math.PI / 360, Math.atan(Math.tan(camera.fov * Math.PI / 360) * size.width / size.height));
    const distance = radius / Math.sin(angle) * 1.1;
    camera.position.copy(center).add(new THREE.Vector3(0, 0.6, 0.8).multiplyScalar(distance));
    camera.lookAt(center);
    camera.near = Math.max(1, radius / 2000);
    camera.far = Math.max(100000, distance + radius * 10);
    camera.updateProjectionMatrix();
    if (controlsRef.current) {
      controlsRef.current.target.copy(center);
      controlsRef.current.minDistance = Math.max(50, radius / 50);
      controlsRef.current.maxDistance = radius * 15;
      controlsRef.current.update();
    }
  }, [camera, size.width, size.height, controlsRef]);
  return <TerrainMesh {...props} onLoadedBounds={fit} />;
}
