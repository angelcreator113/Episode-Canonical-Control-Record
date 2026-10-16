/**
 * Scene Sets audit #3 (2026-10-15): an angle video bypassed the image
 * budget gate and added Runway credits (not dollars) to generation_cost.
 */
const mockRun = jest.fn();
jest.mock('../../../src/services/imageCostService', () => ({
  ...jest.requireActual('../../../src/services/imageCostService'),
  runImageCall: (...a) => mockRun(...a),
}));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: jest.fn(async () => ({})) })),
  PutObjectCommand: jest.fn((input) => ({ input })),
  DeleteObjectCommand: jest.fn(),
}));
jest.mock('axios', () => ({ get: jest.fn(async () => ({ data: Buffer.from('mp4'), headers: { 'content-type': 'video/mp4' } })), post: jest.fn() }));

const axios = require('axios');
const sceneGen = require('../../../src/services/sceneGenerationService');

describe('an angle video', () => {
  const models = () => ({ SceneAngle: { update: jest.fn(async () => [1]) }, SceneSet: { increment: jest.fn() } });
  const angle = { id: 'a1', angle_name: 'Wide', angle_label: 'WIDE', still_image_url: 'https://bucket.example/a1.jpg', generation_cost: 0.04 };
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test('runs through the image budget gate, unpriced: no credits added as dollars', async () => {
    mockRun.mockImplementationOnce(async (plan) => {
      plan.onLogged({ usageLogId: 7, costUsd: null });
      return { status: 'SUCCEEDED', outputUrl: 'https://runway.example/v.mp4', creditsUsed: 50 };
    });
    const m = models();
    const out = await sceneGen.generateAngleVideo(angle, { id: 's1', name: 'Loft' }, m);
    expect(mockRun.mock.calls[0][0]).toMatchObject({ model: 'gen3a_turbo', provider: 'runway' });
    expect(out.videoUrl).toMatch(/scene-sets\/s1\/angles\/a1\/video-\d+\.mp4$/);
    expect(m.SceneAngle.update.mock.calls[0][0]).toMatchObject({ generation_cost: 0.04 });
    expect(m.SceneSet.increment).not.toHaveBeenCalled();
  });

  test('a budget refusal starts no Runway job', async () => {
    mockRun.mockRejectedValueOnce(Object.assign(new Error('Daily image budget reached'), { code: 'AI_BUDGET_EXCEEDED' }));
    await expect(sceneGen.generateAngleVideo(angle, { id: 's1' }, models())).rejects.toThrow('budget');
    expect(axios.post).not.toHaveBeenCalled();
  });
});
