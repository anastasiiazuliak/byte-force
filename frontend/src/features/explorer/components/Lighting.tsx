import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
export interface LightingProps {
  sunDirectionScene?: [number, number, number] | null;
  /** Compatibility only; unknown global frame is deliberately ignored. */
  sunDirectionMoonFixed?: [number, number, number] | null;
}
export const Lighting: React.FC<LightingProps> = ({ sunDirectionScene }) => {
  const light = useRef<THREE.DirectionalLight>(null);
  const reduced = useRef(false);
  const target = useMemo(() => sunDirectionScene?.every(Number.isFinite) && Math.hypot(...sunDirectionScene) > 0
    ? new THREE.Vector3(...sunDirectionScene).normalize().multiplyScalar(80000)
    : new THREE.Vector3(-56000, 60000, 56000), [sunDirectionScene]);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { reduced.current = query.matches; };
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useFrame((_, delta) => {
    if (!light.current) return;
    if (reduced.current) light.current.position.copy(target);
    else light.current.position.lerp(target, 1 - Math.exp(-Math.min(delta, 0.1) * 6));
  });
  return <>
    <directionalLight ref={light} position={[-56000, 60000, 56000]} intensity={sunDirectionScene ? 2.8 : 2.3} castShadow={Boolean(sunDirectionScene)}
      shadow-bias={-0.0005} shadow-mapSize-width={1024} shadow-mapSize-height={1024}
      shadow-camera-near={100} shadow-camera-far={200000}
      shadow-camera-left={-15000} shadow-camera-right={15000}
      shadow-camera-top={15000} shadow-camera-bottom={-15000} />
    <ambientLight intensity={sunDirectionScene ? 0.07 : 0.42} color="#ffffff" />
    <directionalLight position={[-40000, 20000, -30000]} intensity={sunDirectionScene ? 0.04 : 0.5} color="#ffffff" />
  </>;
};
