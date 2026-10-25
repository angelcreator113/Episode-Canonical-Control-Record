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
