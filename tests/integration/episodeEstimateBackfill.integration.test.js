/**
 * The #1919 backfill (services/episodeEstimateBackfill): an episode Start
 * priced from the whole closet gets the estimate Start writes today, from
 * its chosen look; finalized, reopened and event-less episodes are left
 * alone; a second run writes nothing.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const models = require('../../src/models');
const { STATUS, listEpisodeIds, planEpisodeEstimate, applyEpisodeEstimate } = require('../../src/services/episodeEstimateBackfill');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const one = async (sql, replacements = {}) => (await run(sql, replacements))[0][0];

// What Start wrote before #2902: the 5000-coin closet priced as the outfit.
const CLOSET_SUMMARY = { event_income: 500, event_expense: 100, outfit_cost: 5000, content_revenue: 0, total_income: 500, total_expenses: 5100, net_profit: -4600 };

(shouldSkip ? describe.skip : describe)('the episode estimate backfill (Task #1919)', () => {
  const show = uuid();
  const closet = { gown: uuid(), coat: uuid(), boots: uuid(), heels: uuid() };
  let n = 0;

  beforeAll(async () => {
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())',
      { show, name: `Backfill ${show.slice(0, 8)}`, slug: `backfill-${show.slice(0, 8)}` });
    for (const [key, cost] of [['gown', 2000], ['coat', 1500], ['boots', 1000], ['heels', 500]]) {
      await run(`INSERT INTO wardrobe (id, name, clothing_category, show_id, coin_cost, is_owned, created_at, updated_at)
                 VALUES (:id, :name, 'dress', :show, :cost, false, NOW(), NOW())`, { id: closet[key], name: key, show, cost });
    }
  });
  afterAll(async () => {
    const eps = '(SELECT id FROM episodes WHERE show_id = :show)';
    await run(`DELETE FROM financial_transactions WHERE episode_id IN ${eps}`, { show });
    await run(`DELETE FROM episode_todo_lists WHERE episode_id IN ${eps}`, { show });
    await run('DELETE FROM world_events WHERE show_id = :show', { show });
    await run('DELETE FROM episodes WHERE show_id = :show', { show });
    await run('DELETE FROM wardrobe WHERE show_id = :show', { show });
    await run('DELETE FROM shows WHERE id = :show', { show });
  });

  // An episode as Start left it before #2902, stamped by its event.
  async function closetPricedEpisode({ outfitPieces = null, event = true, reopened = false } = {}) {
    const ep = uuid();
    n += 1;
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, total_income, total_expenses, financial_score, created_at, updated_at)
               VALUES (:ep, :show, :title, :n, 'draft', 500, 5100, 4, NOW(), NOW())`, { ep, show, title: `Closet ${n}`, n });
    await run(`INSERT INTO episode_todo_lists (id, episode_id, show_id, tasks, financial_summary, status, created_at, updated_at)
               VALUES (:id, :ep, :show, '[]'::jsonb, CAST(:fin AS jsonb), 'generated', NOW(), NOW())`,
    { id: uuid(), ep, show, fin: JSON.stringify(CLOSET_SUMMARY) });
    if (event) {
      const cc = reopened ? { terms_reopen: { at: new Date().toISOString(), before: {} } } : {};
      await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, is_paid, payment_amount, cost_coins,
                   outfit_pieces, canon_consequences, used_in_episode_id, created_at, updated_at)
                 VALUES (:id, :show, :name, 'invite', 'used', 5, true, 500, 100, CAST(:pieces AS jsonb), CAST(:cc AS jsonb), :ep, NOW(), NOW())`,
      { id: uuid(), show, name: `Gala ${n}`, pieces: outfitPieces ? JSON.stringify(outfitPieces) : null, cc: JSON.stringify(cc), ep });
    }
    return ep;
  }
  const stored = async (ep) => {
    const e = await one('SELECT total_income, total_expenses, financial_score FROM episodes WHERE id = :ep', { ep });
    const t = await one('SELECT financial_summary FROM episode_todo_lists WHERE episode_id = :ep', { ep });
    return { income: Number(e.total_income), expenses: Number(e.total_expenses), score: Number(e.financial_score), fin: t.financial_summary };
  };

  it('no outfit chosen: the closet comes out; the expense is the event\'s alone and the outfit cost is absent', async () => {
    const ep = await closetPricedEpisode();
    const plan = await planEpisodeEstimate(sequelize, ep);
    expect(plan.status).toBe(STATUS.CHANGED);
    expect(plan.before.total_expenses).toBe(5100);
    expect(plan.after).toMatchObject({ total_income: 500, total_expenses: 100, financial_score: 7 });
    expect(await stored(ep)).toMatchObject({ expenses: 5100 }); // the plan writes nothing

    await applyEpisodeEstimate(sequelize, ep);
    const after = await stored(ep);
    expect(after).toMatchObject({ income: 500, expenses: 100, score: 7 });
    expect(after.fin).toMatchObject({ outfit_cost: null, outfit_chosen: false, event_expense: 100, total_expenses: 100 });

    expect((await planEpisodeEstimate(sequelize, ep)).status).toBe(STATUS.UNCHANGED);
  });

  it('a chosen look: only what Finalize would charge counts (an owned piece is free)', async () => {
    const ep = await closetPricedEpisode({ outfitPieces: [
      { id: closet.coat, name: 'coat', coin_cost: 1500, is_owned: false },
      { id: closet.heels, name: 'heels', coin_cost: 500, is_owned: true },
    ] });
    await applyEpisodeEstimate(sequelize, ep);
    const after = await stored(ep);
    expect(after.expenses).toBe(1600);
    expect(after.fin).toMatchObject({ outfit_cost: 1500, outfit_chosen: true, total_expenses: 1600 });
  });

  it('a finalized episode keeps the ledger\'s totals', async () => {
    const ep = await closetPricedEpisode();
    await run(`INSERT INTO financial_transactions (id, show_id, episode_id, type, category, amount, status, created_at, updated_at)
               VALUES (:id, :show, :ep, 'expense', 'event', 100, 'executed', NOW(), NOW())`, { id: uuid(), show, ep });
    expect((await applyEpisodeEstimate(sequelize, ep)).status).toBe(STATUS.FINALIZED);
    expect(await stored(ep)).toMatchObject({ expenses: 5100, fin: CLOSET_SUMMARY });
  });

  it('an episode Start never estimated (no todo list) is left alone', async () => {
    const ep = await closetPricedEpisode();
    await run('DELETE FROM episode_todo_lists WHERE episode_id = :ep', { ep });
    expect((await applyEpisodeEstimate(sequelize, ep)).status).toBe(STATUS.NO_ESTIMATE);
    expect((await one('SELECT total_expenses FROM episodes WHERE id = :ep', { ep })).total_expenses).toBe('5100.00');
  });

  it('reopened terms and no event are left alone', async () => {
    const reopened = await closetPricedEpisode({ reopened: true });
    const noEvent = await closetPricedEpisode({ event: false });
    expect((await applyEpisodeEstimate(sequelize, reopened)).status).toBe(STATUS.REOPENED);
    expect((await applyEpisodeEstimate(sequelize, noEvent)).status).toBe(STATUS.NO_EVENT);
    expect((await stored(reopened)).expenses).toBe(5100);
    expect((await stored(noEvent)).expenses).toBe(5100);
  });

  it('lists the show\'s live episodes, oldest first', async () => {
    const ids = await listEpisodeIds(sequelize, { showId: show });
    expect(ids.length).toBe(n);
    expect(await listEpisodeIds(sequelize, { showId: show, limit: 2 })).toEqual(ids.slice(0, 2));
  });
});
