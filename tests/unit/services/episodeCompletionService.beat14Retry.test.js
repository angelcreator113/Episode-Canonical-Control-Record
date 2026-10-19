// ============================================================================
// A repeat completion resolves a beat 14 opportunity the first one left held
// (Script page re-audit, 2026-10-19: completion's resolve failed and nothing
// retried it). Mocked: no database.
// ============================================================================

const mockResolve = jest.fn();
jest.mock('../../../src/services/beat14Opportunity', () => ({ resolveHeldAfterCompletion: (...a) => mockResolve(...a) }));
jest.mock('../../../src/models', () => ({ Opportunity: {} }));

const { completeEpisode } = require('../../../src/services/episodeCompletionService');

const sequelize = {
  QueryTypes: { SELECT: 'SELECT' },
  query: jest.fn(async () => [{ id: 'ep-1', show_id: 'show-1', evaluation_status: 'accepted', evaluation_json: { tier_final: 'pass' } }]),
};

beforeEach(() => { mockResolve.mockReset(); jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

test('an already-completed episode gets its held beat 14 resolved, and says so', async () => {
  mockResolve.mockResolvedValue({ id: 'o1', name: 'Cover', status: 'offered' });
  const out = await completeEpisode('ep-1', 'show-1', sequelize);
  expect(out.already_completed).toBe(true);
  expect(mockResolve).toHaveBeenCalledWith(expect.anything(), { episodeId: 'ep-1' });
  expect(out.beat14_opportunity).toEqual({ id: 'o1', name: 'Cover', status: 'offered' });
});

test('nothing held: the answer is as before; a failed resolve is logged and completion still answers', async () => {
  mockResolve.mockResolvedValue(null);
  expect(await completeEpisode('ep-1', 'show-1', sequelize)).not.toHaveProperty('beat14_opportunity');
  mockResolve.mockRejectedValue(new Error('db down'));
  const out = await completeEpisode('ep-1', 'show-1', sequelize);
  expect(out.already_completed).toBe(true);
  expect(console.error).toHaveBeenCalledWith('[EpisodeCompletion] Beat 14 late resolve failed (non-blocking):', 'db down');
});
