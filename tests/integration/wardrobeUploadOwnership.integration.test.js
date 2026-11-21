/**
 * Every uploaded wardrobe piece starts unowned and is bought for its coin
 * price (Evoni's ruling, 2026-10-14, Task #3143: "every wardrobe piece that
 * I upload should need purchased"). It replaces the 2026-10-05 rule that
 * made a piece with no lock Lala's on upload; since #2650 every unowned
 * priced piece is for sale, so it is no longer a dead end.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { enforcing, readOnlyTokens, expectWriteRefused } = require('../helpers/writeGuard');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');
// The refusal tests need the ADMIN write guard enforcing; with it off they are skipped.
const guardIt = enforcing() ? it : it.skip;

(shouldSkip ? describe.skip : describe)('a new wardrobe piece and ownership', () => {
  // Production writes are an ADMIN's (Evoni, 2026-11-15); an editor and a viewer are refused them (the last test here).
  let token;
  const readOnly = readOnlyTokens('upload-own');
  const show = crypto.randomUUID();
  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-admin-upload-own', email: 'admin@upload.dev', name: 'Upload', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await sequelize.query(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, 'Upload show', :slug, NOW(), NOW())`,
      { replacements: { show, slug: `upl-${show.slice(0, 8)}` } });
  });
  afterAll(async () => {
    await sequelize.query('DELETE FROM wardrobe WHERE show_id = :show', { replacements: { show } });
    await sequelize.query('DELETE FROM shows WHERE id = :show', { replacements: { show } });
  });
  const create = (fields) => request(app).post('/api/v1/wardrobe').set('Authorization', `Bearer ${token}`)
    .field({ character: 'Lala', clothingCategory: 'dress', showId: show, ...fields });
  const owned = async (res) => (await models.Wardrobe.findByPk(res.body.data?.id || res.body.item?.id || res.body.id, { raw: true }))?.is_owned;

  it('no lock and no ownership given: not owned', async () => {
    const res = await create({ name: 'Plain Dress', price: '120' });
    expect(res.status).toBeLessThan(300);
    expect(await owned(res)).toBe(false);
  });
  it('an isOwned true sent with no lock is not honoured: not owned', async () => {
    const res = await create({ name: 'Claimed Dress', price: '120', isOwned: 'true' });
    expect(res.status).toBeLessThan(300);
    expect(await owned(res)).toBe(false);
  });
  it('a coin lock: not owned', async () => {
    const res = await create({ name: 'Coin Dress', lockType: 'coin', coinCost: '100' });
    expect(res.status).toBeLessThan(300);
    expect(await owned(res)).toBe(false);
  });
  it('an explicit isOwned false is kept', async () => {
    const res = await create({ name: 'Not Hers', isOwned: 'false' });
    expect(await owned(res)).toBe(false);
  });

  guardIt('signed out, a viewer and an editor cannot add a piece: the closet is as it was', async () => {
    const state = async () => JSON.stringify((await sequelize.query(
      'SELECT id, name, is_owned, deleted_at, updated_at FROM wardrobe WHERE show_id = :show ORDER BY id', { replacements: { show } }))[0]);
    const before = await state();
    expect(JSON.parse(before)).toHaveLength(4); // the four pieces made above
    await expectWriteRefused(() => request(app).post('/api/v1/wardrobe')
      .field({ character: 'Lala', clothingCategory: 'dress', showId: show, name: 'Not Theirs', price: '120', isOwned: 'true' }), readOnly);
    expect(await state()).toBe(before);
  });
});
