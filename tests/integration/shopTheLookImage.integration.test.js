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
  let seedN = 0;
  const seedFrom = (r) => { seedN += 1; return r.set('X-Forwarded-For', `198.51.118.${(seedN % 250) + 1}`); };
  const distUrl = (ep) => `/api/v1/episodes/${ep}/style-sheet/distribution`;
  const siteUrl = (ep) => `${distUrl(ep)}/site`;

  /** An episode with an event, a look of two pieces (one an affiliate link, unless bare), and a tagline. */
  async function seed({ bare = false } = {}) {
    const ids = { show: uuid(), ep: uuid(), event: uuid() };
    shows.push(ids.show);
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())',
      { ...ids, name: `Shop ${ids.show.slice(0, 8)}`, slug: `shop-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Wearable Experiments', 1, 'published', NOW(), NOW())`, ids);
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
    // Each seeded look comes from its own address: these routes are rate limited by address, and the suite seeds many.
    await as(admin, seedFrom(request(app).put(`/api/v1/episodes/${ids.ep}/lookbook`))).send({ tagline: 'Every look tells a story.' });
    expect((await as(admin, seedFrom(request(app).post(`/api/v1/episodes/${ids.ep}/style-sheet/approve`)))).status).toBe(200);
    return { ...ids, pump: pump.id, studs: studs.id };
  }
  const send = (ep) => as(admin, request(app).post(distUrl(ep))).send({ include_shop_links: true });
  // What she confirms when she publishes: each piece that has a link, with its real brand, product, retailer,
  // address, whether the link is an affiliate's and whether it is the piece itself. `over` corrects a piece by id.
  const confirmAll = async (ep, over = {}) => ((await as(admin, request(app).get(distUrl(ep)))).body.data.site_review || [])
    .filter((p) => p.url)
    .map((p) => ({
      piece_id: p.piece_id, real_brand: p.real_brand || 'Bloom Atelier', real_product_name: p.real_product_name || 'Enamel Stud Earrings',
      retailer: p.retailer || 'Etsy', url: p.url, affiliate: p.affiliate, match: 'exact', confirmed: true, ...(over[p.piece_id] || {}),
    }));
  // The older tests here publish an image she has cleared ("original"); what the declaration decides is the last block.
  const publish = async (ep, over = {}, imageRights = { category: 'original' }) => as(admin, request(app).post(siteUrl(ep)))
    .send({ links: await confirmAll(ep, over), ...(imageRights === null ? {} : { image_rights: imageRights }) });
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

  it('sending a re-approved, changed look keeps the published image until it is published again', async () => {
    const ids = await seed();
    await send(ids.ep);
    const { key } = (await publish(ids.ep)).body.data.site;
    expect((await publicLook(key)).image).not.toBeNull();

    // Sending the same approved sheet again keeps the image.
    expect((await send(ids.ep)).body.data.site.image).toBe('on_site');

    expect((await as(admin, request(app).post(`/api/v1/episodes/${ids.ep}/style-sheet/reopen`))).status).toBe(200);
    await as(admin, request(app).put(`/api/v1/episodes/${ids.ep}/lookbook`)).send({ tagline: 'A new story, a new look.' });
    expect((await as(admin, request(app).post(`/api/v1/episodes/${ids.ep}/style-sheet/approve`))).status).toBe(200);
    // A snapshot (Evoni, 2026-11-15): sending another look leaves the published image as it is, and
    // Distribution says the image is of the earlier sheet. Publishing again draws the new one.
    const before = (await publicLook(key)).image;
    const resent = await send(ids.ep);
    expect(resent.body.data.site).toMatchObject({ published: true, key, image: 'on_site' });
    expect(resent.body.data.site.differs).toContain('image');
    expect((await publicLook(key)).image).toEqual(before);

    const again = await publish(ids.ep);
    expect(again.body.data.site.image).toBe('on_site');
    expect(again.body.data.site.differs).toEqual([]);
    expect((await publicLook(key)).image).not.toEqual(before);
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
  describe("the look image is public only when she has cleared it (Evoni, 2026-11-15)", () => {
    let ipN = 0;
    const from = (r) => { ipN += 1; return r.set('X-Forwarded-For', `198.51.115.${(ipN % 250) + 1}`); };
    const look = async (key) => (await from(request(app).get(`/api/v1/public/looks/${key}`)));
    const dist = async (ep) => (await as(admin, from(request(app).get(distUrl(ep))))).body.data;
    const siteOf = async (ep) => {
      const [[row]] = await run('SELECT distribution_metadata FROM episodes WHERE id = :ep', { ep });
      const meta = typeof row.distribution_metadata === 'string' ? JSON.parse(row.distribution_metadata) : row.distribution_metadata;
      return { meta, site: meta.style_sheet.site };
    };
    const saveSite = async (ep, meta) => models.Episode.update({ distribution_metadata: meta }, { where: { id: ep } });
    let ids;
    beforeAll(async () => {
      ids = await seed();
      // The episode is released, so the website would show the look and its image (the release gate).
      await run(`UPDATE episodes SET status = 'published' WHERE id = :ep`, ids);
      expect((await send(ids.ep)).status).toBe(200);
    });

    it('each cleared category puts the image on the website, with who declared it and when; the note stays private', async () => {
      const cases = [
        ['original', 'Original photograph — owned or controlled', undefined],
        ['licensed', 'Licensed image — permission held', 'Licence LIC-2291, held in Contracts'],
        ['retailer', 'Retailer image — permission held', 'Brand programme email of 3 Nov'],
        ['ai_cleared', 'AI-generated image — cleared for public use', 'Made in-house; provider terms checked'],
      ];
      for (const [category, label, note] of cases) {
        stored.length = 0;
        const res = await publish(ids.ep, {}, { category, ...(note ? { note } : {}) });
        expect([category, res.status]).toEqual([category, 200]);
        const { site } = res.body.data;
        expect([category, site.image]).toEqual([category, 'on_site']);
        expect(site.image_rights).toMatchObject({ category, label, cleared: true, note: note || null, declared_by: 'evoni@lookimg.dev', stale: false });
        expect(Number.isNaN(Date.parse(site.image_rights.declared_at))).toBe(false);
        expect(stored).toHaveLength(1);
        // Saved with the declaration: the very copy, the sheet it was drawn from, and the three poses.
        const saved2 = (await siteOf(ids.ep)).site;
        expect(saved2.image_rights).toMatchObject({ category, cleared: true, image_key: stored[0].key, sheet_hash: saved2.image.sheet_hash });
        expect(Object.keys(saved2.image_rights.poses).sort()).toEqual(['back', 'front', 'side']);
        const shown = await look(site.key);
        expect(shown.body.look.image).toEqual({ url: `https://site.cdn.test/${stored[0].key}`, alt: 'The look: Episode 1: Wearable Experiments' });
        // Nothing of the declaration is public.
        expect(JSON.stringify(shown.body)).not.toMatch(/image_rights|declared|LIC-2291|Brand programme|provider terms|evoni@/);
      }
    });

    it('"unknown / not cleared", or no declaration: the look is published as text and links; no image is drawn, copied or shown', async () => {
      for (const rights of [{ category: 'unknown' }, { category: 'unknown', note: 'found online' }, null]) {
        stored.length = 0; drawn.length = 0;
        const res = await publish(ids.ep, {}, rights);
        expect(res.status).toBe(200);
        const { site } = res.body.data;
        expect(site).toMatchObject({ published: true, showing: true, image: 'not_cleared' });
        if (rights) expect(site.image_rights).toMatchObject({ category: 'unknown', label: 'Unknown / not cleared', cleared: false });
        else expect(site.image_rights).toBeNull();
        expect(stored).toEqual([]);
        expect(drawn).toEqual([]);
        const shown = await look(site.key);
        expect(shown.status).toBe(200);
        expect(shown.body.look.image).toBeNull();
        expect(shown.body.look.links.filter((l) => l.available)).toHaveLength(2);
        expect((await from(request(app).get('/api/v1/public/looks'))).body.looks.find((l) => l.key === site.key).image).toBeNull();
      }
    });

    it('a declaration that is not one of the five is refused, and nothing is published or copied', async () => {
      const fresh = await seed();
      await send(fresh.ep);
      for (const rights of [{ category: 'mine' }, { category: '' }, {}, 'original', ['original'], { category: 'original', note: 7 }, { category: 'licensed', note: 'x'.repeat(501) }]) {
        stored.length = 0;
        const res = await publish(fresh.ep, {}, rights);
        expect([JSON.stringify(rights).slice(0, 30), res.status, res.body.code]).toEqual([JSON.stringify(rights).slice(0, 30), 400, 'BAD_IMAGE_RIGHTS']);
        expect(stored).toEqual([]);
      }
      expect((await dist(fresh.ep)).site).toEqual({ published: false });
    });

    it('replacing the image needs its own declaration: publishing again without one takes the image off the website', async () => {
      stored.length = 0;
      const first = await publish(ids.ep, {}, { category: 'original' });
      const { key } = first.body.data.site;
      const a = stored[0].key;
      expect((await look(key)).body.look.image.url).toBe(`https://site.cdn.test/${a}`);

      // Again, with nothing said of the image: no copy is made, and the earlier image is not carried over.
      const second = await publish(ids.ep, {}, null);
      expect(second.body.data.site).toMatchObject({ key, image: 'not_cleared', image_rights: null });
      expect(stored).toHaveLength(1);
      expect((await look(key)).body.look.image).toBeNull();
      expect((await siteOf(ids.ep)).site.image).toBeUndefined();

      // Again, cleared: a new copy, bound to its own declaration.
      const third = await publish(ids.ep, {}, { category: 'licensed', note: 'Licence LIC-2291' });
      expect(third.body.data.site.image).toBe('on_site');
      expect(stored).toHaveLength(2);
      expect(stored[1].key).not.toBe(a);
      expect((await look(key)).body.look.image.url).toBe(`https://site.cdn.test/${stored[1].key}`);
    });

    it('a declaration covers the image it was made about, and no other: a different copy, sheet or pose is not cleared by it', async () => {
      stored.length = 0;
      const { key } = (await publish(ids.ep, {}, { category: 'original' })).body.data.site;
      expect((await look(key)).body.look.image).not.toBeNull();
      const { meta, site } = await siteOf(ids.ep);
      const original = JSON.parse(JSON.stringify(meta));
      const withSite = (change) => { const m = JSON.parse(JSON.stringify(original)); change(m.style_sheet.site); return m; };

      // Another copy under the same look: not the one she declared.
      await saveSite(ids.ep, withSite((s) => { s.image.key = `site-public/looks/${key}/${uuid()}.png`; }));
      expect((await look(key)).body.look.image).toBeNull();
      expect((await dist(ids.ep)).site.image).not.toBe('on_site');
      // The image drawn from another sheet.
      await saveSite(ids.ep, withSite((s) => { s.image.sheet_hash = 'another-sheet'; }));
      expect((await look(key)).body.look.image).toBeNull();
      // The declaration withdrawn, or marked uncleared, or its category not a cleared one.
      for (const change of [(s) => { delete s.image_rights; }, (s) => { s.image_rights.cleared = false; }, (s) => { s.image_rights.category = 'unknown'; }, (s) => { s.image_rights.category = 'approved'; }]) {
        await saveSite(ids.ep, withSite(change));
        expect((await look(key)).body.look.image).toBeNull();
      }
      // The poses it was made about are not the ones the sheet has now: Distribution says it needs a new review.
      await saveSite(ids.ep, withSite((s) => { s.image_rights.poses = { front: { id: uuid(), url: 'https://bucket.s3.amazonaws.com/poses/earlier-front.png' }, side: null, back: null }; }));
      expect((await dist(ids.ep)).site.image_rights.stale).toBe(true);
      await saveSite(ids.ep, withSite((s) => { s.image_rights.sheet_hash = 'an-earlier-sheet'; s.image.sheet_hash = 'an-earlier-sheet'; }));
      expect((await dist(ids.ep)).site.image_rights.stale).toBe(true);

      // As she published it, it shows again.
      await saveSite(ids.ep, original);
      expect((await look(key)).body.look.image.url).toBe(`https://site.cdn.test/${site.image.key}`);
      // Read back from the database (its keys reordered), her declaration still matches the poses and the sheet.
      expect((await dist(ids.ep)).site.image_rights.stale).toBe(false);
    });

    it('an image published before declarations existed is not shown; the look is', async () => {
      const { key } = (await publish(ids.ep, {}, { category: 'original' })).body.data.site;
      const { meta } = await siteOf(ids.ep);
      delete meta.style_sheet.site.image_rights;
      await saveSite(ids.ep, meta);
      const shown = await look(key);
      expect([shown.status, shown.body.look.image]).toEqual([200, null]);
      expect((await dist(ids.ep)).site).toMatchObject({ image: 'not_cleared', image_rights: null });
    });

    it('only an ADMIN declares: signed out and an editor are refused, and nothing is copied', async () => {
      const editor = TokenService.generateTokenPair({ id: 'test-editor-look-img', email: 'ed@lookimg.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
      const viewer = TokenService.generateTokenPair({ id: 'test-viewer-look-img', email: 'vi@lookimg.dev', name: 'Vi', groups: ['viewer'], role: 'USER' }).accessToken;
      const body = { links: await confirmAll(ids.ep), image_rights: { category: 'original' } };
      const before = JSON.stringify((await siteOf(ids.ep)).site);
      stored.length = 0;
      expect((await from(request(app).post(siteUrl(ids.ep))).send(body)).status).toBe(401);
      for (const token of [editor, viewer]) expect((await as(token, from(request(app).post(siteUrl(ids.ep)))).send(body)).status).toBe(403);
      expect(stored).toEqual([]);
      expect(JSON.stringify((await siteOf(ids.ep)).site)).toBe(before);
    });
  });
  describe('withdrawing the look image, and the copy left in the public bucket (Evoni, 2026-11-15)', () => {
    let ipN = 0;
    const from = (r) => { ipN += 1; return r.set('X-Forwarded-For', `198.51.116.${(ipN % 250) + 1}`); };
    const look = async (key) => (await from(request(app).get(`/api/v1/public/looks/${key}`)));
    const list = async () => (await from(request(app).get('/api/v1/public/looks'))).body.looks;
    const dist = async (ep) => (await as(admin, from(request(app).get(distUrl(ep))))).body.data;
    const withdraw = (ep, token = admin) => (token ? as(token, from(request(app).post(`${siteUrl(ep)}/image/withdraw`))) : from(request(app).post(`${siteUrl(ep)}/image/withdraw`)));
    const check = (ep, key, token = admin) => (token ? as(token, from(request(app).post(`${siteUrl(ep)}/image/check`))) : from(request(app).post(`${siteUrl(ep)}/image/check`))).send({ key });
    const saved2 = async (ep) => {
      const [[row]] = await run('SELECT distribution_metadata AS meta, updated_at AS at FROM episodes WHERE id = :ep', { ep });
      return { meta: typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta, at: row.at };
    };
    const editor = () => TokenService.generateTokenPair({ id: 'test-editor-withdraw', email: 'ed@lookimg.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    const viewer = () => TokenService.generateTokenPair({ id: 'test-viewer-withdraw', email: 'vi@lookimg.dev', name: 'Vi', groups: ['viewer'], role: 'USER' }).accessToken;
    let ids;
    let key;
    let copyKey;
    let statusOf;

    beforeAll(async () => {
      ids = await seed();
      await run(`UPDATE episodes SET status = 'published' WHERE id = :ep`, ids);
      expect((await send(ids.ep)).status).toBe(200);
    });
    beforeEach(() => {
      statusOf = jest.spyOn(distribution, 'fetchStatus').mockResolvedValue(200);
    });

    it('only an ADMIN withdraws or checks: signed out 401, an editor and a viewer 403, and nothing changes', async () => {
      const res = await publish(ids.ep, {}, { category: 'licensed', note: 'Licence LIC-2291' });
      key = res.body.data.site.key;
      copyKey = stored[0].key;
      const before = JSON.stringify((await saved2(ids.ep)).meta);
      expect((await withdraw(ids.ep, null)).status).toBe(401);
      expect((await check(ids.ep, copyKey, null)).status).toBe(401);
      for (const token of [editor(), viewer()]) {
        expect((await withdraw(ids.ep, token)).status).toBe(403);
        expect((await check(ids.ep, copyKey, token)).status).toBe(403);
      }
      expect(JSON.stringify((await saved2(ids.ep)).meta)).toBe(before);
      expect(statusOf).not.toHaveBeenCalled();
      expect((await look(key)).body.look.image).not.toBeNull();
    });

    it('withdrawing hides the image at once in both public reads; the look, its products, links, disclosure and dates stay', async () => {
      const before = (await look(key)).body.look;
      const beforeSite = (await saved2(ids.ep)).meta.style_sheet.site;
      const res = await withdraw(ids.ep);
      expect(res.status).toBe(200);
      const after = await look(key);
      expect(after.status).toBe(200);
      expect(after.body.look).toEqual({ ...before, image: null });
      expect((await list()).find((l) => l.key === key)).toMatchObject({ title: before.title, published_at: before.published_at, image: null });
      // The snapshot she published is as it was; only the image and its rights changed.
      const site = (await saved2(ids.ep)).meta.style_sheet.site;
      for (const field of ['key', 'published_at', 'published_by', 'links', 'disclosure', 'confirmed_at', 'confirmed_by', 'piece_ids', 'sheet_hash']) {
        expect([field, site[field]]).toEqual([field, beforeSite[field]]);
      }
      expect(site.image).toBeUndefined();
      expect(site.image_rights).toMatchObject({ category: 'licensed', cleared: false, withdrawn: true, withdrawn_by: 'evoni@lookimg.dev', withdrawn_category: 'licensed' });
      // Nothing of this is public: no note, no key of the hidden copy, no word of the withdrawal.
      const pub = JSON.stringify(after.body) + JSON.stringify(await list());
      expect(pub).not.toMatch(/LIC-2291|withdrawn|public_copies|revocation|evoni@/);
      expect(pub).not.toContain(copyKey);
    });

    it('Distribution shows the exact copy and four separate facts; the copy is pending, never "revoked" on say-so', async () => {
      const d = await dist(ids.ep);
      expect(d.site).toMatchObject({ published: true, image: 'withdrawn' });
      expect(d.site.image_rights).toMatchObject({ withdrawn: true, cleared: false });
      expect(d.public_copies).toEqual([expect.objectContaining({
        key: copyKey, url: `https://site.cdn.test/${copyKey}`, reason: 'rights_withdrawn', rights_category: 'licensed',
        rights_withdrawn: true, api_hidden: true, revocation: 'pending', checked_at: null, last_status: null,
      })]);
      expect(JSON.stringify(d.public_copies)).not.toMatch(/"revoked"/);
    });

    it('asking again is safe: nothing is written, nothing is recorded twice', async () => {
      const before = await saved2(ids.ep);
      for (let i = 0; i < 3; i += 1) expect((await withdraw(ids.ep)).status).toBe(200);
      const after = await saved2(ids.ep);
      expect(JSON.stringify(after.meta)).toBe(JSON.stringify(before.meta));
      expect(String(after.at)).toBe(String(before.at));
      expect(after.meta.style_sheet.public_copies).toHaveLength(1);
    });

    it('nothing in storage is deleted, moved or re-written by a withdrawal or a check', async () => {
      stored.length = 0;
      const s3 = require('@aws-sdk/client-s3');
      const sends = jest.spyOn(s3.S3Client.prototype, 'send');
      await withdraw(ids.ep);
      await check(ids.ep, copyKey);
      expect(stored).toEqual([]);
      expect(slots.putObject).not.toHaveBeenCalled();
      expect(sends).not.toHaveBeenCalled();
    });

    it('a check that still finds the copy leaves it pending; only a check that finds it gone marks it verified; found again, pending again', async () => {
      for (const still of [200, 206, 304, 301, 500, null]) {
        statusOf.mockResolvedValueOnce(still);
        const res = await check(ids.ep, copyKey);
        expect([still, res.status, res.body.data.public_copies[0].revocation, res.body.data.public_copies[0].last_status]).toEqual([still, 200, 'pending', still]);
      }
      expect(statusOf).toHaveBeenLastCalledWith(`https://site.cdn.test/${copyKey}`);
      for (const gone of [403, 404, 410]) {
        statusOf.mockResolvedValueOnce(gone);
        const res = await check(ids.ep, copyKey);
        expect([gone, res.body.data.public_copies[0].revocation, res.body.data.public_copies[0].last_status]).toEqual([gone, 'verified', gone]);
        expect(res.body.data.public_copies[0].checked_at).toEqual(expect.any(String));
      }
      // Served again later (access given back): it is not left saying verified.
      statusOf.mockResolvedValueOnce(200);
      expect((await check(ids.ep, copyKey)).body.data.public_copies[0].revocation).toBe('pending');
      // A key that is not one of this look's hidden copies is refused, and asks nothing of any address.
      statusOf.mockClear();
      for (const bad of ['site-public/looks/other/x.png', '', undefined, 7]) expect((await check(ids.ep, bad)).body.code).toBe('COPY_NOT_FOUND');
      expect(statusOf).not.toHaveBeenCalled();
    });

    it('with no public address to ask, a copy cannot be verified and stays pending', async () => {
      delete process.env.SITE_PUBLIC_BUCKET;
      delete process.env.SITE_PUBLIC_CDN;
      statusOf.mockClear();
      const res = await check(ids.ep, copyKey);
      expect(res.body.data.public_copies[0]).toMatchObject({ revocation: 'pending', url: null, last_status: null });
      expect(statusOf).not.toHaveBeenCalled();
    });

    it('a new publish needs its own declaration, and the copies it replaces are recorded too; so is a take-down', async () => {
      stored.length = 0;
      const again = await publish(ids.ep, {}, { category: 'original' });
      expect(again.body.data.site.image).toBe('on_site');
      const second = stored[0].key;
      expect((await look(key)).body.look.image.url).toBe(`https://site.cdn.test/${second}`);
      // Published again with nothing said of the image: the second copy is no longer shown, and is recorded.
      const dropped = await publish(ids.ep, {}, null);
      expect(dropped.body.data.public_copies.map((c) => [c.key, c.reason, c.revocation])).toEqual([[copyKey, 'rights_withdrawn', 'pending'], [second, 'replaced', 'pending']]);
      // And a look taken down with an image on the website.
      stored.length = 0;
      await publish(ids.ep, {}, { category: 'original' });
      const third = stored[0].key;
      const down = await as(admin, from(request(app).delete(siteUrl(ids.ep))));
      expect(down.body.data.site).toEqual({ published: false });
      expect(down.body.data.public_copies.map((c) => [c.key, c.reason])).toEqual([[copyKey, 'rights_withdrawn'], [second, 'replaced'], [third, 'taken_down']]);
      // Sending the sheet again keeps the record.
      expect((await send(ids.ep)).body.data.public_copies).toHaveLength(3);
    });

    it('the record cannot be discarded while a copy is pending; once each is verified gone, the entry can be removed', async () => {
      const refused = await as(admin, from(request(app).delete(distUrl(ids.ep))));
      expect([refused.status, refused.body.code]).toEqual([409, 'PUBLIC_COPIES_PENDING']);
      expect((await dist(ids.ep)).public_copies).toHaveLength(3);
      statusOf.mockResolvedValue(404);
      for (const c of (await dist(ids.ep)).public_copies) await check(ids.ep, c.key);
      expect((await dist(ids.ep)).public_copies.map((c) => c.revocation)).toEqual(['verified', 'verified', 'verified']);
      expect((await as(admin, from(request(app).delete(distUrl(ids.ep))))).status).toBe(200);
    });

    it('a look that is not published, or has no image, has nothing to withdraw', async () => {
      // The entry was removed by the test before: sent again, the look is in Distribution and not on the website.
      const sendAgain = await as(admin, from(request(app).post(distUrl(ids.ep)))).send({ include_shop_links: true });
      expect(sendAgain.status).toBe(200);
      expect((await withdraw(ids.ep)).body.code).toBe('NOT_PUBLISHED');
      const plain = await as(admin, from(request(app).post(siteUrl(ids.ep)))).send({ links: await confirmAll(ids.ep) });
      expect(plain.status).toBe(200);
      const before = JSON.stringify((await saved2(ids.ep)).meta);
      const res = await withdraw(ids.ep);
      expect([res.status, res.body.data.public_copies]).toEqual([200, []]);
      expect(JSON.stringify((await saved2(ids.ep)).meta)).toBe(before);
    });
  });
  describe('withdrawal holds under change, failure and overlap (Evoni, 2026-11-15)', () => {
    let ipN = 0;
    const from = (r) => { ipN += 1; return r.set('X-Forwarded-For', `198.51.117.${(ipN % 250) + 1}`); };
    const look = async (key) => (await from(request(app).get(`/api/v1/public/looks/${key}`)));
    const dist = async (ep) => (await as(admin, from(request(app).get(distUrl(ep))))).body.data;
    const withdraw = (ep) => as(admin, from(request(app).post(`${siteUrl(ep)}/image/withdraw`)));
    const publishAs = async (ep, imageRights) => as(admin, from(request(app).post(siteUrl(ep))))
      .send({ links: await confirmAll(ep), ...(imageRights ? { image_rights: imageRights } : {}) });
    const savedEntry = async (ep) => {
      const [[row]] = await run('SELECT distribution_metadata AS meta FROM episodes WHERE id = :ep', { ep });
      return (typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta).style_sheet;
    };
    let ids;
    beforeAll(async () => {
      ids = await seed();
      await run(`UPDATE episodes SET status = 'published' WHERE id = :ep`, ids);
      expect((await as(admin, from(request(app).post(distUrl(ids.ep)))).send({ include_shop_links: true })).status).toBe(200);
    });
    beforeEach(() => { jest.spyOn(distribution, 'fetchStatus').mockResolvedValue(200); });

    it('it withdraws the image that was published, whatever the sheet, the look or the wardrobe have become since', async () => {
      const first = await publishAs(ids.ep, { category: 'original' });
      const { key } = first.body.data.site;
      const published = stored[0].key;
      const before = (await look(key)).body.look;
      // Since then: the sheet reopened and changed, a piece renamed and its link changed, and the changed sheet sent.
      expect((await as(admin, from(request(app).post(`/api/v1/episodes/${ids.ep}/style-sheet/reopen`)))).status).toBe(200);
      await as(admin, from(request(app).put(`/api/v1/episodes/${ids.ep}/lookbook`))).send({ tagline: 'Another story altogether.' });
      await models.Wardrobe.update({ name: 'Renamed pump', real_product_url: 'https://shop.example/another' }, { where: { id: ids.pump } });
      expect((await as(admin, from(request(app).post(`/api/v1/episodes/${ids.ep}/style-sheet/approve`)))).status).toBe(200);
      expect((await as(admin, from(request(app).post(distUrl(ids.ep)))).send({ include_shop_links: true })).status).toBe(200);
      expect((await dist(ids.ep)).site.image_rights.stale).toBe(true);

      const res = await withdraw(ids.ep);
      expect(res.status).toBe(200);
      expect(res.body.data.public_copies).toEqual([expect.objectContaining({ key: published, url: `https://site.cdn.test/${published}`, reason: 'rights_withdrawn', revocation: 'pending' })]);
      // The published look is the snapshot it was, without its image; nothing of the changed sheet, piece or
      // redrafted caption is in it.
      const after = (await look(key)).body.look;
      expect(after).toEqual({ ...before, image: null });
      expect(after.caption).toContain('Every look tells a story.');
      expect((await dist(ids.ep)).site.differs).toEqual(expect.arrayContaining(['caption']));
      expect((await from(request(app).get('/api/v1/public/looks'))).body.looks.find((l) => l.key === key).image).toBeNull();
      const [[episode]] = await run('SELECT status, episode_number FROM episodes WHERE id = :ep', ids);
      expect(episode).toMatchObject({ status: 'published', episode_number: 1 });
    });

    it('pending copies survive a republish, a second withdrawal and repeated requests', async () => {
      const first = (await savedEntry(ids.ep)).public_copies[0].key;
      // The changed sheet needs her products confirmed again; published with a cleared image.
      stored.length = 0;
      const again = await publishAs(ids.ep, { category: 'licensed' });
      expect(again.body.data.site.image).toBe('on_site');
      const second = stored[0].key;
      expect((await dist(ids.ep)).public_copies.map((c) => c.key)).toEqual([first]);
      expect((await withdraw(ids.ep)).status).toBe(200);
      for (let i = 0; i < 3; i += 1) await withdraw(ids.ep);
      const copies = (await dist(ids.ep)).public_copies;
      expect(copies.map((c) => [c.key, c.reason, c.revocation])).toEqual([[first, 'rights_withdrawn', 'pending'], [second, 'rights_withdrawn', 'pending']]);
    });

    it('a withdrawal that cannot be saved says so, hides nothing, and loses no reference; asked again, it works', async () => {
      stored.length = 0;
      const res = await publishAs(ids.ep, { category: 'original' });
      const { key } = res.body.data.site;
      const third = stored[0].key;
      const before = JSON.stringify(await savedEntry(ids.ep));
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const fail = jest.spyOn(models.Episode, 'update').mockRejectedValueOnce(new Error('the database went away'));
      const failed = await withdraw(ids.ep);
      expect(failed.status).toBe(500);
      expect(failed.body.success).toBe(false);
      expect(failed.body.data).toBeUndefined();
      fail.mockRestore();
      // Nothing was half done: the record is as it was, and the image is still the one on the website.
      expect(JSON.stringify(await savedEntry(ids.ep))).toBe(before);
      expect((await look(key)).body.look.image.url).toBe(`https://site.cdn.test/${third}`);
      expect((await savedEntry(ids.ep)).site.image.key).toBe(third);
      const ok = await withdraw(ids.ep);
      expect(ok.status).toBe(200);
      expect((await look(key)).body.look.image).toBeNull();
      expect(ok.body.data.public_copies.map((c) => c.key)).toContain(third);
    });

    it('overlapping withdrawals and publishes: a stale save is refused, and every copy ever written is either the one shown or on the list', async () => {
      const refusals = [];
      for (let round = 0; round < 4; round += 1) {
        const links = await confirmAll(ids.ep);
        const publishNow = () => as(admin, from(request(app).post(siteUrl(ids.ep)))).send({ links, image_rights: { category: 'original' } });
        const results = await Promise.all([publishNow(), withdraw(ids.ep), publishNow(), withdraw(ids.ep)]);
        // Each either saved, had nothing to do, or was refused as stale; a refusal says so and publishes nothing of its own.
        for (const r of results) {
          expect([200, 404, 409]).toContain(r.status);
          if (r.status === 409) { expect(r.body).toMatchObject({ success: false, code: 'DISTRIBUTION_CHANGED' }); refusals.push(r); }
        }
        // Of two publishes that overlap, at most one is saved: the other read an entry that has since changed.
        expect(results.filter((r, i) => (i === 0 || i === 2) && r.status === 200).length).toBeLessThanOrEqual(1);
        const entry = await savedEntry(ids.ep);
        const shown = entry.site?.image?.key || null;
        const listed = new Set((entry.public_copies || []).map((c) => c.key));
        const written = [...new Set(stored.map((o) => o.key))];
        for (const k2 of written) expect([round, k2, k2 === shown || listed.has(k2)]).toEqual([round, k2, true]);
        // And the website shows an image only if it is that shown copy with its own cleared declaration.
        const pub = (await look(entry.site.key)).body.look.image;
        if (pub) expect(pub.url).toBe(`https://site.cdn.test/${shown}`);
        expect(new Set((entry.public_copies || []).map((c) => c.key)).size).toBe((entry.public_copies || []).length);
        // What is saved is one action's whole entry: the declaration names the image shown, or there is neither.
        if (shown) expect(entry.site.image_rights).toMatchObject({ cleared: true, image_key: shown });
        expect(Number.isInteger(entry.rev)).toBe(true);
      }
      // Over four rounds of four overlapping requests, some were refused as stale.
      expect(refusals.length).toBeGreaterThan(0);
    });

    it('a save over a newer entry is refused whole: the products, the declaration and the image of the newer one stand', async () => {
      // Two actions read the same entry; the first saves; the second, built from what it read, must not replace it.
      const links = await confirmAll(ids.ep);
      stored.length = 0;
      const first = await as(admin, from(request(app).post(siteUrl(ids.ep)))).send({ links, image_rights: { category: 'licensed', note: 'Licence A' } });
      expect(first.status).toBe(200);
      const winner = await savedEntry(ids.ep);
      const metadata = { style_sheet: { ...winner, rev: winner.rev - 1, site: { ...winner.site, links: [], image_rights: { ...winner.site.image_rights, category: 'original' }, image: { key: `site-public/looks/${winner.site.key}/stale-copy.png`, sheet_hash: winner.site.image.sheet_hash } } } };
      // The stale action goes to save what it built on the older revision (through the service's own write).
      const service = require('../../src/services/styleSheetDistributionService');
      await expect(service.writeMetadata(models, ids.ep, metadata)).rejects.toMatchObject({ status: 409, code: 'DISTRIBUTION_CHANGED' });
      const after = await savedEntry(ids.ep);
      expect(after.site.links).toEqual(winner.site.links);
      expect(after.site.image_rights).toEqual(winner.site.image_rights);
      expect(after.site.image).toEqual(winner.site.image);
      // The copy the stale action had made is not lost: it is on the list, pending.
      expect(after.public_copies.map((c) => [c.key, c.revocation.status])).toEqual(expect.arrayContaining([[`site-public/looks/${winner.site.key}/stale-copy.png`, 'pending']]));
      expect(after.rev).toBe(winner.rev + 1);
      // And the website still shows the winner's image.
      expect((await look(winner.site.key)).body.look.image.url).toBe(`https://site.cdn.test/${winner.site.image.key}`);
    });

    it('a removal built on an older reading is refused, and the entry stays', async () => {
      const now = await savedEntry(ids.ep);
      const all = (await models.Episode.findByPk(ids.ep)).distribution_metadata;
      const rest = { ...(typeof all === 'string' ? JSON.parse(all) : all) };
      delete rest.style_sheet;
      const service = require('../../src/services/styleSheetDistributionService');
      await expect(service.writeMetadata(models, ids.ep, rest, { removing: { ...now, rev: now.rev - 1 } })).rejects.toMatchObject({ status: 409, code: 'DISTRIBUTION_CHANGED' });
      expect(await savedEntry(ids.ep)).toEqual(now);
    });

    it('an overlapping check and withdrawal keep both: the copy, and what the check found', async () => {
      const entry = await savedEntry(ids.ep);
      const target = entry.public_copies[0].key;
      distribution.fetchStatus.mockResolvedValue(404);
      stored.length = 0;
      await publishAs(ids.ep, { category: 'original' });
      const fresh = stored[0].key;
      const both = await Promise.all([
        as(admin, from(request(app).post(`${siteUrl(ids.ep)}/image/check`))).send({ key: target }),
        withdraw(ids.ep),
      ]);
      // One may be refused as stale (it is asked again by her); neither loses a copy.
      for (const r of both) expect([200, 409]).toContain(r.status);
      const after = await savedEntry(ids.ep);
      const keys = after.public_copies.map((c) => c.key);
      expect(keys).toContain(target);
      expect(after.site.image ? after.site.image.key === fresh : keys.includes(fresh)).toBe(true);
    });
  });
});
