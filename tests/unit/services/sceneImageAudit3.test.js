/**
 * Scene Sets audit #3 (2026-10-15), image findings:
 *   1. An angle inherited the base brief's Camera override, so every angle
 *      was the base's shot.
 *   2. A close or one-wall angle was told the whole room was "present and
 *      in place", which pulled it back to a wide shot.
 *   4. A regenerated angle kept its old post-processed copies, which
 *      Scene Studio and the lookbook prefer.
 *   5. A pure crop was stored at its own shape, not 16:9.
 *   6. A Front zone the base frames whole was redrawn as another facade.
 *   8. An extra on a zone could be generated before its zone.
 */
const sceneGen = require('../../../src/services/sceneGenerationService');
const { buildSceneBrief, briefToPrompt, FURNISHED, PART_FURNISHED } = require('../../../src/services/sceneBriefService');

const BASE = 'https://bucket.example/base.jpg';

describe('an angle\'s brief', () => {
  const set = (overrides) => ({
    id: 'set-1', name: 'Loft', base_still_url: BASE, visual_language: {},
    base_generation: { brief: { overrides } },
  });

  test('inherits the base brief\'s place and environment overrides, not its shot', () => {
    const { options } = sceneGen.angleBriefOptions({ angle_label: 'VANITY' }, set({
      camera: 'Wide from the doorway', required_features: 'the bed', continuity: 'x', overlay_space: 'y',
      description: 'A white loft.', weather: 'Rain',
    }));
    expect(options.overrides).toEqual({ description: 'A white loft.', weather: 'Rain' });
  });

  test('overrides given for the angle are used as given', () => {
    const { options } = sceneGen.angleBriefOptions({ angle_label: 'VANITY' }, set({ camera: 'Wide' }), { overrides: { camera: 'Low' } });
    expect(options.overrides).toEqual({ camera: 'Low' });
  });

  test('a close or one-wall shot is not told the whole room is in frame; a wide one is', () => {
    const sceneSet = { name: 'Loft', canonical_description: 'A loft with a bed, a desk and a vanity.' };
    const vanity = buildSceneBrief({ sceneSet, angleLabel: 'VANITY', continuity: true });
    expect(vanity.furnished).toBe('part');
    const prompt = briefToPrompt(vanity);
    expect(prompt).toContain(PART_FURNISHED);
    expect(prompt).not.toContain(FURNISHED);
    expect(vanity.lines.find((l) => l.key === 'description').text).toMatch(/^The room, of which this shot shows only part: A loft/);

    for (const label of ['WIDE', 'DOORWAY', 'OVERHEAD']) {
      const wide = buildSceneBrief({ sceneSet, angleLabel: label, continuity: true });
      expect([label, wide.furnished]).toEqual([label, undefined]);
      expect(briefToPrompt(wide)).toContain(FURNISHED);
    }
    // A Front zone's establishing view keeps its own rule (none of the room).
    expect(buildSceneBrief({ sceneSet, angleLabel: 'WIDE', zone: { kind: 'front' } }).furnished).toBe(false);
  });
});

describe('a still made from a frame of the base', () => {
  test('is grown to 16:9 around its centre, inside the picture', () => {
    // A frame on a 1920x1080 picture: widened around its centre.
    expect(sceneGen.widenToStillShape(800, 300, 480, 540, 1920, 1080)).toEqual({ left: 560, top: 300, width: 960, height: 540 });
    // Clamped to the picture: a frame at the right edge moves left.
    expect(sceneGen.widenToStillShape(1600, 300, 320, 540, 1920, 1080)).toEqual({ left: 960, top: 300, width: 960, height: 540 });
    const r = sceneGen.widenToStillShape(1500, 100, 400, 600, 1920, 1080);
    expect(r.width / r.height).toBeCloseTo(16 / 9, 2);
    expect(r.left + r.width).toBeLessThanOrEqual(1920);
    expect(r.top + r.height).toBeLessThanOrEqual(1080);
    // A wide strip is made taller, not cut.
    const strip = sceneGen.widenToStillShape(0, 400, 1600, 300, 1920, 1080);
    expect(strip).toEqual({ left: 0, top: 100, width: 1600, height: 900 });
  });
});

describe('a frame that, grown to 16:9, is the whole base', () => {
  const spec = (frame) => ({ _meta: { base_still_url: BASE }, camera_contracts: [{ angle: 'VANITY', frame }], objects: [] });
  test('is generated, not cropped: a tall frame over the limit is not a part of the picture', () => {
    const set = (frame) => ({ base_still_url: BASE, scene_spec: spec(frame) });
    expect(sceneGen.estimateAngleCost({ angle_label: 'VANITY' }, set({ left: 0.25, top: 0, width: 0.5, height: 1 })).method).toBe('edit');
    expect(sceneGen.estimateAngleCost({ angle_label: 'VANITY' }, set({ left: 0.2, top: 0.2, width: 0.6, height: 0.6 })).method).toBe('crop');
  });
});

