/**
 * frontend/src/lib/scriptMoments.js EXPECTED_ON_SCREEN mirrors
 * src/constants/canonicalBeats.js (Task #2789): each of the 14 beats names
 * its screen_action, and where it shows reads its surface.
 */
const fs = require('fs');
const path = require('path');
const { CANONICAL_BEATS } = require('../../../src/constants/canonicalBeats');

const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'lib', 'scriptMoments.js'), 'utf8');
const rows = [...src.matchAll(/(\d+): \{ action: '([A-Z_]+)', what: (?:'[^']*'|"[^"]*"), where: ("[^"]*"|'[^']*'|null) \}/g)]
  .map((m) => ({ number: Number(m[1]), action: m[2], where: m[3] === 'null' ? null : m[3].slice(1, -1) }));

const whereOf = (surface) => {
  if (surface && typeof surface === 'object') return `${surface.start} → ${surface.end}`;
  return surface === 'none' ? null : surface;
};

describe('frontend script moments', () => {
  test('every canonical beat, its screen action and its surface', () => {
    expect(rows).toEqual(CANONICAL_BEATS.map((b) => ({ number: b.number, action: b.screen_action, where: whereOf(b.surface) })));
  });
});
