/**
 * coinLedgerSync argument guards and whole-coin rounding
 * (docs/EVENT_EPISODE_FLOW.md §8(y) Q7; Task #2246). The SQL paths are
 * covered against a database in tests/integration/coinLedgerSync.integration.test.js.
 */
const { wholeCoins } = require('../../../src/utils/wholeCoins');
const { syncCoinsFromLedger, spendFromLedger } = require('../../../src/services/coinLedgerSync');

describe('wholeCoins (§8(y) Q7)', () => {
  it('rounds half away from zero', () => {
    expect(wholeCoins(2.5)).toBe(3);
    expect(wholeCoins(-2.5)).toBe(-3);
    expect(wholeCoins(2.49)).toBe(2);
    expect(wholeCoins('120.50')).toBe(121);
    expect(wholeCoins(0)).toBe(0);
  });

  it('refuses a value that is not a number', () => {
    expect(() => wholeCoins('abc')).toThrow(TypeError);
    expect(() => wholeCoins(undefined)).toThrow(TypeError);
  });
});

describe('coinLedgerSync guards', () => {
  const sequelize = { query: jest.fn() };

  beforeEach(() => sequelize.query.mockReset());

  it('syncCoinsFromLedger requires a transaction and touches nothing without one', async () => {
    await expect(syncCoinsFromLedger(sequelize, 'show-1')).rejects.toThrow('a transaction is required');
    expect(sequelize.query).not.toHaveBeenCalled();
  });

  it('spendFromLedger requires a transaction', async () => {
    await expect(spendFromLedger(sequelize, { showId: 'show-1', cost: 10 })).rejects.toThrow('a transaction is required');
    expect(sequelize.query).not.toHaveBeenCalled();
  });

  it('spendFromLedger refuses a negative cost before reading anything', async () => {
    await expect(spendFromLedger(sequelize, { showId: 'show-1', cost: -5, transaction: {} })).rejects.toThrow(TypeError);
    expect(sequelize.query).not.toHaveBeenCalled();
  });
});
