jest.unmock('uuid');

/**
 * Integration Tests - DELETE /api/v1/world/characters/:id
 *
 * F-Stats-1 Fix Plan v1.62 §65.6-F (Task #2070). The handler deletes a world
 * character and its linked rows in five statements. These tests pin what a
 * delete does today and must keep doing: the character, its registry
 * character, the registry character's relationships, its intimate scenes and
 * its extended relationships (when that table exists) are removed, and the
 * response is { deleted: true }. An unknown id also answers 200 with
 * { deleted: true }: the handler never checks that the character existed.
 *
 * `character_relationships_extended` has no migration or model in this repo,
 * so a database built by the migration tree (this one) does not have it.
 */
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
const count = async (sql, replacements) => Number((await q(sql, replacements))[0].n);

// One world character with a linked registry character, a relationship to a
// second (unlinked) registry character, and an intimate scene.
async function seedCharacter() {
  const ids = { world: uuid(), registry: uuid(), rc: uuid(), partner: uuid(), rel: uuid(), scene: uuid() };
  await run(`INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:registry, 'Delete test registry', NOW(), NOW())`, ids);
  await run(`INSERT INTO world_characters (id, name, character_type) VALUES (:world, 'Delete Test Character', 'test')`, ids);
  await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, world_character_id, created_at, updated_at)
             VALUES (:rc, :registry, :rcKey, 'Linked', :world, NOW(), NOW()),
                    (:partner, :registry, :partnerKey, 'Partner', NULL, NOW(), NOW())`,
    { ...ids, rcKey: `del-test-${ids.rc.slice(0, 8)}`, partnerKey: `del-partner-${ids.partner.slice(0, 8)}` });
  await run(`INSERT INTO character_relationships (id, character_id_a, character_id_b, relationship_type) VALUES (:rel, :rc, :partner, 'friend')`, ids);
  await run(`INSERT INTO intimate_scenes (id, character_a_id, character_a_name, scene_type) VALUES (:scene, :world, 'Delete Test Character', 'test')`, ids);
  return ids;
}

async function remaining(ids) {
  return {
    world: await count(`SELECT COUNT(*) AS n FROM world_characters WHERE id = :world`, ids),
    rc: await count(`SELECT COUNT(*) AS n FROM registry_characters WHERE id = :rc`, ids),
    partner: await count(`SELECT COUNT(*) AS n FROM registry_characters WHERE id = :partner`, ids),
    rel: await count(`SELECT COUNT(*) AS n FROM character_relationships WHERE id = :rel`, ids),
    scene: await count(`SELECT COUNT(*) AS n FROM intimate_scenes WHERE id = :scene`, ids),
  };
}

async function cleanup(ids) {
  await run(`DELETE FROM intimate_scenes WHERE id = :scene`, ids);
  await run(`DELETE FROM world_characters WHERE id = :world`, ids);
  await run(`DELETE FROM character_registries WHERE id = :registry`, ids); // cascades registry characters and relationships
}

(shouldSkip ? describe.skip : describe)('DELETE /api/v1/world/characters/:id (Task #2070)', () => {
  let token;
  const seeded = [];
  const auth = () => `Bearer ${token}`;

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-world-delete',
      email: 'test@world-delete.dev',
      name: 'World Delete Test',
      groups: ['USER', 'EDITOR'],
      role: 'USER',
    }).accessToken;
  });

  afterAll(async () => {
    for (const ids of seeded) await cleanup(ids);
  });

  test('this database has no character_relationships_extended (built by the migration tree)', async () => {
    const [row] = await q(`SELECT to_regclass('character_relationships_extended') AS t`);
    expect(row.t).toBeNull();
  });

  test('a delete removes the character, its registry character, its relationships and its intimate scenes', async () => {
    const ids = await seedCharacter();
    seeded.push(ids);
    expect(await remaining(ids)).toEqual({ world: 1, rc: 1, partner: 1, rel: 1, scene: 1 });

    const res = await request(app).delete(`/api/v1/world/characters/${ids.world}`).set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true });
    // The unlinked partner stays; everything tied to the character goes.
    expect(await remaining(ids)).toEqual({ world: 0, rc: 0, partner: 1, rel: 0, scene: 0 });
  });

  test('an unknown id answers 200 with { deleted: true }, as today', async () => {
    const res = await request(app).delete(`/api/v1/world/characters/${uuid()}`).set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true });
  });

  test('it still requires authentication', async () => {
    const res = await request(app).delete(`/api/v1/world/characters/${uuid()}`);
    expect(res.status).toBe(401);
  });
});
