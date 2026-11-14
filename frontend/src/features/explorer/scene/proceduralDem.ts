import * as THREE from 'three';

export interface ProceduralTerrainOptions {
  widthMeters?: number;
  heightMeters?: number;
  segmentsX?: number;
  segmentsY?: number;
  centerProjectedX?: number;
  centerProjectedY?: number;
}

export function createSouthPoleDioramaGeometry(
  options: ProceduralTerrainOptions = {}
): THREE.PlaneGeometry {
  const {
    widthMeters = 80000,
    heightMeters = 80000,
    segmentsX = 160,
    segmentsY = 160,
    centerProjectedX = 0,
    centerProjectedY = 0,
  } = options;

  const geometry = new THREE.PlaneGeometry(widthMeters, heightMeters, segmentsX, segmentsY);
  geometry.rotateX(-Math.PI / 2);

  const posAttr = geometry.attributes.position as THREE.BufferAttribute;
  const count = posAttr.count;

  const landmarks = [
    {
      name: 'Shackleton',
      x: 0,
      y: 0,
      radius: 10500,
      rimHeight: 1350,
      floorDepth: -2800,
      rimWidth: 3000,
    },
    {
      name: 'Connecting Ridge',
      x: -11308,
      y: -12258,
      radius: 8000,
      rimHeight: 1450,
      floorDepth: 500,
      rimWidth: 4000,
    },
    {
      name: 'Faustini West Rim',
      x: 35000,
      y: 10000,
      radius: 19500,
      rimHeight: 2100,
      floorDepth: -1800,
      rimWidth: 5000,
    },
    {
      name: 'Haworth Rim',
      x: -7000,
      y: -38000,
      radius: 17500,
      rimHeight: 1850,
      floorDepth: -2100,
      rimWidth: 4500,
    },
    {
      name: 'de Gerlache Rim',
      x: -25000,
      y: 15000,
      radius: 16000,
      rimHeight: 2000,
      floorDepth: -1900,
      rimWidth: 4000,
    },
    {
      name: 'Malapert Massif Slope',
      x: -6000,
      y: 40000,
      radius: 22000,
      rimHeight: 4500,
      floorDepth: 1200,
      rimWidth: 10000,
    },
  ];

  const secondaryCraters = [
    { x: -5000, y: 12000, radius: 4500, depth: 800, rim: 300 },
    { x: 14000, y: -7000, radius: 3800, depth: 650, rim: 250 },
    { x: -18000, y: -8000, radius: 5200, depth: 950, rim: 350 },
    { x: 8000, y: 22000, radius: 3200, depth: 500, rim: 200 },
    { x: -12000, y: 28000, radius: 4000, depth: 700, rim: 280 },
    { x: 22000, y: -20000, radius: 6000, depth: 1100, rim: 400 },
    { x: -28000, y: -25000, radius: 4800, depth: 850, rim: 320 },
    { x: 5000, y: -18000, radius: 3600, depth: 600, rim: 220 },
  ];

  for (let i = 0; i < count; i++) {
    const sceneX = posAttr.getX(i);
    const sceneZ = posAttr.getZ(i);

    const projX = sceneX + centerProjectedX;
    const projY = centerProjectedY - sceneZ;

    let elevation = 0;

    for (const lm of landmarks) {
      const dx = projX - lm.x;
      const dy = projY - lm.y;
      const dist = Math.hypot(dx, dy);

      if (dist < lm.radius + lm.rimWidth) {
        if (dist <= lm.radius) {
          const normDist = dist / lm.radius;
          const bowl = Math.cos(normDist * Math.PI) * 0.5 + 0.5;
          const innerElevation = lm.rimHeight - bowl * (lm.rimHeight - lm.floorDepth);
          elevation += (innerElevation - elevation) * 0.75;
        } else {
          const rimDist = (dist - lm.radius) / lm.rimWidth;
          const uplift = lm.rimHeight * Math.exp(-rimDist * 2.5);
          elevation += uplift * 0.6;
        }
      }
    }

    for (const sc of secondaryCraters) {
      const dx = projX - sc.x;
      const dy = projY - sc.y;
      const dist = Math.hypot(dx, dy);
      if (dist < sc.radius * 1.5) {
        if (dist < sc.radius) {
          const norm = dist / sc.radius;
          const bowl = (1.0 - norm * norm) * sc.depth;
          elevation -= bowl * 0.7;
        } else {
          const norm = (dist - sc.radius) / (sc.radius * 0.5);
          const rim = Math.sin(norm * Math.PI) * sc.rim;
          elevation += rim * 0.4;
        }
      }
    }

    const micro1 = Math.sin(projX * 0.0004) * Math.cos(projY * 0.0004) * 80;
    const micro2 = Math.sin(projX * 0.0012 + 1.2) * Math.sin(projY * 0.0015 + 0.8) * 35;
    const micro3 = Math.cos(projX * 0.003 - 0.5) * Math.sin(projY * 0.0028) * 15;
    elevation += micro1 + micro2 + micro3;

    posAttr.setY(i, elevation);
  }

  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}
