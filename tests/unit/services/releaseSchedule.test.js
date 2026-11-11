/**
 * The show's release schedule (services/releaseSchedule; Evoni, 2026-10-25):
 * Episode N on the Nth release day, hand-set dates win and take their week,
 * a changed schedule moves only schedule dates, pause and "not releasing
 * yet", and 10:00 her time across the DST change.
 *
 * 2026-11-01 is a Sunday, and the day US clocks go back.
 */
const rs = require('../../../src/services/releaseSchedule');

const NY = 'America/New_York';
const sched = (over = {}) => rs.normalize({ day: 'sun', time: '10:00', first_release: '2026-11-01', tz_offset: 240, tz: NY, ...over });
const ep = (n, over = {}) => ({ id: `e${n}`, episode_number: n, status: 'draft', air_date: null, title: `Ep ${n}`, ...over });
const dates = (computed) => Object.fromEntries(Object.entries(computed.byEpisode).map(([id, e]) => [id, `${e.date} ${e.source}`]));
const NOW = new Date('2026-10-25T12:00:00Z');

describe('normalize', () => {
  test('keeps a valid schedule and fills cadence and paused', () => {
    const s = rs.normalize({ day: 'Sunday', time: '10:00', tz_offset: 240, tz: NY });
    expect(s).toMatchObject({ day: 'sun', time: '10:00', cadence: 'weekly', first_release: null, paused: false, tz_offset: 240, tz: NY });
  });
  test('times YouTube only unless told otherwise, and keeps a known list in order', () => {
    expect(rs.normalize({ day: 'sun', time: '10:00' }).platforms).toEqual(['youtube']);
    expect(rs.normalize({ day: 'sun', time: '10:00', platforms: ['tiktok', 'youtube'] }).platforms).toEqual(['youtube', 'tiktok']);
  });
  test.each([
    [null, /release schedule/],
    [{ day: 'someday', time: '10:00' }, /day/],
    [{ day: 'sun', time: '25:00' }, /time/],
    [{ day: 'sun', time: '10:00', cadence: 'daily' }, /cadence/],
    [{ day: 'sun', time: '10:00', first_release: '2026-02-30' }, /first_release/],
    [{ day: 'sun', time: '10:00', paused: 'yes' }, /paused/],
    [{ day: 'sun', time: '10:00', tz_offset: 9999 }, /tz_offset/],
    [{ day: 'sun', time: '10:00', tz: 'Mars/Olympus' }, /tz/],
    [{ day: 'sun', time: '10:00', platforms: [] }, /platforms/],
    [{ day: 'sun', time: '10:00', platforms: ['myspace'] }, /platforms/],
  ])('refuses %j', (raw, msg) => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => rs.normalize(raw)).toThrow(msg);
    console.error.mockRestore();
  });
  test('an empty first release is "not releasing yet"', () => {
    expect(rs.normalize({ day: 'sun', time: '10:00', first_release: '' }).first_release).toBeNull();
  });
});

