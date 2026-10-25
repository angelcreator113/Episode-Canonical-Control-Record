/**
 * Goals and stress in the script (Evoni, 2026-10-25: "Yes build the goals
 * and stress script work"), against the test database:
 *   - PUT /episode-brief/:id/self-talk saves her Beat 13 tone on the brief
 *     (event_metadata.self_talk; no migration) and GET /episode-brief/:id
 *     reads it back, with her goal this episode (her_goal: the active goal
 *     pinned to the event);
 *   - Complete applies it: Kind self-talk after a fail softens the stress
 *     by one; with no choice saved, the stress moves by the tier alone;
 *   - the writers' context loads the goal and the tone.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const evaluationFormula = require('../../src/utils/evaluationFormula');

const { sequelize } = models;
const shouldSkip = !process.env.DATABASE_URL || process.env.DATABASE_URL?.includes('amazonaws.com') || !process.env.DATABASE_URL?.includes('episode_metadata_test');
const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('her goal and her self-talk (2026-10-25)', () => {
  const shows = [];
  let token;
  beforeAll(() => {
    token = TokenService.generateTokenPair({ id: 'test-user-goal-stress', email: 'test@goal-stress.dev', name: 'Goal Stress', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
  });

  async function seed({ pin = true } = {}) {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, CAST(:m AS jsonb), NOW(), NOW())`,
      { show, name: `GS ${show.slice(0, 8)}`, slug: `gs-${show.slice(0, 8)}`, m: JSON.stringify({ starting_balance: 1000 }) });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:id, :show, 'lala', 1000, 3, 4, 3, 5, NOW(), NOW())`, { id: uuid(), show });
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep, :show, 'Ep 1', 1, 'draft', NOW(), NOW())`, { ep, show });
    const goal = uuid();
    const done = uuid();
    await run(`INSERT INTO career_goals (id, show_id, title, type, target_metric, target_value, current_value, starting_value, status, priority, created_at, updated_at)
               VALUES (:done, :show, 'First Brand Hello', 'secondary', 'brand_trust', 3, 3, 0, 'completed', 1, NOW(), NOW()),
                      (:goal, :show, 'Brand Girl Era', 'primary', 'brand_trust', 7, 4, 1, 'active', 1, NOW(), NOW())`, { goal, done, show });
    const event = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, cost_coins, prestige, canon_consequences, created_at, updated_at)
               VALUES (:event, :show, 'Velour Gala', 'used', :ep, 0, 5, CAST(:cc AS jsonb), NOW(), NOW())`,
      { event, show, ep, cc: JSON.stringify(pin ? { pinned_goal_ids: [done, goal] } : {}) });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, event_metadata, created_at, updated_at)
               VALUES (:id, :ep, :show, :event, 'draft', '{"cover_marks": {"hook": {"covered": true}}}'::jsonb, NOW(), NOW())`, { id: uuid(), ep, show, event });
    return { show, ep, goal };
  }

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await new Promise((r) => setTimeout(r, 200));
    for (const show of shows) {
      for (const t of ['feed_posts', 'financial_transactions', 'character_state_history', 'character_state', 'episode_briefs', 'world_events', 'career_goals', 'episodes']) {
        await run(`DELETE FROM ${t} WHERE show_id = :show`, { show });
      }
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
  });

  it('saves the tone on the brief, keeps the other keys, reads it back with her goal, and takes it back', async () => {
    const { ep, goal } = await seed();
    const auth = { Authorization: `Bearer ${token}` };

    const bad = await request(app).put(`/api/v1/episode-brief/${ep}/self-talk`).set(auth).send({ tone: 'gentle' });
    expect(bad.status).toBe(400);
    const saved = await request(app).put(`/api/v1/episode-brief/${ep}/self-talk`).set(auth).send({ tone: 'kind' });
    expect(saved.status).toBe(200);
    expect(saved.body.data.self_talk).toMatchObject({ tone: 'kind', by: 'test-user-goal-stress' });

    const [row] = await q('SELECT event_metadata FROM episode_briefs WHERE episode_id = :ep', { ep });
    expect(row.event_metadata.self_talk.tone).toBe('kind');
    expect(row.event_metadata.cover_marks).toEqual({ hook: { covered: true } });

    const got = await request(app).get(`/api/v1/episode-brief/${ep}`).set(auth);
    expect(got.status).toBe(200);
    expect(got.body.data.event_metadata.self_talk.tone).toBe('kind');
    // The completed pin is skipped; the active one is her main goal.
    expect(got.body.data.her_goal).toMatchObject({ id: goal, title: 'Brand Girl Era', kind: 'main', metric: 'brand_trust', current: 4, target: 7, how_close: 'more than halfway' });

    // A mark on her goal saves under its career: key.
    const mark = await request(app).put(`/api/v1/episode-brief/${ep}/cover-marks`).set(auth).send({ key: `career:${goal}`, covered: true, beat: 13 });
    expect(mark.status).toBe(200);
    expect(mark.body.data.cover_marks[`career:${goal}`]).toMatchObject({ covered: true, beat: 13 });

    const cleared = await request(app).put(`/api/v1/episode-brief/${ep}/self-talk`).set(auth).send({ tone: null });
    expect(cleared.body.data.self_talk).toBeNull();
    const [after] = await q('SELECT event_metadata FROM episode_briefs WHERE episode_id = :ep', { ep });
    expect(after.event_metadata.self_talk).toBeUndefined();
    expect(after.event_metadata.cover_marks.hook).toEqual({ covered: true });
  });

  it('no pin: no goal on the brief', async () => {
    const { ep } = await seed({ pin: false });
    const got = await request(app).get(`/api/v1/episode-brief/${ep}`).set({ Authorization: `Bearer ${token}` });
    expect(got.body.data.her_goal).toBeNull();
  });

  it('the writers load her goal and her tone', async () => {
    const { ep, show, goal } = await seed();
    await require('../../src/services/episodeSelfTalk').saveSelfTalk(sequelize, ep, 'hard', 'u');
    const { loadScriptContext, storyContextBlocks } = require('../../src/services/episodeScriptWriterService');
    const ctx = await loadScriptContext(ep, show, models, { lite: true });
    expect(ctx.herGoal).toMatchObject({ id: goal, title: 'Brand Girl Era' });
    expect(ctx.selfTalkTone).toBe('hard');
    const text = storyContextBlocks(ctx, { withSeason: false });
    expect(text).toContain('═══ HER GOAL THIS EPISODE ═══');
    expect(text).toContain('Her stress (5/10)');
    expect(text).toContain('self-talk: Hard on herself');
  });

  it('Complete: kind self-talk after a fail softens the stress; with none saved it moves by the tier alone', async () => {
    const actual = evaluationFormula.evaluate;
    jest.spyOn(evaluationFormula, 'evaluate').mockImplementation((...a) => ({ ...actual(...a), tier_final: 'fail' }));
    // The completion service destructured evaluate at load: re-require it fresh.
    let complete;
    jest.isolateModules(() => { complete = require('../../src/services/episodeCompletionService').completeEpisode; });

    const kind = await seed();
    await require('../../src/services/episodeSelfTalk').saveSelfTalk(sequelize, kind.ep, 'kind', 'u');
    const a = await complete(kind.ep, kind.show, sequelize);
    expect(a.evaluation.tier).toBe('fail');
    expect(a.self_talk).toMatchObject({ tone: 'kind', delta: -1, reason: 'Kind self-talk softened the stress' });
    expect(a.stress_breakdown).toEqual(expect.arrayContaining([{ key: 'self_talk', delta: -1, reason: 'Kind self-talk softened the stress' }]));
    const none = await seed();
    const b = await complete(none.ep, none.show, sequelize);
    expect(b.self_talk).toBeNull();
    // The same episode shape either way, so the only difference is the self-talk.
    expect(a.new_state.stress).toBe(b.new_state.stress - 1);
    const [st] = await q(`SELECT stress FROM character_state WHERE show_id = :show AND character_key = 'lala'`, { show: kind.show });
    expect(st.stress).toBe(a.new_state.stress);
    const [ev] = await q('SELECT evaluation_json FROM episodes WHERE id = :ep', { ep: kind.ep });
    expect(ev.evaluation_json.self_talk.tone).toBe('kind');
  });
});
