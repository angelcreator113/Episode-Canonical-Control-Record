'use strict';

/**
 * A release time the story suggests (Evoni, 2026-10-17): from the post's
 * story time and its episode's air date, at a posting hour in her own time,
 * kept apart from the poster's other scheduled posts. Pure: no database.
 */
const { suggestTime } = require('../../../src/services/postRelease');

const NOW = new Date('2030-03-01T09:00:00Z');
const AIR = '2030-03-10T00:00:00Z'; // a date with no time
const iso = (r) => r.at.toISOString();

describe('suggestTime', () => {
  test.each([
    [31, '2030-03-08T18:00:00.000Z', 'Two days before Episode 3 airs'],
    [32, '2030-03-03T12:00:00.000Z', 'A week before Episode 3 airs, when the event is announced'],
    [33, '2030-03-05T18:00:00.000Z', 'Five days before Episode 3 airs, when the invitations go out'],
    [35, '2030-03-10T19:00:00.000Z', 'As Episode 3 airs'],
    [37, '2030-03-10T21:00:00.000Z', 'The evening Episode 3 airs, after it'],
    [38, '2030-03-11T12:00:00.000Z', 'The day after Episode 3 airs'],
    [39, '2030-03-17T12:00:00.000Z', 'A week after Episode 3 airs'],
  ])('story order %i', (order, at, why) => {
    const r = suggestTime({ order, airDate: AIR, now: NOW });
    expect(iso(r)).toBe(at);
    expect(r.why).toBe(why);
  });

  test('"during" an air date with a time is that time', () => {
    expect(iso(suggestTime({ order: 35, airDate: '2030-03-10T20:30:00Z', now: NOW }))).toBe('2030-03-10T20:30:00.000Z');
  });

  test('the hours are in her own time; a date-only air date keeps its day', () => {
    // UTC-5 (getTimezoneOffset 300): 18:00 there is 23:00 UTC, two days before the 10th.
    expect(iso(suggestTime({ order: 31, airDate: AIR, now: NOW, tzOffset: 300 }))).toBe('2030-03-08T23:00:00.000Z');
  });

  test('a time already past, or no air date, is the next open slot, saying why', () => {
    const past = suggestTime({ order: 31, airDate: '2030-02-01T00:00:00Z', now: NOW });
    expect(iso(past)).toBe('2030-03-01T12:00:00.000Z');
    expect(past.why).toBe('The next open time: two days before Episode 3 airs has already passed');
    const none = suggestTime({ order: 31, airDate: null, now: NOW });
    expect(iso(none)).toBe('2030-03-01T12:00:00.000Z');
    expect(none.why).toBe('The next open time: Episode 3 has no air date yet');
    expect(suggestTime({ order: null, now: NOW }).why).toBe('The next open time');
  });

  test('kept 3 hours from the poster\'s other scheduled posts, and not after 10pm', () => {
    const r = suggestTime({ order: 31, airDate: AIR, now: NOW, taken: ['2030-03-08T18:30:00Z'] });
    expect(iso(r)).toBe('2030-03-08T21:30:00.000Z');
    expect(r.why).toBe('Two days before Episode 3 airs, moved to keep it apart from their other scheduled posts');
    const late = suggestTime({ order: 37, airDate: AIR, now: NOW, taken: ['2030-03-10T21:00:00Z'] });
    expect(iso(late)).toBe('2030-03-11T12:00:00.000Z');
  });
});
