/**
 * Scene Sets re-audit (2026-10-15), image quality:
 *  - an Inside (WIDE) angle was made as "a different part of the place";
 *  - spec-made angles became zones named with a whole sentence;
 *  - a near-whole spec frame was "cropped" into a copy of the base;
 *  - a consistency retry that scored worse replaced the first image;
 *  - a mood-board base was still edited;
 *  - a refine for the problems the quality check flags sent the same prompt;
 *  - a new still kept the old one's quality flags;
 *  - a new base was analysed twice when angles started meanwhile.
 */
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockCreate } })));
jest.mock('sharp', () => jest.fn(() => {
  const chain = { resize: () => chain, jpeg: () => chain, png: () => chain, extract: () => chain, toBuffer: async () => Buffer.from('jpeg'), metadata: async () => ({ width: 1920, height: 1080 }) };
  return chain;
}));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: jest.fn(async () => ({})) })),
  PutObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
}));
jest.mock('axios', () => ({ get: jest.fn(async () => ({ data: Buffer.from('png') })), post: jest.fn() }));
jest.mock('../../../src/services/imageGenerationService', () => ({
  generateImageUrl: jest.fn(async (prompt, { onLogged }) => { onLogged({ costUsd: 0.03 }); return 'https://fal.example/flux.png'; }),
  generateImageFromImage: jest.fn(async (ref, prompt, { onLogged }) => { onLogged({ costUsd: 0.04 }); return { url: `https://fal.example/kontext-${Math.random()}.png` }; }),
  estimateGenerationCost: jest.fn(() => ({ usd: 0.03, priced: true, model: 'flux' })),
  estimateImageFromImageCost: jest.fn(() => ({ usd: 0.04, priced: true, model: 'kontext' })),
}));

const imageGen = require('../../../src/services/imageGenerationService');
const sceneGen = require('../../../src/services/sceneGenerationService');
const { buildSceneBrief, shotKey } = require('../../../src/services/sceneBriefService');
const { refineFixes, buildRefinedPrompt } = require('../../../src/services/artifactDetectionService');
const { contractAngleRows } = require('../../../src/routes/sceneSetRoutes');

const base = 'https://s3.example/base.png';
const db = { query: jest.fn(async () => [[]]) };
let SceneSet;
let SceneAngle;
const lastUpdate = () => SceneAngle.update.mock.calls.at(-1)[0];

beforeAll(() => { process.env.FAL_KEY = process.env.FAL_KEY || 'test-fal-key'; });
beforeEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  mockCreate.mockReset();
  imageGen.generateImageFromImage.mockClear();
  imageGen.generateImageUrl.mockClear();
  SceneSet = { sequelize: db, update: jest.fn(async () => [1]), increment: jest.fn(async () => {}) };
  SceneAngle = { sequelize: db, update: jest.fn(async () => [1]), findOne: jest.fn(async () => null) };
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('Inside is the base room', () => {
  test('an Inside WIDE angle is the base picture: no image call, no cost', async () => {
    const angle = { id: 'a1', angle_kind: 'inside', angle_label: 'WIDE', angle_name: 'Inside', quality_score: 40, quality_review: { base_consistency: { score: 10 } } };
    const result = await sceneGen.generateAngle(angle, { id: 's1', base_still_url: base }, { SceneAngle, SceneSet });
    expect(result).toMatchObject({ success: true, stillUrl: base, fromBase: true });
    expect(imageGen.generateImageFromImage).not.toHaveBeenCalled();
    expect(lastUpdate()).toMatchObject({ still_image_url: base, generation_cost: 0, quality_score: null, artifact_flags: [] });
    expect(lastUpdate().quality_review.base_consistency).toBeUndefined();
    expect(sceneGen.estimateAngleCost(angle, { base_still_url: base })).toMatchObject({ usd: 0, method: 'base' });
  });

  test('Inside with no base is refused (NO_BASE), as a zone is, before any call', async () => {
    for (const label of ['WIDE', 'BED']) {
      await expect(sceneGen.generateAngle({ id: 'a0', angle_kind: 'inside', angle_label: label }, { id: 's0', base_still_url: null }, { SceneAngle, SceneSet }))
        .rejects.toMatchObject({ status: 409, code: 'NO_BASE' });
    }
    expect(imageGen.generateImageFromImage).not.toHaveBeenCalled();
    expect(imageGen.generateImageUrl).not.toHaveBeenCalled();
    expect(sceneGen.needsBase({ angle_kind: 'inside' })).toBe(true);
    expect(sceneGen.needsBase({ angle_kind: 'extra' })).toBe(false);
  });

  test('Inside is never a zone: a BED on it is a framing of the base, with continuity', () => {
    const bed = { angle_kind: 'inside', angle_label: 'BED', angle_name: 'Bed' };
    expect(sceneGen.zoneOf(bed)).toBeNull();
    expect(sceneGen.isInsideBaseShot(bed)).toBe(false);
    expect(sceneGen.angleBriefOptions(bed, { base_still_url: base }).options).toMatchObject({ continuity: true });
    expect(sceneGen.zoneOf({ angle_kind: 'front' })).toEqual({ kind: 'front', name: null });
  });
});

