import { useEffect, useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { MapMetadataResponse } from '../../../api/types';
import type { TerrainSurface } from '../scene/surface';
import { createDisplayPlinth, DISPLAY_EDGE_LABEL, displayEdgeRaycast } from '../scene/displayPlinth';

export function DisplayPlinth({ metadata, surface, enabled = false }: {
  metadata?: MapMetadataResponse | null; surface: TerrainSurface | null; enabled?: boolean;
}) {
  const geometry = useMemo(() => enabled ? createDisplayPlinth(metadata, surface) : null, [metadata, surface, enabled]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return <group name="decorative-display-edge">
    <mesh geometry={geometry} raycast={displayEdgeRaycast}>
      <meshBasicMaterial color="#303236" side={THREE.DoubleSide} />
    </mesh>
    <Html fullscreen style={{ pointerEvents: 'none' }}>
      <span style={{ position: 'absolute', bottom: 56, left: 12, color: '#adb0b5', fontSize: 11 }}>{DISPLAY_EDGE_LABEL}</span>
    </Html>
  </group>;
}
