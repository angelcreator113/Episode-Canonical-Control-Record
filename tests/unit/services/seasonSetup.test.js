/**
 * Setting up a season (Evoni, 2026-10-24): the pure parts of
 * services/seasonSetupService — the form's checks, the split's ranges, the
 * phases a setup builds, event dates, and how a season draft is cleaned.
 */
const {
  normaliseSetup, normaliseSplit, rangesOf, partOf, buildPhases, defaultSetup, eventDay, cleanSeasonDraft, SeasonSetupError,
} = require('../../../src/services/seasonSetupService');

const FORM = { title: ' Velvet ', tagline: '', phases: [{ title: 'A', tagline: 'a' }, { title: 'B' }, { title: 'C' }], split: [6, 10, 8] };

describe('the setup form', () => {
  test('is trimmed, and the split read', () => {
    expect(normaliseSetup(FORM)).toEqual({
      title: 'Velvet', tagline: null, description: null,
      phases: [{ title: 'A', tagline: 'a' }, { title: 'B', tagline: null }, { title: 'C', tagline: null }],
      split: [6, 10, 8],
      page_fields: [],
    });
    expect(normaliseSetup({ ...FORM, split: undefined }).split).toEqual([8, 8, 8]);
  });
  test("the Season page's fields: only those sent, checked (2026-10-25)", () => {
    const out = normaliseSetup({
      ...FORM, cover_url: ' https://x.example.com/c.jpg ', starts_on: '2026-01-05', ends_on: '2026-01-05', logline: '  A line. ',
      phases: [{ title: 'A', picture_url: 'https://x.example.com/a.jpg' }, { title: 'B', picture_url: '' }, { title: 'C' }],
    });
    expect(out).toEqual(expect.objectContaining({
      cover_url: 'https://x.example.com/c.jpg', starts_on: '2026-01-05', ends_on: '2026-01-05', logline: 'A line.',
      page_fields: ['cover_url', 'starts_on', 'ends_on', 'logline'],
    }));
    expect(out.phases.map((p) => p.picture_url)).toEqual(['https://x.example.com/a.jpg', null, undefined]);
    expect(buildPhases(out).map((p) => p.picture_url)).toEqual(['https://x.example.com/a.jpg', undefined, undefined]);
    expect(() => normaliseSetup({ ...FORM, starts_on: '2026-02-02', ends_on: '2026-02-01' })).toThrow('cannot end before it starts');
    expect(() => normaliseSetup({ ...FORM, ends_on: '2026-13-01' })).toThrow('The end date must be a date');
    expect(() => normaliseSetup({ ...FORM, cover_url: 'ftp://x/c.jpg' })).toThrow('chosen from Files');
  });
  test.each([
    [[8, 8, 7], 'these add up to 23'],
    [[0, 12, 12], 'at least one episode'],
    [[24], 'needs 3 numbers'],
    [['a', 12, 12], 'whole number'],
  ])('a split of %j is refused', (split, reason) => {
    expect(() => normaliseSplit(split)).toThrow(SeasonSetupError);
    expect(() => normaliseSplit(split)).toThrow(reason);
  });
  test('a missing title or part name is refused with a 400', () => {
    let err;
    try { normaliseSetup({ ...FORM, title: '' }); } catch (e) { err = e; }
    expect([err.status, err.message]).toEqual([400, 'The season needs a title.']);
    expect(() => normaliseSetup({ ...FORM, phases: FORM.phases.slice(0, 2) })).toThrow('3 parts');
  });
});

describe('the split and the phases', () => {
  test('ranges and the part a slot falls in', () => {
    const r = rangesOf([6, 10, 8]);
    expect(r).toEqual([[1, 6], [7, 16], [17, 24]]);
    expect([1, 6, 7, 16, 17, 24].map((n) => partOf(n, r))).toEqual([1, 1, 2, 2, 3, 3]);
  });
  test('a setup builds three phases: names, ranges, the first active, each position’s feed', () => {
    const phases = buildPhases(normaliseSetup(FORM));
    expect(phases.map((p) => [p.phase, p.title, p.episode_start, p.episode_end, p.status])).toEqual([
      [1, 'A', 1, 6, 'active'], [2, 'B', 7, 16, 'upcoming'], [3, 'C', 17, 24, 'upcoming'],
    ]);
    expect(phases[2].feed_behavior.follow_bias).toBe('study');
  });
  test('defaults: Season 1 keeps its wording; later seasons are "Season N"', () => {
    expect(defaultSetup(1).title).toBe('Soft Luxury Ascension');
    expect(defaultSetup(3)).toEqual(expect.objectContaining({ title: 'Season 3', tagline: null, split: [8, 8, 8] }));
  });
});

describe('event dates', () => {
  test('a real YYYY-MM-DD is a date; free text and impossible days are undated', () => {
    expect(eventDay('2026-11-02')).toBe('2026-11-02');
    expect(eventDay('2026-11-02T19:00')).toBe('2026-11-02');
    expect(eventDay('Saturday night')).toBeNull();
    expect(eventDay('2026-02-30')).toBeNull();
    expect(eventDay(null)).toBeNull();
  });
});

describe('cleaning a season draft', () => {
  const targets = new Map([[2, { id: 's2', label: 'S1 · E2', phase: 1, intention: {} }], [5, { id: 's5', label: 'S1 · E5', phase: 1, intention: { story_purpose: 'old' } }]]);
  const threads = [{ id: 't1', title: 'Who sent it?' }];
  test('only target slots, once each, with a purpose; pressures read; invented threads dropped', () => {
    const out = cleanSeasonDraft({ slots: [
      { slot_number: 5, story_purpose: 'Five', desired_pressure: 'peak', story_thread_id: 'invented' },
      { slot_number: 2, story_purpose: 'Two', desired_pressure: 'Huge', story_thread_id: 't1' },
      { slot_number: 2, story_purpose: 'Two again' },
      { slot_number: 3, story_purpose: 'Not offered' },
      { slot_number: 5, story_purpose: '' },
    ] }, { targets, threads });
    expect(out.dropped_threads).toBe(1);
    expect(out.drafts.map((d) => [d.slot_number, d.story_purpose, d.desired_pressure, d.story_thread_id, d.story_thread_title, d.current_purpose])).toEqual([
      [2, 'Two', null, 't1', 'Who sent it?', null],
      [5, 'Five', 'Peak', null, null, 'old'],
    ]);
  });
  test('a reply with no slots gives no drafts', () => {
    expect(cleanSeasonDraft({}, { targets, threads })).toEqual({ drafts: [], dropped_threads: 0 });
  });
});
