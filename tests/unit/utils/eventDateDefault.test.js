// Task #1755 — a new event's date defaults to 45 days after creation.
const { AUTO_SCHEDULE_DAYS, AUTO_DATE_KEY, autoScheduledEventDate, withAutoScheduledDate } = require('../../../src/utils/eventDateDefault');

const NOW = new Date('2026-09-23T22:30:00Z');

describe('autoScheduledEventDate', () => {
  test('is 45 days after now, as YYYY-MM-DD (UTC)', () => {
    expect(AUTO_SCHEDULE_DAYS).toBe(45);
    expect(autoScheduledEventDate(NOW)).toBe('2026-11-07');
  });

  test('crosses a year boundary', () => {
    expect(autoScheduledEventDate(new Date('2026-12-01T00:00:00Z'))).toBe('2027-01-15');
  });
});

describe('withAutoScheduledDate', () => {
  test('no date → default date plus automation.event_date_auto, other keys kept', () => {
    const out = withAutoScheduledDate(undefined, { automation: { guest_profiles: [1] }, other: true }, NOW);
    expect(out).toEqual({
      event_date: '2026-11-07',
      canon_consequences: { other: true, automation: { guest_profiles: [1], [AUTO_DATE_KEY]: '2026-11-07' } },
      autoScheduled: true,
    });
  });

  test('blank string or non-string counts as no date', () => {
    expect(withAutoScheduledDate('   ', {}, NOW).event_date).toBe('2026-11-07');
    expect(withAutoScheduledDate(12345, null, NOW).event_date).toBe('2026-11-07');
  });

  test('a supplied date is kept and nothing is flagged', () => {
    const cc = { automation: { a: 1 } };
    const out = withAutoScheduledDate(' 2026-10-31 ', cc, NOW);
    expect(out).toEqual({ event_date: '2026-10-31', canon_consequences: cc, autoScheduled: false });
  });

  test('a date kept only in the automation copy is not auto-scheduled over', () => {
    const cc = { automation: { event_date: '2026-10-10' } };
    const out = withAutoScheduledDate(null, cc, NOW);
    expect(out).toEqual({ event_date: null, canon_consequences: cc, autoScheduled: false });
  });

  test('does not mutate its input', () => {
    const cc = { automation: { a: 1 } };
    withAutoScheduledDate(null, cc, NOW);
    expect(cc).toEqual({ automation: { a: 1 } });
  });
});
