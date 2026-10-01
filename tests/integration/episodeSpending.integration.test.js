/**
 * Event spending (the event cost split ruling, Evoni 2026-09-30;
 * docs/EVENT_EPISODE_FLOW.md §8(cc), §8(aa); the extras migration plan she
 * accepted the same day). Build PR 4 of docs/DEAL_COMPONENTS_DESIGN.md §6.
 *
 * Through the real routes, Finalize and the migrated database:
 *   - Start Episode drafts the lines once: the event's extras cost rows
 *     carried (and soft-deleted), else a replaced episode's lines copied,
 *     else the event's extras by prestige as suggestions;
 *   - the Money tab edits them (quantity × unit price) until Complete, then
 *     refuses (409 EPISODE_COMPLETED);
 *   - Complete charges each line as event_spending; a legacy event's
 *     styling_extras lump only when the episode never had lines;
 *   - the migration moves extras rows of started, not completed episodes.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { finalizeEpisodeFinancials } = require('../../src/services/financialTransactionService');
const { draftEpisodeSpending, listSpending } = require('../../src/services/episodeSpendingService');
const migration = require('../../src/migrations/20261001180000-create-episode-spending-lines');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('Event spending (event cost split, 2026-09-30)', () => {
  let token;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-spending', email: 'test@spending.dev', name: 'Spending Test', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    for (const show of shows) {
      await run(`DELETE FROM financial_transactions WHERE show_id = :show`, { show });
      await run(`DELETE FROM character_state_history WHERE show_id = :show`, { show }).catch((err) => console.error('cleanup history:', err.message));
      await run(`DELETE FROM character_state WHERE show_id = :show`, { show });
      await run(`DELETE FROM event_costs WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)`, { show });
      await run(`DELETE FROM episode_spending_lines WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)`, { show });
      await run(`UPDATE world_events SET used_in_episode_id = NULL WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  // A prestige-8 gala: drinks 100, valet 55, photo booth 150 by
  // EVENT_EXTRAS, and cost_coins 100. dealType null makes a legacy event.
  async function seed({ dealType = 'paid_appearance', cc = null } = {}) {
    const ids = { show: uuid(), event: uuid(), ep: uuid(), state: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Spend ${ids.show.slice(0, 8)}`, slug: `spend-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, format, deal_type, career_tier, cost_coins,
                 is_paid, payment_amount, prestige, canon_consequences, status, created_at, updated_at)
               VALUES (:event, :show, 'Velour Gala', 'invite', 'gala', :dealType, 1, 100, false, 0, 8, :cc, 'ready', NOW(), NOW())`,
    { ...ids, dealType, cc: cc ? JSON.stringify(cc) : null });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:state, :show, 'lala', 5000, 3, 3, 3, 2, NOW(), NOW())`, ids);
    return ids;
  }

  async function addEpisode(ids, epId = ids.ep, number = 1) {
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Spending episode', :number, 'draft', NOW(), NOW())`, { ep: epId, show: ids.show, number });
    await run(`UPDATE world_events SET used_in_episode_id = :ep, status = 'used' WHERE id = :event`, { ep: epId, event: ids.event });
  }

  const event = (ids) => q('SELECT * FROM world_events WHERE id = :event', ids).then((r) => r[0]);
  const draft = async (ids, opts = {}) => sequelize.transaction((transaction) => draftEpisodeSpending(sequelize, {
    event: opts.event, episodeId: opts.episodeId || ids.ep, replacingEpisodeId: opts.replacingEpisodeId || null, transaction,
  }));
  const shape = (lines) => lines.map((l) => [l.label, l.quantity, l.unit_price, l.source]);
  const url = (ids, suffix = '') => `/api/v1/world/${ids.show}/episodes/${ids.ep}/spending${suffix}`;
  const ledger = (ids) => q(
    `SELECT category, amount::float AS amount, source_type, source_id FROM financial_transactions
      WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY category, amount`, ids);

  it('Start Episode drafts the event\'s extras as suggestions, once', async () => {
    const ids = await seed();
    await addEpisode(ids);
    const written = await draft(ids, { event: await event(ids) });
    expect(shape(written)).toEqual([
      ['Drinks', 1, 100, 'extras'], ['Valet', 1, 55, 'extras'], ['Photo booth', 1, 150, 'extras'],
    ]);
    expect(written.every((l) => l.drafted_quantity === 1 && l.drafted_unit_price === l.unit_price)).toBe(true);
    // Again: the episode has lines, so nothing more.
    expect(await draft(ids, { event: await event(ids) })).toEqual([]);
    expect(await listSpending(sequelize, ids.ep)).toHaveLength(3);
  });

  it('Start Episode carries the event\'s extras cost rows, keeping Edited, and soft-deletes them', async () => {
    const costA = uuid(); const costB = uuid();
    const ids = await seed({ cc: { automation: { drafted_values: { costs: { [costA]: { key: 'drinks', amount: 100 } } } } } });
    await run(`INSERT INTO event_costs (id, event_id, kind, label, amount, paid_by, created_at, updated_at) VALUES
               (:costA, :event, 'extras', 'Drinks', 140, 'lala', NOW(), NOW()),
               (:costB, :event, 'extras', 'Coat check', 20, 'lala', NOW() + interval '1 second', NOW())`, { ...ids, costA, costB });
    await run(`INSERT INTO event_costs (id, event_id, kind, label, amount, paid_by, created_at, updated_at)
               VALUES (:id, :event, 'travel', 'Car', 80, 'lala', NOW(), NOW())`, { ...ids, id: uuid() });
    await addEpisode(ids);
    const written = await draft(ids, { event: await event(ids) });
    expect(written.map((l) => [l.label, l.unit_price, l.source, l.source_cost_id, l.drafted_unit_price])).toEqual([
      ['Drinks', 140, 'carried', costA, 100],
      ['Coat check', 20, 'carried', costB, null],
    ]);
    const live = await q(`SELECT kind FROM event_costs WHERE event_id = :event AND deleted_at IS NULL`, ids);
    expect(live).toEqual([{ kind: 'travel' }]);
  });

  it('a regenerated episode copies the replaced episode\'s lines', async () => {
    const ids = await seed();
    await addEpisode(ids);
    await run(`INSERT INTO episode_spending_lines (id, episode_id, event_id, label, quantity, unit_price, created_at, updated_at)
               VALUES (:id, :ep, :event, 'Champagne', 2, 75, NOW(), NOW())`, { ...ids, id: uuid() });
    const next = uuid();
    await addEpisode(ids, next, 2);
    const written = await draft(ids, { event: await event(ids), episodeId: next, replacingEpisodeId: ids.ep });
    expect(shape(written)).toEqual([['Champagne', 2, 75, null]]);
  });

  it('the Money tab edits the lines until Complete, then refuses', async () => {
    const ids = await seed();
    await addEpisode(ids);
    await draft(ids, { event: await event(ids) });

    const added = await auth(request(app).post(url(ids))).send({ label: 'Cocktails', quantity: 3, unit_price: 25 });
    expect(added.status).toBe(201);
    expect(added.body.line).toMatchObject({ label: 'Cocktails', quantity: 3, unit_price: 25, total: 75, draft_state: null });

    const [drinks] = (await auth(request(app).get(url(ids)))).body.lines;
    expect(drinks).toMatchObject({ label: 'Drinks', draft_state: 'auto_drafted' });
    const edited = await auth(request(app).put(url(ids, `/${drinks.id}`))).send({ quantity: 2 });
    expect(edited.status).toBe(200);
    expect(edited.body.line).toMatchObject({ quantity: 2, unit_price: 100, total: 200, draft_state: 'edited' });

    for (const bad of [{ label: '' }, { quantity: 0 }, { quantity: 1000 }, { unit_price: -1 }, { unit_price: 2.5 }]) {
      expect((await auth(request(app).put(url(ids, `/${drinks.id}`))).send(bad)).status).toBe(400);
    }
    expect((await auth(request(app).post(url(ids))).send({ label: 'Tip' })).status).toBe(400);

    const valet = (await auth(request(app).get(url(ids)))).body.lines.find((l) => l.label === 'Valet');
    expect((await auth(request(app).delete(url(ids, `/${valet.id}`)))).status).toBe(200);

    const list = (await auth(request(app).get(url(ids)))).body;
    expect(list).toMatchObject({ editable: true, total: 200 + 150 + 75 });

    const money = (await auth(request(app).get(`/api/v1/world/${ids.show}/episodes/${ids.ep}/money`))).body.data;
    expect(money.spending).toMatchObject({ editable: true, total: 425 });
    expect(money.spending.lines.map((l) => l.label)).toEqual(['Drinks', 'Photo booth', 'Cocktails']);

    // Another show's path finds no episode.
    expect((await auth(request(app).get(`/api/v1/world/${uuid()}/episodes/${ids.ep}/spending`))).status).toBe(404);

    await run(`UPDATE episodes SET evaluation_status = 'accepted' WHERE id = :ep`, ids);
    const refused = [
      await auth(request(app).post(url(ids))).send({ label: 'Late drink', unit_price: 10 }),
      await auth(request(app).put(url(ids, `/${drinks.id}`))).send({ quantity: 1 }),
      await auth(request(app).delete(url(ids, `/${drinks.id}`))),
    ];
    for (const res of refused) {
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EPISODE_COMPLETED');
    }
    expect((await auth(request(app).get(url(ids)))).body.editable).toBe(false);
  });

  it('Complete charges each line as event_spending (a deal event)', async () => {
    const ids = await seed();
    await addEpisode(ids);
    await draft(ids, { event: await event(ids) });
    await auth(request(app).post(url(ids))).send({ label: 'Cocktails', quantity: 3, unit_price: 25 });
    await auth(request(app).post(url(ids))).send({ label: 'Free water', quantity: 1, unit_price: 0 });

    await finalizeEpisodeFinancials(ids.ep, ids.show, sequelize);
    const rows = await ledger(ids);
    expect(rows.map((r) => [r.category, r.amount])).toEqual([
      ['event_spending', 55], ['event_spending', 75], ['event_spending', 100], ['event_spending', 150],
    ]);
    expect(rows.every((r) => r.source_type === 'event_spending')).toBe(true);
    const lineIds = (await listSpending(sequelize, ids.ep)).map((l) => l.id);
    expect(rows.every((r) => lineIds.includes(r.source_id))).toBe(true);
  });

  it('a legacy event: the lines replace the styling_extras lump; an episode that never had lines keeps it', async () => {
    const withLines = await seed({ dealType: null });
    await addEpisode(withLines);
    await draft(withLines, { event: await event(withLines) });
    await finalizeEpisodeFinancials(withLines.ep, withLines.show, sequelize);
    expect((await ledger(withLines)).map((r) => [r.category, r.amount])).toEqual([
      ['event_entry', 100], ['event_spending', 55], ['event_spending', 100], ['event_spending', 150],
    ]);

    // Every line removed: nothing for extras, and the lump does not come back.
    const emptied = await seed({ dealType: null });
    await addEpisode(emptied);
    await draft(emptied, { event: await event(emptied) });
    await run(`UPDATE episode_spending_lines SET deleted_at = NOW() WHERE episode_id = :ep`, emptied);
    await finalizeEpisodeFinancials(emptied.ep, emptied.show, sequelize);
    expect((await ledger(emptied)).map((r) => r.category)).toEqual(['event_entry']);

    // Started before the split: no lines ever, so the lump as before.
    const before = await seed({ dealType: null });
    await addEpisode(before);
    await finalizeEpisodeFinancials(before.ep, before.show, sequelize);
    expect((await ledger(before)).map((r) => [r.category, r.amount])).toEqual([
      ['event_entry', 100], ['styling_extras', 305],
    ]);
  });

  it('the migration moves the extras rows of started, not completed episodes (the accepted plan)', async () => {
    const started = await seed();
    const completed = await seed();
    const notStarted = await seed();
    const rowIds = { started: uuid(), completed: uuid(), notStarted: uuid() };
    for (const [key, ids] of [['started', started], ['completed', completed], ['notStarted', notStarted]]) {
      await run(`INSERT INTO event_costs (id, event_id, kind, label, amount, paid_by, created_at, updated_at)
                 VALUES (:id, :event, 'extras', 'Drinks', 90, 'lala', NOW(), NOW())`, { id: rowIds[key], event: ids.event });
    }
    await addEpisode(started);
    await addEpisode(completed);
    await run(`UPDATE episodes SET evaluation_status = 'accepted' WHERE id = :ep`, completed);

    await migration.up(sequelize.getQueryInterface(), Sequelize);

    expect(shape(await listSpending(sequelize, started.ep))).toEqual([['Drinks', 1, 90, 'carried']]);
    expect(await listSpending(sequelize, completed.ep)).toEqual([]);
    const liveRows = await q(`SELECT id FROM event_costs WHERE id IN (:ids) AND deleted_at IS NULL ORDER BY id`,
      { ids: Object.values(rowIds) });
    expect(liveRows.map((r) => r.id).sort()).toEqual([rowIds.completed, rowIds.notStarted].sort());
  });
});
