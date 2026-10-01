/**
 * generateAngle's SceneSpec validation after the still is made.
 *
 * The S2 refactor (#2421) moved `const spec = sceneSet.scene_spec` into
 * angleBriefOptions but left generateAngle's post-generation validation
 * reading `spec`, which generateAngle no longer declared. Every angle
 * generation then threw a ReferenceError after its image was made and
 * billed, and the angle was marked failed. These tests drive one angle
 * through the prompt-only still path (no base image) with the image call,
 * the download and the S3 write faked.
 */
jest.mock('sharp', () => jest.fn(() => {
  const chain = { resize: () => chain, jpeg: () => chain, toBuffer: async () => Buffer.from('jpeg') };
  return chain;
}));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: jest.fn(async () => ({})) })),
  PutObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
}));
jest.mock('axios', () => ({ get: jest.fn(async () => ({ data: Buffer.from('png') })), post: jest.fn() }));
jest.mock('../../../src/services/imageGenerationService', () => ({
  generateImageUrl: jest.fn(async (prompt, { onLogged }) => {
    onLogged({ costUsd: 0.03 });
    return 'https://fal.example/still.png';
  }),
  generateImageFromImage: jest.fn(),
}));
jest.mock('../../../src/services/sceneBriefService', () => ({
  ...jest.requireActual('../../../src/services/sceneBriefService'),
  prepareSceneBrief: jest.fn(async () => ({ lines: [] })),
  briefToPrompt: jest.fn(() => 'A quiet boutique, wide shot'),
}));
jest.mock('../../../src/services/sceneSpecService', () => ({
  buildAngleConstraints: jest.fn(() => 'The counter must appear.'),
  validateAngleAgainstSpec: jest.fn(async () => ({ score: 90, pass: true, missing_required: [], issues: [] })),
  buildSceneSpec: jest.fn(),
}));

const sceneSpecService = require('../../../src/services/sceneSpecService');
const sceneGen = require('../../../src/services/sceneGenerationService');

describe('generateAngle completes and validates against the SceneSpec', () => {
  const db = { query: jest.fn(async () => [[]]) };
  let SceneSet;
  let SceneAngle;
  const angle = { id: 'angle-1', angle_label: 'WIDE', angle_name: 'Wide' };

  beforeAll(() => { process.env.FAL_KEY = process.env.FAL_KEY || 'test-fal-key'; });
  beforeEach(() => {
    SceneSet = { sequelize: db, update: jest.fn(async () => [1]), increment: jest.fn(async () => {}) };
    SceneAngle = { sequelize: db, update: jest.fn(async () => [1]) };
    sceneSpecService.validateAngleAgainstSpec.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  const lastStatus = () => SceneAngle.update.mock.calls.at(-1)[0].generation_status;

  test('a set with no SceneSpec: the angle is stored as complete', async () => {
    const set = { id: 'set-1', show_id: 'show-1', base_still_url: null, scene_spec: null };

    const result = await sceneGen.generateAngle(angle, set, { SceneAngle, SceneSet });

    expect(result).toEqual(expect.objectContaining({ success: true, specValidation: null }));
    expect(result.stillUrl).toMatch(/scene-sets\/set-1\/stills\//);
    expect(lastStatus()).toBe('complete');
    expect(SceneSet.increment).toHaveBeenCalledWith('generation_cost', { by: 0.03, where: { id: 'set-1' } });
    expect(sceneSpecService.validateAngleAgainstSpec).not.toHaveBeenCalled();
  });

  test('a set with a SceneSpec: the still is validated against it and the result kept', async () => {
    const spec = { camera_contracts: { WIDE: {} }, objects: [{ name: 'counter' }] };
    const set = { id: 'set-2', show_id: 'show-1', base_still_url: null, scene_spec: spec };

    const result = await sceneGen.generateAngle(angle, set, { SceneAngle, SceneSet });

    expect(sceneSpecService.validateAngleAgainstSpec).toHaveBeenCalledWith(result.stillUrl, spec, 'WIDE');
    expect(lastStatus()).toBe('complete');
    expect(SceneAngle.update.mock.calls.at(-1)[0].quality_review.spec_validation).toEqual(expect.objectContaining({ score: 90, pass: true }));
  });
});
