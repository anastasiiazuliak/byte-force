import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, ArrowHelper, BackSide, SRGBColorSpace, TextureLoader, Vector3, type Mesh, type Texture } from 'three';
import { ignoreSkyRaycast, useSkyReducedMotion } from './skyVisuals';
// NASA/Goddard Space Flight Center Scientific Visualization Studio, SVS 2915.
import earthMap from '../assets/earth-blue-marble.png?url';
import { skyBodyPosition, SUN_MARKER_WORLD_RADIUS, EARTH_MARKER_WORLD_RADIUS, type SkyDirections } from '../scene/skyDirections';

import { MOON_RADIUS_METERS } from '../scene/projection';

const BEARING_ARROW_LENGTH = 0.06 * MOON_RADIUS_METERS;

function BearingArrow({ origin, direction, color }: { origin: SkyDirections['origin']; direction: SkyDirections['sun']; color: number }) {
  const arrow = useMemo(() => {
    const helper = new ArrowHelper(new Vector3(...direction), new Vector3(...origin), BEARING_ARROW_LENGTH,
      color, BEARING_ARROW_LENGTH * 0.18, BEARING_ARROW_LENGTH * 0.07);
    helper.traverse(object => { object.raycast = ignoreSkyRaycast; });
    for (const material of [helper.line.material, helper.cone.material].flat()) {
      material.transparent = true;
      material.opacity = 0.55;
      material.depthWrite = false;
      material.toneMapped = false;
    }
    return helper;
  }, [origin, direction, color]);
  useEffect(() => () => arrow.dispose(), [arrow]);
  return <primitive object={arrow} />;
}

const sphereVertex = `
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vLocal;
  varying vec2 vUv;
  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = -view.xyz;
    vLocal = position;
    vUv = uv;
    gl_Position = projectionMatrix * view;
  }
`;
const sunFragment = `
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vLocal;
  void main() {
    float mu = max(0.0, dot(normalize(vNormal), normalize(vView)));
    float grain = sin(vLocal.x * 133.0) * sin(vLocal.y * 117.0) * sin(vLocal.z * 151.0);
    vec3 color = mix(vec3(1.0, 0.38, 0.065), vec3(1.0, 0.91, 0.65), pow(mu, 0.42));
    gl_FragColor = vec4(color * (0.98 + 0.02 * grain), 1.0);
    #include <colorspace_fragment>
  }
`;
const earthFragment = `
  uniform sampler2D earthMap;
  uniform float hasMap;
  uniform float cloudTime;
    uniform vec3 sunDirectionView;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vLocal;
  varying vec2 vUv;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
      mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  void main() {
    vec3 n = normalize(vNormal);
    vec3 view = normalize(vView);
    vec3 light = normalize(sunDirectionView);
    float daylight = smoothstep(-0.12, 0.22, dot(n, light));
    vec3 surface = mix(vec3(0.025,0.15,0.35), texture2D(earthMap, vUv).rgb, hasMap);
    // Illustrative procedural weather, not a measured cloud product.
    vec3 p = normalize(vLocal) * 15.0 + vec3(cloudTime,0.0,0.0);
    float clouds = smoothstep(0.55, 0.74, noise(p)*0.65 + noise(p*2.7)*0.35);
    surface = mix(surface, vec3(0.88,0.93,1.0), clouds * 0.28);
    vec3 color = surface * (0.025 + daylight * (0.34 + 0.66 * max(dot(n,light),0.0)));
    float rim = pow(1.0-max(dot(n,view),0.0), 3.5);
    color += vec3(0.06,0.30,0.64) * rim * (0.12 + daylight * 0.65);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;
const haloFragment = `
  uniform vec3 tint;
  uniform float strength;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float mu = abs(dot(normalize(vNormal), normalize(vView)));
    float glow = pow(1.0-mu, 4.0) * strength;
    gl_FragColor = vec4(tint, glow);
    #include <colorspace_fragment>
  }
