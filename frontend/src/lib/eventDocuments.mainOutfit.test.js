/**
 * The Event Package's shopping list: the main outfit line is a dress, or a
 * top and a bottom (Task 3205; Evoni, 2026-10-14). The same rule as the
 * Wardrobe's lock (stillNeeded, lookBuilder canSaveLook), so the Event
 * Package and the Wardrobe agree.
 */
import { describe, test, expect } from 'vitest';
import { shoppingLines, lineOfSlot } from './eventDocuments';
import { canSaveLook } from './lookBuilder';
import { stillNeeded } from '../components/EpisodeWardrobeGameplay';

const piece = (id, category, coins) => ({ id, name: id, category, charge: coins ? { amount: coins } : null, free_because: coins ? null : 'owned' });
const LIST = { items: [{ slot: 'dress', label: 'Find the showstopper' }, { slot: 'heels', label: 'Find the heels' }] };

describe('the main outfit line', () => {
  test('a top and a pencil skirt fill it, costing both', () => {
    const { lines, total } = shoppingLines(LIST, [piece('Silk Blouse', 'top', 120), piece('Pencil Skirt', 'pencil skirt', 90), piece('Pumps', 'shoes', 0)]);
    expect(lines[0]).toMatchObject({ filled: true, cost: 210 });
    expect(lines[0].pieces.map((p) => p.id)).toEqual(['Silk Blouse', 'Pencil Skirt']);
    expect(lines.some((l) => l.extra)).toBe(false);
    expect(total).toBe(210);
  });

  test('a dress fills it', () => {
    const { lines } = shoppingLines(LIST, [piece('Crimson Gown', 'dress', 400)]);
    expect(lines[0]).toMatchObject({ filled: true, cost: 400 });
  });

  test('a top alone does not', () => {
    const { lines } = shoppingLines(LIST, [piece('Silk Blouse', 'top', 120)]);
    expect(lines[0].filled).toBe(false);
    expect(lines.at(-1)).toMatchObject({ extra: true, label: 'Silk Blouse' });
  });

  test('a list slot is read like a category: "heels" is the shoes line', () => {
    expect(['heels', 'clutch', 'jacket', 'item_3'].map(lineOfSlot)).toEqual(['shoes', 'purse', 'outerwear', 'item_3']);
    expect(shoppingLines(LIST, [piece('Pumps', 'shoes', 0)]).lines[1].filled).toBe(true);
  });
});

describe('the Event Package and the Wardrobe agree', () => {
  const looks = {
    'top + bottom': { top: { id: 't', category: 'top' }, bottom: { id: 'b', category: 'bottom' }, shoes: { id: 's', category: 'shoes' } },
    dress: { body: { id: 'd', category: 'dress' }, shoes: { id: 's', category: 'shoes' } },
    'top only': { top: { id: 't', category: 'top' }, shoes: { id: 's', category: 'shoes' } },
  };
  test.each(Object.entries(looks))('%s', (_, slots) => {
    const wardrobeHasOutfit = !stillNeeded(slots).includes('dress') && canSaveLook(slots, null).why !== 'Pick a dress, or a top and a bottom';
    const listHasOutfit = shoppingLines(LIST, Object.values(slots)).lines[0].filled;
    expect(listHasOutfit).toBe(wardrobeHasOutfit);
  });
});
