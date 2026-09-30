/**
 * What sharpen({ sigma }) does with the installed sharp (Task #2332).
 *
 * The object form is honoured: sigma 0.5 gives a different result from the
 * no-argument mild default. With sharp 0.35 the old numeric form
 * sharpen(0.5) no longer means sigma 0.5; AssetProcessingService.smoothSkin
 * uses the object form (AssetProcessingService.sharpen.test.js). Real sharp,
 * no mocks, a generated image, no files.
 */
const sharp = require('sharp');

async function sample() {
  // A deterministic texture. On a single clean edge sigma 0.5 and the
  // default sharpen happen to give identical pixels, so the fixture needs
  // detail at several scales for the difference to show.
  const width = 64; const height = 64; const channels = 3;
  const pixels = Buffer.alloc(width * height * channels);
  for (let i = 0; i < pixels.length; i += 1) pixels[i] = (i * 7919) % 256;
  return sharp(pixels, { raw: { width, height, channels } }).png().toBuffer();
}

describe('sharp sharpen({ sigma })', () => {
  it('sigma 0.5 is applied: it differs from the default sharpen', async () => {
    const input = await sample();
    const [sigma, dflt] = await Promise.all([
      sharp(input).sharpen({ sigma: 0.5 }).raw().toBuffer(),
      sharp(input).sharpen().raw().toBuffer(),
    ]);
    expect(sigma.equals(dflt)).toBe(false);
  });
});
