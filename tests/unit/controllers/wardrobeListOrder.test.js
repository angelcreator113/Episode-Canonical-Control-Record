/**
 * W3 (Evoni, 2026-10-01: "Full Closet still doesn't show all my pieces").
 * The Full Closet reads GET /api/v1/wardrobe page by page. Paging by
 * created_at alone is not a stable order where pieces share a timestamp, so
 * a piece could fall between pages; listWardrobeItems breaks ties by id, on
 * the ORM path and the raw-SQL fallback alike. No database: the models
 * module is mocked.
 */

const mockWardrobe = { findAndCountAll: jest.fn() };
const mockSequelize = { query: jest.fn() };

jest.mock('../../../src/models', () => ({
  models: { Wardrobe: mockWardrobe, EpisodeWardrobe: {}, Episode: {} },
  sequelize: mockSequelize,
  Sequelize: {},
}));
jest.mock('../../../src/services/wardrobeImageService', () => ({}));
jest.mock('../../../src/services/removeBgParams', () => ({ applyRemoveBgParams: jest.fn() }));

const wardrobeController = require('../../../src/controllers/wardrobeController');

const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });

describe('listWardrobeItems: a stable page order (W3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test('the ORM path orders by the sort column, then id', async () => {
    mockWardrobe.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    const res = makeRes();
    await wardrobeController.listWardrobeItems({ query: { show_id: 's-1', limit: '200', page: '2' } }, res);
    expect(mockWardrobe.findAndCountAll.mock.calls[0][0].order).toEqual([['created_at', 'DESC'], ['id', 'ASC']]);
    expect(mockWardrobe.findAndCountAll.mock.calls[0][0].offset).toBe(200);
  });

  test('the raw-SQL fallback orders by the sort column, then id', async () => {
    mockWardrobe.findAndCountAll.mockRejectedValue(new Error('column mismatch'));
    mockSequelize.query.mockImplementation(async (sql) => {
      if (sql.includes('information_schema')) return [[{ column_name: 'id' }, { column_name: 'deleted_at' }, { column_name: 'show_id' }, { column_name: 'created_at' }]];
      if (sql.startsWith('SELECT COUNT')) return [[{ total: '0' }]];
      return [[]];
    });
    const res = makeRes();
    await wardrobeController.listWardrobeItems({ query: { show_id: 's-1', sortBy: 'name', sortOrder: 'asc' } }, res);
    const select = mockSequelize.query.mock.calls.map(([sql]) => sql).find((sql) => sql.startsWith('SELECT * FROM wardrobe'));
    expect(select).toMatch(/ORDER BY created_at ASC, id ASC LIMIT/);
  });
});
