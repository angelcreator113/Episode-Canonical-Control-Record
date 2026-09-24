// eventVersion (Task #1788) — pure helpers for the stale-save check.
const parsePgDate = require('postgres-date');
const {
  EXPECTED_VERSION_KEY, toVersionMs, parseExpectedVersion, versionMatches, staleSaveBody, STALE_SAVE_CODE,
} = require('../../../src/utils/eventVersion');

describe('parseExpectedVersion', () => {
  test('absent or null is "not present"', () => {
    expect(parseExpectedVersion({})).toEqual({ present: false });
    expect(parseExpectedVersion({ [EXPECTED_VERSION_KEY]: null })).toEqual({ present: false });
    expect(parseExpectedVersion(null)).toEqual({ present: false });
  });
  test('an ISO string parses to whole milliseconds', () => {
    expect(parseExpectedVersion({ expected_updated_at: '2026-09-24T15:00:00.123Z' }))
      .toEqual({ present: true, ms: Date.parse('2026-09-24T15:00:00.123Z'), iso: '2026-09-24T15:00:00.123Z' });
  });
  test('a non-date or a non-string is an error', () => {
    expect(parseExpectedVersion({ expected_updated_at: 'soon' }).error).toMatch(/not a valid date/);
    expect(parseExpectedVersion({ expected_updated_at: { at: 1 } }).error).toMatch(/must be/);
  });
});

describe('versionMatches — millisecond precision', () => {
  const expected = Date.parse('2026-09-24T15:00:00.123Z');
  test('a microsecond value parsed by node-postgres matches its millisecond JSON form', () => {
    expect(versionMatches(parsePgDate('2026-09-24 15:00:00.123456+00'), expected)).toBe(true);
    expect(versionMatches(parsePgDate('2026-09-24 15:00:00.123999+00'), expected)).toBe(true);
  });
  test('a microsecond string (if ever passed raw) truncates the same way', () => {
    expect(versionMatches('2026-09-24T15:00:00.123999Z', expected)).toBe(true);
  });
  test('a different millisecond, or no value, does not match', () => {
    expect(versionMatches(parsePgDate('2026-09-24 15:00:00.124000+00'), expected)).toBe(false);
    expect(versionMatches(null, expected)).toBe(false);
  });
  test('toVersionMs is null for non-dates', () => {
    expect(toVersionMs('nope')).toBeNull();
    expect(toVersionMs('')).toBeNull();
  });
});

describe('staleSaveBody', () => {
  test('names both versions and returns the current row', () => {
    const body = staleSaveBody({ iso: '2026-09-24T14:00:00.000Z' }, { id: 'e', updated_at: parsePgDate('2026-09-24 15:00:00.123456+00') });
    expect(body).toMatchObject({
      success: false, code: STALE_SAVE_CODE,
      expected_updated_at: '2026-09-24T14:00:00.000Z', current_updated_at: '2026-09-24T15:00:00.123Z',
      event: { id: 'e' },
    });
  });
});
