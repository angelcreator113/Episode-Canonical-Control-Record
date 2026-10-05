/**
 * Locking an outfit replaces the one locked before, and the episode's
 * outfit is its approved links only (Evoni, 2026-10-05: Unlock, change a
 * piece and lock again kept the old pieces; a pending library link made the
 * game open "Locked" and a re-lock was refused).
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

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('re-locking an outfit replaces it', () => {
  let token;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-relock', email: 'test@relock.dev', name: 'Relock Test', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  async function seed() {
    const ids = { show: uuid(), ep: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Relock ${ids.show.slice(0, 8)}`, slug: `rlk-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Relock episode', 1, 'draft', NOW(), NOW())`, ids);
    const mk = (name, cat, extra = {}) => models.Wardrobe.create({ name, clothing_category: cat, show_id: ids.show, is_owned: true, lock_type: 'none', ...extra });
    ids.dressA = (await mk('Dress A', 'dress')).id;
    ids.dressB = (await mk('Dress B', 'dress')).id;
    ids.shoes = (await mk('Shoes', 'shoes')).id;
    // Put on the episode by another flow, never bought: unowned, no unlock.
    ids.generated = (await mk('Generated Bag', 'accessories', { is_owned: false })).id;
    await models.CharacterState.create({ show_id: ids.show, character_key: 'lala', coins: 500, reputation: 5 });
    return ids;
  }

  const lock = (ids, wardrobe_ids) => request(app)
    .post('/api/v1/wardrobe/lock-outfit-atomic')
    .set('Authorization', `Bearer ${token}`)
    .send({ episode_id: ids.ep, show_id: ids.show, wardrobe_ids });
  const outfit = async (ids) => (await request(app)
    .get(`/api/v1/wardrobe/outfit/${ids.ep}`)
    .set('Authorization', `Bearer ${token}`)).body.items.map((i) => i.name).sort();

  afterAll(async () => {
    for (const show of shows) {
      await run(`DELETE FROM financial_transactions WHERE show_id = :show`, { show });
      await run(`DELETE FROM episode_wardrobe WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)`, { show });
      await run(`DELETE FROM character_state_history WHERE show_id = :show`, { show }).catch((err) => console.warn('cleanup history:', err.message));
      await run(`DELETE FROM character_state WHERE show_id = :show`, { show });
      await run(`DELETE FROM wardrobe WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  it('a second lock replaces the first outfit', async () => {
    const ids = await seed();
    expect((await lock(ids, [ids.dressA, ids.shoes])).status).toBe(200);
    expect(await outfit(ids)).toEqual(['Dress A', 'Shoes']);
    expect((await lock(ids, [ids.dressB, ids.shoes])).status).toBe(200);
    expect(await outfit(ids)).toEqual(['Dress B', 'Shoes']);
    const live = await q(`SELECT COUNT(*)::int AS n FROM episode_wardrobe WHERE episode_id = :ep AND deleted_at IS NULL`, ids);
    expect(live[0].n).toBe(2);
  });

  it('a pending link is not the locked outfit, and is left alone by a lock', async () => {
    const ids = await seed();
    await run(`INSERT INTO episode_wardrobe (id, episode_id, wardrobe_id, approval_status, created_at, updated_at)
               VALUES (gen_random_uuid(), :ep, :dressA, 'pending', NOW(), NOW())`, ids);
    expect(await outfit(ids)).toEqual([]);
    expect((await lock(ids, [ids.dressB, ids.shoes])).status).toBe(200);
    const pending = await q(`SELECT approval_status FROM episode_wardrobe WHERE episode_id = :ep AND wardrobe_id = :dressA AND deleted_at IS NULL`, ids);
    expect(pending).toEqual([{ approval_status: 'pending' }]);
  });

  it('a piece already locked on the episode stays wearable on a re-lock; a new unreachable one is refused', async () => {
    const ids = await seed();
    await run(`INSERT INTO episode_wardrobe (id, episode_id, wardrobe_id, approval_status, approved_at, created_at, updated_at)
               VALUES (gen_random_uuid(), :ep, :generated, 'approved', NOW(), NOW(), NOW())`, ids);
    expect((await lock(ids, [ids.dressA, ids.shoes, ids.generated])).status).toBe(200);
    const other = await seed();
    const refused = await lock(other, [other.dressA, other.generated]);
    expect(refused.status).toBe(400);
    expect(refused.body.error).toMatch(/Not within reach: Generated Bag/);
  });
});
