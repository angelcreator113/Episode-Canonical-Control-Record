/**
 * Accepting an episode records the world temperature (Evoni, 2026-10-08:
 * "record it on episode accept"; wiring map, docs/reads/2026-10-06-
 * lalaverse-wiring-map.md §4, fix-list item 22). Nothing called
 * snapshotTemperature before, so the State tab's temperature never had a
 * reading.
 *
 * The reading is the show's universe's, and counts relationships between
 * the show's cast (its registries' characters): one volatile rivalry takes
 * the social domain to 100 and the reading from 27 to 48. A show with no
 * universe records the world's (universe_id null). A second Complete,
 * refused as already completed, records nothing.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const models = require('../../src/models');
const { completeEpisode } = require('../../src/services/episodeCompletionService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('the world temperature is recorded on episode accept', () => {
  const universe = uuid();
  const shows = [];
  const registries = [];
  const characters = [];
  let started;

  async function seedShow({ withUniverse }) {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, universe_id, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, :universe, CAST(:metadata AS jsonb), NOW(), NOW())`,
    { show, name: `Temp ${show.slice(0, 8)}`, slug: `temp-${show.slice(0, 8)}`, universe: withUniverse ? universe : null,
      metadata: JSON.stringify({ starting_balance: 1000 }) });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:id, :show, 'lala', 1000, 3, 3, 3, 2, NOW(), NOW())`, { id: uuid(), show });
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Pilot', 1, 'draft', NOW(), NOW())`, { ep, show });
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, cost_coins, prestige, created_at, updated_at)
               VALUES (:id, :show, 'Gala', 'used', :ep, 0, 5, NOW(), NOW())`, { id: uuid(), show, ep });
    return { show, ep };
  }

  const readings = (universeClause, replacements = {}) => q(
    `SELECT universe_id, metadata FROM world_state_snapshots
      WHERE snapshot_label = 'temperature_update' AND created_at >= :started AND ${universeClause}
      ORDER BY created_at`, { started, ...replacements });

  beforeAll(async () => {
    started = new Date(Date.now() - 1000);
    await run(`INSERT INTO universes (id, name, slug, created_at, updated_at) VALUES (:universe, 'Temp universe', :slug, NOW(), NOW())`,
      { universe, slug: `temp-uni-${universe.slice(0, 8)}` });
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (characters.length) await run('DELETE FROM character_relationships WHERE character_id_a IN (:ids) OR character_id_b IN (:ids)', { ids: characters });
    if (characters.length) await run('DELETE FROM registry_characters WHERE id IN (:ids)', { ids: characters });
    if (registries.length) await run('DELETE FROM character_registries WHERE id IN (:ids)', { ids: registries });
    await run(`DELETE FROM world_state_snapshots WHERE snapshot_label = 'temperature_update' AND created_at >= :started`, { started });
    for (const show of shows) {
      await run('DELETE FROM franchise_knowledge WHERE show_id = :show', { show });
      for (const t of ['feed_posts', 'financial_transactions', 'character_state_history', 'character_state', 'world_events', 'episodes']) {
        await run(`DELETE FROM ${t} WHERE show_id = :show`, { show });
      }
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
    await run('DELETE FROM universes WHERE id = :universe', { universe });
  });

  it('records the universe\'s reading, counting the show\'s cast; a second Complete records nothing', async () => {
    const { show, ep } = await seedShow({ withUniverse: true });
    const reg = uuid();
    registries.push(reg);
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Cast', :show, NOW(), NOW())`, { reg, show });
    const [a, b] = [uuid(), uuid()];
    characters.push(a, b);
    for (const [id, key] of [[a, 'temp-a'], [b, 'temp-b']]) {
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, created_at, updated_at)
                 VALUES (:id, :reg, :key, :key, NOW(), NOW())`, { id, reg, key: `${key}-${reg.slice(0, 6)}` });
    }
    await run(`INSERT INTO character_relationships (id, character_id_a, character_id_b, relationship_type, tension_state, created_at, updated_at)
               VALUES (:id, :a, :b, 'rival', 'volatile', NOW(), NOW())`, { id: uuid(), a, b });

    await completeEpisode(ep, show, sequelize);
    const rows = await readings('universe_id = :universe', { universe });
    expect(rows).toHaveLength(1);
    expect(rows[0].metadata.world_temperature.value).toBe(48);

    const again = await completeEpisode(ep, show, sequelize);
    expect(again.already_completed).toBe(true);
    expect(await readings('universe_id = :universe', { universe })).toHaveLength(1);
  });

  it('a show with no universe records the world\'s reading', async () => {
    const { show, ep } = await seedShow({ withUniverse: false });
    const before = (await readings('universe_id IS NULL')).length;
    await completeEpisode(ep, show, sequelize);
    const rows = await readings('universe_id IS NULL');
    expect(rows).toHaveLength(before + 1);
    expect(typeof rows.at(-1).metadata.world_temperature.value).toBe('number');
  });
});
