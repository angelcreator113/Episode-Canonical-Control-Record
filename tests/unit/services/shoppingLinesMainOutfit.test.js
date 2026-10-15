/**
 * The shopping list's main outfit line is a dress, or a top and a bottom
 * (Task #3205; Evoni, 2026-10-14: "Lala's Look shows incomplete although
 * the outfit is complete"). The Event Package's list matched pieces to lines
 * by exact slot, so the dress line took a dress only and a top and a skirt
 * fell to the end as extra lines. The same rule as the episode's list
 * (todoListService.listSlotsFilled) and the Wardrobe's lock.
 */
jest.mock('@anthropic-ai/sdk', () => jest.fn());
// The overlay draws with canvas; nothing here draws.
jest.mock('canvas', () => ({ createCanvas: jest.fn(), registerFont: jest.fn(), loadImage: jest.fn() }));

const { shoppingLines } = require('../../../src/services/eventDocumentOverlayService');
const { listSlotOf, listSlotsFilled } = require('../../../src/services/todoListService');

const piece = (id, category, coins, extra = {}) => ({ id, name: id, category, charge: coins ? { category: 'wardrobe_purchase', amount: coins } : null, free_because: coins ? null : 'owned', ...extra });
const LIST = { items: [
  { slot: 'dress', label: 'Find the showstopper' },
  { slot: 'heels', label: 'Find the heels' },
  { slot: 'clutch', label: 'Find the clutch' },
] };
const view = (r) => r.lines.map((l) => [l.slot, l.filled, (l.pieces || (l.piece ? [l.piece] : [])).map((p) => p.id), l.cost]);

describe('the main outfit line', () => {
  test('a top and a bottom fill it, costing both; nothing is left as an extra', () => {
    const look = [piece('Silk Blouse', 'top', 120), piece('Pencil Skirt', 'skirt', 90), piece('Pumps', 'shoes', 0), piece('Pearl Clutch', 'clutch', 60)];
    const r = shoppingLines(LIST, look);
    expect(view(r)).toEqual([
      ['dress', true, ['Silk Blouse', 'Pencil Skirt'], 210],
      ['heels', true, ['Pumps'], 0],
      ['clutch', true, ['Pearl Clutch'], 60],
    ]);
    expect(r.total).toBe(270);
  });

  test('a dress fills it', () => {
    const r = shoppingLines(LIST, [piece('Crimson Gown', 'dress', 400), piece('Pumps', 'shoes', 0)]);
    expect(view(r)[0]).toEqual(['dress', true, ['Crimson Gown'], 400]);
  });

  test('a top alone does not; it stays an extra line', () => {
    const r = shoppingLines(LIST, [piece('Silk Blouse', 'top', 120)]);
    expect(r.lines[0].filled).toBe(false);
    expect(r.lines.at(-1)).toMatchObject({ slot: 'extra', label: 'Silk Blouse', cost: 120 });
  });

  test('with its own top and bottom lines holding them, it is covered and costs nothing more', () => {
    const list = { items: [{ slot: 'dress', label: 'Main' }, { slot: 'top', label: 'Top' }, { slot: 'bottom', label: 'Bottom' }] };
    const r = shoppingLines(list, [piece('Silk Blouse', 'top', 120), piece('Pencil Skirt', 'skirt', 90)]);
    expect(r.lines[0]).toMatchObject({ filled: true, covered: true, cost: 0 });
    expect(r.total).toBe(210);
  });

  test('a jacket fills an outerwear line when the list has one; else it is an extra, counted once', () => {
    const jacket = piece('Tweed Jacket', 'jacket', 150);
    expect(shoppingLines({ items: [{ slot: 'outerwear', label: 'Find the jacket' }] }, [jacket]).lines[0].filled).toBe(true);
    const r = shoppingLines(LIST, [jacket]);
    expect(r.lines.at(-1)).toMatchObject({ slot: 'extra', label: 'Tweed Jacket' });
    expect(r.total).toBe(150);
  });
});

describe('one rule with the episode list', () => {
  test("a line's slot is read like a piece's category", () => {
    expect(['heels', 'clutch', 'jacket', 'pencil skirt', 'blouse'].map(listSlotOf)).toEqual(['shoes', 'purse', 'outerwear', 'bottom', 'top']);
  });

  test('the episode list fills the dress line from a top and a bottom too', () => {
    expect(listSlotsFilled(['top', 'skirt', 'jacket']).has('dress')).toBe(true);
    expect(listSlotsFilled(['top']).has('dress')).toBe(false);
  });
});
