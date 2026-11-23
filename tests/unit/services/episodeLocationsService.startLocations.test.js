/**
 * Start Episode's locations step and Resume setup's check of it (Generation
 * B3 and its correction; Evoni, 2026-11-23;
 * docs/audit/F-AUTH-1_PlaceLockGenerationB3_Amendment_2026-11-23.md).
 *
 * applyStartLocations: two assertions that
 * episodeGeneratorService.startTransaction.test.js made of the old
 * post-commit link live here now, where the write is: the locations are
 * written in a transaction of their own (the finalizer's), and a failure is
 * logged and does not throw.
 *
 * locationsStepGaps: what Resume setup asks of an episode before it calls a
 * failed locations step done. Pure: no database.
 */
// Only its pause and its error-class name are read here; the real module loads the image and cost services.
jest.mock('../../../src/services/sceneGenerationService', () => ({
  PLACE_FINALIZE_RETRY_DELAY_MS: 250,
  errorClassOf: (err) => (err && err.name) || 'Error',
}));

const placeLock = require('../../../src/utils/placeLock');
const {
  applyStartLocations, locationsStepGaps, locationsGapsReason,
} = require('../../../src/services/episodeLocationsService');

const LOCATIONS = [
  { role: 'event', scene_set_id: 'set-venue', name: null },
  { role: 'home', scene_set_id: 'set-home', name: null },
  { role: 'extra', scene_set_id: 'set-car', name: 'Car' },
];
const ROLES = [{ role: 'event', name: null }, { role: 'home', name: null }, { role: 'extra', name: 'Car' }];

