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
 * The test adds an ally to the first character's relationships_map just before
 * the backfill's UPDATE of that character (or, when the fix locks the row, lets
 * that write wait on the lock for a short timeout). On origin/main the
 * backfill writes back the map it read earlier and the ally is lost; with the
 * fix both the seeded ally and the concurrent one survive.
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

  it('row 60: the seeded ally and a concurrent ally both survive', async () => {
    // A concurrent writer that appends to allies in one statement.
    const addConcurrentAlly = () => sequelize.query(
      `UPDATE registry_characters
          SET relationships_map = jsonb_set(COALESCE(relationships_map, CAST('{}' AS jsonb)), '{allies}',
                COALESCE(relationships_map->'allies', CAST('[]' AS jsonb)) || CAST('["Concurrent Ally"]' AS jsonb))
        WHERE id = :id`,
      { replacements: { id: ids.rcA } }
    );

    // Just before the backfill's UPDATE of the first character's map, run the
    // concurrent write; if the row is locked, give it 600 ms, then go on.
    const original = sequelize.query.bind(sequelize);
    let concurrent = null;
    jest.spyOn(sequelize, 'query').mockImplementation(async (sql, opts, ...rest) => {
      const text = typeof sql === 'string' ? sql : sql?.query || '';
      if (!concurrent && /UPDATE registry_characters SET relationships_map = :map/.test(text) && opts?.replacements?.id === ids.rcA) {
        concurrent = original(`SELECT 1`).then(() => { jest.restoreAllMocks(); return addConcurrentAlly(); });
        await Promise.race([concurrent.then(() => {}, () => {}), sleep(600)]);
      }
      return original(sql, opts, ...rest);
    });

    const res = await request(app)
      .post('/api/v1/world/seed-relationships')
      .set('Authorization', `Bearer ${token}`)
      .send({ world_tag: tag });
    jest.restoreAllMocks();
    await concurrent;

    expect(res.status).toBe(200);
    expect(concurrent).not.toBeNull();
    const [row] = await q(`SELECT relationships_map FROM registry_characters WHERE id = :rcA`, ids);
    expect(row.relationships_map.allies).toEqual(expect.arrayContaining(['Peer Beta', 'Concurrent Ally']));
  });
});
