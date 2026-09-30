/**
 * Wardrobe auto-fill price (Task #2347): no floor, and a set price is never
 * overwritten.
 */
import { describe, test, expect } from 'vitest';
import { parseAiPrice, fillPrice, suggestCoinCost } from './wardrobeAutoFill';

describe('parseAiPrice', () => {
  test('keeps a price under the old 150 floor', () => {
    expect(parseAiPrice(45)).toBe('45.00');
    expect(parseAiPrice('$89.5')).toBe('89.50');
  });

  test('keeps a high price as given', () => {
    expect(parseAiPrice('2,500')).toBe('2500.00');
  });

  test('a missing, zero or non-numeric estimate gives no suggestion', () => {
    for (const v of [null, undefined, '', 0, '0', 'n/a']) expect(parseAiPrice(v)).toBe('');
  });
});

describe('fillPrice', () => {
  test('fills an empty price with the suggestion', () => {
    expect(fillPrice('', '45.00')).toBe('45.00');
    expect(fillPrice(null, '45.00')).toBe('45.00');
    expect(fillPrice('  ', '45.00')).toBe('45.00');
  });

  test('never overwrites a price that is set', () => {
    expect(fillPrice('385.00', '45.00')).toBe('385.00');
    expect(fillPrice('0', '45.00')).toBe('0');
  });

  test('no suggestion leaves an empty price empty', () => {
    expect(fillPrice('', '')).toBe('');
  });
});

describe('suggestCoinCost (Evoni, 2026-09-30)', () => {
  test('follows the price she set, not the AI\'s coin cost or price', () => {
    expect(suggestCoinCost('385.00', 120, '45.00')).toBe(385);
    expect(suggestCoinCost('89.5', null, '45.00')).toBe(90);
    expect(suggestCoinCost('0', 120, '45.00')).toBe(0);
  });

  test('with no price set: the AI coin cost, else the AI price', () => {
    expect(suggestCoinCost('', 120, '45.00')).toBe(120);
    expect(suggestCoinCost('', '$1,200', '45.00')).toBe(1200);
    expect(suggestCoinCost(null, null, '45.00')).toBe(45);
    expect(suggestCoinCost('', null, '')).toBe('');
  });
});
