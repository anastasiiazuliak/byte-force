import * as THREE from 'three';

export const LUNAR_REGOLITH_COLOR = 0x6e7276;
export const LUNAR_REGOLITH_ROUGHNESS = 0.90;
export const LUNAR_REGOLITH_METALNESS = 0.05;

export function createProceduralRegolithTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#6e7276';
  ctx.fillRect(0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;

  let seed = 42;
  function rand() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  for (let i = 0; i < data.length; i += 4) {
    const variation = (rand() - 0.5) * 28;
    const base = 110 + variation;
    data[i] = Math.max(0, Math.min(255, base));
    data[i + 1] = Math.max(0, Math.min(255, base));
    data[i + 2] = Math.max(0, Math.min(255, base + 2));
    data[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  for (let j = 0; j < 80; j++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const r = 2 + rand() * 12;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(40, 42, 45, 0.35)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(145, 148, 152, 0.4)';
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 16);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createLunarMaterial(texture?: THREE.Texture | null): THREE.MeshStandardMaterial {
  const regolithTex = texture ?? createProceduralRegolithTexture();
  const material = new THREE.MeshStandardMaterial({
    color: LUNAR_REGOLITH_COLOR,
    roughness: LUNAR_REGOLITH_ROUGHNESS,
    metalness: LUNAR_REGOLITH_METALNESS,
    map: regolithTex ?? null,
    flatShading: false,
  });

  return material;
}
