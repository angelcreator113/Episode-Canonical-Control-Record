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
    await as(admin, request(app).put(`/api/v1/episodes/${ids.ep}/lookbook`)).send({ tagline: 'Every look tells a story.' });
    expect((await as(admin, request(app).post(`/api/v1/episodes/${ids.ep}/style-sheet/approve`))).status).toBe(200);
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
});
