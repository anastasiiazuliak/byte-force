import React, { useMemo, useState } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { Coordinates } from '../../../api/types';
import type { SiteSlot } from '../types';
import { geographicToScene, type SceneTransformOrigin } from '../scene/projection';
import { formatLunarCoordinates } from '../selection/selectionManager';
import styles from '../styles/explorer.module.css';

export interface SiteMarkersProps {
  origin?: SceneTransformOrigin;
  selectedA?: Coordinates | null;
  selectedB?: Coordinates | null;
  activeSlot?: SiteSlot;
  onMarkerClick?: (slot: SiteSlot, coords: Coordinates) => void;
}

interface SingleMarkerProps {
  origin?: SceneTransformOrigin;
  slot: SiteSlot;
  coords: Coordinates;
  isActive: boolean;
  color: string;
  glowColor: string;
  onClick?: () => void;
}

const SingleMarker: React.FC<SingleMarkerProps> = ({
  origin,
  slot,
  coords,
  isActive,
  color,
  glowColor,
  onClick,
}) => {
  const [hovered, setHovered] = useState(false);

  const scenePos = useMemo(() => {
    const pt = geographicToScene(coords, 0, origin);
    return new THREE.Vector3(pt.x, pt.y, pt.z);
  }, [coords, origin]);

  const beaconHeight = 2200;
  const orbRadius = hovered ? 450 : 350;

  return (
    <group position={scenePos}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 10, 0]}>
        <ringGeometry args={[300, 450, 32]} />
        <meshBasicMaterial
          color={color}
          side={THREE.DoubleSide}
          transparent
          opacity={isActive ? 0.9 : 0.6}
        />
      </mesh>

      <mesh
        position={[0, beaconHeight / 2, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
      >
        <cylinderGeometry args={[25, 50, beaconHeight, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.8 : 0.4}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      <mesh
        position={[0, beaconHeight, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
      >
        <sphereGeometry args={[orbRadius, 24, 24]} />
        <meshStandardMaterial
          color={glowColor}
          emissive={color}
          emissiveIntensity={hovered ? 1.2 : 0.8}
          roughness={0.1}
          metalness={0.2}
        />
      </mesh>

      <Html
        position={[0, beaconHeight + 800, 0]}
        center
        distanceFactor={45000}
        occlude={false}
      >
        <div
          className={`${styles.markerLabel} ${
            slot === 'A' ? styles.markerLabelA : styles.markerLabelB
          } ${hovered ? styles.markerLabelHovered : ''}`}
          onClick={onClick}
          role="button"
          tabIndex={0}
          aria-label={`Site ${slot}: ${formatLunarCoordinates(coords)}`}
        >
          <span className={styles.markerLabelTitle}>Site {slot}</span>
          <span className={styles.markerLabelCoords}>{formatLunarCoordinates(coords)}</span>
        </div>
      </Html>
    </group>
  );
};

export const SiteMarkers: React.FC<SiteMarkersProps> = ({
  origin,
  selectedA,
  selectedB,
  activeSlot = 'A',
  onMarkerClick,
}) => {
  return (
    <group name="site-markers">
      {selectedA && (
        <SingleMarker
          origin={origin}
          slot="A"
          coords={selectedA}
          isActive={activeSlot === 'A'}
          color="#eab308"
          glowColor="#fef08a"
          onClick={() => onMarkerClick?.('A', selectedA)}
        />
      )}

      {selectedB && (
        <SingleMarker
          origin={origin}
          slot="B"
          coords={selectedB}
          isActive={activeSlot === 'B'}
          color="#0284c7"
          glowColor="#7dd3fc"
          onClick={() => onMarkerClick?.('B', selectedB)}
        />
      )}
    </group>
  );
};
