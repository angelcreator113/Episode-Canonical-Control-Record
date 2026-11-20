'use strict';

/**
 * The in-world document presented for video (V1): presentDocument in
 * eventDocumentOverlayService. One canonical document, drawn by the one
 * draw function, placed in a transparent 1920×1080 frame as a floating page
 * or as reading panels. No database, no storage, no network.
 *
 * These tests need the canvas dependency and do not skip without it: if it
 * cannot load, the first test fails and says so.
 */

const sharp = require('sharp');
const svc = require('../../../src/services/eventDocumentOverlayService');
const { FRAME_W, FRAME_H, DEFAULT_LAYOUT } = require('../../../src/utils/editTimeline');

const {
  drawingAvailable, renderDocument, presentDocument, measureDocumentText, panelSlices,
  DocumentPresentationError, PRESENTATIONS, MIN_READABLE_PX, PANEL_OVERLAP, EDGE_PADDING_PX,
} = svc;

// ── Sample documents (made up for the tests) ──────────────────────────────
const EVENT = { name: 'Velour Night', host_brand: 'Velour', event_date: '2026-12-04', venue_name: 'Maison Miel' };
const SHORT_LIST = { items: [{ slot: 'dress', label: 'A gown that photographs well' }, { slot: 'shoes', label: 'Heels she can stand in' }] };
const LONG_LIST = {
  items: Array.from({ length: 22 }, (_, i) => ({ slot: `extra-${i}`, label: `Piece number ${i + 1} for the evening look` })),
  note: 'do not forget the earrings',
};
const LETTER = {
  letter: {
    greeting: 'Dear Lala,',
    opening: 'We have watched your work this season and would love to have you with us for the opening night of our winter collection.',
    opportunity: 'You would arrive in a look from the collection, walk the entrance with our creative director, and sit at the head table. We think the night suits where you are heading, and we want it to be yours as much as ours.',
    next_steps: 'Reply by Friday and our team will send the look options and the car details.',
    closing: 'With admiration,',
    sender_name: 'Mara Velour',
    sender_title: 'Creative Director',
  },
};
const TERMS = [
  { key: 'pay', title: 'Compensation', lines: [{ label: 'Appearance fee', amount: 1200, detail: 'Paid on completion' }, { label: 'Content fee', amount: 400, detail: 'One Pulse post' }] },
  { key: 'del', title: 'Deliverables', lines: [{ label: 'One Pulse post within 48 hours', detail: 'Tagged and approved' }, { label: 'One story on the night' }, { label: 'Attend the dinner in full look' }] },
  { key: 'res', title: 'Restrictions', lines: [{ label: 'No competing beauty brand for 30 days' }, { label: 'No alcohol on camera' }] },
];
const SHORT_LETTER = { letter: { greeting: 'Dear Lala,', opening: 'Join us.', closing: 'Warmly,', sender_name: 'Mara Velour' } };

const CASES = [
  ['a short shopping list', 'shopping_list', { doc: SHORT_LIST, event: EVENT, pieces: null }],
  ['a full shopping list', 'shopping_list', { doc: LONG_LIST, event: EVENT, pieces: null }],
  ['a short offer letter', 'offer_letter', { doc: SHORT_LETTER, event: EVENT, terms: [] }],
  ['a long offer letter', 'offer_letter', { doc: LETTER, event: EVENT, terms: TERMS }],
];
const EVERY = CASES.flatMap(([name, type, data]) => PRESENTATIONS.map((presentation) => [`${name}, ${presentation}`, type, data, presentation]));

// ── The frame's regions, worked out here from the editor's constants ──────
const SAFE = { x: Math.round(FRAME_W * 0.05), y: Math.round(FRAME_H * 0.05) };
const WINDOW = { x: DEFAULT_LAYOUT.x, y: DEFAULT_LAYOUT.y, w: DEFAULT_LAYOUT.w, h: DEFAULT_LAYOUT.h };
const COLUMN = { x: SAFE.x, y: SAFE.y, w: 1206, h: FRAME_H - 2 * SAFE.y };

