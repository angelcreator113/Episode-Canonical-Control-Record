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
  generateImageFromImage: jest.fn(async (ref, prompt, { onLogged }) => {
    onLogged({ costUsd: 0.04 });
    return { url: 'https://fal.example/kontext.png' };
  }),
}));
jest.mock('../../../src/services/sceneBriefService', () => ({
  ...jest.requireActual('../../../src/services/sceneBriefService'),
  prepareSceneBrief: jest.fn(async () => ({ lines: [] })),
  briefToPrompt: jest.fn(() => 'A quiet boutique, wide shot'),
}));
jest.mock('../../../src/services/sceneSpecService', () => ({
  // The frame lookup is pure: the real one (2026-10-07, crops only by a spec frame).
  contractFrame: jest.requireActual('../../../src/services/sceneSpecService').contractFrame,
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

// A SceneSpec is built from one base picture (_meta.base_still_url). After a
// new base, its frames and objects are the old picture's: the angle must not
// be cropped at the old coordinates or checked against the old room.
describe('a SceneSpec built from another base picture', () => {
  const db = { query: jest.fn(async () => [[]]) };
  let SceneSet;
  let SceneAngle;
  const angle = { id: 'angle-3', angle_label: 'VANITY', angle_name: 'Vanity' };
  const specFor = (url) => ({
    camera_contracts: [{ angle: 'VANITY', frame: { left: 0.5, top: 0.2, width: 0.4, height: 0.6 } }],
    objects: [{ name: 'old mirror' }],
    _meta: { base_still_url: url },
  });

  beforeAll(() => { process.env.FAL_KEY = process.env.FAL_KEY || 'test-fal-key'; });
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    SceneSet = { sequelize: db, update: jest.fn(async () => [1]), increment: jest.fn(async () => {}) };
    SceneAngle = { sequelize: db, update: jest.fn(async () => [1]) };
    sceneSpecService.validateAngleAgainstSpec.mockClear();
    sceneSpecService.buildAngleConstraints.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test('is not used: no crop at its frame, no constraints or validation from it', async () => {
    const set = { id: 'set-3', show_id: 'show-1', base_still_url: 'https://s3.example/new-base.png', scene_spec: specFor('https://s3.example/old-base.png') };

    const result = await sceneGen.generateAngle(angle, set, { SceneAngle, SceneSet });

    expect(result.success).toBe(true);
    expect(set.scene_spec).toBeNull();
    expect(sceneSpecService.buildAngleConstraints).not.toHaveBeenCalled();
    expect(sceneSpecService.validateAngleAgainstSpec).not.toHaveBeenCalled();
    expect(require('../../../src/services/imageGenerationService').generateImageFromImage)
      .toHaveBeenCalledWith('https://s3.example/new-base.png', expect.any(String), expect.any(Object));
  });

  test('one built from this base is kept', () => {
    const base = 'https://s3.example/base.png';
    expect(sceneGen.specFitsBase(specFor(base), base)).toBe(true);
    expect(sceneGen.specFitsBase(specFor('https://s3.example/old.png'), base)).toBe(false);
    expect(sceneGen.specFitsBase({ camera_contracts: [] }, base)).toBe(false);
    expect(sceneGen.specFitsBase(null, base)).toBe(false);
  });

  test('anchor objects come from this base\'s analysis, not one it replaced', () => {
    const base = 'https://s3.example/new-base.png';
    const vl = { anchor_objects: [{ name: 'old bed', position: 'left', description: 'canopy' }], image_analysis: { source_url: 'https://s3.example/old-base.png' } };
    const stale = sceneGen.angleBriefOptions({ angle_label: 'WIDE' }, { base_still_url: base, visual_language: vl });
    expect(stale.relevantAnchors).toEqual([]);

    const fresh = sceneGen.angleBriefOptions({ angle_label: 'WIDE' }, { base_still_url: base, visual_language: vl }, {
      imageAnalysis: { source_url: base, anchor_objects: [{ name: 'new sofa', position: 'centre', description: 'velvet' }] },
    });
    expect(fresh.relevantAnchors).toEqual(['new sofa (centre): velvet']);

    const current = sceneGen.angleBriefOptions({ angle_label: 'WIDE' }, { base_still_url: base, visual_language: { ...vl, image_analysis: { source_url: base } } });
    expect(current.relevantAnchors).toEqual(['old bed (left): canopy']);
  });

  test('an anchor that names no angle binds the wide views only; a named one binds its angle', () => {
    const base = 'https://s3.example/base.png';
    const vl = {
      image_analysis: { source_url: base },
      anchor_objects: [
        { name: 'bed', position: 'left', description: 'canopy' },
        { name: 'mirror', position: 'right', description: 'gilt', must_appear_in: ['VANITY'] },
      ],
    };
    const anchors = (label) => sceneGen.angleBriefOptions({ angle_label: label }, { base_still_url: base, visual_language: vl }).relevantAnchors;
    expect(anchors('WIDE')).toEqual(['bed (left): canopy']);
    expect(anchors('VANITY')).toEqual(['mirror (right): gilt']);
    expect(anchors('CLOSE')).toEqual([]);
  });

  test('a spec frame under half the picture\'s width is generated from the base, not stretched', async () => {
    const base = 'https://s3.example/base.png';
    const set = {
      id: 'set-4', show_id: 'show-1', base_still_url: base,
      scene_spec: { camera_contracts: [{ angle: 'VANITY', frame: { left: 0.6, top: 0.2, width: 0.3, height: 0.5 } }], objects: [], _meta: { base_still_url: base } },
    };
    const imageGen = require('../../../src/services/imageGenerationService');
    imageGen.generateImageFromImage.mockClear();
    const axios = require('axios');
    axios.get.mockClear();

    const result = await sceneGen.generateAngle(angle, set, { SceneAngle, SceneSet });

    expect(result.success).toBe(true);
    expect(imageGen.generateImageFromImage).toHaveBeenCalledWith(base, expect.any(String), expect.not.objectContaining({ guidanceScale: expect.anything() }));
    // No download of the base for a crop: only the generated still is fetched.
    expect(axios.get.mock.calls.map((c) => c[0])).not.toContain(base);
    // The consistency check could not run (no key): recorded as unchecked,
    // and no retry is spent on it.
    expect(imageGen.generateImageFromImage).toHaveBeenCalledTimes(1);
    expect(SceneAngle.update.mock.calls.at(-1)[0].quality_review.base_consistency)
      .toMatchObject({ checked: false, score: null, pass: null });
  });
});