describe('applyStartLocations', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test('the locations are written in a transaction of their own, the finalizer\'s: every statement takes it', async () => {
    const transaction = { id: 'finalizer-transaction' };
    // The sets read as live and this show's (assertUsable's read); every other statement returns nothing.
    const query = jest.fn(async (sql) => (/FROM scene_sets s/.test(String(sql))
      ? [LOCATIONS.map((l) => ({ id: l.scene_set_id, name: l.scene_set_id, show_id: 'show-1' })), 0]
      : [[], 0]));
    const finalize = jest.spyOn(placeLock, 'finalizePlaceWrite').mockImplementation(async (_sequelize, _eventId, { work }) => {
      await work({ transaction, event: { id: 'ev-1' } });
      return { outcome: placeLock.PLACE_FINALIZE_OUTCOMES.OK, value: undefined };
    });

    const step = await applyStartLocations({ query }, { episodeId: 'ep-new', eventId: 'ev-1', showId: 'show-1', sourceSetId: 'set-venue', locations: LOCATIONS });

    expect(step).toEqual({ status: 'complete', count: 3 });
    expect(finalize).toHaveBeenCalledTimes(1);
    expect(finalize.mock.calls[0][1]).toBe('ev-1');
    expect(finalize.mock.calls[0][2]).toMatchObject({ sourceSetId: 'set-venue', retryDelayMs: 250, work: expect.any(Function) });
    expect(query.mock.calls.length).toBeGreaterThan(3);
    for (const [, options] of query.mock.calls) expect(options.transaction).toBe(transaction);
    // The set rows first, then the check that they are live, then the links.
    expect(String(query.mock.calls[0][0])).toMatch(/FROM scene_sets WHERE id IN \(:ids\) ORDER BY id FOR KEY SHARE NOWAIT/);
    expect(String(query.mock.calls[1][0])).toMatch(/FROM scene_sets s\s+WHERE s\.id IN \(:ids\) AND s\.deleted_at IS NULL/);
    expect(query.mock.calls.some(([sql]) => /INSERT INTO scene_set_episodes/.test(String(sql)))).toBe(true);
  });

  test('a save that fails is logged with the episode and does not throw: a failed step with a fixed reason, the roles, and nothing of the error', async () => {
    jest.spyOn(placeLock, 'finalizePlaceWrite').mockRejectedValue(new Error('link boom'));

    const step = await applyStartLocations({ query: jest.fn() }, { episodeId: 'ep-new', eventId: 'ev-1', sourceSetId: null, locations: LOCATIONS });

    expect(step).toEqual({
      status: 'failed', code: 'SAVE_FAILED', reason: "The episode's locations could not be saved. Set them in the episode's Locations.", roles: ROLES,
    });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Start's locations were not saved for episode ep-new"));
    expect(JSON.stringify(step)).not.toMatch(/link boom/);
  });

  test('a set that is gone when the write checks it (soft-deleted since Start chose it): nothing is written, and the step is failed with the check\'s code and sentence', async () => {
    const transaction = { id: 'finalizer-transaction' };
    // The home set is no longer live: the check's read does not return it.
    const query = jest.fn(async (sql) => (/FROM scene_sets s/.test(String(sql))
      ? [[{ id: 'set-venue', name: 'Venue', show_id: 'show-1' }, { id: 'set-car', name: 'Car', show_id: 'show-1' }], 0]
      : [[], 0]));
    const finalize = jest.spyOn(placeLock, 'finalizePlaceWrite').mockImplementation(async (_s, _e, { work }) => {
      await work({ transaction, event: { id: 'ev-1' } }); // throws: the finalizer rolls back and rethrows
      return { outcome: placeLock.PLACE_FINALIZE_OUTCOMES.OK };
    });

    const step = await applyStartLocations({ query }, { episodeId: 'ep-new', eventId: 'ev-1', showId: 'show-1', sourceSetId: 'set-venue', locations: LOCATIONS });

    expect(step).toEqual({
      status: 'failed', code: 'SCENE_SET_NOT_FOUND',
      reason: "The home scene set no longer exists. The episode's locations were not saved: set them in the episode's Locations.", roles: ROLES,
    });
    expect(finalize).toHaveBeenCalledTimes(1);
    expect(query.mock.calls.some(([sql]) => /INSERT INTO|UPDATE /.test(String(sql)))).toBe(false);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('outcome=SCENE_SET_NOT_FOUND'));
  });

  test('another show\'s home set by then: refused with that sentence (the set\'s name, no id)', async () => {
    const query = jest.fn(async (sql) => (/FROM scene_sets s/.test(String(sql))
      ? [LOCATIONS.map((l) => ({ id: l.scene_set_id, name: l.role === 'home' ? 'Loft' : l.scene_set_id, show_id: l.role === 'home' ? 'show-2' : 'show-1' })), 0]
      : [[], 0]));
    jest.spyOn(placeLock, 'finalizePlaceWrite').mockImplementation(async (_s, _e, { work }) => { await work({ transaction: {}, event: {} }); return { outcome: 'OK' }; });
    const step = await applyStartLocations({ query }, { episodeId: 'ep-new', eventId: 'ev-1', showId: 'show-1', sourceSetId: 'set-venue', locations: LOCATIONS });
    expect(step).toMatchObject({ status: 'failed', code: 'EPISODE_LOCATIONS_INVALID', reason: '"Loft" belongs to another show. The episode\'s locations were not saved: set them in the episode\'s Locations.' });
    expect(JSON.stringify(step)).not.toMatch(/set-home|show-2/);
  });

  test('a refusal of the finalizer is a failed step with its code, its text and the roles', async () => {
    jest.spyOn(placeLock, 'finalizePlaceWrite').mockResolvedValue({ outcome: 'PLACE_LOCKED', code: 'PLACE_LOCKED', message: 'Locked.', attempts: 1 });
    const step = await applyStartLocations({ query: jest.fn() }, { episodeId: 'ep-new', eventId: 'ev-1', sourceSetId: null, locations: LOCATIONS });
    expect(step).toEqual({
      status: 'failed', code: 'PLACE_LOCKED', reason: "Locked. The episode's locations were not saved: set them in the episode's Locations.", roles: ROLES,
    });
  });

  test('no locations: complete, and the finalizer is not called', async () => {
    const finalize = jest.spyOn(placeLock, 'finalizePlaceWrite');
    expect(await applyStartLocations({ query: jest.fn() }, { episodeId: 'ep-new', eventId: 'ev-1', sourceSetId: null, locations: [] })).toEqual({ status: 'complete', count: 0 });
    expect(finalize).not.toHaveBeenCalled();
  });
});

