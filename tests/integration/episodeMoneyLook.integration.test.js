/**
 * Lala's look in the Money estimate (Evoni, 2026-10-06: "add the look's
 * to-buy cost to the estimate as a planned line, posted at Finalize").
 * getEpisodeMoney plans a line per piece Finalize will charge, from the same
 * rule Finalize uses (episodeLookCharges); after Finalize each line is
 * Posted from its own row, and nothing is "Posted, not planned".
 */
jest.unmock('uuid');

const crypto = require('crypto');
const models = require('../../src/models');
const { finalizeEpisodeFinancials } = require('../../src/services/financialTransactionService');
const { getEpisodeMoney } = require('../../src/services/episodeMoneyService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)("Lala's look in the Money estimate", () => {
  const shows = [];

  // An unpaid event (entry 100) linked to the episode; its outfit is an
  // unowned gown (200), an unowned clutch (50) and owned flats (80).
  async function seed() {
    const ids = { show: uuid(), ep: uuid(), event: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Look show ${ids.show.slice(0, 8)}`, slug: `look-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Look episode', 1, 'draft', NOW(), NOW())`, ids);
    const gown = await models.Wardrobe.create({ name: 'Gold Gown', clothing_category: 'dress', show_id: ids.show, lock_type: 'coin', coin_cost: 200, is_owned: false });
    const clutch = await models.Wardrobe.create({ name: 'Pearl Clutch', clothing_category: 'accessories', show_id: ids.show, lock_type: 'coin', coin_cost: 50, is_owned: false });
    const flats = await models.Wardrobe.create({ name: 'Flats', clothing_category: 'shoes', show_id: ids.show, coin_cost: 80, is_owned: true });
    Object.assign(ids, { gown: gown.id, clutch: clutch.id, flats: flats.id });
    await models.CharacterState.create({ show_id: ids.show, character_key: 'lala', coins: 1000, reputation: 5 });
    const outfit = [
      { id: ids.gown, name: 'Gold Gown', coin_cost: 200, is_owned: false },
      { id: ids.clutch, name: 'Pearl Clutch', coin_cost: 50, is_owned: false },
      { id: ids.flats, name: 'Flats', coin_cost: 80, is_owned: true },
    ];
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, cost_coins, is_paid, payment_amount,
                 prestige, outfit_pieces, created_at, updated_at)
               VALUES (:event, :show, 'Look Gala', 'used', :ep, 100, false, 0, 2, CAST(:outfit AS jsonb), NOW(), NOW())`,
      { ...ids, outfit: JSON.stringify(outfit) });
    return ids;
  }

  afterAll(async () => {
    for (const show of shows) {
      await run(`DELETE FROM financial_transactions WHERE show_id = :show`, { show });
      await run(`DELETE FROM episode_wardrobe WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)`, { show });
      await run(`DELETE FROM character_state_history WHERE show_id = :show`, { show }).catch((err) => console.warn('cleanup history:', err.message));
      await run(`DELETE FROM character_state WHERE show_id = :show`, { show });
      await run(`DELETE FROM wardrobe WHERE show_id = :show`, { show });
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  const lookLines = (money) => money.lines.filter((l) => l.look);

  it('before Finalize: a planned line per piece to buy, at Finalize, counted in the projection', async () => {
    const ids = await seed();
    const money = await getEpisodeMoney(sequelize, { showId: ids.show, episodeId: ids.ep });
    expect(money.look).toEqual({ pieces: 3 });
    expect(lookLines(money).map((l) => [l.source.id, l.amount, l.trigger, l.state]).sort()).toEqual([
      [ids.clutch, 50, 'at Finalize', 'planned'],
      [ids.gown, 200, 'at Finalize', 'planned'],
    ].sort());
    // The look's −250 is in the projected net with every other counted line.
    expect(lookLines(money).reduce((sum, l) => sum + l.signed, 0)).toBe(-250);
    const counted = money.lines.filter((l) => !l.conditional && !l.covered);
    expect(money.projection.projected_net).toBe(counted.reduce((sum, l) => sum + l.signed, 0));
  });

  it('after Finalize: the same lines are Posted from their own rows; nothing is "Posted, not planned"', async () => {
    const ids = await seed();
    const before = await getEpisodeMoney(sequelize, { showId: ids.show, episodeId: ids.ep });
    await finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);
    const after = await getEpisodeMoney(sequelize, { showId: ids.show, episodeId: ids.ep });
    expect(lookLines(after).map((l) => [l.source.id, l.amount, l.state]).sort()).toEqual([
      [ids.clutch, 50, 'posted'],
      [ids.gown, 200, 'posted'],
    ].sort());
    expect(after.unplanned.filter((r) => r.category === 'wardrobe_purchase')).toEqual([]);
    // The estimate was what Finalize booked.
    expect(after.projection.posted_net).toBe(before.projection.projected_net);
  });

  it('with no outfit, the look holds no pieces and plans nothing', async () => {
    const ids = await seed();
    await run(`UPDATE world_events SET outfit_pieces = '[]'::jsonb WHERE id = :event`, ids);
    const money = await getEpisodeMoney(sequelize, { showId: ids.show, episodeId: ids.ep });
    expect(money.look).toEqual({ pieces: 0 });
    expect(lookLines(money)).toEqual([]);
  });

  // One rule (Evoni, 2026-10-07): a look chosen in the episode's Wardrobe but
  // not locked is the look the Wardrobe and the Event Package show, so Money
  // plans it and Finalize charges it, instead of the event's saved outfit.
  it("a look chosen but not locked is planned and charged, not the event's saved outfit", async () => {
    const ids = await seed();
    await run(`INSERT INTO episode_wardrobe (id, episode_id, wardrobe_id, approval_status, created_at, updated_at)
               VALUES (:id, :ep, :w, 'pending', NOW(), NOW())`, { id: uuid(), ep: ids.ep, w: ids.clutch });
    const before = await getEpisodeMoney(sequelize, { showId: ids.show, episodeId: ids.ep });
    expect(before.look).toEqual({ pieces: 1 });
    expect(lookLines(before).map((l) => [l.source.id, l.amount])).toEqual([[ids.clutch, 50]]);
    await finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);
    const bought = await sequelize.query(
      `SELECT source_id FROM financial_transactions WHERE show_id = :show AND category = 'wardrobe_purchase'`,
      { replacements: ids, type: sequelize.QueryTypes.SELECT });
    expect(bought.map((r) => r.source_id)).toEqual([ids.clutch]);
  });

  it("the Event Package's preview plans the look too", async () => {
    const { eventMoneyPreview } = require('../../src/services/episodeMoneyService');
    const ids = await seed();
    const [event] = await sequelize.query('SELECT * FROM world_events WHERE id = :event', { replacements: ids, type: sequelize.QueryTypes.SELECT });
    const preview = await eventMoneyPreview(sequelize, { showId: ids.show, event, episodeId: ids.ep });
    expect(preview.lines.filter((l) => l.look).reduce((sum, l) => sum + l.signed, 0)).toBe(-250);
  });
});
