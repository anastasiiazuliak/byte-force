import { MeshStandardMaterial, type Texture } from 'three';
import { MOON_RADIUS_METERS } from './projection';

/** Pixel-area UVs for the native south-polar stereographic source footprint. */
export function polarTextureUv(east: number, north: number) {
  return [(east + 304000) / 608000, (north + 304000) / 608000];
}

/** Optional DEM cartography with neutral mesh-normal fallback. Never displaces geometry. */
export function createPolarSurfaceMaterial(texture: Texture | null = null) {
  const material = new MeshStandardMaterial({ color: '#999b9d', roughness: 1, metalness: 0 });
  const textureUniform = { value: texture };
  const enabledUniform = { value: Boolean(texture) };
  material.userData.setPolarTexture = (map: Texture | null) => {
    textureUniform.value = map;
    enabledUniform.value = Boolean(map);
  };
  material.onBeforeCompile = shader => {
    shader.uniforms.polarRelief = textureUniform;
    shader.uniforms.hasPolarRelief = enabledUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 demRadial;\nvarying vec3 demNormal;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        demRadial = (modelMatrix * vec4(transformed, 1.0)).xyz + vec3(0.0, ${MOON_RADIUS_METERS.toFixed(1)}, 0.0);
        demNormal = inverseTransformDirection(transformedNormal, viewMatrix);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 demRadial;\nvarying vec3 demNormal;\nuniform sampler2D polarRelief;\nuniform bool hasPolarRelief;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float slopeCosine = clamp(dot(normalize(demNormal), normalize(demRadial)), 0.0, 1.0);
        // Modest slope contrast; no claim of measured surface reflectance.
        float slopeTint = smoothstep(0.0, 0.12, 1.0 - slopeCosine);
        diffuseColor.rgb *= mix(1.0, 0.62, slopeTint);
        if (hasPolarRelief) {
          vec3 radial = normalize(demRadial);
          float latitude = asin(clamp(-radial.y, -1.0, 1.0));
          float longitude = length(radial.xz) < 0.00000001 ? 0.0 : atan(radial.x, -radial.z);
          float rho = 2.0 * 1737400.0 * tan((latitude + 1.5707963267948966) * 0.5);
          vec2 projected = rho * vec2(sin(longitude), cos(longitude));
          vec2 polarUv = (projected + vec2(304000.0)) / 608000.0;
          if (latitude > -1.3962634015954636 || any(lessThan(polarUv, vec2(0.0))) || any(greaterThan(polarUv, vec2(1.0)))) discard;
          vec4 relief = texture2D(polarRelief, polarUv);
          if (relief.a < 0.999) discard;
          // PNG is encoded display gray; explicitly decode the custom sampler to linear light.
          diffuseColor.rgb *= pow(relief.rgb, vec3(2.2)) * 1.5;
        }`);
  };
  material.customProgramCacheKey = () => 'dem-projected-cartography-v2';
  return material;
}
