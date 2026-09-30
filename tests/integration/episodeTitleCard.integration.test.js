/**
 * Integration Tests - episode title approval and title card (Task #2386,
 * ruling P11; 20261001120000-add-episode-title-approval-and-card).
 *
 * Against the test database, through the app: approving returns the design
 * offer with its estimate; designing (image provider mocked, no S3 bucket)
 * creates an assets row that belongs to the episode, with the show's style
 * and the event's visual direction in its prompt, and sets the card fields;
 * changing the title clears the approval and marks the card outdated;
 * a redesign replaces the previous card; a budget refusal is a 429.
 */
jest.unmock('uuid');

const { Sequelize } = require('sequelize');
const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const imageGen = require('../../src/services/imageGenerationService');
const migration = require('../../src/migrations/20261001120000-add-episode-title-approval-and-card');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const one = async (sql, replacements = {}) =>
  (await sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT }))[0];

(shouldSkip ? describe.skip : describe)('Episode title approval + title card (P11)', () => {
  const shows = [];
  const savedEnv = {};
  let token;

  beforeAll(async () => {
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    await migration.up(sequelize.getQueryInterface(), Sequelize); // guarded: a re-run is a no-op
    token = TokenService.generateTokenPair({
      id: 'test-user-title-card', email: 'test@title-card.dev', name: 'Title Card',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    for (const k of ['S3_PRIMARY_BUCKET', 'AWS_S3_BUCKET']) { savedEnv[k] = process.env[k]; delete process.env[k]; }
  });

  async function seed({ withEvent = true } = {}) {
    const ids = { show: uuid(), ep: uuid(), event: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, style_prefix, created_at, updated_at)
               VALUES (:show, :name, :slug, 'SHOW STYLE: pastel watercolour, hand-drawn.', NOW(), NOW())`,
      { ...ids, name: `Title ${ids.show.slice(0, 8)}`, slug: `title-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Gala Night', 3, 'draft', NOW(), NOW())`, ids);
    if (withEvent) {
      await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, prestige, theme, color_palette,
                   created_at, updated_at)
                 VALUES (:event, :show, 'Velvet Gala', 'used', :ep, 9, 'soft glam', CAST('["blush","rose gold"]' AS jsonb), NOW(), NOW())`,
        ids);
    }
    return ids;
  }

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const getState = (ids) => auth(request(app).get(`/api/v1/episodes/${ids.ep}/title-card`));
  const approve = (ids, body = {}) => auth(request(app).post(`/api/v1/episodes/${ids.ep}/title/approve`)).send(body);
  const design = (ids) => auth(request(app).post(`/api/v1/episodes/${ids.ep}/title-card`));
  const liveCards = (ids) => sequelize.query(
    `SELECT id, show_id, episode_id, metadata FROM assets
      WHERE episode_id = :ep AND asset_role = 'UI.OVERLAY.EPISODE_TITLE' AND deleted_at IS NULL`,
    { replacements: ids, type: sequelize.QueryTypes.SELECT },
  );

  let genSpy;
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    genSpy = jest.spyOn(imageGen, 'generateImageUrl').mockImplementation(async () => `https://img.test/${uuid()}.png`);
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    for (const k of Object.keys(savedEnv)) { if (savedEnv[k] !== undefined) process.env[k] = savedEnv[k]; }
    for (const show of shows) {
      await run(`DELETE FROM assets WHERE show_id = :show`, { show });
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
    await sequelize.close();
  });

  it('the four columns exist and are nullable', async () => {
    const cols = await sequelize.query(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns
        WHERE table_name = 'episodes' AND column_name IN
          ('title_approved_at','title_approved_value','title_card_asset_id','title_card_title')
        ORDER BY column_name`,
      { type: sequelize.QueryTypes.SELECT },
    );
    expect(cols).toEqual([
      { column_name: 'title_approved_at', data_type: 'timestamp with time zone', is_nullable: 'YES' },
      { column_name: 'title_approved_value', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'title_card_asset_id', data_type: 'uuid', is_nullable: 'YES' },
      { column_name: 'title_card_title', data_type: 'text', is_nullable: 'YES' },
    ]);
  });

  it('design before approval is refused (409 TITLE_NOT_APPROVED) and no image is generated', async () => {
    const ids = await seed();
    const res = await design(ids);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('TITLE_NOT_APPROVED');
    expect(genSpy).not.toHaveBeenCalled();
  });

  it('approve → offer with estimate; design → the card belongs to the episode; title change → outdated; redesign replaces', async () => {
    const ids = await seed();

    const before = await getState(ids);
    expect(before.status).toBe(200);
    expect(before.body.data).toMatchObject({ approved: false, card: null, offer: { offered: false } });

    // Approve: stale title is refused, the current one approved.
    expect((await approve(ids, { title: 'Old name' })).status).toBe(409);
    const ap = await approve(ids, { title: 'Gala Night' });
    expect(ap.status).toBe(200);
    expect(ap.body.title_card_offer).toEqual({
      offered: true, kind: 'design', requires_approval: false,
      estimate: { usd: 0.04, priced: true, unit: 'megapixel', units: 1, model: 'fal-ai/flux-pro/v1.1' },
    });
    const approvedRow = await one('SELECT title_approved_at, title_approved_value FROM episodes WHERE id = :ep', ids);
    expect(approvedRow.title_approved_at).not.toBeNull();
    expect(approvedRow.title_approved_value).toBe('Gala Night');

    // Design.
    const d1 = await design(ids);
    expect(d1.status).toBe(200);
    expect(genSpy).toHaveBeenCalledTimes(1);
    const [prompt, options] = genSpy.mock.calls[0];
    expect(options).toEqual({ size: 'landscape', quality: 'hd', useCase: 'invitation' });
    expect(prompt.startsWith('SHOW STYLE: pastel watercolour, hand-drawn.')).toBe(true); // the show's style, not the default
    expect(prompt).toContain('(soft glam theme)');
    expect(prompt).toContain('Color palette emphasis: blush, rose gold.');
    expect(prompt).toContain('Center text reading "Gala Night"');
    expect(prompt).toContain('"Episode 3"');

    const cards1 = await liveCards(ids);
    expect(cards1).toHaveLength(1);
    expect(cards1[0]).toMatchObject({ id: d1.body.data.assetId, show_id: ids.show, episode_id: ids.ep });
    expect(cards1[0].metadata).toMatchObject({ event_id: ids.event, theme: 'soft glam', episode_title: 'Gala Night' });
    const ep1 = await one('SELECT title_card_asset_id, title_card_title FROM episodes WHERE id = :ep', ids);
    expect(ep1).toEqual({ title_card_asset_id: d1.body.data.assetId, title_card_title: 'Gala Night' });
    expect(d1.body.data.state.card).toMatchObject({ outdated: false, designed_for: 'Gala Night' });
    expect(d1.body.data.state.offer).toEqual({ offered: false });

    // Change the title through the ordinary episode update.
    const put = await auth(request(app).put(`/api/v1/episodes/${ids.ep}`)).send({ title: 'Gala Night: Encore' });
    expect(put.status).toBe(200);
    const ep2 = await one('SELECT title_approved_at, title_approved_value, title_card_title FROM episodes WHERE id = :ep', ids);
    expect(ep2.title_approved_at).toBeNull();
    expect(ep2.title_approved_value).toBe('Gala Night');
    const changed = await getState(ids);
    expect(changed.body.data).toMatchObject({
      approved: false,
      card: { outdated: true, designed_for: 'Gala Night' },
      offer: { offered: true, kind: 'redesign', requires_approval: true },
    });
    expect(changed.body.data.card.image_url).toMatch(/^https:\/\/img\.test\//);

    // The redesign still needs the new title approved.
    expect((await design(ids)).status).toBe(409);
    expect((await approve(ids, { title: 'Gala Night: Encore' })).body.title_card_offer)
      .toMatchObject({ offered: true, kind: 'redesign', requires_approval: false });
    const d2 = await design(ids);
    expect(d2.status).toBe(200);
    expect(d2.body.data.replaced).toBe(d1.body.data.assetId);
    expect(genSpy.mock.calls[1][0]).toContain('Center text reading "Gala Night: Encore"');

    const cards2 = await liveCards(ids);
    expect(cards2.map((c) => c.id)).toEqual([d2.body.data.assetId]);
    const old = await one('SELECT deleted_at FROM assets WHERE id = :id', { id: d1.body.data.assetId });
    expect(old.deleted_at).not.toBeNull();
    const ep3 = await one('SELECT title_card_asset_id, title_card_title FROM episodes WHERE id = :ep', ids);
    expect(ep3).toEqual({ title_card_asset_id: d2.body.data.assetId, title_card_title: 'Gala Night: Encore' });
  });

  it('Producer Mode route goes through the same service; with no source event the card keeps the house look', async () => {
    const ids = await seed({ withEvent: false });
    const url = `/api/v1/world/${ids.show}/episodes/${ids.ep}/generate-title-overlay`;
    const refused = await auth(request(app).post(url));
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('TITLE_NOT_APPROVED');

    await approve(ids);
    const res = await auth(request(app).post(url));
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Gala Night');
    const prompt = genSpy.mock.calls[0][0];
    expect(prompt.startsWith('SHOW STYLE: pastel watercolour, hand-drawn.')).toBe(true);
    expect(prompt).toContain('Elegant dark background (#1A1A1A)');
    expect(await liveCards(ids)).toHaveLength(1);

    // Another show's id does not reach this episode.
    const other = await auth(request(app).post(`/api/v1/world/${uuid()}/episodes/${ids.ep}/generate-title-overlay`));
    expect(other.status).toBe(404);
    expect(other.body.stale_link_cleared).toBeUndefined();
  });

  it('a budget refusal is a 429 with its message, and nothing is written', async () => {
    const ids = await seed();
    await approve(ids);
    genSpy.mockImplementation(async () => {
      const err = new Error('Daily image budget reached ($10.00). Try again tomorrow.');
      err.status = 429;
      err.code = 'AI_BUDGET_EXCEEDED';
      throw err;
    });
    const res = await design(ids);
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('Daily image budget reached ($10.00). Try again tomorrow.');
    expect(await liveCards(ids)).toHaveLength(0);
    const ep = await one('SELECT title_card_asset_id FROM episodes WHERE id = :ep', ids);
    expect(ep.title_card_asset_id).toBeNull();
  });
});
