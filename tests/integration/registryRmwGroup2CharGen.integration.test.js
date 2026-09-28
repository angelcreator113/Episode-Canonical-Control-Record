/**
 * F-Reg-2 fix group 2 (v1.2 R2), src/routes/characterGenerationRoutes.js:
 * rows 4 and 8 of the scoping note's §3.4 (F-Reg-2_Fix_Plan_v1.0.md §4.2).
 * Row 4 (POST /confirm) was #2186. Row 8 (POST /promote-ghost) was reached
 * once #2187 fixed its create's role_type.
 * characterRegistry.js was #2179/#2181; registrySync.js was #2183.
 *
 * Each test holds the first request after its read of the character until a
 * second request has run (or, when the fix locks the row, until a short
 * timeout shows the second is waiting on the lock). On origin/main one of
 * the two writes is lost; with the fix both survive.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = '/api/v1/character-generation';

async function seed() {
  const ids = { reg: uuid(), rc: uuid() };
  await run(`INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:reg, 'RMW chargen registry', NOW(), NOW())`, ids);
  await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, selected_name, depth_level, created_at, updated_at)
             VALUES (:rc, :reg, :key, 'Gen Character', 'Gen Character', 'sparked', NOW(), NOW())`,
    { ...ids, key: `gen-${ids.rc.slice(0, 8)}` });
  return ids;
}

// Hold the first RegistryCharacter.findByPk after it returns, until `second()`
// has finished or `waitMs` has passed, whichever is first.
function interleave(second, waitMs = 600) {
  const original = models.RegistryCharacter.findByPk.bind(models.RegistryCharacter);
  let secondPromise = null;
  let first = true;
  jest.spyOn(models.RegistryCharacter, 'findByPk').mockImplementation(async (...args) => {
    const result = await original(...args);
    if (first) {
      first = false;
      secondPromise = second();
      await Promise.race([secondPromise.then(() => {}, () => {}), sleep(waitMs)]);
    }
    return result;
  });
  return () => secondPromise;
}

(shouldSkip ? describe.skip : describe)('F-Reg-2 fix group 2, characterGenerationRoutes.js: interleaved writes are not lost', () => {
  let token;
  const seeded = [];
  const auth = () => `Bearer ${token}`;

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-rmw-chargen',
      email: 'test@rmw-chargen.dev',
      name: 'RMW Chargen Test',
      groups: ['USER', 'EDITOR'],
      role: 'USER',
    }).accessToken;
  });

  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    for (const ids of seeded) await run(`DELETE FROM character_registries WHERE id = :reg`, ids); // cascades characters
  });

  it('row 4: a confirm computes depth_level from the row as it is when it writes', async () => {
    const ids = await seed();
    seeded.push(ids);
    const confirm = (proposed) =>
      request(app).post(`${BASE}/confirm`).set('Authorization', auth()).send({ character_id: ids.rc, proposed });

    // The second confirm adds a living_state ("active"); the first adds a
    // wound ("breathing" on its own). Together the character is "active".
    const secondDone = interleave(() => confirm({ living_state: { mood: 'set by the second confirm' } }));
    const first = await confirm({ wound: { origin: 'set by the first confirm' } });
    const second = await secondDone();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const [row] = await q(`SELECT wound, living_state, depth_level FROM registry_characters WHERE id = :rc`, ids);
    expect(row.wound).toEqual({ origin: 'set by the first confirm' });
    expect(row.living_state).toEqual({ mood: 'set by the second confirm' });
    expect(row.depth_level).toBe('active');
  });

  it('row 8: two promotions from one source character keep both promoted marks', async () => {
    const ids = await seed();
    seeded.push(ids);
    await run(`UPDATE registry_characters SET ghost_characters = CAST(:ghosts AS jsonb) WHERE id = :rc`,
      { ...ids, ghosts: JSON.stringify([{ name: `Ghost A ${ids.rc.slice(0, 8)}` }, { name: `Ghost B ${ids.rc.slice(0, 8)}` }]) });
    const promote = (ghost_name) =>
      request(app).post(`${BASE}/promote-ghost/${ids.rc}`).set('Authorization', auth()).send({ ghost_name, registry_id: ids.reg });

    const secondDone = interleave(() => promote(`Ghost B ${ids.rc.slice(0, 8)}`));
    const first = await promote(`Ghost A ${ids.rc.slice(0, 8)}`);
    const second = await secondDone();

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const [row] = await q(`SELECT ghost_characters FROM registry_characters WHERE id = :rc`, ids);
    const byName = Object.fromEntries(row.ghost_characters.map((g) => [g.name, g]));
    expect(byName[`Ghost A ${ids.rc.slice(0, 8)}`]).toMatchObject({ promoted: true, promoted_id: first.body.character.id });
    expect(byName[`Ghost B ${ids.rc.slice(0, 8)}`]).toMatchObject({ promoted: true, promoted_id: second.body.character.id });
  });
});
