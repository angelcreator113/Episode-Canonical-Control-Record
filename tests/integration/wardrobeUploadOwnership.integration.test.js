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

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

(shouldSkip ? describe.skip : describe)('a new wardrobe piece and ownership', () => {
  let token;
  const show = crypto.randomUUID();
  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-user-upload-own', email: 't@upload.dev', name: 'Upload', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
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
});
