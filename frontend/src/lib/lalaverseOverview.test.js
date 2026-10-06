import { describe, test, expect } from 'vitest';
import { nextCulturalEvent, topTrend, topTension, worldIdeas, latelyItems } from './lalaverseOverview';

const NOW = new Date('2026-10-06T12:00:00Z');

describe('the LalaVerse Overview helpers', () => {
  test('the next cultural event is the soonest from today on, past ones skipped', () => {
    const events = [
      { title: 'Past Gala', start_datetime: '2026-09-01T00:00:00Z' },
      { title: 'Winter Ball', start_datetime: '2026-12-10T00:00:00Z' },
      { title: 'Fashion Week', start_datetime: '2026-11-03T00:00:00Z' },
      { title: 'No date' },
    ];
    expect(nextCulturalEvent(events, NOW).title).toBe('Fashion Week');
    expect(nextCulturalEvent([{ title: 'Past', start_datetime: '2025-01-01' }], NOW)).toBeNull();
  });

  test('the top trend is by engagement then posts; the hottest tension is explosive first', () => {
    expect(topTrend([{ topic: '#a', total_engagement: 5, post_count: 9 }, { topic: '#b', total_engagement: 50, post_count: 1 }]).topic).toBe('#b');
    expect(topTrend([])).toBeNull();
    const pairs = [
      { char_a: { name: 'A' }, char_b: { name: 'B' }, tension_state: 'Simmering' },
      { char_a: { name: 'C' }, char_b: { name: 'D' }, tension_state: 'Explosive' },
      { char_a: { name: 'E' }, char_b: {}, tension_state: 'Explosive' },
    ];
    expect(topTension(pairs).char_a.name).toBe('C');
  });

  test('the ideas come from the data, a trend never claims a direction', () => {
    const ideas = worldIdeas({
      calendarEvents: [{ title: 'Fashion Week', start_datetime: '2026-11-03T12:00:00Z' }],
      trending: [{ topic: '#velvet', post_count: 4, total_engagement: 80 }],
      tensions: [{ char_a: { name: 'Sable' }, char_b: { name: 'Lala' }, tension_state: 'Simmering' }],
      showId: 'show-b', now: NOW,
    });
    expect(ideas.map((i) => i.text)).toEqual([
      'Fashion Week is coming up in November',
      '#velvet is trending',
      'Tension is simmering between Sable and Lala',
    ]);
    expect(ideas[1].detail).toBe('4 posts');
    expect(ideas.map((i) => i.to)).toEqual(['/universe?tab=culture&sub=events', '/shows/show-b/world?tab=feed', '/shows/show-b/world?tab=episodes']);
    expect(JSON.stringify(ideas)).not.toMatch(/rising|fading/);
  });

  test('with nothing, each idea says so plainly; a source that failed says it could not be read', () => {
    const empty = worldIdeas({ calendarEvents: [], trending: [], tensions: [], showId: 'show-b', now: NOW });
    expect(empty.map((i) => i.empty)).toEqual([
      'Nothing on the cultural calendar ahead yet.',
      'No trending topics in the Feed yet.',
      'No tensions between characters yet.',
    ]);
    expect(empty.every((i) => !i.action)).toBe(true);
    const failed = worldIdeas({ failed: ['society', 'state'], calendarEvents: [], showId: 'show-b', now: NOW });
    expect(failed[1].empty).toMatch(/could not be read/);
    expect(failed[2].empty).toMatch(/could not be read/);
  });

  test('lately is episodes and events by the date they were made, newest first', () => {
    const items = latelyItems({
      episodes: [{ id: 1, episode_number: 1, title: 'Pilot', created_at: '2026-10-01' }, { id: 2, created_at: 'nope' }],
      events: [{ id: 'e1', name: 'Studio Session', created_at: '2026-10-03' }, { id: 'e2', created_at: '2026-10-04' }],
    });
    expect(items.map((i) => `${i.name} ${i.verb}`)).toEqual(['Studio Session added to the Events library', 'Episode 1 created: Pilot']);
  });
});
