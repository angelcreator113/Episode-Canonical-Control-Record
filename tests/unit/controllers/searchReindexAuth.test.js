// ============================================================================
// searchController.reindexActivities — admin check (#1699)
// ============================================================================
// Used to test req.user.role, which no user has, so it refused everyone. It
// now reads the Cognito admin group. (searchController.test.js is in
// jest.config.js's testPathIgnorePatterns, so this lives in its own file.)

jest.mock('../../../src/config/database', () => ({ getPool: () => ({ query: jest.fn() }) }));
jest.mock('../../../src/services/ActivityIndexService', () => ({ reindexAll: jest.fn() }));
jest.mock('../../../src/services/ActivityService', () => ({}));
jest.mock('../../../src/services/Logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

const ActivityIndexService = require('../../../src/services/ActivityIndexService');
const { reindexActivities } = require('../../../src/controllers/searchController');

const run = async (user) => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  await reindexActivities({ user }, res);
  return res;
};

beforeEach(() => {
  ActivityIndexService.reindexAll.mockReset().mockResolvedValue({ indexed: 3 });
});

describe('reindexActivities admin check', () => {
  test('admin-group user may reindex', async () => {
    const res = await run({ id: 'u1', groups: ['admin'] });
    expect(ActivityIndexService.reindexAll).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('mixed-case admin group is accepted (case-insensitive)', async () => {
    await run({ id: 'u1', groups: ['ADMIN'] });
    expect(ActivityIndexService.reindexAll).toHaveBeenCalledTimes(1);
  });

  test('editor-group user is refused with 403', async () => {
    const res = await run({ id: 'u2', groups: ['editor'] });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(ActivityIndexService.reindexAll).not.toHaveBeenCalled();
  });

  test('user with no groups is refused with 403', async () => {
    const res = await run({ id: 'u3', groups: [] });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(ActivityIndexService.reindexAll).not.toHaveBeenCalled();
  });

  test('a role field alone is refused with 403', async () => {
    const res = await run({ id: 'u4', role: 'admin' });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(ActivityIndexService.reindexAll).not.toHaveBeenCalled();
  });
});