describe('locationsStepGaps (Resume setup\'s check of a failed locations step)', () => {
  const at = (role, id, name = null) => ({ role, scene_set_id: id, name });
  const beat = (n, id, extra = {}) => ({ beat_number: n, scene_set_id: id, locked: false, chosen_by_user: false, ...extra });
  const WHOLE = [at('event', 'venue'), at('home', 'home'), at('closet', 'closet')];
  const CLEAN = { missing: [], eventElsewhere: false, staleBeats: [] };

  test('every role there, the Event location at the event\'s set, every beat at its role\'s set: nothing', () => {
    const beats = [beat(1, 'home'), beat(8, 'closet'), beat(10, 'venue'), beat(11, 'venue'), beat(12, 'venue'), beat(14, 'home')];
    expect(locationsStepGaps({ roles: [{ role: 'event' }, { role: 'home' }, { role: 'closet' }], locations: WHOLE, eventSetId: 'venue', beats })).toEqual(CLEAN);
  });

  test('A: a recorded role with no live location is missing; an extra is told by its name', () => {
    const roles = [{ role: 'event' }, { role: 'home' }, { role: 'closet' }, { role: 'extra', name: 'Car' }];
    const gaps = locationsStepGaps({ roles, locations: [at('event', 'venue'), at('extra', 'x', 'Cafe')], eventSetId: 'venue' });
    expect(gaps.missing).toEqual([{ role: 'home', name: null }, { role: 'closet', name: null }, { role: 'extra', name: 'Car' }]);
    expect(locationsStepGaps({ roles, locations: [...WHOLE, at('extra', 'x', 'Car')], eventSetId: 'venue' }).missing).toEqual([]);
  });

  test('A, a step with no roles: home, and the event when the event has a set; nothing else is asked', () => {
    expect(locationsStepGaps({ roles: undefined, locations: [], eventSetId: 'venue' }).missing).toEqual([{ role: 'event', name: null }, { role: 'home', name: null }]);
    expect(locationsStepGaps({ roles: undefined, locations: [], eventSetId: null }).missing).toEqual([{ role: 'home', name: null }]);
    expect(locationsStepGaps({ roles: undefined, locations: [at('event', 'venue'), at('home', 'home')], eventSetId: 'venue' })).toEqual(CLEAN);
  });

  test('B: the event has a set and the Event location is another; with no Event location it is a missing one, even when Start saved none', () => {
    expect(locationsStepGaps({ roles: [{ role: 'home' }], locations: [at('event', 'older'), at('home', 'home')], eventSetId: 'venue' }))
      .toEqual({ missing: [], eventElsewhere: true, staleBeats: [] });
    expect(locationsStepGaps({ roles: [{ role: 'home' }], locations: [at('home', 'home')], eventSetId: 'venue' }))
      .toEqual({ missing: [{ role: 'event', name: null }], eventElsewhere: false, staleBeats: [] });
    // An event with no set asks nothing of the Event location.
    expect(locationsStepGaps({ roles: [{ role: 'home' }], locations: [at('home', 'home')], eventSetId: null })).toEqual(CLEAN);
  });

  test('C: a beat at another set than its role\'s is named; an extra using that set does not make it right', () => {
    const locations = [at('event', 'venue'), at('home', 'home'), at('extra', 'older', 'Old hall')];
    const beats = [beat(1, 'home'), beat(10, 'older'), beat(11, 'older'), beat(12, 'venue')];
    expect(locationsStepGaps({ roles: [], locations, eventSetId: 'venue', beats }).staleBeats).toEqual([10, 11]);
  });

  test('C: the closet beat is right at home when the episode has no closet, and wrong at home when it has one', () => {
    expect(locationsStepGaps({ roles: [], locations: [at('home', 'home')], beats: [beat(8, 'home')] }).staleBeats).toEqual([]);
    expect(locationsStepGaps({ roles: [], locations: [at('home', 'home'), at('closet', 'closet')], beats: [beat(8, 'home')] }).staleBeats).toEqual([8]);
  });

  test('C: a beat whose role has no location, or whose set is no live location, is named; a beat with no set is not', () => {
    expect(locationsStepGaps({ roles: [], locations: [at('event', 'venue')], eventSetId: 'venue', beats: [beat(1, 'home'), beat(10, 'venue'), beat(2, null)] }).staleBeats).toEqual([1]);
  });

  test('C: a locked or chosen beat keeps its set: right at any live location, wrong at a set that is not one', () => {
    const locations = [at('event', 'venue'), at('home', 'home'), at('extra', 'car', 'Car')];
    const beats = [beat(10, 'car', { chosen_by_user: true }), beat(11, 'home', { locked: true }), beat(12, 'gone', { locked: true }), beat(1, 'gone', { chosen_by_user: true })];
    expect(locationsStepGaps({ roles: [], locations, eventSetId: 'venue', beats }).staleBeats).toEqual([1, 12]);
  });

  test('the reason is a fixed sentence of what was found', () => {
    expect(locationsGapsReason({ missing: [{ role: 'home', name: null }, { role: 'extra', name: 'Car' }], eventElsewhere: true, staleBeats: [10, 11] }))
      .toBe('The episode\'s locations are not complete. Missing: Home, "Car". The Event location is not the event\'s current scene set. '
        + '2 beats name a scene set that is not their location (beats 10, 11). Set them in the episode\'s Locations and Beat Plan, then choose Resume setup.');
    expect(locationsGapsReason({ missing: [], eventElsewhere: false, staleBeats: [12] }))
      .toBe('The episode\'s locations are not complete. 1 beat names a scene set that is not its location (beat 12). Set them in the episode\'s Locations and Beat Plan, then choose Resume setup.');
  });
});
