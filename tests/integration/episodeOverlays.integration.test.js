/**
 * Production → Overlays (P15, Evoni 2026-09-30). GET /episodes/:id/overlays
 * against the test database, through the app:
 *   - an episode with nothing made lists its four pieces as not made, with
 *     the costs of making them, and makes no image call;
 *   - a saved title overlay is approved; a changed title makes it outdated;
 *     the banner chip follows it;
 *   - the event's approved invitation is approved and shows its placed beat;
 *   - an unknown episode is 404; the route needs a login.
 * The test database has no timeline_placements table (only a dead migration
 * tree creates it), so this suite creates it when missing and drops it
 * afterwards only if it created it (the P10 and P14 suites' pattern).
 */
jest.unmock('uuid');

const { Sequelize } = require('sequelize');
const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const imageGen = require('../../src/services/imageGenerationService');
const titleOverlayMigration = require('../../src/migrations/20261001200000-add-episode-title-overlay');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });

(shouldSkip ? describe.skip : describe)('Episode overlays (P15)', () => {
  const shows = [];
  const savedEnv = {};
  let token;
  let createdPlacementsTable = false;

  beforeAll(async () => {
    await titleOverlayMigration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-p15', email: 'test@p15.dev', name: 'P15', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    for (const k of ['S3_PRIMARY_BUCKET', 'AWS_S3_BUCKET']) { savedEnv[k] = process.env[k]; delete process.env[k]; }
    const [{ exists }] = await q(`SELECT to_regclass('public.timeline_placements') IS NOT NULL AS exists`);
    if (!exists) {
      await run(`CREATE TABLE timeline_placements (
        id UUID PRIMARY KEY, episode_id UUID NOT NULL, placement_type TEXT NOT NULL, asset_id UUID,
        wardrobe_item_id UUID, scene_id UUID, attachment_point TEXT, offset_seconds DECIMAL(10,3),
        absolute_timestamp DECIMAL(10,3), track_number INTEGER, duration DECIMAL(10,3), z_index INTEGER,
        properties JSONB DEFAULT '{}'::jsonb, character VARCHAR(100), label VARCHAR(255), visual_role TEXT,
        created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ)`);
      createdPlacementsTable = true;
    }
  });

  let genSpy;
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    genSpy = jest.spyOn(imageGen, 'generateImageUrl').mockImplementation(async () => `https://img.test/${uuid()}.png`);
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    for (const k of Object.keys(savedEnv)) { if (savedEnv[k] !== undefined) process.env[k] = savedEnv[k]; }
    for (const show of shows) {
      const eps = '(SELECT id FROM episodes WHERE show_id = :show)';
      await run(`DELETE FROM timeline_placements WHERE episode_id IN ${eps}`, { show }).catch((err) => console.warn('cleanup placements:', err.message));
      await run(`UPDATE world_events SET invitation_asset_id = NULL WHERE show_id = :show`, { show });
      await run('DELETE FROM assets WHERE show_id = :show', { show });
      await run('DELETE FROM world_events WHERE show_id = :show', { show });
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
    if (createdPlacementsTable) await run('DROP TABLE IF EXISTS timeline_placements');
    await sequelize.close();
  });

  async function seed() {
    const ids = { show: uuid(), ep: uuid(), event: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `P15 ${ids.show.slice(0, 8)}`, slug: `p15-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Gala Night', 3, 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, prestige, created_at, updated_at)
               VALUES (:event, :show, 'Velvet Gala', 'used', :ep, 5, NOW(), NOW())`, ids);
    return ids;
  }

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const overlays = (ids) => auth(request(app).get(`/api/v1/episodes/${ids.ep}/overlays`));
  const byKey = (res) => Object.fromEntries(res.body.data.pieces.map((p) => [p.key, p]));

  it('nothing made: four pieces, not made, with their costs; no image call', async () => {
    const ids = await seed();
    const res = await overlays(ids);
    expect(res.status).toBe(200);
    expect(res.body.data.pieces.map((p) => [p.key, p.status])).toEqual([
      ['title_overlay', 'not_made'], ['framed_card', 'not_made'], ['invitation', 'not_made'], ['task_list', 'not_made'],
    ]);
    const pieces = byKey(res);
    expect(pieces.invitation.event).toEqual({ id: ids.event, show_id: ids.show, name: 'Velvet Gala' });
    expect(pieces.invitation.cost.paid.action).toBe('Generate the invitation');
    expect(pieces.invitation.cost.paid.estimate).toHaveProperty('usd');
    expect(pieces.title_overlay.needs_title_approval).toBe(true);
    expect(res.body.data.title_chip).toEqual({ status: 'not_made', piece: 'title_overlay' });
    expect(genSpy).not.toHaveBeenCalled();
  });

  it('a saved title overlay is approved; a changed title makes it outdated; the chip follows', async () => {
    const ids = await seed();
    expect((await auth(request(app).post(`/api/v1/episodes/${ids.ep}/title/approve`)).send({ title: 'Gala Night' })).status).toBe(200);
    expect((await auth(request(app).post(`/api/v1/episodes/${ids.ep}/title-overlay`)).send({ variant: 'classic' })).status).toBe(200);

    let res = await overlays(ids);
    let pieces = byKey(res);
    expect(pieces.title_overlay).toMatchObject({ status: 'approved', made_for: 'Gala Night', needs_title_approval: false });
    expect(pieces.title_overlay.image_url).toMatch(/^data:image\/png|^https?:/);
    expect(pieces.title_overlay.cost.paid.action).toBe('Decorative flourish');
    expect(pieces.framed_card.cost.paid.action).toBe('Design the card');
    expect(res.body.data.title_chip).toEqual({ status: 'approved', piece: 'title_overlay' });

    await run(`UPDATE episodes SET title = 'Gala Night Two' WHERE id = :ep`, ids);
    res = await overlays(ids);
    pieces = byKey(res);
    expect(pieces.title_overlay).toMatchObject({ status: 'outdated', made_for: 'Gala Night' });
    expect(res.body.data.title_chip.status).toBe('outdated');
    expect(genSpy).not.toHaveBeenCalled();
  });

  it("the event's approved invitation is approved, with its placed beat", async () => {
    const ids = await seed();
    const asset = uuid();
    await run(`INSERT INTO assets (id, show_id, episode_id, name, asset_type, approval_status, s3_url_processed, metadata, created_at, updated_at)
               VALUES (:asset, :show, :ep, 'Invitation', 'PROMO', 'approved', 'https://img.test/inv.png',
                       CAST('{"episode_invitation":true}' AS jsonb), NOW(), NOW())`, { ...ids, asset });
    await run(`UPDATE world_events SET invitation_asset_id = :asset WHERE id = :event`, { ...ids, asset });
    await run(`INSERT INTO timeline_placements (id, episode_id, placement_type, asset_id, label, properties, created_at, updated_at)
               VALUES (:id, :ep, 'overlay', :asset, 'Invitation — Beat 5: Reveal',
                       CAST('{"anchor":"beat","beat_number":5,"beat_name":"Reveal"}' AS jsonb), NOW(), NOW())`,
    { ...ids, asset, id: uuid() });

    const pieces = byKey(await overlays(ids));
    expect(pieces.invitation).toMatchObject({
      status: 'approved', image_url: 'https://img.test/inv.png', asset_id: asset,
      beat: { number: 5, name: 'Reveal', anchor: 'beat', label: 'Invitation — Beat 5: Reveal' },
    });
    expect(pieces.invitation.cost.paid.action).toBe('Regenerate the invitation');
  });

  it('an unknown episode is 404; no login is 401', async () => {
    expect((await auth(request(app).get(`/api/v1/episodes/${uuid()}/overlays`))).status).toBe(404);
    const ids = await seed();
    expect((await request(app).get(`/api/v1/episodes/${ids.ep}/overlays`)).status).toBe(401);
  });
});
