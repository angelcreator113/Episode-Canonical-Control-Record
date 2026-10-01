/**
 * Season Arc build PR 4 (Evoni's rulings, 2026-10-01;
 * docs/EVENT_EPISODE_FLOW.md §8(ff)):
 *   A6. "Accepting a completed episode updates the season: it records the
 *       actual outcome on its slot, updates career goals [...], checks
 *       whether a phase boundary is reached (checkPhaseTransition, currently
 *       never called), and readies the next slot."
 *   Q6. "Ask first: at a phase boundary show a summary of the phase
 *       completed and what changes, and Evoni confirms."
 *   Q7. Actual pressure "is derived from the evaluation tier, the episode's
 *       money net and the stress change."
 *   Q11. "each goal set from what it measures. Coins come from the ledger,
 *       other stats from Lala's state after the episode; custom goals are
 *       left unchanged."
 * On the test database, through completeEpisode and the roadmap route.
 */
jest.unmock('uuid');

const { Sequelize } = require('sequelize');
const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const slotsMigration = require('../../src/migrations/20261001230000-create-season-slots');
const { seedArc } = require('../../src/services/arcProgressionService');
const { completeEpisode } = require('../../src/services/episodeCompletionService');
const { getCurrentBalance } = require('../../src/services/financialTransactionService');
const { derivePressure } = require('../../src/services/seasonSlotService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Accepting an episode updates the season (§8(ff) A6, PR 4)', () => {
  const shows = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  async function seedSeason() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST('{"starting_balance": 1000}' AS jsonb), NOW(), NOW())`,
      { show, name: `Accept ${show.slice(0, 8)}`, slug: `accept-${show.slice(0, 8)}` });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:id, :show, 'lala', 1000, 3, 3, 3, 2, NOW(), NOW())`, { id: uuid(), show });
    const { arc_id: arcId } = await seedArc(show, models);
    return { show, arcId };
  }
  // An episode started from its own event, sitting in `slot`.
  async function slottedEpisode(show, arcId, slot, { accepted = false } = {}) {
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, evaluation_status, created_at, updated_at)
               VALUES (:ep, :show, :title, :slot, 'draft', :evaluation, NOW(), NOW())`,
      { ep, show, title: `Episode ${slot}`, slot, evaluation: accepted ? 'accepted' : null });
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, cost_coins, prestige, created_at, updated_at)
               VALUES (:id, :show, :name, 'used', :ep, 100, 5, NOW(), NOW())`, { id: uuid(), show, ep, name: `Gala ${slot}` });
    await run(`UPDATE season_slots SET episode_id = :ep, locked_at = NOW(),
                 actual_outcome = CASE WHEN :accepted THEN 'pass' ELSE NULL END
               WHERE arc_id = :arcId AND slot_number = :slot`, { ep, arcId, slot, accepted });
    return ep;
  }
  const slot = async (arcId, n) => (await rows(
    'SELECT actual_outcome, actual_pressure, accepted_at FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0];
  const arc = async (show) => (await rows('SELECT current_phase, current_episode FROM show_arcs WHERE show_id = :show', { show }))[0];

  beforeAll(async () => {
    await slotsMigration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-season-accept', email: 'user@season-accept.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 200)); // feed posts run after commit
    for (const show of shows) {
      for (const table of ['feed_posts', 'financial_transactions', 'character_state_history', 'character_state', 'career_goals', 'franchise_knowledge', 'season_slots', 'show_arcs']) {
        await run(`DELETE FROM ${table} WHERE show_id = :show`, { show }).catch(() => {});
      }
      await run('DELETE FROM world_events WHERE show_id = :show', { show });
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
    await sequelize.close();
  });

  test('derivePressure (Q7): tier, money net and stress change', () => {
    expect(derivePressure({ tier: 'slay', moneyNet: 500, stressDelta: -1 })).toBe('Low');
    expect(derivePressure({ tier: 'pass', moneyNet: 0, stressDelta: 0 })).toBe('Low');
    expect(derivePressure({ tier: 'pass', moneyNet: -50, stressDelta: 0 })).toBe('Medium');
    expect(derivePressure({ tier: 'safe', moneyNet: -50, stressDelta: 2 })).toBe('High');
    expect(derivePressure({ tier: 'fail', moneyNet: -2000, stressDelta: 4 })).toBe('Peak');
  });

  test('the slot records the actual outcome and pressure; the season moves to it; the next slot is readied', async () => {
    const { show, arcId } = await seedSeason();
    const ep = await slottedEpisode(show, arcId, 1);

    const result = await completeEpisode(ep, show, sequelize);

    const tier = result.evaluation.tier;
    expect(result.season).toEqual(expect.objectContaining({ slot_number: 1, actual_outcome: tier, phase_boundary: null }));
    const s1 = await slot(arcId, 1);
    expect(s1.actual_outcome).toBe(tier);
    expect(['Low', 'Medium', 'High', 'Peak']).toContain(s1.actual_pressure);
    expect(s1.actual_pressure).toBe(result.season.actual_pressure);
    expect(s1.accepted_at).not.toBeNull();
    expect(await arc(show)).toEqual({ current_phase: 1, current_episode: 1 });

    const res = await auth(request(app).get(`/api/v1/world/${show}/season/roadmap`));
    expect(res.body.roadmap.phases[0].slots[0].state).toBe('done');
    expect(res.body.roadmap.next_slot_number).toBe(2);
    expect(res.body.roadmap.phase_boundary).toBeNull();
  });

  test('goals are set from what they measure (Q11); custom goals are left unchanged', async () => {
    const { show, arcId } = await seedSeason();
    const ep = await slottedEpisode(show, arcId, 1);
    const goal = async (title, metric, current, target, type = 'secondary') => {
      const id = uuid();
      await run(`INSERT INTO career_goals (id, show_id, title, type, target_metric, current_value, target_value, starting_value, status, episode_range, created_at, updated_at)
                 VALUES (:id, :show, :title, :type, :metric, :current, :target, 0, 'active', '[1,8]', NOW(), NOW())`,
        { id, show, title, type, metric, current, target });
      return id;
    };
    const coinsGoal = await goal('Save 100k', 'coins', 0, 100000);
    const repGoal = await goal('Reputation 1', 'reputation', 0, 1);
    const customGoal = await goal('Land a couture deal', 'custom', 4, 10, 'primary');

    const result = await completeEpisode(ep, show, sequelize);

    const byId = Object.fromEntries((await rows('SELECT id, current_value, status FROM career_goals WHERE show_id = :show', { show }))
      .map((g) => [g.id, g]));
    expect(Number(byId[coinsGoal].current_value)).toBe(await getCurrentBalance(sequelize, show));
    expect(byId[coinsGoal].status).toBe('active');
    expect(Number(byId[repGoal].current_value)).toBe(result.new_state.reputation);
    expect(byId[repGoal].status).toBe('completed');
    expect([Number(byId[customGoal].current_value), byId[customGoal].status]).toEqual([4, 'active']);
  });

  test('completing the last slot of a phase reports the boundary and advances nothing (Q6)', async () => {
    const { show, arcId } = await seedSeason();
    for (let n = 1; n <= 7; n += 1) await slottedEpisode(show, arcId, n, { accepted: true });
    const ep = await slottedEpisode(show, arcId, 8);

    const result = await completeEpisode(ep, show, sequelize);

    expect(result.season.phase_boundary).toEqual({ phase: 1, title: 'Foundation', next_phase: 'Ascension' });
    expect(await arc(show)).toEqual({ current_phase: 1, current_episode: 8 });

    const res = await auth(request(app).get(`/api/v1/world/${show}/season/roadmap`));
    const pb = res.body.roadmap.phase_boundary;
    expect(pb).toEqual(expect.objectContaining({ phase: 1, title: 'Foundation' }));
    expect(pb.next_phase).toEqual(expect.objectContaining({ phase: 2, title: 'Ascension' }));
    expect(pb.outcomes.pass).toBeGreaterThanOrEqual(7);
    expect(pb.goals).toEqual(expect.objectContaining({ total: expect.any(Number) }));
  });

  test('an episode in no slot completes as before', async () => {
    const { show } = await seedSeason();
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Unslotted', 30, 'draft', NOW(), NOW())`, { ep, show });

    const result = await completeEpisode(ep, show, sequelize);

    expect(result.season).toBeNull();
    expect((await arc(show)).current_episode).toBeNull();
  });
});
