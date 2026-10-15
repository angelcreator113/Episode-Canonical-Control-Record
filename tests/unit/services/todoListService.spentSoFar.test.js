/**
 * Spent so far on the Shopping list (Task #3189; Lala's Phone spec §5): the
 * pieces worn by a beat, each at the charge Finalize books for it
 * (episodeLookCharges.episodeLook, the one rule): owned, already bought,
 * gifted and borrowed pieces add nothing; a rental adds its fee; a bought
 * piece its price. The sum grows only at each piece's line.
 */
jest.mock('@anthropic-ai/sdk', () => jest.fn());
// The shopping list's overlay draws with canvas; nothing here draws.
jest.mock('canvas', () => ({ createCanvas: jest.fn(), registerFont: jest.fn(), loadImage: jest.fn() }));

const { getTodoList } = require('../../../src/services/todoListService');
const { chargeMap } = require('../../../src/services/episodeLookCharges');

// Uuids, so the already-bought check asks the ledger about them.
const ID = {
  gown: '11111111-1111-4111-8111-111111111111',
  pump: '22222222-2222-4222-8222-222222222222',
  bag: '33333333-3333-4333-8333-333333333333',
  ring: '44444444-4444-4444-8444-444444444444',
  scarf: '55555555-5555-4555-8555-555555555555',
  coat: '66666666-6666-4666-8666-666666666666',
};
const LOOK = [
  { id: ID.gown, name: 'Crimson Gown', clothing_category: 'dress', is_owned: false, coin_cost: 900, acquisition_type: 'purchased' },
  { id: ID.pump, name: 'Satin Pump', clothing_category: 'shoes', is_owned: true, coin_cost: 120, acquisition_type: 'purchased' },
  { id: ID.bag, name: 'Pearl Clutch', clothing_category: 'clutch', is_owned: false, coin_cost: 300, acquisition_type: 'purchased' },
  { id: ID.ring, name: 'Gold Ring', clothing_category: 'jewelry', is_owned: false, coin_cost: 200, acquisition_type: 'gifted' },
  { id: ID.scarf, name: 'Silk Scarf', clothing_category: 'accessories', is_owned: false, coin_cost: 150, acquisition_type: 'borrowed' },
  { id: ID.coat, name: 'Opera Coat', clothing_category: 'outerwear', is_owned: false, coin_cost: 800, acquisition_type: 'rented', rental_price: 75 },
];
const SCRIPT = [
  '## BEAT: 8 · Transformation Loop',
  '[UI:OPEN Closet]',
  `[WEAR: ${ID.pump}]`,
  `[WEAR: ${ID.gown}]`,
  `[WEAR: ${ID.ring}]`,
  `[WEAR: ${ID.scarf}]`,
  `[WEAR: ${ID.bag}]`,
  `[WEAR: ${ID.coat}]`,
  'Lala: "Done."',
].join('\n');
const TASKS = [{ slot: 'dress', label: 'The look', required: true }];

function fakeModels({ bought = [] } = {}) {
  const query = jest.fn(async (sql) => {
    if (sql.includes('FROM episode_todo_lists')) return [{ id: 't1', episode_id: 'ep1', tasks: TASKS }];
    if (sql.includes('SELECT script_content')) return [{ script_content: SCRIPT, show_id: 'show-1' }];
    if (sql.includes("ew.approval_status = 'approved'")) return LOOK;
    // episodeLook's read of the look, by the rule Finalize charges by.
    if (sql.includes('COALESCE(ew.approval_status')) return LOOK.map((p) => ({ ...p, approval_status: 'approved' }));
    if (sql.includes('FROM financial_transactions')) return bought.map((id) => ({ source_id: id }));
    throw new Error(`unexpected SQL: ${sql}`);
  });
  return { sequelize: { query, QueryTypes: { SELECT: 'SELECT' } } };
}

const spentAt = async (line, opts) => (await getTodoList('ep1', fakeModels(opts), { beat: 8, line })).spent_so_far;

test('owned, gifted and borrowed pieces add nothing; a bought piece its price; a rental its fee', async () => {
  expect(await spentAt(1)).toBe(0); // the pump she owns
  expect(await spentAt(2)).toBe(900); // the gown, bought
  expect(await spentAt(3)).toBe(900); // the ring, gifted
  expect(await spentAt(4)).toBe(900); // the scarf, borrowed
  expect(await spentAt(5)).toBe(1200); // the clutch
  expect(await spentAt(6)).toBe(1275); // the coat, rented for 75
});

test('a piece already paid for in the ledger adds nothing again', async () => {
  expect(await spentAt(6, { bought: [ID.gown] })).toBe(375);
});

test('the sum grows only at each piece\'s line: before her first cue, nothing', async () => {
  expect(await spentAt(0)).toBe(0);
  const list = await getTodoList('ep1', fakeModels(), { beat: 8, line: 2 });
  expect(list.spent_so_far).toBe(900);
  expect(list.as_of.worn.map((p) => p.name)).toEqual(['Satin Pump', 'Crimson Gown']);
});

test('without a beat there is no running figure; the look total stays the Money page\'s', async () => {
  const models = fakeModels();
  models.sequelize.query.mockImplementationOnce(async () => [{ id: 't1', episode_id: 'ep1', tasks: TASKS }]);
  models.sequelize.query.mockImplementationOnce(async () => LOOK.map((p) => ({ clothing_category: p.clothing_category })));
  const list = await getTodoList('ep1', models);
  expect(list.spent_so_far).toBeUndefined();
});

test('chargeMap reads each piece\'s charge from the look, 0 when it costs nothing', () => {
  const map = chargeMap({ pieces: [{ id: 'a', charge: { amount: 900 } }, { id: 'b', charge: null }] });
  expect([...map]).toEqual([['a', 900], ['b', 0]]);
  expect(chargeMap(null).size).toBe(0);
});
