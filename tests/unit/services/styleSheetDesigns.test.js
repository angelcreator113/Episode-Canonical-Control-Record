/**
 * Evoni's five Canva designs (2026-10-22; src/services/styleSheetDesigns.js):
 * the data read from her deck, the six platform sizes, where each photo spot
 * takes its picture from, the text fields (nothing invented), and each design
 * drawn on the server at every size.
 */
const sharp = require('sharp');
const {
  DESIGNS, SIZES, DESIGN_WIDTH, DESIGN_HEIGHT, findDesign, fitDesign, designPhotoPaths, designPhotos, designFields, designPalette, designSpots, designsForPage,
  designChoice, designsOn, libraryView,
} = require('../../../src/services/styleSheetDesigns');
const { renderDesign } = require('../../../src/services/styleSheetRenderService');

const KNOWN_SPOTS = ['hero', 'front', 'side', 'back', 'detail', 'venue', 'inspo', 'beauty', 'body', 'shoes', 'bag', 'jewelry', 'hair', 'perfume', 'nails'];

describe('the five designs (the deck as data)', () => {
  test('five designs in the deck order, each on the 960 x 1440 page', () => {
    expect(DESIGNS.map((d) => [d.number, d.name])).toEqual([
      ['01', 'The Episode Look'], ['02', 'The Style Diary'], ['03', 'Runway to Reality'], ['04', 'The Color Story'], ['05', 'Invited to Slay'],
    ]);
    for (const d of DESIGNS) {
      for (const el of d.elements) {
        expect(el.x).toBeGreaterThanOrEqual(0);
        expect(el.y).toBeGreaterThanOrEqual(0);
        expect(el.x + el.w).toBeLessThanOrEqual(DESIGN_WIDTH);
        expect(el.y + el.h).toBeLessThanOrEqual(DESIGN_HEIGHT);
      }
    }
  });

  test("each design's photo frames, in the deck's places, on the shared spots", () => {
    expect(designSpots(findDesign('episode_look'))).toEqual(['hero', 'venue', 'inspo', 'front', 'side', 'back', 'body', 'shoes', 'bag', 'jewelry', 'hair', 'perfume', 'nails']);
    expect(designSpots(findDesign('style_diary'))).toEqual(['hero', 'detail', 'venue', 'shoes', 'bag', 'jewelry', 'beauty']);
    expect(designSpots(findDesign('runway'))).toEqual(['hero', 'detail', 'back', 'shoes', 'bag', 'jewelry', 'hair']);
    expect(designSpots(findDesign('color_story'))).toEqual(['hero', 'venue', 'inspo', 'hair', 'beauty', 'nails', 'jewelry', 'bag']);
    expect(designSpots(findDesign('invited'))).toEqual(['hero', 'venue', 'inspo', 'body', 'shoes', 'bag', 'jewelry', 'hair', 'perfume', 'nails']);
    for (const d of DESIGNS) for (const s of designSpots(d)) expect(KNOWN_SPOTS).toContain(s);
    // The Episode Look's hero frame, exactly where the deck has it.
    expect(findDesign('episode_look').elements.find((e) => e.spot === 'hero')).toMatchObject({ x: 52.8, y: 244.8, w: 528, h: 494.4, fill: '#F6D8E6', label: 'HERO / LALA' });
    // The Color Story's six palette circles.
    expect(findDesign('color_story').elements.filter((e) => e.kind === 'swatch').map((e) => e.index)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test('the six sizes, and a design fits each whole and centred', () => {
    expect(Object.entries(SIZES).map(([k, s]) => [k, s.width, s.height])).toEqual([
      ['pinterest', 1000, 1500], ['fb_feed', 1080, 1350], ['fb_story', 1080, 1920], ['ig_feed', 1080, 1350], ['ig_story', 1080, 1920], ['tiktok', 1080, 1920],
    ]);
    const pin = fitDesign(SIZES.pinterest); // the design's own 2:3
    expect(pin.scale).toBeCloseTo(1000 / 960);
    expect(pin.x).toBeCloseTo(0);
    expect(pin.y).toBeCloseTo(0);
    const feed = fitDesign(SIZES.ig_feed); // side borders
    expect(feed.scale).toBeCloseTo(1350 / 1440);
    expect(feed.y).toBeCloseTo(0);
    expect(feed.x).toBeCloseTo((1080 - 960 * (1350 / 1440)) / 2);
    const story = fitDesign(SIZES.tiktok); // top and bottom
    expect(story.scale).toBeCloseTo(1080 / 960);
    expect(story.x).toBeCloseTo(0);
    expect(story.y).toBeCloseTo((1920 - 1440 * (1080 / 960)) / 2);
  });
});

describe('the values', () => {
  const sheet = {
    episode: { label: 'EPISODE 01', title: 'Wearable Experiments' },
    event: { name: 'Studio Session', host: 'STUDIO BY SABLE', type: 'Studio session', dress_code: 'elevated', when: 'Thu, Nov 12', vibe: 'modern' },
    venue: { name: "Sable's Studio", chip: 'Echo Park', image: 'data:venue' },
    look: { front: 'data:front', side: null, back: null, hero: null, detail: null },
    wardrobe: { columns: [{ key: 'body', image: null }, { key: 'shoes', image: 'data:shoes' }, { key: 'hair', image: 'data:hair' }] },
    beauty: { eyes: null, lips: 'data:lips', skin: null },
    inspo: { photos: [], textures: [{ image: 'data:texture' }] },
    palette: [{ hex: '#111111' }, { hex: '#222222' }],
    mood_words: ['statement', 'modern'],
    tagline: 'Every look tells a story.',
  };

  test('each photo spot points at the sheet: the main photo falls back to Front, Beauty to the first of eyes, lips, skin', () => {
    expect(designPhotoPaths(sheet)).toMatchObject({
      hero: 'look.front', front: 'look.front', side: null, detail: null, venue: 'venue.image',
      inspo: 'inspo.textures.0.image', beauty: 'beauty.lips', body: null, shoes: 'wardrobe.columns.1.image', hair: 'wardrobe.columns.2.image', bag: null,
    });
    expect(designPhotos(sheet)).toMatchObject({ hero: 'data:front', shoes: 'data:shoes', beauty: 'data:lips', bag: null });
  });

  test('the text lines come from the episode, in capitals where the deck has them; a missing part is left out', () => {
    const f = designFields(sheet);
    expect(f.episode_event).toBe("EPISODE 01  •  STUDIO SESSION / SABLE'S STUDIO");
    expect(f.look_city_occasion).toBe('LOOK WEARABLE EXPERIMENTS   |   CITY ECHO PARK   |   OCCASION STUDIO SESSION');
    expect(f.date_dress_vibe).toBe('DATE THU, NOV 12   •   DRESS CODE ELEVATED   •   VIBE MODERN');
    expect(f.tagline).toBe('Every look tells a story.');
    expect(f.mood).toBe('EPISODE MOOD:  statement · modern');
    const bare = designFields({ episode: { label: null, title: null }, event: null, venue: {}, mood_words: [], tagline: null });
    expect(Object.values(bare).every((v) => v === null)).toBe(true);
    expect(designFields({ ...sheet, event: { name: 'Gala' }, venue: {} }).date_dress_vibe).toBeNull();
  });

  test('the palette circles take her saved colours; the page gets the designs, sizes and values', () => {
    expect(designPalette(sheet)).toEqual(['#111111', '#222222']);
    const page = designsForPage(sheet);
    expect(page.designs).toBe(DESIGNS);
    expect(page.sizes.map((s) => s.key)).toEqual(Object.keys(SIZES));
    expect(Object.keys(page.values)).toEqual(['photo_paths', 'fields', 'palette']);
  });
});

describe('on or off for the show (Template Studio › Style sheets)', () => {
  test("the show's choice: off keys kept once, unknown ones dropped; none stored means all on", () => {
    expect(designChoice({ style_designs: { off: ['runway', 'poster', 'runway'] } })).toEqual({ off: ['runway'] });
    expect(designChoice({})).toEqual({ off: [] });
    expect(designChoice(null)).toEqual({ off: [] });
    expect(designChoice({ style_designs: { off: 'runway' } })).toEqual({ off: [] });
    expect(designsOn(['runway', 'invited']).map((d) => d.key)).toEqual(['episode_look', 'style_diary', 'color_story']);
  });

  test('the page gets only the designs that are on; the library gets them all with the off list', () => {
    expect(designsForPage({}, { off: ['style_diary'] }).designs.map((d) => d.key)).toEqual(['episode_look', 'runway', 'color_story', 'invited']);
    expect(designsForPage({}).designs).toEqual(DESIGNS);
    const lib = libraryView({ style_designs: { off: ['invited'] } });
    expect(lib.designs).toBe(DESIGNS);
    expect(lib.off).toEqual(['invited']);
    expect(lib.sizes.map((z) => z.key)).toEqual(Object.keys(SIZES));
  });
});

describe('drawn on the server', () => {
  const blank = { episode: {}, event: null, venue: {}, look: {}, wardrobe: { columns: [] }, beauty: {}, inspo: {}, palette: null, mood_words: [], tagline: null };

  test.each(DESIGNS.map((d) => d.key))('%s draws at every size at the exact pixels', async (key) => {
    for (const [size, s] of Object.entries(SIZES)) {
      const out = await renderDesign(blank, key, size);
      const meta = await sharp(out.buffer).metadata();
      expect([size, meta.format, meta.width, meta.height]).toEqual([size, 'png', s.width, s.height]);
    }
  });

  test("a photo fills its frame; the border around a story is the design's background", async () => {
    const red = await sharp({ create: { width: 40, height: 60, channels: 3, background: { r: 220, g: 20, b: 20 } } }).png().toBuffer();
    const sheet = { ...blank, look: { hero: `data:image/png;base64,${red.toString('base64')}` } };
    const out = await renderDesign(sheet, 'episode_look', 'tiktok');
    const { data, info } = await sharp(out.buffer).raw().toBuffer({ resolveWithObject: true });
    const px = (x, y) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)];
    const { scale, y: top } = fitDesign(SIZES.tiktok);
    const hero = findDesign('episode_look').elements.find((e) => e.spot === 'hero');
    const [r, g, b] = px(Math.round((hero.x + hero.w / 2) * scale), Math.round(top + (hero.y + hero.h / 2) * scale));
    expect(r).toBeGreaterThan(200);
    expect(g).toBeLessThan(60);
    expect(b).toBeLessThan(60);
    expect(px(540, 10)).toEqual([0xFF, 0xF9, 0xF5]); // #FFF9F5 above the design
  });

  test('an unknown design or size is refused', async () => {
    await expect(renderDesign(blank, 'nope', 'tiktok')).rejects.toThrow('Unknown design');
    await expect(renderDesign(blank, 'runway', 'billboard')).rejects.toThrow('Unknown size');
  });
});
