/**
 * A published Shop the Look shows the look strip (Task #3120; Evoni,
 * 2026-10-13: "The look only" export, drawn when she publishes and copied
 * to the public site bucket), against the test database. The drawing and
 * the bucket are stood in for:
 * - publishing draws the look and stores it under the look's public key;
 *   the public look and the list send { url, alt } from the bucket; the
 *   Distribution card reads image 'on_site';
 * - publishing again draws it again, under a new object key;
 * - a drawing that fails is logged and marked 'failed'; the look still
 *   publishes, text only;
 * - sending a re-approved, changed look drops the old image until she
 *   publishes again;
 * - without SITE_PUBLIC_BUCKET nothing is drawn and the look is text only;
 * - unstubbed, the drawing is the sheet's "look" export, a PNG.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const distribution = require('../../src/services/styleSheetDistributionService');
const slots = require('../../src/services/websiteSlotService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('The look strip on the public Shop the Look (Task #3120)', () => {
  let admin;
  const shows = [];
  const profiles = [];
  const saved = {};
  let stored;
  let drawn;
  const PNG = Buffer.from('look-strip-png');

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    for (const k of ['S3_PRIMARY_BUCKET', 'AWS_S3_BUCKET', 'SITE_PUBLIC_BUCKET', 'SITE_PUBLIC_CDN', 'SITE_PUBLIC_PREFIX']) { saved[k] = process.env[k]; delete process.env[k]; }
    admin = TokenService.generateTokenPair({ id: 'test-admin-look-img', email: 'evoni@lookimg.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
  });

  beforeEach(() => {
    process.env.SITE_PUBLIC_BUCKET = 'lalaverse-site-test';
    process.env.SITE_PUBLIC_CDN = 'site.cdn.test';
    stored = [];
    drawn = [];
    jest.spyOn(slots, 'putObject').mockImplementation(async (cfg, key, buffer, type) => { stored.push({ bucket: cfg.bucket, key, buffer, type }); });
    jest.spyOn(distribution, 'drawLook').mockImplementation(async (m, episodeId) => { drawn.push(episodeId); return { buffer: PNG, type: 'image/png', ext: 'png' }; });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    delete process.env.SITE_PUBLIC_BUCKET;
    delete process.env.SITE_PUBLIC_CDN;
  });

  afterAll(async () => {
    for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v;
    for (const show of shows) {
      await run('DELETE FROM episode_lookbook_images WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)', { show });
      await run('DELETE FROM episode_lookbooks WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)', { show });
      await run('DELETE FROM episode_wardrobe WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)', { show });
      await run('DELETE FROM wardrobe WHERE show_id = :show', { show });
      await run('DELETE FROM world_events WHERE show_id = :show', { show });
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
    for (const id of profiles) await run('DELETE FROM social_profiles WHERE id = :id', { id });
  });

  const as = (token, req) => req.set('Authorization', `Bearer ${token}`);
  const distUrl = (ep) => `/api/v1/episodes/${ep}/style-sheet/distribution`;
  const siteUrl = (ep) => `${distUrl(ep)}/site`;

  /** An episode with an event, a look of two pieces (one an affiliate link, unless bare), and a tagline. */
  async function seed({ bare = false } = {}) {
    const ids = { show: uuid(), ep: uuid(), event: uuid() };
    shows.push(ids.show);
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())',
      { ...ids, name: `Shop ${ids.show.slice(0, 8)}`, slug: `shop-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Wearable Experiments', 1, 'draft', NOW(), NOW())`, ids);
    const [[profile]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, created_at, updated_at)
               VALUES (:handle, 'instagram', 'A studio.', 'STUDIO BY SABLE', NOW(), NOW()) RETURNING id`, { handle: `shop_${ids.show.slice(0, 6)}` });
    profiles.push(profile.id);
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, source_profile_id, format, created_at, updated_at)
               VALUES (:event, :show, 'Wearable Experiments Studio Session', 'used', :ep, :profile, 'Studio session', NOW(), NOW())`,
      { ...ids, profile: profile.id });
    const pump = await models.Wardrobe.create({
      name: 'Crimson Satin Ballerina Pump', clothing_category: 'shoes', show_id: ids.show, price: 420,
      ...(bare ? {} : { real_brand: 'Maison Rouge', real_product_name: 'Satin Ballet Pump', real_retailer: 'Nordstrom', real_product_url: 'https://shop.example/pump', real_price_paid: 128 }),
    });
    const studs = await models.Wardrobe.create({
      name: 'Crimson Bloom Enamel Stud Earrings', clothing_category: 'jewelry', show_id: ids.show,
      ...(bare ? {} : { real_product_url: 'https://shop.example/studs', affiliate_url: 'https://aff.example/studs?ref=lala' }),
    });
    for (const w of [pump, studs]) {
      await run(`INSERT INTO episode_wardrobe (id, episode_id, wardrobe_id, approval_status, created_at, updated_at)
                 VALUES (:id, :ep, :w, 'pending', NOW(), NOW())`, { id: uuid(), ep: ids.ep, w: w.id });
    }
    await as(admin, request(app).put(`/api/v1/episodes/${ids.ep}/lookbook`)).send({ tagline: 'Every look tells a story.' });
    expect((await as(admin, request(app).post(`/api/v1/episodes/${ids.ep}/style-sheet/approve`))).status).toBe(200);
    return { ...ids, pump: pump.id, studs: studs.id };
  }
  const send = (ep) => as(admin, request(app).post(distUrl(ep))).send({ include_shop_links: true });
  const publish = (ep) => as(admin, request(app).post(siteUrl(ep)));
  const publicLook = async (key) => (await request(app).get(`/api/v1/public/looks/${key}`)).body.look;
  const listed = async (key) => (await request(app).get('/api/v1/public/looks')).body.looks.find((l) => l.key === key);

  it('publishing draws the look strip into the public bucket; the public look and list show it', async () => {
    const ids = await seed();
    await send(ids.ep);
    const res = await publish(ids.ep);
    expect(res.status).toBe(200);
    const { site } = res.body.data;
    expect(site.image).toBe('on_site');
    expect(drawn).toEqual([ids.ep]);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ bucket: 'lalaverse-site-test', type: 'image/png', buffer: PNG });
    expect(stored[0].key).toMatch(new RegExp(`^site-public/looks/${site.key}/[0-9a-f-]{36}\\.png$`));

    const image = { url: `https://site.cdn.test/${stored[0].key}`, alt: 'The look: Episode 1: Wearable Experiments' };
    expect((await publicLook(site.key)).image).toEqual(image);
    expect((await listed(site.key)).image).toEqual(image);

    // Publishing again draws it again, under a new key; the page keeps its key.
    const again = await publish(ids.ep);
    expect(again.body.data.site.key).toBe(site.key);
    expect(stored).toHaveLength(2);
    expect(stored[1].key).not.toBe(stored[0].key);
    expect((await publicLook(site.key)).image.url).toBe(`https://site.cdn.test/${stored[1].key}`);

    // Taken down, nothing of it is public.
    await as(admin, request(app).delete(siteUrl(ids.ep)));
    expect((await request(app).get(`/api/v1/public/looks/${site.key}`)).status).toBe(404);
  });

  it('a drawing that fails is marked failed and the look still publishes, text only', async () => {
    const ids = await seed();
    await send(ids.ep);
    distribution.drawLook.mockRejectedValueOnce(new Error('canvas exploded'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await publish(ids.ep);
    expect(res.status).toBe(200);
    expect(res.body.data.site).toMatchObject({ published: true, showing: true, image: 'failed' });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('could not be copied to the public site'), 'canvas exploded');
    expect(stored).toHaveLength(0);
    expect((await publicLook(res.body.data.site.key)).image).toBeNull();
    // Trying again copies it.
    expect((await publish(ids.ep)).body.data.site.image).toBe('on_site');
  });

  it('sending a re-approved, changed look drops the old image until it is published again', async () => {
    const ids = await seed();
    await send(ids.ep);
    const { key } = (await publish(ids.ep)).body.data.site;
    expect((await publicLook(key)).image).not.toBeNull();

    // Sending the same approved sheet again keeps the image.
    expect((await send(ids.ep)).body.data.site.image).toBe('on_site');

    expect((await as(admin, request(app).post(`/api/v1/episodes/${ids.ep}/style-sheet/reopen`))).status).toBe(200);
    await as(admin, request(app).put(`/api/v1/episodes/${ids.ep}/lookbook`)).send({ tagline: 'A new story, a new look.' });
    expect((await as(admin, request(app).post(`/api/v1/episodes/${ids.ep}/style-sheet/approve`))).status).toBe(200);
    const resent = await send(ids.ep);
    expect(resent.body.data.site).toMatchObject({ published: true, key, image: 'none' });
    expect((await publicLook(key)).image).toBeNull();

    expect((await publish(ids.ep)).body.data.site.image).toBe('on_site');
    expect((await publicLook(key)).image).not.toBeNull();
  });

  it('the real drawing is the approved sheet\'s look export, a PNG', async () => {
    const ids = await seed();
    distribution.drawLook.mockRestore();
    const out = await distribution.drawLook(models, ids.ep);
    expect(out.type).toBe('image/png');
    expect(out.buffer.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(out.filename).toMatch(/-look\.png$/);
  });

  it('without SITE_PUBLIC_BUCKET nothing is drawn and the look is text only', async () => {
    delete process.env.SITE_PUBLIC_BUCKET;
    const ids = await seed();
    await send(ids.ep);
    const res = await publish(ids.ep);
    expect(res.body.data.site).toMatchObject({ published: true, image: 'none' });
    expect(drawn).toEqual([]);
    expect(stored).toEqual([]);
    expect((await publicLook(res.body.data.site.key)).image).toBeNull();
  });
});
