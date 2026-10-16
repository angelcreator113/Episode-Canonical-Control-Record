/**
 * One stale window for every reader of a set's or angle's generating state
 * (audit, 2026-10-15: a 10-minute sweep beside the 15-minute claim).
 */
const claim = require('../../../src/services/generationClaimService');
const venueLook = require('../../../src/services/venueLookImageService');

describe('generationClaimService', () => {
  test('the venue-look sweep uses the claim\'s window', () => {
    expect(claim.GENERATION_STALE_MINUTES).toBe(15);
    expect(venueLook.STUCK_AFTER_MS).toBe(claim.STALE_MS);
    expect(venueLook.STUCK_REASON).toBe('Timed out: no image after 15 minutes');
  });

  test('isLiveGeneration: generating within the window, on a model instance or a plain row', () => {
    const ago = (min) => new Date(Date.now() - min * 60 * 1000);
    expect(claim.isLiveGeneration({ generation_status: 'generating', updatedAt: ago(11) })).toBe(true);
    expect(claim.isLiveGeneration({ generation_status: 'generating', updated_at: ago(16) })).toBe(false);
    expect(claim.isLiveGeneration({ generation_status: 'complete', updatedAt: ago(1) })).toBe(false);
    expect(claim.isLiveGeneration(null)).toBe(false);
  });

  test('claimRow claims in one statement, only a known table', async () => {
    const sequelize = { query: jest.fn(async () => [[{ id: 'a1' }]]) };
    expect(await claim.claimRow(sequelize, 'angle', 'a1')).toBe(true);
    expect(sequelize.query.mock.calls[0][0]).toMatch(/UPDATE scene_angles SET generation_status = 'generating'/);
    expect(sequelize.query.mock.calls[0][1].replacements).toEqual({ id: 'a1', stale: 15 });
    sequelize.query.mockResolvedValueOnce([[]]);
    expect(await claim.claimRow(sequelize, 'set', 's1')).toBe(false);
    await expect(claim.claimRow(sequelize, 'episodes', 'x')).rejects.toThrow(/Unknown claim kind/);
  });
});
