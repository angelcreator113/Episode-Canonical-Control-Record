/**
 * The world as the script writers see it (Evoni, 2026-10-18), against the
 * database: a show's newest world snapshot gives its facts, its newest
 * temperature readings give the temperature and its trend, read the way
 * loadScriptContext reads them.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const { sequelize } = require('../../src/models');
const { latestWorldSnapshotForShow } = require('../../src/services/worldSnapshotForShow');
const { worldNowForShow } = require('../../src/services/worldNow');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('the world now, for a show', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const ids = { show: crypto.randomUUID(), universe: crypto.randomUUID() };
  const snaps = [];

  beforeAll(async () => {
    await run("INSERT INTO universes (id, name, slug, created_at, updated_at) VALUES (:universe, :name, :slug, NOW(), NOW())", { ...ids, name: `World ${tag}`, slug: `world-${tag}` });
    await run('INSERT INTO shows (id, name, slug, universe_id, created_at, updated_at) VALUES (:show, :name, :slug, :universe, NOW(), NOW())', { ...ids, name: `World ${tag}`, slug: `world-${tag}` });
    const snap = async (label, facts, metadata, minutes) => {
      const [[row]] = await run(`INSERT INTO world_state_snapshots (id, universe_id, snapshot_label, world_facts, metadata, created_at, updated_at)
        VALUES (gen_random_uuid(), :universe, :label, CAST(:facts AS jsonb), CAST(:metadata AS jsonb), NOW() + make_interval(mins => :minutes), NOW()) RETURNING id`,
      { universe: ids.universe, label, facts: JSON.stringify(facts), metadata: JSON.stringify(metadata), minutes });
      snaps.push(row.id);
    };
    await snap('temperature_update', [], { world_temperature: { value: 45 } }, 1);
    await snap(`State ${tag}`, [`Glow Week is cancelled ${tag}`], {}, 2);
    await snap('temperature_update', [`Glow Week is cancelled ${tag}`], { world_temperature: { value: 68 } }, 3);
  });

  afterAll(async () => {
    await run('DELETE FROM world_state_snapshots WHERE id IN (:snaps)', { snaps });
    await run('DELETE FROM shows WHERE id = :show', ids);
    await run('DELETE FROM universes WHERE id = :universe', ids);
    await sequelize.close();
  });

  it('carries the State tab\'s facts and the newest temperature with its trend', async () => {
    const snapshot = await latestWorldSnapshotForShow(sequelize, ids.show);
    const block = await worldNowForShow(sequelize, ids.show, snapshot);
    expect(block).toContain(`- Glow Week is cancelled ${tag}`);
    expect(block).toContain('World temperature: 68/100, HOT, rising fast since the last episode.');
  });
});
