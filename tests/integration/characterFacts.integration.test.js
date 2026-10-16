/**
 * Character facts (Character Consistency Engine step 2; Evoni, 2026-10-16):
 * GET/PUT /api/v1/cast/characters/:id/facts and migration 20261016130000
 * (Maren's 2M). The database is the local migrated test DB.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const Sequelize = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');
const migration = require('../../src/migrations/20261016130000-character-canon-facts');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('character facts', () => {
  const TAG = crypto.randomUUID().slice(0, 8);
  const ids = { show: crypto.randomUUID(), reg: crypto.randomUUID(), char: crypto.randomUUID(), plain: crypto.randomUUID(), maren: crypto.randomUUID() };
  const profiles = {};
  let admin;
  let editor;

  const addProfile = async (key, handle, approx) => {
    const [[row]] = await run(
      `INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, follower_count_approx, current_state, created_at, updated_at)
       VALUES (:handle, 'pulse', 'test', 'lalaverse', :approx, 'gone_dark', NOW(), NOW()) RETURNING id`, { handle, approx });
    profiles[key] = row.id;
  };
  const ledger = (pid) => run(
    `SELECT cause, change, count_after, reason FROM pulse_followers WHERE social_profile_id = :pid ORDER BY created_at`, { pid }).then(([r]) => r);

  beforeAll(async () => {
    admin = TokenService.generateTokenPair({ id: 'test-admin-facts', email: 'evoni@facts.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-facts', email: 'e@facts.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Facts ${TAG}`, slug: `facts-${TAG}` });
    await run('INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, :t, :show, NOW(), NOW())', { ...ids, t: `Facts ${TAG}` });
    await addProfile('main', `@facts${TAG}`, '1.2M');
    await addProfile('maren', '@slowsift', '1.2M');
    const addChar = (id, pid) => run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, role_type, status, feed_profile_id, created_at, updated_at)
      VALUES (:id, :reg, :key, :name, 'support', 'accepted', :pid, NOW(), NOW())`, { id, reg: ids.reg, key: `facts-${crypto.randomUUID().slice(0, 8)}`, name: `F ${TAG}`, pid });
    await addChar(ids.char, profiles.main);
    await addChar(ids.plain, null);
    await addChar(ids.maren, profiles.maren);
    await run(`INSERT INTO pulse_followers (show_id, social_profile_id, story_order, change, count_after, cause, reason, status, decided_by, decided_at, created_at, updated_at)
      VALUES (:show, :pid, 0, 1200000, 1200000, 'start', 'test start', 'accepted', 'auto', NOW(), NOW(), NOW())`, { show: ids.show, pid: profiles.maren });
  });

  afterAll(async () => {
    await run('DELETE FROM pulse_followers WHERE show_id = :show', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:p)', { p: Object.values(profiles) });
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  const get = (id) => request(app).get(`/api/v1/cast/characters/${id}/facts`).set('Authorization', `Bearer ${admin}`);
  const put = (id, body, token = admin) => request(app).put(`/api/v1/cast/characters/${id}/facts`).set('Authorization', `Bearer ${token}`).send(body);

  it('reads the facts: one handle, followers as an estimate until the ledger holds them, account status', async () => {
    const res = await get(ids.char);
    expect(res.status).toBe(200);
    expect(res.body.facts).toMatchObject({
      feed_linked: true, handle: `@facts${TAG}`, account_status: 'gone_dark', undecided: [], major_possessions: [],
      followers: { count: 1200000, label: '1.2M', source: 'estimate' },
    });
  });

  it('only an admin changes facts', async () => {
    expect((await put(ids.char, { occupation: 'Stylist' }, editor)).status).toBe(403);
  });

  it('setting followers writes the ledger with the reason; the text follows', async () => {
    const res = await put(ids.char, { followers: { count: 2000000, reason: 'Canon count' } });
    expect(res.status).toBe(200);
    expect(res.body.facts.followers).toMatchObject({ count: 2000000, label: '2M', source: 'ledger' });
    expect(await ledger(profiles.main)).toEqual([{ cause: 'start', change: 2000000, count_after: 2000000, reason: 'Canon count' }]);
    const again = await put(ids.char, { followers: { count: 2100000 } });
    expect(again.body.facts.followers.count).toBe(2100000);
    expect((await ledger(profiles.main)).pop()).toEqual({ cause: 'override', change: 100000, count_after: 2100000, reason: 'Set on the fact sheet.' });
    const [[p]] = await run('SELECT follower_count_approx FROM social_profiles WHERE id = :id', { id: profiles.main });
    expect(p.follower_count_approx).toBe('2.1M');
  });

  it('a handle gets one @ and must be free; a second @ is refused', async () => {
    expect((await put(ids.char, { handle: '@@bad' })).status).toBe(400);
    expect((await put(ids.char, { handle: 'slowsift' })).status).toBe(409);
    const ok = await put(ids.char, { handle: `@renamed${TAG}` });
    expect(ok.body.facts.handle).toBe(`@renamed${TAG}`);
  });

  it('income, occupation, possessions and undecided facts are kept; affordability follows income', async () => {
    const res = await put(ids.char, {
      account_status: 'rising',
      income: { amount: 15000, cadence: 'per_month', source: 'Brand deals' },
      occupation: 'Stylist', major_possessions: ['a loft', 'a vintage car'], undecided: ['major_possessions'],
    });
    expect(res.status).toBe(200);
    expect(res.body.facts).toMatchObject({
      account_status: 'rising', occupation: 'Stylist', major_possessions: ['a loft', 'a vintage car'], undecided: ['major_possessions'],
      affordability: { key: 'well_off', yearly: 180000 },
    });
  });

  it('without a feed profile there is no handle, followers or status to set', async () => {
    expect((await get(ids.plain)).body.facts).toMatchObject({ feed_linked: false, handle: null, followers: null });
    expect((await put(ids.plain, { followers: { count: 5 } })).status).toBe(409);
    expect((await put(ids.plain, { occupation: 'Teacher' })).body.facts.occupation).toBe('Teacher');
  });

  it("the migration brings Maren to 2M in the ledger and on the card, and down puts both back", async () => {
    await migration.down(sequelize.getQueryInterface());
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    expect((await ledger(profiles.maren)).pop()).toMatchObject({ cause: 'override', change: 800000, count_after: 2000000 });
    expect((await get(ids.maren)).body.facts.followers).toMatchObject({ count: 2000000, label: '2M', source: 'ledger' });
    await migration.down(sequelize.getQueryInterface());
    expect((await ledger(profiles.maren)).map((r) => r.cause)).toEqual(['start']);
    const [[p]] = await run('SELECT follower_count_approx FROM social_profiles WHERE id = :id', { id: profiles.maren });
    expect(p.follower_count_approx).toBe('1.2M');
    await migration.up(sequelize.getQueryInterface(), Sequelize);
  });
});