describe('computeDates', () => {
  test('Episode N takes the Nth Sunday on or after the first release', () => {
    const c = rs.computeDates({ schedule: sched(), episodes: [ep(1), ep(2), ep(3)], now: NOW });
    expect(c.state).toBe('active');
    expect(dates(c)).toEqual({ e1: '2026-11-01 schedule', e2: '2026-11-08 schedule', e3: '2026-11-15 schedule' });
    expect(c.byEpisode.e1.time).toBe('10:00');
  });

  test('a first release that is not a Sunday starts on the next Sunday', () => {
    const c = rs.computeDates({ schedule: sched({ first_release: '2026-11-02' }), episodes: [ep(1)], now: NOW });
    expect(c.byEpisode.e1.date).toBe('2026-11-08');
  });

  test('a hand-set date wins and takes its week; later episodes follow it (skipping a holiday)', () => {
    const c = rs.computeDates({
      schedule: sched(), now: NOW,
      episodes: [ep(1), ep(2), ep(3, { air_date: '2026-11-22' }), ep(4)],
    });
    expect(dates(c)).toEqual({ e1: '2026-11-01 schedule', e2: '2026-11-08 schedule', e3: '2026-11-22 hand', e4: '2026-11-29 schedule' });
  });

  test("a hand-set Saturday takes that weekend's Sunday", () => {
    const c = rs.computeDates({ schedule: sched(), now: NOW, episodes: [ep(1), ep(2, { air_date: '2026-11-07' }), ep(3)] });
    expect(dates(c)).toEqual({ e1: '2026-11-01 schedule', e2: '2026-11-07 hand', e3: '2026-11-15 schedule' });
  });

  test('a week a later episode was set to by hand is skipped', () => {
    const c = rs.computeDates({ schedule: sched(), now: NOW, episodes: [ep(1), ep(2), ep(3, { air_date: '2026-11-08' })] });
    expect(dates(c)).toMatchObject({ e1: '2026-11-01 schedule', e2: '2026-11-15 schedule', e3: '2026-11-08 hand' });
  });

  test('a missing episode number keeps its Sunday, and empty slots get dates too', () => {
    const c = rs.computeDates({ schedule: sched(), now: NOW, episodes: [ep(1), ep(3)], slotCount: 5 });
    expect(c.byEpisode.e3.date).toBe('2026-11-15');
    expect(c.numbers[2]).toMatchObject({ date: '2026-11-08', episode_id: null });
    expect(c.numbers[5].date).toBe('2026-11-29');
  });

  test('archived episodes take no date', () => {
    const c = rs.computeDates({ schedule: sched(), now: NOW, episodes: [ep(1, { status: 'archived' }), ep(2)] });
    expect(c.byEpisode.e1).toBeUndefined();
    expect(c.byEpisode.e2.date).toBe('2026-11-08');
  });

  test('not releasing yet: previews from the season start (else today), marked preview', () => {
    const s = sched({ first_release: null });
    const fromSeason = rs.computeDates({ schedule: s, now: NOW, baseDate: '2026-11-10', episodes: [ep(1), ep(2)] });
    expect(fromSeason.state).toBe('preview');
    expect(dates(fromSeason)).toEqual({ e1: '2026-11-15 preview', e2: '2026-11-22 preview' });
    const fromToday = rs.computeDates({ schedule: s, now: NOW, episodes: [ep(1)] });
    expect(fromToday.byEpisode.e1.date).toBe('2026-10-25');
  });

  test('paused: no schedule dates, hand-set ones stay, the schedule is kept', () => {
    const s = sched({ paused: true });
    const c = rs.computeDates({ schedule: s, now: NOW, episodes: [ep(1), ep(2, { air_date: '2026-11-08' })] });
    expect(c.state).toBe('paused');
    expect(dates(c)).toEqual({ e2: '2026-11-08 hand' });
    expect(s.day).toBe('sun');
  });

  test('no schedule changes nothing: only hand-set dates', () => {
    const c = rs.computeDates({ schedule: null, episodes: [ep(1), ep(2, { air_date: '2026-11-08' })] });
    expect(c.state).toBe('unset');
    expect(dates(c)).toEqual({ e2: '2026-11-08 hand' });
  });
});

describe('a changed schedule (moves)', () => {
  test('schedule dates recompute; hand-set dates never move', () => {
    const episodes = [ep(1), ep(2, { air_date: '2026-11-08' }), ep(3)];
    const before = rs.buildView({ schedule: sched(), episodes, now: NOW });
    const after = rs.buildView({ schedule: sched({ day: 'mon', time: '09:30' }), episodes, now: NOW });
    const byId = Object.fromEntries(after.episodes.map((r) => [r.episode_id, r]));
    expect(byId.e2).toMatchObject({ date: '2026-11-08', source: 'hand' });
    // Monday Nov 9 is the hand-set Sunday's week, so Episode 3 goes to Nov 16.
    expect(byId.e3).toMatchObject({ date: '2026-11-16', time: '09:30', source: 'schedule' });
    const m = rs.moves(before, after);
    expect(m.map((x) => [x.episode_id, x.from.date, x.to.date])).toEqual([
      ['e1', '2026-11-01', '2026-11-02'],
      ['e3', '2026-11-15', '2026-11-16'],
    ]);
  });

  test('a released episode is not listed as moving', () => {
    const episodes = [ep(1, { status: 'published' }), ep(2)];
    const m = rs.moves(rs.buildView({ schedule: sched(), episodes, now: NOW }), rs.buildView({ schedule: sched({ day: 'sat' }), episodes, now: NOW }));
    expect(m.map((x) => x.episode_id)).toEqual(['e2']);
  });

  test('pausing lists every schedule date as going away', () => {
    const episodes = [ep(1), ep(2, { air_date: '2026-11-08' })];
    const m = rs.moves(rs.buildView({ schedule: sched(), episodes, now: NOW }), rs.buildView({ schedule: sched({ paused: true }), episodes, now: NOW }));
    expect(m).toEqual([expect.objectContaining({ episode_id: 'e1', to: null })]);
  });
});

