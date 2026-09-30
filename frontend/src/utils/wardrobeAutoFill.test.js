/**
 * Wardrobe auto-fill price (Task #2347): no floor, and a set price is never
 * overwritten.
 */
import { describe, test, expect } from 'vitest';
import { parseAiPrice, fillPrice } from './wardrobeAutoFill';

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
