import { useEffect, useState } from 'react';

export const ignoreSkyRaycast = () => {};

export function useSkyReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true);
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}


export function makeStarData(count = 26000) {
  let seed = 641519;
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const position = new Float32Array(count * 3);
  const appearance = new Float32Array(count * 3);
  for (let i = 0; i < count;) {
    const latitude = random() * 2 - 1;
    if (random() > 0.58 + 0.42 * Math.exp(-24 * latitude * latitude)) continue;
    const longitude = random() * Math.PI * 2;
    const radius = Math.sqrt(1 - latitude * latitude);
    const x = radius * Math.cos(longitude);
    position.set([0.8 * x - 0.6 * latitude, 0.6 * x + 0.8 * latitude, radius * Math.sin(longitude)], i * 3);
    const rank = random();
    const bright = rank > 0.975;
    appearance.set([bright ? 3.2 + random() * 1.3 : 1.5 + random() * 1.2,
      bright ? 0.82 + random() * 0.18 : 0.36 + random() * 0.4,
      random()], i * 3);
    i++;
  }
  return { position, appearance };
}
