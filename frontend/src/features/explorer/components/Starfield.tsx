import { memo, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { ignoreSkyRaycast, makeStarData } from './skyVisuals';

const vertexShader = `
  attribute vec3 appearance;
  uniform float pixelRatio;
  varying float brightness;
  varying vec3 tint;
  void main() {
    vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
    gl_Position = clip.xyww;
    gl_PointSize = min(appearance.x * pixelRatio, 7.0);
    brightness = appearance.y;
    tint = appearance.z < 0.5
      ? mix(vec3(0.65,0.78,1.0),vec3(1.0),appearance.z*2.0)
      : mix(vec3(1.0),vec3(1.0,0.76,0.53),(appearance.z-0.5)*2.0);
  }
`;
const fragmentShader = `
  varying float brightness;
  varying vec3 tint;
  void main() {
    float radius = length(gl_PointCoord - vec2(0.5));
    if (radius > 0.5) discard;
    float core = exp(-radius * radius * 17.0);
    float edge = 1.0 - smoothstep(0.34, 0.5, radius);
    gl_FragColor = vec4(tint * brightness * core * edge, 1.0);
    #include <colorspace_fragment>
  }
`;

export const Starfield = memo(function Starfield() {
  const data = useMemo(() => makeStarData(), []);
  const uniforms = useMemo(() => ({ pixelRatio: { value: 1 } }), []);
  useFrame(({ gl }) => {
    // Keep apparent sizes legible without multiplying mobile fill cost by full DPR.
    uniforms.pixelRatio.value = Math.min(gl.getPixelRatio(), 1.6);
  });
  return (
    <points name="illustrative-starfield" frustumCulled={false} raycast={ignoreSkyRaycast}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.position, 3]} />
        <bufferAttribute attach="attributes-appearance" args={[data.appearance, 3]} />
      </bufferGeometry>
      <shaderMaterial uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} depthWrite={false} toneMapped={false} />
    </points>
  );
});
