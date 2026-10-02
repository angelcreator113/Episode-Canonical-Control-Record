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
    expect(out.not_ready).toEqual([
      { beat_number: 2, beat_name: 'Beat 2', text: 'Apartment has no base image' },
      { beat_number: 10, beat_name: 'Beat 10', text: 'Front zone missing' },
      { beat_number: 11, beat_name: 'Beat 11', text: 'No location' },
    ]);
  });

  test('an empty plan is not ready and not short', () => {
    expect(planReadiness([])).toEqual({ ready: 0, total: 0, not_ready: [] });
  });
});