describe('time zones and DST', () => {
  test('10:00 in New York is 14:00Z before the clocks change and 15:00Z after', () => {
    const s = sched();
    expect(rs.zonedInstant('2026-10-25', '10:00', s).toISOString()).toBe('2026-10-25T14:00:00.000Z');
    expect(rs.zonedInstant('2026-11-08', '10:00', s).toISOString()).toBe('2026-11-08T15:00:00.000Z');
  });
  test('without a zone name it falls back to the fixed offset saved', () => {
    const s = sched({ tz: null });
    expect(rs.zonedInstant('2026-11-08', '10:00', s).toISOString()).toBe('2026-11-08T14:00:00.000Z');
  });
  test("today is her date, not the server's", () => {
    expect(rs.todayIn(new Date('2026-11-02T02:00:00Z'), sched())).toBe('2026-11-01');
  });
});

describe('buildView: deadlines', () => {
  test('soon within 3 days, overdue once the time has passed, released when published; days in her zone', () => {
    const episodes = [ep(1, { status: 'published' }), ep(2), ep(3)];
    const now = new Date('2026-11-12T12:00:00Z');
    const v = rs.buildView({ schedule: sched({ first_release: '2026-11-01' }), episodes, now });
    const byId = Object.fromEntries(v.episodes.map((r) => [r.episode_id, r]));
    expect(byId.e1).toMatchObject({ due: 'released' });
    expect(byId.e2).toMatchObject({ date: '2026-11-08', due: 'overdue', days_until: -4 });
    expect(byId.e3).toMatchObject({ date: '2026-11-15', due: 'soon', days_until: 3, starts_at: '2026-11-15T15:00:00.000Z' });
  });
  test('the release day itself is soon until 10:00, overdue after', () => {
    const episodes = [ep(1)];
    const before = rs.buildView({ schedule: sched(), episodes, now: new Date('2026-11-01T14:59:00Z') });
    const after = rs.buildView({ schedule: sched(), episodes, now: new Date('2026-11-01T15:01:00Z') });
    expect(before.episodes[0]).toMatchObject({ due: 'soon', days_until: 0 });
    expect(after.episodes[0]).toMatchObject({ due: 'overdue' });
  });
  test('a preview never warns, and no schedule offers the Sunday 10:00 suggestion', () => {
    const v = rs.buildView({ schedule: sched({ first_release: null }), episodes: [ep(1)], now: NOW });
    expect(v.episodes[0]).toMatchObject({ source: 'preview', due: null });
    const none = rs.buildView({ schedule: null, episodes: [ep(1)], now: NOW });
    expect(none.suggestion).toMatchObject({ day: 'sun', time: '10:00', cadence: 'weekly', platforms: ['youtube'] });
    expect(none.episodes[0]).toMatchObject({ date: null, due: null });
  });
});

