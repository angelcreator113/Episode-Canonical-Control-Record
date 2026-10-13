/**
 * The public recap's images (Task #3099; Evoni, 2026-10-13: the bucket
 * first, then images; public assets separate from private drafts), against
 * the test database. The download and the bucket are stood in for:
 * - publishing copies each post's image as The Pulse shows it now into the
 *   public site bucket: its own photo, its photo's teaser while it is one,
 *   nothing while hidden; re-encoded as JPEG, under the recap's prefix;
 * - the public recap sends { url, alt } from the copy, never the studio URL;
 *   a photo hidden after publishing drops out; republishing copies only what
 *   changed;
 * - one image that cannot be read is marked failed and the recap still
 *   publishes; without SITE_PUBLIC_BUCKET it publishes text only.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const sharp = require('sharp');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const recaps = require('../../src/services/pulseRecap');
const slots = require('../../src/services/websiteSlotService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('The public recap images (Task #3099)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), ep1: uuid() };
  const WEEK = recaps.weekStartOf(new Date('2026-09-30T12:00:00Z'));
  const at = (day) => new Date(new Date(`${WEEK}T00:00:00Z`).getTime() + (day * 24 + 12) * 3600 * 1000);
  const p = {};
  const env = { bucket: process.env.SITE_PUBLIC_BUCKET, cdn: process.env.SITE_PUBLIC_CDN };
  let admin;
  let png;
  let stored;
  let downloads;
  const as = (req) => req.set('Authorization', `Bearer ${admin}`);
  const post = (key, parts) => models.FeedPost.create({
    show_id: ids.show, poster_handle: `${key}${tag}`, poster_display_name: key, poster_platform: 'lalaverse', post_type: 'post',
    content_text: `${key} post`, status: 'live', story_order: 15, likes: 100, comments_count: 0, shares: 0, sample_comments: [], sort_order: 0,
    posted_at: at(1), ...parts,
  }).then((row) => { p[key] = row.id; return row; });
  const recapFor = async (postIds) => models.PulseRecap.create({ show_id: ids.show, week_start: WEEK, status: 'draft', title: `Week ${tag}`, post_ids: postIds });
  const publicPosts = async (id) => (await request(app).get(`/api/v1/public/recaps/${id}`)).body.recap.posts;

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-recap-img', email: 'evoni@recapimg.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    png = await sharp({ create: { width: 40, height: 30, channels: 3, background: { r: 200, g: 150, b: 46 } } }).png().toBuffer();
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `RecapImg ${tag}`, slug: `recapimg-${tag}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep1, :show, 'One', 1, 'published', NOW(), NOW())`, ids);
    await post('photo', { image_url: 'https://studio.example/private/photo.png', image_description: 'Lala on the stairs', likes: 900 });
    await post('teased', { image_url: 'https://studio.example/private/teased.png', image_description: 'the full look', likes: 800 });
    await models.PulseReveal.create({ show_id: ids.show, item_type: 'image', image_kind: 'post_photo', item_id: p.teased, moment: 'story_time', story_order: 99, mode: 'teaser', teaser_url: 'https://studio.example/private/teased-teaser.jpg', source: 'set' });
    await post('hidden', { image_url: 'https://studio.example/private/hidden.png', likes: 700 });
    await models.PulseReveal.create({ show_id: ids.show, item_type: 'image', image_kind: 'post_photo', item_id: p.hidden, moment: 'story_time', story_order: 99, mode: 'hidden', source: 'set' });
    await post('words', { likes: 600 });
    await post('broken', { image_url: 'https://studio.example/private/broken.png', likes: 500 });
  });

  beforeEach(() => {
    process.env.SITE_PUBLIC_BUCKET = 'lalaverse-site-test';
    process.env.SITE_PUBLIC_CDN = 'site.cdn.test';
    stored = [];
    downloads = [];
    jest.spyOn(slots, 'putObject').mockImplementation(async (cfg, key, buffer, type) => { stored.push({ bucket: cfg.bucket, key, buffer, type }); });
    jest.spyOn(recaps, 'imageBytes').mockImplementation(async (url) => {
      downloads.push(url);
      if (url.includes('broken')) throw new Error('404');
      return png;
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    await run('DELETE FROM pulse_recaps WHERE show_id = :show', ids);
  });

  afterAll(async () => {
    for (const [name, value] of [['SITE_PUBLIC_BUCKET', env.bucket], ['SITE_PUBLIC_CDN', env.cdn]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    await run('DELETE FROM pulse_reveals WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('publishing copies each image as The Pulse shows it: the photo, the teaser while it is one, nothing hidden', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const recap = await recapFor([p.photo, p.teased, p.hidden, p.words, p.broken]);
    const res = await as(request(app).post(`/api/v1/pulse-recaps/${recap.id}/publish`));
    expect(res.status).toBe(200);
    expect(res.body.recap.public_images).toEqual({ copied: 2, failed: 1 });   // the broken one is marked, the recap still publishes
    expect(downloads.sort()).toEqual([
      'https://studio.example/private/broken.png', 'https://studio.example/private/photo.png', 'https://studio.example/private/teased-teaser.jpg',
    ]);
    expect(stored).toHaveLength(2);
    for (const s of stored) {
      expect(s.bucket).toBe('lalaverse-site-test');
      expect(s.key).toMatch(new RegExp(`^site-public/recaps/${recap.id}/[0-9a-f-]{36}\\.jpg$`));
      expect(s.type).toBe('image/jpeg');
      expect((await sharp(s.buffer).metadata()).format).toBe('jpeg');
    }

    const posts = await publicPosts(recap.id);
    const byName = Object.fromEntries(posts.map((x) => [x.poster_display_name, x.image]));
    expect(byName.photo).toEqual({ url: expect.stringMatching(/^https:\/\/site\.cdn\.test\/site-public\/recaps\//), alt: 'Lala on the stairs' });
    expect(byName.teased).toEqual({ url: expect.stringMatching(/^https:\/\/site\.cdn\.test\//), alt: '' });
    expect(byName.hidden).toBeNull();
    expect(byName.words).toBeNull();
    expect(byName.broken).toBeNull();
    // No studio image URL reaches the public site.
    expect(JSON.stringify(posts)).not.toContain('studio.example');
  });

  test('a photo hidden after publishing drops out; republishing copies only what changed', async () => {
    const recap = await recapFor([p.photo, p.teased]);
    await recaps.publish(models, recap, 'evoni');
    expect(stored).toHaveLength(2);
    const reveal = await models.PulseReveal.create({ show_id: ids.show, item_type: 'image', image_kind: 'post_photo', item_id: p.photo, moment: 'story_time', story_order: 99, mode: 'hidden', source: 'set' });
    try {
      let posts = await publicPosts(recap.id);
      expect(posts.find((x) => x.poster_display_name === 'photo').image).toBeNull();
      expect(posts.find((x) => x.poster_display_name === 'teased').image).not.toBeNull();
      await reveal.destroy();
      posts = await publicPosts(recap.id);
      expect(posts.find((x) => x.poster_display_name === 'photo').image).not.toBeNull();

      // The teaser is revealed: the copy no longer matches, so it drops out until republished, which copies only it.
      await models.PulseReveal.destroy({ where: { show_id: ids.show, item_id: String(p.teased) } });
      posts = await publicPosts(recap.id);
      expect(posts.find((x) => x.poster_display_name === 'teased').image).toBeNull();
      await recaps.unpublish(recap);
      stored = [];
      await recaps.publish(models, recap, 'evoni');
      expect(stored).toHaveLength(1);
      posts = await publicPosts(recap.id);
      expect(posts.find((x) => x.poster_display_name === 'teased').image).toEqual({ url: expect.any(String), alt: 'the full look' });
    } finally {
      await models.PulseReveal.destroy({ where: { show_id: ids.show, item_id: String(p.teased) }, force: true });
      await models.PulseReveal.create({ show_id: ids.show, item_type: 'image', image_kind: 'post_photo', item_id: p.teased, moment: 'story_time', story_order: 99, mode: 'teaser', teaser_url: 'https://studio.example/private/teased-teaser.jpg', source: 'set' });
    }
  });

  test('without SITE_PUBLIC_BUCKET the recap publishes text only', async () => {
    delete process.env.SITE_PUBLIC_BUCKET;
    const recap = await recapFor([p.photo]);
    await recaps.publish(models, recap, 'evoni');
    expect(stored).toHaveLength(0);
    expect(downloads).toHaveLength(0);
    expect((await publicPosts(recap.id))[0].image).toBeNull();
  });
});