describe('spec-made angles and labels', () => {
  test('a contract in the picture is a framing of the base with a short name; Front keeps its kind', () => {
    const { rows } = contractAngleRows([
      { angle: 'VANITY_CLOSE_UP', kind: 'zone', description: 'Close-up of the gilt vanity with its round mirror.', frame: { left: 0.5, top: 0.2, width: 0.4, height: 0.6 } },
      { angle: 'GARDEN', kind: 'back', description: 'The garden behind the house.', frame: null },
      { angle: 'ESTABLISHING', kind: 'front', description: 'The facade.', frame: { left: 0, top: 0, width: 1, height: 1 } },
    ], []);
    expect(rows.map((r) => [r.angle_label, r.angle_kind, r.angle_name])).toEqual([
      ['VANITY_CLOSE_UP', 'extra', 'Vanity close up'],
      ['GARDEN', 'back', 'Garden'],
      ['ESTABLISHING', 'front', 'Establishing'],
    ]);
  });

  test('a sentence as a zone\'s name never reaches its camera line', () => {
    const camera = (name) => buildSceneBrief({ sceneSet: { name: 'Loft' }, zone: { kind: 'zone', name } }).lines.find((l) => l.key === 'camera').text;
    expect(camera('Close-up of the tufted headboard with gold piping.')).toBe('Establishing view of a part of Loft.');
    expect(camera('Bed area')).toBe('Establishing view of the Bed area of Loft.');
  });

  test('ENTRANCE is the entrance, not the room seen from the doorway', () => {
    expect(shotKey('ENTRANCE')).toBe('ENTRANCE');
    const brief = buildSceneBrief({ sceneSet: { name: 'Villa', canonical_description: 'A pink bedroom.' }, angleLabel: 'ENTRANCE', zone: { kind: 'front' } });
    expect(brief.furnished).toBe(false);
  });
});

