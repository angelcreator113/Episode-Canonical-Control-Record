// ============================================================================
// What the writer reads of Lala's money (Evoni, 2026-10-18): the Money page's
// own lines, the balance before the episode, and the approved shopping list.
// No database, no network.
// ============================================================================

beforeEach(() => {
  jest.resetModules();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const LINES = [
  { look: true, label: 'Midnight Bloom Lace Peplum Jacket', amount: 120, source: { id: 'jacket-1' }, state: 'posted', kind: 'expense' },
  { label: 'Entry / ticket', amount: 50, covered: true, state: 'covered', kind: 'expense' },
  { label: 'Drinks × 2', amount: 100, state: 'planned', kind: 'expense' },
  { label: 'Content fee: Pulse video', amount: 439, state: 'planned', kind: 'income' },
  { label: 'Bonus if SLAY', amount: 200, conditional: true, state: 'planned', kind: 'income' },
];

test('reads the balance before the episode and sorts the lines', async () => {
  jest.doMock('../../../src/services/episodeMoneyService', () => ({ getEpisodeMoney: async () => ({ balance: 768, net: -1132, lines: LINES }) }));
  const { loadScriptMoney } = require('../../../src/services/scriptMoneyContext');
  const money = await loadScriptMoney({}, { showId: 's1', episodeId: 'e1', event: { canon_consequences: {} } });
  expect(money.balanceBefore).toBe(1900);
  expect(money.look).toEqual([{ id: 'jacket-1', name: 'Midnight Bloom Lace Peplum Jacket', amount: 120 }]);
  expect(money.covered).toEqual([{ label: 'Entry / ticket' }]);
  expect(money.recap).toEqual([{ label: 'Drinks × 2', amount: 100 }]);
  expect(money.income).toEqual([{ label: 'Content fee: Pulse video', amount: 439 }]);
  expect(money.shopping).toBeNull();
});

test("reads the approved shopping list with the look's pieces", async () => {
  jest.doMock('../../../src/services/episodeMoneyService', () => ({ getEpisodeMoney: async () => null }));
  jest.doMock('../../../src/services/episodeLookCharges', () => ({ episodeLook: async () => ({ pieces: [{ id: 'jacket-1', name: 'Jacket', category: 'jacket' }] }) }));
  jest.doMock('../../../src/services/eventDocumentOverlayService', () => ({
    shoppingLines: () => ({ total: 120, lines: [{ label: 'Statement jacket', piece: { name: 'Jacket' }, cost: 120, owned: false, filled: true }] }),
  }));
  const { loadScriptMoney } = require('../../../src/services/scriptMoneyContext');
  const event = { canon_consequences: { documents: { shopping_list: { status: 'approved', items: [{ slot: 'jacket', label: 'Statement jacket' }], overlay: { url: 'x' } } } } };
  const money = await loadScriptMoney({}, { showId: 's1', episodeId: 'e1', event });
  expect(money.shopping).toEqual({ overlay: true, total: 120, lines: [{ label: 'Statement jacket', pieces: ['Jacket'], cost: 120, owned: false, filled: true, extra: false }] });
});

test('a draft list is not read, and a failed read is logged and left out', async () => {
  jest.doMock('../../../src/services/episodeMoneyService', () => ({ getEpisodeMoney: async () => { throw new Error('down'); } }));
  const { loadScriptMoney } = require('../../../src/services/scriptMoneyContext');
  const event = { canon_consequences: { documents: { shopping_list: { status: 'draft', items: [] } } } };
  expect(await loadScriptMoney({}, { showId: 's1', episodeId: 'e1', event })).toBeNull();
  expect(console.error).toHaveBeenCalledWith('[ScriptMoney] money read failed (the script reads no coins):', 'down');
});
