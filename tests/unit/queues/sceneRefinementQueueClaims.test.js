/**
 * Scene Sets audit #3 (2026-10-15), money: two auto-refine clicks queued two
 * paid chains; a queued pass did not claim the angle, so a Generate clicked
 * meanwhile raced it; and passes 2 and 3 overwrote a picture regenerated
 * since they were queued.
 */
const mockQueue = { jobs: new Map(), handler: null };
jest.mock('bull', () => jest.fn().mockImplementation(() => ({
  on: jest.fn(),
  process: jest.fn((_name, _n, fn) => { mockQueue.handler = fn; }),
  getJob: jest.fn(async (id) => mockQueue.jobs.get(id) || null),
  add: jest.fn(async (_name, data, opts) => {
    const job = { id: opts.jobId || 'auto', data, getState: async () => 'waiting', remove: jest.fn(async () => { mockQueue.jobs.delete(opts.jobId); }) };
    if (opts.jobId) mockQueue.jobs.set(opts.jobId, job);
    return job;
  }),
})));
jest.mock('../../../src/config/redis', () => ({ redisConfig: {} }));
const mockClaimRow = jest.fn();
jest.mock('../../../src/services/generationClaimService', () => ({
  claimRow: (...a) => mockClaimRow(...a),
  isLiveGeneration: jest.requireActual('../../../src/services/generationClaimService').isLiveGeneration,
}));
const mockRegenerate = jest.fn();
jest.mock('../../../src/services/sceneGenerationService', () => ({ regenerateAngleRefined: (...a) => mockRegenerate(...a) }));
jest.mock('../../../src/services/postProcessingService', () => ({ processAngleAssets: jest.fn() }));
jest.mock('../../../src/services/artifactDetectionService', () => ({ refineFixes: (c) => c }));
const mockAngle = { id: 'a1', angle_name: 'Vanity', generation_attempt: 2 };
const mockModels = {
  SceneAngle: { sequelize: {}, findByPk: jest.fn(async () => mockAngle), update: jest.fn(async () => [1]) },
  SceneSet: { findByPk: jest.fn(async () => ({ id: 's1' })) },
};
jest.mock('../../../src/models', () => mockModels);

const queue = require('../../../src/queues/sceneRefinementQueue');

describe('the refinement queue', () => {
  beforeAll(() => queue.registerWorker());
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueue.jobs.clear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  const run = (data) => mockQueue.handler({ data: { angleId: 'a1', sceneSetId: 's1', artifactCategories: ['blur'], pass: 1, runPostProcessing: false, ...data }, progress: jest.fn() });

  test('a second request for the same picture gets the waiting job back', async () => {
    const first = await queue.addRefinementJob({ angleId: 'a1', sceneSetId: 's1', artifactCategories: ['blur'], attempt: 2 });
    const second = await queue.addRefinementJob({ angleId: 'a1', sceneSetId: 's1', artifactCategories: ['blur'], attempt: 2 });
    expect(first.id).toBe('refine-a1-p1-a2');
    expect(second).toBe(first);
    expect(second.duplicate).toBe(true);
    expect(queue.refinementQueue.add).toHaveBeenCalledTimes(1);
  });

  test('a finished job with the same id is replaced', async () => {
    const done = { id: 'refine-a1-p1-a2', getState: async () => 'completed', remove: jest.fn(async () => mockQueue.jobs.delete('refine-a1-p1-a2')) };
    mockQueue.jobs.set(done.id, done);
    await queue.addRefinementJob({ angleId: 'a1', sceneSetId: 's1', artifactCategories: ['blur'], attempt: 2 });
    expect(done.remove).toHaveBeenCalled();
    expect(queue.refinementQueue.add).toHaveBeenCalledTimes(1);
  });

  test('a pass for a picture regenerated since is dropped, unpaid', async () => {
    const out = await run({ attempt: 1 });
    expect(out).toMatchObject({ status: 'skipped', reason: 'picture changed' });
    expect(mockClaimRow).not.toHaveBeenCalled();
    expect(mockRegenerate).not.toHaveBeenCalled();
  });

  test('a pass claims the angle; one already being generated is dropped', async () => {
    mockClaimRow.mockResolvedValueOnce(false);
    expect(await run({ attempt: 2 })).toMatchObject({ status: 'skipped', reason: 'already generating' });
    expect(mockRegenerate).not.toHaveBeenCalled();

    mockClaimRow.mockResolvedValueOnce(true);
    mockRegenerate.mockResolvedValueOnce({ qualityScore: 90, artifactFlags: [] });
    expect(await run({ attempt: 2 })).toMatchObject({ status: 'quality_met' });
    expect(mockClaimRow).toHaveBeenLastCalledWith(mockModels.SceneAngle.sequelize, 'angle', 'a1');
  });

  test('a pass while the set\'s base is being generated is dropped, unpaid', async () => {
    mockModels.SceneSet.findByPk.mockResolvedValueOnce({ id: 's1', generation_status: 'generating', updatedAt: new Date() });
    expect(await run({ attempt: 2 })).toMatchObject({ status: 'skipped', reason: 'base generating' });
    expect(mockClaimRow).not.toHaveBeenCalled();
    expect(mockRegenerate).not.toHaveBeenCalled();
  });

  test('a pass refused before it began releases the angle', async () => {
    mockClaimRow.mockResolvedValueOnce(true);
    mockRegenerate.mockRejectedValueOnce(Object.assign(new Error('Nothing to fix'), { code: 'NO_FIXES' }));
    await expect(run({ attempt: 2 })).rejects.toThrow('Nothing to fix');
    expect(mockModels.SceneAngle.update).toHaveBeenCalledWith({ generation_status: 'failed' }, { where: { id: 'a1', generation_status: 'generating' } });
  });
});
