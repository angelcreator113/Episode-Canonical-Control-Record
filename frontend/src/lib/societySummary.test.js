import { describe, test, expect } from 'vitest';
import { archetypeCounts, societyArchetypeCounts, trendBars, careerLadder, tierFromReputation } from './societySummary';

describe('the Society front page helpers', () => {
  test('the Society tab\'s archetypes, counted by name as the backend compares names; the unset and names off the list apart', () => {
    const list = [{ name: 'The Trendsetter' }, { name: 'The Educator' }, { name: 'The Rebel' }];
    const c = societyArchetypeCounts({
      society_archetypes: { 'The Trendsetter': 4, 'the trendsetter': 1, Educator: 2, 'The Old Name': 3 },
      society_archetype_unset: 40,
    }, list);
    expect(c.count('The Trendsetter')).toBe(5);
    expect(c.count('The Educator')).toBe(2);
    expect(c.count('The Rebel')).toBe(0);
    expect(c.unset).toBe(40);
    expect(c.other).toBe(3);
    const none = societyArchetypeCounts({}, list);
    expect([none.count('The Rebel'), none.unset, none.other]).toEqual([0, 0, 0]);
  });

  test('the ten profile archetypes, counted, biggest first; an unknown one is counted apart', () => {
    const { rows, total, other } = archetypeCounts({ archetypes: { soft_life: 4, the_peer: 9, mystery: 2 } });
    expect(rows).toHaveLength(10);
    expect(rows.slice(0, 2)).toEqual([{ key: 'the_peer', label: 'The Peer', count: 9 }, { key: 'soft_life', label: 'Soft Life', count: 4 }]);
    expect(rows.filter((r) => r.count === 0)).toHaveLength(8);
    expect(total).toBe(15);
    expect(other).toBe(2);
  });

  test('trends by posts, as shares of the biggest, never with a direction', () => {
    const bars = trendBars([{ topic: '#a', post_count: 2, total_engagement: 900 }, { topic: '#b', post_count: 8, total_engagement: 10 }, { topic: '' }]);
    expect(bars.map((b) => [b.topic, b.posts, b.share])).toEqual([['#b', 8, 1], ['#a', 2, 0.25]]);
    expect(JSON.stringify(bars)).not.toMatch(/rising|fading|steady/);
    expect(trendBars([])).toEqual([]);
  });

  test('Lala\'s tier follows careerTierFromReputation: ceil(reputation / 2), 1 to 5', () => {
    expect([0, 1, 2, 3, 6, 9, 10, 14].map(tierFromReputation)).toEqual([1, 1, 1, 2, 3, 5, 5, 5]);
    expect(tierFromReputation(null)).toBeNull();
    const ladder = careerLadder(3);
    expect(ladder.map((t) => t.label)).toEqual(['Elite', 'Influential', 'Established', 'Rising', 'Emerging']);
    expect(ladder.find((t) => t.here).label).toBe('Rising');
    expect(careerLadder(null).some((t) => t.here)).toBe(false);
  });
});
