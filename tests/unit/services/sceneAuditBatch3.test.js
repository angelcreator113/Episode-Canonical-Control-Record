/**
 * Scene Sets audit (2026-10-15), third batch:
 *  - an angle's brief showed no cost (estimateAngleCost);
 *  - a hand-edited spec lost its base picture and version, so the next
 *    angle rebuilt it over the edit (bindEditedSpec);
 *  - Generate All analysed the base once per angle: the analysis was saved
 *    but the batch's copy of the set never had it.
 */
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockCreate } })));
jest.mock('../../../src/services/imageGenerationService', () => ({
  estimateGenerationCost: jest.fn(() => ({ usd: 0.025, priced: true, model: 'fal-ai/flux/dev' })),
  estimateImageFromImageCost: jest.fn(() => ({ usd: 0.04, priced: true, model: 'fal-ai/flux-pro/kontext' })),
}));

const sceneGen = require('../../../src/services/sceneGenerationService');
const { bindEditedSpec, SPEC_VERSION } = require('../../../src/services/sceneSpecService');

const base = 'https://s3.example/base.png';
const spec = (frame) => ({ camera_contracts: [{ angle: 'VANITY', frame }], objects: [], zones: [], _meta: { base_still_url: base } });

describe('estimateAngleCost', () => {
  const key = process.env.ANTHROPIC_API_KEY;
  afterEach(() => { if (key === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = key; });

  test('no base: a Flux text-to-image', () => {
    expect(sceneGen.estimateAngleCost({ angle_label: 'VANITY' }, { base_still_url: null })).toMatchObject({ usd: 0.025, method: 'text_to_image' });
  });

  test('a frame of the base big enough to crop: free', () => {
    const set = { base_still_url: base, scene_spec: spec({ left: 0.4, top: 0, width: 0.6, height: 0.9 }) };
    expect(sceneGen.estimateAngleCost({ angle_label: 'VANITY' }, set)).toMatchObject({ usd: 0, method: 'crop' });
  });

  test('an edit of the base: one Kontext image, up to one retry when the check can run', () => {
    delete process.env.ANTHROPIC_API_KEY;
    const set = { base_still_url: base, scene_spec: spec({ left: 0.7, top: 0, width: 0.3, height: 0.9 }) };
    expect(sceneGen.estimateAngleCost({ angle_label: 'VANITY' }, set)).toEqual(expect.not.objectContaining({ max_usd: expect.anything() }));
    process.env.ANTHROPIC_API_KEY = 'k';
    expect(sceneGen.estimateAngleCost({ angle_label: 'VANITY' }, set)).toMatchObject({ usd: 0.04, max_usd: 0.08, method: 'edit' });
    // A framing on a zone is never a crop of the base.
    const cropSet = { base_still_url: base, scene_spec: spec({ left: 0.4, top: 0, width: 0.6, height: 0.9 }) };
    expect(sceneGen.estimateAngleCost({ angle_label: 'VANITY', angle_kind: 'extra', zone_angle_id: 'z1' }, cropSet)).toMatchObject({ method: 'edit' });
  });
});

describe('bindEditedSpec', () => {
  test('an edit keeps the version and base picture of the spec it replaced', () => {
    const existing = { version: SPEC_VERSION, _meta: { base_still_url: base, generated_at: 't0', source: 'base_image_analysis' } };
    const saved = bindEditedSpec({ camera_contracts: [{ angle: 'WIDE' }], objects: [], zones: [] }, existing, 'https://s3.example/other.png');
    expect(saved.version).toBe(SPEC_VERSION);
    expect(saved._meta).toMatchObject({ base_still_url: base, generated_at: 't0', source: 'user_edit' });
    expect(sceneGen.specFitsBase(saved, base)).toBe(true);
  });

  test('a first spec written by hand belongs to the set\'s current base', () => {
    const saved = bindEditedSpec({ camera_contracts: [{ angle: 'WIDE' }], objects: [], zones: [] }, null, base);
    expect(saved._meta.base_still_url).toBe(base);
    expect(saved.version).toBe(SPEC_VERSION);
  });
});

describe('analyzeBaseImage keeps the caller\'s copy current', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'k';
    mockCreate.mockReset().mockResolvedValue({ content: [{ text: JSON.stringify({ image_type: 'room_photo', anchor_objects: [] }) }] });
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test('a second angle of the same batch uses the analysis, not a second call', async () => {
    // The stored row, as the analysis reads it back (the description review).
    const db = { query: jest.fn(async () => [[{ canonical_description: 'A loft.', visual_language: {} }]]) };
    const SceneSetModel = { sequelize: db, update: jest.fn(async () => [1]) };
    const set = { id: 'set-1', name: 'Loft', base_still_url: base, visual_language: {}, canonical_description: 'A loft.' };
    const first = await sceneGen.analyzeBaseImage(set, SceneSetModel);
    expect(first.source_url).toBe(base);
    expect(set.visual_language.image_analysis.source_url).toBe(base);
    await sceneGen.analyzeBaseImage(set, SceneSetModel);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
