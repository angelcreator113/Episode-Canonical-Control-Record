/**
 * Scene Sets audit (2026-10-15): a spec saved by hand (PUT/PATCH
 * /scene-sets/:id/spec) lost the version and base picture it belongs to,
 * so the next angle generation read it as stale and rebuilt it over the
 * edit. It now keeps them; and a whole spec the angles could not use is
 * refused.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { specFitsBase } = require('../../src/services/sceneGenerationService');
const { SPEC_VERSION } = require('../../src/services/sceneSpecService');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

(shouldSkip ? describe.skip : describe)('A spec edited by hand is kept', () => {
  let token;
  const setIds = [];
  const base = 'https://bucket.example/base.jpg';
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    await sequelize.query(`ALTER TABLE scene_sets
      ADD COLUMN IF NOT EXISTS style_reference_url text,
      ADD COLUMN IF NOT EXISTS negative_prompt text,
      ADD COLUMN IF NOT EXISTS variation_count integer DEFAULT 1,
      ADD COLUMN IF NOT EXISTS cover_angle_id uuid`);
    token = TokenService.generateTokenPair({
      id: 'test-user-spec-edits', email: 'user@spec-edits.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });
  afterAll(async () => {
    if (setIds.length) await sequelize.query('DELETE FROM scene_sets WHERE id IN (:ids)', { replacements: { ids: setIds } });
  });

  const makeSet = async (fields = {}) => {
    const set = await models.SceneSet.create({ name: `Spec ${crypto.randomUUID().slice(0, 8)}`, scene_type: 'HOME_BASE', base_still_url: base, ...fields });
    setIds.push(set.id);
    return set;
  };
  const stored = async (id) => (await models.SceneSet.findByPk(id, { attributes: ['scene_spec'] })).scene_spec;
  const SPEC = { zones: [], objects: [{ id: 'bed', label: 'Bed' }], camera_contracts: [{ angle: 'WIDE', required: ['bed'] }] };

  it('PUT: the edited spec belongs to the base, so generation uses it', async () => {
    const set = await makeSet();
    const res = await auth(request(app).put(`/api/v1/scene-sets/${set.id}/spec`)).send({ spec: SPEC });
    expect(res.status).toBe(200);
    const spec = await stored(set.id);
    expect(spec).toMatchObject({ version: SPEC_VERSION, _meta: { base_still_url: base, source: 'user_edit' } });
    expect(specFitsBase(spec, base)).toBe(true);
  });

  it('PUT: a spec the angles cannot use is refused, and the saved one kept', async () => {
    const set = await makeSet();
    await auth(request(app).put(`/api/v1/scene-sets/${set.id}/spec`)).send({ spec: SPEC });
    const res = await auth(request(app).put(`/api/v1/scene-sets/${set.id}/spec`)).send({ spec: { objects: [] } });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no camera contracts/);
    expect((await stored(set.id)).camera_contracts).toHaveLength(1);
  });

  it('PATCH: an edit keeps the spec\'s base picture and version', async () => {
    const set = await makeSet({ scene_spec: { ...SPEC, version: SPEC_VERSION, _meta: { base_still_url: base, source: 'base_image_analysis' } } });
    const res = await auth(request(app).patch(`/api/v1/scene-sets/${set.id}/spec`)).send({ room: { name: 'Loft' } });
    expect(res.status).toBe(200);
    const spec = await stored(set.id);
    expect(spec.room).toEqual({ name: 'Loft' });
    expect(spec._meta).toMatchObject({ base_still_url: base, source: 'user_edit', edited_fields: ['room'] });
    expect(specFitsBase(spec, base)).toBe(true);
  });
});
