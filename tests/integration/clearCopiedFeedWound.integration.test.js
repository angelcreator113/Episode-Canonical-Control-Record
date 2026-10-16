/**
 * Migration 20261016060000: a crossed character's core_desire / core_wound
 * is cleared only while it is still the copy of its feed profile's
 * parasocial_function / what_it_costs_her (Evoni, 2026-10-16), and down puts
 * exactly those back. The database is the local migrated test DB.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const { sequelize } = require('../../src/models');
const migration = require('../../src/migrations/20261016060000-clear-copied-feed-wound');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('clear copied feed wound', () => {
  const TAG = crypto.randomUUID().slice(0, 8);
  const reg = crypto.randomUUID();
  const copied = crypto.randomUUID();
  const edited = crypto.randomUUID();
  let profileId;
  const qi = () => sequelize.getQueryInterface();
  const row = async (id) => (await run('SELECT core_desire, core_wound FROM registry_characters WHERE id = :id', { id }))[0][0];

  beforeAll(async () => {
    await migration.down(qi());
    await run(`INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:reg, :t, NOW(), NOW())`, { reg, t: `Wound ${TAG}` });
    const [[p]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, parasocial_function, what_it_costs_her, created_at, updated_at)
      VALUES (:h, 'instagram', 'test', 'real_world', 'She watches to feel seen', 'Her sleep', NOW(), NOW()) RETURNING id`, { h: `wound${TAG}` });
    profileId = p.id;
    const add = (id, desire, wound) => run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, role_type, status, feed_profile_id, core_desire, core_wound, created_at, updated_at)
      VALUES (:id, :reg, :key, :name, 'support', 'accepted', :pid, :desire, :wound, NOW(), NOW())`,
    { id, reg, key: `w-${crypto.randomUUID().slice(0, 8)}`, name: `W ${TAG}`, pid: profileId, desire, wound });
    await add(copied, 'She watches to feel seen', 'Her sleep');
    await add(edited, 'To own the room', 'Her sleep, and her mother');
  });

  afterAll(async () => {
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', { reg });
    await run('DELETE FROM character_registries WHERE id = :reg', { reg });
    await run('DELETE FROM social_profiles WHERE id = :id', { id: profileId });
    await migration.up(qi(), require('sequelize'));
    await sequelize.close();
  });

  it('clears only the unedited copies, and down restores them', async () => {
    await migration.up(qi(), require('sequelize'));
    expect(await row(copied)).toEqual({ core_desire: null, core_wound: null });
    expect(await row(edited)).toEqual({ core_desire: 'To own the room', core_wound: 'Her sleep, and her mother' });

    await migration.down(qi());
    expect(await row(copied)).toEqual({ core_desire: 'She watches to feel seen', core_wound: 'Her sleep' });
    expect(await row(edited)).toEqual({ core_desire: 'To own the room', core_wound: 'Her sleep, and her mother' });
  });
});
