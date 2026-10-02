/**
 * Production readiness (Evoni's ruling L5 and her answer Q21, 2026-10-02,
 * docs/EVENT_EPISODE_FLOW.md §8(hh)): "every planned beat has an angle with
 * an image"; flagged, never blocking. A beat that asks for no angle is shot
 * on its set's base image.
 */
const { planReadiness } = require('../../../src/services/planLocationsService');

const row = (n, extra = {}) => ({ beat_number: n, beat_name: `Beat ${n}`, scene_set_id: 'set-1', sceneSet: { name: 'Apartment', base_still_url: 'base.jpg' }, location: { angle: null, missing: null }, ...extra });

describe('planReadiness (L5, Q21)', () => {
  test('every beat with its image is ready', () => {
    expect(planReadiness([row(1), row(10, { location: { angle: { still_image_url: 'door.jpg' }, missing: null } })]))
      .toEqual({ ready: 2, total: 2, not_ready: [] });
  });

  test('a missing angle, a missing base image and a missing location each count, with their reason', () => {
    const out = planReadiness([
      row(1),
      row(2, { sceneSet: { name: 'Apartment', base_still_url: null } }),
      row(10, { location: { angle: null, missing: { text: 'Front zone missing' } } }),
      row(11, { scene_set_id: null, sceneSet: null }),
    ]);
    expect(out.ready).toBe(1);
    expect(out.total).toBe(4);
    expect(out.not_ready.map(({ fix, ...item }) => item)).toEqual([
      { beat_number: 2, beat_name: 'Beat 2', text: 'Apartment has no base image' },
      { beat_number: 10, beat_name: 'Beat 10', text: 'Front zone missing' },
      { beat_number: 11, beat_name: 'Beat 11', text: 'No location' },
    ]);
  });

  test('an empty plan is not ready and not short', () => {
    expect(planReadiness([])).toEqual({ ready: 0, total: 0, not_ready: [] });
  });
});

// S9 (a) (Evoni, 2026-10-02; §8(hh)): "an accurate background summary, such
// as 12 ready · 2 need attention ... The count should reflect usable
// assignments, including missing views and removed sets"; each item says
// how to fix it.
describe('planReadiness: what needs attention, and its fix (S9 a)', () => {
  test('a beat at a removed set needs attention, even when that set has a base image', () => {
    const out = planReadiness([
      row(1, { scene_set_id: 'gone', sceneSet: { id: 'gone', name: "Lala's Closet", base_still_url: 'base.jpg', removed: true } }),
      row(2),
    ]);
    expect(out.ready).toBe(1);
    expect(out.not_ready).toEqual([
      { beat_number: 1, beat_name: 'Beat 1', text: "Lala's Closet was removed", fix: { kind: 'removed_set', scene_set_id: 'gone' } },
    ]);
  });

  test('each other item names its fix: the zone in Scene Sets, the set\'s base, or the episode\'s locations', () => {
    const out = planReadiness([
      row(2, { sceneSet: { id: 'set-1', name: 'Apartment', base_still_url: null } }),
      row(10, { location: { angle: null, missing: { text: 'Front zone missing', kind: 'front', angle_id: null } } }),
      row(11, { location: { angle: null, missing: { text: 'Bar area has no image', kind: 'area', angle_id: 'angle-9' } } }),
      row(12, { scene_set_id: null, sceneSet: null }),
    ]);
    expect(out.not_ready.map((b) => b.fix)).toEqual([
      { kind: 'scene_set', scene_set_id: 'set-1', zone: null },
      { kind: 'scene_set', scene_set_id: 'set-1', zone: 'front' },
      { kind: 'scene_set', scene_set_id: 'set-1', zone: 'angle-9' },
      { kind: 'locations' },
    ]);
  });
});
