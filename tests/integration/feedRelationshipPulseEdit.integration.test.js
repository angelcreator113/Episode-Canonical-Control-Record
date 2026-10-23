/**
 * The Relationship Map edits the relationships The Pulse reads (Task #3115;
 * Evoni, 2026-10-13: "go with (a)"), against the test database:
 * - POST /feed-relationships writes social_profile_relationships, in the
 *   map's field names; an unknown kind, a pair with itself, and the same kind
 *   for the pair either way round are refused;
 * - PUT changes only its allowed fields and refuses a kind the pair has;
 * - an edit on the map changes The Pulse's closeness for the pair;
 * - DELETE removes the row; GET lists it with either side's id;
 * Migration 20261013130000's copy of feed_profile_relationships was tested
 * here; the table is gone since migration 20261023230000 (one Pulse table,
 * Evoni, 2026-10-23), whose test (relationshipTruth.integration) copies a
 * row the old way before dropping it.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const closeness = require('../../src/services/pulseCloseness');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('Relationship Map edits The Pulse (Task #3115)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid() };
  const p = {};
  let token;
  const as = (req) => req.set('Authorization', `Bearer ${token}`);
  const create = (body) => as(request(app).post('/api/v1/feed-relationships')).send(body);
  const update = (id, body) => as(request(app).put(`/api/v1/feed-relationships/${id}`)).send(body);
  const kindsOf = async (a, b) => (await run(
    `SELECT relationship_type::text AS type FROM social_profile_relationships
      WHERE (source_profile_id = :a AND target_profile_id = :b) OR (source_profile_id = :b AND target_profile_id = :a)
      ORDER BY id`, { a, b }))[0].map((r) => r.type);

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    token = TokenService.generateTokenPair({ id: 'test-map-edit', email: 'evoni@mapedit.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Map edit ${tag}`, slug: `map-edit-${tag}` });
    for (const key of ['ana', 'bea', 'cal', 'dee']) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}`, display: key });
      p[key] = row.id;
    }
  });

  afterAll(async () => {
    const all = Object.values(p);
    await run('DELETE FROM social_profile_relationships WHERE source_profile_id IN (:all) OR target_profile_id IN (:all)', { all });
    await run('DELETE FROM social_profiles WHERE id IN (:all)', { all });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('POST writes The Pulse\'s table in the map\'s field names; bad and duplicate pairs are refused', async () => {
    const res = await create({ influencer_a_id: p.ana, influencer_b_id: p.bea, relationship_type: 'former_friends', is_public: false, notes: 'the gala' });
    expect(res.status).toBe(201);
    expect(res.body.relationship).toMatchObject({
      source_profile_id: p.ana, target_profile_id: p.bea, influencer_a_id: p.ana, influencer_b_id: p.bea,
      relationship_type: 'former_friends', public_visibility: 'hidden', is_public: false,
      description: 'the gala', notes: 'the gala', is_conflict: true,
    });
    expect(await kindsOf(p.ana, p.bea)).toEqual(['former_friends']);

    expect((await create({ influencer_a_id: p.bea, influencer_b_id: p.ana, relationship_type: 'former_friends' })).status).toBe(409);
    expect((await create({ influencer_a_id: p.ana, influencer_b_id: p.bea, relationship_type: 'beef' })).status).toBe(400);
    expect((await create({ influencer_a_id: p.ana, influencer_b_id: p.ana, relationship_type: 'collab' })).status).toBe(400);
    expect((await create({ influencer_a_id: p.ana, influencer_b_id: 2147483000, relationship_type: 'collab' })).status).toBe(404);
    expect((await request(app).post('/api/v1/feed-relationships').send({})).status).toBe(401);
  });

  test('an edit on the map changes The Pulse\'s closeness for the pair', async () => {
    const made = await create({ influencer_a_id: p.bea, influencer_b_id: p.cal, relationship_type: 'orbit' });
    expect(made.status).toBe(201);
    const at = 100;
    expect(await closeness.closenessAt(models, ids.show, p.bea, p.cal, at)).toBe(0.2);

    const res = await update(made.body.relationship.id, { relationship_type: 'bestie', is_public: true, source_profile_id: p.dee, auto_generated: true });
    expect(res.status).toBe(200);
    expect(res.body.relationship).toMatchObject({ relationship_type: 'bestie', influencer_a_id: p.bea, influencer_b_id: p.cal, auto_generated: false, is_conflict: false });
    expect(await closeness.closenessAt(models, ids.show, p.bea, p.cal, at)).toBe(1);

    const canvas = await as(request(app).get('/api/v1/feed-relationships/canvas'));
    const edge = canvas.body.edges.find((e) => e.id === made.body.relationship.id);
    expect(edge).toMatchObject({ source: p.bea, target: p.cal, type: 'bestie', is_public: true, is_conflict: false });
    expect(edge.style.label).toBe('bestie');
  });

  test('PUT refuses an unknown kind, a kind the pair already has, and bad values', async () => {
    const [[rel]] = await run(`SELECT id FROM social_profile_relationships WHERE source_profile_id = :a AND target_profile_id = :b`, { a: p.bea, b: p.cal });
    await create({ influencer_a_id: p.cal, influencer_b_id: p.bea, relationship_type: 'collab' });
    expect((await update(rel.id, { relationship_type: 'collab' })).status).toBe(409);
    expect((await update(rel.id, { relationship_type: 'silent_alliance' })).status).toBe(400);
    expect((await update(rel.id, { drama_level: 11 })).status).toBe(400);
    expect((await update(rel.id, { public_visibility: 'secret' })).status).toBe(400);
    expect((await update(rel.id, { drama_level: 7, notes: 'since the tour' })).body.relationship).toMatchObject({ drama_level: 7, notes: 'since the tour' });
    expect((await update(2147483000, { notes: 'x' })).status).toBe(404);
  });

  test('GET lists a profile\'s relationships on either side; DELETE removes one', async () => {
    const list = await as(request(app).get('/api/v1/feed-relationships').query({ influencer_a_id: p.cal }));
    expect(list.status).toBe(200);
    expect(list.body.relationships.map((r) => r.relationship_type).sort()).toEqual(['bestie', 'collab']);
    const row = list.body.relationships.find((r) => r.relationship_type === 'collab');
    expect(row.influencerA.handle).toBe(`cal${tag}`);
    expect(row.influencerB.handle).toBe(`bea${tag}`);
    expect((await as(request(app).get('/api/v1/feed-relationships').query({ type: 'beef' }))).status).toBe(400);

    expect((await as(request(app).delete(`/api/v1/feed-relationships/${row.id}`))).status).toBe(200);
    expect(await kindsOf(p.bea, p.cal)).toEqual(['bestie']);
  });
});
