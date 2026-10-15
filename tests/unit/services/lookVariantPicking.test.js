/**
 * The right picture, automatically (step 4 of
 * docs/VENUE_EVERYDAY_AND_EVENT_LOOKS_PLAN.md). Evoni, 2026-10-15: beats
 * 1-9 just before the event, 10-12 at the event's time, 13-14 at night;
 * the event date's season for Front pictures.
 */
const { beatTimeOfDay, variantFor, applyVariant } = require('../../../src/services/lookVariantPicking');

const variants = {
  time: new Map([['golden_hour', 'https://x/golden.jpg'], ['night', 'https://x/night.jpg']]),
  season: new Map([['winter', { url: 'https://x/winter.jpg', angleId: 'a-front' }]]),
};
const base = { url: 'https://x/base.jpg', source: 'base', label: 'Loft · Inside' };
const front = { url: 'https://x/front.jpg', source: 'angle', label: 'Gala Hall · Front steps' };

describe('beatTimeOfDay', () => {
  test('before the event one step earlier, the event beats at its time, recap and cliffhanger at night', () => {
    expect(beatTimeOfDay(1, 'evening')).toBe('golden_hour');
    expect(beatTimeOfDay(9, 'evening')).toBe('golden_hour');
    expect(beatTimeOfDay(10, 'evening')).toBe('evening');
    expect(beatTimeOfDay(12, 'evening')).toBe('evening');
    expect(beatTimeOfDay(13, 'evening')).toBe('night');
    expect(beatTimeOfDay(14, null)).toBe('night');
    expect(beatTimeOfDay(3, 'morning')).toBe('morning');
    expect(beatTimeOfDay(3, null)).toBeNull();
  });
});

describe('variantFor and applyVariant', () => {
  const pick = (over) => variantFor({ picture: base, angleKind: null, everyday: true, variants, beatNumber: 2, moment: { time: 'evening', season: 'winter' }, ...over });

  test('the everyday look takes the beat\'s time of day', () => {
    const v = pick();
    expect(v).toEqual({ kind: 'time', value: 'golden_hour', label: 'Golden hour', url: 'https://x/golden.jpg' });
    expect(applyVariant(base, v, 'Loft')).toEqual({
      url: 'https://x/golden.jpg', source: 'variant_time', plain_url: 'https://x/base.jpg', label: 'Loft · Inside · Golden hour',
    });
  });

  test('the Front view takes the event\'s season; another Front angle keeps its own picture', () => {
    expect(pick({ picture: front, angleKind: 'front', angleId: 'a-doorway', beatNumber: 10 })).toBeNull();
    const v = pick({ picture: front, angleKind: 'front', angleId: 'a-front', beatNumber: 10 });
    expect(v).toMatchObject({ kind: 'season', value: 'winter', url: 'https://x/winter.jpg' });
    expect(applyVariant(front, v, 'Gala Hall').label).toBe('Gala Hall · Front steps · Winter');
  });

  test('a missing variant keeps the plain picture and names the gap in its label', () => {
    const v = pick({ beatNumber: 11 });
    expect(v).toMatchObject({ value: 'evening', url: null });
    const out = applyVariant(base, v, 'Loft');
    expect(out.url).toBe('https://x/base.jpg');
    expect(out.label).toBe('Loft · Inside (no Evening variant yet)');
    expect(out.variant_missing).toEqual({ kind: 'time', value: 'evening', label: 'Evening', text: 'Loft has no Evening variant yet' });
  });

  test('nothing applies off the everyday set, without an event, to the event look or a dressed angle, or a non-Front angle', () => {
    expect(pick({ everyday: false })).toBeNull();
    expect(pick({ moment: null })).toBeNull();
    expect(pick({ picture: { ...base, source: 'look' } })).toBeNull();
    expect(pick({ picture: { ...front, source: 'dressed' }, angleKind: 'front' })).toBeNull();
    expect(pick({ picture: front, angleKind: 'inside' })).toBeNull();
    expect(pick({ picture: front, angleKind: 'front', moment: { time: 'evening', season: null } })).toBeNull();
    expect(pick({ moment: { time: null, season: 'winter' } })).toBeNull();
    expect(applyVariant(base, null, 'Loft')).toBe(base);
  });
});
