/**
 * The thumbnail as layers (thumbnailLayers; Evoni, 2026-10-21: move, resize
 * and turn anything). readLayers keeps numbers in range and refuses foreign
 * pictures; fitText makes words smaller until they fit their box; the
 * renderer draws real pixels (node-canvas), turned about each layer's centre.
 */

const sharp = require('sharp');
const L = require('../../../src/services/thumbnailLayers');

const s3 = (url) => /^https:\/\/b\.s3\.amazonaws\.com\//.test(url);

describe('readLayers', () => {
  test('keeps numbers in range, fills defaults, cuts text, and gives every layer its own id', () => {
    const spec = L.readLayers({
      version: 2,
      layers: [
        { id: 'bg', kind: 'image', role: 'background', src: 'https://b.s3.amazonaws.com/bg.jpg', fit: 'cover', x: -99999, y: 0, w: 0, h: 99999, rotation: 400 },
        { id: 'bg', kind: 'text', text: `  ${'word '.repeat(60)} `, size: 999, color: 'pink', align: 'sideways', visible: false },
        { kind: 'shade', dim: 5, side: 'up' },
        { kind: 'badge', text: 'EP 12345678901234567890', fill: '#b8962e' },
      ],
    }, s3);
    const [bg, text, shade, badge] = spec.layers;
    expect(bg).toMatchObject({ id: 'bg', role: 'background', fit: 'cover', frame: 'none', x: -1280, w: 1, h: 2160, rotation: 180, visible: true, opacity: 1 });
    expect(text).toMatchObject({ id: 'bg-2', size: 220, color: '#FFFFFF', stroke: '#2A0A22', bg: null, align: 'left', font: 'serif', visible: false });
    expect(text.text.length).toBe(160);
    expect(shade).toMatchObject({ id: 'layer-3', dim: 0.8, side: 'left', accent: '#E0689F' });
    expect(badge).toMatchObject({ text: 'EP 1234567890123', fill: '#B8962E' });
    expect(L.readLayers({ version: 2, layers: [{ kind: 'text', text: 'x', stroke: null }] }, s3).layers[0].stroke).toBeNull();
    // A locked layer stays locked; anything else is unlocked.
    const lk = L.readLayers({ version: 2, layers: [{ kind: 'text', text: 'x', locked: true }, { kind: 'text', text: 'y', locked: 'yes please' }, { kind: 'text', text: 'z' }] }, s3).layers;
    expect(lk.map((l) => l.locked)).toEqual([true, true, false]);
  });

  test('refuses what is not layers, unknown kinds, too many layers, and pictures that are not ours', () => {
    expect(() => L.readLayers({ layout: 'lala-left' }, s3)).toThrow(/version: 2/);
    expect(() => L.readLayers({ version: 2, layers: [{ kind: 'video' }] }, s3)).toThrow(/kind must be one of/);
    expect(() => L.readLayers({ version: 2, layers: Array.from({ length: 25 }, () => ({ kind: 'text' })) }, s3)).toThrow(/At most 24/);
    let err;
    try { L.readLayers({ version: 2, layers: [{ kind: 'image', src: 'https://evil.example.com/x.png' }] }, s3); } catch (e) { err = e; }
    expect(err).toMatchObject({ status: 400, message: expect.stringMatching(/not one of ours/) });
  });
});

describe('fitText', () => {
  // Every character is half the size wide: easy to reason about.
  const measure = (s, size) => s.length * size * 0.5;

  test('the largest size at which every line fits the width and the lines fit the height', () => {
    // 'Come Style Me' at 80 is 520 wide: too wide for 400, so two lines; 2 x 80 x 1.12 = 179 <= 200.
    expect(L.fitText('Come Style Me', { w: 400, h: 200, size: 80 }, measure)).toEqual({ size: 80, lines: ['Come Style', 'Me'] });
    // In a short box it gets smaller until the lines fit.
    const small = L.fitText('I Designed My Outfit for a Fashion Studio Experiment', { w: 600, h: 120, size: 90 }, measure);
    expect(small.lines.length * small.size * L.LINE_HEIGHT).toBeLessThanOrEqual(120);
    expect(Math.max(...small.lines.map((l) => measure(l, small.size)))).toBeLessThanOrEqual(600);
    expect(L.fitText('', { w: 100, h: 100, size: 40 }, measure)).toEqual({ size: 40, lines: [] });
    // Nothing fits: the smallest size, wrapped.
    expect(L.fitText('Supercalifragilistic', { w: 20, h: 5, size: 40 }, measure).size).toBe(10);
  });
});

