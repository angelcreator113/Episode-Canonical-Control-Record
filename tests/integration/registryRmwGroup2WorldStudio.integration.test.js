/**
 * F-Reg-2 fix group 2 (v1.2 R2), src/routes/worldStudio.js: row 60 of the
 * scoping note's §3.4 (F-Reg-2_Fix_Plan_v1.0.md §4.2). backfillRelationshipsMap
 * (reached from POST /world/seed-relationships) read each registry character's
 * relationships_map, unioned in the seeded names and wrote the whole map back,
 * so an entry another request added in between was lost.
 * characterRegistry.js was #2179/#2181; registrySync.js #2183;
 * characterGenerationRoutes.js #2186/#2192; consciousness.js #2198;
 * memories/interview.js #2203.
 *
 * Since 2026-10-23 (one truth for relationships) the backfill is gone:
 * relationships_map is read from the story pairs, so the seed writes no map
 * at all and an entry another request added cannot be lost.
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

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(shouldSkip ? describe.skip : describe)('F-Reg-2 fix group 2, worldStudio.js: interleaved relationships_map writes are not lost', () => {
  let token;
  const tag = `rmw-ws-${uuid().slice(0, 8)}`;
  const ids = { reg: uuid(), rcA: uuid(), rcB: uuid(), wcA: uuid(), wcB: uuid() };

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-rmw-worldstudio',
      email: 'test@rmw-worldstudio.dev',
      name: 'RMW WorldStudio Test',
      groups: ['USER', 'EDITOR'],
      role: 'USER',
    }).accessToken;
    await run(`INSERT INTO character_registries (id, title, book_tag, created_at, updated_at) VALUES (:reg, 'RMW world studio registry', :tag, NOW(), NOW())`, { ...ids, tag });
    for (const [rc, name] of [[ids.rcA, 'Peer Alpha'], [ids.rcB, 'Peer Beta']]) {
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, relationships_map, created_at, updated_at)
                 VALUES (:rc, :reg, :key, :name, CAST('{}' AS jsonb), NOW(), NOW())`,
        { rc, reg: ids.reg, key: `rmw-ws-${rc.slice(0, 8)}`, name });
    }
    // Two active industry peers pair as 'Industry Connection', which the
    // backfill files under allies.
    for (const [wc, rc, name] of [[ids.wcA, ids.rcA, 'Peer Alpha'], [ids.wcB, ids.rcB, 'Peer Beta']]) {
      await run(`INSERT INTO world_characters (id, name, character_type, status, registry_character_id, created_at, updated_at)
                 VALUES (:wc, :name, 'industry_peer', 'active', :rc, NOW(), NOW())`, { wc, rc, name });
    }
  });

  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await run(`DELETE FROM character_relationships WHERE character_id_a IN (:rcA, :rcB) OR character_id_b IN (:rcA, :rcB)`, ids);
    await run(`DELETE FROM world_characters WHERE id IN (:wcA, :wcB)`, ids);
    await run(`DELETE FROM character_registries WHERE id = :reg`, ids); // cascades characters
  });

  it('row 60: seeding writes no relationships_map any more, so nothing it holds can be lost (Evoni, 2026-10-23)', async () => {
    // relationships_map is read from the story pairs (services/relationshipTruth),
    // so the seed only makes the pairs and leaves the stored map alone.
    await run(`UPDATE registry_characters SET relationships_map = CAST('{"allies": ["Concurrent Ally"]}' AS jsonb) WHERE id = :rcA`, ids);
    const writes = [];
    const original = sequelize.query.bind(sequelize);
    jest.spyOn(sequelize, 'query').mockImplementation(async (sql, opts, ...rest) => {
      const text = typeof sql === 'string' ? sql : sql?.query || '';
      if (/UPDATE registry_characters SET relationships_map/i.test(text)) writes.push(text);
      return original(sql, opts, ...rest);
    });

    const res = await request(app)
      .post('/api/v1/world/seed-relationships')
      .set('Authorization', `Bearer ${token}`)
      .send({ world_tag: tag });
    jest.restoreAllMocks();

    expect(res.status).toBe(200);
    expect(writes).toEqual([]);
    const [row] = await q(`SELECT relationships_map FROM registry_characters WHERE id = :rcA`, ids);
    expect(row.relationships_map).toEqual({ allies: ['Concurrent Ally'] });
    const [pair] = await q(`SELECT relationship_type FROM character_relationships
                             WHERE (character_id_a = :rcA AND character_id_b = :rcB) OR (character_id_a = :rcB AND character_id_b = :rcA)`, ids);
    expect(pair).toBeDefined();
  });
});
