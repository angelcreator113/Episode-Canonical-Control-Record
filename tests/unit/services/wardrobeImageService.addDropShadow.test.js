/**
 * addDropShadow on an RGBA image (Task #2334).
 *
 * The shadow layer used to be extended by 2 × padding and then also resized,
 * so it came out larger than the canvas, and the final composite threw
 * "Image to composite must have same dimensions or smaller" for every image
 * with an alpha channel. Real sharp, a generated RGBA fixture, no files.
 */
const sharp = require('sharp');
const { addDropShadow } = require('../../../src/services/wardrobeImageService');

const W = 100; const H = 80;
const ITEM = { left: 25, top: 20, right: 75, bottom: 60 }; // opaque rectangle
const COLOUR = [200, 40, 90];

// A transparent canvas with one opaque rectangle: a cut-out clothing item.
async function rgbaFixture() {
  const px = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = (y * W + x) * 4;
      const inside = x >= ITEM.left && x < ITEM.right && y >= ITEM.top && y < ITEM.bottom;
      px.set([...COLOUR, inside ? 255 : 0], i);
    }
  }
  return sharp(px, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}

async function pixels(buffer) {
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
  return { info, at: (x, y) => Array.from(data.slice((y * info.width + x) * 4, (y * info.width + x) * 4 + 4)) };
}

describe('addDropShadow (Task #2334)', () => {
  beforeAll(() => jest.spyOn(console, 'log').mockImplementation(() => {}));

  it('an RGBA image gets a canvas padded on every side, with the item intact', async () => {
    const result = await addDropShadow(await rgbaFixture());
    expect(result.skipped).toBe(false);
    expect(result.metadata).toMatchObject({ width: W + 80, height: H + 80, format: 'png' });

    const { info, at } = await pixels(result.buffer);
    expect(info.channels).toBe(4);
    // The item, moved by the padding (40), unchanged.
    expect(at(40 + 50, 40 + 40)).toEqual([...COLOUR, 255]);
    // Far from the item and its shadow: fully transparent.
    expect(at(0, 0)[3]).toBe(0);
    expect(at(W + 79, 0)[3]).toBe(0);
  });

  it('the shadow falls down and right of the item, at no more than the opacity', async () => {
    const result = await addDropShadow(await rgbaFixture(), { shadowOffsetX: 8, shadowOffsetY: 12, shadowBlur: 20, shadowOpacity: 0.25 });
    const { at } = await pixels(result.buffer);
    const belowRight = at(40 + ITEM.right + 2, 40 + ITEM.bottom + 4);
    const aboveLeft = at(40 + ITEM.left - 6, 40 + ITEM.top - 6);
    expect(belowRight.slice(0, 3)).toEqual([0, 0, 0]);
    expect(belowRight[3]).toBeGreaterThan(aboveLeft[3]);
    expect(belowRight[3]).toBeLessThanOrEqual(Math.ceil(0.25 * 255));
  });

  it('an offset larger than the padding is clamped, not refused', async () => {
    const result = await addDropShadow(await rgbaFixture(), { shadowOffsetX: 500, shadowOffsetY: -500 });
    expect(result.metadata).toMatchObject({ width: W + 80, height: H + 80 });
  });

  it('an image without alpha is skipped, unchanged', async () => {
    const rgb = await sharp({ create: { width: 20, height: 20, channels: 3, background: { r: 1, g: 2, b: 3 } } }).png().toBuffer();
    const result = await addDropShadow(rgb);
    expect(result.skipped).toBe(true);
    expect(result.buffer).toBe(rgb);
  });
});