describe('crops, retries and the source picture', () => {
  const spec = (label, frame) => ({ camera_contracts: [{ angle: label, frame }], objects: [], zones: [], _meta: { base_still_url: base } });

  test('a near-whole frame is generated, except for WIDE and ESTABLISHING', () => {
    const whole = { left: 0, top: 0, width: 1, height: 1 };
    expect(sceneGen.estimateAngleCost({ angle_label: 'VANITY' }, { base_still_url: base, scene_spec: spec('VANITY', whole) })).toMatchObject({ method: 'edit' });
    expect(sceneGen.estimateAngleCost({ angle_label: 'WIDE' }, { base_still_url: base, scene_spec: spec('WIDE', whole) })).toMatchObject({ method: 'crop' });
  });

  test('a consistency retry that scores worse does not replace the first image', async () => {
    process.env.ANTHROPIC_API_KEY = 'k';
    const scores = [55, 40];
    // The consistency check compares two images; other calls (the spec
    // build) get no usable answer.
    mockCreate.mockImplementation(async ({ messages }) => {
      const images = messages[0].content.filter((c) => c.type === 'image').length;
      return { content: [{ text: images === 2 ? JSON.stringify({ score: scores.shift(), issues: [] }) : 'no' }] };
    });
    const set = { id: 's2', base_still_url: base, scene_spec: null, visual_language: { image_analysis: { source_url: base, version: 7, image_type: 'room_photo' } } };
    const result = await sceneGen.generateAngle({ id: 'a2', angle_label: 'VANITY', angle_name: 'Vanity' }, set, { SceneAngle, SceneSet });
    expect(imageGen.generateImageFromImage).toHaveBeenCalledTimes(2);
    expect(lastUpdate().quality_review.base_consistency.score).toBe(55);
    expect(result.stillUrl).toBe(lastUpdate().still_image_url);
  });

  test('a mood-board base is not edited: the angle is drawn from the prompt', async () => {
    const set = { id: 's3', base_still_url: base, scene_spec: null, visual_language: { image_analysis: { source_url: base, version: 7, image_type: 'mood_board' } } };
    process.env.ANTHROPIC_API_KEY = 'k';
    await sceneGen.generateAngle({ id: 'a3', angle_label: 'VANITY', angle_name: 'Vanity' }, set, { SceneAngle, SceneSet });
    expect(imageGen.generateImageFromImage).not.toHaveBeenCalled();
    expect(imageGen.generateImageUrl).toHaveBeenCalled();
  });
});

describe('refine', () => {
  test('the problems the quality check flags have fixes; unknown ones have none', () => {
    expect(refineFixes(['SOFT_FOCUS', { category: 'COLOR_CAST' }])).toHaveLength(2);
    expect(refineFixes(['blur', null])).toEqual([]);
    expect(buildRefinedPrompt('A loft.', ['LOW_RESOLUTION'])).toMatch(/QUALITY EMPHASIS: high resolution/);
  });

  test('a refine with nothing to fix is refused before anything is paid', async () => {
    await expect(sceneGen.regenerateAngleRefined({ id: 'a4', angle_label: 'VANITY' }, { id: 's4', base_still_url: base }, ['blur'], { SceneAngle, SceneSet }))
      .rejects.toMatchObject({ status: 400, code: 'NO_FIXES' });
    expect(imageGen.generateImageFromImage).not.toHaveBeenCalled();
    expect(SceneAngle.update).not.toHaveBeenCalled();
  });
});

describe('one analysis of a new base', () => {
  test('a second analysis started while the first runs waits for it', async () => {
    process.env.ANTHROPIC_API_KEY = 'k';
    let finish;
    mockCreate.mockImplementation(() => new Promise((resolve) => { finish = () => resolve({ content: [{ text: JSON.stringify({ image_type: 'room_photo', anchor_objects: [] }) }] }); }));
    const stored = { query: jest.fn(async () => [[{ canonical_description: 'A loft.', visual_language: {} }]]) };
    const Model = { sequelize: stored, update: jest.fn(async () => [1]) };
    const first = sceneGen.analyzeBaseImage({ id: 's5', name: 'Loft', base_still_url: base, visual_language: {} }, Model);
    const copy = { id: 's5', name: 'Loft', base_still_url: base, visual_language: {} };
    const second = sceneGen.analyzeBaseImage(copy, Model);
    await new Promise((r) => setImmediate(r));
    finish();
    const [a, b] = await Promise.all([first, second]);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(b).toBe(a);
    expect(copy.visual_language.image_analysis).toBe(a);
  });
});
