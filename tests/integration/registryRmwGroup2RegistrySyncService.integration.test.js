/**
 * F-Reg-2 fix group 2 (v1.2 R2), src/services/registrySyncService.js: row 74
 * of the scoping note's §3.4 (F-Reg-2_Fix_Plan_v1.0.md §4.2), the last file
 * in the table's order. registrySync.js was #2183.
 *
 * syncProfileToRegistry merges the profile's aesthetic_dna into the
 * character's only when the character has no visual_style. The test holds
 * the sync's first read of the character (linkedCharacter's findOne) until a
 * concurrent write has given the character a visual_style. On origin/main
 * the sync then writes its stale merge over that style; with the fix it
 * re-reads under a row lock and keeps it.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const models = require('../../src/models');
const { syncProfileToRegistry } = require('../../src/services/registrySyncService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

async function seed() {
  const ids = { reg: uuid(), rc: uuid(), name: `SyncSvc ${uuid().slice(0, 8)}` };
  const [[profile]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, aesthetic_dna, follower_tier, created_at, updated_at)
             VALUES (:handle, 'instagram', 'quiet luxury', CAST(:dna AS jsonb), 'micro', NOW(), NOW()) RETURNING id`,
  { handle: `@rmw_${ids.rc.slice(0, 8)}`, dna: JSON.stringify({ palette: 'cream', mood: 'soft' }) });
  ids.profile = profile.id;
  await run(`INSERT INTO character_registries (id, title, created_at, updated_at)
             VALUES (:reg, 'RMW registrySyncService registry', NOW(), NOW())`, ids);
  await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, selected_name, feed_profile_id, aesthetic_dna, created_at, updated_at)
             VALUES (:rc, :reg, :key, :name, :name, :profile, CAST('{}' AS jsonb), NOW(), NOW())`,
  { ...ids, key: `syncsvc-${ids.rc.slice(0, 8)}` });
  return ids;
}

// Hold the first RegistryCharacter.findOne after it returns, until `second()` has finished.
function interleave(second) {
  const original = models.RegistryCharacter.findOne.bind(models.RegistryCharacter);
  let first = true;
  jest.spyOn(models.RegistryCharacter, 'findOne').mockImplementation(async (...args) => {
    const result = await original(...args);
    if (first) {
      first = false;
      await second();
    }
    return result;
  });
}

(shouldSkip ? describe.skip : describe)('F-Reg-2 fix group 2, registrySyncService.js: an interleaved write is not lost', () => {
  const cleanups = [];
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    for (const fn of cleanups) await fn();
  });

  it('row 74: a visual style written while the sync is in flight survives the sync\'s aesthetic merge', async () => {
    const ids = await seed();
    cleanups.push(async () => {
      await run('DELETE FROM character_registries WHERE id = :reg', ids);
      await run('DELETE FROM social_profiles WHERE id = :profile', ids);
    });
    const profile = await models.SocialProfile.findByPk(ids.profile);

    // The concurrent write: the character gets its own visual style.
    interleave(() => run(`UPDATE registry_characters
      SET aesthetic_dna = CAST(:dna AS jsonb), updated_at = NOW() WHERE id = :rc`,
    { ...ids, dna: JSON.stringify({ visual_style: 'editorial noir' }) }));

    const result = await syncProfileToRegistry(profile, models);
    expect(result).toMatchObject({ synced: true, characterId: ids.rc });

    const [row] = await q('SELECT aesthetic_dna, social_presence, follower_tier FROM registry_characters WHERE id = :rc', ids);
    // The style the concurrent write set is kept; the profile's aesthetic is
    // not merged over a character that now has one (the rule the site applies).
    expect(row.aesthetic_dna).toEqual({ visual_style: 'editorial noir' });
    // The rest of the sync still lands.
    expect(row.social_presence).toBe(true);
    expect(row.follower_tier).toBe('micro');
  });

  it('a failed full update still falls back to the safe fields, inside the same transaction', async () => {
    const ids = await seed();
    cleanups.push(async () => {
      await run('DELETE FROM character_registries WHERE id = :reg', ids);
      await run('DELETE FROM social_profiles WHERE id = :profile', ids);
    });
    const profile = await models.SocialProfile.findByPk(ids.profile);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    // The first (full) update fails as a missing column would; the retry runs for real.
    const original = models.RegistryCharacter.prototype.update;
    jest.spyOn(models.RegistryCharacter.prototype, 'update')
      .mockImplementationOnce(async function failFirst(values, options) {
        await sequelize.query('SELECT no_such_column FROM registry_characters LIMIT 1', { transaction: options.transaction });
        return original.call(this, values, options);
      });

    const result = await syncProfileToRegistry(profile, models);
    expect(result.synced).toBe(true);
    expect(warn).toHaveBeenCalledWith('[RegistrySync] Full update failed, trying safe fields:', expect.any(String));
    const [row] = await q('SELECT social_presence, follower_tier, aesthetic_dna FROM registry_characters WHERE id = :rc', ids);
    expect(row).toMatchObject({ social_presence: true, follower_tier: 'micro', aesthetic_dna: {} });
  });

  it('with no concurrent write, the profile\'s aesthetic is merged as before', async () => {
    const ids = await seed();
    cleanups.push(async () => {
      await run('DELETE FROM character_registries WHERE id = :reg', ids);
      await run('DELETE FROM social_profiles WHERE id = :profile', ids);
    });
    const profile = await models.SocialProfile.findByPk(ids.profile);
    const result = await syncProfileToRegistry(profile, models);
    expect(result.synced).toBe(true);
    const [row] = await q('SELECT aesthetic_dna FROM registry_characters WHERE id = :rc', ids);
    expect(row.aesthetic_dna).toEqual({ palette: 'cream', mood: 'soft' });
  });
});