`;

export interface SkyBodiesProps { directions?: SkyDirections | null }

export function SkyBodies({ directions = null }: SkyBodiesProps = {}) {
  const camera = useThree(state => state.camera);
  const positions = useMemo(() => directions ? {
    sun: skyBodyPosition(directions.origin, directions.sun),
    earth: skyBodyPosition(directions.origin, directions.earth),
  } : null, [directions]);
  const surface = useRef<Mesh>(null);
  const elapsed = useRef(0);
  const reduced = useSkyReducedMotion();
  const [map, setMap] = useState<Texture | null>(null);
  const earthUniforms = useMemo(() => ({ earthMap: { value: map }, hasMap: { value: map ? 1 : 0 }, cloudTime: { value: 0 }, sunDirectionView: { value: new Vector3() } }), [map]);
  const sunHalo = useMemo(() => ({ tint: { value: [1, 0.40, 0.09] }, strength: { value: 0.14 } }), []);
  const earthHalo = useMemo(() => ({ tint: { value: [0.12, 0.40, 1] }, strength: { value: 0.20 } }), []);

  useEffect(() => {
    if (!directions) return;
    const texture = new TextureLoader().load(earthMap);
    texture.colorSpace = SRGBColorSpace;
    setMap(texture);
    return () => texture.dispose();
  }, [Boolean(directions)]);

  useEffect(() => {
    if (!positions) return;
    const previous = camera.far;
    // Triangle inequality keeps markers in the far range without camera anchoring.
    const extent = Math.max(Math.hypot(...positions.sun) + SUN_MARKER_WORLD_RADIUS * 1.22,
      Math.hypot(...positions.earth) + EARTH_MARKER_WORLD_RADIUS * 1.045);
    let installed: number | null = null;
    const ensureFar = () => {
      const required = (camera.position.length() + extent) * 1.05;
      if (camera.far < required) {
        camera.far = required;
        installed = required;
        camera.updateProjectionMatrix();
      }
    };
    farUpdate.current = ensureFar;
    ensureFar();
    return () => {
      farUpdate.current = null;
      if (installed !== null && camera.far === installed) {
        camera.far = previous;
        camera.updateProjectionMatrix();
      }
    };
  }, [camera, positions]);
  const farUpdate = useRef<(() => void) | null>(null);

  useFrame((_, delta) => {
    farUpdate.current?.();
    if (!directions) return;
    if (!reduced) elapsed.current += Math.min(delta, 0.05);
    const t = elapsed.current;
    // A direction transform ignores camera translation; normals are also view-space.
    earthUniforms.sunDirectionView.value.fromArray(directions.sun).transformDirection(camera.matrixWorldInverse);
    if (surface.current) surface.current.rotation.y = 1.9 + (reduced ? 0 : t * 0.012);
    earthUniforms.cloudTime.value = reduced ? 0 : t * 0.006;
  });

  if (!positions || !directions) return null;
  return (
    <group name="measured-sky-direction-markers">
          <BearingArrow origin={directions.origin} direction={directions.sun} color={0xe8b86a} />
          <BearingArrow origin={directions.origin} direction={directions.earth} color={0x82b4d6} />
      <group position={positions.sun} scale={SUN_MARKER_WORLD_RADIUS} name="Sun-direction-marker">
        <mesh raycast={ignoreSkyRaycast}>
          <sphereGeometry args={[1, 64, 48]} />
          <shaderMaterial vertexShader={sphereVertex} fragmentShader={sunFragment} toneMapped={false} />
        </mesh>
        <mesh scale={1.22} raycast={ignoreSkyRaycast}>
          <sphereGeometry args={[1, 48, 32]} />
          <shaderMaterial vertexShader={sphereVertex} fragmentShader={haloFragment} uniforms={sunHalo} side={BackSide} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      <group position={positions.earth} scale={EARTH_MARKER_WORLD_RADIUS} name="Earth-direction-marker">
        <mesh ref={surface} rotation={[0.13, 1.9, -0.16]} raycast={ignoreSkyRaycast}>
          <sphereGeometry args={[1, 64, 48]} />
          <shaderMaterial vertexShader={sphereVertex} fragmentShader={earthFragment} uniforms={earthUniforms} toneMapped={false} />
        </mesh>
        <mesh scale={1.045} raycast={ignoreSkyRaycast}>
          <sphereGeometry args={[1, 64, 48]} />
          <shaderMaterial vertexShader={sphereVertex} fragmentShader={haloFragment} uniforms={earthHalo} side={BackSide} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
