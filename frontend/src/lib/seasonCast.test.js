/** lib/seasonCast: the Cast tab's words (round 3, 2026-10-26). */
import { describe, test, expect } from 'vitest';
import { appearanceLine, longestGap, gapText, changeText, rolesLine, personHref } from './seasonCast';

const truth = { key: 'c1', name: 'Truthville', character_id: 'c1', slots: [2, 11], roles: { 2: 'host', 11: 'guest' } };

describe('the cast in words', () => {
  test('who is in which episode, plainly', () => {
    expect(appearanceLine(truth)).toBe('Truthville: E2, E11');
    expect(rolesLine(truth)).toBe('Hosts E2 · Guest at E11');
    expect(rolesLine({ roles: { 4: 'story', 3: 'story' } })).toBe('In the story E3, E4');
  });

  test('the longest absence between two of their episodes, three or more only', () => {
    expect(longestGap(truth)).toEqual({ from: 3, to: 10, length: 8 });
    expect(gapText(longestGap(truth))).toBe('Not seen E3 – E10 (8 episodes)');
    expect(longestGap({ slots: [1, 3, 5] })).toBeNull();
    expect(longestGap({ slots: [4] })).toBeNull();
    expect(gapText(null)).toBeNull();
  });

  test('a relationship change', () => {
    expect(changeText({ a: { name: 'Ana' }, b: { name: 'Ben' }, stage_before: 'friends', stage_after: 'rivals' })).toBe('Ana and Ben: friends to rivals');
    expect(changeText({ a: { name: 'Ana' }, b: { name: 'Ben' }, stage_after: 'close_friends' })).toBe('Ana and Ben: now close friends');
    expect(changeText({ a: { name: 'Ana' }, b: { name: 'Ben' }, type: 'business_partner' })).toBe('Ana and Ben: business partner');
  });

  test('the person page only for a registry character', () => {
    expect(personHref(truth)).toBe('/character/c1');
    expect(personHref({ key: 'profile:9', character_id: null })).toBeNull();
  });
});
