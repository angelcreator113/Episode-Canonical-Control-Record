/**
 * Season Arc build PR 3 (Evoni's ruling A5, 2026-10-01;
 * docs/EVENT_EPISODE_FLOW.md §8(ff)): "Start Episode snapshots the season
 * context onto the episode. The Overview shows its season position and
 * purpose, and the script generator receives that context."
 * On the test database: the backfill migration, Start Episode, placement,
 * the episode API, and both script generators' prompts.
 */
jest.unmock('uuid');

const { Sequelize } = require('sequelize');
const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const slotsMigration = require('../../src/migrations/20261001230000-create-season-slots');
const contextMigration = require('../../src/migrations/20261001240000-add-episode-season-context');
const { seedArc } = require('../../src/services/arcProgressionService');
const { loadScriptContext, buildFullPrompt } = require('../../src/services/episodeScriptWriterService');
const { buildScriptPrompt } = require('../../src/services/groundedScriptGeneratorService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Season context on the episode (§8(ff) A5, PR 3)', () => {
  const shows = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  async function seedShow() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show, name: `Context ${show.slice(0, 8)}`, slug: `context-${show.slice(0, 8)}` });
    return show;
  }
  const slotId = async (arcId, n) => (await rows(
    'SELECT id FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0].id;
  const contextOf = async (episodeId) => (await rows(
    'SELECT season_context, season_number FROM episodes WHERE id = :episodeId', { episodeId }))[0];
  const briefOf = async (episodeId) => (await rows(
    'SELECT arc_number, position_in_arc FROM episode_briefs WHERE episode_id = :episodeId AND deleted_at IS NULL', { episodeId }))[0];

  beforeAll(async () => {
    await slotsMigration.up(sequelize.getQueryInterface(), Sequelize);
    await contextMigration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-season-context', email: 'user@season-context.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  afterAll(async () => {
    for (const show of shows) {
      await run('DELETE FROM season_slots WHERE show_id = :show', { show });
      await run('DELETE FROM show_arcs WHERE show_id = :show', { show });
      await run(`DELETE FROM episode_spending_lines WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)`, { show });
      await run(`DELETE FROM episode_briefs WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)`, { show });
      await run('UPDATE world_events SET used_in_episode_id = NULL WHERE show_id = :show', { show });
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM world_events WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
    await sequelize.close();
  });

  test('the migration snapshots an episode already in a slot (the current episode in slot 1)', async () => {
    const show = await seedShow();
    const { arc_id: arcId } = await seedArc(show, models);
    const episode = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:episode, :show, 'Current', 2, 'draft', NOW(), NOW())`, { episode, show });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, created_at, updated_at)
               VALUES (:id, :episode, :show, NOW(), NOW())`, { id: uuid(), episode, show });
    await run('UPDATE season_slots SET episode_id = :episode, locked_at = NOW() WHERE arc_id = :arcId AND slot_number = 1', { episode, arcId });

    await contextMigration.up(sequelize.getQueryInterface(), Sequelize);

    const { season_context: sc, season_number: season } = await contextOf(episode);
    expect(season).toBe(1);
    expect(sc).toEqual(expect.objectContaining({
      label: 'S1 · E1', slot_number: 1, season_number: 1, arc_title: 'Soft Luxury Ascension', position_in_phase: 1,
    }));
    expect(sc.phase).toEqual(expect.objectContaining({ number: 1, title: 'Foundation', tagline: 'Prove you belong' }));
    expect(await briefOf(episode)).toEqual({ arc_number: 1, position_in_arc: 1 });
  });

  test('Start Episode snapshots the slot it takes, with its intention, and the episode API returns it', async () => {
    const show = await seedShow();
    const { arc_id: arcId } = await seedArc(show, models);
    const event = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, created_at, updated_at)
               VALUES (:event, :show, 'Ascension Gala', 'invite', 'ready', NOW(), NOW())`, { event, show });
    await run(`UPDATE season_slots SET event_id = :event, story_purpose = 'Lala is outclassed and refuses to show it',
                 career_focus = 'reputation', desired_pressure = 'High', intention_source = 'edited'
               WHERE arc_id = :arcId AND slot_number = 10`, { event, arcId });

    const res = await auth(request(app).post(`/api/v1/world/${show}/events/${event}/generate-episode`)).send({ draft_script: false });

    expect(res.status).toBe(201);
    const episodeId = res.body.data?.episode?.id || res.body.episode?.id;
    const { season_context: sc, season_number: season } = await contextOf(episodeId);
    expect(season).toBe(1);
    expect(sc).toEqual(expect.objectContaining({
      label: 'S1 · E10', slot_number: 10, position_in_phase: 2,
      story_purpose: 'Lala is outclassed and refuses to show it', career_focus: 'reputation', desired_pressure: 'High',
    }));
    expect(sc.phase).toEqual(expect.objectContaining({ number: 2, title: 'Ascension' }));
    expect(await briefOf(episodeId)).toEqual({ arc_number: 2, position_in_arc: 2 });

    const got = await auth(request(app).get(`/api/v1/episodes/${episodeId}`));
    expect(got.status).toBe(200);
    expect(got.body.data.season_context.label).toBe('S1 · E10');
  });

  test('placing an episode in a slot snapshots it too', async () => {
    const show = await seedShow();
    const { arc_id: arcId } = await seedArc(show, models);
    const episode = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:episode, :show, 'Left over', 1, 'draft', NOW(), NOW())`, { episode, show });

    const res = await auth(request(app).put(`/api/v1/world/${show}/season/slots/${await slotId(arcId, 17)}/episode`)).send({ episode_id: episode });

    expect(res.status).toBe(200);
    const { season_context: sc } = await contextOf(episode);
    expect([sc.label, sc.phase.title, sc.position_in_phase]).toEqual(['S1 · E17', 'Legacy', 1]);
  });

  test('the script writer and the grounded script both receive the season position', async () => {
    const show = await seedShow();
    const { arc_id: arcId } = await seedArc(show, models);
    const episode = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:episode, :show, 'Scripted', 1, 'draft', NOW(), NOW())`, { episode, show });
    await run(`UPDATE season_slots SET story_purpose = 'Lala proves she belongs in the room' WHERE arc_id = :arcId AND slot_number = 3`, { arcId });
    await auth(request(app).put(`/api/v1/world/${show}/season/slots/${await slotId(arcId, 3)}/episode`)).send({ episode_id: episode });

    const context = await loadScriptContext(episode, show, models);
    expect(context.seasonPosition.label).toBe('S1 · E3');
    const prompt = buildFullPrompt(context);
    expect(prompt).toContain('═══ SEASON POSITION ═══');
    expect(prompt).toContain('S1 · E3 — Phase 1: Foundation, episode 3 of the phase');
    expect(prompt).toContain('Story purpose: Lala proves she belongs in the room');

    const grounded = buildScriptPrompt({
      brief: await briefOf(episode), scenePlan: [], franchiseLaws: [], eventData: null, wardrobeItems: [],
      lalaStats: null, outfitScore: null, seasonContext: context.seasonPosition,
    });
    expect(grounded).toContain('Season position: S1 · E3, Phase 1: Foundation');
    expect(grounded).toContain('Season story purpose: Lala proves she belongs in the room');
  });

  test('an episode with no season context gets no SEASON POSITION block', async () => {
    const show = await seedShow();
    const episode = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:episode, :show, 'Unslotted', 1, 'draft', NOW(), NOW())`, { episode, show });

    const context = await loadScriptContext(episode, show, models);

    expect(context.seasonPosition).toBeNull();
    expect(buildFullPrompt(context)).not.toContain('SEASON POSITION');
  });
});
