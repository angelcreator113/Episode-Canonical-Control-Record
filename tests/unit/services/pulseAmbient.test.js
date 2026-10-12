/**
 * Ambient posts (Task #2971): windows, the day's ambient share of the cap
 * (the rest kept for event posts), and picks by temperament, seeded by the
 * window so a restart picks the same.
 */
const { windowOf, ambientRoom, pickAmbient, WINDOW_HOURS, RESERVE_FOR_EVENTS } = require('../../../src/services/pulseAmbient');

describe('windowOf', () => {
  test(`one window per ${WINDOW_HOURS} hours`, () => {
    const t = Date.UTC(2026, 9, 12, 0, 0, 0);
    expect(windowOf(new Date(t))).toBe(windowOf(new Date(t + (WINDOW_HOURS * 3600 - 1) * 1000)));
    expect(windowOf(new Date(t + WINDOW_HOURS * 3600 * 1000))).toBe(windowOf(new Date(t)) + 1);
  });
});

describe('ambientRoom', () => {
  test('ambient gets its share of the cap; the rest is kept for event posts', () => {
    expect(RESERVE_FOR_EVENTS).toBe(0.5);
    expect(ambientRoom({ cap: 30, ambientToday: 0 })).toBe(15);
    expect(ambientRoom({ cap: 30, ambientToday: 14 })).toBe(1);
    expect(ambientRoom({ cap: 30, ambientToday: 20 })).toBe(0);
    expect(ambientRoom({ cap: 1, ambientToday: 0 })).toBe(0);
  });
});

describe('pickAmbient', () => {
  const people = [{ characterId: 'over', temperament: 'oversharer' }, { characterId: 'reg', temperament: 'regular' }, { characterId: 'lurk', temperament: 'lurker' }];

  test('the same window always picks the same; at most the limit', () => {
    expect(pickAmbient(people, 42, 3)).toEqual(pickAmbient(people, 42, 3));
    expect(pickAmbient(people, 42, 1).length).toBeLessThanOrEqual(1);
    expect(pickAmbient(people, 42, 0)).toEqual([]);
  });

  test('oversharers post often, lurkers rarely, across many windows', () => {
    const count = { over: 0, reg: 0, lurk: 0 };
    for (let w = 0; w < 300; w += 1) for (const p of pickAmbient(people, w, 3)) count[p.characterId] += 1;
    expect(count.over).toBeGreaterThan(220);
    expect(count.reg).toBeGreaterThan(100);
    expect(count.reg).toBeLessThan(200);
    expect(count.lurk).toBeLessThan(60);
  });
});