/** The PNG as raw RGBA: { data, width, height, channels, hasAlpha }. */
async function pixels(buffer) {
  const meta = await sharp(buffer).metadata();
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels, hasAlpha: meta.hasAlpha, format: meta.format };
}
const alphaAt = (img, x, y) => img.data[(y * img.width + x) * img.channels + 3];
/** The largest and smallest alpha in a rectangle. */
function alphaRange(img, { x, y, w, h }) {
  let min = 255; let max = 0;
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      const a = alphaAt(img, xx, yy);
      if (a < min) min = a;
      if (a > max) max = a;
    }
  }
  return { min, max };
}
/** Whether any pixel outside the rectangle is not fully transparent. */
function anythingOutside(img, { x, y, w, h }) {
  for (let yy = 0; yy < img.height; yy += 1) {
    for (let xx = 0; xx < img.width; xx += 1) {
      if (xx >= x && xx < x + w && yy >= y && yy < y + h) continue;
      if (alphaAt(img, xx, yy) !== 0) return { x: xx, y: yy };
    }
  }
  return null;
}
/** Mean absolute difference per colour channel between two same-size RGB buffers. */
function meanDifference(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}
/** The frame's paper, scaled back to page rows y0..y1, as raw RGB. */
async function paperAsPage(panel, pageWidth) {
  const { rect, source } = panel;
  return sharp(panel.buffer).extract({ left: rect.x, top: rect.y, width: rect.w, height: rect.h })
    .resize(pageWidth, Math.round(source.y1 - source.y0), { fit: 'fill' }).removeAlpha().raw().toBuffer();
}
/** Rows y0..y1 of the canonical page, as raw RGB. */
async function pageRows(page, y0, y1, pageWidth) {
  return sharp(page).extract({ left: 0, top: Math.round(y0), width: pageWidth, height: Math.round(y1 - y0) }).removeAlpha().raw().toBuffer();
}
const withoutImages = (result) => ({ ...result, panels: result.panels.map(({ buffer: _buffer, ...rest }) => rest) });

