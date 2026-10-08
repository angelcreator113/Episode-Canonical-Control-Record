/**
 * Scene Studio's Scan Tension finds its pairs. The page read `pairs` from
 * GET /world/tension-check, which answered only `triggered` (one row per
 * character) and the one-night candidates, so every scan found none. Now
 * tension-check also answers `pairs`: a relationship both of whose
 * characters are triggered (active, intimate-eligible, in a confirmed
 * high-tension relationship), once each, volatile first, with the world
 * characters' ids the scene generator takes and their names. With
 * ?show_id=, the show's pairs (the scanner's rule, inShow).
 *
 * The database is the local migrated test DB.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const uuid = () => crypto.randomUUID();

(shouldSkip ? describe.skip : describe)("Scene Studio's Scan Tension finds its pairs", () => {
  let token;
  const TAG = uuid().slice(0, 8);
  const name = (k) => `Scene Pair ${TAG} ${k}`;
  const show = { a: uuid(), b: uuid() };
  const reg = { a: uuid(), b: uuid() };
  // a, b in show A's registry; c, d in show B's. d is not intimate-eligible.
  const cast = { a: 'a', b: 'a', c: 'b', d: 'b' };
  const wc = Object.fromEntries(Object.keys(cast).map((k) => [k, uuid()]));
  const rc = Object.fromEntries(Object.keys(cast).map((k) => [k, uuid()]));
  // ab volatile (a pair), bc simmering (a pair across the shows), cd
  // fractured (d is not eligible: no pair), ac calm (not a tension).
  const rel = { ab: uuid(), bc: uuid(), cd: uuid(), ac: uuid() };
  const relName = Object.fromEntries(Object.entries(rel).map(([k, id]) => [id, k]));

  const check = (qs = '') => request(app).get(`/api/v1/world/tension-check${qs}`).set('Authorization', `Bearer ${token}`);
  const ours = (body) => body.pairs.filter((p) => relName[p.relationship_id]);

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-scene-pairs', email: 'test@scene-pairs.dev', name: 'Scene Pairs Test',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    for (const [k, id] of Object.entries(show)) {
      await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :name, :slug, NOW(), NOW())',
        { id, name: name(`show ${k}`), slug: `scene-pair-${TAG}-${k}` });
      await run('INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:id, :title, :show, NOW(), NOW())',
        { id: reg[k], title: name(`registry ${k}`), show: id });
    }
    for (const [k, r] of Object.entries(cast)) {
      await run(`INSERT INTO world_characters (id, name, character_type, status, intimate_eligible, relationship_graph, created_at, updated_at)
                 VALUES (:id, :name, 'pressure', 'active', :eligible, '[]'::jsonb, NOW(), NOW())`,
      { id: wc[k], name: name(k), eligible: k !== 'd' });
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, world_character_id, created_at, updated_at)
                 VALUES (:id, :registry, :key, :name, :world, NOW(), NOW())`,
      { id: rc[k], registry: reg[r], key: `scene_pair_${rc[k].slice(0, 8)}`, name: name(k), world: wc[k] });
    }
    const addRel = (id, a, b, tension, situation) => run(
      `INSERT INTO character_relationships (id, character_id_a, character_id_b, relationship_type, tension_state, situation, confirmed, created_at, updated_at)
       VALUES (:id, :a, :b, 'Rival', :tension, :situation, true, NOW(), NOW())`, { id, a, b, tension, situation });
    await addRel(rel.ab, rc.a, rc.b, 'volatile', 'The window display.');
    await addRel(rel.bc, rc.b, rc.c, 'simmering', null);
    await addRel(rel.cd, rc.c, rc.d, 'fractured', null);
    await addRel(rel.ac, rc.a, rc.c, 'calm', null);
  });

  afterAll(async () => {
    const rcs = Object.values(rc);
    await run('DELETE FROM character_relationships WHERE character_id_a IN (:rcs) OR character_id_b IN (:rcs)', { rcs });
    await run('DELETE FROM registry_characters WHERE id IN (:rcs)', { rcs });
    await run('DELETE FROM world_characters WHERE id IN (:ids)', { ids: Object.values(wc) });
    await run('DELETE FROM character_registries WHERE id IN (:ids)', { ids: Object.values(reg) });
    await run('DELETE FROM shows WHERE id IN (:ids)', { ids: Object.values(show) });
  });

  it('a pair is a relationship whose two characters are triggered: once, volatile first, with world ids and names', async () => {
    const res = await check();
    expect(res.status).toBe(200);
    expect(ours(res.body)).toEqual([
      {
        relationship_id: rel.ab,
        character_a_id: wc.a, character_a_name: name('a'),
        character_b_id: wc.b, character_b_name: name('b'),
        tension_state: 'volatile', relationship_type: 'Rival', situation: 'The window display.',
      },
      {
        relationship_id: rel.bc,
        character_a_id: wc.b, character_a_name: name('b'),
        character_b_id: wc.c, character_b_name: name('c'),
        tension_state: 'simmering', relationship_type: 'Rival', situation: null,
      },
    ]);
    // c is still triggered by cd, whose other character is not eligible.
    const triggered = res.body.triggered.filter((t) => relName[t.relationship_id]).map((t) => `${t.name.slice(name('').length)}:${relName[t.relationship_id]}`).sort();
    expect(triggered).toEqual(['a:ab', 'b:ab', 'b:bc', 'c:bc', 'c:cd']);
  });

  it("with ?show_id=, the show's pairs: a pair across two shows is neither's", async () => {
    expect(ours((await check(`?show_id=${show.a}`)).body).map((p) => relName[p.relationship_id])).toEqual(['ab']);
    expect(ours((await check(`?show_id=${show.b}`)).body)).toEqual([]);
  });
});
