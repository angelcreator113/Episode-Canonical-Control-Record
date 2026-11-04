/**
 * Lala's closest people on The Pulse (services/lalaCloseFriends; Task #3202),
 * with its readers mocked: friends and relationship partners, each once,
 * scored by closenessOfPairs at the present, closest first; Lala, the
 * excluded and duplicates left out.
 */
jest.mock('../../../src/services/lalaFeedProfile', () => ({ lalaProfileId: jest.fn() }));
jest.mock('../../../src/services/pulseFollows', () => ({ friendsOfLala: jest.fn() }));
jest.mock('../../../src/services/storyClock', () => ({ presentOrder: jest.fn() }));
jest.mock('../../../src/services/pulseCloseness', () => {
  const pairOf = (a, b) => [Number(a), Number(b)].sort((x, y) => x - y);
  return { pairOf, closenessOfPairs: jest.fn() };
});

const { lalaProfileId } = require('../../../src/services/lalaFeedProfile');
const { friendsOfLala } = require('../../../src/services/pulseFollows');
const { presentOrder } = require('../../../src/services/storyClock');
const { closenessOfPairs } = require('../../../src/services/pulseCloseness');
const { lalaCloseFriends } = require('../../../src/services/lalaCloseFriends');

const SHOW = '11111111-1111-1111-1111-111111111111';
const db = (related = []) => ({ sequelize: { query: jest.fn().mockResolvedValue([related]) } });

beforeEach(() => {
  jest.resetAllMocks();
  lalaProfileId.mockResolvedValue(1);
  presentOrder.mockResolvedValue(57);
});

test('friends and relationship partners, each once, closest first, with their closeness at the present', async () => {
  friendsOfLala.mockResolvedValue({ total: 2, list: [{ id: 10, handle: '@ana', display_name: 'Ana' }, { id: 20, handle: '@bo', display_name: 'Bo' }] });
  closenessOfPairs.mockResolvedValue(new Map([['1:10', 0.3], ['1:20', 0.9], ['1:30', 0.6]]));
  const out = await lalaCloseFriends(db([{ id: 20, handle: '@bo', display_name: 'Bo' }, { id: 30, handle: '@cy', display_name: 'Cy' }, { id: 1, handle: '@lala', display_name: 'Lala' }]), SHOW);
  expect(out.lala_profile_id).toBe(1);
  expect(out.friends).toEqual([
    { id: 20, handle: '@bo', display_name: 'Bo', friend: true, closeness: 0.9 },
    { id: 30, handle: '@cy', display_name: 'Cy', friend: false, closeness: 0.6 },
    { id: 10, handle: '@ana', display_name: 'Ana', friend: true, closeness: 0.3 },
  ]);
  expect(closenessOfPairs.mock.calls[0][3]).toBe(57);
  expect(closenessOfPairs.mock.calls[0][2]).toEqual([[1, 10], [1, 20], [1, 30]]);
});

test('the excluded are left out, the limit holds, and with no clock every accepted row counts', async () => {
  presentOrder.mockResolvedValue(null);
  friendsOfLala.mockResolvedValue({ total: 3, list: [{ id: 10, handle: '@a' }, { id: 20, handle: '@b' }, { id: 30, handle: '@c' }] });
  closenessOfPairs.mockResolvedValue(new Map());
  const out = await lalaCloseFriends(db(), SHOW, { exclude: ['20'], limit: 1 });
  expect(out.friends).toHaveLength(1);
  expect(out.friends.map((f) => f.id)).not.toContain(20);
  expect(out.friends[0].closeness).toBe(0);
  expect(closenessOfPairs.mock.calls[0][3]).toBe(2147483647);
});

test('with no Lala profile, nobody; with no one close, an empty list and no scoring', async () => {
  lalaProfileId.mockResolvedValue(null);
  expect(await lalaCloseFriends(db(), SHOW)).toEqual({ lala_profile_id: null, friends: [] });
  lalaProfileId.mockResolvedValue(1);
  friendsOfLala.mockResolvedValue({ total: 0, list: [] });
  expect(await lalaCloseFriends(db(), SHOW)).toEqual({ lala_profile_id: 1, friends: [] });
  expect(closenessOfPairs).not.toHaveBeenCalled();
});
