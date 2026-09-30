/**
 * The intended sharpen settings now apply (Task #2333).
 *
 * sharp's sharpen() reads m1 (the flat-area amount) and m2 (the jagged-area
 * amount). The five calls in wardrobeImageService.js and
 * postProcessingService.js passed `flat` and `jagged`, which sharp ignores,
 * so every one ran with sharp's default m1/m2. They now pass m1/m2.
 *
 * Real sharp, no mocks except axios (sharpEnhanceStill downloads its
 * input). The output must equal the pipeline with the intended m1/m2 and
 * differ from the one that ignored them.
 */
jest.mock('axios', () => ({ get: jest.fn() }));

const axios = require('axios');
const sharp = require('sharp');
const { sharpEnhanceStill } = require('../../../src/services/postProcessingService');

// A deterministic texture: detail at several scales, so m1/m2 have
// something to act on.
async function texture() {
  const width = 64; const height = 64; const channels = 3;
  const pixels = Buffer.alloc(width * height * channels);
  for (let i = 0; i < pixels.length; i += 1) pixels[i] = (i * 7919) % 256;
  return sharp(pixels, { raw: { width, height, channels } }).png().toBuffer();
}

const pixelsOf = (buffer) => sharp(buffer).raw().toBuffer();

describe('sharpEnhanceStill applies m1/m2 (Task #2333)', () => {
  it('the output uses the intended flat/jagged amounts, not sharp\'s defaults', async () => {
    const input = await texture();
    axios.get.mockResolvedValue({ data: input });
    jest.spyOn(console, 'log').mockImplementation(() => {});

    // No upscale: the target is the input's own size.
    const options = { targetWidth: 64, targetHeight: 64, sharpenSigma: 1.2, sharpenFlat: 1.5, sharpenJagged: 0.3, jpegQuality: 95 };
    const { buffer } = await sharpEnhanceStill('https://example.test/in.png', options);

    const jpeg = { quality: 95, progressive: true, mozjpeg: true };
    const intended = await sharp(input).sharpen({ sigma: 1.2, m1: 1.5, m2: 0.3 }).jpeg(jpeg).toBuffer();
    const ignored = await sharp(input).sharpen({ sigma: 1.2 }).jpeg(jpeg).toBuffer();

    const [got, want, old] = await Promise.all([pixelsOf(buffer), pixelsOf(intended), pixelsOf(ignored)]);
    expect(got.equals(want)).toBe(true);
    expect(got.equals(old)).toBe(false);
  });
});
