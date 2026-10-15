/**
 * Zones and their framings (L14), audit of 2026-10-15:
 *  - a Front or Back zone's brief carried the set's description (the room
 *    inside) with "every piece of furniture described is present";
 *  - an extra framing on a zone (zone_angle_id) was made from the base,
 *    with the base's spec and anchors, not from its zone.
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

const { buildSceneBrief, briefToPrompt, FURNISHED } = require('../../../src/services/sceneBriefService');
const imageGen = require('../../../src/services/imageGenerationService');
const sceneGen = require('../../../src/services/sceneGenerationService');

const SET = {
  id: 'set-1', name: "Lala's Loft", canonical_description: 'A pink bedroom with a canopy bed and a gilt vanity.',
  visual_language: { room_properties: { room_size: 'large' } },
};
const LOCATION = { id: 'loc-1', name: "Lala's Loft", effective_style_guide: { equipment: ['ring light'] } };
const line = (brief, key) => brief.lines.find((l) => l.key === key);

describe('the brief of a view without the described room', () => {
  test('a Front zone: the description for style only, no furniture demanded, no layout or equipment', () => {
    const brief = buildSceneBrief({ sceneSet: SET, location: LOCATION, zone: { kind: 'front', name: 'Front' } });
    expect(line(brief, 'description').text).toMatch(/^For its style only: A pink bedroom.*none of that room's furniture is in it\.$/);
    expect(line(brief, 'layout')).toBeUndefined();
    expect(line(brief, 'equipment')).toBeUndefined();
    expect(brief.furnished).toBe(false);
    expect(briefToPrompt(brief)).not.toContain(FURNISHED);
  });

  test('the Inside zone and the base are the described room', () => {
    for (const opts of [{ zone: { kind: 'inside' } }, {}]) {
      const brief = buildSceneBrief({ sceneSet: SET, location: LOCATION, ...opts });
      expect(line(brief, 'description').text).toBe('A pink bedroom with a canopy bed and a gilt vanity.');
      expect(line(brief, 'equipment')).toBeTruthy();
      expect(briefToPrompt(brief)).toContain(FURNISHED);
    }
  });

  test('a DOORWAY on the Front zone looks in: the room is in it', () => {
    const brief = buildSceneBrief({ sceneSet: SET, location: LOCATION, angleLabel: 'DOORWAY', zone: { kind: 'front' } });
    expect(brief.furnished).toBeUndefined();
  });

  test('a framing on the Back zone shows none of the room either', () => {
    const brief = buildSceneBrief({ sceneSet: SET, location: LOCATION, angleLabel: 'CLOSE', continuity: true, partOf: { kind: 'back', name: 'Garden' } });
    expect(brief.furnished).toBe(false);
    expect(line(brief, 'continuity')).toBeTruthy();
  });
});

describe('an extra framing on a zone', () => {
  const db = { query: jest.fn(async () => [[]]) };
  const base = 'https://s3.example/base.png';
  const zone = { id: 'z1', scene_set_id: 'set-1', angle_kind: 'front', angle_name: 'Front', still_image_url: 'https://s3.example/front.png' };
  let SceneSet;
  let SceneAngle;

  beforeAll(() => { process.env.FAL_KEY = process.env.FAL_KEY || 'test-fal-key'; });
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    SceneSet = { sequelize: db, update: jest.fn(async () => [1]), increment: jest.fn(async () => {}) };
    SceneAngle = { sequelize: db, update: jest.fn(async () => [1]), findOne: jest.fn(async () => zone) };
    imageGen.generateImageFromImage.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  const extra = { id: 'x1', scene_set_id: 'set-1', angle_kind: 'extra', zone_angle_id: 'z1', angle_label: 'CLOSE', angle_name: 'Door knocker' };
  const set = {
    ...SET, base_still_url: base,
    // A spec of the base: its frame and checks are not the zone's.
    scene_spec: { camera_contracts: [{ angle: 'CLOSE', frame: { left: 0, top: 0, width: 0.8, height: 0.8 }, required: ['bed'] }], objects: [{ id: 'bed', label: 'Bed' }], _meta: { base_still_url: base } },
  };

  test('is made from the zone\'s picture, without the base\'s spec or crop', async () => {
    const result = await sceneGen.generateAngle(extra, set, { SceneAngle, SceneSet });
    expect(result.success).toBe(true);
    expect(SceneAngle.findOne).toHaveBeenCalledWith({ where: { id: 'z1', scene_set_id: 'set-1' } });
    expect(imageGen.generateImageFromImage).toHaveBeenCalledWith(zone.still_image_url, expect.any(String), expect.any(Object));
    const prompt = imageGen.generateImageFromImage.mock.calls[0][1];
    expect(prompt).not.toContain(FURNISHED);
    expect(prompt).not.toMatch(/must appear|Bed/);
    expect(result.specValidation).toBeNull();
  });

  test('a zone with no picture yet: refused before anything is paid for', async () => {
    SceneAngle.findOne.mockResolvedValue({ ...zone, still_image_url: null });
    await expect(sceneGen.generateAngle(extra, set, { SceneAngle, SceneSet })).rejects.toMatchObject({ status: 409, code: 'NO_ZONE_IMAGE' });
    expect(imageGen.generateImageFromImage).not.toHaveBeenCalled();
  });

  test('an extra on no zone, and an angle that is not an extra, keep the base', async () => {
    expect(await sceneGen.extraZoneAngle({ ...extra, zone_angle_id: null }, SceneAngle)).toBeNull();
    expect(await sceneGen.extraZoneAngle({ ...extra, angle_kind: 'inside' }, SceneAngle)).toBeNull();
    SceneAngle.findOne.mockResolvedValue({ ...zone, angle_kind: 'extra' });
    expect(await sceneGen.extraZoneAngle(extra, SceneAngle)).toBeNull();
  });
});
