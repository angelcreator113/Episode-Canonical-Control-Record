/**
 * frontend/src/lib/canonicalBeats.js mirrors src/constants/canonicalBeats.js
 * (2026-10-04): the same 14 numbers and names in order, and `phone` is true
 * exactly where the beat's surface (or its start) is Lala's Phone.
 */
const fs = require('fs');
const path = require('path');
const { CANONICAL_BEATS } = require('../../../src/constants/canonicalBeats');

const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'lib', 'canonicalBeats.js'), 'utf8');
const rows = [...src.matchAll(/\{ number: (\d+), name: '([^']+)', phone: (true|false) \}/g)]
  .map((m) => ({ number: Number(m[1]), name: m[2], phone: m[3] === 'true' }));

describe('frontend canonical beats', () => {
  test('the same 14 beats, in order, with the phone surface', () => {
    expect(rows).toHaveLength(14);
    expect(rows).toEqual(CANONICAL_BEATS.map((b) => {
      const surface = typeof b.surface === 'object' && b.surface ? b.surface.start : b.surface;
      return { number: b.number, name: b.name, phone: surface === "Lala's Phone" };
    }));
  });
});
