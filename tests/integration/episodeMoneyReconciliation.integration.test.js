/**
 * Episode Money, Phase B, build PR 4: the plan saved at Start Episode and the
 * reconciliation after Complete (docs/EVENT_EPISODE_FLOW.md §8(gg) MB6; Q7
 * accepted as recommended).
 *   MB6. "After Complete, a reconciliation view compares planned with posted
 *   per line and highlights differences (a bonus not earned, a spending line
 *   changed)."
 */
jest.unmock('uuid');

const { Sequelize } = require('sequelize');
const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const migration = require('../../src/migrations/20261001260000-add-episode-money-plan');
const { finalizeEpisodeFinancials } = require('../../src/services/financialTransactionService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Episode Money, Phase B: plan and reconciliation (§8(gg) MB6)', () => {
  const shows = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const money = async (show, ep) => (await auth(request(app).get(`/api/v1/world/${show}/episodes/${ep}/money`))).body.data;

  beforeAll(async () => {
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-money-recon', email: 'test@money-recon.dev', name: 'Money Recon',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    for (const show of shows) {
      for (const table of ['feed_posts', 'financial_transactions', 'character_state_history', 'character_state', 'season_slots', 'show_arcs']) {
        await run(`DELETE FROM ${table} WHERE show_id = :show`, { show }).catch(() => {});
      }
      await run('DELETE FROM episode_spending_lines WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)', { show });
      await run('DELETE FROM episode_briefs WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)', { show }).catch(() => {});
      await run('DELETE FROM episode_todo_lists WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)', { show }).catch(() => {});
      await run('UPDATE world_events SET used_in_episode_id = NULL WHERE show_id = :show', { show });
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM world_events WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
  });

  async function seedShow() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST('{"starting_balance": 2000}' AS jsonb), NOW(), NOW())`,
      { show, name: `Recon ${show.slice(0, 8)}`, slug: `recon-${show.slice(0, 8)}` });
    await run(`INSERT INTO financial_transactions (id, show_id, type, category, amount, status, source_type, created_at, updated_at)
               VALUES (:id, :show, 'income', 'seed', 2000, 'executed', 'show_init', NOW() - interval '1 day', NOW())`, { id: uuid(), show });
    await models.CharacterState.create({ show_id: show, character_key: 'lala', coins: 2000, reputation: 3 });
    return show;
  }

  it('Start Episode saves the plan; after Complete each line is compared with it (MB6, Q7)', async () => {
    const show = await seedShow();
    const event = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, status, event_type, cost_coins, is_paid, prestige, created_at, updated_at)
               VALUES (:event, :show, 'Gala', 'ready', 'invite', 100, false, 5, NOW(), NOW())`, { event, show });

    const started = await auth(request(app).post(`/api/v1/world/${show}/events/${event}/generate-episode`)).send({ draft_script: false });
    expect(started.status).toBe(201);
    const ep = started.body.data?.episode?.id || started.body.episode?.id;

    // The plan is saved on the episode, its lines as they stood at Start.
    const [{ money_plan: plan }] = await rows('SELECT money_plan FROM episodes WHERE id = :ep', { ep });
    expect(plan.taken_at).toBeTruthy();
    const planned = Object.fromEntries(plan.lines.map((l) => [l.label, l.amount]));
    expect(planned['Entry cost']).toBe(100);
    const drinks = plan.lines.find((l) => l.category === 'event_spending' && l.label.startsWith('Drinks'));
    expect(drinks).toEqual(expect.objectContaining({ drafted: expect.any(Object) }));
    // Before Complete there is nothing to reconcile.
    expect((await money(show, ep)).reconciliation).toBeNull();

    // After Start: one drafted line is edited (×2) and a line is added.
    await run("UPDATE episode_spending_lines SET quantity = 2 WHERE id = :id", { id: drinks.source.id });
    await run(`INSERT INTO episode_spending_lines (id, episode_id, event_id, label, quantity, unit_price, created_at, updated_at)
               VALUES (:id, :ep, :event, 'Coat check', 1, 20, NOW() + interval '1 minute', NOW())`, { id: uuid(), ep, event });
    await finalizeEpisodeFinancials(ep, show, sequelize);
    await run("UPDATE episodes SET evaluation_status = 'accepted' WHERE id = :ep", { ep });

    const { reconciliation: r } = await money(show, ep);

    expect(r.basis).toBe('start_episode');
    expect(r.planned_at).toBe(plan.taken_at);
    const row = (label) => r.rows.find((x) => x.label.startsWith(label));
    expect(row('Entry cost')).toEqual(expect.objectContaining({ planned: -100, posted: -100, difference: 0, status: 'as_planned' }));
    expect(row('Drinks')).toEqual(expect.objectContaining({
      planned: -drinks.amount, posted: -2 * drinks.amount, difference: -drinks.amount, status: 'changed',
      draft_change: { from: drinks.drafted, to: { quantity: 2, unit_price: drinks.unit_price } },
    }));
    expect(row('Coat check')).toEqual(expect.objectContaining({ planned: 0, posted: -20, status: 'added' }));
    expect(r.highlighted).toBe(2);
    expect(r.totals.difference).toBe(r.totals.posted_net - r.totals.planned_net);
    expect(r.totals.difference).toBe(-drinks.amount - 20);
  });

  it('an episode started before the plan was saved is compared with its current lines, and says so', async () => {
    const show = await seedShow();
    const ep = uuid(); const event = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, evaluation_status, created_at, updated_at)
               VALUES (:ep, :show, 'Old', 1, 'draft', 'accepted', NOW(), NOW())`, { ep, show });
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, cost_coins, is_paid, prestige, created_at, updated_at)
               VALUES (:event, :show, 'Old Gala', 'used', :ep, 100, false, 5, NOW(), NOW())`, { event, show, ep });
    await run(`INSERT INTO financial_transactions (id, show_id, episode_id, event_id, type, category, amount, status, source_type, source_id, created_at, updated_at)
               VALUES (:id, :show, :ep, :event, 'expense', 'event_entry', 100, 'executed', 'event', :event, NOW(), NOW())`, { id: uuid(), show, ep, event });

    const { reconciliation: r } = await money(show, ep);

    expect(r.basis).toBe('current');
    expect(r.planned_at).toBeNull();
    expect(r.rows.find((x) => x.label === 'Entry cost')).toEqual(expect.objectContaining({ status: 'as_planned', posted: -100 }));
  });
});
