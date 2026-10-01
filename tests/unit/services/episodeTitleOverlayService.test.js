/**
 * The episode title overlay (ruling P11 as amended, Evoni 2026-09-30): the
 * pure parts.
 */
const {
  VARIANTS, overlayLook, readBand, colourOf, keyByBrightness, renderTitleOverlay, titleOverlayState,
} = require('../../../src/services/episodeTitleOverlayService');

describe('the look, from the event\'s visual direction', () => {
  test.each([
    ['honey luxe', 'gold_foil'], ['soft glam', 'rose_foil'], ['chic minimal', 'ink'], ['romantic garden', 'sage'], ['default', 'gold_foil'],
  ])('%s → %s', (theme, finish) => {
    expect(overlayLook({ theme, palette: [] }).finish).toBe(finish);
  });

  test('the palette gives the accent: a hex or a known colour word, else none', () => {
    expect(overlayLook({ theme: 'soft glam', palette: ['moonbeam', 'rose gold'] }).accent).toBe('#C98B7A');
    expect(colourOf('#AbC')).toBe('#abc');
    expect(colourOf('moonbeam')).toBeNull();
    expect(overlayLook(null)).toMatchObject({ theme: 'default', finish: 'gold_foil', accent: null });
  });
});

describe('the band (20–40%)', () => {
  test('defaults to off at 30%; percentages and fractions both read', () => {
    expect(readBand(undefined).value).toEqual({ enabled: false, opacity: 0.3 });
    expect(readBand({ enabled: true, opacity: 40 }).value).toEqual({ enabled: true, opacity: 0.4 });
    expect(readBand({ enabled: true, opacity: 0.2 }).value).toEqual({ enabled: true, opacity: 0.2 });
    expect(readBand({ enabled: true, opacity: 0.5 }).error).toMatch(/20–40%/);
    expect(readBand({ enabled: true, opacity: 'x' }).error).toMatch(/number/);
  });
});

describe('the variants', () => {
  test('three lettering styles, each from a real typeface family', () => {
    expect(VARIANTS.map((v) => v.key)).toEqual(['classic', 'italic', 'engraved']);
    expect(VARIANTS.every((v) => ['header', 'body'].includes(v.font))).toBe(true);
  });
});

describe('renderTitleOverlay', () => {
  test('a transparent PNG of the requested size, letters in the middle', async () => {
    const png = renderTitleOverlay({ title: 'Gala Night', episodeNumber: 3, direction: { theme: 'honey luxe', palette: [] }, scale: 0.25 });
    const { loadImage, createCanvas } = require('canvas');
    const img = await loadImage(png);
    expect([img.width, img.height]).toEqual([480, 270]);
    const c = createCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    expect(ctx.getImageData(0, 0, 1, 1).data[3]).toBe(0);
    const mid = ctx.getImageData(0, 120, 480, 20).data;
    let opaque = 0;
    for (let i = 3; i < mid.length; i += 4) if (mid[i] > 200) opaque += 1;
    expect(opaque).toBeGreaterThan(20);
  });

  test('the band shades the strip behind the title only', async () => {
    const png = renderTitleOverlay({ title: 'Gala Night', band: { enabled: true, opacity: 0.4 }, scale: 0.25 });
    const { loadImage, createCanvas } = require('canvas');
    const img = await loadImage(png);
    const c = createCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    expect(ctx.getImageData(2, 135, 1, 1).data[3]).toBeGreaterThan(80); // the band at the left edge, mid-height
    expect(ctx.getImageData(2, 5, 1, 1).data[3]).toBe(0); // nothing at the top
  });
});

describe('keyByBrightness', () => {
  test('black goes transparent, gold stays', () => {
    const data = { data: new Uint8ClampedArray([0, 0, 0, 255, 232, 199, 102, 255]) };
    keyByBrightness(data);
    expect(data.data[3]).toBe(0);
    expect(data.data[7]).toBe(255);
  });
});

describe('titleOverlayState', () => {
  test('outdated once the title changes; none without an overlay', () => {
    const ep = { title: 'Gala Night Two', title_overlay_asset_id: 'a1', title_overlay_title: 'Gala Night', title_overlay_style: '{"variant":"classic"}' };
    expect(titleOverlayState(ep, { s3_url_processed: 'u' })).toEqual({
      asset_id: 'a1', designed_for: 'Gala Night', outdated: true, style: { variant: 'classic' }, image_url: 'u',
    });
    expect(titleOverlayState({ title: 'x' })).toBeNull();
  });
});
