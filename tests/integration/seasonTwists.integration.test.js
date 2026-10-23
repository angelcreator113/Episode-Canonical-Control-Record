/**
 * Season twists (services/seasonTwists, routes in routes/arcRoutes;
 * 2026-10-23): a twist planted in one slot and paid off in a later one,
 * what is wrong with the list, delete and Undo, and the block the script
 * writer reads for the plant and the payoff episodes.
 *
 * The database is the local migrated test DB; nothing calls the AI.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { seedArc } = require('../../src/services/arcProgressionService');
const { twistsForEpisode, twistBlock } = require('../../src/services/seasonTwists');
const { loadScriptContext, storyContextBlocks } = require('../../src/services/episodeScriptWriterService');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('season twists', () => {
  const TAG = crypto.randomUUID().slice(0, 8);
  const ids = {
    show: crypto.randomUUID(), other: crypto.randomUUID(), reg: crypto.randomUUID(), maren: crypto.randomUUID(),
    thread: crypto.randomUUID(), ep1: crypto.randomUUID(), ep4: crypto.randomUUID(),
  };
  const slot = {};
  const otherSlot = {};
  let token;
  const base = `/api/v1/world/${ids.show}/season/twists`;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const put = (body, path = base) => auth(request(app).put(path)).send(body);

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-twists', email: 'evoni@twists.dev', name: 'Evoni', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    for (const show of [ids.show, ids.other]) {
      await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, CAST('{}' AS jsonb), NOW(), NOW())`,
        { show, name: `Twists ${show.slice(0, 8)}`, slug: `twists-${show.slice(0, 8)}` });
    }
    await seedArc(ids.show, models);
    await seedArc(ids.other, models);
    const [rows] = await run('SELECT id, slot_number FROM season_slots WHERE show_id = :show AND deleted_at IS NULL', ids);
    for (const r of rows) slot[r.slot_number] = r.id;
    const [others] = await run('SELECT id, slot_number FROM season_slots WHERE show_id = :other AND deleted_at IS NULL', ids);
    for (const r of others) otherSlot[r.slot_number] = r.id;
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES
               (:ep1, :show, 'The Brunch', 1, 'draft', NOW(), NOW()), (:ep4, :show, 'The Gala', 4, 'draft', NOW(), NOW())`, ids);
    await run('UPDATE season_slots SET episode_id = :ep1 WHERE id = :id', { ...ids, id: slot[1] });
    await run('UPDATE season_slots SET episode_id = :ep4 WHERE id = :id', { ...ids, id: slot[4] });
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, :title, :show, NOW(), NOW())`, { ...ids, title: `Twists ${TAG}` });
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, selected_name, role_type, status, created_at, updated_at)
               VALUES (:maren, :reg, :k, 'Maren', 'Maren', 'support', 'accepted', NOW(), NOW())`, { ...ids, k: `tw-${TAG}` });
    await run(`INSERT INTO show_story_threads (id, show_id, title, status, source, created_at, updated_at)
               VALUES (:thread, :show, 'The money', 'open', 'evoni', NOW(), NOW())`, ids);
  });

  afterAll(async () => {
    await run('DELETE FROM season_twists WHERE show_id IN (:show, :other)', ids);
    await run('DELETE FROM show_story_threads WHERE show_id = :show', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    for (const table of ['season_slots', 'show_arcs', 'career_goals']) await run(`DELETE FROM ${table} WHERE show_id IN (:show, :other)`, ids).catch(() => {});
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id IN (:show, :other)', ids);
    await sequelize.close();
  });

  it('the season, its threads and characters, and no twists yet', async () => {
    const res = await auth(request(app).get(base));
    expect(res.status).toBe(200);
    expect(res.body.slots).toHaveLength(24);
    expect(res.body.slots[0]).toMatchObject({ slot_number: 1, label: 'S1 · E1', episode: { id: ids.ep1, title: 'The Brunch' } });
    expect(res.body.threads.map((t) => t.title)).toEqual(['The money']);
    expect(res.body.characters).toEqual([{ id: ids.maren, name: 'Maren' }]);
    expect(res.body.twists).toEqual([]);
    expect((await request(app).get(base)).status).toBe(401);
    expect((await request(app).put(base).send({})).status).toBe(401);
  });

  it('adds a twist planted in E1 and paid off in E4, and changes it', async () => {
    let res = await put({
      title: 'The ring', description: 'Maren is not wearing it', plant_slot_id: slot[1], payoff_slot_id: slot[4],
      thread_ids: [ids.thread], character_ids: [ids.maren],
    });
    expect(res.status).toBe(200);
    const [ring] = res.body.twists;
    expect(ring).toMatchObject({
      title: 'The ring', status: 'planned', plant: { slot_number: 1, label: 'S1 · E1' }, payoff: { slot_number: 4, label: 'S1 · E4' },
      thread_ids: [ids.thread], character_ids: [ids.maren], planted_episode_id: null,
    });
    expect(res.body.warnings).toEqual([]);

    res = await put({ ...ring, status: 'planted', description: 'Maren hides her bare hand' }, `${base}/${ring.id}`);
    expect(res.status).toBe(200);
    expect(res.body.twists).toHaveLength(1);
    expect(res.body.twists[0]).toMatchObject({ status: 'planted', description: 'Maren hides her bare hand', planted_episode_id: ids.ep1 });
  });

  it('refuses what does not fit the season', async () => {
    expect((await put({ title: '', plant_slot_id: slot[2] })).status).toBe(400);
    const before = await put({ title: 'Backwards', plant_slot_id: slot[6], payoff_slot_id: slot[3] });
    expect(before.status).toBe(400);
    expect(before.body.error).toMatch(/payoff comes after the plant/);
    expect((await put({ title: 'Theirs', plant_slot_id: otherSlot[2] })).status).toBe(404);
    expect((await put({ title: 'x', plant_slot_id: slot[2], thread_ids: [crypto.randomUUID()] })).status).toBe(404);
    expect((await put({ title: 'x', plant_slot_id: slot[2], status: 'shouted' })).status).toBe(400);
    await run('UPDATE season_slots SET accepted_at = NOW() WHERE id = :id', { id: slot[2] });
    expect((await put({ title: 'Too late', plant_slot_id: slot[2] })).status).toBe(409);
    expect((await auth(request(app).delete(`${base}/${crypto.randomUUID()}`))).status).toBe(404);
  });

  it('warns about a payoff with no plant', async () => {
    let res = await put({ title: 'The rent', plant_slot_id: slot[3], payoff_slot_id: slot[5] });
    const rent = res.body.twists.find((t) => t.title === 'The rent');
    await run('UPDATE season_slots SET deleted_at = NOW() WHERE id = :id', { id: slot[3] });
    res = await auth(request(app).get(base));
    expect(res.body.warnings.map((w) => w.text)).toEqual(['"The rent" is paid off in S1 · E5 with no plant: its plant episode is no longer in the season.']);
    await run('UPDATE season_slots SET deleted_at = NULL WHERE id = :id', { id: slot[3] });
    // Deleting it is undone by restore.
    res = await auth(request(app).delete(`${base}/${rent.id}`));
    expect(res.status).toBe(200);
    expect(res.body.twists.some((t) => t.id === rent.id)).toBe(false);
    res = await auth(request(app).post(`${base}/${rent.id}/restore`));
    expect(res.status).toBe(200);
    expect(res.body.twists.find((t) => t.id === rent.id)).toMatchObject({ title: 'The rent', plant: { slot_number: 3 } });
    expect((await auth(request(app).post(`${base}/${rent.id}/restore`))).status).toBe(404);
  });

  it('the plant and the payoff episodes are told what to do', async () => {
    const atOne = await twistsForEpisode(sequelize, ids.ep1);
    expect(atOne.plant.map((t) => t.title)).toEqual(['The ring']);
    expect(atOne.payoff).toEqual([]);
    expect(await twistBlock(sequelize, ids.ep1)).toContain('PLANT (subtly; do not explain): The ring — Maren hides her bare hand (with Maren)');
    const atFour = await twistBlock(sequelize, ids.ep4);
    expect(atFour).toContain('PAY OFF: The ring — Maren hides her bare hand (planted in episode 1) (with Maren)');
    expect(atFour).not.toContain('PLANT (subtly');
    expect(await twistBlock(sequelize, crypto.randomUUID())).toBe('');

    const context = await loadScriptContext(ids.ep4, ids.show, models, { lite: true });
    expect(storyContextBlocks(context, { withSeason: false })).toContain('PAY OFF: The ring');
  });
});
