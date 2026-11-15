import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import { DataTexture, PerspectiveCamera, RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three';
import type { OrbitControls } from 'three-stdlib';
// NASA SVS CGI Moon Kit (SVS 4720), 2025 LROC/LDAM visualization color.
import asset from '../assets/lroc-color-2k.jpg?url';
import { GLOBE_CENTER, GLOBE_SHELL_RADIUS, globeFitDistance, globeOverviewPosition, polarGlobeMaterial } from '../scene/polarGlobe';
import type { CameraAnimationState } from '../scene/camera';

export function useGlobeTexture(enabled: boolean) {
  const [texture, setTexture] = useState<Texture | null>(null);
  // SceneCanvas gates DEM mounting on a truthy texture. A neutral context pixel
  // keeps terrain independent of network/image decoding without changing that caller.
  const fallback = useMemo(() => {
    const map = new DataTexture(new Uint8Array([150, 150, 150, 255]), 1, 1);
    map.colorSpace = SRGBColorSpace;
    map.needsUpdate = true;
    return map;
  }, []);
  useEffect(() => () => fallback.dispose(), [fallback]);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setTexture(null);
    const map = new TextureLoader().load(asset, loaded => {
      if (cancelled) return;
      loaded.colorSpace = SRGBColorSpace;
      loaded.wrapS = RepeatWrapping;
      setTexture(loaded);
    }, undefined, () => {
      if (cancelled) return;
      setTexture(null);
      console.warn('SVS context image unavailable; retaining untextured globe and DEM relief.');
    });
    return () => { cancelled = true; map.dispose(); };
  }, [enabled]);
  return enabled ? texture ?? fallback : null;
}

export function PolarGlobe({ texture }: { texture: Texture | null }) {
  return (
    <>
      <mesh position={GLOBE_CENTER}>
        <sphereGeometry args={[GLOBE_SHELL_RADIUS, 192, 128]} />
        <meshStandardMaterial color={texture ? '#b0b0b0' : '#777777'} map={texture} roughness={0.95}
          onBeforeCompile={polarGlobeMaterial} />
      </mesh>
      {/* Fixed neutral cartographic illumination, not scenario solar lighting. */}
      <directionalLight position={[-90_000, 55_000, 35_000]} intensity={2.0} color="#ffffff" />
      <directionalLight position={[65_000, 30_000, -50_000]} intensity={0.45} color="#ffffff" />
      <ambientLight intensity={0.55} color="#ffffff" />
    </>
  );
}

export function PolarCamera({ controlsRef, animationStateRef }: {
  controlsRef: RefObject<OrbitControls | null>;
  animationStateRef: RefObject<CameraAnimationState | null>;
}) {
  const { camera, size } = useThree();
  const previousFit = useRef(0);
  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera) || !size.width || !size.height) return;
    const distance = globeFitDistance(camera.fov, size.width / size.height);
    const controls = controlsRef.current;
    if (!previousFit.current || !controls || camera.position.distanceTo(controls.target) >= previousFit.current * 0.98) {
      animationStateRef.current = null;
      camera.position.copy(globeOverviewPosition(distance));
      controls?.target.set(...GLOBE_CENTER);
    }
    previousFit.current = distance;
    if (controls) controls.maxDistance = distance * 1.25;
    camera.near = 400;
    camera.far = distance * 1.25 + 3 * GLOBE_SHELL_RADIUS;
    camera.updateProjectionMatrix();
    controls?.update();
  }, [camera, size.width, size.height, controlsRef, animationStateRef]);
  return null;
}
