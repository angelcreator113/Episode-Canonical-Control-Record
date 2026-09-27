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
 *
 * Added with the fix: a failure part-way rolls the whole delete back (a
 * test-only trigger makes the third delete, intimate_scenes, raise), and the
 * extended-relationships delete runs only where that table exists.
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
async function seedCharacter(sceneType = 'test') {
  const ids = { world: uuid(), registry: uuid(), rc: uuid(), partner: uuid(), rel: uuid(), scene: uuid() };
  await run(`INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:registry, 'Delete test registry', NOW(), NOW())`, ids);
  await run(`INSERT INTO world_characters (id, name, character_type) VALUES (:world, 'Delete Test Character', 'test')`, ids);
  await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, world_character_id, created_at, updated_at)
             VALUES (:rc, :registry, :rcKey, 'Linked', :world, NOW(), NOW()),
                    (:partner, :registry, :partnerKey, 'Partner', NULL, NOW(), NOW())`,
    { ...ids, rcKey: `del-test-${ids.rc.slice(0, 8)}`, partnerKey: `del-partner-${ids.partner.slice(0, 8)}` });
  await run(`INSERT INTO character_relationships (id, character_id_a, character_id_b, relationship_type) VALUES (:rel, :rc, :partner, 'friend')`, ids);
  await run(`INSERT INTO intimate_scenes (id, character_a_id, character_a_name, scene_type) VALUES (:scene, :world, 'Delete Test Character', :sceneType)`, { ...ids, sceneType });
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

  describe('all-or-nothing (F-Stats-1 v1.62 §65.6-F)', () => {
    beforeAll(async () => {
      await run(`CREATE OR REPLACE FUNCTION test_2070_fail_scene_delete() RETURNS trigger AS $$
                 BEGIN RAISE EXCEPTION 'test_2070: intimate_scenes delete refused'; END; $$ LANGUAGE plpgsql`);
      await run(`CREATE TRIGGER test_2070_fail_scene_delete BEFORE DELETE ON intimate_scenes
                 FOR EACH ROW WHEN (OLD.scene_type = 'test-2070-fail') EXECUTE FUNCTION test_2070_fail_scene_delete()`);
    });

    afterAll(async () => {
      await run(`DROP TRIGGER IF EXISTS test_2070_fail_scene_delete ON intimate_scenes`);
      await run(`DROP FUNCTION IF EXISTS test_2070_fail_scene_delete()`);
    });

    test('a failure part-way leaves nothing deleted: the transaction rolls back and the route answers 500', async () => {
      const ids = await seedCharacter('test-2070-fail');
      seeded.push(ids);
      const errors = jest.spyOn(console, 'error').mockImplementation(() => {});

      const res = await request(app).delete(`/api/v1/world/characters/${ids.world}`).set('Authorization', auth());

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/intimate_scenes delete refused/);
      // The relationship and registry character were deleted before the scene
      // failed; the rollback restores them, and the character is untouched.
      expect(await remaining(ids)).toEqual({ world: 1, rc: 1, partner: 1, rel: 1, scene: 1 });
      expect(errors.mock.calls.some(([msg]) => String(msg).includes('delete character failed'))).toBe(true);
      errors.mockRestore();
      // Let cleanup delete the scene.
      await run(`UPDATE intimate_scenes SET scene_type = 'test' WHERE id = :scene`, ids);
    });

    test('with character_relationships_extended absent, the delete still completes', async () => {
      const [row] = await q(`SELECT to_regclass('character_relationships_extended') AS t`);
      expect(row.t).toBeNull();
      const ids = await seedCharacter();
      seeded.push(ids);

      const res = await request(app).delete(`/api/v1/world/characters/${ids.world}`).set('Authorization', auth());

      expect(res.status).toBe(200);
      expect(await remaining(ids)).toEqual({ world: 0, rc: 0, partner: 1, rel: 0, scene: 0 });
    });

    test('with character_relationships_extended present, its rows are deleted in the same transaction', async () => {
      await run(`CREATE TABLE character_relationships_extended (id UUID PRIMARY KEY, character_id UUID, related_character_id UUID)`);
      try {
        const ids = await seedCharacter();
        seeded.push(ids);
        const other = uuid();
        await run(`INSERT INTO character_relationships_extended VALUES (:a, :world, :other), (:b, :other, :world), (:c, :other, :other)`,
          { a: uuid(), b: uuid(), c: uuid(), world: ids.world, other });

        const res = await request(app).delete(`/api/v1/world/characters/${ids.world}`).set('Authorization', auth());

        expect(res.status).toBe(200);
        expect(await remaining(ids)).toEqual({ world: 0, rc: 0, partner: 1, rel: 0, scene: 0 });
        expect(await count(`SELECT COUNT(*) AS n FROM character_relationships_extended WHERE character_id = :world OR related_character_id = :world`, ids)).toBe(0);
        expect(await count(`SELECT COUNT(*) AS n FROM character_relationships_extended`)).toBe(1);
      } finally {
        await run(`DROP TABLE IF EXISTS character_relationships_extended`);
      }
    });
  });
});
