/**
 * Her own title image, and the framed card deletable (Evoni, 2026-10-09:
 * "i also want to be able to upload my own episode title and i cant delete
 * Full-screen framed card"). Against the test database, through the app:
 *   - an uploaded PNG becomes the episode's title overlay, replacing a drawn
 *     one; renaming the episode neither outdates nor redraws it;
 *   - a non-image upload is refused;
 *   - DELETE /title-card retires the card's image and clears the episode's
 *     card; the title and its approval stay.
 * With no S3 bucket the image is stored as a data URL.
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
// A 1×1 transparent PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

(shouldSkip ? describe.skip : describe)('title image upload and framed card delete', () => {
  const ids = { show: uuid(), ep: uuid(), card: uuid(), drawn: uuid() };
  const savedEnv = {};
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const live = (role) => sequelize.query(
    'SELECT id, s3_url_processed FROM assets WHERE episode_id = :ep AND asset_role = :role AND deleted_at IS NULL',
    { replacements: { ...ids, role }, type: sequelize.QueryTypes.SELECT },
  );
  const episode = async () => (await sequelize.query(
    'SELECT title, title_overlay_asset_id, title_overlay_style, title_card_asset_id, title_card_title, title_approved_value FROM episodes WHERE id = :ep',
    { replacements: ids, type: sequelize.QueryTypes.SELECT },
  ))[0];

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-title-upload', email: 'test@title-upload.dev', name: 'Title Upload', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    for (const k of ['S3_PRIMARY_BUCKET', 'AWS_S3_BUCKET']) { savedEnv[k] = process.env[k]; delete process.env[k]; }
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Upload ${ids.show.slice(0, 8)}`, slug: `upload-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, title_approved_at, title_approved_value,
                 title_card_asset_id, title_card_title, title_overlay_asset_id, title_overlay_title, created_at, updated_at)
               VALUES (:ep, :show, 'Gala Night', 3, 'draft', NOW(), 'Gala Night', :card, 'Gala Night', :drawn, 'Gala Night', NOW(), NOW())`, ids);
    await run(`INSERT INTO assets (id, name, asset_type, asset_role, s3_url_raw, s3_url_processed, show_id, episode_id, created_at, updated_at) VALUES
                 (:card, 'Card', 'UI_OVERLAY', 'UI.OVERLAY.EPISODE_TITLE', 'https://img.test/card.png', 'https://img.test/card.png', :show, :ep, NOW(), NOW()),
                 (:drawn, 'Drawn', 'UI_OVERLAY', 'UI.OVERLAY.EPISODE_TITLE_TEXT', 'https://img.test/drawn.png', 'https://img.test/drawn.png', :show, :ep, NOW(), NOW())`, ids);
  });

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    for (const k of Object.keys(savedEnv)) { if (savedEnv[k] !== undefined) process.env[k] = savedEnv[k]; }
    await run('DELETE FROM timeline_placements WHERE episode_id = :ep', ids).catch(() => {});
    await run('DELETE FROM assets WHERE show_id = :show', ids);
    await run('DELETE FROM episodes WHERE id = :ep', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  it('an uploaded PNG becomes the title overlay, replacing the drawn one; a rename does not outdate or redraw it', async () => {
    const res = await auth(request(app).post(`/api/v1/episodes/${ids.ep}/title-overlay/upload`)).attach('file', PNG, { filename: 'my-title.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.data.overlay).toMatchObject({ outdated: false, style: { uploaded: true, file_name: 'my-title.png' } });
    expect(res.body.data.overlay.image_url).toMatch(/^data:image\/png;base64,/);
    const overlays = await live('UI.OVERLAY.EPISODE_TITLE_TEXT');
    expect(overlays).toHaveLength(1);
    expect(overlays[0].id).not.toBe(ids.drawn);
    expect((await episode()).title_overlay_asset_id).toBe(overlays[0].id);

    const renamed = await auth(request(app).put(`/api/v1/episodes/${ids.ep}/title-overlay/words`)).send({ title: 'Velvet Night' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.overlay).toMatchObject({ asset_id: overlays[0].id, outdated: false });
    expect(await live('UI.OVERLAY.EPISODE_TITLE_TEXT')).toHaveLength(1);
  });

  it('a non-image upload is refused', async () => {
    const res = await auth(request(app).post(`/api/v1/episodes/${ids.ep}/title-overlay/upload`)).attach('file', Buffer.from('hello'), { filename: 'notes.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/PNG, JPEG or WebP/);
  });

  it('DELETE /title-card retires the card and clears it; the title and its approval stay', async () => {
    expect(await live('UI.OVERLAY.EPISODE_TITLE')).toHaveLength(1);
    const res = await auth(request(app).delete(`/api/v1/episodes/${ids.ep}/title-card`));
    expect(res.status).toBe(200);
    expect(res.body.data.card).toBeFalsy();
    expect(await live('UI.OVERLAY.EPISODE_TITLE')).toHaveLength(0);
    const ep = await episode();
    expect(ep).toMatchObject({ title_card_asset_id: null, title_card_title: null, title: 'Velvet Night', title_approved_value: 'Velvet Night' });
    expect(ep.title_overlay_asset_id).not.toBeNull();
  });
});