describe('seasons (Evoni, 2026-10-25: each season counts its own episodes and can start on its own date)', () => {
  const SEASONS = [
    { season_number: 1, slot_count: 3, starts_on: null, arc_id: 'a1', title: 'One' },
    { season_number: 2, slot_count: 3, starts_on: '2027-02-01', arc_id: 'a2', title: 'Two' },
  ];
  // Season 1: episodes 1-3 in slots 1-3; Season 2: show-wide 4-5 in slots 1-2.
  const two = () => [
    ep(1, { season_number: 1, slot_number: 1 }), ep(2, { season_number: 1, slot_number: 2 }), ep(3, { season_number: 1, slot_number: 3 }),
    ep(4, { season_number: 2, slot_number: 1 }), ep(5, { season_number: 2, slot_number: 2 }),
  ];

  test('normalize keeps a season start, drops an empty one, and refuses a bad key or date', () => {
    expect(rs.normalize({ day: 'sun', time: '10:00', seasons: { 2: { first_release: '2027-03-07' }, 3: { first_release: '' } } }).seasons)
      .toEqual({ 2: { first_release: '2027-03-07' } });
    expect(rs.normalize({ day: 'sun', time: '10:00' }).seasons).toEqual({});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => rs.normalize({ day: 'sun', time: '10:00', seasons: { two: { first_release: '2027-03-07' } } })).toThrow(/season number/);
    expect(() => rs.normalize({ day: 'sun', time: '10:00', seasons: { 2: { first_release: 'March' } } })).toThrow(/seasons.2.first_release/);
    expect(() => rs.normalize({ day: 'sun', time: '10:00', seasons: [] })).toThrow(/seasons/);
    console.error.mockRestore();
  });

  test('two seasons: each Episode 1 gets its own first Sunday', () => {
    const c = rs.computeDates({ schedule: sched({ seasons: { 2: { first_release: '2027-03-01' } } }), episodes: two(), seasons: SEASONS, currentSeason: 2, now: NOW });
    expect(dates(c)).toEqual({
      e1: '2026-11-01 schedule', e2: '2026-11-08 schedule', e3: '2026-11-15 schedule',
      e4: '2027-03-07 schedule', e5: '2027-03-14 schedule',
    });
    expect(c.byEpisode.e4).toMatchObject({ number: 1, season_number: 2 });
    expect(c.seasons[2]).toMatchObject({ state: 'active', first_release: '2027-03-01', own_start: true });
    expect(c.seasons[1]).toMatchObject({ state: 'active', first_release: '2026-11-01', own_start: false });
    // The current season's slot dates: slot 3 of Season 2 is empty and still dated.
    expect(c.numbers[3]).toMatchObject({ date: '2027-03-21', episode_id: null });
  });

  test('a later season with no start of its own is "not releasing yet": previews from its start, never warns', () => {
    const v = rs.buildView({ schedule: sched(), episodes: two(), seasons: SEASONS, currentSeason: 2, now: new Date('2027-02-05T12:00:00Z') });
    const byId = Object.fromEntries(v.episodes.map((r) => [r.episode_id, r]));
    expect(byId.e4).toMatchObject({ date: '2027-02-07', source: 'preview', due: null, number: 1, season_number: 2 });
    expect(byId.e3).toMatchObject({ source: 'schedule', due: 'overdue', number: 3 });
    expect(v.seasons.map((x) => [x.season_number, x.state, x.title])).toEqual([[1, 'active', 'One'], [2, 'preview', 'Two']]);
    expect(v.current_season).toBe(2);
    expect(v.slots[1]).toMatchObject({ date: '2027-02-07', source: 'preview' });
  });

  test('a later season with no start date previews from the day after the season before', () => {
    const c = rs.computeDates({ schedule: sched(), episodes: two(), seasons: SEASONS.map((x) => ({ ...x, starts_on: null })), now: NOW });
    expect(c.byEpisode.e4.date).toBe('2026-11-22');
  });

  test('a hand-set date in Season 2 wins and the season follows it', () => {
    const eps = two();
    eps[3].air_date = '2027-03-14';
    const c = rs.computeDates({ schedule: sched({ seasons: { 2: { first_release: '2027-03-01' } } }), episodes: eps, seasons: SEASONS, now: NOW });
    expect(dates(c)).toMatchObject({ e4: '2027-03-14 hand', e5: '2027-03-21 schedule' });
  });

  test('a later-season episode with no slot takes the next free number, in episode order', () => {
    const eps = [ep(1, { season_number: 1 }), ep(30, { season_number: 2 }), ep(26, { season_number: 2, slot_number: 1 }), ep(28, { season_number: 2 })];
    const c = rs.computeDates({ schedule: sched({ seasons: { 2: { first_release: '2027-03-01' } } }), episodes: eps, seasons: SEASONS, now: NOW });
    expect([c.byEpisode.e26.number, c.byEpisode.e28.number, c.byEpisode.e30.number]).toEqual([1, 2, 3]);
    expect(c.byEpisode.e28.date).toBe('2027-03-14');
  });

  test("the old stored shape (no seasons) reads as before: one season numbered by episode_number", () => {
    const stored = { day: 'sun', time: '10:00', cadence: 'weekly', first_release: '2026-11-01', paused: false, platforms: ['youtube'], tz_offset: 240, tz: NY };
    const c = rs.computeDates({ schedule: rs.readStored(stored), episodes: [ep(1), ep(2)], now: NOW });
    expect(dates(c)).toEqual({ e1: '2026-11-01 schedule', e2: '2026-11-08 schedule' });
    expect(c.byEpisode.e2).toMatchObject({ number: 2, season_number: 1 });
  });

  test('a season of its own sets Season 1 too, over the top-level date', () => {
    const c = rs.computeDates({ schedule: sched({ seasons: { 1: { first_release: '2026-11-15' } } }), episodes: [ep(1)], now: NOW });
    expect(c.byEpisode.e1.date).toBe('2026-11-15');
  });
});

