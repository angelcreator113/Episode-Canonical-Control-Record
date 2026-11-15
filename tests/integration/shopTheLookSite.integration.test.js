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
  // The episode is published unless a test says otherwise: the website shows only a released episode's look.
  async function seed({ bare = false, status = 'published' } = {}) {
    const ids = { show: uuid(), ep: uuid(), event: uuid() };
    shows.push(ids.show);
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())',
      { ...ids, name: `Shop ${ids.show.slice(0, 8)}`, slug: `shop-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Wearable Experiments', 1, :status, NOW(), NOW())`, { ...ids, status });
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
  // What she confirms when she publishes: each piece that has a link, with its real brand, product, retailer,
  // address, whether the link is an affiliate's and whether it is the piece itself. `over` corrects a piece by id.
  const confirmAll = async (ep, over = {}) => ((await as(admin, request(app).get(distUrl(ep)))).body.data.site_review || [])
    .filter((p) => p.url)
    .map((p) => ({
      piece_id: p.piece_id, real_brand: p.real_brand || 'Bloom Atelier', real_product_name: p.real_product_name || 'Enamel Stud Earrings',
      retailer: p.retailer || 'Etsy', url: p.url, affiliate: p.affiliate, match: 'exact', confirmed: true, ...(over[p.piece_id] || {}),
    }));
  const publish = async (ep, over = {}) => as(admin, request(app).post(siteUrl(ep))).send({ links: await confirmAll(ep, over) });
  const publicList = async () => (await request(app).get('/api/v1/public/looks')).body.looks;

  it('publish and take down need an ADMIN; publish needs the sheet sent, links included, and a link', async () => {
    const ids = await seed();
    expect((await request(app).post(siteUrl(ids.ep))).status).toBe(401);
    expect((await as(editor, request(app).post(siteUrl(ids.ep)))).status).toBe(403);
    expect((await as(editor, request(app).delete(siteUrl(ids.ep)))).status).toBe(403);
    const notSent = await publish(ids.ep);
    expect([notSent.status, notSent.body.code]).toEqual([404, 'NOT_SENT']);
    expect((await send(ids.ep, false)).status).toBe(200);
    const noLinks = await publish(ids.ep);
    expect([noLinks.status, noLinks.body.code]).toEqual([409, 'NO_SHOP_LINKS']);

    const bare = await seed({ bare: true });
    expect((await send(bare.ep)).status).toBe(200);
    const none = await publish(bare.ep);
    expect([none.status, none.body.code]).toEqual([409, 'NO_LINKS']);
  });

  it('a published look is on the website: links live, the disclosure first, no ids and no prices', async () => {
    const ids = await seed();
    expect((await send(ids.ep)).body.data.site).toEqual({ published: false });
    const res = await publish(ids.ep);
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
      { label: 'Maison Rouge Satin Ballet Pump', retailer: 'Nordstrom', url: 'https://shop.example/pump', affiliate: false, match: 'exact', available: true },
      // The studs had no real brand or product in the wardrobe: she gave them when she confirmed. The studio's
      // own name for the piece ("Crimson Bloom Enamel Stud Earrings") is never the website's label (Evoni, 2026-11-15).
      { label: 'Bloom Atelier Enamel Stud Earrings', retailer: 'Etsy', url: 'https://aff.example/studs?ref=lala', affiliate: true, match: 'exact', available: true },
    ]);
    expect(JSON.stringify(one.body)).not.toMatch(/Crimson/);
    const body = JSON.stringify(one.body);
    for (const id of [ids.ep, ids.show, ids.pump, ids.studs, ids.event]) expect(body).not.toContain(id);
    // The prices never leave; the publish time and the random key are left
    // out of this check, since "…:35.420Z" or a key can hold the digits.
    const { published_at: _when, key: _key, ...rest } = one.body.look;
    expect(JSON.stringify(rest)).not.toMatch(/price|128|420/);

    // A snapshot (Evoni, 2026-11-15): a piece's link edited after publishing changes nothing on the website;
    // Distribution says the two differ, and publishing again after her review updates it.
    await run('UPDATE wardrobe SET real_product_url = :u WHERE id = :id', { u: 'https://shop.example/pump-2', id: ids.pump });
    const again = await request(app).get(`/api/v1/public/looks/${site.key}`);
    expect(again.body.look.links[0].url).toBe('https://shop.example/pump');
    expect((await as(admin, request(app).get(distUrl(ids.ep)))).body.data.site.differs).toEqual(['links']);
    expect((await publish(ids.ep)).body.data.site.differs).toEqual([]);
    expect((await request(app).get(`/api/v1/public/looks/${site.key}`)).body.look.links[0].url).toBe('https://shop.example/pump-2');
  });

  it('publishing again and sending again keep the key; links off hides it; take down and remove are a 404', async () => {
    const ids = await seed();
    await send(ids.ep);
    const { key } = (await publish(ids.ep)).body.data.site;
    expect((await publish(ids.ep)).body.data.site.key).toBe(key);
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

    const key2 = (await publish(ids.ep)).body.data.site.key;
    expect((await request(app).get(`/api/v1/public/looks/${key2}`)).status).toBe(200);
    expect((await as(admin, request(app).delete(distUrl(ids.ep)))).status).toBe(200);
    expect((await request(app).get(`/api/v1/public/looks/${key2}`)).status).toBe(404);
  });

  describe('the published look is what she confirmed, and stays that (Evoni, 2026-11-15)', () => {
    let ipN = 0;
    const from = (r) => { ipN += 1; return r.set('X-Forwarded-For', `198.51.114.${(ipN % 250) + 1}`); };
    const look = async (key) => (await from(request(app).get(`/api/v1/public/looks/${key}`)));
    const dist = async (ep) => (await as(admin, from(request(app).get(distUrl(ep))))).body.data;
    const setLink = (ep, body) => as(admin, from(request(app).patch(`${siteUrl(ep)}/links`))).send(body);
    let ids;
    let key;
    beforeAll(async () => {
      ids = await seed();
      expect((await send(ids.ep)).status).toBe(200);
    });

    it('nothing is published without her confirmation of each product; a refusal publishes nothing', async () => {
      const post = (links) => as(admin, from(request(app).post(siteUrl(ids.ep)))).send(links === undefined ? {} : { links });
      const good = await confirmAll(ids.ep);
      const one = (over) => [{ ...good[0], ...over }, good[1]];
      const cases = [
        [undefined, null],
        [one({ confirmed: false }), 'not_confirmed'],
        [one({ real_brand: ' ' }), 'real_brand'],
        [one({ real_product_name: '' }), 'real_product_name'],
        [one({ retailer: null }), 'retailer'],
        [one({ url: 'http://shop.example/pump' }), 'https_url'],
        [one({ url: 'javascript:alert(1)' }), 'https_url'],
        [one({ url: 'https://user:pw@shop.example/pump' }), 'https_url'],
        [one({ url: 'not an address' }), 'https_url'],
        [one({ match: 'close enough' }), 'match'],
        [one({ affiliate: 'yes' }), 'affiliate'],
        [[...good, { ...good[0], piece_id: uuid() }], 'not_in_look'],
        [[good[0], good[0]], 'listed_twice'],
      ];
      for (const [links, problem] of cases) {
        const res = await post(links);
        expect([problem, res.status, res.body.code]).toEqual([problem, 400, 'LINKS_NOT_CONFIRMED']);
        if (problem) expect(JSON.stringify(res.body.details.pieces)).toContain(problem);
      }
      // Every piece left out: nothing to buy, nothing published.
      const none = await post([]);
      expect([none.status, none.body.code]).toEqual([409, 'NO_LINKS']);
      expect((await dist(ids.ep)).site).toEqual({ published: false });
    });

    it('a similar alternative is hers to give and is labelled; a piece she leaves out is shown without a link', async () => {
      const [pump] = await confirmAll(ids.ep);
      const res = await as(admin, from(request(app).post(siteUrl(ids.ep)))).send({ links: [{
        ...pump, real_brand: 'Sam Edelman', real_product_name: 'Felicia Ballet Flat', retailer: 'Zappos', url: 'https://zappos.example/felicia', affiliate: false, match: 'similar',
      }] });
      expect(res.status).toBe(200);
      key = res.body.data.site.key;
      const shown = (await look(key)).body.look;
      expect(shown.links).toEqual([
        { label: 'Sam Edelman Felicia Ballet Flat', retailer: 'Zappos', url: 'https://zappos.example/felicia', affiliate: false, match: 'similar', available: true },
        { label: 'Jewelry', retailer: null, url: null, affiliate: false, match: null, available: false },
      ]);
      expect(shown.archive).toBe(false);
      expect(JSON.stringify(shown)).not.toMatch(/Crimson|Maison Rouge|shop\.example|aff\.example/);
    });

    it('editing, removing or replacing a piece, or sending another look, changes nothing on the website', async () => {
      const before = (await look(key)).body.look;
      await run(`UPDATE wardrobe SET real_brand = 'Changed', real_product_name = 'Changed', real_retailer = 'Changed',
                   real_product_url = 'https://changed.example/x', affiliate_url = 'https://changed.example/aff', name = 'Changed name' WHERE id = :pump`, ids);
      expect((await look(key)).body.look).toEqual(before);
      await run('UPDATE wardrobe SET deleted_at = NOW() WHERE id = :studs', ids);
      expect((await look(key)).body.look).toEqual(before);
      expect((await dist(ids.ep)).site.differs).toEqual(expect.arrayContaining(['pieces']));
      await run('UPDATE wardrobe SET deleted_at = NULL WHERE id = :studs', ids);

      // Another look, approved and sent: the website keeps the one she published.
      expect((await as(admin, request(app).post(`/api/v1/episodes/${ids.ep}/style-sheet/reopen`))).status).toBe(200);
      await run('DELETE FROM episode_wardrobe WHERE episode_id = :ep AND wardrobe_id = :studs', ids);
      expect((await as(admin, request(app).post(`/api/v1/episodes/${ids.ep}/style-sheet/approve`))).status).toBe(200);
      const resent = await send(ids.ep);
      expect(resent.status).toBe(200);
      expect(resent.body.data.site).toMatchObject({ published: true, key });
      expect(resent.body.data.site.differs).toEqual(expect.arrayContaining(['pieces']));
      expect((await look(key)).body.look).toEqual(before);
    });

    it('a product that can no longer be bought: the look stays up, the piece stays shown, its link is gone', async () => {
      expect((await request(app).patch(`${siteUrl(ids.ep)}/links`).send({ piece_id: ids.pump, available: false })).status).toBe(401);
      expect((await as(editor, request(app).patch(`${siteUrl(ids.ep)}/links`)).send({ piece_id: ids.pump, available: false })).status).toBe(403);
      expect((await setLink(ids.ep, { piece_id: ids.pump, available: 'no' })).body.code).toBe('BAD_AVAILABLE');
      expect((await setLink(ids.ep, { piece_id: uuid(), available: false })).body.code).toBe('PIECE_NOT_PUBLISHED');

      const off = await setLink(ids.ep, { piece_id: ids.pump, available: false });
      expect(off.status).toBe(200);
      const archived = await look(key);
      // Never a 404 for this: every piece is still there, none with a link, and no disclosure with nothing to buy.
      expect(archived.status).toBe(200);
      expect(archived.body.look.archive).toBe(true);
      expect(archived.body.look.disclosure).toBeNull();
      expect(archived.body.look.links).toEqual([
        { label: 'Sam Edelman Felicia Ballet Flat', retailer: null, url: null, affiliate: false, match: 'similar', available: false },
        { label: 'Jewelry', retailer: null, url: null, affiliate: false, match: null, available: false },
      ]);
      expect(JSON.stringify(archived.body)).not.toContain('zappos.example');
      expect((await publicList()).map((l) => l.key)).toContain(key);

      // Back in stock: the same product, the same link. A piece published without a product needs a review.
      expect((await setLink(ids.ep, { piece_id: ids.studs, available: true })).body.code).toBe('NO_PRODUCT');
      expect((await setLink(ids.ep, { piece_id: ids.pump, available: true })).status).toBe(200);
      expect((await look(key)).body.look.links[0]).toMatchObject({ url: 'https://zappos.example/felicia', available: true });
    });

    it('the disclosure is saved with the look, and is for affiliate links only: Amazon\'s sentence for an Amazon affiliate link', async () => {
      const fresh = await seed();
      await send(fresh.ep);
      // The pump: a plain Amazon link, no affiliate. The studs: left out. Nothing to disclose.
      const plain = await as(admin, from(request(app).post(siteUrl(fresh.ep)))).send({ links: (await confirmAll(fresh.ep))
        .filter((l) => l.piece_id === fresh.pump).map((l) => ({ ...l, url: 'https://www.amazon.com/dp/B000TEST', retailer: 'Amazon', affiliate: false })) });
      expect(plain.status).toBe(200);
      const { key: k } = plain.body.data.site;
      expect((await look(k)).body.look.disclosure).toBeNull();
      // The same link as an affiliate's: both sentences.
      const aff = await publish(fresh.ep, { [fresh.pump]: { url: 'https://www.amazon.com/dp/B000TEST?tag=lala-20', retailer: 'Amazon', affiliate: true } });
      expect(aff.status).toBe(200);
      const shown = (await look(k)).body.look;
      expect(shown.disclosure).toBe(`${DISCLOSURE} As an Amazon Associate I earn from qualifying purchases.`);
      // The piece's address changed in the wardrobe: the published disclosure and link stay.
      await run(`UPDATE wardrobe SET real_product_url = 'https://shop.example/elsewhere', affiliate_url = NULL WHERE id = :pump`, fresh);
      expect((await look(k)).body.look.disclosure).toBe(shown.disclosure);
      // That affiliate product no longer available, the other affiliate link still is: the affiliate sentence alone.
      expect((await setLink(fresh.ep, { piece_id: fresh.pump, available: false })).status).toBe(200);
      expect((await look(k)).body.look.disclosure).toBe(DISCLOSURE);
    });

    it('a look published before products were confirmed still shows, from its pieces, and says it needs a review', async () => {
      const old = await seed();
      await send(old.ep);
      const { key: oldKey } = (await publish(old.ep)).body.data.site;
      // As such a look is stored: its pieces, no snapshot.
      const [[row]] = await run('SELECT distribution_metadata FROM episodes WHERE id = :ep', old);
      const meta = typeof row.distribution_metadata === 'string' ? JSON.parse(row.distribution_metadata) : row.distribution_metadata;
      const { links: _l, disclosure: _d, confirmed_at: _a, confirmed_by: _b, sheet_hash: _h, ...legacy } = meta.style_sheet.site;
      meta.style_sheet.site = legacy;
      await models.Episode.update({ distribution_metadata: meta }, { where: { id: old.ep } });
      const shown = await look(oldKey);
      expect(shown.status).toBe(200);
      expect(shown.body.look.links.map((l) => l.url)).toEqual(['https://shop.example/pump', 'https://aff.example/studs?ref=lala']);
      expect((await dist(old.ep)).site.differs).toEqual(['no_snapshot']);
      expect((await setLink(old.ep, { piece_id: old.pump, available: false })).body.code).toBe('NO_SNAPSHOT');
      // Reviewed and published again, it is a snapshot like any other.
      expect((await publish(old.ep)).body.data.site.differs).toEqual([]);
    });
  });

  describe('the website shows a look only once its episode is released (Evoni, 2026-11-15)', () => {
    // Each read comes from its own address: the public reads are rate limited by address.
    let ipN = 0;
    const from = (r) => { ipN += 1; return r.set('X-Forwarded-For', `198.51.112.${(ipN % 250) + 1}`); };
    const listed = async () => (await from(request(app).get('/api/v1/public/looks'))).body.looks;
    const onList = async (key) => (await listed()).some((l) => l.key === key);
    const byKey = (key) => from(request(app).get(`/api/v1/public/looks/${key}`));
    const setEpisode = (ep, status, number = 1) => run(
      'UPDATE episodes SET status = :status, episode_number = :number WHERE id = :ep', { ep, status, number });
    // Two shows, one episode each, both drafts, each with its look switched on for the website.
    let a;
    let b;
    beforeAll(async () => {
      a = await seed({ status: 'draft' });
      b = await seed({ status: 'draft' });
      for (const ids of [a, b]) {
        expect((await send(ids.ep)).status).toBe(200);
        const res = await publish(ids.ep);
        expect(res.status).toBe(200);
        expect(res.body.data.site).toMatchObject({ published: true, showing: true, released: false });
        ids.key = res.body.data.site.key;
      }
    });
    beforeEach(async () => { await setEpisode(a.ep, 'draft'); await setEpisode(b.ep, 'draft'); });

    it('an unpublished episode: the website gives nothing of its look, by list or by key', async () => {
      for (const status of ['draft', 'approved', 'pending', 'archived']) {
        await setEpisode(a.ep, status);
        expect([status, await onList(a.key)]).toEqual([status, false]);
        const one = await byKey(a.key);
        expect([status, one.status]).toEqual([status, 404]);
        // Nothing of the outfit, the title, the image or the links is in the refusal or the list.
        expect(JSON.stringify(one.body)).not.toMatch(/Wearable|shop\.example|aff\.example|Maison Rouge|Pump|Stud/);
        expect(JSON.stringify(await listed())).not.toContain(a.key);
      }
    });

    it('publishing the episode releases the look; taking the episode back hides it again', async () => {
      expect((await byKey(a.key)).status).toBe(404);
      await setEpisode(a.ep, 'published');
      const one = await byKey(a.key);
      expect(one.status).toBe(200);
      expect(one.body.look.links.length).toBeGreaterThan(0);
      expect(await onList(a.key)).toBe(true);
      expect((await as(admin, from(request(app).get(distUrl(a.ep))))).body.data.site).toMatchObject({ published: true, released: true });

      await setEpisode(a.ep, 'draft');
      expect((await byKey(a.key)).status).toBe(404);
      expect(await onList(a.key)).toBe(false);
    });

    it('a published episode with no number has no release moment: nothing shows', async () => {
      await setEpisode(a.ep, 'published');
      expect((await byKey(a.key)).status).toBe(200);
      await setEpisode(a.ep, 'published', null);
      expect((await byKey(a.key)).status).toBe(404);
      expect(await onList(a.key)).toBe(false);
    });

    it('one show releasing an episode releases nothing of another show', async () => {
      await setEpisode(a.ep, 'published');
      expect((await byKey(a.key)).status).toBe(200);
      expect((await byKey(b.key)).status).toBe(404);
      expect(await onList(b.key)).toBe(false);
    });

    it('a token changes nothing on the public read; an ADMIN previews on Distribution, and only an ADMIN', async () => {
      expect((await as(admin, byKey(a.key))).status).toBe(404);
      expect((await as(editor, byKey(a.key))).status).toBe(404);
      const preview = await as(admin, from(request(app).get(distUrl(a.ep))));
      expect(preview.status).toBe(200);
      expect(preview.body.data.shop_links.length).toBeGreaterThan(0);
      expect(preview.body.data.site).toMatchObject({ published: true, released: false });
      expect((await from(request(app).get(distUrl(a.ep)))).status).toBe(401);
    });
  });

  it('an unknown or malformed key is a 404', async () => {
    expect((await request(app).get('/api/v1/public/looks/AAAAAAAAAAAA')).status).toBe(404);
    expect((await request(app).get('/api/v1/public/looks/not-a-key')).status).toBe(404);
    expect((await request(app).get('/api/v1/public/looks/%25%25%25%25%25%25%25%25%25%25%25%25')).status).toBe(404);
  });
});
