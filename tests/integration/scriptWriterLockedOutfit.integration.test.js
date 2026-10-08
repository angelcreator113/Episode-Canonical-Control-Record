/**
 * The script writer reads the outfit locked on the Wardrobe tab, as
 * GET /wardrobe/outfit/:episode_id reads it (Evoni, 2026-10-08: "script
 * is showing that its not connected to wardrobe"): an approved link only,
 * not a library assign awaiting approval, and not an attachment apart
 * from its parent piece.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const request = require('supertest');
const models = require('../../src/models');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { loadScriptContext, buildFullPrompt } = require('../../src/services/episodeScriptWriterService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('the script writer reads the locked outfit', () => {
  const ids = { show: uuid(), ep: uuid(), dress: uuid(), heels: uuid(), pending: uuid(), strap: uuid() };
  const tag = ids.show.slice(0, 8);

  beforeAll(async () => {
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Locked outfit ${tag}`, slug: `locked-outfit-${tag}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Locked outfit episode', 1, 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO wardrobe (id, name, clothing_category, show_id) VALUES
                 (:dress, 'Silk slip dress', 'dress', :show),
                 (:heels, 'Strappy heels', 'shoes', :show),
                 (:pending, 'Pending clutch', 'accessories', :show)`, ids);
    await run(`INSERT INTO wardrobe (id, name, clothing_category, show_id, parent_item_id) VALUES (:strap, 'Dress strap', 'dress', :show, :dress)`, ids);
    await run(`INSERT INTO episode_wardrobe (episode_id, wardrobe_id, approval_status) VALUES
                 (:ep, :dress, 'approved'), (:ep, :heels, 'approved'), (:ep, :pending, 'pending'), (:ep, :strap, 'approved')`, ids);
  });

  afterAll(async () => {
    await run('DELETE FROM episode_wardrobe WHERE episode_id = :ep', ids);
    await run('DELETE FROM wardrobe WHERE id IN (:strap)', ids);
    await run('DELETE FROM wardrobe WHERE id IN (:dress, :heels, :pending)', ids);
    await run('DELETE FROM episodes WHERE id = :ep', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  it('the context and the prompt carry the approved pieces only, the same ones the Wardrobe tab shows locked', async () => {
    const context = await loadScriptContext(ids.ep, ids.show, models);
    expect(context.wardrobe.map((w) => w.name)).toEqual(['Silk slip dress', 'Strappy heels']);
    const prompt = buildFullPrompt(context);
    expect(prompt).toContain('LOCKED OUTFIT (2 pieces)');
    expect(prompt).not.toContain('Pending clutch');

    const token = TokenService.generateTokenPair({ id: 'test-locked-outfit', email: 'test@locked-outfit.dev', name: 'Locked Outfit', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    const res = await request(app).get(`/api/v1/wardrobe/outfit/${ids.ep}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items.map((w) => w.name).sort()).toEqual(context.wardrobe.map((w) => w.name).sort());
  });
});