/**
 * A2 release positions (migration 20261110230000): a slot's place in the
 * release order is COALESCE(release_position, slot_number). Numbers stay
 * story numbers; only the order the release days are handed out in changes.
 */
describe('release positions (A2)', () => {
  const S = sched(); // one schedule: normalize stamps updated_at
  const season = (over = {}) => [{ season_number: 1, slot_count: 6, starts_on: null, ...over }];
  const slotted = (n, over = {}) => ep(n, { season_number: 1, slot_number: n, ...over });
  const eps = () => [slotted(1), slotted(2), slotted(3, { air_date: '2026-11-22' }), slotted(4), slotted(5)];
  const view = (seasons, over = {}) => rs.buildView({
    schedule: S, episodes: eps(), seasons, currentSeason: 1, now: NOW,
    specials: [{ id: 'sp1', kind: 'bonus', label: 'Bonus', season_number: 1, after_slot_number: 4, event_date: '2026-12-02' }],
    twoParts: [{ season_number: 1, one_number: 4, two_number: 5 }],
    ...over,
  });

  test('with no release position the whole view is identical: absent, empty, and every slot at its own number', () => {
    const base = view(season());
    expect(view(season({ positions: {} }))).toEqual(base);
    expect(view(season({ positions: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 } }))).toEqual(base);
    expect(view(season({ positions: { 2: null, 4: undefined } }))).toEqual(base);
    const c = rs.computeDates({ schedule: S, episodes: eps(), seasons: season(), currentSeason: 1, now: NOW });
    expect(rs.computeDates({ schedule: S, episodes: eps(), seasons: season({ positions: {} }), currentSeason: 1, now: NOW })).toEqual(c);
  });

  test('two slots that trade release positions trade dates; numbers stay story numbers and every output stays keyed by slot', () => {
    const base = view(season());
    const swapped = view(season({ positions: { 2: 5, 5: 2 } }));
    // Slot-keyed dates: 2 and 5 trade, the rest keep theirs.
    expect(swapped.slots[2].date).toBe(base.slots[5].date);
    expect(swapped.slots[5].date).toBe(base.slots[2].date);
    for (const n of [1, 3, 4, 6]) expect(swapped.slots[n]).toEqual(base.slots[n]);
    // The episodes keep their slots and their story numbers.
    expect(swapped.slots[2].episode_id).toBe('e2');
    expect(swapped.slots[5].episode_id).toBe('e5');
    const row = (v, id) => v.episodes.find((r) => r.episode_id === id);
    expect(row(swapped, 'e2')).toMatchObject({ number: 2, date: base.slots[5].date, source: 'schedule' });
    expect(row(swapped, 'e5')).toMatchObject({ number: 5, date: base.slots[2].date, source: 'schedule' });
    // The hand-set date is untouched, and nothing became hand-set.
    expect(row(swapped, 'e3')).toMatchObject({ number: 3, date: '2026-11-22', source: 'hand' });
    expect(swapped.episodes.filter((r) => r.source === 'hand').map((r) => r.episode_id)).toEqual(['e3']);
    // The same set of dates is used: a permutation, none dropped.
    const all = (v) => Object.values(v.slots).map((s) => s.date).sort();
    expect(all(swapped)).toEqual(all(base));
    // Two-parter labels read story numbers.
    expect(row(swapped, 'e4').two_part).toEqual({ part: 1, of: 2, other_number: 5 });
    expect(row(swapped, 'e5').two_part).toEqual({ part: 2, of: 2, other_number: 4 });
    // The season list is slot-keyed too.
    expect(swapped.seasons[0].slots[2].date).toBe(base.slots[5].date);
  });

  test('an empty slot with a release position takes that place in the order', () => {
    const base = rs.computeDates({ schedule: S, episodes: [slotted(1), slotted(2)], seasons: season({ slot_count: 4 }), currentSeason: 1, now: NOW });
    const moved = rs.computeDates({ schedule: S, episodes: [slotted(1), slotted(2)], seasons: season({ slot_count: 4, positions: { 2: 4, 4: 2 } }), currentSeason: 1, now: NOW });
    expect(moved.numbers[4]).toMatchObject({ number: 4, episode_id: null, date: base.numbers[2].date });
    expect(moved.numbers[2]).toMatchObject({ number: 2, episode_id: 'e2', date: base.numbers[4].date });
  });

  test('an episode with no slot keeps its stored number and follows that slot number\'s place in the order', () => {
    // e7 has no slot: it falls back to its stored number (first season: episode_number 3).
    const loose = [slotted(1), slotted(2), ep(3, { id: 'e7', season_number: 1 })];
    const base = rs.computeDates({ schedule: S, episodes: loose, seasons: season({ slot_count: 3 }), currentSeason: 1, now: NOW });
    expect(base.byEpisode.e7).toMatchObject({ number: 3, date: '2026-11-15' });
    const moved = rs.computeDates({ schedule: S, episodes: loose, seasons: season({ slot_count: 3, positions: { 1: 3, 3: 1 } }), currentSeason: 1, now: NOW });
    expect(moved.byEpisode.e7).toMatchObject({ number: 3, date: '2026-11-01' });
    expect(moved.byEpisode.e1).toMatchObject({ number: 1, date: '2026-11-15' });
  });

  test('a special\'s suggested date reads the slot-keyed dates around its story anchor', () => {
    const base = view(season());
    expect(base.specials[0].suggested).toEqual(rs.suggestSpecialDate(
      { kind: 'bonus', after_slot_number: 4, event_date: '2026-12-02' }, base.seasons[0].slots, S));
    const swapped = view(season({ positions: { 2: 5, 5: 2 } }));
    expect(swapped.specials[0].suggested).toEqual(rs.suggestSpecialDate(
      { kind: 'bonus', after_slot_number: 4, event_date: '2026-12-02' }, swapped.seasons[0].slots, S));
  });

  test('positions in one season leave another season\'s dates alone', () => {
    const two = (positions) => [
      { season_number: 1, slot_count: 3, starts_on: null, ...(positions ? { positions } : {}) },
      { season_number: 2, slot_count: 3, starts_on: null },
    ];
    const episodes = [slotted(1), slotted(2), slotted(3), ep(4, { season_number: 2, slot_number: 1 }), ep(5, { season_number: 2, slot_number: 2 })];
    const schedule = sched({ seasons: { 2: { first_release: '2027-01-03' } } });
    const base = rs.computeDates({ schedule, episodes, seasons: two(null), currentSeason: 1, now: NOW });
    const moved = rs.computeDates({ schedule, episodes, seasons: two({ 1: 2, 2: 1 }), currentSeason: 1, now: NOW });
    expect(moved.seasons[2]).toEqual(base.seasons[2]);
    expect(moved.byEpisode.e1.date).toBe(base.byEpisode.e2.date);
  });
});
