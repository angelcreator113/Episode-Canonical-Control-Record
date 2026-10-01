/**
 * Season Arc build PR 1: the slots table and the read-only roadmap
 * (Evoni's rulings, 2026-10-01; docs/EVENT_EPISODE_FLOW.md §8(ff);
 * docs/SEASON_ARC_DESIGN_NOTE.md).
 *   A2. 24 slots in three phases, each slot showing its state: done, in
 *       production, event ready, needs an event.
 *   Q1. The existing "Soft Luxury Ascension" season is Season 1; the
 *       current episode is slot 1.
 *   Q2. Extend is removed.
 *   Q3. Shown "S1 · E7".
 *   Q4. Other existing episodes are listed for Evoni to place, not guessed.
 * On the test database, through the migration, seedArc and the route.
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
const { slotState } = require('../../src/services/seasonSlotService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Season Arc roadmap (§8(ff) PR 1)', () => {
  const shows = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  async function seedShow() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show, name: `Season ${show.slice(0, 8)}`, slug: `season-${show.slice(0, 8)}` });
    return show;
  }
  async function addEpisode(show, number, { accepted = false } = {}) {
    const id = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, evaluation_status, created_at, updated_at)
               VALUES (:id, :show, :title, :number, 'draft', :evaluation, NOW(), NOW())`,
      { id, show, title: `Episode ${number}`, number, evaluation: accepted ? 'accepted' : null });
    return id;
  }
  // An arc as it exists before this PR: seeded, with no slots.
  async function existingArc(show) {
    const id = uuid();
    const phases = [
      { phase: 1, title: 'Foundation', episode_start: 1, episode_end: 8, status: 'active' },
      { phase: 2, title: 'Ascension', episode_start: 9, episode_end: 16, status: 'upcoming' },
      { phase: 3, title: 'Legacy', episode_start: 17, episode_end: 24, status: 'upcoming' },
    ];
    await run(`INSERT INTO show_arcs (id, show_id, arc_number, title, season_number, episode_start, episode_end,
                 phases, current_phase, status, narrative_debt, progression_log, emotional_temperature, created_at, updated_at)
               VALUES (:id, :show, 1, 'Soft Luxury Ascension', 1, 1, 24, CAST(:phases AS jsonb), 1, 'active',
                 '[]', '[]', 'rising', NOW(), NOW())`, { id, show, phases: JSON.stringify(phases) });
    return id;
  }
  const slotsOf = (arcId) => rows(
    'SELECT slot_number, phase, episode_id, locked_at FROM season_slots WHERE arc_id = :arcId AND deleted_at IS NULL ORDER BY slot_number',
    { arcId });

  beforeAll(async () => {
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-season-roadmap', email: 'user@season-roadmap.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  afterAll(async () => {
    for (const show of shows) {
      await run('DELETE FROM season_slots WHERE show_id = :show', { show });
      await run('DELETE FROM show_arcs WHERE show_id = :show', { show });
      await run('DELETE FROM world_events WHERE show_id = :show', { show });
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
    await sequelize.close();
  });

  test('the migration gives an existing season 24 slots and puts the only episode in slot 1', async () => {
    const show = await seedShow();
    const episode = await addEpisode(show, 1);
    const arcId = await existingArc(show);

    await migration.up(sequelize.getQueryInterface(), Sequelize);

    const slots = await slotsOf(arcId);
    expect(slots).toHaveLength(24);
    expect(slots.map((s) => s.phase)).toEqual([...Array(8).fill(1), ...Array(8).fill(2), ...Array(8).fill(3)]);
    expect(slots[0].episode_id).toBe(episode);
    expect(slots[0].locked_at).not.toBeNull();
    expect(slots.slice(1).every((s) => s.episode_id === null)).toBe(true);

    // A re-run changes nothing.
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    expect(await slotsOf(arcId)).toHaveLength(24);
  });

  test('with several episodes, none is guessed into a slot; all are listed as not in a slot', async () => {
    const show = await seedShow();
    await addEpisode(show, 1);
    await addEpisode(show, 2);
    const arcId = await existingArc(show);

    await migration.up(sequelize.getQueryInterface(), Sequelize);

    expect((await slotsOf(arcId)).every((s) => s.episode_id === null)).toBe(true);
    const res = await auth(request(app).get(`/api/v1/world/${show}/season/roadmap`));
    expect(res.status).toBe(200);
    expect(res.body.roadmap.unslotted_episodes.map((e) => e.title)).toEqual(['Episode 1', 'Episode 2']);
  });

  test('seeding a new season creates its 24 empty slots', async () => {
    const show = await seedShow();

    const result = await seedArc(show, models);

    expect(result.slots).toBe(24);
    const slots = await slotsOf(result.arc_id);
    expect(slots).toHaveLength(24);
    expect(slots.every((s) => s.episode_id === null)).toBe(true);
  });

  test('the roadmap shows each slot as S1 · E<n> with its state', async () => {
    const show = await seedShow();
    const accepted = await addEpisode(show, 1, { accepted: true });
    const started = await addEpisode(show, 2);
    const { arc_id: arcId } = await seedArc(show, models);
    const event = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, created_at, updated_at)
               VALUES (:event, :show, 'Gala Night', 'invite', 'ready', NOW(), NOW())`, { event, show });
    await run('UPDATE season_slots SET episode_id = :accepted WHERE arc_id = :arcId AND slot_number = 1', { accepted, arcId });
    await run('UPDATE season_slots SET episode_id = :started WHERE arc_id = :arcId AND slot_number = 2', { started, arcId });
    await run('UPDATE season_slots SET event_id = :event WHERE arc_id = :arcId AND slot_number = 3', { event, arcId });

    const res = await auth(request(app).get(`/api/v1/world/${show}/season/roadmap`));

    expect(res.status).toBe(200);
    const { roadmap } = res.body;
    expect(roadmap.season_number).toBe(1);
    expect(roadmap.arc.title).toBe('Soft Luxury Ascension');
    expect(roadmap.phases.map((p) => [p.title, p.slots.length])).toEqual([['Foundation', 8], ['Ascension', 8], ['Legacy', 8]]);
    const slots = roadmap.phases.flatMap((p) => p.slots);
    expect(slots.slice(0, 4).map((s) => [s.label, s.state])).toEqual([
      ['S1 · E1', 'done'],
      ['S1 · E2', 'in_production'],
      ['S1 · E3', 'event_ready'],
      ['S1 · E4', 'needs_event'],
    ]);
    expect(slots[2].event.name).toBe('Gala Night');
    expect(slots[23].label).toBe('S1 · E24');
    expect(roadmap.counts).toEqual({ done: 1, in_production: 1, event_ready: 1, needs_event: 21 });
    expect(roadmap.unslotted_episodes).toEqual([]);
  });

  test('a show with no season gets a null roadmap', async () => {
    const show = await seedShow();
    const res = await auth(request(app).get(`/api/v1/world/${show}/season/roadmap`));
    expect(res.status).toBe(200);
    expect(res.body.roadmap).toBeNull();
  });

  test('the roadmap needs a signed-in user', async () => {
    const show = await seedShow();
    const res = await request(app).get(`/api/v1/world/${show}/season/roadmap`);
    expect(res.status).toBe(401);
  });

  test('Extend is gone: the season cannot grow past 24', async () => {
    const show = await seedShow();
    await seedArc(show, models);
    const res = await auth(request(app).post(`/api/v1/world/${show}/arc/extend`).send({ extend_by: 2 }));
    expect(res.status).toBe(404);
    const [arc] = await rows('SELECT episode_end FROM show_arcs WHERE show_id = :show', { show });
    expect(arc.episode_end).toBe(24);
  });

  test('slotState: an episode outranks a pencilled event', () => {
    expect(slotState({ episode: { evaluation_status: 'accepted' }, event: { id: 'e' } })).toBe('done');
    expect(slotState({ episode: { evaluation_status: null }, event: { id: 'e' } })).toBe('in_production');
    expect(slotState({ episode: null, event: { id: 'e' } })).toBe('event_ready');
    expect(slotState({ episode: null, event: null })).toBe('needs_event');
  });
});
