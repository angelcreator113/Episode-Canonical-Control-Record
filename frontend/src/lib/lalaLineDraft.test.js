/**
 * Lala's line after a piece she puts on (Task 3190; Evoni, 2026-10-14, phone
 * phase 3 ruling 5): a free template from the piece's name, its in-world
 * price and the dress code; her own reaction when the piece has one; the
 * same piece always the same variant. No AI call.
 */
import { describe, test, expect } from 'vitest';
import { draftFacts, draftLine, lalaLine, lalaLineSlots, variantIndex } from './lalaLineDraft';

const DRESS = 'formal gown, heels, statement accessories';
const GOWN = { id: 'dress-1', name: 'Crimson Gown', clothing_category: 'dress', style: 'gown', coin_cost: 900, tier: 'luxury' };
const PUMP = { id: 'shoe-1', name: 'Satin Pump', clothing_category: 'shoes', coin_cost: 120, tier: 'mid' };
const TEE = { id: 'tee-1', name: 'Band Tee', clothing_category: 'top', coin_cost: 40 };

describe('the facts the draft is made from', () => {
  test('a pricey piece is a splurge, an affordable one a steal, one she owns is hers, one with no price free', () => {
    expect(draftFacts(GOWN).cost).toBe('splurge');
    expect(draftFacts(PUMP).cost).toBe('steal');
    expect(draftFacts({ ...PUMP, is_owned: true }).cost).toBe('owned');
    expect(draftFacts({ id: 'x', name: 'Scarf' }).cost).toBe('free');
    // With no tier, the price decides.
    expect(draftFacts({ id: 'y', name: 'Coat', coin_cost: 650 }).cost).toBe('splurge');
  });

  test('a piece fits the dress code by its style, its category in the code\'s words, or its own keywords', () => {
    expect(draftFacts(GOWN, { dressCode: DRESS }).fit).toBe('fits');
    expect(draftFacts(PUMP, { dressCode: DRESS }).fit).toBe('fits'); // shoes meet "heels"
    expect(draftFacts({ id: 'c', name: 'Pearl Clutch', clothing_category: 'clutch' }, { dressCode: DRESS }).fit).toBe('fits');
    expect(draftFacts(TEE, { dressCode: DRESS }).fit).toBe('off');
    expect(draftFacts(TEE, {}).fit).toBe('unknown');
  });
});

describe('the draft', () => {
  test('a pricey piece that fits: its price, worth it, and the dress code met', () => {
    expect(draftLine(GOWN, { dressCode: DRESS })).toBe('The Crimson Gown. 900 coins, and worth every one. Exactly what the dress code asked for.');
  });

  test("an affordable piece that doesn't fit: its price, and the code bent on purpose", () => {
    const line = draftLine(TEE, { dressCode: DRESS });
    expect(line).toContain('40 coins');
    expect(line).toContain('Band Tee');
    expect(line).toMatch(/dress code|Off-code/);
    expect(line).not.toMatch(/asked for|handled|on point/);
  });

  test('her own reaction, when the piece has one, is used as it is', () => {
    expect(draftLine({ ...PUMP, lala_reaction_own: '"These were made for me."' }, { dressCode: DRESS })).toBe('These were made for me.');
  });

  test('the same piece always gets the same variant; different pieces vary', () => {
    expect(draftLine(PUMP, { dressCode: DRESS })).toBe(draftLine({ ...PUMP }, { dressCode: DRESS }));
    expect(variantIndex('shoe-1', 9)).toBe(variantIndex('shoe-1', 9));
    const lines = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => draftLine({ ...PUMP, id }, { dressCode: DRESS })));
    expect(lines.size).toBeGreaterThan(1);
  });

  test('the script line Insert writes', () => {
    expect(lalaLine(' Yes. "This." ')).toBe('Lala: "Yes. \'This.\'"');
  });
});

describe('where a slot goes', () => {
  const LOOK = [GOWN, PUMP, { id: 'e1', name: 'Pearl Drop' }, { id: 'e2', name: 'Pearl Drop' }];
  const BEATS = [{ number: 8, lines: [
    '[UI:OPEN Closet]',
    '[WEAR: dress-1]',
    'Lala: "Already said it."',
    '[UI:SELECT Item satin pump]',
    'Prime: "Nice."',
    '[UI:SELECT Item Pearl Drop]',
    '[WEAR: gone-9]',
    '[WEAR: dress-1]',
  ] }];

  test('after a cue naming one piece with no line of hers next; never after an ambiguous or unknown cue', () => {
    expect(lalaLineSlots(BEATS, LOOK).map((s) => [s.lineIndex, s.piece.id])).toEqual([[3, 'shoe-1'], [7, 'dress-1']]);
  });
});
