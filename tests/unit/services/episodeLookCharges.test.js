/**
 * Lala's look at Finalize: one rule for the charge and for the Money page's
 * estimate (Evoni, 2026-10-06).
 */
const { lookCharges } = require('../../../src/services/episodeLookCharges');
const { plannedLines, buildMoneyLines } = require('../../../src/services/episodeMoneyLines');

const id = (n) => `00000000-0000-4000-8000-00000000000${n}`;

describe('lookCharges', () => {
  test('an unowned piece is bought at its coin cost; owned, already bought, gifted and borrowed pieces cost nothing', () => {
    const charges = lookCharges([
      { id: id(1), name: 'Gown', coin_cost: 420, price: 99, is_owned: false },
      { id: id(2), name: 'Flats', coin_cost: 180, is_owned: true },
      { id: id(3), name: 'Clutch', coin_cost: 90, is_owned: false },
      { id: id(4), name: 'Tiara', coin_cost: 500, is_owned: false, acquisition_type: 'gifted' },
      { id: id(5), name: 'Stole', coin_cost: 300, is_owned: false, acquisition_type: 'borrowed' },
      { id: id(6), name: 'Old snapshot', price: 75, is_owned: false },
    ], new Set([id(3)]));
    expect(charges.map((c) => [c.category, c.piece.name, c.amount])).toEqual([
      ['wardrobe_purchase', 'Gown', 420],
      ['wardrobe_purchase', 'Old snapshot', 75],
    ]);
  });

  test('a rented piece with a rental price is a rental; without one it is bought as usual', () => {
    const charges = lookCharges([
      { id: id(1), name: 'Cape', acquisition_type: 'rented', rental_price: 40, coin_cost: 400, is_owned: false },
      { id: id(2), name: 'Hat', acquisition_type: 'rented', rental_price: 0, coin_cost: 60, is_owned: false },
    ]);
    expect(charges.map((c) => [c.category, c.amount])).toEqual([['wardrobe_rental', 40], ['wardrobe_purchase', 60]]);
  });
});

describe("the plan's look lines", () => {
  const event = { id: id(9), name: 'Studio Session', is_paid: false };

  test('each charge is a planned expense at Finalize that Lala pays; it posts when its row exists', () => {
    const plan = plannedLines({
      event,
      look: [
        { category: 'wardrobe_purchase', piece: { id: id(1), name: 'Gown' }, amount: 420 },
        { category: 'wardrobe_rental', piece: { id: id(2), name: 'Cape' }, amount: 40 },
      ],
    });
    const look = plan.filter((l) => l.look);
    expect(look.map((l) => [l.key, l.label, l.amount, l.trigger, l.payer.who])).toEqual([
      [`wardrobe_purchase|${id(1)}`, 'Gown', 420, 'at Finalize', 'lala'],
      [`wardrobe_rental|${id(2)}`, 'Rental: Cape', 40, 'at Finalize', 'lala'],
    ]);
    const { lines, unplanned, projection } = buildMoneyLines({
      plan,
      rows: [{ id: 'r1', category: 'wardrobe_purchase', source_id: id(1), amount: 420, signed: -420 }],
      balance: 1000,
    });
    expect(lines.find((l) => l.label === 'Gown').state).toBe('posted');
    expect(lines.find((l) => l.label === 'Rental: Cape').state).toBe('planned');
    expect(unplanned).toEqual([]);
    // The look adds −460 (−420 posted, −40 planned) to whatever the event's own lines make.
    const without = buildMoneyLines({ plan: plan.filter((l) => !l.look), rows: [], balance: 1000 }).projection;
    expect(projection.projected_net - without.projected_net).toBe(-460);
    expect(projection.projected_balance - without.projected_balance).toBe(-40);
  });
});
