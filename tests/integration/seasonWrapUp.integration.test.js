/**
 * The season wrap-up (Evoni, 2026-10-26: Season page round 3), on the test
 * database; the SDK is mocked:
 *   GET  /api/v1/world/:showId/season/wrap-up[?season=N]   the plain recap and the saved wrap-up
 *   POST /api/v1/world/:showId/season/wrap-up/draft        one AI call from the recap; nothing saved
 *   PUT  /api/v1/world/:showId/season/wrap-up              { text }: Evoni's edit, saved only here
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { seedArc } = require('../../src/services/arcProgressionService');
const { setRetryPause } = require('../../src/services/seasonAiContext');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
const say = (text) => ({ content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 10 } });

(shouldSkip ? describe.skip : describe)('Season wrap-up (Evoni, 2026-10-26)', () => {
  const shows = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const base = (show) => `/api/v1/world/${show}/season/wrap-up`;

  async function seedShow() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST('{"starting_balance": 1000, "world_moments": {"keep": true}}' AS jsonb), NOW(), NOW())`,
      { show, name: `Wrap ${show.slice(0, 8)}`, slug: `wrap-${show.slice(0, 8)}` });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:id, :show, 'lala', 1000, 3, 2, 3, 2, NOW(), NOW())`, { id: uuid(), show });
    const { arc_id: arcId } = await seedArc(show, models);
    return { show, arcId };
  }
  async function goal(show, fields) {
    const id = uuid();
    const f = { type: 'secondary', current_value: 0, status: 'active', arc_id: null, completed_at: null, ...fields };
    await run(`INSERT INTO career_goals (id, show_id, arc_id, title, type, target_metric, current_value, target_value, starting_value, status, completed_at, created_at, updated_at)
               VALUES (:id, :show, :arc_id, :title, :type, :metric, :current_value, :target, 0, :status, :completed_at, NOW(), NOW())`,
    { id, show, ...f });
    return id;
  }
  async function event(show, fields) {
    const id = uuid();
    const f = { prestige: 3, is_paid: false, payment_amount: 0, canon: {}, ...fields };
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, strictness, cost_coins, is_paid, payment_amount,
                 rewards, canon_consequences, created_at, updated_at)
               VALUES (:id, :show, :name, 'invite', 'used', :prestige, 5, 777, :is_paid, :payment_amount,
                 '{}'::jsonb, CAST(:canon AS jsonb), NOW(), NOW())`,
    { id, show, ...f, canon: JSON.stringify(f.canon) });
    return id;
  }
  /** An episode in slot n with the slot's event; accepted with a tier and score when given. */
  async function episodeIn(show, arcId, n, { eventId = null, tier = null, score = null, title = `Episode ${n}` } = {}) {
    const ep = uuid();
    const accepted = tier != null || score != null;
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, evaluation_status, evaluation_json, created_at, updated_at)
               VALUES (:ep, :show, :title, :n, 'draft', :status, CAST(:ej AS jsonb), NOW(), NOW())`,
    { ep, show, title, n, status: accepted ? 'accepted' : null, ej: accepted ? JSON.stringify({ tier_final: tier, score }) : null });
    await run('UPDATE season_slots SET episode_id = :ep, event_id = :eventId, locked_at = NOW() WHERE arc_id = :arcId AND slot_number = :n',
      { ep, eventId, arcId, n });
    return ep;
  }
  const ledger = (show, { episode = null, type, amount, status = 'executed' }) => run(
    `INSERT INTO financial_transactions (id, show_id, episode_id, type, category, amount, status, created_at, updated_at)
     VALUES (:id, :show, :episode, :type, 'misc', :amount, :status, NOW(), NOW())`,
    { id: uuid(), show, episode, type, amount, status });
  const slotId = async (arcId, n) => (await rows('SELECT id FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0].id;

  /** A season with two finished episodes, one in production, goals, money, threads and twists. */
  async function seedSeason() {
    const { show, arcId } = await seedShow();
    const trust = await goal(show, { title: 'Earn brand trust', metric: 'brand_trust', current_value: 6, target: 6, status: 'completed', arc_id: arcId, completed_at: new Date() });
    const coins = await goal(show, { title: 'Save 3,000 coins', type: 'primary', metric: 'coins', current_value: 1500, target: 3000 });
    await goal(show, { title: 'Old reached goal', metric: 'coins', status: 'completed', target: 10, completed_at: new Date('2020-01-01') });
    const gala = await event(show, { name: 'Velvet Gala', canon: { pinned_goal_ids: [trust] } });
    const runway = await event(show, { name: 'Paid runway', is_paid: true, payment_amount: 2400 });
    const later = await event(show, { name: 'Later brunch', is_paid: true, payment_amount: 500 });
    const ep1 = await episodeIn(show, arcId, 1, { eventId: gala, tier: 'pass', score: 71, title: 'Gala Night' });
    const ep2 = await episodeIn(show, arcId, 2, { eventId: runway, tier: 'slay', score: 92, title: 'Runway Rush' });
    await episodeIn(show, arcId, 3, { eventId: later, title: 'Brunch Draft' });
    await ledger(show, { type: 'income', amount: 1000 });
    await ledger(show, { episode: ep1, type: 'expense', amount: 400 });
    await ledger(show, { episode: ep2, type: 'income', amount: 2400 });
    await ledger(show, { episode: ep2, type: 'expense', amount: 999, status: 'pending' }); // not counted
    await run(`INSERT INTO show_story_threads (id, show_id, title, status, created_at, updated_at) VALUES
               (:a, :show, 'Who sent the roses', 'open', NOW(), NOW()),
               (:b, :show, 'The rival label', 'advanced', NOW(), NOW()),
               (:c, :show, 'Closed matter', 'closed', NOW(), NOW())`, { a: uuid(), b: uuid(), c: uuid(), show });
    await run(`INSERT INTO season_twists (id, show_id, arc_id, title, plant_slot_id, payoff_slot_id, status, created_at, updated_at) VALUES
               (:a, :show, :arcId, 'The torn invitation', :s2, :s9, 'planted', NOW(), NOW()),
               (:b, :show, :arcId, 'Paid already', :s1, :s2, 'paid_off', NOW(), NOW())`,
    { a: uuid(), b: uuid(), show, arcId, s1: await slotId(arcId, 1), s2: await slotId(arcId, 2), s9: await slotId(arcId, 9) });
    return { show, arcId, trust, coins, ep1, ep2 };
  }

  beforeAll(() => {
    setRetryPause(0);
    token = TokenService.generateTokenPair({
      id: 'test-user-wrap-up', email: 'user@wrap-up.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });
  beforeEach(() => {
    mockCreate.mockReset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    for (const show of shows) {
      for (const table of ['financial_transactions', 'season_twists', 'show_story_threads', 'season_slots', 'show_arcs', 'character_state', 'career_goals', 'world_events']) {
        await run(`DELETE FROM ${table} WHERE show_id = :show`, { show }).catch((err) => console.error('cleanup', table, err.message));
      }
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
    await sequelize.close();
  });

  test('the plain recap: goals with the finished events that moved them, best episodes, ledger money, open threads and twists', async () => {
    const { show, arcId, trust, coins } = await seedSeason();

    const res = await auth(request(app).get(base(show)));

    expect(res.status).toBe(200);
    const body = res.body;
    expect(body.season).toEqual(expect.objectContaining({ arc_id: arcId, season_number: 1, complete: false }));
    expect(body).toEqual(expect.objectContaining({ ready: true, episode_count: 3, finished_count: 2, next_season_number: 2 }));
    // The goals of the season; a goal reached before it is not one of them.
    expect(body.goals.map((g) => g.title).sort()).toEqual(['Earn brand trust', 'Save 3,000 coins']);
    const trustGoal = body.goals.find((g) => g.id === trust);
    expect(trustGoal).toEqual(expect.objectContaining({ reached: true }));
    expect(trustGoal.main_events.map((m) => [m.name, m.code])).toEqual([['Velvet Gala', 'E1']]);
    const coinsGoal = body.goals.find((g) => g.id === coins);
    // The runway is finished and pays coins; the brunch is not finished yet.
    expect(coinsGoal.also_helps.map((m) => m.name)).toEqual(['Paid runway']);
    expect(coinsGoal.still_planned).toBe(1);
    expect(body.goals_reached.map((g) => g.title)).toEqual(['Earn brand trust']);
    expect(body.best_episodes.map((e) => [e.title, e.tier, e.score, e.label])).toEqual([
      ['Runway Rush', 'slay', 92, 'S1 · E2'], ['Gala Night', 'pass', 71, 'S1 · E1'],
    ]);
    // The ledger's counted rows of the season's episodes (not the seed, not pending, not cost_coins).
    expect(body.money).toEqual(expect.objectContaining({ income: 2400, spend: 400, net: 2000, episodes_with_money: 2 }));
    expect(body.money.top_earners.map((r) => r.title)).toEqual(['Runway Rush']);
    expect(body.open_threads.map((t) => [t.title, t.status])).toEqual([['Who sent the roses', 'open'], ['The rival label', 'advanced']]);
    expect(body.open_twists.map((t) => [t.title, t.plant_label, t.payoff_label])).toEqual([['The torn invitation', 'S1 · E2', 'S1 · E9']]);
    expect(body.saved).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('not ready with no finished episode; ?season=N reads that season and 404s for one the show lacks', async () => {
    const { show } = await seedShow();
    const res = await auth(request(app).get(base(show)));
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ ready: false, finished_count: 0 }));
    expect((await auth(request(app).get(`${base(show)}?season=1`))).body.season.season_number).toBe(1);
    expect((await auth(request(app).get(`${base(show)}?season=7`))).status).toBe(404);
    expect((await auth(request(app).get(`${base(show)}?season=abc`))).status).toBe(400);
    const draft = await auth(request(app).post(`${base(show)}/draft`));
    expect(draft.status).toBe(409);
    expect(draft.body.code).toBe('WRAP_UP_NOT_READY');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('Write the wrap-up: one call reads the plain recap (no script) and nothing is saved; Save keeps the edit and every other metadata key', async () => {
    const { show, arcId } = await seedSeason();
    await run("UPDATE episodes SET script_content = 'SECRET SCRIPT LINE' WHERE show_id = :show", { show });
    mockCreate.mockResolvedValue(say('Lala reached brand trust at the Velvet Gala.'));

    const res = await auth(request(app).post(`${base(show)}/draft`));

    expect(res.status).toBe(200);
    expect(res.body.draft).toBe('Lala reached brand trust at the Velvet Gala.');
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const call = mockCreate.mock.calls[0][0];
    expect(call.model).toBe('claude-sonnet-4-6');
    expect(call.max_tokens).toBe(900);
    const prompt = call.messages[0].content;
    expect(prompt).toContain('Earn brand trust');
    expect(prompt).toContain('Main event: Velvet Gala (S1 · E1)');
    expect(prompt).toContain('"Runway Rush": SLAY, score 92');
    expect(prompt).toContain('In: 2,400 coins; out: 400 coins');
    expect(prompt).toContain('Who sent the roses');
    expect(prompt).toContain('The torn invitation');
    expect(prompt).toContain('GOING INTO SEASON 2');
    expect(prompt).not.toContain('SECRET SCRIPT LINE');
    // Nothing saved by the draft.
    expect((await auth(request(app).get(base(show)))).body.saved).toBeNull();

    const saved = await auth(request(app).put(base(show))).send({ text: '  Edited by Evoni.  ' });
    expect(saved.status).toBe(200);
    expect(saved.body.saved).toEqual(expect.objectContaining({ text: 'Edited by Evoni.', saved_by: 'user@wrap-up.dev' }));
    const [meta] = await rows('SELECT metadata::jsonb AS m FROM shows WHERE id = :show', { show });
    expect(meta.m.world_moments).toEqual({ keep: true });
    expect(meta.m.starting_balance).toBe(1000);
    expect(meta.m.season_wrapups[arcId].text).toBe('Edited by Evoni.');
    expect((await auth(request(app).get(base(show)))).body.saved.text).toBe('Edited by Evoni.');

    // An empty text clears it.
    expect((await auth(request(app).put(base(show))).send({ text: '' })).body.saved).toBeNull();
    expect((await auth(request(app).get(base(show)))).body.saved).toBeNull();
    expect((await auth(request(app).put(base(show))).send({ text: 'x'.repeat(8001) })).status).toBe(400);
  });

  test('a budget refusal is final (one call, 429); an overload is tried twice then 502', async () => {
    const { show } = await seedSeason();
    mockCreate.mockRejectedValue(Object.assign(new Error('AI daily budget exceeded.'), { status: 429, code: 'AI_BUDGET_EXCEEDED' }));
    const refused = await auth(request(app).post(`${base(show)}/draft`));
    expect(refused.status).toBe(429);
    expect(refused.body.code).toBe('AI_BUDGET_EXCEEDED');
    expect(mockCreate).toHaveBeenCalledTimes(1);

    mockCreate.mockReset();
    mockCreate.mockRejectedValue(Object.assign(new Error('overloaded'), { status: 529 }));
    const failed = await auth(request(app).post(`${base(show)}/draft`));
    expect(failed.status).toBe(502);
    expect(failed.body.code).toBe('WRAP_UP_DRAFT_FAILED');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  test('needs a signed-in user', async () => {
    const { show } = await seedShow();
    expect((await request(app).get(base(show))).status).toBe(401);
    expect((await request(app).post(`${base(show)}/draft`)).status).toBe(401);
    expect((await request(app).put(base(show)).send({ text: 'x' })).status).toBe(401);
  });
});
