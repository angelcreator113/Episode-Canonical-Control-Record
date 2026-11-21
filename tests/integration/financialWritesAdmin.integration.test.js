/**
 * The writes that move or decide Lala's money are an admin's (Evoni,
 * 2026-11-13), asked of the API directly:
 *
 *   - approving a deliverable, which books its content fee (the earlier
 *     moves, completed and submitted, book nothing and stay open);
 *   - a manual coin change (her other stats stay editable);
 *   - writing the ledger's seed;
 *   - writing the finance config (starting balance, goal rewards).
 *
 * Each uses the authorize(['ADMIN']) / userInGroup every admin route uses.
 * A signed-out or non-admin request is refused and writes nothing: no
 * ledger row, no coin, no status, no config.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const request = require('supertest');
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

(shouldSkip ? describe.skip : describe)('money writes are admin only', () => {
  const shows = [];
  let admin;
  let editor;
  let n = 0;
  const as = (token, r) => {
    const from = r.set('X-Forwarded-For', `10.74.${Math.floor(n / 250)}.${(n % 250) + 1}`);
    return token ? from.set('Authorization', `Bearer ${token}`) : from;
  };

  beforeAll(() => {
    admin = TokenService.generateTokenPair({ id: 'test-admin-money', email: 'admin@money.dev', name: 'Admin', groups: ['admin'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-money', email: 'editor@money.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
  });
  beforeEach(() => {
    n += 1;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    const q = (sql) => sequelize.query(sql, { replacements: { shows } }).catch(() => {});
    if (shows.length) {
      for (const t of ['financial_transactions', 'character_state_history', 'character_state']) await q(`DELETE FROM ${t} WHERE show_id IN (:shows)`);
      await q('DELETE FROM event_deliverables WHERE event_id IN (SELECT id FROM world_events WHERE show_id IN (:shows))');
      await q('UPDATE world_events SET used_in_episode_id = NULL WHERE show_id IN (:shows)');
      await q('DELETE FROM episodes WHERE show_id IN (:shows)');
      await q('DELETE FROM world_events WHERE show_id IN (:shows)');
      await q('DELETE FROM shows WHERE id IN (:shows)');
    }
    await sequelize.close();
  });

  /** A show with a seeded ledger (1000), Lala, a started paid-deliverables event and one deliverable with a fee of 120. */
  async function seed({ status = 'submitted' } = {}) {
    const f = { show: uuid(), episode: uuid(), event: uuid(), deliverable: uuid() };
    shows.push(f.show);
    const meta = { starting_balance: 1000, financial_goals: [{ id: 'g1', threshold: 5000, reward_coins: 100, label: 'First goal', triggered_at: null }] };
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :name, CAST(:meta AS jsonb), NOW(), NOW())`,
      { ...f, name: `money-${f.show.slice(0, 8)}`, meta: JSON.stringify(meta) });
    await models.CharacterState.create({ show_id: f.show, character_key: 'lala', coins: 1000, reputation: 3, brand_trust: 3, influence: 3, stress: 2 });
    await run(`INSERT INTO financial_transactions (id, show_id, type, category, amount, description, status, created_at, updated_at)
               VALUES (:id, :show, 'income', 'seed', 1000, 'Starting balance', 'executed', NOW(), NOW())`, { id: uuid(), ...f });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:episode, :show, 'Gala Night', 1, 'draft', NOW(), NOW())`, f);
    await run(`INSERT INTO world_events (id, show_id, name, event_type, deal_type, status, prestige, cost_coins, used_in_episode_id, is_paid, payment_amount, host_brand, created_at, updated_at)
               VALUES (:event, :show, 'Velvet Gala', 'invite', 'paid_deliverables', 'used', 5, 0, :episode, false, 0, 'Maison Belle', NOW(), NOW())`, f);
    await run(`INSERT INTO event_deliverables (id, event_id, description, deliverable_type, required, owed_to, fee, status, episode_id, created_at, updated_at)
               VALUES (:deliverable, :event, 'One reel in the coat', 'reel', true, 'brand', 120, :status, :episode, NOW(), NOW())`, { ...f, status });
    return f;
  }

  /** Everything these routes could change. */
  const state = async (f) => ({
    ledger: await rows(`SELECT category, amount::float AS amount, deleted_at IS NULL AS live FROM financial_transactions WHERE show_id = :show ORDER BY category, amount`, f),
    lala: (await rows(`SELECT coins, reputation, brand_trust, influence, stress FROM character_state WHERE show_id = :show AND character_key = 'lala'`, f))[0],
    history: (await rows('SELECT id FROM character_state_history WHERE show_id = :show', f)).length,
    deliverable: (await rows('SELECT status, approved_at, submitted_at, completed_at FROM event_deliverables WHERE id = :deliverable', f))[0],
    config: (await rows('SELECT metadata FROM shows WHERE id = :show', f))[0].metadata,
  });
  const refusedAndUnchanged = async (f, before, res, status, code) => {
    expect(res.status).toBe(status);
    expect(res.body.code).toBe(code);
    expect(await state(f)).toEqual(before);
  };
  const WHO = [['signed out', () => null, 401, 'AUTH_REQUIRED'], ['a signed-in non-admin', () => editor, 403, 'AUTH_GROUP_REQUIRED']];

  describe('approving a deliverable (books its content fee)', () => {
    const advance = (token, f, status) => as(token, request(app).post(`/api/v1/world/${f.show}/events/${f.event}/deliverables/${f.deliverable}/status`)).send({ status });

    test.each(WHO)('%s is refused, and nothing is written', async (_n, token, status, code) => {
      const f = await seed();
      const before = await state(f);
      await refusedAndUnchanged(f, before, await advance(token(), f, 'approved'), status, code);
      expect(before.deliverable.status).toBe('submitted');
      expect(before.ledger.filter((r) => r.category === 'content_fee')).toEqual([]);
    });

    test('a non-admin still makes the earlier moves, which book nothing', async () => {
      const f = await seed({ status: 'pending' });
      for (const status of ['completed', 'submitted']) {
        const res = await advance(editor, f, status);
        expect(res.status).toBe(200);
      }
      const after = await state(f);
      expect(after.deliverable.status).toBe('submitted');
      expect(after.ledger).toEqual([{ category: 'seed', amount: 1000, live: true }]);
      expect(after.lala.coins).toBe(1000);
    });

    test('an admin approves: the fee is booked once and the coins follow; a repeat books nothing more', async () => {
      const f = await seed();
      const res = await advance(admin, f, 'approved');
      expect(res.status).toBe(200);
      const once = await state(f);
      expect(once.deliverable.status).toBe('approved');
      expect(once.ledger.filter((r) => r.category === 'content_fee')).toEqual([{ category: 'content_fee', amount: 120, live: true }]);
      expect(once.lala.coins).toBe(1120);
      expect((await advance(admin, f, 'approved')).status).toBe(400);
      expect(await state(f)).toEqual(once);
    });
  });

  describe('a manual coin change', () => {
    const update = (token, f, body) => as(token, request(app).post('/api/v1/characters/lala/state/update')).send({ show_id: f.show, ...body });

    test.each(WHO)('%s is refused, and nothing is written (not the other stats sent with it either)', async (_n, token, status, code) => {
      const f = await seed();
      const before = await state(f);
      await refusedAndUnchanged(f, before, await update(token(), f, { coins: 999999, reputation: 9 }), status, code);
    });

    test('a non-admin lowering the coins is refused too', async () => {
      const f = await seed();
      const before = await state(f);
      await refusedAndUnchanged(f, before, await update(editor, f, { coins: 0 }), 403, 'AUTH_GROUP_REQUIRED');
    });

    test('a non-admin still edits the other stats, with no coins or with the unchanged balance: no ledger row', async () => {
      const f = await seed();
      expect((await update(editor, f, { reputation: 5 })).status).toBe(200);
      expect((await update(editor, f, { coins: 1000, stress: 4 })).status).toBe(200);
      const after = await state(f);
      expect(after.lala).toMatchObject({ coins: 1000, reputation: 5, stress: 4 });
      expect(after.ledger).toEqual([{ category: 'seed', amount: 1000, live: true }]);
    });

    test('an admin changes the coins: one manual adjustment, and the coins follow the ledger', async () => {
      const f = await seed();
      const res = await update(admin, f, { coins: 1500 });
      expect(res.status).toBe(200);
      const after = await state(f);
      expect(after.ledger).toEqual([{ category: 'manual_adjustment', amount: 500, live: true }, { category: 'seed', amount: 1000, live: true }]);
      expect(after.lala.coins).toBe(1500);
    });
  });

  describe('writing the seed', () => {
    const seedBalance = (token, f, body) => as(token, request(app).post(`/api/v1/shows/${f.show}/seed-balance`)).send(body);

    test.each(WHO)('%s is refused, forced or not, and nothing is written', async (_n, token, status, code) => {
      const f = await seed();
      const before = await state(f);
      await refusedAndUnchanged(f, before, await seedBalance(token(), f, { force: true }), status, code);
      await refusedAndUnchanged(f, before, await seedBalance(token(), f, {}), status, code);
    });

    test('an admin re-seeds', async () => {
      const f = await seed();
      const res = await seedBalance(admin, f, { force: true });
      expect(res.status).toBe(200);
      expect(res.body.forced).toBe(true);
      expect((await state(f)).ledger.filter((r) => r.live)).toEqual([{ category: 'seed', amount: 1000, live: true }]);
    });
  });

  describe('writing the finance config', () => {
    const body = { starting_balance: 999999, financial_goals: [{ id: 'g1', threshold: 1, reward_coins: 999999, label: 'First goal', triggered_at: null }] };
    const put = (token, f) => as(token, request(app).put(`/api/v1/shows/${f.show}/financial-config`)).send(body);

    test.each(WHO)('%s is refused, and the starting balance and goals are as they were', async (_n, token, status, code) => {
      const f = await seed();
      const before = await state(f);
      await refusedAndUnchanged(f, before, await put(token(), f), status, code);
      expect(before.config.financial_goals[0].reward_coins).toBe(100);
    });

    test('anyone signed in still reads it', async () => {
      const f = await seed();
      const res = await as(editor, request(app).get(`/api/v1/shows/${f.show}/financial-config`));
      expect(res.status).toBe(200);
    });

    test('an admin saves it', async () => {
      const f = await seed();
      expect((await put(admin, f)).status).toBe(200);
      expect((await state(f)).config.starting_balance).toBe(999999);
    });
  });
});
