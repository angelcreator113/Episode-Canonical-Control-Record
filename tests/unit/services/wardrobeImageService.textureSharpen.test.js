/**
 * Texture-enhance's clarity sharpen pass now applies (Task #2340).
 *
 * enhanceTexture chained two .sharpen() calls on one sharp pipeline. A
 * pipeline holds one sharpen setting, so the second (detail) call replaced
 * the first (clarity) and only the detail pass ever applied. The passes now
 * run as separate pipelines (twoPassTextureSharpen).
 *
 * Real sharp, no mocks.
 */
const sharp = require('sharp');
const { enhanceTexture, twoPassTextureSharpen } = require('../../../src/services/wardrobeImageService');

const CLARITY = { sigma: 2.5, m1: 1.0, m2: 0.5 };
const DETAIL = { sigma: 0.8, m1: 1.5, m2: 0.3 };
const MICRO = 1.1;

// A deterministic texture: detail at several scales for both passes.
async function texture() {
  const width = 64; const height = 64; const channels = 3;
  const pixels = Buffer.alloc(width * height * channels);
  for (let i = 0; i < pixels.length; i += 1) pixels[i] = (i * 7919) % 256;
  return sharp(pixels, { raw: { width, height, channels } }).png().toBuffer();
}

const pixelsOf = (buffer) => sharp(buffer).raw().toBuffer();

// The two passes as two sharp pipelines, by hand.
async function byHand(input) {
  const afterClarity = await sharp(input).sharpen(CLARITY).png().toBuffer();
  return sharp(afterClarity).sharpen(DETAIL);
}

describe('texture-enhance two-pass sharpen (Task #2340)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('the old single-pipeline chain equals the detail pass alone (the bug)', async () => {
    const input = await texture();
    const chained = await sharp(input).sharpen(CLARITY).sharpen(DETAIL).png().toBuffer();
    const detailOnly = await sharp(input).sharpen(DETAIL).png().toBuffer();
    const [a, b] = await Promise.all([pixelsOf(chained), pixelsOf(detailOnly)]);
    expect(a.equals(b)).toBe(true);
  });

  it('twoPassTextureSharpen differs from the detail pass alone and equals the passes run by hand', async () => {
    const input = await texture();
    const got = await (await twoPassTextureSharpen(input, { detailSharpen: DETAIL.m1 })).png().toBuffer();
    const want = await (await byHand(input)).png().toBuffer();
    const detailOnly = await sharp(input).sharpen(DETAIL).png().toBuffer();

    const [g, w, d] = await Promise.all([pixelsOf(got), pixelsOf(want), pixelsOf(detailOnly)]);
    expect(g.equals(w)).toBe(true);
    expect(g.equals(d)).toBe(false);
  });

  it('enhanceTexture applies both passes and keeps the PNG output format', async () => {
    const input = await texture();
    const result = await enhanceTexture(input);

    const want = await (await byHand(input)).linear(MICRO, -(128 * (MICRO - 1))).png().toBuffer();
    const detailOnly = await sharp(input).sharpen(DETAIL).linear(MICRO, -(128 * (MICRO - 1))).png().toBuffer();

    expect(result.metadata.format).toBe('png');
    expect(result.contentType).toBe('image/png');
    const [g, w, d] = await Promise.all([pixelsOf(result.buffer), pixelsOf(want), pixelsOf(detailOnly)]);
    expect(g.equals(w)).toBe(true);
    expect(g.equals(d)).toBe(false);
  });

  it('enhanceTexture keeps JPEG input as JPEG output with the default JPEG options', async () => {
    const jpegInput = await sharp(await texture()).jpeg().toBuffer();
    const result = await enhanceTexture(jpegInput);

    expect(result.metadata.format).toBe('jpeg');
    const want = await (await byHand(jpegInput)).linear(MICRO, -(128 * (MICRO - 1))).jpeg().toBuffer();
    expect(result.buffer.equals(want)).toBe(true);
  });
});
