// ============================================================================
// The shopping list's total is what Lala's look costs (Evoni, 2026-10-09:
// "Lala's shopping list overlay is not showing the correct total for
// everything"; Task #2787). One look, the one Finalize charges, and one rule
// for every place the list shows. No database, no network.
// ============================================================================

const { shoppingLines, overlayState } = require('../../../src/services/eventDocumentOverlayService');
const { episodeLook } = require('../../../src/services/episodeLookCharges');
const { documentPieces } = require('../../../src/services/episodeOverlaysService');

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const DOC = { items: [
  { slot: 'dress', label: 'Find a statement piece' },
  { slot: 'shoes', label: 'Find heels' },
  { slot: 'jewelry', label: 'Find earrings' },
] };

describe('shoppingLines (the drawn overlay)', () => {
  test('pieces of the episode\'s look count their charge; a piece no line takes is its own line', () => {
    const { lines, total } = shoppingLines(DOC, [
      { name: 'Sculpted Dress', category: 'dress', coin_cost: 420, charge: { category: 'wardrobe_purchase', amount: 420 }, free_because: null },
      { name: 'Satin Heels', category: 'shoes', coin_cost: 300, charge: null, free_because: 'bought' },
      { name: 'Gold Drops', category: 'earrings', coin_cost: 90, charge: { category: 'wardrobe_purchase', amount: 90 }, free_because: null },
      { name: 'Pearl Choker', category: 'necklace', coin_cost: 150, charge: { category: 'wardrobe_purchase', amount: 150 }, free_because: null },
      { name: 'Velvet Wrap', category: 'outerwear', coin_cost: 200, charge: { category: 'wardrobe_rental', amount: 60 }, free_because: null },
    ]);
    expect(lines.map((l) => [l.slot, l.label, l.owned, l.cost])).toEqual([
      ['dress', 'Find a statement piece', false, 420],
      ['shoes', 'Find heels', true, 0],
      ['jewelry', 'Find earrings', false, 90],
      ['extra', 'Pearl Choker', false, 150],
      ['extra', 'Velvet Wrap', false, 60],
    ]);
    expect(total).toBe(720);
  });

  test('the event\'s own outfit (no charges yet) counts what is not owned, as before', () => {
    const { total } = shoppingLines(DOC, [
      { name: 'Sculpted Dress', category: 'dress', coin_cost: 420, is_owned: false },
      { name: 'Flats', category: 'shoes', coin_cost: 180, is_owned: true },
    ]);
    expect(total).toBe(420);
  });
});

describe('overlayState', () => {
  const doc = { status: 'approved', version: 2, overlay: { url: 'u', version: 2, look_total: 420 } };
  test('current while the look costs what it was drawn with; outdated once it does not', () => {
    expect(overlayState(doc)).toBe('current');
    expect(overlayState(doc, 420)).toBe('current');
    expect(overlayState(doc, 570)).toBe('outdated');
    expect(overlayState({ ...doc, version: 3 }, 420)).toBe('outdated');
    expect(overlayState({ ...doc, overlay: { url: 'u', version: 2 } }, 570)).toBe('current');
  });
});

describe('episodeLook carries each piece\'s category', () => {
  test('a locked piece keeps its clothing_category, so the list can find its line', async () => {
    const sequelize = {
      QueryTypes: { SELECT: 'SELECT' },
      query: jest.fn(async (sql) => {
        if (/FROM episode_wardrobe/.test(sql)) {
          return [{ id: '00000000-0000-4000-8000-000000000001', name: 'Sculpted Dress', clothing_category: 'dress', is_owned: false, coin_cost: 420, approval_status: 'approved' }];
        }
        return [];
      }),
    };
    const look = await episodeLook(sequelize, { episodeId: 'ep-1', event: null, showId: 'show-1' });
    expect(look.state).toBe('locked');
    expect(look.pieces[0]).toMatchObject({ name: 'Sculpted Dress', category: 'dress', charge: { amount: 420 } });
    expect(look.total).toBe(420);
    expect(shoppingLines(DOC, look.pieces).lines[0]).toMatchObject({ slot: 'dress', cost: 420 });
  });
});

describe('documentPieces (the episode\'s Overlays tab)', () => {
  test('a shopping list drawn with another total than the look\'s now reads outdated', () => {
    const shopping_list = { status: 'approved', version: 1, overlay: { url: 'u', version: 1, look_total: 420 } };
    const event = { id: 'ev-1', show_id: 'show-1', name: 'Gala', canon_consequences: { documents: { shopping_list } } };
    expect(documentPieces(event)[0].status).toBe('approved');
    expect(documentPieces(event, { shopping_list: 420 })[0].status).toBe('approved');
    expect(documentPieces(event, { shopping_list: 570 })[0].status).toBe('outdated');
  });
});
