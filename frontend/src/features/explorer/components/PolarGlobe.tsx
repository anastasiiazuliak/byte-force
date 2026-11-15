import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import { PerspectiveCamera, RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three';
import type { OrbitControls } from 'three-stdlib';
// NASA SVS CGI Moon Kit (SVS 4720), 2025 LROC/LDAM visualization color.
import asset from '../assets/lroc-color-2k.jpg?url';
import { GLOBE_CENTER, GLOBE_SHELL_RADIUS, globeFitDistance, globeOverviewPosition, polarGlobeMaterial } from '../scene/polarGlobe';
import type { CameraAnimationState } from '../scene/camera';

export function useGlobeTexture(enabled: boolean) {
  const [texture, setTexture] = useState<Texture | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const map = new TextureLoader().load(asset);
    map.colorSpace = SRGBColorSpace;
    map.wrapS = RepeatWrapping;
    setTexture(map);
    return () => map.dispose();
  }, [enabled]);
  return enabled ? texture : null;
}

export function PolarGlobe({ texture }: { texture: Texture | null }) {
  return (
    <>
      <mesh position={GLOBE_CENTER}>
        <sphereGeometry args={[GLOBE_SHELL_RADIUS, 192, 128]} />
        <meshStandardMaterial color={texture ? '#ffffff' : '#929292'} map={texture} roughness={0.95}
          onBeforeCompile={polarGlobeMaterial} />
      </mesh>
      <directionalLight position={[-90_000, 15_000, 10_000]} intensity={3.8} color="#fffaf3" />
      <ambientLight intensity={0.04} color="#ffffff" />
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
