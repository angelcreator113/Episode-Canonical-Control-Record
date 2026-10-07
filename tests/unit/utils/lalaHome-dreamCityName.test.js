/**
 * dreamCityName: a text naming one of the five DREAM cities, by name or
 * key, comes back spelled as DREAM_CITIES spells it; anything else is null
 * (wiring map, fix-list item 18).
 */
const { dreamCityName, DREAM_CITIES } = require('../../../src/utils/lalaHome');

describe('dreamCityName', () => {
  test('a name or key in any case is the canonical name', () => {
    expect(dreamCityName('Echo Park')).toBe('Echo Park');
    expect(dreamCityName('  echo   park ')).toBe('Echo Park');
    expect(dreamCityName('maverick_harbor')).toBe('Maverick Harbor');
    expect(dreamCityName('radiance-row')).toBe('Radiance Row');
    for (const c of DREAM_CITIES) expect(dreamCityName(c.toUpperCase())).toBe(c);
  });

  test('a legacy or unknown city, or nothing, is null', () => {
    expect(dreamCityName('Nova Prime')).toBeNull();
    expect(dreamCityName('Pulse City')).toBeNull();
    expect(dreamCityName('')).toBeNull();
    expect(dreamCityName(null)).toBeNull();
    expect(dreamCityName(undefined)).toBeNull();
  });
});
