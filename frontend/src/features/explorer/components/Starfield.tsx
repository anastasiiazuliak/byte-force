import { memo, useMemo } from 'react';
import { Float32BufferAttribute } from 'three';

const STAR_COUNT = 16_000;

function makeStars() {
  let seed = 641_519;
  const random = () => {
    seed = (Math.imul(1_664_525, seed) + 1_013_904_223) >>> 0;
    return seed / 4_294_967_296;
  };
  const directions = new Float32Array(STAR_COUNT * 3);
  const appearance = new Float32Array(STAR_COUNT * 2);

  for (let index = 0; index < STAR_COUNT;) {
    const latitude = random() * 2 - 1;
    // Rejection sampling adds a mild density increase near a tilted sky plane.
    if (random() > 0.72 + 0.28 * Math.exp(-35 * latitude * latitude)) continue;
    const longitude = random() * 2 * Math.PI;
    const radius = Math.sqrt(1 - latitude * latitude);
    const x = radius * Math.cos(longitude);
    directions.set([0.8 * x - 0.6 * latitude, 0.6 * x + 0.8 * latitude, radius * Math.sin(longitude)], index * 3);

    const rank = random();
    const intensity = random();
    const faint = rank < 0.93;
    const bright = rank > 0.992;
    appearance.set([
      faint ? 1 : bright ? 1.8 : 1.3,
      faint ? 0.10 + 0.20 * intensity ** 2 : bright ? 0.55 + 0.23 * intensity : 0.32 + 0.20 * intensity,
    ], index * 2);
    index++;
  }
  return {
    position: new Float32BufferAttribute(directions, 3),
    appearance: new Float32BufferAttribute(appearance, 2),
  };
}

const vertexShader = `
  attribute vec2 appearance;
  varying float brightness;

  void main() {
    // Rotate sky directions with the view while ignoring camera translation.
    vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
    gl_Position = clip.xyww;
    gl_PointSize = appearance.x;
    brightness = appearance.y;
  }
`;

const fragmentShader = `
  varying float brightness;

  void main() {
    float radius = length(gl_PointCoord - vec2(0.5));
    if (radius > 0.5) discard;
    float intensity = brightness * (1.0 - smoothstep(0.24, 0.5, radius));
    gl_FragColor = vec4(vec3(intensity), 1.0);
  }
`;

export const Starfield = memo(function Starfield() {
  const attributes = useMemo(makeStars, []);
  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <primitive object={attributes.position} attach="attributes-position" />
        <primitive object={attributes.appearance} attach="attributes-appearance" />
      </bufferGeometry>
      <shaderMaterial vertexShader={vertexShader} fragmentShader={fragmentShader} depthWrite={false} toneMapped={false} />
    </points>
  );
});
