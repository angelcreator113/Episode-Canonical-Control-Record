/**
 * Teaser images (Task #3034; Evoni, 2026-10-12: "Teasers: cropped by default
 * … Use blur when concealing the full reveal matters. Create the teaser from
 * the existing image"), against the test database, with uploads as data URLs:
 * - saving a crop teaser cuts the chosen detail from the existing image; a
 *   blur teaser is the whole image blurred; neither calls AI;
 * - the reads send the teaser image, never the full image URL; hidden stays
 *   hidden; an item with no image (an event) needs no cut;
 * - a crop or style that does not make sense is refused; an image that
 *   cannot be read is a 502 and the reveal keeps no image at all.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const sharp = require('sharp');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const teasers = require('../../src/services/pulseTeasers');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const dataUrl = (buf, type = 'image/png') => `data:${type};base64,${buf.toString('base64')}`;
const decode = (url) => Buffer.from(url.split(',')[1], 'base64');
/** The mean colour of an image, as [r, g, b]. */
const meanOf = async (buf) => (await sharp(buf).stats()).channels.slice(0, 3).map((c) => Math.round(c.mean));

(shouldSkip ? describe.skip : describe)('The Pulse teaser images (Task #3034)', () => {
  const ids = { show: uuid(), fit: uuid(), post: uuid(), badPost: uuid() };
  const savedBuckets = {};
  let admin;
  let fullFit;
  let fullCover;
  const as = (req) => req.set('Authorization', `Bearer ${admin}`);
  const put = (body) => as(request(app).put('/api/v1/pulse-reveals')).send({ show_id: ids.show, moment: 'story_time', at: 'ep:9:after_episode', ...body });

  beforeAll(async () => {
    for (const k of ['S3_PRIMARY_BUCKET', 'AWS_S3_BUCKET']) { savedBuckets[k] = process.env[k]; delete process.env[k]; }
    admin = TokenService.generateTokenPair({ id: 'test-admin-teasers', email: 'evoni@teasers.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    // A fit: left half red, right half blue, so a crop can be told from the whole.
    const red = await sharp({ create: { width: 200, height: 200, channels: 3, background: { r: 220, g: 20, b: 20 } } }).png().toBuffer();
    fullFit = dataUrl(await sharp({ create: { width: 400, height: 200, channels: 3, background: { r: 20, g: 20, b: 220 } } })
      .composite([{ input: red, left: 0, top: 0 }]).png().toBuffer());
    fullCover = dataUrl(await sharp({ create: { width: 1200, height: 400, channels: 3, background: { r: 184, g: 150, b: 46 } } }).png().toBuffer());
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, CAST(:meta AS json), NOW(), NOW())`,
      { show: ids.show, name: `Teasers ${ids.show.slice(0, 8)}`, slug: `teasers-${ids.show.slice(0, 8)}`, meta: JSON.stringify({ pulse_cover: { url: fullCover, alt: 'The gala gown' } }) });
    await run(`INSERT INTO pulse_fits (id, show_id, image_url, caption, created_at, updated_at) VALUES (:fit, :show, :img, 'The reveal gown', NOW(), NOW())`,
      { fit: ids.fit, show: ids.show, img: fullFit });
    for (const [id, img] of [[ids.post, fullFit], [ids.badPost, 'data:image/jpeg;base64,bm90IGFuIGltYWdl']]) {
      await run(`INSERT INTO feed_posts (id, show_id, poster_handle, content_text, image_url, status, story_order, posted_at, created_at, updated_at)
                 VALUES (:id, :show, 'lala', 'the dress', :img, 'live', 1, NOW(), NOW(), NOW())`, { id, show: ids.show, img });
    }
  });

  afterAll(async () => {
    for (const [k, v] of Object.entries(savedBuckets)) if (v !== undefined) process.env[k] = v;
    await run('DELETE FROM pulse_reveals WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_fits WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('a crop teaser is the chosen detail, cut from the fit; the fit read sends it and never the full image or caption', async () => {
    const res = await put({ item_type: 'image', image_kind: 'fit', item_id: ids.fit, crop: { x: 0, y: 0, w: 0.5, h: 1 } });
    expect(res.status).toBe(201);
    expect(res.body.reveal).toMatchObject({ mode: 'teaser', teaser_style: 'crop', crop: { x: 0, y: 0, w: 0.5, h: 1 } });
    const url = res.body.reveal.teaser_url;
    expect(url).toMatch(/^data:image\/jpeg;base64,/);
    const cut = decode(url);
    expect(await sharp(cut).metadata()).toMatchObject({ format: 'jpeg', width: 200, height: 200 });
    const [r, , b] = await meanOf(cut);
    expect(r).toBeGreaterThan(180);   // the red half only
    expect(b).toBeLessThan(60);

    const fit = await as(request(app).get(`/api/v1/pulse-fits/latest?show_id=${ids.show}&at=present`));
    expect(fit.body.latest).toMatchObject({ teaser: true, teaser_style: 'crop', image_url: url, caption: null });
    expect(JSON.stringify(fit.body)).not.toContain(fullFit);
    expect(JSON.stringify(fit.body)).not.toContain('The reveal gown');
  });

  test('a blur teaser is the whole image, blurred and scaled for display; the cover read sends it, not the cover', async () => {
    const res = await put({ item_type: 'image', image_kind: 'cover', item_id: ids.show, teaser_style: 'blur' });
    expect(res.status).toBe(201);
    const url = res.body.reveal.teaser_url;
    expect(await sharp(decode(url)).metadata()).toMatchObject({ format: 'jpeg', width: 900, height: 300 });
    const cover = await as(request(app).get(`/api/v1/shows/${ids.show}/pulse-cover?at=present`));
    expect(cover.body.cover).toMatchObject({ url, teaser: true, teaser_style: 'blur', alt: '' });
    expect(JSON.stringify(cover.body)).not.toContain(fullCover.slice(30, 120));
    expect(JSON.stringify(cover.body)).not.toContain('The gala gown');
    // From its moment, the cover itself.
    const after = await as(request(app).get(`/api/v1/shows/${ids.show}/pulse-cover?at=ep:9:after_episode`));
    expect(after.body.cover).toMatchObject({ url: fullCover, alt: 'The gala gown' });
  });

  test('a post teaser: the feed sends the teaser photo, never the full one; hidden sends no photo and clears the teaser', async () => {
    const res = await put({ item_type: 'image', image_kind: 'post_photo', item_id: ids.post });
    expect(res.body.reveal.teaser_url).toMatch(/^data:image\/jpeg;base64,/);
    let feed = await as(request(app).get(`/api/v1/feed-posts?show_id=${ids.show}&at=present`));
    let post = feed.body.data.find((x) => x.id === ids.post);
    expect(post).toMatchObject({ photo_teaser: true, teaser_style: 'crop', image_url: res.body.reveal.teaser_url });
    expect(JSON.stringify(feed.body)).not.toContain(fullFit.slice(30, 120));

    const hidden = await put({ item_type: 'image', image_kind: 'post_photo', item_id: ids.post, mode: 'hidden' });
    expect(hidden.status).toBe(200);
    expect(hidden.body.reveal).toMatchObject({ mode: 'hidden', teaser_url: null });
    feed = await as(request(app).get(`/api/v1/feed-posts?show_id=${ids.show}&at=present`));
    post = feed.body.data.find((x) => x.id === ids.post);
    expect(post.image_url).toBeNull();
    expect(post.photo_teaser).toBeUndefined();
  });

  test('an image that cannot be read: 502, and the reveal keeps no image, so nothing shows', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await put({ item_type: 'image', image_kind: 'post_photo', item_id: ids.badPost });
    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({ code: 'TEASER_NOT_CUT', error: 'The teaser could not be cut from that image.' });
    expect(res.body.reveal).toMatchObject({ mode: 'teaser', teaser_url: null });
    const feed = await as(request(app).get(`/api/v1/feed-posts?show_id=${ids.show}&at=present`));
    const post = feed.body.data.find((x) => x.id === ids.badPost);
    expect(post).toMatchObject({ photo_teaser: true, image_url: null, image_urls: [] });
  });

  test('a crop or style that does not make sense is refused; an event needs no cut', async () => {
    for (const crop of [{ x: 0.8, y: 0, w: 0.5, h: 0.5 }, { x: 0, y: 0, w: 0.01, h: 0.5 }, { x: -1, y: 0, w: 0.5, h: 0.5 }, 'middle']) {
      const res = await put({ item_type: 'image', image_kind: 'fit', item_id: ids.fit, crop });
      expect(res.status).toBe(400);
    }
    expect((await put({ item_type: 'image', image_kind: 'fit', item_id: ids.fit, teaser_style: 'pixelate' })).body.error).toBe('teaser_style must be crop or blur.');
    const event = await put({ item_type: 'event', item_id: uuid(), episode_id: undefined, moment: 'story_time' });
    expect(event.status).toBe(201);
    expect(event.body.reveal.teaser_url).toBeNull();
  });

  test('sourceImageUrl: a city and its story bubble come from the Dream Cities list; events and characters have none', async () => {
    const cities = [{ key: 'dazzle_district', image_url: 'https://cdn/d.jpg', bubble_image_url: 'https://cdn/db.jpg' }];
    const db = { sequelize: { QueryTypes: { SELECT: 'SELECT' }, query: async () => [{ data: cities }] } };
    expect(await teasers.sourceImageUrl(db, { item_type: 'image', image_kind: 'city', item_id: 'dazzle_district' })).toBe('https://cdn/d.jpg');
    expect(await teasers.sourceImageUrl(db, { item_type: 'image', image_kind: 'city_bubble', item_id: 'dazzle_district' })).toBe('https://cdn/db.jpg');
    expect(await teasers.sourceImageUrl(db, { item_type: 'image', image_kind: 'city', item_id: 'echo_park' })).toBeNull();
    expect(await teasers.sourceImageUrl(db, { item_type: 'event', item_id: uuid() })).toBeNull();
    expect(await teasers.sourceImageUrl(db, { item_type: 'character', item_id: '12' })).toBeNull();
  });
});
