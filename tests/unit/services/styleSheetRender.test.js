/**
 * The style sheet drawn on the server (Task #2877): one render, every export
 * size at its dimensions. The fixture is Episode 1's reference values (spec
 * Part 2) with plain coloured placeholder images.
 */
const sharp = require('sharp');
const { EXPORTS, renderExport, renderSheetCanvas } = require('../../../src/services/styleSheetRenderService');

const ph = async (colour) => `data:image/png;base64,${(await sharp({ create: { width: 60, height: 80, channels: 3, background: colour } }).png().toBuffer()).toString('base64')}`;

let sheet;
beforeAll(async () => {
  sheet = {
    episode: { number: 1, label: 'EPISODE 01' },
    event: { name: 'Wearable Experiments Studio Session', host: 'STUDIO BY SABLE', type: 'Studio session', dress_code: 'elevated contemporary, smart-casual', when: 'Thu, Nov 12, 6:30 PM', vibe: 'statement, modern, elevated, sophisticated, creative' },
    venue: { name: "STUDIO BY SABLE's Studio", chip: 'Echo Park', image: await ph('#5a7f9a') },
    look: { front: await ph('#B8962E'), side: null, back: null, hero: await ph('#30253D') },
    wardrobe: { state: 'chosen', columns: [
      { key: 'body', label: 'BODY', name: null, image: null, needed: true },
      { key: 'shoes', label: 'SHOES', name: 'Crimson Satin Ballerina Pump', image: await ph('#9b1b30'), needed: false },
      { key: 'jewelry', label: 'JEWELRY', name: 'Crimson Bloom Enamel Stud Earrings', image: null, needed: false },
    ] },
    beauty: {},
    palette: [{ hex: '#A01428' }, { hex: '#B8962E' }],
    mood_words: ['statement', 'modern', 'elevated', 'sophisticated', 'creative'],
    tagline: null,
    inspo: { photos: [], textures: [] },
  };
});

describe('style sheet render', () => {
  test('the sheet is drawn at 2x (2048 x 3072)', async () => {
    const canvas = await renderSheetCanvas(sheet);
    expect([canvas.width, canvas.height]).toEqual([2048, 3072]);
  });

  test.each([
    ['sheet', 1024, 1536],
    ['pin', 1000, 1500],
    ['story', 1080, 1920],
    ['post', 1080, 1350],
  ])('%s is a PNG of %i x %i', async (size, w, h) => {
    const out = await renderExport(sheet, size);
    expect(out.type).toBe('image/png');
    const meta = await sharp(out.buffer).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['png', w, h]);
  });

  test('"The look only" is the front, side and back strip, taller than wide', async () => {
    const out = await renderExport(sheet, 'look');
    const meta = await sharp(out.buffer).metadata();
    expect([meta.width, meta.height]).toEqual([EXPORTS.look.width, EXPORTS.look.height]);
    expect(meta.height).toBeGreaterThan(meta.width);
  });

  test('the print PDF is one page, 8 x 12 in', async () => {
    const out = await renderExport(sheet, 'pdf');
    expect(out.type).toBe('application/pdf');
    const text = out.buffer.toString('latin1');
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(text).toMatch(/\/MediaBox \[\s*0 0 576 864\s*\]/);
    expect((text.match(/\/Type\s*\/Page\b/g) || []).length).toBe(1);
  });

  test('an unknown size is refused', async () => {
    await expect(renderExport(sheet, 'poster')).rejects.toThrow('Unknown export size');
  });

  test('the story pads the sheet: the top band is the sheet\'s blush, the bottom band its footer plum', async () => {
    const out = await renderExport(sheet, 'story');
    const { data, info } = await sharp(out.buffer).raw().toBuffer({ resolveWithObject: true });
    const at = (x, y) => { const i = (y * info.width + x) * info.channels; return [data[i], data[i + 1], data[i + 2]]; };
    expect(at(540, 20)).toEqual([0xE9, 0xC4, 0xD5]);
    expect(at(540, 1900)).toEqual([0x30, 0x25, 0x3D]);
  });
});
