/**
 * getOutfitScore({ pieces }) — the outfit match scored on the event's pieces
 * (Task #1924; Evoni's ruling, 2026-09-25).
 *
 * Completion passes the event's outfit_pieces when the episode has no
 * approved look. The scorer then reads those pieces' wardrobe rows by id,
 * never episode_wardrobe, and falls back to the pieces' own snapshots
 * (category as clothing_category) when no row is found. The real
 * scoreOutfitForEvent runs; sequelize.query is a recording stub. No database.
 */
const mockModels = { sequelize: { query: jest.fn() } };
jest.mock('../../../src/models', () => mockModels);
jest.mock('../../../src/controllers/wardrobeController', () => new Proxy({}, { get: () => (req, res) => res.json({}) }));
jest.mock('../../../src/middleware/auth', () => ({
  requireAuth: (req, res, next) => next(),
  optionalAuth: (req, res, next) => next(),
  authorize: () => (req, res, next) => next(),
}));

const { getOutfitScore } = require('../../../src/routes/wardrobe');

const EVENT = { dress_code: 'black tie', prestige: 7, event_type: 'gala' };
const PIECES = [
  { id: 'w-dress', name: 'Gold gown', category: 'dress', tier: 'luxury', brand: 'Maison Belle', price: 400 },
  { id: 'w-heels', name: 'Heels', category: 'shoes', tier: 'luxury', brand: 'Aurelia', price: 150 },
];
const ROWS = [
  { id: 'w-dress', name: 'Gold gown', clothing_category: 'dress', tier: 'luxury', brand: 'Maison Belle', price: 400, aesthetic_tags: '["glam"]', event_types: '["gala"]' },
  { id: 'w-heels', name: 'Heels', clothing_category: 'shoes', tier: 'luxury', brand: 'Aurelia', price: 150, aesthetic_tags: '[]', event_types: '[]' },
];

beforeEach(() => {
  mockModels.sequelize.query.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('scores the pieces\' wardrobe rows by id, and never reads episode_wardrobe', async () => {
  mockModels.sequelize.query.mockImplementation(async () => [ROWS.map((r) => ({ ...r }))]);
  const result = await getOutfitScore(mockModels, 'ep-1', EVENT, null, null, { pieces: PIECES });

  const sqls = mockModels.sequelize.query.mock.calls.map(([sql]) => sql);
  expect(sqls).toHaveLength(1);
  expect(sqls[0]).toMatch(/FROM wardrobe w\s+WHERE w\.id IN \(:ids\) AND w\.deleted_at IS NULL/);
  expect(sqls[0]).not.toMatch(/episode_wardrobe/);
  expect(mockModels.sequelize.query.mock.calls[0][1].replacements).toEqual({ ids: ['w-dress', 'w-heels'] });
  expect(result.hasOutfit).toBe(true);
  expect(result.score).toBeGreaterThan(0);
  expect(result.items.map((i) => i.id)).toEqual(['w-dress', 'w-heels']);
});

test('no wardrobe row found: the pieces\' own snapshots are scored, category as clothing_category', async () => {
  mockModels.sequelize.query.mockImplementation(async () => [[]]);
  const result = await getOutfitScore(mockModels, 'ep-1', EVENT, null, null, { pieces: PIECES });

  expect(result.hasOutfit).toBe(true);
  expect(result.items.map((i) => [i.id, i.category])).toEqual([['w-dress', 'dress'], ['w-heels', 'shoes']]);
});

test('without pieces it still reads the episode\'s own look', async () => {
  mockModels.sequelize.query.mockImplementation(async () => [[]]);
  const result = await getOutfitScore(mockModels, 'ep-1', EVENT, null, null, { approvedOnly: true });

  const [sql] = mockModels.sequelize.query.mock.calls[0];
  expect(sql).toMatch(/FROM episode_wardrobe ew/);
  expect(sql).toMatch(/ew\.approval_status = 'approved'/);
  expect(result.hasOutfit).toBe(false);
});
