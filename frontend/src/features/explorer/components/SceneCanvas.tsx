import React, { useRef, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Lighting } from './Lighting';
import { TerrainMesh } from './TerrainMesh';
import { SceneControls } from './SceneControls';
import { SiteMarkers } from './SiteMarkers';
import { DEFAULT_CAMERA_PRESET } from '../scene/camera';
import type { CameraAnimationState } from '../scene/camera';
import type { CameraPreset, SceneStatus, SceneSelectedSite, SiteSlot } from '../types';
import { sceneToGeographic, geographicToScene } from '../scene/projection';
import { validateLunarCoordinates } from '../selection/selectionManager';
import { DragDetector } from '../selection/dragDetector';
import type { MapMetadataResponse, Coordinates, IsoUtc } from '../../../api/types';

export interface SceneCanvasProps {
  metadata?: MapMetadataResponse | null;
  selectedA?: Coordinates | null;
  selectedB?: Coordinates | null;
  activeSlot?: SiteSlot;
  timeUtc?: IsoUtc | null;
  sunDirectionMoonFixed?: [number, number, number] | null;
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
  sunDirectionMoonFixed,
  onStatus,
  onSelectSite,
  onOutOfBounds,
  onPresetChange,
  enableKeyboard = true,
  animationStateRef,
  controlsRef,
}) => {
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
    (intersection: THREE.Intersection) => {
      if (!isPointerDownValidClick.current) return;

      const point = intersection.point;
      if (!point || !onSelectSite) return;

      const origin = metadata?.render?.sceneTransform
        ? {
            originEastingM: metadata.render.sceneTransform.originEastingM,
            originNorthingM: metadata.render.sceneTransform.originNorthingM,
            verticalOriginM: metadata.render.sceneTransform.verticalOriginM,
          }
        : undefined;

      const geo = sceneToGeographic({ x: point.x, y: point.y, z: point.z }, origin);

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
    [metadata, onSelectSite, onOutOfBounds, activeSlot]
  );

  return (
    <Canvas
      shadows
      camera={{
        fov: DEFAULT_CAMERA_PRESET.fov || 48,
        near: 10,
        far: 600000,
        position: DEFAULT_CAMERA_PRESET.position,
      }}
      dpr={[1, 2]}
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

      <Lighting sunDirectionMoonFixed={sunDirectionMoonFixed} />

      <TerrainMesh
        metadata={metadata}
        onStatus={onStatus}
        onMeshClick={handleMeshClick}
      />

      <SiteMarkers
        selectedA={selectedA}
        selectedB={selectedB}
        activeSlot={activeSlot}
        onMarkerClick={(_slot, coords) => {
          const targetPt = geographicToScene(coords, 0);
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
      />

      <SceneControls
        enableKeyboard={enableKeyboard}
        onPresetChange={onPresetChange}
        animationStateRef={animationStateRef}
        controlsRef={controlsRef}
      />
    </Canvas>
  );
};
