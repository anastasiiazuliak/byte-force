import React, { useMemo } from 'react';
import * as THREE from 'three';

export interface LightingProps {
  sunDirectionMoonFixed?: [number, number, number] | null;
}

export const Lighting: React.FC<LightingProps> = ({ sunDirectionMoonFixed }) => {
  const sunPosition = useMemo(() => {
    if (
      sunDirectionMoonFixed &&
      Array.isArray(sunDirectionMoonFixed) &&
      sunDirectionMoonFixed.length === 3
    ) {
      const [sx, sy, sz] = sunDirectionMoonFixed;
      const dist = 100000;
      return new THREE.Vector3(sx * dist, Math.max(sy * dist, 1500), -sz * dist);
    }

    const elevationAngleRad = (2.5 * Math.PI) / 180;
    const azimuthAngleRad = (135 * Math.PI) / 180;
    const distance = 80000;

    const x = Math.cos(azimuthAngleRad) * Math.cos(elevationAngleRad) * distance;
    const y = Math.sin(elevationAngleRad) * distance;
    const z = Math.sin(azimuthAngleRad) * Math.cos(elevationAngleRad) * distance;

    return new THREE.Vector3(x, y, z);
  }, [sunDirectionMoonFixed]);

  return (
    <>
      <directionalLight
        position={sunPosition}
        intensity={2.8}
        color="#ffffff"
        castShadow
        shadow-bias={-0.0005}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={100}
        shadow-camera-far={200000}
        shadow-camera-left={-45000}
        shadow-camera-right={45000}
        shadow-camera-top={45000}
        shadow-camera-bottom={-45000}
      />
      <ambientLight intensity={0.07} color="#a0a8b2" />
      <directionalLight position={[-40000, 20000, -30000]} intensity={0.04} color="#88aacc" />
    </>
  );
};
