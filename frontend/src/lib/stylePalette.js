/**
 * Five colours for the style sheet's COLOR PALETTE, taken in the browser
 * from the saved look's piece images (spec Part 2; Task #2814). No AI and
 * no server call: the images arrive as same-origin data URLs, are drawn
 * small on a canvas, and their pixels are grouped by a small k-means.
 */

const toHex = ([r, g, b]) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/**
 * Pure: up to `k` dominant colours of [r, g, b] pixels, most common first,
 * as hex. Near-white and near-black pixels (photo backgrounds and shadows)
 * are set aside unless nothing else is left.
 */
export function dominantColors(pixels, k = 5, rounds = 8) {
  const usable = pixels.filter(([r, g, b]) => {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return !(min > 235) && !(max < 18);
  });
  const pool = usable.length >= k ? usable : pixels;
  if (!pool.length) return [];
  // Farthest-point seeds (deterministic): the middle pixel, then each next
  // seed the pixel farthest from the seeds so far.
  let centres = [pool[Math.floor(pool.length / 2)]];
  while (centres.length < k) {
    let far = null;
    let farD = 0;
    for (const p of pool) {
      const d = Math.min(...centres.map((c) => dist2(p, c)));
      if (d > farD) { farD = d; far = p; }
    }
    if (!far) break;
    centres.push(far);
  }
  let counts = [];
  for (let round = 0; round < rounds; round++) {
    const sums = centres.map(() => [0, 0, 0]);
    counts = centres.map(() => 0);
    for (const p of pool) {
      let best = 0;
      for (let c = 1; c < centres.length; c++) if (dist2(p, centres[c]) < dist2(p, centres[best])) best = c;
      sums[best][0] += p[0]; sums[best][1] += p[1]; sums[best][2] += p[2];
      counts[best]++;
    }
    centres = centres.map((c, i) => (counts[i] ? sums[i].map((s) => s / counts[i]) : c));
  }
  const hexes = centres.map((c, i) => ({ hex: toHex(c), n: counts[i] })).sort((a, b) => b.n - a.n).map((c) => c.hex);
  return [...new Set(hexes)];
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image could not be read'));
    img.src = src;
  });
}

/** Browser: five colours from the piece images (data URLs). */
export async function extractPalette(sources, k = 5) {
  const pixels = [];
  for (const src of sources || []) {
    try {
      const img = await loadImage(src);
      const canvas = document.createElement('canvas');
      const side = 48;
      canvas.width = side; canvas.height = side;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, side, side);
      const { data } = ctx.getImageData(0, 0, side, side);
      for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 200) pixels.push([data[i], data[i + 1], data[i + 2]]);
    } catch (err) {
      console.error('[StylePalette] a piece image could not be sampled:', err.message);
    }
  }
  return dominantColors(pixels, k).map((hex) => ({ hex, source: 'auto' }));
}
