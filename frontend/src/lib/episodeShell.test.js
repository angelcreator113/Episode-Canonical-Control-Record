import { describe, test, expect } from 'vitest';
import { checklistLeft, coinsLabel } from './episodeShell';

const SECTIONS = [{ items: [{ id: 'a' }, { id: 'b' }] }, { items: [{ id: 'c' }] }];

describe('episodeShell', () => {
  test('counts the open checks', () => {
    expect(checklistLeft({ a: true, b: false }, SECTIONS)).toBe(2);
    expect(checklistLeft({ a: true, b: true, c: true }, SECTIONS)).toBe(0);
    expect(checklistLeft(null, SECTIONS)).toBeNull();
  });
  test('labels the balance', () => {
    expect(coinsLabel(1900)).toBe('1,900 coins');
    expect(coinsLabel(-40)).toBe('-40 coins');
    expect(coinsLabel('x')).toBeNull();
  });
});
