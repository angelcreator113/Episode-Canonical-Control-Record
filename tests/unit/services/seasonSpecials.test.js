/**
 * Special episodes (services/seasonSpecials; Evoni, 2026-10-26): the labels,
 * and how the release schedule dates them. A bonus or special has its own
 * date and time and never moves a weekly number or date; a two-parter's
 * parts are weekly slots, marked as parts.
 *
 * 2026-11-01 is a Sunday; Episode 7 is Sun, Dec 13.
 */
const rs = require('../../../src/services/releaseSchedule');
const { specialLabel, partLabel, SpecialsError, MIGRATION_PENDING } = require('../../../src/services/seasonSpecials');

const sched = (over = {}) => rs.normalize({ day: 'sun', time: '10:00', first_release: '2026-11-01', tz: 'America/New_York', ...over });
const ep = (n, over = {}) => ({ id: `e${n}`, episode_number: n, slot_number: n, season_number: 1, status: 'draft', air_date: null, title: `Ep ${n}`, ...over });
const SEASONS = [{ season_number: 1, slot_count: 24, starts_on: null }];
const view = (over = {}) => rs.buildView({ schedule: sched(), episodes: [], seasons: SEASONS, currentSeason: 1, now: new Date('2026-12-14T12:00:00Z'), ...over });
const bonus = (over = {}) => ({ id: 's1', kind: 'bonus', season_number: 1, after_slot_number: 7, label: 'Special · after E7', release_date: null, release_time: null, episode_id: null, ...over });

describe('labels', () => {
  test('a bonus sits after a weekly episode; a stand-alone special is named by its type', () => {
    expect(specialLabel({ kind: 'bonus', after_slot_number: 7 })).toBe('Special · after E7');
    expect(specialLabel({ kind: 'bonus', after_slot_number: 0 })).toBe('Special · before E1');
    expect(specialLabel({ kind: 'special', special_type: 'holiday', after_slot_number: 12 })).toBe('Holiday special');
    expect(specialLabel({ kind: 'special', special_type: 'recap' })).toBe('Recap special');
    expect(specialLabel({ kind: 'special', special_type: 'reunion' })).toBe('Reunion special');
    expect(specialLabel({ kind: 'special', special_type: 'other' })).toBe('Special');
    expect(partLabel(12, 1)).toBe('E12 · Part 1/2');
  });
  test('the migration refusal is a 409 with its own code', () => {
    const err = new SpecialsError('x', 409, MIGRATION_PENDING);
    expect([err.status, err.code]).toEqual([409, 'SEASON_SPECIALS_MIGRATION_PENDING']);
  });
});

describe('the release schedule and specials', () => {
  test('a bonus episode keeps its own date and time; the weekly episodes keep their numbers and dates', () => {
    const weekly = [ep(7), ep(8)];
    const before = view({ episodes: weekly });
    // The bonus's episode has the next show-wide number (8) and no slot: it must not claim E8.
    const extra = { id: 'b1', episode_number: 9, status: 'draft', air_date: '2026-12-16' };
    const after = view({ episodes: [...weekly, extra], specials: [bonus({ episode_id: 'b1', release_date: '2026-12-16', release_time: '18:00' })] });
    expect(after.slots).toEqual(before.slots);
    expect(after.slots['7'].date).toBe('2026-12-13');
    expect(after.slots['8'].date).toBe('2026-12-20');
    const row = after.episodes.find((r) => r.episode_id === 'b1');
    expect(row).toMatchObject({ number: null, date: '2026-12-16', time: '18:00', source: 'special', special: { kind: 'bonus', label: 'Special · after E7' } });
    expect(after.episodes.map((r) => r.special ? r.special.label : `E${r.number}`)).toEqual(['E7', 'Special · after E7', 'E8']);
  });

  test('a special with a date warns like a weekly episode: due within three days', () => {
    const v = view({ episodes: [{ id: 'b1', episode_number: 9, status: 'draft' }], specials: [bonus({ episode_id: 'b1', release_date: '2026-12-16' })] });
    const row = v.episodes.find((r) => r.episode_id === 'b1');
    expect(row).toMatchObject({ due: 'soon', days_until: 2, time: '10:00' });
    expect(v.specials[0]).toMatchObject({ special_id: 's1', due: 'soon' });
  });

  test('a special with no episode is listed with its suggested day: the Wednesday nearest its event, else midweek', () => {
    const v = view({ specials: [
      bonus({ event_date: '2026-12-17' }),
      bonus({ id: 's2', after_slot_number: 7, event_date: '2027-03-01' }),
      bonus({ id: 's3', kind: 'special', after_slot_number: 0, label: 'Holiday special' }),
    ] });
    expect(v.specials.map((s) => [s.special_id, s.date, s.suggested])).toEqual([
      ['s1', null, { date: '2026-12-16', time: '10:00', from: 'event' }],
      ['s2', null, { date: '2026-12-16', time: '10:00', from: 'midweek' }],
      ['s3', null, { date: '2026-10-28', time: '10:00', from: 'midweek' }],
    ]);
    expect(v.episodes).toEqual([]);
  });

  test('a two-parter\'s parts are weekly rows, marked as parts', () => {
    const v = view({ episodes: [ep(12), ep(13)], twoParts: [{ season_number: 1, one_number: 12, two_number: 13 }] });
    expect(v.episodes.map((r) => [r.number, r.date, r.two_part])).toEqual([
      [12, '2027-01-17', { part: 1, of: 2, other_number: 13 }],
      [13, '2027-01-24', { part: 2, of: 2, other_number: 12 }],
    ]);
  });

  test('with no specials the view is as it was', () => {
    const v = view({ episodes: [ep(1)] });
    expect(v.specials).toEqual([]);
    expect(v.episodes[0].special).toBeUndefined();
    expect(v.episodes[0].two_part).toBeUndefined();
  });
});
