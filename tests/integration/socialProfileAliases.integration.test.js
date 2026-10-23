/**
 * "Also known as" and the brand goal's account (Evoni, 2026-10-23):
 *
 *   - migration 20261023220000 adds social_profiles.aliases (JSONB, NOT
 *     NULL, default []); down drops it; up again brings it back
 *   - PUT and PATCH /social-profiles/:id save aliases as a clean list (a
 *     list, or one string with commas between; trimmed, each once), admin
 *     only
 *   - dealTermsDraftService brandProfileIdFor finds the brand's Pulse
 *     account: the opportunity's company's, else the company named
 *     host_brand, else a brand account by that name
 *
 * The database is the local migrated test DB.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const db = require('../../src/models');
const migration = require('../../src/migrations/20261023220000-add-aliases-to-social-profiles');
const { brandProfileIdFor } = require('../../src/services/dealTermsDraftService');

const { sequelize } = db;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const one = async (sql, replacements = {}) => (await run(sql, replacements))[0][0];
const hasColumn = async () => Number((await one(
  "SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_name = 'social_profiles' AND column_name = 'aliases'")).n) === 1;

(shouldSkip ? describe.skip : describe)('also known as, and the brand goal account', () => {
  const TAG = crypto.randomUUID().slice(0, 8);
  const ids = { brand: crypto.randomUUID(), opp: crypto.randomUUID(), show: crypto.randomUUID() };
  const profiles = {};
  let adminToken;
  let editorToken;

  const addProfile = async (key, extra = {}) => {
    const [[row]] = await run(
      `INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, display_name, full_profile, status, created_at, updated_at)
       VALUES (:handle, 'instagram', 'test', 'lalaverse', :name, CAST(:fp AS JSONB), 'finalized', NOW(), NOW()) RETURNING id`,
      { handle: `${key}${TAG}`, name: extra.name || key, fp: JSON.stringify(extra.full_profile || {}) });
    profiles[key] = row.id;
  };

  beforeAll(async () => {
    adminToken = TokenService.generateTokenPair({ id: 'test-admin-aliases', email: 'a@aliases.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editorToken = TokenService.generateTokenPair({ id: 'test-user-aliases', email: 'u@aliases.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await addProfile('truthville');
    await run(`INSERT INTO lalaverse_brands (id, slug, name, kind, created_at, updated_at) VALUES (:id, :slug, :name, 'brand', NOW(), NOW())`,
      { id: ids.brand, slug: `sable-${TAG}`, name: `Studio by Sable ${TAG}` });
    await addProfile('sablebrand', { name: `Studio by Sable ${TAG}`, full_profile: { lalaverse_brand_id: ids.brand, account: 'brand' } });
    await addProfile('loosebrand', { name: `Velour ${TAG}`, full_profile: { account: 'brand' } });
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :name, :slug, NOW(), NOW())`, { id: ids.show, name: `Aliases ${TAG}`, slug: `aliases-${TAG}` });
    await run(`INSERT INTO opportunities (id, show_id, name, opportunity_type, status, company_id, created_at, updated_at)
       VALUES (:id, :show, :name, 'brand_deal', 'offered', :brand, NOW(), NOW())`, { id: ids.opp, show: ids.show, name: `Deal ${TAG}`, brand: ids.brand });
  });

  afterAll(async () => {
    await run('DELETE FROM opportunities WHERE id = :opp', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:p)', { p: Object.values(profiles) });
    await run('DELETE FROM lalaverse_brands WHERE id = :brand', ids);
    await sequelize.close();
  });

  test('the migration adds aliases, default []; down drops it; up again brings it back', async () => {
    expect(await hasColumn()).toBe(true);
    await migration.down(sequelize.getQueryInterface());
    expect(await hasColumn()).toBe(false);
    await migration.up(sequelize.getQueryInterface());
    await migration.up(sequelize.getQueryInterface());
    expect(await hasColumn()).toBe(true);
    const col = await one("SELECT is_nullable, column_default FROM information_schema.columns WHERE table_name = 'social_profiles' AND column_name = 'aliases'");
    expect(col.is_nullable).toBe('NO');
    expect(col.column_default).toContain("'[]'");
    expect((await one('SELECT aliases FROM social_profiles WHERE id = :id', { id: profiles.truthville })).aliases).toEqual([]);
  });

  test('PUT saves them as a clean list; GET reads them back', async () => {
    const res = await request(app).put(`/api/v1/social-profiles/${profiles.truthville}`)
      .set('Authorization', `Bearer ${adminToken}`).send({ aliases: ' Truth ,truth,  T-Ville , ' });
    expect(res.status).toBe(200);
    expect(res.body.profile.aliases).toEqual(['Truth', 'T-Ville']);
    expect((await one('SELECT aliases FROM social_profiles WHERE id = :id', { id: profiles.truthville })).aliases).toEqual(['Truth', 'T-Ville']);
    const got = await request(app).get(`/api/v1/social-profiles/${profiles.truthville}`).set('Authorization', `Bearer ${adminToken}`);
    expect(got.body.profile.aliases).toEqual(['Truth', 'T-Ville']);
  });

  test('PATCH takes a list; a body without aliases leaves them; not a list or a string is none', async () => {
    const res = await request(app).patch(`/api/v1/social-profiles/${profiles.truthville}`)
      .set('Authorization', `Bearer ${adminToken}`).send({ aliases: ['Truth', '', 'Truth'] });
    expect(res.body.profile.aliases).toEqual(['Truth']);
    await request(app).patch(`/api/v1/social-profiles/${profiles.truthville}`).set('Authorization', `Bearer ${adminToken}`).send({ vibe_sentence: 'still test' });
    expect((await one('SELECT aliases FROM social_profiles WHERE id = :id', { id: profiles.truthville })).aliases).toEqual(['Truth']);
    const odd = await request(app).patch(`/api/v1/social-profiles/${profiles.truthville}`).set('Authorization', `Bearer ${adminToken}`).send({ aliases: { a: 1 } });
    expect(odd.body.profile.aliases).toEqual([]);
  });

  test('a signed-in non-admin cannot change them', async () => {
    const res = await request(app).put(`/api/v1/social-profiles/${profiles.truthville}`)
      .set('Authorization', `Bearer ${editorToken}`).send({ aliases: ['Nope'] });
    expect(res.status).toBe(403);
    expect((await one('SELECT aliases FROM social_profiles WHERE id = :id', { id: profiles.truthville })).aliases).toEqual([]);
  });

  test("the brand goal's account: the opportunity's company, else the company by name, else a brand account by name", async () => {
    expect(await brandProfileIdFor(sequelize, { host_brand: 'Anything', opportunity_id: ids.opp })).toBe(profiles.sablebrand);
    expect(await brandProfileIdFor(sequelize, { host_brand: `studio by sable ${TAG}` })).toBe(profiles.sablebrand);
    expect(await brandProfileIdFor(sequelize, { host_brand: `Velour ${TAG}` })).toBe(profiles.loosebrand);
    expect(await brandProfileIdFor(sequelize, { host_brand: `Nobody ${TAG}` })).toBeNull();
    // Inside a transaction, a failed read leaves the transaction usable.
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    await sequelize.transaction(async (transaction) => {
      expect(await brandProfileIdFor(sequelize, { host_brand: 'X', opportunity_id: 'not-a-uuid' }, { transaction })).toBeNull();
      expect((await sequelize.query('SELECT 1 AS ok', { transaction }))[0][0].ok).toBe(1);
    });
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
