/**
 * GET /api/v1/ui-overlays/:showId/usage (Evoni, 2026-10-07): the show's
 * Overlays library says which episodes use each overlay image: an episode
 * whose live timeline placement names the asset. Deleted episodes, deleted
 * placements and other shows' assets are left out.
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
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });

(shouldSkip ? describe.skip : describe)('Show overlay usage', () => {
  const show = uuid();
  const other = uuid();
  let token;
  let createdPlacementsTable = false;

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-usage', email: 'u@usage.dev', name: 'Usage', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    const [{ exists }] = await q(`SELECT to_regclass('public.timeline_placements') IS NOT NULL AS exists`);
    if (!exists) {
      await run(`CREATE TABLE timeline_placements (
        id UUID PRIMARY KEY, episode_id UUID NOT NULL, placement_type TEXT NOT NULL, asset_id UUID,
        properties JSONB DEFAULT '{}'::jsonb, label VARCHAR(255),
        created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ)`);
      createdPlacementsTable = true;
    }
    for (const id of [show, other]) {
      await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :n, :n, NOW(), NOW())`, { id, n: `usage-${id.slice(0, 8)}` });
    }
  });

  afterAll(async () => {
    await run(`DELETE FROM timeline_placements WHERE episode_id IN (SELECT id FROM episodes WHERE show_id IN (:shows))`, { shows: [show, other] });
    await run(`DELETE FROM assets WHERE show_id IN (:shows)`, { shows: [show, other] });
    await run(`DELETE FROM episodes WHERE show_id IN (:shows)`, { shows: [show, other] });
    await run(`DELETE FROM shows WHERE id IN (:shows)`, { shows: [show, other] });
    if (createdPlacementsTable) await run('DROP TABLE IF EXISTS timeline_placements');
  });

  const episode = async (n, title, { deleted = false, showId = show } = {}) => {
    const id = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at, deleted_at)
               VALUES (:id, :showId, :title, :n, 'draft', NOW(), NOW(), ${deleted ? 'NOW()' : 'NULL'})`, { id, showId, title, n });
    return id;
  };
  const overlay = async (name, showId = show) => {
    const id = uuid();
    await run(`INSERT INTO assets (id, name, asset_type, show_id, s3_url_processed, metadata, created_at, updated_at)
               VALUES (:id, :name, 'UI_OVERLAY', :showId, 'https://x/o.png', '{"overlay_category":"production"}'::jsonb, NOW(), NOW())`, { id, name, showId });
    return id;
  };
  const place = (ep, asset, { deleted = false } = {}) => run(
    `INSERT INTO timeline_placements (id, episode_id, placement_type, asset_id, label, created_at, updated_at, deleted_at)
     VALUES (:id, :ep, 'overlay', :asset, 'placed', NOW(), NOW(), ${deleted ? 'NOW()' : 'NULL'})`, { id: uuid(), ep, asset });

  it('lists each overlay image with the live episodes that place it, once each, in episode order', async () => {
    const title = await overlay('UI Overlay: Show Title');
    const lower = await overlay('UI Overlay: Lower Third');
    const unused = await overlay('UI Overlay: Exit Button');
    const ep1 = await episode(1, 'The Opening');
    const ep3 = await episode(3, 'Studio Session');
    const gone = await episode(2, 'Deleted one', { deleted: true });
    await place(ep3, title);
    await place(ep1, title);
    await place(ep1, title); // twice in one episode: counted once
    await place(gone, title);
    await place(ep3, lower, { deleted: true });
    const foreignAsset = await overlay('UI Overlay: Theirs', other);
    await place(ep1, foreignAsset);

    const res = await request(app).get(`/api/v1/ui-overlays/${show}/usage`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data[title]).toEqual([
      { id: ep1, episode_number: 1, title: 'The Opening' },
      { id: ep3, episode_number: 3, title: 'Studio Session' },
    ]);
    expect(res.body.data[lower]).toBeUndefined();
    expect(res.body.data[unused]).toBeUndefined();
    expect(res.body.data[foreignAsset]).toBeUndefined();
  });

  it('needs a signed-in user', async () => {
    const res = await request(app).get(`/api/v1/ui-overlays/${show}/usage`);
    expect(res.status).toBe(401);
  });
});
