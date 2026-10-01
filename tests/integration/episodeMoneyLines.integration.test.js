/**
 * Episode Money, Phase B, build PR 1: the episode's money lines, their
 * states and the projection (docs/EVENT_EPISODE_FLOW.md §8(gg) MB1–MB3 and
 * Evoni's answers; docs/EPISODE_MONEY_PHASE_B_NOTE.md), through
 * GET /world/:showId/episodes/:episodeId/money.
 *
 * The show starts at 1000. The deal event pays an appearance fee of 450 at
 * Complete, a bonus of 200 if SLAY and 50 if PASS, and two content fees on
 * approval (120 and 80). Lala pays a 60 car; the host comps a 40 ticket.
 * Her event spending is 2 × 15 champagne.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { finalizeEpisodeFinancials } = require('../../src/services/financialTransactionService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('Episode Money, Phase B: lines and projection (§8(gg) MB1–MB3)', () => {
  const shows = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const money = async (ids) => (await auth(request(app).get(`/api/v1/world/${ids.show}/episodes/${ids.ep}/money`))).body.data;
  const line = (data, label) => data.lines.find((l) => l.label === label);

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-money-lines', email: 'test@money-lines.dev', name: 'Money Lines',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    for (const show of shows) {
      await run('DELETE FROM feed_posts WHERE show_id = :show', { show });
      await run('DELETE FROM financial_transactions WHERE show_id = :show', { show });
      await run('DELETE FROM episode_spending_lines WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)', { show });
      await run('DELETE FROM event_deliverables WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)', { show });
      await run('DELETE FROM event_costs WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)', { show });
      await run('DELETE FROM character_state_history WHERE show_id = :show', { show });
      await run('DELETE FROM character_state WHERE show_id = :show', { show });
      await run('UPDATE world_events SET used_in_episode_id = NULL WHERE show_id = :show', { show });
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM world_events WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
  });

  async function seedDeal() {
    const ids = { show: uuid(), ep: uuid(), event: uuid(), feeA: uuid(), feeB: uuid(), car: uuid(), ticket: uuid(), champagne: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST('{"starting_balance": 1000}' AS jsonb), NOW(), NOW())`,
      { ...ids, name: `Lines ${ids.show.slice(0, 8)}`, slug: `lines-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Lines episode', 1, 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, event_type, deal_type, deal_components,
                 appearance_fee, bonus_terms, host, host_brand, cost_coins, prestige, created_at, updated_at)
               VALUES (:event, :show, 'Velour Night', 'used', :ep, 'invite', 'paid_appearance',
                 CAST('["paid_to_appear","paid_for_content"]' AS jsonb), 450, CAST('{"slay":200,"pass":50}' AS jsonb),
                 'Nia Vale', 'Maison Belle', 0, 5, NOW(), NOW())`, ids);
    await run(`INSERT INTO event_deliverables (id, event_id, description, deliverable_type, required, owed_to, fee, status, episode_id, created_at, updated_at)
               VALUES (:feeA, :event, 'One reel', 'reel', true, 'brand', 120, 'submitted', :ep, NOW(), NOW()),
                      (:feeB, :event, 'Three stories', 'story', true, 'host', 80, 'completed', :ep, NOW() + interval '1 second', NOW())`, ids);
    await run(`INSERT INTO event_costs (id, event_id, kind, label, amount, paid_by, created_at, updated_at)
               VALUES (:car, :event, 'travel', 'Car', 60, 'lala', NOW(), NOW()),
                      (:ticket, :event, 'entry', 'Ticket', 40, 'host', NOW() + interval '1 second', NOW())`, ids);
    await run(`INSERT INTO episode_spending_lines (id, episode_id, event_id, label, quantity, unit_price, created_at, updated_at)
               VALUES (:champagne, :ep, :event, 'Champagne', 2, 15, NOW(), NOW())`, ids);
    await run(`INSERT INTO financial_transactions (id, show_id, type, category, amount, status, source_type, created_at, updated_at)
               VALUES (:id, :show, 'income', 'seed', 1000, 'executed', 'show_init', NOW() - interval '1 day', NOW())`, { ...ids, id: uuid() });
    await models.CharacterState.create({ show_id: ids.show, character_key: 'lala', coins: 1000, reputation: 3 });
    return ids;
  }

  it('lists every line with its trigger, payer, amount and state (MB1, MB2)', async () => {
    const ids = await seedDeal();
    const data = await money(ids);

    const shape = (l) => [l.label, l.trigger, l.payer.who, l.amount, l.state];
    expect(data.lines.map(shape)).toEqual([
      ['Appearance fee', 'at Complete', 'brand', 450, 'planned'],
      ['Bonus (SLAY)', 'if SLAY', 'brand', 200, 'planned'],
      ['Bonus (PASS)', 'if PASS', 'brand', 50, 'planned'],
      ['Content fee: One reel', 'on approval', 'brand', 120, 'pending'], // submitted (Q4)
      ['Content fee: Three stories', 'on approval', 'host', 80, 'planned'], // completed, not submitted
      ['Car', 'at Complete', 'lala', 60, 'planned'],
      ['Ticket', null, 'host', 0, 'covered'], // comped (Q8)
      ['Champagne × 2', 'at Complete', 'lala', 30, 'planned'],
    ]);
    expect(line(data, 'Ticket').covered_amount).toBe(40);
    expect(data.unplanned).toEqual([]);
  });

  it('projects the net and the balance; conditional bonuses are shown, never counted (MB3, Q3)', async () => {
    const ids = await seedDeal();
    const { projection, balance } = await money(ids);

    expect(projection).toEqual(expect.objectContaining({
      posted_net: 0,
      pending_net: 120,
      planned_net: 450 + 80 - 60 - 30,
      projected_net: 120 + 440,
      actual_balance: balance,
      projected_balance: balance + 560,
      open_count: 7,
    }));
    expect(projection.conditional).toEqual([
      { tier: 'slay', amount: 200, label: 'Bonus (SLAY)' },
      { tier: 'pass', amount: 50, label: 'Bonus (PASS)' },
    ]);
    expect(balance).toBe(1000); // Planned and Pending never enter the balance (M2)
  });

  it('an approved content fee is Posted, linked by its deliverable', async () => {
    const ids = await seedDeal();
    const res = await auth(request(app).post(`/api/v1/world/${ids.show}/events/${ids.event}/deliverables/${ids.feeA}/status`))
      .send({ status: 'approved' });
    expect(res.status).toBe(200);

    const data = await money(ids);
    const fee = line(data, 'Content fee: One reel');
    expect(fee.state).toBe('posted');
    expect(fee.posted).toEqual(expect.objectContaining({ amount: 120, signed: 120 }));
    expect(data.projection).toEqual(expect.objectContaining({
      posted_net: 120, pending_net: 0, projected_net: 560, projected_balance: 1120 + 440,
    }));
    expect(data.balance).toBe(1120);
  });

  it('after Complete: lines it booked are Posted, the bonus tier not reached is not earned, and unplanned rows are listed', async () => {
    const ids = await seedDeal();
    // What Complete books at PASS (dealPayoutService, finalizeEpisodeFinancials), by source.
    const rows = [
      ['income', 'appearance_fee', 450, 'event', ids.event, '{}'],
      ['income', 'deal_bonus', 50, 'event', ids.event, '{"tier":"pass"}'],
      ['expense', 'event_cost', 60, 'event_cost', ids.car, '{}'],
      ['expense', 'event_spending', 30, 'event_spending', ids.champagne, '{}'],
      ['expense', 'wardrobe_purchase', 90, 'wardrobe', uuid(), '{}'],
    ];
    for (const [type, category, amount, sourceType, sourceId, metadata] of rows) {
      await run(`INSERT INTO financial_transactions (id, show_id, episode_id, event_id, type, category, amount, status, source_type, source_id, metadata, created_at, updated_at)
                 VALUES (:id, :show, :ep, :event, :type, :category, :amount, 'executed', :sourceType, :sourceId, CAST(:metadata AS jsonb), NOW(), NOW())`,
      { ...ids, id: uuid(), type, category, amount, sourceType, sourceId, metadata });
    }
    await run("UPDATE episodes SET evaluation_status = 'accepted' WHERE id = :ep", ids);

    const data = await money(ids);
    const state = (label) => line(data, label).state;
    expect(state('Appearance fee')).toBe('posted');
    expect(state('Bonus (PASS)')).toBe('posted');
    expect(state('Bonus (SLAY)')).toBe('not_earned');
    expect(state('Car')).toBe('posted');
    expect(state('Champagne × 2')).toBe('posted');
    expect(state('Content fee: One reel')).toBe('pending'); // approved after Complete (Q9)
    expect(data.unplanned.map((r) => [r.category, r.amount])).toEqual([['wardrobe_purchase', 90]]);
    expect(data.projection.conditional).toEqual([]);
    expect(data.projection.posted_net).toBe(450 + 50 - 60 - 30 - 90);
    expect(data.projection.projected_net).toBe(data.projection.posted_net + 120 + 80);
  });

  it('a legacy paid event: its payment and spending are lines that Finalize posts', async () => {
    const ids = { show: uuid(), ep: uuid(), event: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST('{"starting_balance": 1000}' AS jsonb), NOW(), NOW())`,
      { ...ids, name: `Legacy ${ids.show.slice(0, 8)}`, slug: `legacy-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Legacy', 1, 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, cost_coins, is_paid, payment_amount, host, prestige, created_at, updated_at)
               VALUES (:event, :show, 'Old Gala', 'used', :ep, 100, true, 200, 'Old Host', 5, NOW(), NOW())`, ids);
    await run(`INSERT INTO episode_spending_lines (id, episode_id, event_id, label, quantity, unit_price, created_at, updated_at)
               VALUES (:id, :ep, :event, 'Valet', 1, 20, NOW(), NOW())`, { ...ids, id: uuid() });
    await models.CharacterState.create({ show_id: ids.show, character_key: 'lala', coins: 0, reputation: 5 });

    const before = await money(ids);
    expect(before.lines.map((l) => [l.label, l.state, l.payer.who])).toEqual([
      ['Event payment', 'planned', 'host'],
      ['Valet', 'planned', 'lala'],
    ]);

    await finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);
    const after = await money(ids);
    expect(after.lines.map((l) => [l.label, l.state])).toEqual([
      ['Event payment', 'posted'],
      ['Valet', 'posted'],
    ]);
    expect(after.projection.projected_net).toBe(after.net);
  });
});
