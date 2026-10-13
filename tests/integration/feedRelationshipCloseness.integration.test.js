/**
 * The Relationship Map shows The Pulse's closeness, read only (Task #3072;
 * Evoni, 2026-10-13): GET /feed-relationships/canvas?show_id= gives each
 * edge its pair's closeness at the show's present, the same value
 * pulseCloseness.closenessAt gives: the pair's social_profile_relationships
 * type, moved by its accepted closeness-ledger changes by then. Without a
 * show the edges carry none; a show id that is not one is refused.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const closeness = require('../../src/services/pulseCloseness');
const { presentOrder } = require('../../src/services/storyClock');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('Relationship Map closeness (Task #3072)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid() };
  const p = {};
  let token;

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    token = TokenService.generateTokenPair({ id: 'test-map-closeness', email: 'evoni@map.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Map ${tag}`, slug: `map-${tag}` });
    for (const key of ['ana', 'bea', 'cal']) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}`, display: key });
      p[key] = row.id;
    }
    // Ana and Bea are besties in The Pulse's table; Bea and Cal have no relationship there.
    await run(`INSERT INTO social_profile_relationships (source_profile_id, target_profile_id, relationship_type, created_at, updated_at)
               VALUES (:a, :b, 'bestie', NOW(), NOW())`, { a: p.ana, b: p.bea });
    // The map's own table has both pairs, with its own types.
    for (const [a, b, type] of [[p.ana, p.bea, 'collab'], [p.bea, p.cal, 'orbit']]) {
      await models.FeedProfileRelationship.create({ influencer_a_id: a, influencer_b_id: b, relationship_type: type });
    }
    const at = await presentOrder(models, ids.show);
    const row = (a, b, delta, order) => {
      const [x, y] = closeness.pairOf(a, b);
      return { show_id: ids.show, profile_a_id: x, profile_b_id: y, story_order: order, delta, cause: 'override', status: 'accepted' };
    };
    await models.PulseCloseness.bulkCreate([
      row(p.ana, p.bea, -0.2, at),        // counts: at the present
      row(p.bea, p.cal, 0.1, at - 1),     // counts
      row(p.bea, p.cal, 0.5, at + 10),    // later than the present: does not count
      { ...row(p.ana, p.bea, 0.3, at), status: 'proposed' },   // not accepted: does not count
    ]);
  });

  afterAll(async () => {
    await run('DELETE FROM pulse_closeness WHERE show_id = :show', ids);
    await run('DELETE FROM feed_profile_relationships WHERE influencer_a_id IN (:a) OR influencer_b_id IN (:a)', { a: Object.values(p) });
    await run('DELETE FROM social_profile_relationships WHERE source_profile_id IN (:a)', { a: Object.values(p) });
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: Object.values(p) });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  const canvas = (query = '') => request(app).get(`/api/v1/feed-relationships/canvas${query}`).set('Authorization', `Bearer ${token}`);
  const edgeOf = (body, a, b) => body.edges.find((e) => (e.source === a && e.target === b) || (e.source === b && e.target === a));

  test('each edge carries its pair\'s closeness at the show\'s present, as closenessAt gives it', async () => {
    const res = await canvas(`?show_id=${ids.show}`);
    expect(res.status).toBe(200);
    expect(edgeOf(res.body, p.ana, p.bea)).toMatchObject({ type: 'collab', closeness: 0.8 });
    expect(edgeOf(res.body, p.bea, p.cal)).toMatchObject({ type: 'orbit', closeness: 0.1 });
    const at = await presentOrder(models, ids.show);
    expect(await closeness.closenessAt(models, ids.show, p.ana, p.bea, at)).toBe(0.8);
    expect(await closeness.closenessAt(models, ids.show, p.bea, p.cal, at)).toBe(0.1);
  });

  test('without a show the edges carry no closeness; a show id that is not one is refused', async () => {
    const res = await canvas();
    expect(res.status).toBe(200);
    expect(edgeOf(res.body, p.ana, p.bea).closeness).toBeNull();
    expect((await canvas('?show_id=not-a-show')).status).toBe(400);
  });

  test('closenessOfPairs: either order, no pairs, and a pair with itself', async () => {
    const at = await presentOrder(models, ids.show);
    const m = await closeness.closenessOfPairs(models, ids.show, [[p.bea, p.ana], [p.cal, p.bea], [p.ana, p.ana]], at);
    expect(Object.fromEntries(m)).toEqual({
      [closeness.pairOf(p.ana, p.bea).join(':')]: 0.8,
      [closeness.pairOf(p.bea, p.cal).join(':')]: 0.1,
    });
    expect((await closeness.closenessOfPairs(models, ids.show, [], at)).size).toBe(0);
  });
});
