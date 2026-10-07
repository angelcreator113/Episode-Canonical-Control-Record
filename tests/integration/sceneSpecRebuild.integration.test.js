/**
 * POST /api/v1/scene-sets/:id/spec/generate (audit SCENE-03, 2026-10-03):
 * a forced rebuild never clears the saved spec first. An AI failure or an
 * unusable candidate leaves the old spec in place and readable; a usable
 * candidate replaces it in one write and keeps the old one as
 * scene_spec_previous; without force, a cached spec comes back with no AI
 * call. Through the real route and service on the migrated database, with
 * Claude mocked.
 */
jest.unmock('uuid');

const replies = { queue: [] };
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({
  messages: { create: jest.fn(async () => {
    const next = replies.queue.shift();
    if (next instanceof Error) throw next;
    return { content: [{ type: 'text', text: next }], stop_reason: 'end_turn' };
  }) },
})));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { validateSpecCandidate, SPEC_VERSION } = require('../../src/services/sceneSpecService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const BASE = 'https://img.example/base.png';
const OLD = { version: SPEC_VERSION, zones: [{ id: 'zone-old' }], objects: [{ id: 'lamp' }], camera_contracts: [{ angle: 'WIDE' }], _meta: { base_still_url: BASE, generated_at: '2026-09-01T00:00:00.000Z', source: 'base_image_analysis' } };
const GOOD = JSON.stringify({ zones: [{ id: 'zone-new' }], objects: [{ id: 'mirror' }], camera_contracts: [{ angle: 'ESTABLISHING', kind: 'front' }] });

describe('validateSpecCandidate', () => {
  test('names what a candidate lacks', () => {
    expect(validateSpecCandidate(JSON.parse(GOOD))).toEqual({ ok: true, problems: [] });
    expect(validateSpecCandidate({ zones: [], objects: [] })).toEqual({ ok: false, problems: ['no camera contracts'] });
    expect(validateSpecCandidate({ camera_contracts: [{}] })).toEqual({ ok: false, problems: ['zones is not a list', 'objects is not a list'] });
    expect(validateSpecCandidate('nope')).toEqual({ ok: false, problems: ['not a JSON object'] });
  });
});

(shouldSkip ? describe.skip : describe)('POST /scene-sets/:id/spec/generate', () => {
  const setId = uuid();
  let token;
  const generate = (body = {}) => request(app).post(`/api/v1/scene-sets/${setId}/spec/generate`).set('Authorization', `Bearer ${token}`).send(body);
  const saved = async () => {
    const set = await models.SceneSet.findByPk(setId);
    return { spec: set.scene_spec, previous: set.visual_language?.scene_spec_previous || null, fallback: set.visual_language?.scene_spec || null };
  };

  beforeAll(async () => {
    process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
    token = TokenService.generateTokenPair({
      id: 'test-user-spec-rebuild', email: 'user@specrebuild.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO scene_sets (id, name, scene_type, generation_status, base_still_url, scene_spec, visual_language, created_at, updated_at)
      VALUES (:id, 'Rebuild set', 'HOME_BASE', 'complete', :base, :spec::jsonb, :vl::jsonb, NOW(), NOW())`,
    { id: setId, base: BASE, spec: JSON.stringify(OLD), vl: JSON.stringify({ scene_spec: OLD, palette: ['gold'] }) });
  });

  test('an AI failure leaves the old spec usable', async () => {
    replies.queue = [new Error('overloaded')];
    const res = await generate({ force: true });
    expect(res.status).toBe(500);
    expect(res.body.error).toContain('overloaded');
    expect(await saved()).toMatchObject({ spec: { zones: [{ id: 'zone-old' }] }, previous: null, fallback: { zones: [{ id: 'zone-old' }] } });
  });

  test('an unusable candidate is refused by name and leaves the old spec', async () => {
    replies.queue = [JSON.stringify({ zones: [], objects: [] })];
    const res = await generate({ force: true });
    expect(res.status).toBe(500);
    expect(res.body.error).toContain('no camera contracts');
    expect(res.body.error).toContain('the saved spec is unchanged');
    expect((await saved()).spec.zones).toEqual([{ id: 'zone-old' }]);
  });

  test('without force the cached spec comes back and Claude is not asked', async () => {
    replies.queue = [];
    const res = await generate({});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, rebuilt: false, replaced_previous: false });
    expect(res.body.data.zones).toEqual([{ id: 'zone-old' }]);
  });

  test('a usable candidate replaces the spec in one write and keeps the old one; the fallback copy is cleared', async () => {
    replies.queue = [GOOD];
    const res = await generate({ force: true });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, rebuilt: true, replaced_previous: true });
    expect(res.body.data.zones).toEqual([{ id: 'zone-new' }]);
    expect(res.body.data._meta).toMatchObject({ forced: true, base_still_url: BASE, previous: { generated_at: '2026-09-01T00:00:00.000Z', source: 'base_image_analysis' } });
    const after = await saved();
    expect(after.spec.zones).toEqual([{ id: 'zone-new' }]);
    expect(after.previous.zones).toEqual([{ id: 'zone-old' }]);
    expect(after.fallback).toBeNull();
    // The rest of visual_language survives the write.
    expect((await models.SceneSet.findByPk(setId)).visual_language.palette).toEqual(['gold']);

    // A second forced rebuild never hands back the old fallback as new.
    replies.queue = [JSON.stringify({ zones: [{ id: 'zone-3' }], objects: [], camera_contracts: [{ angle: 'CLOSE' }] })];
    const again = await generate({ force: true });
    expect(again.body.data.zones).toEqual([{ id: 'zone-3' }]);
    expect((await saved()).previous.zones).toEqual([{ id: 'zone-new' }]);
  });
});
