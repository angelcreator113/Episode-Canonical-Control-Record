/**
 * The show's release schedule routes (routes/releaseScheduleRoutes; Evoni,
 * 2026-10-25): saving keeps every other distribution_defaults key and
 * refuses bad input; the preview saves nothing and lists what moves; an
 * episode's own date is set by hand and cleared back to the schedule; the
 * platform defaults save keeps the schedule. Every route is requireAuth.
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
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

const SCHEDULE = { day: 'sun', time: '10:00', cadence: 'weekly', first_release: '2026-11-01', tz_offset: 240, tz: 'America/New_York' };

(shouldSkip ? describe.skip : describe)('release schedule routes', () => {
  const shows = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-release-schedule', email: 'test@release-schedule.dev', name: 'Release Schedule',
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

  async function seedShow() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, distribution_defaults, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST(:defaults AS jsonb), NOW(), NOW())`,
      { show, name: `Release ${show.slice(0, 8)}`, slug: `release-${show.slice(0, 8)}`,
        defaults: JSON.stringify({ youtube: { enabled: true, default_hashtags: ['#lala'] } }) });
    const eps = {};
    for (const [n, air] of [[1, null], [2, '2026-11-22'], [3, null], [4, null]]) {
      const id = uuid();
      eps[n] = id;
      await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, air_date, created_at, updated_at)
                 VALUES (:id, :show, :title, :n, 'draft', ${air ? "(CAST(:air AS date)::timestamp AT TIME ZONE 'UTC')" : 'NULL'}, NOW(), NOW())`,
        { id, show, title: `Episode ${n}`, n, air });
    }
    return { show, eps };
  }
  const defaultsOf = async (show) => (await rows('SELECT distribution_defaults FROM shows WHERE id = :show', { show }))[0].distribution_defaults;
  const airOf = async (id) => (await rows("SELECT to_char(air_date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d FROM episodes WHERE id = :id", { id }))[0].d;

  it('every route needs a signed-in user (401)', async () => {
    const { show, eps } = await seedShow();
    expect((await request(app).get(`/api/v1/world/${show}/release-schedule`)).status).toBe(401);
    expect((await request(app).put(`/api/v1/world/${show}/release-schedule`).send({ release_schedule: SCHEDULE })).status).toBe(401);
    expect((await request(app).post(`/api/v1/world/${show}/release-schedule/preview`).send({ release_schedule: SCHEDULE })).status).toBe(401);
    expect((await request(app).put(`/api/v1/world/${show}/episodes/${eps[1]}/release-date`).send({ air_date: null })).status).toBe(401);
    expect((await defaultsOf(show)).release_schedule).toBeUndefined();
  });

  it('with no schedule nothing changes: only the hand-set date, and the Sunday 10:00 suggestion', async () => {
    const { show, eps } = await seedShow();
    const res = await auth(request(app).get(`/api/v1/world/${show}/release-schedule`));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ state: 'unset', schedule: null, suggestion: { day: 'sun', time: '10:00' } });
    const dated = res.body.data.episodes.filter((e) => e.date);
    expect(dated).toEqual([expect.objectContaining({ episode_id: eps[2], date: '2026-11-22', source: 'hand' })]);
  });

  it('saving keeps the other distribution_defaults keys and writes no air_date', async () => {
    const { show, eps } = await seedShow();
    const res = await auth(request(app).put(`/api/v1/world/${show}/release-schedule`)).send({ release_schedule: SCHEDULE });
    expect(res.status).toBe(200);
    const saved = await defaultsOf(show);
    expect(saved.youtube).toEqual({ enabled: true, default_hashtags: ['#lala'] });
    expect(saved.release_schedule).toMatchObject({ day: 'sun', time: '10:00', first_release: '2026-11-01', tz: 'America/New_York' });
    const byId = Object.fromEntries(res.body.data.episodes.map((e) => [e.episode_id, e]));
    expect(byId[eps[1]]).toMatchObject({ date: '2026-11-01', time: '10:00', source: 'schedule' });
    expect(byId[eps[2]]).toMatchObject({ date: '2026-11-22', source: 'hand' });
    expect(byId[eps[3]]).toMatchObject({ date: '2026-11-29', source: 'schedule' });
    expect(await airOf(eps[1])).toBeNull();
    expect(await airOf(eps[3])).toBeNull();
  });

  it('refuses a bad schedule with 400 and saves nothing', async () => {
    const { show } = await seedShow();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    for (const bad of [undefined, { ...SCHEDULE, day: 'funday' }, { ...SCHEDULE, time: '10am' }, { ...SCHEDULE, first_release: 'soon' }]) {
      const res = await auth(request(app).put(`/api/v1/world/${show}/release-schedule`)).send({ release_schedule: bad });
      expect(res.status).toBe(400);
    }
    expect((await defaultsOf(show)).release_schedule).toBeUndefined();
  });

  it('the preview saves nothing and lists the schedule dates that move; hand-set ones stay', async () => {
    const { show, eps } = await seedShow();
    await auth(request(app).put(`/api/v1/world/${show}/release-schedule`)).send({ release_schedule: SCHEDULE });
    const res = await auth(request(app).post(`/api/v1/world/${show}/release-schedule/preview`))
      .send({ release_schedule: { ...SCHEDULE, day: 'sat', first_release: '2026-11-07' } });
    expect(res.status).toBe(200);
    const moved = res.body.data.moves.map((m) => [m.episode_number, m.from.date, m.to.date]);
    expect(moved).toEqual([[1, '2026-11-01', '2026-11-07'], [3, '2026-11-29', '2026-11-28'], [4, '2026-12-06', '2026-12-05']]);
    expect(res.body.data.moves.some((m) => m.episode_id === eps[2])).toBe(false);
    expect((await defaultsOf(show)).release_schedule.day).toBe('sun');
  });

  it('pausing keeps the schedule and drops the schedule dates', async () => {
    const { show, eps } = await seedShow();
    const res = await auth(request(app).put(`/api/v1/world/${show}/release-schedule`)).send({ release_schedule: { ...SCHEDULE, paused: true } });
    expect(res.body.data.state).toBe('paused');
    expect(res.body.data.episodes.filter((e) => e.date).map((e) => e.episode_id)).toEqual([eps[2]]);
    expect((await defaultsOf(show)).release_schedule).toMatchObject({ day: 'sun', paused: true });
  });

  it("an episode's date is set by hand, and Back to the schedule clears only that one", async () => {
    const { show, eps } = await seedShow();
    await auth(request(app).put(`/api/v1/world/${show}/release-schedule`)).send({ release_schedule: SCHEDULE });
    let res = await auth(request(app).put(`/api/v1/world/${show}/episodes/${eps[1]}/release-date`)).send({ air_date: '2026-10-31' });
    expect(res.status).toBe(200);
    expect(await airOf(eps[1])).toBe('2026-10-31');
    expect(res.body.data.episodes.find((e) => e.episode_id === eps[1])).toMatchObject({ date: '2026-10-31', source: 'hand' });

    res = await auth(request(app).put(`/api/v1/world/${show}/episodes/${eps[1]}/release-date`)).send({ air_date: null });
    expect(res.status).toBe(200);
    expect(await airOf(eps[1])).toBeNull();
    expect(await airOf(eps[2])).toBe('2026-11-22');
    expect(res.body.data.episodes.find((e) => e.episode_id === eps[1])).toMatchObject({ date: '2026-11-01', source: 'schedule' });

    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect((await auth(request(app).put(`/api/v1/world/${show}/episodes/${eps[1]}/release-date`)).send({ air_date: 'Sunday' })).status).toBe(400);
    expect((await auth(request(app).put(`/api/v1/world/${show}/episodes/${eps[1]}/release-date`)).send({})).status).toBe(400);
    const other = await seedShow();
    expect((await auth(request(app).put(`/api/v1/world/${other.show}/episodes/${eps[1]}/release-date`)).send({ air_date: null })).status).toBe(404);
  });

  it("never touches any platform's own time: TikTok keeps its time, YouTube's stays empty", async () => {
    const { show, eps } = await seedShow();
    const dist = { youtube: { title: 'Y', scheduled_time: null }, tiktok: { caption: 'T', scheduled_time: '2026-11-03T18:00' } };
    await run('UPDATE episodes SET distribution_metadata = CAST(:d AS jsonb) WHERE id = :id', { d: JSON.stringify(dist), id: eps[1] });
    const res = await auth(request(app).put(`/api/v1/world/${show}/release-schedule`)).send({ release_schedule: SCHEDULE });
    expect(res.body.data.schedule.platforms).toEqual(['youtube']);
    await auth(request(app).put(`/api/v1/world/${show}/episodes/${eps[1]}/release-date`)).send({ air_date: '2026-11-02' });
    await auth(request(app).put(`/api/v1/world/${show}/episodes/${eps[1]}/release-date`)).send({ air_date: null });
    const [row] = await rows('SELECT distribution_metadata FROM episodes WHERE id = :id', { id: eps[1] });
    expect(row.distribution_metadata).toEqual(dist);
  });

  it('a show with no saved schedule gets no dates from it', async () => {
    const { show, eps } = await seedShow();
    await auth(request(app).put(`/api/v1/world/${(await seedShow()).show}/release-schedule`)).send({ release_schedule: SCHEDULE });
    const res = await auth(request(app).get(`/api/v1/world/${show}/release-schedule`));
    expect(res.body.data.state).toBe('unset');
    expect(res.body.data.episodes.find((e) => e.episode_id === eps[1]).date).toBeNull();
  });

  it('saving the platform defaults keeps the release schedule', async () => {
    const { show } = await seedShow();
    await auth(request(app).put(`/api/v1/world/${show}/release-schedule`)).send({ release_schedule: SCHEDULE });
    const res = await auth(request(app).put(`/api/v1/world/${show}/distribution-defaults`))
      .send({ distribution_defaults: { tiktok: { enabled: true }, release_schedule: { day: 'mon', time: '01:00' } } });
    expect(res.status).toBe(200);
    const saved = await defaultsOf(show);
    expect(saved.tiktok).toEqual({ enabled: true });
    expect(saved.release_schedule).toMatchObject({ day: 'sun', time: '10:00' });
  });
  // Two seasons (Evoni, 2026-10-25, before Season 2): Season 1 complete with
  // episodes 1-3 in its slots 1-3; Season 2 active with show-wide episodes
  // 4 and 5 in its slots 1 and 2, and episode 6 in no slot but season_number 2.
  async function seedTwoSeasons() {
    const { show, eps } = await seedShow();
    const arcs = {};
    for (const [n, status, startsOn] of [[1, 'completed', null], [2, 'active', '2027-02-01']]) {
      arcs[n] = uuid();
      await run(`INSERT INTO show_arcs (id, show_id, arc_number, title, season_number, episode_start, episode_end,
                   phases, current_phase, status, narrative_debt, progression_log, emotional_temperature, starts_on, created_at, updated_at)
                 VALUES (:id, :show, :n, :title, :n, 1, 3, '[]', 1, :status, '[]', '[]', 'rising', :startsOn, NOW() + (:n || ' seconds')::interval, NOW())`,
        { id: arcs[n], show, n, title: `Season ${n}`, status, startsOn });
    }
    for (const n of [5, 6]) {
      const id = uuid();
      eps[n] = id;
      await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, season_number, created_at, updated_at)
                 VALUES (:id, :show, :title, :n, 'draft', 2, NOW(), NOW())`, { id, show, title: `Episode ${n}`, n });
    }
    await run('UPDATE episodes SET air_date = NULL WHERE id = :id', { id: eps[2] });
    const slot = (arc, season, n, episode) => run(`INSERT INTO season_slots (id, show_id, arc_id, season_number, slot_number, phase, episode_id, created_at, updated_at)
      VALUES (gen_random_uuid(), :show, :arc, :season, :n, 1, :episode, NOW(), NOW())`, { show, arc, season, n, episode });
    for (const n of [1, 2, 3]) await slot(arcs[1], 1, n, eps[n]);
    await slot(arcs[2], 2, 1, eps[4]);
    await slot(arcs[2], 2, 2, eps[5]);
    await slot(arcs[2], 2, 3, null);
    return { show, eps, arcs };
  }

  it('two seasons: each counts its own episodes, Season 1 keeps the top-level start, Season 2 starts on its own date', async () => {
    const { show, eps } = await seedTwoSeasons();
    const res = await auth(request(app).put(`/api/v1/world/${show}/release-schedule`))
      .send({ release_schedule: { ...SCHEDULE, seasons: { 2: { first_release: '2027-03-01' } } } });
    expect(res.status).toBe(200);
    expect((await defaultsOf(show)).release_schedule.seasons).toEqual({ 2: { first_release: '2027-03-01' } });
    const byId = Object.fromEntries(res.body.data.episodes.map((e) => [e.episode_id, e]));
    expect(byId[eps[1]]).toMatchObject({ season_number: 1, number: 1, date: '2026-11-01', source: 'schedule' });
    expect(byId[eps[3]]).toMatchObject({ season_number: 1, number: 3, date: '2026-11-15' });
    expect(byId[eps[4]]).toMatchObject({ season_number: 2, number: 1, date: '2027-03-07', source: 'schedule' });
    expect(byId[eps[5]]).toMatchObject({ season_number: 2, number: 2, date: '2027-03-14' });
    // In no slot: the next free number of Season 2.
    expect(byId[eps[6]]).toMatchObject({ season_number: 2, number: 3, date: '2027-03-21' });
    expect(res.body.data.current_season).toBe(2);
    expect(res.body.data.seasons.map((x) => [x.season_number, x.state, x.first_release, x.own_start, x.title]))
      .toEqual([[1, 'active', '2026-11-01', false, 'Season 1'], [2, 'active', '2027-03-01', true, 'Season 2']]);
  });

  it('two seasons with no Season 2 start: Season 2 previews from its own start date and never warns', async () => {
    const { show, eps } = await seedTwoSeasons();
    const res = await auth(request(app).put(`/api/v1/world/${show}/release-schedule`)).send({ release_schedule: SCHEDULE });
    const byId = Object.fromEntries(res.body.data.episodes.map((e) => [e.episode_id, e]));
    expect(byId[eps[4]]).toMatchObject({ number: 1, date: '2027-02-07', source: 'preview', due: null });
    expect(res.body.data.slots[3]).toMatchObject({ date: '2027-02-21', source: 'preview' });
  });

  it("a hand-set date in Season 2 wins; a season's own start is refused when it is not a date", async () => {
    const { show, eps } = await seedTwoSeasons();
    await auth(request(app).put(`/api/v1/world/${show}/episodes/${eps[4]}/release-date`)).send({ air_date: '2027-03-14' });
    const res = await auth(request(app).put(`/api/v1/world/${show}/release-schedule`))
      .send({ release_schedule: { ...SCHEDULE, seasons: { 2: { first_release: '2027-03-01' } } } });
    const byId = Object.fromEntries(res.body.data.episodes.map((e) => [e.episode_id, e]));
    expect(byId[eps[4]]).toMatchObject({ date: '2027-03-14', source: 'hand' });
    expect(byId[eps[5]]).toMatchObject({ date: '2027-03-21', source: 'schedule' });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const bad = await auth(request(app).put(`/api/v1/world/${show}/release-schedule`))
      .send({ release_schedule: { ...SCHEDULE, seasons: { 2: { first_release: 'spring' } } } });
    expect(bad.status).toBe(400);
  });

  it('a schedule stored before seasons existed reads as it always did', async () => {
    const { show, eps } = await seedShow();
    const old = { day: 'sun', time: '10:00', cadence: 'weekly', first_release: '2026-11-01', paused: false, platforms: ['youtube'], tz_offset: 240, tz: 'America/New_York' };
    await run(`UPDATE shows SET distribution_defaults = distribution_defaults || jsonb_build_object('release_schedule', CAST(:s AS jsonb)) WHERE id = :show`,
      { s: JSON.stringify(old), show });
    const res = await auth(request(app).get(`/api/v1/world/${show}/release-schedule`));
    const byId = Object.fromEntries(res.body.data.episodes.map((e) => [e.episode_id, e]));
    expect(byId[eps[1]]).toMatchObject({ date: '2026-11-01', number: 1, season_number: 1 });
    expect(byId[eps[3]]).toMatchObject({ date: '2026-11-29', number: 3 });
  });
});
