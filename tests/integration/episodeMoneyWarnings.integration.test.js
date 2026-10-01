/**
 * Episode Money, Phase B, build PR 2: early warnings (docs/EVENT_EPISODE_FLOW.md
 * §8(gg) MB4 and Q6, accepted as recommended). "If the projected balance
 * would go below zero, or event spending exceeds what Lala has, the Money
 * tab and Start Episode/Complete warn early with the shortfall; existing
 * refusals at Complete stay."
 *
 * Each show's ledger balance is 100 while its cached coins say 1000: the
 * warnings read the ledger.
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

(shouldSkip ? describe.skip : describe)('Episode Money, Phase B: early warnings (§8(gg) MB4)', () => {
  const shows = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-money-warnings', email: 'test@money-warnings.dev', name: 'Money Warnings',
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
      await run('DELETE FROM event_costs WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)', { show });
      await run('DELETE FROM event_deliverables WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)', { show });
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
               VALUES (:show, :name, :slug, CAST('{"starting_balance": 100}' AS jsonb), NOW(), NOW())`,
      { show, name: `Warn ${show.slice(0, 8)}`, slug: `warn-${show.slice(0, 8)}` });
    await run(`INSERT INTO financial_transactions (id, show_id, type, category, amount, status, source_type, created_at, updated_at)
               VALUES (:id, :show, 'income', 'seed', 100, 'executed', 'show_init', NOW() - interval '1 day', NOW())`, { id: uuid(), show });
    // The cached copy disagrees on purpose: the warnings must read the ledger.
    await models.CharacterState.create({ show_id: show, character_key: 'lala', coins: 1000, reputation: 3 });
    return show;
  }

  it('the Money tab warns when event spending exceeds what Lala has (MB4)', async () => {
    const show = await seedShow();
    const ep = uuid(); const event = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Spend', 1, 'draft', NOW(), NOW())`, { ep, show });
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, cost_coins, is_paid, prestige, created_at, updated_at)
               VALUES (:event, :show, 'Free Party', 'used', :ep, 0, false, 5, NOW(), NOW())`, { event, show, ep });
    await run(`INSERT INTO episode_spending_lines (id, episode_id, event_id, label, quantity, unit_price, created_at, updated_at)
               VALUES (:id, :ep, :event, 'Champagne', 2, 75, NOW(), NOW())`, { id: uuid(), ep, event });

    const res = await auth(request(app).get(`/api/v1/world/${show}/episodes/${ep}/money`));

    expect(res.status).toBe(200);
    const codes = res.body.data.warnings.map((w) => [w.code, w.shortfall]);
    expect(codes).toEqual([['PROJECTED_BELOW_ZERO', 50], ['COSTS_EXCEED_BALANCE', 50]]);
    expect(res.body.data.warnings[1]).toEqual(expect.objectContaining({ spending_alone: true, have: 100, spending: 150 }));
    expect(res.body.data.balance).toBe(100); // a warning, never a posting (M2)
  });

  it('the money preview warns before Start Episode, from the itemised terms costs', async () => {
    const show = await seedShow();
    const event = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, status, event_type, deal_type, deal_components, appearance_fee,
                 host, cost_coins, prestige, created_at, updated_at)
               VALUES (:event, :show, 'Velour Night', 'ready', 'invite', 'paid_appearance', CAST('["paid_to_appear"]' AS jsonb), 300,
                 'Nia Vale', 0, 5, NOW(), NOW())`, { event, show });
    await run(`INSERT INTO event_costs (id, event_id, kind, label, amount, paid_by, created_at, updated_at)
               VALUES (:id, :event, 'travel', 'Car', 160, 'lala', NOW(), NOW())`, { id: uuid(), event });

    const res = await auth(request(app).get(`/api/v1/world/${show}/events/${event}/money-preview`));

    expect(res.status).toBe(200);
    expect(res.body.data.projection.projected_balance).toBe(100 + 300 - 160);
    expect(res.body.data.warnings).toEqual([
      expect.objectContaining({ code: 'COSTS_EXCEED_BALANCE', shortfall: 60, costs: 160, have: 100 }),
    ]);
    expect((await auth(request(app).get(`/api/v1/world/${show}/events/${uuid()}/money-preview`))).status).toBe(404);
  });

  it('Start Episode stores the warning from the ledger balance, not the cached coins', async () => {
    const show = await seedShow();
    const event = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, status, event_type, cost_coins, is_paid, prestige, created_at, updated_at)
               VALUES (:event, :show, 'Gala', 'ready', 'invite', 300, false, 5, NOW(), NOW())`, { event, show });

    const started = await auth(request(app).post(`/api/v1/world/${show}/events/${event}/generate-episode`)).send({ draft_script: false });

    expect(started.status).toBe(201); // a warning never blocks
    const episodeId = started.body.data?.episode?.id || started.body.episode?.id;
    const [brief] = await rows('SELECT event_metadata FROM episode_briefs WHERE episode_id = :episodeId AND deleted_at IS NULL', { episodeId });
    const warning = brief.event_metadata.affordability_warning;
    expect(warning).toEqual(expect.objectContaining({ coins_available: 100 }));
    expect(warning.coins_needed).toBeGreaterThanOrEqual(300); // the entry cost, and the extras Start Episode drafts
    expect(warning.warnings.map((w) => w.code)).toContain('COSTS_EXCEED_BALANCE');
  });
});
