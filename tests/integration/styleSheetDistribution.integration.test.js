/**
 * The approved style sheet in the episode's Distribution (Task #2878): Send
 * adds every export size with a caption draft from the episode, its event
 * and the tagline; Shop the Look links come from the look's wardrobe rows;
 * the affiliate disclosure is there, and cannot be edited away, whenever an
 * included link is an affiliate link. Stored in
 * episodes.distribution_metadata.style_sheet; the other Distribution
 * writers keep it. Nothing is posted anywhere.
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

(shouldSkip ? describe.skip : describe)('Style sheet in Distribution', () => {
  let token;
  const shows = [];
  const profiles = [];
  const savedBuckets = {};

  beforeAll(() => {
    for (const k of ['S3_PRIMARY_BUCKET', 'AWS_S3_BUCKET']) { savedBuckets[k] = process.env[k]; delete process.env[k]; }
    token = TokenService.generateTokenPair({
      id: 'test-user-sheet-dist', email: 'evoni@sheet-dist.dev', name: 'Sheet Dist', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
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

  const auth = (req) => req.set('Authorization', `Bearer ${token}`);
  const distUrl = (ep) => `/api/v1/episodes/${ep}/style-sheet/distribution`;
  const stored = async (ep) => {
    const [[row]] = await run('SELECT distribution_metadata FROM episodes WHERE id = :ep', { ep });
    return row.distribution_metadata;
  };

  async function seed() {
    const ids = { show: uuid(), ep: uuid(), event: uuid() };
    shows.push(ids.show);
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())',
      { ...ids, name: `Dist ${ids.show.slice(0, 8)}`, slug: `dist-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, distribution_metadata, created_at, updated_at)
               VALUES (:ep, :show, 'Wearable Experiments', 1, 'draft', CAST(:dm AS jsonb), NOW(), NOW())`,
      { ...ids, dm: JSON.stringify({ youtube: { enabled: true, title: 'Episode 1', status: 'draft' } }) });
    const [[profile]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, created_at, updated_at)
               VALUES (:handle, 'instagram', 'A studio.', 'STUDIO BY SABLE', NOW(), NOW()) RETURNING id`, { handle: `sabled_${ids.show.slice(0, 6)}` });
    profiles.push(profile.id);
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, source_profile_id, format, created_at, updated_at)
               VALUES (:event, :show, 'Wearable Experiments Studio Session', 'used', :ep, :profile, 'Studio session', NOW(), NOW())`,
      { ...ids, profile: profile.id });
    const pump = await models.Wardrobe.create({
      name: 'Crimson Satin Ballerina Pump', clothing_category: 'shoes', show_id: ids.show,
      real_brand: 'Maison Rouge', real_product_name: 'Satin Ballet Pump', real_product_url: 'https://shop.example/pump',
    });
    const studs = await models.Wardrobe.create({
      name: 'Crimson Bloom Enamel Stud Earrings', clothing_category: 'jewelry', show_id: ids.show,
      real_product_url: 'https://shop.example/studs', affiliate_url: 'https://aff.example/studs?ref=lala',
    });
    for (const w of [pump, studs]) {
      await run(`INSERT INTO episode_wardrobe (id, episode_id, wardrobe_id, approval_status, created_at, updated_at)
                 VALUES (:id, :ep, :w, 'pending', NOW(), NOW())`, { id: uuid(), ep: ids.ep, w: w.id });
    }
    await auth(request(app).put(`/api/v1/episodes/${ids.ep}/lookbook`)).send({ tagline: 'Every look tells a story.' });
    return { ...ids, pump: pump.id, studs: studs.id };
  }
  const approve = (ep) => auth(request(app).post(`/api/v1/episodes/${ep}/style-sheet/approve`));

  it('every route needs a signed-in user', async () => {
    const ids = await seed();
    for (const res of await Promise.all([
      request(app).get(distUrl(ids.ep)),
      request(app).post(distUrl(ids.ep)),
      request(app).patch(distUrl(ids.ep)).send({ caption: 'x' }),
      request(app).delete(distUrl(ids.ep)),
    ])) expect(res.status).toBe(401);
  });

  it('a Draft sheet is not sent; nothing is in Distribution yet', async () => {
    const ids = await seed();
    const res = await auth(request(app).post(distUrl(ids.ep)));
    expect([res.status, res.body.code]).toEqual([409, 'SHEET_NOT_APPROVED']);
    expect((await auth(request(app).get(distUrl(ids.ep)))).body.data).toEqual({ sent: false });
    expect((await auth(request(app).patch(distUrl(ids.ep))).send({ caption: 'x' })).status).toBe(404);
  });

  it('Send adds every export size with a caption draft from the episode, the event and the tagline', async () => {
    const ids = await seed();
    expect((await approve(ids.ep)).status).toBe(200);
    const res = await auth(request(app).post(distUrl(ids.ep)));
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d).toMatchObject({ sent: true, out_of_date: false, include_shop_links: false, disclosure: null, disclosure_locked: false });
    expect(d.items.map((i) => i.size)).toEqual(['sheet', 'pin', 'story', 'post', 'look', 'pdf']);
    expect(d.items[0]).toMatchObject({ label: 'Style sheet', width: 1024, height: 1536, filename: 'style-sheet-episode-01-sheet.png', path: `/api/v1/episodes/${ids.ep}/style-sheet/export/sheet` });
    expect(d.caption).toBe('Episode 01: Wearable Experiments\n\nWearable Experiments Studio Session · STUDIO BY SABLE\n\nEvery look tells a story.');
    expect(d.post_text).toBe(d.caption);
    // The look's real-world links are offered, not included until she asks.
    expect(d.shop_links).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Maison Rouge Satin Ballet Pump', url: 'https://shop.example/pump', affiliate: false }),
      expect.objectContaining({ label: 'Crimson Bloom Enamel Stud Earrings', url: 'https://aff.example/studs?ref=lala', affiliate: true }),
    ]));
    // Stored beside the platform entries, which stay as they were.
    const dm = await stored(ids.ep);
    expect(dm.youtube).toMatchObject({ enabled: true, title: 'Episode 1' });
    expect(dm.style_sheet).toMatchObject({ caption: d.caption, include_shop_links: false, caption_edited: false });
    expect(dm.style_sheet.sent_by).toBe('evoni@sheet-dist.dev');
  });

  it('with an affiliate link included, the disclosure leads the post and cannot be edited away', async () => {
    const ids = await seed();
    await approve(ids.ep);
    const sent = await auth(request(app).post(distUrl(ids.ep))).send({ include_shop_links: true });
    const d = sent.body.data;
    expect(d).toMatchObject({ include_shop_links: true, disclosure: DISCLOSURE, disclosure_locked: true });
    expect(d.post_text.startsWith(`${DISCLOSURE}\n\n`)).toBe(true);
    expect(d.post_text).toContain('Shop the Look\n');
    expect(d.post_text).toContain('Maison Rouge Satin Ballet Pump: https://shop.example/pump');
    expect(d.post_text).toContain('Crimson Bloom Enamel Stud Earrings: https://aff.example/studs?ref=lala');

    // The caption is hers; the disclosure is not part of it and stays.
    const edited = await auth(request(app).patch(distUrl(ids.ep))).send({ caption: 'Studio night.' });
    expect(edited.body.data).toMatchObject({ caption: 'Studio night.', disclosure: DISCLOSURE });
    expect(edited.body.data.post_text.startsWith(`${DISCLOSURE}\n\nStudio night.\n\n`)).toBe(true);

    // No affiliate link left: no disclosure, links still listed.
    await run('UPDATE wardrobe SET affiliate_url = NULL WHERE id = :id', { id: ids.studs });
    const plain = (await auth(request(app).get(distUrl(ids.ep)))).body.data;
    expect(plain).toMatchObject({ disclosure: null, disclosure_locked: false });
    expect(plain.post_text).toContain('Crimson Bloom Enamel Stud Earrings: https://shop.example/studs');

    // Links left out: no disclosure even with an affiliate link on the look.
    await run('UPDATE wardrobe SET affiliate_url = :u WHERE id = :id', { id: ids.studs, u: 'https://aff.example/studs' });
    const off = (await auth(request(app).patch(distUrl(ids.ep))).send({ include_shop_links: false })).body.data;
    expect(off).toMatchObject({ disclosure: null, post_text: 'Studio night.' });
  });

  it('the caption is checked; sending again keeps an edited caption', async () => {
    const ids = await seed();
    await approve(ids.ep);
    await auth(request(app).post(distUrl(ids.ep)));
    expect((await auth(request(app).patch(distUrl(ids.ep))).send({ caption: 'x'.repeat(2201) })).body.code).toBe('CAPTION_TOO_LONG');
    expect((await auth(request(app).patch(distUrl(ids.ep))).send({ caption: 5 })).body.code).toBe('BAD_CAPTION');
    await auth(request(app).patch(distUrl(ids.ep))).send({ caption: 'Mine.' });
    const again = await auth(request(app).post(distUrl(ids.ep)));
    expect(again.body.data.caption).toBe('Mine.');
  });

  it('saving the platform copy (the tab, or the episode update) keeps the style sheet entry', async () => {
    const ids = await seed();
    await approve(ids.ep);
    await auth(request(app).post(distUrl(ids.ep)));
    const tab = await auth(request(app).put(`/api/v1/world/${ids.show}/episodes/${ids.ep}/distribution`))
      .send({ distribution_metadata: { youtube: { enabled: false, title: 'Edited' }, style_sheet: { caption: 'forged' } } });
    expect(tab.status).toBe(200);
    let dm = await stored(ids.ep);
    expect(dm.youtube).toMatchObject({ enabled: false, title: 'Edited' });
    expect(dm.style_sheet.caption).toMatch(/^Episode 01: Wearable Experiments/);

    const upd = await auth(request(app).put(`/api/v1/episodes/${ids.ep}`))
      .send({ distribution_metadata: JSON.stringify({ tiktok: { enabled: true } }) });
    expect(upd.status).toBe(200);
    dm = await stored(ids.ep);
    expect(dm.tiktok).toMatchObject({ enabled: true });
    expect(dm.style_sheet.caption).toMatch(/^Episode 01: Wearable Experiments/);
  });

  it('an edit after sending marks it out of date; Remove takes it out and leaves the platforms', async () => {
    const ids = await seed();
    await approve(ids.ep);
    await auth(request(app).post(distUrl(ids.ep)));
    await auth(request(app).put(`/api/v1/episodes/${ids.ep}/lookbook`)).send({ tagline: 'Changed.' });
    expect((await auth(request(app).get(distUrl(ids.ep)))).body.data.out_of_date).toBe(true);
    expect((await auth(request(app).post(distUrl(ids.ep)))).body.code).toBe('SHEET_NOT_APPROVED');

    const removed = await auth(request(app).delete(distUrl(ids.ep)));
    expect(removed.body.data).toEqual({ sent: false });
    const dm = await stored(ids.ep);
    expect(dm.style_sheet).toBeUndefined();
    expect(dm.youtube).toMatchObject({ enabled: true });
  });
});
