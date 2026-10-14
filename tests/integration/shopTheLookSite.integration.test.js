/**
 * Shop the Look on the website (Task #3021; The Pulse spec §10; Evoni,
 * 2026-10-12: public only when she publishes it, and she can take it
 * down), against the test database:
 * - publish and take down are ADMIN only; publish needs the sheet sent,
 *   its Shop the Look links included, and a piece with a link;
 * - the public list and one look: title, caption, links read live, and the
 *   disclosure first; no episode, show or wardrobe ids, no prices;
 * - publishing again and sending again keep the public key; turning the
 *   links off hides it; taking it down, or removing the sheet from
 *   Distribution, makes it a 404.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { DISCLOSURE } = require('../../src/services/styleSheetDistributionService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('Shop the Look on the website (Task #3021)', () => {
  let admin;
  let editor;
  const shows = [];
  const profiles = [];
  const savedBuckets = {};

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    for (const k of ['S3_PRIMARY_BUCKET', 'AWS_S3_BUCKET', 'SITE_PUBLIC_BUCKET']) { savedBuckets[k] = process.env[k]; delete process.env[k]; }
    admin = TokenService.generateTokenPair({ id: 'test-admin-shop', email: 'evoni@shop.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-shop', email: 'ed@shop.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
  });

  afterAll(async () => {
    for (const [k, v] of Object.entries(savedBuckets)) if (v !== undefined) process.env[k] = v;
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
  const send = (ep, includeShopLinks = true) => as(admin, request(app).post(distUrl(ep))).send({ include_shop_links: includeShopLinks });
  const publicList = async () => (await request(app).get('/api/v1/public/looks')).body.looks;

  it('publish and take down need an ADMIN; publish needs the sheet sent, links included, and a link', async () => {
    const ids = await seed();
    expect((await request(app).post(siteUrl(ids.ep))).status).toBe(401);
    expect((await as(editor, request(app).post(siteUrl(ids.ep)))).status).toBe(403);
    expect((await as(editor, request(app).delete(siteUrl(ids.ep)))).status).toBe(403);
    const notSent = await as(admin, request(app).post(siteUrl(ids.ep)));
    expect([notSent.status, notSent.body.code]).toEqual([404, 'NOT_SENT']);
    expect((await send(ids.ep, false)).status).toBe(200);
    const noLinks = await as(admin, request(app).post(siteUrl(ids.ep)));
    expect([noLinks.status, noLinks.body.code]).toEqual([409, 'NO_SHOP_LINKS']);

    const bare = await seed({ bare: true });
    expect((await send(bare.ep)).status).toBe(200);
    const none = await as(admin, request(app).post(siteUrl(bare.ep)));
    expect([none.status, none.body.code]).toEqual([409, 'NO_LINKS']);
  });

  it('a published look is on the website: links live, the disclosure first, no ids and no prices', async () => {
    const ids = await seed();
    expect((await send(ids.ep)).body.data.site).toEqual({ published: false });
    const res = await as(admin, request(app).post(siteUrl(ids.ep)));
    expect(res.status).toBe(200);
    const { site } = res.body.data;
    expect(site).toMatchObject({ published: true, showing: true });
    expect(site.key).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(site.path).toBe(`/shop-the-look/${site.key}`);

    const listed = (await publicList()).find((l) => l.key === site.key);
    expect(listed).toMatchObject({ key: site.key, title: 'Episode 1: Wearable Experiments' });
    // image is the look strip in the public bucket (Task #3120); none here, without SITE_PUBLIC_BUCKET.
    expect(Object.keys(listed).sort()).toEqual(['image', 'key', 'published_at', 'title']);
    expect(listed.image).toBeNull();

    const one = await request(app).get(`/api/v1/public/looks/${site.key}`);
    expect(one.status).toBe(200);
    expect(one.body.look).toMatchObject({ key: site.key, title: 'Episode 1: Wearable Experiments', disclosure: DISCLOSURE });
    expect(one.body.look.caption.length).toBeGreaterThan(0);
    expect(one.body.look.links).toEqual([
      { label: 'Maison Rouge Satin Ballet Pump', retailer: 'Nordstrom', url: 'https://shop.example/pump', affiliate: false },
      { label: 'Crimson Bloom Enamel Stud Earrings', retailer: null, url: 'https://aff.example/studs?ref=lala', affiliate: true },
    ]);
    const body = JSON.stringify(one.body);
    for (const id of [ids.ep, ids.show, ids.pump, ids.studs, ids.event]) expect(body).not.toContain(id);
    expect(body).not.toMatch(/price|128|420/);

    // Read live: a piece's link edited after publishing shows at once.
    await run('UPDATE wardrobe SET real_product_url = :u WHERE id = :id', { u: 'https://shop.example/pump-2', id: ids.pump });
    const again = await request(app).get(`/api/v1/public/looks/${site.key}`);
    expect(again.body.look.links[0].url).toBe('https://shop.example/pump-2');
  });

  it('publishing again and sending again keep the key; links off hides it; take down and remove are a 404', async () => {
    const ids = await seed();
    await send(ids.ep);
    const { key } = (await as(admin, request(app).post(siteUrl(ids.ep)))).body.data.site;
    expect((await as(admin, request(app).post(siteUrl(ids.ep)))).body.data.site.key).toBe(key);
    expect((await send(ids.ep)).body.data.site).toMatchObject({ published: true, key, showing: true });

    const off = await as(admin, request(app).patch(distUrl(ids.ep))).send({ include_shop_links: false });
    expect(off.body.data.site).toMatchObject({ published: true, showing: false });
    expect((await request(app).get(`/api/v1/public/looks/${key}`)).status).toBe(404);
    expect((await publicList()).map((l) => l.key)).not.toContain(key);
    await as(admin, request(app).patch(distUrl(ids.ep))).send({ include_shop_links: true });
    expect((await request(app).get(`/api/v1/public/looks/${key}`)).status).toBe(200);

    const down = await as(admin, request(app).delete(siteUrl(ids.ep)));
    expect([down.status, down.body.data.site]).toEqual([200, { published: false }]);
    expect((await request(app).get(`/api/v1/public/looks/${key}`)).status).toBe(404);
    expect((await publicList()).map((l) => l.key)).not.toContain(key);

    const key2 = (await as(admin, request(app).post(siteUrl(ids.ep)))).body.data.site.key;
    expect((await request(app).get(`/api/v1/public/looks/${key2}`)).status).toBe(200);
    expect((await as(admin, request(app).delete(distUrl(ids.ep)))).status).toBe(200);
    expect((await request(app).get(`/api/v1/public/looks/${key2}`)).status).toBe(404);
  });

  it('an unknown or malformed key is a 404', async () => {
    expect((await request(app).get('/api/v1/public/looks/AAAAAAAAAAAA')).status).toBe(404);
    expect((await request(app).get('/api/v1/public/looks/not-a-key')).status).toBe(404);
    expect((await request(app).get('/api/v1/public/looks/%25%25%25%25%25%25%25%25%25%25%25%25')).status).toBe(404);
  });
});
