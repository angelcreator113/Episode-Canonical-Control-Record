/**
 * Season Arc build PR 2: pencilling and assignment (Evoni's rulings and
 * answers, 2026-10-01; docs/EVENT_EPISODE_FLOW.md §8(ff)).
 *   Q5. "an event can be pencilled into a future slot and moved freely; it
 *       locks at Start Episode."
 *   A7. "Only future slots can be reordered or re-planned; a slot whose
 *       episode has started is locked to that episode."
 *   Q4. Existing episodes in no slot are listed for Evoni to place.
 * On the test database, through the slot routes and Start Episode.
 */
jest.unmock('uuid');

const { Sequelize } = require('sequelize');
const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const migration = require('../../src/migrations/20261001230000-create-season-slots');
const { seedArc } = require('../../src/services/arcProgressionService');
const { assignOnStart } = require('../../src/services/seasonSlotService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Season Arc pencilling and assignment (§8(ff) PR 2)', () => {
  const shows = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  async function seedSeason() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show, name: `Pencil ${show.slice(0, 8)}`, slug: `pencil-${show.slice(0, 8)}` });
    const { arc_id: arcId } = await seedArc(show, models);
    return { show, arcId };
  }
  async function addEvent(show, name, { status = 'draft', usedIn = null } = {}) {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, used_in_episode_id, created_at, updated_at)
               VALUES (:id, :show, :name, 'invite', :status, :usedIn, NOW(), NOW())`, { id, show, name, status, usedIn });
    return id;
  }
  async function addEpisode(show, title) {
    const id = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:id, :show, :title, 1, 'draft', NOW(), NOW())`, { id, show, title });
    return id;
  }
  const slotId = async (arcId, n) => (await rows(
    'SELECT id FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0].id;
  const slot = async (arcId, n) => (await rows(
    'SELECT event_id, episode_id, locked_at FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0];
  const pencil = (show, id, eventId) => auth(request(app).put(`/api/v1/world/${show}/season/slots/${id}/event`)).send({ event_id: eventId });
  const placeIn = (show, id, episodeId) => auth(request(app).put(`/api/v1/world/${show}/season/slots/${id}/episode`)).send({ episode_id: episodeId });
  const roadmap = async (show) => (await auth(request(app).get(`/api/v1/world/${show}/season/roadmap`))).body.roadmap;
  const startEpisode = (show, eventId) => auth(request(app).post(`/api/v1/world/${show}/events/${eventId}/generate-episode`)).send({ draft_script: false });

  beforeAll(async () => {
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-season-pencil', email: 'user@season-pencil.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
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

  test('pencilling an event makes the slot "event ready" and takes it off the available list', async () => {
    const { show, arcId } = await seedSeason();
    const event = await addEvent(show, 'Rooftop Launch');
    expect((await roadmap(show)).available_events.map((e) => e.name)).toEqual(['Rooftop Launch']);

    const res = await pencil(show, await slotId(arcId, 4), event);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ slot_number: 4, event_id: event, moved_from: null }));
    const map = await roadmap(show);
    const s4 = map.phases[0].slots[3];
    expect([s4.label, s4.state, s4.event.name]).toEqual(['S1 · E4', 'event_ready', 'Rooftop Launch']);
    expect(map.available_events).toEqual([]);
  });

  test('an event moves freely between future slots, and can be cleared', async () => {
    const { show, arcId } = await seedSeason();
    const event = await addEvent(show, 'Gallery Night');
    await pencil(show, await slotId(arcId, 3), event);

    const moved = await pencil(show, await slotId(arcId, 10), event);

    expect(moved.status).toBe(200);
    expect(moved.body.moved_from).toBe(3);
    expect((await slot(arcId, 3)).event_id).toBeNull();
    expect((await slot(arcId, 10)).event_id).toBe(event);

    const cleared = await pencil(show, await slotId(arcId, 10), null);
    expect(cleared.status).toBe(200);
    expect((await slot(arcId, 10)).event_id).toBeNull();
  });

  test('pencilling over another event replaces it and says which', async () => {
    const { show, arcId } = await seedSeason();
    const first = await addEvent(show, 'First');
    const second = await addEvent(show, 'Second');
    await pencil(show, await slotId(arcId, 5), first);

    const res = await pencil(show, await slotId(arcId, 5), second);

    expect(res.status).toBe(200);
    expect(res.body.replaced_event_id).toBe(first);
    expect((await roadmap(show)).available_events.map((e) => e.name)).toEqual(['First']);
  });

  test('only a draft or ready event of this show can be pencilled', async () => {
    const { show, arcId } = await seedSeason();
    const other = await seedSeason();
    const archived = await addEvent(show, 'Archived', { status: 'archived' });
    const usedEpisode = await addEpisode(show, 'Used');
    const used = await addEvent(show, 'Used', { status: 'used', usedIn: usedEpisode });
    const foreign = await addEvent(other.show, 'Elsewhere');
    const id = await slotId(arcId, 2);

    expect((await pencil(show, id, archived)).status).toBe(409);
    expect((await pencil(show, id, used)).status).toBe(409);
    expect((await pencil(show, id, foreign)).status).toBe(404);
    expect((await slot(arcId, 2)).event_id).toBeNull();
  });

  test('a started slot is locked: no pencil, no placement', async () => {
    const { show, arcId } = await seedSeason();
    const episode = await addEpisode(show, 'Placed');
    const event = await addEvent(show, 'Late idea');
    const id = await slotId(arcId, 1);
    expect((await placeIn(show, id, episode)).status).toBe(200);

    const pencilled = await pencil(show, id, event);
    const placedAgain = await placeIn(show, id, await addEpisode(show, 'Another'));

    expect(pencilled.status).toBe(409);
    expect(pencilled.body.code).toBe('SEASON_SLOT_LOCKED');
    expect(placedAgain.status).toBe(409);
    const s1 = await slot(arcId, 1);
    expect(s1.episode_id).toBe(episode);
    expect(s1.event_id).toBeNull();
  });

  test('an episode in no slot can be placed once, and the slot locks to it', async () => {
    const { show, arcId } = await seedSeason();
    const episode = await addEpisode(show, 'Left over');
    expect((await roadmap(show)).unslotted_episodes.map((e) => e.title)).toEqual(['Left over']);

    const res = await placeIn(show, await slotId(arcId, 6), episode);

    expect(res.status).toBe(200);
    const s6 = await slot(arcId, 6);
    expect(s6.episode_id).toBe(episode);
    expect(s6.locked_at).not.toBeNull();
    const map = await roadmap(show);
    expect(map.unslotted_episodes).toEqual([]);
    expect(map.phases[0].slots[5].state).toBe('in_production');

    const again = await placeIn(show, await slotId(arcId, 7), episode);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('SEASON_EPISODE_PLACED');
  });

  test('Start Episode locks the slot the event is pencilled into', async () => {
    const { show, arcId } = await seedSeason();
    const event = await addEvent(show, 'Pencilled Gala', { status: 'ready' });
    await pencil(show, await slotId(arcId, 5), event);

    const res = await startEpisode(show, event);

    expect(res.status).toBe(201);
    const episodeId = res.body.data?.episode?.id || res.body.episode?.id;
    expect(episodeId).toBeTruthy();
    const s5 = await slot(arcId, 5);
    expect(s5.episode_id).toBe(episodeId);
    expect(s5.event_id).toBe(event);
    expect(s5.locked_at).not.toBeNull();
    expect((await slot(arcId, 1)).episode_id).toBeNull();
  });

  test('Start Episode on an event in no slot takes the earliest open slot', async () => {
    const { show, arcId } = await seedSeason();
    const pencilled = await addEvent(show, 'Saved for E1');
    await pencil(show, await slotId(arcId, 1), pencilled);
    const event = await addEvent(show, 'Walk-in', { status: 'ready' });

    const res = await startEpisode(show, event);

    expect(res.status).toBe(201);
    expect((await slot(arcId, 1)).episode_id).toBeNull();
    const s2 = await slot(arcId, 2);
    expect(s2.event_id).toBe(event);
    expect(s2.locked_at).not.toBeNull();
    expect((await roadmap(show)).phases[0].slots[1].state).toBe('in_production');
  });

  test('a regenerate keeps the slot, now on the new episode', async () => {
    const { show, arcId } = await seedSeason();
    const event = await addEvent(show, 'Redo');
    const oldEpisode = await addEpisode(show, 'Old');
    const newEpisode = await addEpisode(show, 'New');
    await placeIn(show, await slotId(arcId, 3), oldEpisode);

    const slotNumber = await sequelize.transaction((transaction) => assignOnStart(sequelize, {
      showId: show, eventId: event, episodeId: newEpisode, replacingEpisodeId: oldEpisode, transaction,
    }));

    expect(slotNumber).toBe(3);
    expect((await slot(arcId, 3)).episode_id).toBe(newEpisode);
  });

  test('Start Episode still works for a show with no season', async () => {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show, name: `No season ${show.slice(0, 8)}`, slug: `noseason-${show.slice(0, 8)}` });
    const event = await addEvent(show, 'No season event', { status: 'ready' });

    const res = await startEpisode(show, event);

    expect(res.status).toBe(201);
  });
});
