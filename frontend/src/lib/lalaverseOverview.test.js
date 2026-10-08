import { describe, test, expect } from 'vitest';
import { nextCulturalEvent, topTrend, topTension, worldIdeas, latelyItems, bookSummary } from './lalaverseOverview';

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
    // The Relationships page's states rank by heat too (fix-list item 23): volatile above simmering.
    const table = [
      { char_a: { name: 'A' }, char_b: { name: 'B' }, tension_state: 'simmering' },
      { char_a: { name: 'F' }, char_b: { name: 'G' }, tension_state: 'fractured' },
      { char_a: { name: 'V' }, char_b: { name: 'W' }, tension_state: 'volatile' },
    ];
    expect(topTension(table).char_a.name).toBe('V');
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

  test('a book says its status, whose story it is, its counts and how much is approved', () => {
    const b = bookSummary({ id: 'b1', title: 'Before Lala', subtitle: 'A memoir', status: 'in_review', character_name: 'JustAWoman', era_name: 'Before', chapter_count: 3, line_count: 40, approved_count: 10, pending_count: 2, last_chapter_title: 'The Studio', recent_insight: 'She kept the receipts.' });
    expect(b).toEqual({ id: 'b1', title: 'Before Lala', subtitle: 'A memoir', status: 'In review', statusKey: 'in_review', whose: 'JustAWoman · Before', counts: '3 chapters · 40 lines · 2 waiting for review', approved: 10, total: 40, lastChapter: 'The Studio', insight: 'She kept the receipts.' });
    const empty = bookSummary({ id: 'b2' });
    expect([empty.title, empty.status, empty.whose, empty.counts, empty.total]).toEqual(['Untitled book', 'Draft', null, '0 chapters · 0 lines', 0]);
  });
});