describe('renderLayers', () => {
  const solid = (w, h, background) => sharp({ create: { width: w, height: h, channels: 3, background } }).png().toBuffer();
  const pixel = async (png, x, y) => {
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    const i = (y * info.width + x) * info.channels;
    return [data[i], data[i + 1], data[i + 2]];
  };

  test('a 1280x720 PNG; a cover background fills it; a turned layer is turned about its centre; hidden layers are not drawn', async () => {
    const spec = L.readLayers({
      version: 2,
      layers: [
        { id: 'bg', kind: 'image', src: 'https://b.s3.amazonaws.com/bg.png', fit: 'cover', x: 0, y: 0, w: 1280, h: 720 },
        // A 400x40 bar at the centre, turned 90 degrees: it stands upright.
        { id: 'bar', kind: 'image', src: 'https://b.s3.amazonaws.com/bar.png', fit: 'cover', x: 440, y: 340, w: 400, h: 40, rotation: 90 },
        { id: 'gone', kind: 'image', src: 'https://b.s3.amazonaws.com/bar.png', fit: 'cover', x: 0, y: 0, w: 200, h: 200, visible: false },
      ],
    }, s3);
    const png = await L.renderLayers(spec, {
      bg: await solid(1600, 900, '#0000FF'),
      bar: await solid(400, 40, '#FF0000'),
      gone: await solid(10, 10, '#00FF00'),
    });
    expect(await sharp(png).metadata()).toMatchObject({ width: 1280, height: 720, format: 'png' });
    expect(await pixel(png, 640, 200)).toEqual([255, 0, 0]); // above the centre: the upright bar
    expect(await pixel(png, 300, 360)).toEqual([0, 0, 255]); // left of the centre: background (unturned, the bar was here)
    expect(await pixel(png, 50, 50)).toEqual([0, 0, 255]); // the hidden layer is not drawn
  });

  test('text, a badge and the shade draw; a picture that does not read is a 400', async () => {
    const spec = L.readLayers({
      version: 2,
      layers: [
        { kind: 'shade', dim: 0, accent: '#B8962E', side: 'none' },
        { kind: 'text', text: 'Come Style Me', font: 'script', size: 120, color: '#FFFFFF', stroke: null, x: 100, y: 100, w: 800, h: 200 },
        { kind: 'badge', text: 'EP 1', x: 1000, y: 40, w: 180, h: 70 },
      ],
    }, s3);
    const png = await L.renderLayers(spec, {});
    expect(await pixel(png, 640, 715)).toEqual([0xB8, 0x96, 0x2E]); // the accent stripe
    expect(await pixel(png, 1000, 75)).toEqual([0xFF, 0xFF, 0xFF]); // the badge's white outline
    expect(await pixel(png, 1010, 75)).toEqual([0xE0, 0x68, 0x9F]); // inside it, the pill's colour
    const bad = L.readLayers({ version: 2, layers: [{ id: 'x', kind: 'image', src: 'https://b.s3.amazonaws.com/x.png' }] }, s3);
    await expect(L.renderLayers(bad, { x: Buffer.from('not a picture') })).rejects.toMatchObject({ status: 400 });
  });

  test('a checklist: at most six rows with words, ticked unless turned off; a ticked box is drawn ticked', async () => {
    const spec = L.readLayers({
      version: 2,
      layers: [{ kind: 'checklist', x: 100, y: 100, w: 400, h: 200, color: '#ffffff',
        items: [{ text: 'Sweater dress' }, { text: 'Hair', checked: false }, { text: '' }, ...Array.from({ length: 6 }, (_, i) => ({ text: `Row ${i}` }))] }],
    }, s3);
    const list = spec.layers[0];
    expect(list.items.slice(0, 2)).toEqual([{ text: 'Sweater dress', checked: true }, { text: 'Hair', checked: false }]);
    expect(list.items).toHaveLength(5); // six rows read, the empty one dropped
    expect(list).toMatchObject({ font: 'hand', color: '#FFFFFF' });
    const one = L.readLayers({ version: 2, layers: [
      { kind: 'shade', dim: 0, side: 'none', accent: '#000000' },
      { kind: 'checklist', x: 100, y: 100, w: 400, h: 100, items: [{ text: 'Vibe' }] },
    ] }, s3);
    const png = await L.renderLayers(one, {});
    // The row's box is 60 wide at the left of the layer; its tick runs up to the right corner.
    const rows = L.checklistRows(one.layers[1], (t, size) => t.length * size * 0.5);
    expect(rows).toMatchObject({ rowH: 100, box: 60 });
    expect(await pixel(png, 100, 150)).toEqual([255, 255, 255]); // the box's left side
    expect(await pixel(png, 130, 150)).not.toEqual([255, 255, 255]); // inside the box, left of the tick: empty
  });

  test('fontFile: only the thumbnail fonts', () => {
    expect(L.fontFile('script')).toMatch(/GreatVibes-Regular\.ttf$/);
    expect(L.fontFile('../../etc/passwd')).toBeNull();
  });
});
