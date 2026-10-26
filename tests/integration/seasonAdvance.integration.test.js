/**
 * Advancing a season's phase (Evoni's review, 2026-10-24; Season Plan PR 2):
 * one transaction (the goals failed, the next phase's goals activated and
 * the arc written together, or nothing); "Advance with N open slots" asks
 * first and names the slots; the final phase lists its unmet goals before
 * it completes the season. On the test database, through the routes.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { seedArc, advancePhase } = require('../../src/services/arcProgressionService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Advancing a season phase (Season Plan PR 2)', () => {
  const shows = [];
  let admin;
  const auth = (r) => r.set('Authorization', `Bearer ${admin}`);

  async function newSeason() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show, name: `Advance ${show.slice(0, 8)}`, slug: `advance-${show.slice(0, 8)}` });
    await seedArc(show, models);
    return show;
  }
  async function addGoal(show, { title, type = 'secondary', status = 'active', range, metric = 'reputation', current = 2, target = 5 }) {
    const id = uuid();
    await run(`INSERT INTO career_goals (id, show_id, title, type, target_metric, target_value, current_value, status, episode_range, created_at, updated_at)
               VALUES (:id, :show, :title, :type, :metric, :target, :current, :status, CAST(:range AS jsonb), NOW(), NOW())`,
    { id, show, title, type, metric, target, current, status, range: JSON.stringify(range) });
    return id;
  }
  // Slots 1..n done: an accepted episode in each.
  async function finish(show, upto, from = 1) {
    for (let n = from; n <= upto; n += 1) {
      const ep = uuid();
      await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, evaluation_status, created_at, updated_at)
                 VALUES (:ep, :show, :title, :n, 'published', 'accepted', NOW(), NOW())`, { ep, show, title: `Made ${n}`, n });
      await run(`UPDATE season_slots SET episode_id = :ep, locked_at = NOW(), accepted_at = NOW()
                  WHERE show_id = :show AND slot_number = :n AND deleted_at IS NULL`, { ep, show, n });
    }
  }
  const arcOf = async (show) => (await rows(
    `SELECT id, status, current_phase, phases, narrative_debt, progression_log FROM show_arcs WHERE show_id = :show AND deleted_at IS NULL`, { show }))[0];
  const goalStatus = async (id) => (await rows('SELECT status FROM career_goals WHERE id = :id', { id }))[0].status;
  // No body, as the page's Advance and Confirm buttons send (Evoni's live page, 2026-10-25:
  // "Cannot destructure property 'episode_number' of 'req.body' as it is undefined").
  const advance = (show) => auth(request(app).post(`/api/v1/world/${show}/arc/advance`));
  const confirm = (show) => auth(request(app).post(`/api/v1/world/${show}/arc/advance/confirm`));

  beforeAll(() => {
    admin = TokenService.generateTokenPair({ id: 'test-season-advance', email: 'evoni@season-advance.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    for (const show of shows) {
      await run('DELETE FROM season_slots WHERE show_id = :show', { show });
      await run('DELETE FROM show_arcs WHERE show_id = :show', { show });
      await run('DELETE FROM career_goals WHERE show_id = :show', { show });
      await run(`DELETE FROM episode_briefs WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)`, { show });
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
    await sequelize.close();
  });

  test('with open slots, advance asks first and names them; nothing is written until confirm', async () => {
    const show = await newSeason();
    await finish(show, 5);
    const res = await advance(show);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ needs_confirmation: true, is_final: false, unmet_goals: [], next_phase: { phase: 2 } });
    expect(res.body.data.open_slots).toEqual([6, 7, 8].map((n) => ({ slot_number: n, label: `S1 · E${n}`, state: 'needs_event' })));
    const before = await arcOf(show);
    expect(before.current_phase).toBe(1);
    expect(before.progression_log).toHaveLength(1);

    const done = await confirm(show);
    expect(done.status).toBe(200);
    expect(done.body.data).toMatchObject({ success: true, advanced_to: expect.any(String), slots_left_open: 3 });
    const after = await arcOf(show);
    expect(after.current_phase).toBe(2);
    expect(after.phases[0]).toMatchObject({ status: 'completed', left_open: [6, 7, 8] });
    expect(after.phases[1].status).toBe('active');
    expect(after.progression_log[1]).toMatchObject({ from_phase: 1, to_phase: 2, slots_left_open: 3, warning_acknowledged: true });
    expect(after.progression_log[1].trigger_reason).toBe('Showrunner advanced with 3 open slots (E6, E7, E8)');
    // The open slots keep their part.
    const open = await rows(`SELECT slot_number, phase, episode_id FROM season_slots WHERE show_id = :show AND slot_number IN (6, 7, 8) ORDER BY slot_number`, { show });
    expect(open.map((r) => [r.slot_number, r.phase, r.episode_id])).toEqual([[6, 1, null], [7, 1, null], [8, 1, null]]);
  });

  test('every slot done and no unmet goal: advance goes through with no confirm', async () => {
    const show = await newSeason();
    await finish(show, 8);
    const res = await advance(show);
    expect(res.body.data).toMatchObject({ success: true, slots_left_open: 0, narrative_debt_added: 0 });
    expect((await arcOf(show)).current_phase).toBe(2);
  });

  test('confirming carries the unmet goals as debt and activates the next phase\'s goals, together', async () => {
    const show = await newSeason();
    await finish(show, 8);
    const unmet = await addGoal(show, { title: 'Hit rep 5', type: 'primary', range: [1, 8] });
    const met = await addGoal(show, { title: 'First look', status: 'completed', range: [2, 8] });
    const next = await addGoal(show, { title: 'Phase two goal', status: 'paused', range: [9, 16] });
    const asked = await advance(show);
    expect(asked.body.data).toMatchObject({ needs_confirmation: true, open_slots: [] });
    expect(asked.body.data.unmet_goals.map((g) => g.title)).toEqual(['Hit rep 5']);
    expect(await goalStatus(unmet)).toBe('active');

    await confirm(show);
    expect(await goalStatus(unmet)).toBe('failed');
    expect(await goalStatus(met)).toBe('completed');
    expect(await goalStatus(next)).toBe('active');
    const arc = await arcOf(show);
    expect(arc.narrative_debt.map((d) => d.goal_title)).toEqual(['Hit rep 5']);
  });

  test('a coin ladder at the phase boundary: only the rung being worked on is judged; the rungs up next stay active', async () => {
    const show = await newSeason();
    await finish(show, 8);
    const starter = await addGoal(show, { title: 'Starter Fund', metric: 'coins', current: 294, target: 500, range: [1, 8] });
    const money = await addGoal(show, { title: 'The Money Talk', metric: 'coins', current: 294, target: 2000, range: [1, 8] });
    const closet = await addGoal(show, { title: 'Closet Upgrade', metric: 'coins', current: 294, target: 5000, range: [1, 16] });
    // A primary waiting up next on the reputation ladder is not failed either.
    const firstImp = await addGoal(show, { title: 'First Impressions', metric: 'reputation', current: 0, target: 3, range: [1, 8] });
    const legacy = await addGoal(show, { title: 'Legacy', type: 'primary', metric: 'reputation', current: 0, target: 10, range: [1, 8] });
    // A passive goal keeps today's behaviour: active in the phase, so unmet.
    const passive = await addGoal(show, { title: 'Stay Consistent', type: 'passive', metric: 'consistency_streak', current: 1, target: 7, range: [1, 8] });

    const asked = await advance(show);
    expect(asked.body.data.needs_confirmation).toBe(true);
    expect(asked.body.data.unmet_goals.map((g) => g.title).sort()).toEqual(['First Impressions', 'Starter Fund', 'Stay Consistent']);
    expect(asked.body.data.goal_status).toMatchObject({ active_remaining: 3, up_next: 3, primary_incomplete: 0 });

    const done = await confirm(show);
    expect(done.status).toBe(200);
    expect(await goalStatus(starter)).toBe('failed');
    expect(await goalStatus(firstImp)).toBe('failed');
    expect(await goalStatus(passive)).toBe('failed');
    for (const id of [money, closet, legacy]) expect(await goalStatus(id)).toBe('active');
    const debt = (await arcOf(show)).narrative_debt.map((d) => d.goal_title).sort();
    expect(debt).toEqual(['First Impressions', 'Starter Fund', 'Stay Consistent']);
  });

  test('a failure while writing the arc leaves nothing half-written: goals, debt and phase as they were', async () => {
    const show = await newSeason();
    await finish(show, 3);
    const unmet = await addGoal(show, { title: 'Hit rep 5', type: 'primary', range: [1, 8] });
    const next = await addGoal(show, { title: 'Phase two goal', status: 'paused', range: [9, 16] });
    const before = await arcOf(show);

    const real = sequelize.query.bind(sequelize);
    jest.spyOn(sequelize, 'query').mockImplementation((sql, opts) => {
      if (typeof sql === 'string' && /UPDATE show_arcs SET\s+phases = :phases, current_phase = :nextPhase/.test(sql)) {
        return Promise.reject(new Error('forced failure writing the arc'));
      }
      return real(sql, opts);
    });
    await expect(advancePhase(show, models, { triggered_by: 'manual', force: true })).rejects.toThrow('forced failure writing the arc');
    jest.restoreAllMocks();

    // The two goal updates ran before the failure; both rolled back.
    expect(await goalStatus(unmet)).toBe('active');
    expect(await goalStatus(next)).toBe('paused');
    const after = await arcOf(show);
    expect(after.current_phase).toBe(1);
    expect(after.narrative_debt).toEqual([]);
    expect(after.phases).toEqual(before.phases);
    expect(after.progression_log).toEqual(before.progression_log);

    // The route says so and logs it.
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(sequelize, 'query').mockImplementation((sql, opts) => (
      typeof sql === 'string' && /UPDATE show_arcs SET\s+phases = :phases, current_phase/.test(sql)
        ? Promise.reject(new Error('forced failure writing the arc')) : real(sql, opts)));
    const res = await confirm(show);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('forced failure writing the arc');
    expect(logged).toHaveBeenCalledWith('[ArcRoutes] confirm advance error:', expect.any(Error));
  });

  test('the final phase lists its unmet goals before completing; confirm completes the season', async () => {
    const show = await newSeason();
    await finish(show, 24);
    // Phases 1 and 2 done.
    await advance(show);
    await advance(show);
    expect((await arcOf(show)).current_phase).toBe(3);
    const unmet = await addGoal(show, { title: 'Land a cover', range: [17, 24], metric: 'portfolio_strength', current: 0, target: 1 });

    const asked = await advance(show);
    expect(asked.body.data).toMatchObject({ needs_confirmation: true, is_final: true, open_slots: [], next_phase: null });
    expect(asked.body.data.unmet_goals).toEqual([expect.objectContaining({ title: 'Land a cover', current_value: 0, target_value: 1, target_metric: 'portfolio_strength' })]);
    expect((await arcOf(show)).status).toBe('active');

    const done = await confirm(show);
    expect(done.body.data).toMatchObject({ success: true, arc_completed: true });
    const arc = await arcOf(show);
    expect(arc.status).toBe('completed');
    expect(arc.phases[2].status).toBe('completed');
    expect(arc.progression_log.at(-1)).toMatchObject({ from_phase: 3, to_phase: null, goals_unmet: 1, slots_left_open: 0 });
    // Completing leaves the goal as it was (it is not carried as debt).
    expect(await goalStatus(unmet)).toBe('active');
  });

  test('the final phase with nothing unmet and every slot done completes on the first click', async () => {
    const show = await newSeason();
    await finish(show, 24);
    await advance(show);
    await advance(show);
    const res = await advance(show);
    expect(res.body.data).toMatchObject({ success: true, arc_completed: true });
    expect((await arcOf(show)).status).toBe('completed');
  });
});
