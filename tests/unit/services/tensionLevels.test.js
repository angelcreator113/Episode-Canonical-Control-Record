// ============================================================================
// UNIT TEST — which relationship tension states count as high
// ============================================================================
// The tension scanner and the context summary (src/routes/worldStudio.js)
// share isHighTension. Each kept its own list until 2026-10-07, and neither
// had lowercase 'unresolved' (wiring map fix-list item 5).

const { HIGH_TENSION_STATES, isHighTension } = require('../../../src/services/tensionLevels');

describe('isHighTension', () => {
  test('the four high states count, in any case and with stray spaces', () => {
    for (const s of ['Simmering', 'simmering', 'Unresolved', 'unresolved', 'UNRESOLVED', 'High', 'high', 'Explosive', 'explosive', ' Explosive ']) {
      expect(isHighTension(s)).toBe(true);
    }
    expect(HIGH_TENSION_STATES).toEqual(['simmering', 'unresolved', 'high', 'explosive']);
  });

  test('calm states, empty values and non-strings do not', () => {
    for (const s of ['Stable', 'calm', 'Low', 'cooling', '', '   ', null, undefined, 3, {}]) {
      expect(isHighTension(s)).toBe(false);
    }
  });
});
