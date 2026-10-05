import { describe, test, expect } from 'vitest';
import {
  rowDeltas, episodeTier, lastChange, describeChange, afterEpisode, decisionEntries,
  currentEpisodeNumber, threadSquares, stripSpan, threadPulse,
} from './castContinuity';

const episodes = [
  { id: 'e1', episode_number: 1, title: 'Studio', evaluation_json: JSON.stringify({ tier_final: 'slay' }) },
  { id: 'e2', episode_number: 2, title: 'Gala', evaluation_json: { tier_final: 'pass' } },
  { id: 'e5', episode_number: 5, title: 'Later' },
];
// Newest first, as GET /world/:showId/history returns it.
const history = [
  { id: 'h3', source: 'wardrobe_purchase', deltas_json: '{"coins":-260}', notes: 'Purchased: Pearl Drop Earrings (260 coins)' },
  { id: 'h2', episode_id: 'e2', episode_number: 2, episode_title: 'Gala', source: 'computed', deltas_json: { coins: 300, reputation: 1, stress: 0 }, notes: 'She held the room' },
  { id: 'h1', episode_id: 'e1', episode_number: 1, source: 'computed', deltas_json: { reputation: 2, influence: 1 } },
];

describe('Cast & Continuity helpers', () => {
  test('a row\'s deltas leave out zeros; a tier reads from the evaluation, string or object', () => {
    expect(rowDeltas(history[1])).toEqual([['coins', 300], ['reputation', 1]]);
    expect(episodeTier(episodes[0])).toBe('slay');
    expect(episodeTier(episodes[1])).toBe('pass');
    expect(episodeTier(episodes[2])).toBeNull();
  });

  test('a stat\'s last change is the newest row that moved it, with where it came from', () => {
    const coins = lastChange(history, 'coins', episodes);
    expect(coins).toMatchObject({ delta: -260, episodeNumber: null });
    expect(describeChange(coins)).toBe('Wardrobe purchase');
    const rep = lastChange(history, 'reputation', episodes);
    expect(rep).toMatchObject({ delta: 1, episodeNumber: 2, tier: 'pass' });
    expect(describeChange(rep)).toBe('Episode 2 result (PASS)');
    expect(describeChange(lastChange(history, 'influence', episodes))).toBe('Episode 1 result (SLAY)');
    expect(lastChange(history, 'stress', episodes)).toBeNull();
  });

  test('the stats stand after the newest episode in the history', () => {
    expect(afterEpisode(history)).toBe(2);
    expect(afterEpisode([history[0]])).toBeNull();
  });

  test('the decision log lists episode results only, newest first, with their changes', () => {
    const entries = decisionEntries(history, episodes);
    expect(entries.map((e) => e.episodeNumber)).toEqual([2, 1]);
    expect(entries[0]).toMatchObject({ title: 'Gala', tier: 'pass', notes: 'She held the room', deltas: [['coins', 300], ['reputation', 1]] });
    expect(entries[1]).toMatchObject({ title: 'Studio', tier: 'slay' });
    expect(decisionEntries(history, episodes, 1)).toHaveLength(1);
  });

  test('a thread strip: a square per episode, filled where a slot carries it, ahead past the current one', () => {
    expect(currentEpisodeNumber(episodes)).toBe(5);
    expect(currentEpisodeNumber([])).toBe(0);
    const threads = [{ slot_numbers: [1, 3] }, { slot_numbers: [12] }];
    expect(stripSpan(threads, 5)).toBe(12);
    expect(stripSpan([], 2)).toBe(8);
    expect(stripSpan([{ slot_numbers: [30] }], 2)).toBe(24);
    const squares = threadSquares(threads[0], 8, 5);
    expect(squares.filter((s) => s.on).map((s) => s.slot)).toEqual([1, 3]);
    expect(squares.filter((s) => s.ahead).map((s) => s.slot)).toEqual([6, 7, 8]);
  });

  test('a thread came up in an episode, goes quiet after three without it, or has not come up', () => {
    expect(threadPulse({ last_advanced_episode_id: 'e2' }, episodes, 4)).toEqual({ text: 'Came up in Episode 2', quiet: false });
    expect(threadPulse({ last_advanced_episode_id: 'e2' }, episodes, 5)).toEqual({ text: 'Quiet for 3 episodes', quiet: true });
    expect(threadPulse({}, episodes, 5)).toEqual({ text: 'Has not come up yet', quiet: false });
    expect(threadPulse({ status: 'closed', last_advanced_episode_id: 'e1' }, episodes, 5)).toEqual({ text: 'Closed', quiet: false });
  });
});