describe('the in-world document presented for video (V1)', () => {
  test('the canvas dependency loads: these tests do not skip without it', () => {
    expect(drawingAvailable()).toBe(true);
  });

  test('the regions: the column is the safe area left of Prime\'s window, and the window reaches past the safe area', () => {
    const r = presentDocument('shopping_list', CASES[0][2], { presentation: 'floating' });
    expect(r.frame).toEqual({ width: 1920, height: 1080 });
    expect(r.column).toEqual(COLUMN);
    expect(r.clear_of).toEqual(WINDOW);
    // The window is the editor's own, 40 from the frame's right and bottom edges.
    expect(WINDOW.x + WINDOW.w).toBe(FRAME_W - 40);
    expect(WINDOW.y + WINDOW.h).toBe(FRAME_H - 40);
    // It reaches past the 5% safe area on the right and at the bottom.
    expect(WINDOW.x + WINDOW.w).toBeGreaterThan(FRAME_W - SAFE.x);
    expect(WINDOW.y + WINDOW.h).toBeGreaterThan(FRAME_H - SAFE.y);
    // The column stops 40 short of the window.
    expect(COLUMN.x + COLUMN.w).toBe(WINDOW.x - 40);
  });

  describe.each(EVERY)('%s', (_name, type, data, presentation) => {
    let result;
    let images;
    beforeAll(async () => {
      result = presentDocument(type, data, { presentation });
      images = await Promise.all(result.panels.map((p) => pixels(p.buffer)));
    });

    test('every frame is a 1920×1080 PNG with an alpha channel', () => {
      expect(result.panels.length).toBeGreaterThan(0);
      for (const img of images) {
        expect(img.format).toBe('png');
        expect([img.width, img.height]).toEqual([1920, 1080]);
        expect(img.channels).toBe(4);
        expect(img.hasAlpha).toBe(true);
      }
    });

    test('nothing is drawn outside the column: the paper and its shadow are inside it', () => {
      result.panels.forEach((panel, i) => {
        expect(anythingOutside(images[i], COLUMN)).toBeNull();
        const { rect } = panel;
        expect(rect.x).toBeGreaterThanOrEqual(COLUMN.x);
        expect(rect.y).toBeGreaterThanOrEqual(COLUMN.y);
        expect(rect.x + rect.w).toBeLessThanOrEqual(COLUMN.x + COLUMN.w);
        expect(rect.y + rect.h).toBeLessThanOrEqual(COLUMN.y + COLUMN.h);
      });
    });

    test("Prime's window is fully transparent, and so are the frame's corners", () => {
      images.forEach((img) => {
        expect(alphaRange(img, WINDOW)).toEqual({ min: 0, max: 0 });
        for (const [x, y] of [[0, 0], [FRAME_W - 1, 0], [0, FRAME_H - 1], [FRAME_W - 1, FRAME_H - 1]]) expect(alphaAt(img, x, y)).toBe(0);
      });
    });

    test('the paper is fully opaque, and there is a soft shadow just outside it', () => {
      result.panels.forEach((panel, i) => {
        const { rect } = panel;
        const inside = { x: rect.x + 1, y: rect.y + 1, w: rect.w - 2, h: rect.h - 2 };
        expect(alphaRange(images[i], inside)).toEqual({ min: 255, max: 255 });
        const below = alphaAt(images[i], rect.x + Math.floor(rect.w / 2), rect.y + rect.h + 3);
        expect(below).toBeGreaterThan(0);
        expect(below).toBeLessThan(255);
      });
    });

    test('the panels cover the whole page, in reading order, with no gap', () => {
      const { panels, page } = result;
      expect(panels[0].source.y0).toBe(0);
      expect(panels[panels.length - 1].source.y1).toBe(page.height);
      panels.forEach((panel, i) => {
        expect(panel.index).toBe(i + 1);
        expect(panel.of).toBe(panels.length);
        expect(panel.source.y1).toBeGreaterThan(panel.source.y0);
        if (i > 0) {
          const before = panels[i - 1];
          // It starts where the one before ended, or earlier by exactly its stated overlap.
          expect(panel.source.y0).toBe(before.source.y1 - panel.overlap);
          expect(panel.overlap).toBeGreaterThanOrEqual(0);
          expect(panel.source.y0).toBeGreaterThan(before.source.y0);
        } else {
          expect(panel.overlap).toBe(0);
        }
      });
    });

    test('every line of text is whole in at least one panel', () => {
      const { lines, height } = measureDocumentText(type, data);
      expect(height).toBe(result.page.height);
      expect(lines.length).toBeGreaterThan(3);
      // A line the canonical page itself cuts at its edge is counted, and is
      // whole here as far as the page has it.
      const past = lines.filter((l) => l.top < 0 || l.bottom > height);
      expect(result.text.past_page).toBe(past.length);
      for (const line of lines) {
        const top = Math.max(0, line.top);
        const bottom = Math.min(height, line.bottom);
        const whole = result.panels.some((p) => top >= p.source.y0 && bottom <= p.source.y1);
        expect({ line: [Math.round(top), Math.round(bottom)], whole }).toMatchObject({ whole: true });
      }
    });

    test('every small mark (a checkbox, a stamp\'s box, a name box) is whole in at least one panel', () => {
      const { marks, height } = measureDocumentText(type, data);
      expect(marks.length).toBeGreaterThan(0);
      for (const mark of marks) {
        const top = Math.max(0, mark.top);
        const bottom = Math.min(height, mark.bottom);
        const whole = result.panels.some((p) => top >= p.source.y0 && bottom <= p.source.y1);
        expect({ mark: [Math.round(top), Math.round(bottom)], whole }).toMatchObject({ whole: true });
      }
    });

    test('what a panel repeats from the one before is blank page: no line or mark lies in the repeated rows', () => {
      const { lines, marks } = measureDocumentText(type, data);
      result.panels.forEach((panel, i) => {
        if (i === 0 || panel.overlap === 0) return;
        const from = panel.source.y0;
        const to = result.panels[i - 1].source.y1;
        for (const b of [...lines, ...marks]) expect(b.bottom <= from || b.top >= to).toBe(true);
      });
    });

    test('each panel says the room at its edges, and it is what the page shows', () => {
      const { lines, marks, height } = measureDocumentText(type, data);
      const bands = [...lines, ...marks].map((b) => ({ top: Math.max(0, b.top), bottom: Math.min(height, b.bottom) })).filter((b) => b.bottom > b.top);
      for (const panel of result.panels) {
        const shown = bands.filter((b) => b.top >= panel.source.y0 && b.bottom <= panel.source.y1);
        // A panel of blank page (the foot of a short list) has no writing to keep room from.
        if (!shown.length) { expect(panel.padding).toEqual({ top: null, bottom: null }); continue; }
        expect(panel.padding.top).toBe(Math.round((Math.min(...shown.map((b) => b.top)) - panel.source.y0) * result.scale));
        expect(panel.padding.bottom).toBe(Math.round((panel.source.y1 - Math.max(...shown.map((b) => b.bottom))) * result.scale));
        expect(panel.padding.top).toBeGreaterThanOrEqual(0);
        expect(panel.padding.bottom).toBeGreaterThanOrEqual(0);
      }
    });

    test('each panel shows the canonical page: its paper, scaled back, matches the same rows of renderDocument', async () => {
      const page = renderDocument(type, data);
      for (const panel of result.panels) {
        const shown = await paperAsPage(panel, result.page.width);
        const canon = await pageRows(page, panel.source.y0, panel.source.y1, result.page.width);
        expect(shown.length).toBe(canon.length);
        expect(meanDifference(shown, canon)).toBeLessThan(6);
      }
    });

    test('the text sizes are measured from the drawing, and "readable" follows the body text on screen', () => {
      const { lines } = measureDocumentText(type, data);
      const drawn = new Set(lines.map((l) => l.px));
      expect(drawn.has(result.text.body_px)).toBe(true);
      expect(result.text.min_px).toBe(Math.min(...drawn));
      const tenth = (n) => Math.round(n * 10) / 10;
      expect(result.text.body_px_on_screen).toBe(tenth(result.text.body_px * result.scale));
      expect(result.text.min_px_on_screen).toBe(tenth(result.text.min_px * result.scale));
      expect(result.readable).toBe(result.text.body_px * result.scale >= MIN_READABLE_PX);
      // A line's measured height agrees with the font it was drawn in.
      for (const l of lines) {
        expect(l.bottom - l.top).toBeGreaterThan(0);
        expect(l.bottom - l.top).toBeLessThan(l.px * 1.6);
      }
    });

    test('the same input gives the same geometry, and the same frames', () => {
      const again = presentDocument(type, data, { presentation });
      expect(withoutImages(again)).toEqual(withoutImages(result));
      again.panels.forEach((p, i) => expect(p.buffer.equals(result.panels[i].buffer)).toBe(true));
    });

    test('the result holds geometry and images, none of the document\'s words', () => {
      const text = JSON.stringify(withoutImages(result));
      for (const word of ['Velour', 'Lala', 'gown', 'Piece number', 'Dear', 'Mara', 'Compensation', 'earrings']) expect(text).not.toContain(word);
    });
  });

  describe('a page that cuts its own last line (as renderDocument does today for a full list with a note)', () => {
    test('it is counted in text.past_page; nothing else is, and no document here loses a line in the middle', () => {
      const counts = Object.fromEntries(CASES.map(([name, type, data]) => [name, presentDocument(type, data, { presentation: 'reading' }).text.past_page]));
      expect(counts).toEqual({ 'a short shopping list': 0, 'a full shopping list': 1, 'a short offer letter': 0, 'a long offer letter': 0 });
    });
  });

  describe('where a reading panel is cut', () => {
    const FULL = { doc: LONG_LIST, event: EVENT, pieces: null };
    const LONG = { doc: LETTER, event: EVENT, terms: TERMS };
    /** The edges of a reading result's panels that are cuts (not the page's own top or bottom), as paddings. */
    const cutEdges = (r) => r.panels.flatMap((p, i) => [i > 0 ? p.padding.top : null, i < r.panels.length - 1 ? p.padding.bottom : null].filter((n) => n != null));

    test('the padding aimed for is 32 px', () => {
      expect(EDGE_PADDING_PX).toBe(32);
    });

    test('a long offer letter: every cut edge has 32 px or more before the writing', () => {
      const r = presentDocument('offer_letter', LONG, { presentation: 'reading' });
      expect(r.panels.length).toBeGreaterThan(1);
      const edges = cutEdges(r);
      expect(edges.length).toBe((r.panels.length - 1) * 2);
      for (const px of edges) expect(px).toBeGreaterThanOrEqual(EDGE_PADDING_PX);
    });

    test('a full shopping list, whose rows leave less than that: each cut edge has the whole gap between two rows, the most the page has', () => {
      const r = presentDocument('shopping_list', FULL, { presentation: 'reading' });
      const { lines, marks } = measureDocumentText('shopping_list', FULL);
      const bands = [...lines, ...marks];
      expect(r.panels).toHaveLength(2);
      const [first, second] = r.panels;
      // The rows it was cut between, and the blank page between them.
      const above = Math.max(...bands.filter((b) => b.bottom <= second.source.y0 + 1).map((b) => b.bottom));
      const below = Math.min(...bands.filter((b) => b.top >= first.source.y1 - 1).map((b) => b.top));
      const gap = Math.round((below - above) * r.scale);
      expect(gap).toBeLessThan(EDGE_PADDING_PX * 2);
      expect(first.padding.bottom).toBeGreaterThanOrEqual(gap - 2);
      expect(second.padding.top).toBeGreaterThanOrEqual(gap - 2);
      // Twice what one cut down the middle of that gap would leave on each side.
      expect(first.padding.bottom).toBeGreaterThan(gap / 2 + 2);
      expect(second.padding.top).toBeGreaterThan(gap / 2 + 2);
      expect(second.overlap).toBeGreaterThan(0);
    });

    test('no checkbox is sliced: the rows of pixels at each cut edge hold none of a checkbox\'s ink', async () => {
      const r = presentDocument('shopping_list', FULL, { presentation: 'reading' });
      const { marks } = measureDocumentText('shopping_list', FULL);
      // The checkboxes: the marks about 33 tall (a 30 px box and its 3 px line), below the heading.
      const boxes = marks.filter((m) => m.top > 150 && m.bottom - m.top > 28 && m.bottom - m.top < 40);
      expect(boxes.length).toBe(15);
      for (const box of boxes) expect(r.panels.filter((p) => box.top >= p.source.y0 && box.bottom <= p.source.y1).length).toBeGreaterThanOrEqual(1);
      // A box is drawn in the list's ink (#2C2C2C) between page x 108 and 142.
      const dark = (img, x, y) => {
        const i = (y * img.width + x) * img.channels;
        return img.data[i] < 90 && img.data[i + 1] < 90 && img.data[i + 2] < 90 && img.data[i + 3] === 255;
      };
      for (const [i, panel] of r.panels.entries()) {
        const img = await pixels(panel.buffer);
        const x0 = panel.rect.x + Math.floor(104 * r.scale);
        const x1 = panel.rect.x + Math.ceil(146 * r.scale);
        const rows = [];
        if (i > 0) rows.push(panel.rect.y, panel.rect.y + 1, panel.rect.y + 2);
        if (i < r.panels.length - 1) rows.push(panel.rect.y + panel.rect.h - 1, panel.rect.y + panel.rect.h - 2, panel.rect.y + panel.rect.h - 3);
        for (const y of rows) for (let x = x0; x <= x1; x += 1) expect({ x, y, ink: dark(img, x, y) }).toMatchObject({ ink: false });
      }
    });

    test('the offer letter\'s stamp and its name boxes are marks, and none is sliced', () => {
      const r = presentDocument('offer_letter', LONG, { presentation: 'reading' });
      const { marks } = measureDocumentText('offer_letter', LONG);
      expect(marks.length).toBeGreaterThanOrEqual(3);
      for (const m of marks) expect(r.panels.some((p) => Math.max(0, m.top) >= p.source.y0 && m.bottom <= p.source.y1)).toBe(true);
    });

    test('the page\'s own frame is not a mark: a rectangle taller than a mark may be is left out', () => {
      const { marks, height } = measureDocumentText('offer_letter', LONG);
      for (const m of marks) expect(m.bottom - m.top).toBeLessThanOrEqual(160);
      expect(Math.max(...marks.map((m) => m.bottom - m.top))).toBeLessThan(height / 4);
    });
  });

  describe('readability', () => {
    test('reading panels show body text at 28 px or more, for every document', () => {
      for (const [, type, data] of CASES) {
        const r = presentDocument(type, data, { presentation: 'reading' });
        expect(r.text.body_px_on_screen).toBeGreaterThanOrEqual(MIN_READABLE_PX);
        expect(r.readable).toBe(true);
      }
      expect(MIN_READABLE_PX).toBe(28);
    });

    test('a long offer letter, floating, is below 28 px and is not called readable', () => {
      const r = presentDocument('offer_letter', { doc: LETTER, event: EVENT, terms: TERMS }, { presentation: 'floating' });
      expect(r.panels).toHaveLength(1);
      expect(r.text.body_px_on_screen).toBeLessThan(MIN_READABLE_PX);
      expect(r.readable).toBe(false);
    });

    test('a short shopping list, floating, is readable as it is', () => {
      const r = presentDocument('shopping_list', { doc: SHORT_LIST, event: EVENT, pieces: null }, { presentation: 'floating' });
      expect(r.readable).toBe(true);
    });

    test('a long offer letter takes more than one reading panel, each no taller than the column', () => {
      const r = presentDocument('offer_letter', { doc: LETTER, event: EVENT, terms: TERMS }, { presentation: 'reading' });
      expect(r.panels.length).toBeGreaterThan(1);
      for (const p of r.panels) expect(p.rect.h).toBeLessThanOrEqual(COLUMN.h);
    });
  });

  describe('where a panel ends (panelSlices)', () => {
    const line = (top, bottom) => ({ top, bottom, px: bottom - top, width: 100 });

    test('a page that fits is one panel', () => {
      expect(panelSlices(700, 718, [line(10, 40)])).toEqual([{ y0: 0, y1: 700, overlap: 0 }]);
    });

    test('a panel ends in a gap between lines, never through one', () => {
      const lines = [line(100, 140), line(690, 730), line(900, 940)];
      const slices = panelSlices(1000, 718, lines);
      expect(slices).toHaveLength(2);
      expect(slices[0].y1).toBe(slices[1].y0);
      expect(slices[1].overlap).toBe(0);
      for (const l of lines) expect(l.top < slices[0].y1 && l.bottom > slices[0].y1).toBe(false);
    });

    test('no gap in the lower half: the next panel repeats 80 px, and every line is whole somewhere', () => {
      // Text packed solid from 300 to 1100: lines 40 apart, each reaching 2 px into the next, so no gap.
      const lines = Array.from({ length: 20 }, (_, i) => line(300 + i * 40, 342 + i * 40));
      const slices = panelSlices(1200, 718, lines);
      expect(PANEL_OVERLAP).toBe(80);
      expect(slices[0]).toEqual({ y0: 0, y1: 718, overlap: 0 });
      expect(slices[1].overlap).toBe(80);
      expect(slices[1].y0).toBe(718 - 80);
      for (const l of lines) expect(slices.some((s) => l.top >= s.y0 && l.bottom <= s.y1)).toBe(true);
    });

    test('a cut line taller than 80 px: the next panel starts at its top, so it is whole there', () => {
      const lines = [...Array.from({ length: 9 }, (_, i) => line(300 + i * 40, 342 + i * 40)), line(600, 760)];
      const slices = panelSlices(1200, 718, lines);
      expect(slices[1].y0).toBe(600);
      expect(slices[1].overlap).toBe(718 - 600);
      for (const l of lines) expect(slices.some((s) => l.top >= s.y0 && l.bottom <= s.y1)).toBe(true);
    });

    test('a line taller than a panel is an error that says so, not a clipped line', () => {
      expect(() => panelSlices(2000, 718, [line(100, 900)])).toThrow(DocumentPresentationError);
      try { panelSlices(2000, 718, [line(100, 900)]); } catch (err) { expect(err.code).toBe('TEXT_TALLER_THAN_PANEL'); }
    });

    test('a boundary that would make no progress is an error, not a clipped line or an endless loop', () => {
      // A panel shorter than the overlap, over text with no gap: stepping back 80 px goes nowhere.
      const lines = Array.from({ length: 30 }, (_, i) => line(10 + i * 20, 32 + i * 20));
      let thrown = null;
      try { panelSlices(700, 60, lines); } catch (err) { thrown = err; }
      expect(thrown).toBeInstanceOf(DocumentPresentationError);
      expect(thrown.code).toBe('NO_SAFE_PANEL_BOUNDARY');
    });

    test('with padding asked for: a cut is placed where both sides have that much room, when the lower half has such a place', () => {
      const lines = [line(100, 140), line(400, 430), line(520, 560), line(700, 740), line(900, 940)];
      const slices = panelSlices(1000, 718, lines, { pad: 25 });
      const cut = slices[0].y1;
      expect(slices[1]).toEqual({ y0: cut, y1: 1000, overlap: 0 });
      for (const l of lines) expect(l.bottom <= cut - 25 || l.top >= cut + 25).toBe(true);
    });

    test('with padding asked for and only narrow gaps: the widest gap is used, and both panels show all of it', () => {
      // Rows 40 tall, 10 apart, down the whole lower half.
      const lines = Array.from({ length: 22 }, (_, i) => line(100 + i * 50, 140 + i * 50));
      const slices = panelSlices(1300, 718, lines, { pad: 25 });
      const [first, second] = slices;
      expect(second.overlap).toBe(10);
      expect(first.y1 - second.y0).toBe(10);
      // The first ends where the next row begins; the second starts where the last row ended.
      expect(lines.some((l) => l.top === first.y1)).toBe(true);
      expect(lines.some((l) => l.bottom === second.y0)).toBe(true);
      for (const l of lines) expect(slices.some((s) => l.top >= s.y0 && l.bottom <= s.y1)).toBe(true);
    });

    test('with no padding asked for, a cut still never goes through a line', () => {
      const lines = Array.from({ length: 22 }, (_, i) => line(100 + i * 50, 140 + i * 50));
      const slices = panelSlices(1300, 718, lines);
      for (const s of slices.slice(0, -1)) for (const l of lines) expect(l.top < s.y1 && l.bottom > s.y1).toBe(false);
    });

    test('whatever the lines, the slices cover the page and keep every line whole, or it throws', () => {
      let seed = 7;
      const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
      for (let n = 0; n < 300; n += 1) {
        const height = 760 + Math.floor(rand() * 940);
        const lines = [];
        let y = 60 + rand() * 80;
        while (y < height - 60) {
          const h = 16 + rand() * 60;
          lines.push(line(y, Math.min(height - 1, y + h)));
          y += h + (rand() < 0.35 ? 0 : rand() * 40);
        }
        let slices;
        try { slices = panelSlices(height, 718, lines, { pad: n % 2 ? 25 : 0 }); } catch (err) { expect(err).toBeInstanceOf(DocumentPresentationError); continue; }
        expect(slices[0].y0).toBe(0);
        expect(slices[slices.length - 1].y1).toBe(height);
        slices.forEach((s, i) => {
          expect(s.y1 - s.y0).toBeLessThanOrEqual(718);
          if (i > 0) expect(s.y0).toBe(slices[i - 1].y1 - s.overlap);
        });
        for (const l of lines) expect(slices.some((s) => l.top >= s.y0 && l.bottom <= s.y1)).toBe(true);
      }
    });
  });

  describe('one document, one generator', () => {
    test('two presentations, and the two document types there were', () => {
      expect([...PRESENTATIONS]).toEqual(['floating', 'reading']);
      const { DOC_TYPES } = require('../../../src/services/eventDocumentsService');
      expect(Object.keys(DOC_TYPES).sort()).toEqual(['offer_letter', 'shopping_list']);
    });

    test('a type that has no draw function is not presented (as renderDocument), and an unknown presentation is refused', () => {
      expect(renderDocument('career_plan', {})).toBeNull();
      expect(presentDocument('career_plan', {}, { presentation: 'floating' })).toBeNull();
      expect(() => presentDocument('shopping_list', CASES[0][2], { presentation: 'poster' })).toThrow(DocumentPresentationError);
    });

    test('the presentation draws with the service\'s one draw registry and adds no second one', () => {
      const source = require('fs').readFileSync(require.resolve('../../../src/services/eventDocumentOverlayService'), 'utf8');
      expect(source.match(/const DRAW = /g)).toHaveLength(1);
      expect(source).toMatch(/const DRAW = \{ shopping_list: drawShoppingList, offer_letter: drawOfferLetter \};/);
      expect(presentDocument.toString()).toContain('DRAW[type]');
      expect(source.match(/function drawShoppingList\(/g)).toHaveLength(1);
      expect(source.match(/function drawOfferLetter\(/g)).toHaveLength(1);
      // No storage, database or asset write in the presentation path.
      for (const fn of [presentDocument, measureDocumentText, panelSlices]) {
        expect(fn.toString()).not.toMatch(/sequelize|INSERT|storePng|S3Client|assets/);
      }
    });

    test('what the module offers: the presentation is added, nothing is taken away', () => {
      const V1 = [
        'DocumentPresentationError', 'EDGE_PADDING_PX', 'MIN_READABLE_PX', 'PANEL_OVERLAP', 'PRESENTATIONS',
        'documentByline', 'drawingAvailable', 'makeDocumentOverlay', 'measureDocumentText', 'overlayState',
        'panelSlices', 'presentDocument', 'renderDocument', 'shoppingLines', 'shoppingListContext',
      ];
      // V2-2a-2 (2026-11-20): keeping the panels. Added beside V1's, which are all still there.
      const STORED = [
        'LABELS', 'PRESENTATION_REVISION', 'PresentationStorageError', 'documentDrawData', 'drawPresentations',
        'presentationPanelId', 'presentationRenderKey', 'presentationSetId', 'presentationStorageAvailable',
        'readStoredImage', 'sha256', 'storePresentationPanel',
      ];
      expect(Object.keys(svc).sort()).toEqual([...V1, ...STORED].sort());
    });
  });

  describe('the page itself is as it was (renderDocument)', () => {
    test.each(CASES)('%s: 900 wide, within its height limits, fully opaque, the same bytes each time, untouched by presenting it', async (_name, type, data) => {
      const before = renderDocument(type, data);
      const snapshot = JSON.stringify(data);
      presentDocument(type, data, { presentation: 'floating' });
      presentDocument(type, data, { presentation: 'reading' });
      const after = renderDocument(type, data);
      expect(after.equals(before)).toBe(true);
      expect(JSON.stringify(data)).toBe(snapshot);
      const img = await pixels(before);
      expect(img.width).toBe(900);
      expect(img.height).toBeGreaterThanOrEqual(760);
      expect(img.height).toBeLessThanOrEqual(type === 'offer_letter' ? 1700 : 1200);
      expect(alphaRange(img, { x: 0, y: 0, w: img.width, h: img.height })).toEqual({ min: 255, max: 255 });
    });
  });
});
