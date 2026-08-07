jest.unmock('uuid');

/**
 * Integration Tests - Wardrobe money paths
 *
 * Covers open item 6: POST /api/v1/wardrobe/purchase and POST
 * /api/v1/wardrobe/select were converted to ORM in PR 4 (units 4c, 4d) and
 * have never been exercised by a request. See F-Stats-1 Fix Plan s23, and
 * v1.17's restatement of open item 6.
 *
 * Assertions stop at response bodies. They deliberately do NOT assert on
 * character_state rows: both routes read and write character_key 'lala'
 * (wardrobe.js:1345, 1400), which is the F-Stats-1 keystone drift. Asserting
 * on those rows would encode the defect and break when F-Sec-3 resolves it.
 *
 * Fixture chain depends on three endpoints beyond those under test:
 *   POST /api/v1/wardrobe/seed              - creates SEED_WARDROBE items
 *   GET  /api/v1/wardrobe                   - resolves id and coin_cost
 *   POST /api/v1/characters/lala/state/update - upserts coins
 * The third is a raw-SQL character_state writer on F-Stats-1 Phase B's
 * conversion list. This file will need revisiting when that lands.
 *
 * Note: listWardrobeItems carries a raw-SQL fallback that triggers on ORM
 * failure (wardrobeController.js:466). If the fixture lookup behaves oddly,
 * check whether that path was taken.
 */
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');

const shouldSkip =
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const SHOW_ID = '11111111-1111-1111-1111-111111111111';

(shouldSkip ? describe.skip : describe)('Wardrobe money paths', () => {
  let token;

  const auth = () => `Bearer ${token}`;

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-wardrobe',
      email: 'test@wardrobe.dev',
      name: 'Wardrobe Test',
      groups: ['USER', 'EDITOR'],
      role: 'USER',
    }).accessToken;
  });

  describe('error contracts (no fixture required)', () => {
    it('rejects purchase without authentication', async () => {
      const res = await request(app)
        .post('/api/v1/wardrobe/purchase')
        .send({ wardrobe_id: 'x', show_id: SHOW_ID });

      expect(res.status).toBe(401);
    });

    it('rejects select without authentication', async () => {
      const res = await request(app)
        .post('/api/v1/wardrobe/select')
        .send({ wardrobe_id: 'x', show_id: SHOW_ID });

      expect(res.status).toBe(401);
    });

    it('rejects purchase with missing wardrobe_id', async () => {
      const res = await request(app)
        .post('/api/v1/wardrobe/purchase')
        .set('Authorization', auth())
        .send({ show_id: SHOW_ID });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/wardrobe_id and show_id required/i);
    });

    it('rejects purchase with missing show_id', async () => {
      const res = await request(app)
        .post('/api/v1/wardrobe/purchase')
        .set('Authorization', auth())
        .send({ wardrobe_id: '22222222-2222-2222-2222-222222222222' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/wardrobe_id and show_id required/i);
    });

    it('returns 404 for a wardrobe_id that does not exist', async () => {
      const res = await request(app)
        .post('/api/v1/wardrobe/purchase')
        .set('Authorization', auth())
        .send({
          wardrobe_id: '00000000-0000-0000-0000-000000000000',
          show_id: SHOW_ID,
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });
  });

  // SKIPPED (open item 6, partial): the two assertions below depend on
  // POST /characters/lala/state/update, which 500s in CI. Global
  // paranoid: true in src/config/sequelize.js makes Sequelize write
  // deleted_at on every INSERT; character_state has no such column.
  // Migration 20260309130000 (add-deleted-at-to-all-tables) enumerates
  // 14 tables and omits character_state. Unskip when that closes.
  describe.skip('purchase and select (fixture required)', () => {
    let coinItem;

    beforeAll(async () => {
      const seedRes = await request(app)
        .post('/api/v1/wardrobe/seed')
        .set('Authorization', auth())
        .send({ show_id: SHOW_ID });

      expect(seedRes.status).toBe(200);
      expect(seedRes.body.success).toBe(true);

      const listRes = await request(app)
        .get('/api/v1/wardrobe')
        .set('Authorization', auth())
        .query({ show_id: SHOW_ID, limit: 100 });

      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body.data)).toBe(true);

      coinItem = listRes.body.data.find(
        (i) => i.lock_type === 'coin' && !i.is_owned && i.coin_cost > 0
      );

      expect(coinItem).toBeDefined();
    });

    const setCoins = (coins) =>
      request(app)
        .post('/api/v1/characters/lala/state/update')
        .set('Authorization', auth())
        .send({ show_id: SHOW_ID, coins });

    it('rejects purchase when coins are below cost', async () => {
      const stateRes = await setCoins(0);
      expect(stateRes.status).toBe(200);

      const res = await request(app)
        .post('/api/v1/wardrobe/purchase')
        .set('Authorization', auth())
        .send({ wardrobe_id: coinItem.id, show_id: SHOW_ID });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not enough coins/i);
      expect(res.body.current).toBe(0);
      expect(res.body.needed).toBe(coinItem.coin_cost);
      expect(res.body.deficit).toBe(coinItem.coin_cost);
    });

    it('completes a purchase when coins cover the cost', async () => {
      const stateRes = await setCoins(coinItem.coin_cost + 500);
      expect(stateRes.status).toBe(200);

      const res = await request(app)
        .post('/api/v1/wardrobe/purchase')
        .set('Authorization', auth())
        .send({ wardrobe_id: coinItem.id, show_id: SHOW_ID });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
