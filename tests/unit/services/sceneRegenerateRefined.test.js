/**
 * Regenerate (refined): the artifact-review regenerate makes the angle as
 * Generate does, with the fixes for the flagged problems added to the
 * prompt. Before (audit, 2026-10-15) it cut the prompt at 1000 characters
 * (dropping the "no people" rules at its end), ignored zones, the camera
 * direction and the required features, and always started a Runway video
 * whose credits were added to the dollar cost.
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
  generateImageUrl: jest.fn(),
  generateImageFromImage: jest.fn(async (ref, prompt, { onLogged }) => {
    onLogged({ costUsd: 0.04 });
    return { url: 'https://fal.example/kontext.png' };
  }),
}));
const mockLong = `${'A sunlit boutique with a marble counter. '.repeat(40)}No people, no figures.`;
jest.mock('../../../src/services/sceneBriefService', () => ({
  ...jest.requireActual('../../../src/services/sceneBriefService'),
  prepareSceneBrief: jest.fn(async () => ({ lines: [] })),
  briefToPrompt: jest.fn(() => mockLong),
}));
jest.mock('../../../src/services/artifactDetectionService', () => ({
  ...jest.requireActual('../../../src/services/artifactDetectionService'),
  analyzeImageQuality: jest.fn(async () => ({ qualityScore: 88, flags: [] })),
}));

const imageGen = require('../../../src/services/imageGenerationService');
const sceneBrief = require('../../../src/services/sceneBriefService');
const sceneGen = require('../../../src/services/sceneGenerationService');

describe('regenerateAngleRefined', () => {
  const db = { query: jest.fn(async () => [[]]) };
  const base = 'https://s3.example/base.png';
  let SceneSet;
  let SceneAngle;

  beforeAll(() => { process.env.FAL_KEY = process.env.FAL_KEY || 'test-fal-key'; });
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    SceneSet = { sequelize: db, update: jest.fn(async () => [1]), increment: jest.fn(async () => {}) };
    SceneAngle = { sequelize: db, update: jest.fn(async () => [1]) };
    imageGen.generateImageFromImage.mockClear();
    sceneBrief.prepareSceneBrief.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test('the whole prompt is sent with the fixes; the camera direction is kept; no video; the cost is the image\'s', async () => {
    const angle = { id: 'a1', angle_label: 'WINDOW', angle_name: 'Window', camera_direction: 'Low angle toward the arched window' };
    // A spec frame for the shot: Generate would crop it; a refine asks for a new picture.
    const set = {
      id: 's1', show_id: 'show-1', base_still_url: base,
      scene_spec: { camera_contracts: [{ angle: 'WINDOW', frame: { left: 0, top: 0, width: 0.8, height: 0.8 } }], objects: [], _meta: { base_still_url: base } },
    };

    const result = await sceneGen.regenerateAngleRefined(angle, set, ['FURNITURE_DISTORTION'], { SceneAngle, SceneSet });

    const prompt = imageGen.generateImageFromImage.mock.calls[0][1];
    expect(prompt.startsWith(mockLong)).toBe(true);
    expect(prompt).toMatch(/QUALITY EMPHASIS:/);
    expect(sceneBrief.prepareSceneBrief.mock.calls[0][2]).toMatchObject({ cameraDirection: 'Low angle toward the arched window' });
    expect(result).toMatchObject({ success: true, videoUrl: null, qualityScore: 88 });
    const updates = SceneAngle.update.mock.calls.map((c) => c[0]);
    expect(updates[0]).toMatchObject({ generation_status: 'generating', refined_prompt: prompt });
    expect(updates.find((u) => u.generation_status === 'complete')).toMatchObject({ generation_cost: 0.04, video_clip_url: null });
    expect(updates.at(-1)).toMatchObject({ quality_score: 88, artifact_flags: [] });
    expect(SceneSet.increment).toHaveBeenCalledWith('generation_cost', { by: 0.04, where: { id: 's1' } });
  });

  test('a zone is refined as a zone: from the base, without the base view\'s continuity', async () => {
    const angle = { id: 'a2', angle_label: 'WIDE', angle_name: 'Back garden', angle_kind: 'back' };
    const set = { id: 's2', show_id: 'show-1', base_still_url: base, scene_spec: null };

    await sceneGen.regenerateAngleRefined(angle, set, [{ category: 'FLOOR_DISTORTION' }], { SceneAngle, SceneSet });

    expect(sceneBrief.prepareSceneBrief.mock.calls[0][2]).toMatchObject({ zone: { kind: 'back' }, continuity: false });
    expect(imageGen.generateImageFromImage).toHaveBeenCalledWith(base, expect.stringMatching(/QUALITY EMPHASIS:/), expect.any(Object));
  });

  test('the refine brief is the angle\'s own', () => {
    const angle = { angle_label: 'WINDOW', camera_direction: 'Low angle' };
    const set = { base_still_url: base };
    expect(sceneGen.refinedBriefOptions(angle, set)).toEqual(sceneGen.angleBriefOptions(angle, set).options);
  });
});
