import { describe, expect, it } from 'vitest';
import { MeshStandardMaterial, ShaderLib, WebGLRenderer } from 'three';
import { createPolarSurfaceMaterial, polarTextureUv } from './polarSurface';
import { polarGlobeMaterial } from './polarGlobe';

function compile(material: MeshStandardMaterial) {
  const shader = { ...ShaderLib.standard, uniforms: { ...ShaderLib.standard.uniforms } };
  material.onBeforeCompile(shader as Parameters<MeshStandardMaterial['onBeforeCompile']>[0], {} as WebGLRenderer);
  return shader;
}

describe('polar cartographic materials', () => {
  it('maps projected pixel-area bounds with north up and flipY', () => {
    expect(polarTextureUv(-304000, -304000)).toEqual([0, 0]);
    expect(polarTextureUv(304000, 304000)).toEqual([1, 1]);
    expect(polarTextureUv(0, 0)).toEqual([0.5, 0.5]);
  });
  it('updates optional cartography through uniforms without replacing geometry or material', () => {
    const material = createPolarSurfaceMaterial();
    const shader = compile(material);
    expect(shader.uniforms.hasPolarRelief.value).toBe(false);
    material.userData.setPolarTexture({});
    expect(shader.uniforms.hasPolarRelief.value).toBe(true);
    expect(material.displacementMap).toBeNull();
  });
  it('uses actual mesh normals for slope tint, never photographic or fabricated microrelief', () => {
    const material = createPolarSurfaceMaterial();
    const shader = compile(material);
    expect(material.map).toBeNull();
    expect(material.normalMap).toBeNull();
    expect(material.displacementMap).toBeNull();
    expect(shader.vertexShader).toContain('inverseTransformDirection(transformedNormal, viewMatrix)');
    expect(shader.vertexShader).toContain('1737400.0');
    expect(shader.fragmentShader).toContain('dot(normalize(demNormal), normalize(demRadial))');
    expect(shader.fragmentShader).not.toMatch(/textureGrad|noise/);
    expect(shader.fragmentShader).toContain('if (relief.a < 0.999) discard');
    expect(shader.fragmentShader).toContain('tan((latitude +');
    expect(shader.fragmentShader).toContain('#include <colorspace_fragment>');
    material.dispose();
  });

  it('keeps context shading in linear light and handles the longitude singularity', () => {
    const material = new MeshStandardMaterial();
    material.onBeforeCompile = polarGlobeMaterial;
    const shader = compile(material);
    expect(shader.fragmentShader).toContain('dot(radial.xz, radial.xz) < 1e-12');
    expect(shader.fragmentShader).toContain('du.x -= floor(du.x + 0.5)');
    expect(shader.fragmentShader).toContain('outgoingLight *=');
    expect(shader.fragmentShader).not.toContain('max(gl_FragColor');
    expect(shader.fragmentShader).not.toContain('sRGBTransferOETF(vec4(diffuseColor');
    expect(shader.fragmentShader.indexOf('outgoingLight *=')).toBeLessThan(shader.fragmentShader.indexOf('#include <colorspace_fragment>'));
    material.dispose();
  });
});
