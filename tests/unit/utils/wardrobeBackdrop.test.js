/**
 * The wardrobe backdrop for server drawings (Task #3151): its slot colours
 * are the design tokens' values the CSS backdrop uses, so a piece looks the
 * same on the style sheet as in Producer Mode's closet. No canvas needed.
 */
const fs = require('fs');
const path = require('path');
const { SLOT_BACKDROP, SHEET_COLUMN_SLOT, GLOW, backdropColor, paintBackdrop } = require('../../../src/utils/wardrobeBackdrop');

const FRONT = path.resolve(__dirname, '../../../frontend/src/styles');
const tokens = fs.readFileSync(path.join(FRONT, 'design-tokens.css'), 'utf8');
const backdropCss = fs.readFileSync(path.join(FRONT, 'wardrobe-backdrop.css'), 'utf8');
const tokenValue = (name) => {
  const m = tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  return m ? m[1].toLowerCase() : null;
};
// The token each slot's CSS rule sets --bd to (the default rule for 'other').
const cssTokenFor = (slot) => {
  const rule = slot === 'other'
    ? backdropCss.match(/\.wa-wd-backdrop \{ --bd: var\(--([a-z0-9-]+)\)/)
    : backdropCss.match(new RegExp(`\\.wa-wd-backdrop\\.bd-${slot} \\{ --bd: var\\(--([a-z0-9-]+)\\)`));
  return rule ? rule[1] : null;
};

describe('wardrobe backdrop colours match the CSS', () => {
  test.each(Object.keys(SLOT_BACKDROP))('%s', (slot) => {
    const token = cssTokenFor(slot);
    expect(token).toBeTruthy();
    expect(SLOT_BACKDROP[slot].toLowerCase()).toBe(tokenValue(token));
  });

  test('the glow is the card surface, as the CSS gradient starts', () => {
    expect(backdropCss).toMatch(/radial-gradient\(ellipse 70% 60% at 50% 45%, var\(--surface-card\) 0%, var\(--bd\) 72%\)/);
    expect(GLOW).toBe(tokenValue('surface-card'));
  });

  test("the server's column map is the template's, so the app and the export agree", () => {
    const jsx = fs.readFileSync(path.resolve(__dirname, '../../../frontend/src/components/Episodes/StyleSheetTemplate.jsx'), 'utf8');
    const m = jsx.match(/export const COLUMN_BACKDROP = Object\.freeze\((\{[^}]*\})\)/);
    expect(m).toBeTruthy();
    const frontMap = JSON.parse(m[1].replace(/(\w+):/g, '"$1":').replace(/'/g, '"'));
    expect(frontMap).toEqual(SHEET_COLUMN_SLOT);
  });

  test("the style sheet's piece columns map to slots; hair and nails are not pieces", () => {
    expect(SHEET_COLUMN_SLOT).toEqual({ body: 'body', shoes: 'shoes', bag: 'accessories', jewelry: 'jewelry', perfume: 'perfume' });
    expect(SHEET_COLUMN_SLOT.hair).toBeUndefined();
    expect(backdropColor('nope')).toBe(SLOT_BACKDROP.other);
  });
});

describe('paintBackdrop', () => {
  test('fills the box with the slot colour, then the glow, clipped and restored', () => {
    const calls = [];
    const gradient = { stops: [], addColorStop(at, c) { this.stops.push([at, c]); } };
    const ctx = new Proxy({}, {
      get: (t, k) => {
        if (k === 'createRadialGradient') return (...a) => { calls.push(['gradient', ...a]); return gradient; };
        if (k in t) return t[k];
        if (k === 'roundRect') return undefined;
        return (...a) => calls.push([k, ...a]);
      },
      set: (t, k, v) => { t[k] = v; calls.push(['set', k, v]); return true; },
    });
    paintBackdrop(ctx, 'shoes', 10, 20, 100, 200, { radius: 8 });
    const names = calls.map((c) => c[0]);
    expect(names[0]).toBe('save');
    expect(names).toContain('clip');
    expect(calls).toContainEqual(['set', 'fillStyle', SLOT_BACKDROP.shoes]);
    expect(calls).toContainEqual(['fillRect', 10, 20, 100, 200]);
    expect(calls).toContainEqual(['translate', 60, 20 + 0.45 * 200]);
    expect(calls).toContainEqual(['scale', 70, 120]);
    expect(gradient.stops).toEqual([[0, '#ffffff'], [0.72, `${SLOT_BACKDROP.shoes}00`], [1, `${SLOT_BACKDROP.shoes}00`]]);
    expect(names[names.length - 1]).toBe('restore');
  });
});