describe('Front zone the base frames whole', () => {
  const spec = (frame) => ({ _meta: { base_still_url: BASE }, camera_contracts: [{ angle: 'FRONT', frame }], objects: [] });
  const front = { id: 'a1', angle_label: 'FRONT', angle_kind: 'front', angle_name: 'Front' };

  test('is the base picture: no image call, free', () => {
    const set = { id: 'set-1', base_still_url: BASE, scene_spec: spec({ left: 0, top: 0, width: 1, height: 1 }) };
    expect(sceneGen.zoneIsBase(front, set)).toBe(true);
    expect(sceneGen.estimateAngleCost(front, set)).toMatchObject({ usd: 0, method: 'base' });
  });

  test('a part of the picture, a spec of another base, or no zone is not', () => {
    expect(sceneGen.zoneIsBase(front, { base_still_url: BASE, scene_spec: spec({ left: 0, top: 0, width: 0.5, height: 1 }) })).toBe(false);
    expect(sceneGen.zoneIsBase(front, { base_still_url: 'https://bucket.example/new.jpg', scene_spec: spec({ left: 0, top: 0, width: 1, height: 1 }) })).toBe(false);
    expect(sceneGen.zoneIsBase({ ...front, angle_kind: null }, { base_still_url: BASE, scene_spec: spec({ left: 0, top: 0, width: 1, height: 1 }) })).toBe(false);
  });

  test('generateZone stores the base as the zone\'s picture and clears the old one\'s copies', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const SceneAngle = { update: jest.fn(async () => [1]) };
    const models = { SceneAngle, SceneSet: { update: jest.fn() }, sequelize: null };
    const set = { id: 'set-1', base_still_url: BASE, scene_spec: spec({ left: 0, top: 0, width: 1, height: 1 }) };
    const out = await sceneGen.generateAngle(front, set, models);
    expect(out).toMatchObject({ stillUrl: BASE, fromBase: true });
    expect(SceneAngle.update.mock.calls.at(-1)[0]).toMatchObject({
      still_image_url: BASE, generation_cost: 0,
      enhanced_still_url: null, enhanced_video_url: null, post_processing_status: null,
    });
    jest.restoreAllMocks();
  });
});

describe('generation order', () => {
  test('zones and the base\'s framings by sort_order, then the extras on zones', () => {
    const angles = [
      { id: 'e', angle_kind: 'extra', zone_angle_id: 'f', sort_order: 0 },
      { id: 'f', angle_kind: 'front', sort_order: 2 },
      { id: 'i', angle_kind: 'extra', zone_angle_id: null, sort_order: 1 },
      { id: 'b', angle_kind: 'back', sort_order: 3 },
    ];
    expect(sceneGen.generationOrder(angles).map((a) => a.id)).toEqual(['i', 'f', 'b', 'e']);
    expect(sceneGen.generationOrder(undefined)).toEqual([]);
  });
});

describe('an angle that names its own camera (fourth audit)', () => {
  const frameSpec = (label, description = 'The vanity wall.') => ({
    _meta: { base_still_url: BASE },
    camera_contracts: [{ angle: label, description, frame: { left: 0.2, top: 0.2, width: 0.6, height: 0.6 } }],
    objects: [],
  });

  test('is generated, not the base picture or a free crop; the spec\'s own description is not one', () => {
    const set = { base_still_url: BASE, scene_spec: frameSpec('VANITY') };
    expect(sceneGen.estimateAngleCost({ angle_label: 'VANITY' }, set).method).toBe('crop');
    // The contract's own description (a spec-made angle): still a crop.
    expect(sceneGen.estimateAngleCost({ angle_label: 'VANITY', camera_direction: 'The vanity wall.' }, set).method).toBe('crop');
    expect(sceneGen.estimateAngleCost({ angle_label: 'VANITY', camera_direction: 'Low, from the bed, at night' }, set).method).toBe('edit');
    const inside = { angle_label: 'WIDE', angle_kind: 'inside' };
    expect(sceneGen.estimateAngleCost(inside, { base_still_url: BASE }).method).toBe('base');
    expect(sceneGen.estimateAngleCost({ ...inside, camera_direction: 'Looking back at the door' }, { base_still_url: BASE }).method).toBe('edit');
  });

  test('ownCamera: a Camera override counts; an empty direction does not', () => {
    expect(sceneGen.ownCamera({ angle_label: 'WIDE' }, { camera: 'Low angle' })).toBe(true);
    expect(sceneGen.ownCamera({ angle_label: 'WIDE', camera_direction: '  ' })).toBe(false);
  });
});
