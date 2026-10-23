/**
 * The "What changed" card and season twists (Evoni, 2026-10-23): the card
 * lists the twists due in the episode, and Save marks a kept one planted
 * (or paid off) in that episode, once, never moving it back
 * (services/episodeStoryRecord approveRecord, services/seasonTwists).
 *
 * The database is the local migrated test DB; no AI call is made.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const models = require('../../src/models');
const { seedArc } = require('../../src/services/arcProgressionService');
const { setTwist } = require('../../src/services/seasonTwists');
const { getRecord, approveRecord } = require('../../src/services/episodeStoryRecord');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('What changed: season twists', () => {
  const ids = { show: crypto.randomUUID(), ep1: crypto.randomUUID(), ep4: crypto.randomUUID() };
  const slot = {};
  let twistId;

  beforeAll(async () => {
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, CAST('{}' AS jsonb), NOW(), NOW())`,
      { show: ids.show, name: `WC Twists ${ids.show.slice(0, 8)}`, slug: `wc-twists-${ids.show.slice(0, 8)}` });
    await seedArc(ids.show, models);
    const [rows] = await run('SELECT id, slot_number FROM season_slots WHERE show_id = :show AND deleted_at IS NULL', ids);
    for (const r of rows) slot[r.slot_number] = r.id;
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, created_at, updated_at) VALUES
               (:ep1, :show, 'The Brunch', 1, 'draft', 'LALA: Whose ring is that on the mirror?', NOW(), NOW()),
               (:ep4, :show, 'The Gala', 4, 'draft', 'MAREN: It was my mother''s ring.', NOW(), NOW())`, ids);
    await run('UPDATE season_slots SET episode_id = :ep1 WHERE id = :id', { ...ids, id: slot[1] });
    await run('UPDATE season_slots SET episode_id = :ep4 WHERE id = :id', { ...ids, id: slot[4] });
    const out = await setTwist(sequelize, ids.show, { title: 'The ring on the mirror', plant_slot_id: slot[1], payoff_slot_id: slot[4] });
    twistId = out.twists[0].id;
  });

  afterAll(async () => {
    await run('DELETE FROM episode_story_records WHERE episode_id IN (:ep1, :ep4)', ids);
    await run('DELETE FROM season_twists WHERE show_id = :show', ids);
    for (const table of ['season_slots', 'show_arcs', 'career_goals']) await run(`DELETE FROM ${table} WHERE show_id = :show`, ids).catch(() => {});
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  const record = (episodeId, twists) => run(
    `INSERT INTO episode_story_records (episode_id, show_id, status, what_happened, twists, created_at, updated_at)
     VALUES (:episodeId, :show, 'draft', 'Something happened.', CAST(:twists AS jsonb), NOW(), NOW())`,
    { episodeId, show: ids.show, twists: JSON.stringify(twists) });
  const statusOf = async () => (await run('SELECT status, planted_episode_id, paid_off_episode_id FROM season_twists WHERE id = :id', { id: twistId }))[0][0];

  it('lists the twist due: planted in episode 1, paid off in episode 4', async () => {
    expect((await getRecord(sequelize, ids.ep1)).twists).toEqual([
      expect.objectContaining({ id: twistId, title: 'The ring on the mirror', what: 'planted' }),
    ]);
    expect((await getRecord(sequelize, ids.ep4)).twists).toEqual([
      expect.objectContaining({ id: twistId, what: 'paid_off' }),
    ]);
  });

  it('Save plants it in episode 1, once', async () => {
    await record(ids.ep1, [{ twist_id: twistId, title: 'The ring on the mirror', what: 'planted', beat: 2, keep: true }]);
    const out = await approveRecord(sequelize, ids.ep1, { by: 'evoni' });
    expect(out.result.written).toEqual([{ kind: 'twist', text: 'Twist planted: The ring on the mirror (beat 2)' }]);
    expect(await statusOf()).toEqual({ status: 'planted', planted_episode_id: ids.ep1, paid_off_episode_id: null });
    expect((await approveRecord(sequelize, ids.ep1, { by: 'evoni' })).result.written).toEqual([]);
  });

  it('Save pays it off in episode 4, and planting it again never moves it back', async () => {
    await record(ids.ep4, [{ twist_id: twistId, title: 'The ring on the mirror', what: 'paid_off', keep: true }]);
    const out = await approveRecord(sequelize, ids.ep4, { by: 'evoni' });
    expect(out.result.written).toEqual([{ kind: 'twist', text: 'Twist paid off: The ring on the mirror' }]);
    expect(await statusOf()).toEqual({ status: 'paid_off', planted_episode_id: ids.ep1, paid_off_episode_id: ids.ep4 });
    // Episode 1 read again and saved again: the twist stays paid off.
    await run(`UPDATE episode_story_records SET applied = '{}'::jsonb WHERE episode_id = :ep1`, ids);
    expect((await approveRecord(sequelize, ids.ep1, { by: 'evoni' })).result.written).toEqual([]);
    expect((await statusOf()).status).toBe('paid_off');
  });
});
