/**
 * Scene Sets audit #3 (2026-10-15), money:
 *   - the cascade generated every angle without claiming it, so an angle
 *     already running (its own Generate, Generate All) was paid for twice;
 *   - a video job that failed for good marked the angle's still failed, so
 *     Generate All paid for the still again.
 */
const mockClaimRow = jest.fn();
jest.mock('../../../src/services/generationClaimService', () => ({ claimRow: (...a) => mockClaimRow(...a) }));
const mockGen = { generateBaseScene: jest.fn(), generateAngle: jest.fn(), generateAngleVideo: jest.fn() };
jest.mock('../../../src/services/sceneGenerationService', () => mockGen);
const mockModels = {
  GenerationJob: {},
  SceneSet: { findByPk: jest.fn(), update: jest.fn(async () => [1]) },
  SceneAngle: { findByPk: jest.fn(async (id) => ({ id })), update: jest.fn(async () => [1]) },
  sequelize: { query: jest.fn() },
};
jest.mock('../../../src/models', () => mockModels);

const { processJob } = require('../../../src/workers/sceneGenerationWorker');

const job = (fields) => ({ id: 'j1', attempts: 1, max_attempts: 1, update: jest.fn(async () => {}), ...fields });

describe('sceneGenerationWorker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test('a cascade claims each angle and leaves one already running to its own run', async () => {
    mockModels.SceneSet.findByPk.mockResolvedValue({ id: 's1', angles: [{ id: 'a1', angle_label: 'WIDE' }, { id: 'a2', angle_label: 'VANITY' }] });
    mockGen.generateBaseScene.mockResolvedValue({ success: true });
    mockClaimRow.mockImplementation(async (_db, kind, id) => id === 'a1');
    mockGen.generateAngle.mockResolvedValue({ success: true });
    const j = job({ job_type: 'cascade_regenerate', scene_set_id: 's1' });
    await processJob(j);
    expect(mockClaimRow).toHaveBeenCalledWith(mockModels.sequelize, 'angle', 'a2');
    expect(mockGen.generateAngle).toHaveBeenCalledTimes(1);
    expect(mockGen.generateAngle.mock.calls[0][0]).toEqual({ id: 'a1' });
    const { result } = j.update.mock.calls.at(-1)[0];
    expect(result.angles).toEqual([
      { id: 'a1', label: 'WIDE', success: true },
      { id: 'a2', label: 'VANITY', success: false, skipped: true, error: 'Already being generated' },
    ]);
  });

  test('a cascade angle refused before it began is released, not left generating', async () => {
    mockModels.SceneSet.findByPk.mockResolvedValue({ id: 's1', angles: [{ id: 'a1', angle_label: 'FRONT' }] });
    mockGen.generateBaseScene.mockResolvedValue({ success: true });
    mockClaimRow.mockResolvedValue(true);
    mockGen.generateAngle.mockRejectedValue(new Error('NO_BASE'));
    await processJob(job({ job_type: 'cascade_regenerate', scene_set_id: 's1' }));
    expect(mockModels.SceneAngle.update).toHaveBeenCalledWith({ generation_status: 'failed' }, { where: { id: 'a1', generation_status: 'generating' } });
  });

  test('a video that failed for good leaves the still complete; a still that failed is marked failed', async () => {
    mockModels.SceneSet.findByPk.mockResolvedValue({ id: 's1' });
    mockGen.generateAngleVideo.mockRejectedValue(new Error('Angle video failed: TIMEOUT'));
    await processJob(job({ job_type: 'generate_angle_video', scene_set_id: 's1', scene_angle_id: 'a1' }));
    expect(mockModels.SceneAngle.update).not.toHaveBeenCalled();

    mockGen.generateAngle.mockRejectedValue(new Error('provider error'));
    await processJob(job({ job_type: 'generate_angle', scene_set_id: 's1', scene_angle_id: 'a1' }));
    expect(mockModels.SceneAngle.update).toHaveBeenCalledWith({ generation_status: 'failed' }, { where: { id: 'a1' } });
  });
});
