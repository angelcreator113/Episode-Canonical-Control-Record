/**
 * The styling game's item modal parts (Task #3144): no "0/60" for a piece
 * that was never scored, no empty LALA SAYS, and why a piece is out of reach
 * in words.
 */
import { describe, test, expect } from 'vitest';
import { poolEntryOf, inspectScore, inspectLalaSays, inspectCannotBuy } from './wardrobeInspect';

const POOL = [{ id: 'p1', match_score: 44, match_reasons: ['Dress code'], lala_reaction: 'Obsessed.' }];

describe('inspectScore', () => {
  test("a closet piece that was never scored has no score", () => {
    expect(inspectScore({ id: 'c1', match_score: 0 }, POOL)).toBeNull();
    expect(inspectScore({ id: 'c1', match_score: 0, match_reasons: [] }, [])).toBeNull();
  });
  test("a closet piece also in the pool takes the pool's score (ids as strings)", () => {
    expect(inspectScore({ id: 'p1', match_score: 0 }, POOL)).toEqual({ value: 44, reasons: ['Dress code'] });
    expect(poolEntryOf({ id: 7 }, [{ id: '7', match_score: 1 }])).toMatchObject({ id: '7' });
  });
  test('a piece with its own match reasons keeps its score', () => {
    expect(inspectScore({ id: 'x', match_score: 30, match_reasons: ['Color'] }, [])).toEqual({ value: 30, reasons: ['Color'] });
  });
});

describe('inspectLalaSays', () => {
  test("the pool's line, else the piece's own", () => {
    expect(inspectLalaSays({ id: 'p1' }, POOL)).toBe('Obsessed.');
    expect(inspectLalaSays({ id: 'x', lala_reaction: ' Hmm. ' }, [])).toBe('Hmm.');
  });
  test("a closet piece: its stored line for its state, else nothing", () => {
    expect(inspectLalaSays({ id: 'x', is_owned: true, can_select: true, lala_reaction_own: 'My favourite.' }, [])).toBe('My favourite.');
    expect(inspectLalaSays({ id: 'x', is_owned: false, can_select: false, lala_reaction_locked: 'One day.' }, [])).toBe('One day.');
    expect(inspectLalaSays({ id: 'x', is_owned: false, can_select: false }, [])).toBeNull();
    expect(inspectLalaSays({ id: 'x', is_owned: false, can_select: true, lala_reaction: '' }, [])).toBeNull();
  });
});

describe('inspectCannotBuy', () => {
  test('nothing to say when she can wear or buy it', () => {
    expect(inspectCannotBuy({ can_select: true }, 0)).toBeNull();
    expect(inspectCannotBuy({ can_purchase: true }, 0)).toBeNull();
  });
  test('each reason in words, never a bare Locked', () => {
    expect(inspectCannotBuy({ is_owned: false, lock_type: 'coin', coin_cost: 900 }, 500)).toBe('Not enough coins: it costs 🪙 900, Lala has 🪙 500');
    expect(inspectCannotBuy({ is_owned: false, lock_type: 'none' }, 9999)).toBe('Price required: give it a coin price in the Wardrobe before Lala can buy it');
    expect(inspectCannotBuy({ is_owned: false, lock_type: 'brand_exclusive', coin_cost: 5 }, 9999)).toBe('Brand exclusive: not for sale');
    expect(inspectCannotBuy({ is_owned: false, lock_type: 'season_drop', season_unlock_episode: 9 }, 9999)).toBe('Season drop: arrives in Episode 9, not for sale');
  });
});
