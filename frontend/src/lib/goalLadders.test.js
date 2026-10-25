/**
 * Goal ladders, the client copy (Evoni, 2026-10-25: "This is very confusing
 * I don't know what I am to do"): the same cases as the server's
 * tests/unit/services/goalLadders.test.js, on her 21 goals.
 */
import { describe, test, expect } from 'vitest';
import {
  KIND, kindOf, directionOf, buildLadders, pickPrimary, goalView, ladderProjectionText, joinNames, tidySuggestions, offTrack, isStoryConditional,
} from './goalLadders';
import { HER_GOALS } from './herGoals.fixture';

describe('kinds and direction', () => {
  test('the metric map, in one place', () => {
    expect(['coins', 'reputation', 'brand_trust'].map(kindOf)).toEqual(['event', 'event', 'event']);
    expect(['followers', 'influence', 'portfolio_strength', 'engagement_rate'].map(kindOf)).toEqual(Array(4).fill('performance'));
    expect(['consistency_streak', 'stress', 'custom'].map(kindOf)).toEqual(Array(3).fill('background'));
    expect(Object.keys(KIND)).toHaveLength(9);
    expect(directionOf('stress')).toBe('down');
    expect(offTrack({ target_metric: 'stress', target_value: 4, current_value: 5 })).toBe(true);
  });
});

describe('her ladders', () => {
  test('seven ladders, one active rung each, the rest up next', () => {
    const lad = buildLadders(HER_GOALS);
    expect(lad.ladders.map((l) => [l.id, l.active.title])).toEqual([
      ['reputation', 'First Impressions'], ['brand_trust', 'Brand Girl Era'], ['influence', 'Growing Influence'], ['stress', 'The Pressure of Influence'],
      ['coins', 'Starter Fund'], ['portfolio_strength', 'Build the Portfolio'], ['followers', 'First 5K'],
    ]);
    expect(lad.ladders.find((l) => l.id === 'coins').upNext.map((g) => g.title)).toEqual(['The Money Talk', 'Closet Upgrade', 'Financial Independence', 'The Perfect Collection']);
    expect(pickPrimary(HER_GOALS).title).toBe('Legacy');
  });

  test('the view: the primary ladder, then event ladders before performance, background and passive apart', () => {
    const v = goalView(HER_GOALS);
    expect(v.primary.id).toBe('reputation');
    expect(v.ladders.map((l) => l.id)).toEqual(['brand_trust', 'coins', 'influence', 'portfolio_strength', 'followers']);
    expect(v.background.map((l) => l.id)).toEqual(['stress']);
    expect(v.passive.map((g) => g.title)).toEqual(['Stay Consistent', 'Manage Stress']);
    expect([v.activeCount, v.upNextCount]).toEqual([9, 12]);
  });

  test('completing a rung makes the next active (derived on read)', () => {
    const after = HER_GOALS.map((g) => (g.id === 'g-starter' ? { ...g, status: 'completed' } : g));
    expect(buildLadders(after).ladders.find((l) => l.id === 'coins').active.title).toBe('The Money Talk');
  });
});

describe('one projection per ladder', () => {
  test('the coin ladder, in words', () => {
    const p = {
      metric: 'coins', current: 294, gain: 7750, projected: 8044, counted: 12,
      clears: [{ title: 'Starter Fund' }, { title: 'The Money Talk' }, { title: 'Closet Upgrade' }],
      next: { title: 'Financial Independence', short: 1956 },
    };
    expect(ladderProjectionText(p)).toBe('8,044 coins expected by season end — clears Starter Fund, The Money Talk and Closet Upgrade; Financial Independence next (1,956 short)');
    expect(ladderProjectionText({ ...p, metric: 'brand_trust', projected: 6, clears: [], next: { title: 'Brand Girl Era', short: 1 } }))
      .toBe('6 brand trust expected by season end — clears no rung yet; Brand Girl Era next (1 short)');
    expect(ladderProjectionText({ ...p, next: null })).toContain('; every rung cleared');
    expect(ladderProjectionText({ metric: 'reputation', current: 0, counted: 0 })).toBe('Reputation: 0 now · no expected reward counted yet');
    expect(ladderProjectionText(null)).toBeNull();
    expect(joinNames(['A'])).toBe('A');
    expect(joinNames(['A', 'B'])).toBe('A and B');
  });
});

describe('Tidy my goals', () => {
  test('merge the two stress limits (keep the stricter), move the story goal to passive, one primary', () => {
    const items = tidySuggestions(HER_GOALS);
    expect(items.map((i) => i.key)).toEqual([
      'merge:g-pressure:g-stress', 'passive:g-flop',
      'primary:g-maison', 'primary:g-luxury', 'primary:g-collection', 'primary:g-25k',
    ]);
    expect(items[0]).toEqual(expect.objectContaining({
      title: 'Merge The Pressure of Influence into Manage Stress', changes: [{ goal_id: 'g-pressure', body: { status: 'abandoned' } }],
    }));
    expect(items[1].changes).toEqual([{ goal_id: 'g-flop', body: { type: 'passive' } }]);
    expect(items[2].changes).toEqual([{ goal_id: 'g-maison', body: { type: 'secondary' } }]);
    expect(isStoryConditional({ title: 'First Impressions' })).toBe(false);
  });

  test('same stat, same target, neither a story goal: keep one, archive the other; tidy goals suggest nothing', () => {
    const a = { ...HER_GOALS[18], id: 'a' };
    const b = { ...HER_GOALS[18], id: 'b', title: 'Starter Fund again', created_at: '2026-10-30T00:00:00Z' };
    expect(tidySuggestions([a, b]).map((i) => i.key)).toEqual(['merge:b:a']);
    expect(tidySuggestions([a])).toEqual([]);
  });
});
