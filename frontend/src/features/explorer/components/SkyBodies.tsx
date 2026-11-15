import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { PerspectiveCamera, SRGBColorSpace, TextureLoader, type Group, type Mesh, type Texture } from 'three';
// NASA/Goddard Space Flight Center Scientific Visualization Studio, SVS 2915.
import earthMap from '../assets/earth-blue-marble.png?url';

const sunVertex = `
  varying vec3 facing;
  void main() {
    facing = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const sunFragment = `
  varying vec3 facing;
  void main() {
    float limb = sqrt(max(0.0, normalize(facing).z));
    vec3 edge = vec3(1.0, 0.53, 0.18);
    vec3 center = vec3(1.0, 0.95, 0.74);
    gl_FragColor = vec4(mix(edge, center, limb), 1.0);
  }
`;

export function SkyBodies() {
  const group = useRef<Group>(null);
  const sun = useRef<Mesh>(null);
  const earth = useRef<Mesh>(null);
  const [map, setMap] = useState<Texture | null>(null);

  useEffect(() => {
    const texture = new TextureLoader().load(earthMap);
    texture.colorSpace = SRGBColorSpace;
    setMap(texture);
    return () => texture.dispose();
  }, []);

  // Viewing aids are positioned in the frame at illustrative sizes and distances.
  useFrame(({ camera }) => {
    if (!(camera instanceof PerspectiveCamera) || !group.current || !sun.current || !earth.current) return;
    const distance = camera.near * 3;
    const halfHeight = Math.tan(camera.fov * Math.PI / 360) * distance;
    const halfWidth = halfHeight * camera.aspect;
    const span = Math.min(halfWidth, halfHeight);
    group.current.position.copy(camera.position);
    group.current.quaternion.copy(camera.quaternion);
    sun.current.position.set(-halfWidth * 0.84, -halfHeight * 0.57, -distance);
    earth.current.position.set(halfWidth * 0.84, halfHeight * 0.61, -distance);
    sun.current.scale.setScalar(span * 0.105);
    earth.current.scale.setScalar(span * 0.135);
  });

  return (
    <group ref={group} name="illustrative-sun-and-earth">
      <mesh ref={sun} name="Sun">
        <sphereGeometry args={[1, 32, 24]} />
        <shaderMaterial vertexShader={sunVertex} fragmentShader={sunFragment} toneMapped={false} />
      </mesh>
      <mesh ref={earth} name="Earth" rotation={[0.13, 1.9, -0.16]}>
        <sphereGeometry args={[1, 48, 32]} />
        <meshBasicMaterial map={map} color={map ? '#ffffff' : '#428de5'} toneMapped={false} />
      </mesh>
    </group>
  );
}
