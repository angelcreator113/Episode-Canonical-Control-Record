/**
 * The Season page's season switcher (Evoni, 2026-10-25, before Season 2):
 * GET .../arc lists every season of the show, and ?season=N reads that
 * season's arc, roadmap and Planning Insights instead of the one in
 * progress. A season of another show is never reached; a bad number is 400,
 * a missing season 404. requireAuth throughout.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('season switcher (?season=N)', () => {
  const shows = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-season-switcher', email: 'test@season-switcher.dev', name: 'Switcher',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    for (const show of shows) {
      await run('DELETE FROM season_slots WHERE show_id = :show', { show });
      await run('DELETE FROM show_arcs WHERE show_id = :show', { show });
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
  });

  // Season 1 complete (its episode in slot 1), Season 2 active (empty).
  async function seedShow() {
    const show = uuid();
    shows.push(show);
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())',
      { show, name: `Switcher ${show.slice(0, 8)}`, slug: `switcher-${show.slice(0, 8)}` });
    const phases = JSON.stringify([{ phase: 1, title: 'Only', episode_start: 1, episode_end: 2 }]);
    const arcs = {};
    for (const [n, status] of [[1, 'completed'], [2, 'active']]) {
      arcs[n] = uuid();
      await run(`INSERT INTO show_arcs (id, show_id, arc_number, title, season_number, episode_start, episode_end,
                   phases, current_phase, status, narrative_debt, progression_log, emotional_temperature, created_at, updated_at)
                 VALUES (:id, :show, :n, :title, :n, 1, 2, CAST(:phases AS jsonb), 1, :status, '[]', '[]', 'rising', NOW(), NOW())`,
        { id: arcs[n], show, n, title: `Season ${n} title`, status, phases });
    }
    const episode = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, season_number, created_at, updated_at)
               VALUES (:episode, :show, 'The first one', 1, 'published', 1, NOW(), NOW())`, { episode, show });
    for (const [n, arc] of [[1, arcs[1]], [2, arcs[2]]]) {
      for (const slot of [1, 2]) {
        await run(`INSERT INTO season_slots (id, show_id, arc_id, season_number, slot_number, phase, episode_id, created_at, updated_at)
                   VALUES (gen_random_uuid(), :show, :arc, :n, :slot, 1, :episode, NOW(), NOW())`,
          { show, arc, n, slot, episode: n === 1 && slot === 1 ? episode : null });
      }
    }
    return { show, arcs, episode };
  }

  it('needs a signed-in user', async () => {
    const { show } = await seedShow();
    expect((await request(app).get(`/api/v1/world/${show}/arc?season=1`)).status).toBe(401);
    expect((await request(app).get(`/api/v1/world/${show}/season/roadmap?season=1`)).status).toBe(401);
  });

  it('the arc lists every season and reads the one in progress by default', async () => {
    const { show, arcs } = await seedShow();
    const res = await auth(request(app).get(`/api/v1/world/${show}/arc`));
    expect(res.status).toBe(200);
    expect(res.body.arc.id).toBe(arcs[2]);
    expect(res.body.current_arc_id).toBe(arcs[2]);
    expect(res.body.seasons.map((x) => [x.season_number, x.status, x.title])).toEqual([[1, 'completed', 'Season 1 title'], [2, 'active', 'Season 2 title']]);
  });

  it('?season=1 reads Season 1: its arc, its roadmap with its episode, its insights', async () => {
    const { show, arcs, episode } = await seedShow();
    const arc = await auth(request(app).get(`/api/v1/world/${show}/arc?season=1`));
    expect(arc.body.arc).toMatchObject({ id: arcs[1], season_number: 1 });
    expect(arc.body.current_arc_id).toBe(arcs[2]);
    const roadmap = await auth(request(app).get(`/api/v1/world/${show}/season/roadmap?season=1`));
    expect(roadmap.status).toBe(200);
    expect(roadmap.body.roadmap).toMatchObject({ season_number: 1, arc: { id: arcs[1] } });
    expect(roadmap.body.roadmap.phases[0].slots[0].episode.id).toBe(episode);
    const current = await auth(request(app).get(`/api/v1/world/${show}/season/roadmap`));
    expect(current.body.roadmap).toMatchObject({ season_number: 2, arc: { id: arcs[2] } });
    const insights = await auth(request(app).get(`/api/v1/world/${show}/season/insights?season=1`));
    expect(insights.status).toBe(200);
    expect(insights.body.insights).toBeTruthy();
  });

  it('a bad season is 400, a missing one 404, and another show\'s season is never read', async () => {
    const { show } = await seedShow();
    const other = await seedShow();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect((await auth(request(app).get(`/api/v1/world/${show}/arc?season=two`))).status).toBe(400);
    expect((await auth(request(app).get(`/api/v1/world/${show}/season/roadmap?season=0`))).status).toBe(400);
    expect((await auth(request(app).get(`/api/v1/world/${show}/arc?season=3`))).status).toBe(404);
    expect((await auth(request(app).get(`/api/v1/world/${show}/season/roadmap?season=3`))).status).toBe(404);
    expect((await auth(request(app).get(`/api/v1/world/${show}/season/insights?season=9`))).status).toBe(404);
    const theirs = await auth(request(app).get(`/api/v1/world/${other.show}/season/roadmap?season=1`));
    expect(theirs.body.roadmap.arc.id).toBe(other.arcs[1]);
  });
});
