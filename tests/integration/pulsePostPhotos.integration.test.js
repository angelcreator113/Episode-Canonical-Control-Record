/**
 * A draft's photos (Task #3089; Evoni, 2026-10-13: "Up to four photos. One
 * is the default; multiple photos become a swipeable carousel. Support
 * upload, reorder, remove, and alt text. Uploading shouldn't trigger AI
 * generation."), against the test database with storage off (data URLs):
 * - POST /feed-posts/:id/photos stores 1–4 photos, in order, with their alt
 *   texts; image_url and image_description are the first; a draft only;
 * - a new first photo cuts the post-photo teaser again;
 * - The Pulse at a moment sends none of a hidden photo's, and only the
 *   teaser image of a teaser post, never the others.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const sharp = require('sharp');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const png = (background) => sharp({ create: { width: 600, height: 400, channels: 3, background } }).png().toBuffer();
const RED = { r: 220, g: 20, b: 20 };
const GREEN = { r: 20, g: 200, b: 20 };
const BLUE = { r: 20, g: 20, b: 220 };

(shouldSkip ? describe.skip : describe)('The Pulse post photos (Task #3089)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), ep1: uuid() };
  const savedBuckets = {};
  let token;
  const as = (req) => req.set('Authorization', `Bearer ${token}`);
  const newPost = async (parts = {}) => (await models.FeedPost.create({
    show_id: ids.show, poster_handle: `nia${tag}`, poster_platform: 'lalaverse', post_type: 'post', content_text: 'fit check',
    status: 'draft', story_order: 15, likes: 0, comments_count: 0, shares: 0, sample_comments: [], sort_order: 0, ...parts,
  })).id;
  const upload = async (postId, colours, alts) => {
    let req = as(request(app).post(`/api/v1/feed-posts/${postId}/photos`));
    for (const [i, c] of colours.entries()) req = req.attach('photos', await png(c), { filename: `p${i}.png`, contentType: 'image/png' });
    if (alts !== undefined) req = req.field('alts', JSON.stringify(alts));
    return req;
  };

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    for (const k of ['S3_PRIMARY_BUCKET', 'AWS_S3_BUCKET']) { savedBuckets[k] = process.env[k]; delete process.env[k]; }
    token = TokenService.generateTokenPair({ id: 'test-photos', email: 'evoni@photos.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Photos ${tag}`, slug: `photos-${tag}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep1, :show, 'One', 1, 'published', NOW(), NOW())`, ids);
  });

  afterAll(async () => {
    for (const [k, v] of Object.entries(savedBuckets)) if (v !== undefined) process.env[k] = v;
    await run('DELETE FROM pulse_reveals WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_post_numbers WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('up to four photos, in order, with alt text; the first is image_url and image_description', async () => {
    const id = await newPost();
    const res = await upload(id, [RED, GREEN, BLUE], ['the gown', ' the shoes\nclose up ', '']);
    expect(res.status).toBe(200);
    const post = await models.FeedPost.findByPk(id);
    expect(post.photos.map((p) => p.alt)).toEqual(['the gown', 'the shoes close up', '']);
    expect(post.photos.every((p) => p.url.startsWith('data:image/jpeg'))).toBe(true);
    expect(post.image_url).toBe(post.photos[0].url);
    expect(post.image_description).toBe('the gown');
    // Uploading again replaces them: one photo, no alt texts sent.
    expect((await upload(id, [BLUE])).status).toBe(200);
    await post.reload();
    expect(post.photos).toHaveLength(1);
    expect(post.photos[0].alt).toBe('');
    expect(post.image_description).toBeNull();
  });

  test('a draft only; one to four image files; alts must be a list', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const live = await newPost({ status: 'live' });
    expect((await upload(live, [RED])).status).toBe(409);
    const id = await newPost();
    expect((await as(request(app).post(`/api/v1/feed-posts/${id}/photos`))).status).toBe(400);
    const five = await upload(id, [RED, RED, RED, RED, RED]);
    expect(five.status).toBe(400);
    expect(five.body.error).toBe('Up to 4 photos.');
    const svg = await as(request(app).post(`/api/v1/feed-posts/${id}/photos`)).attach('photos', Buffer.from('<svg/>'), { filename: 'a.svg', contentType: 'image/svg+xml' });
    expect(svg.status).toBe(400);
    const bad = await as(request(app).post(`/api/v1/feed-posts/${id}/photos`)).attach('photos', await png(RED), { filename: 'a.png', contentType: 'image/png' }).field('alts', 'not json');
    expect(bad.status).toBe(400);
    expect((await request(app).post(`/api/v1/feed-posts/${id}/photos`).attach('photos', await png(RED), { filename: 'a.png', contentType: 'image/png' })).status).toBe(401);
    expect((await models.FeedPost.findByPk(id)).photos).toBeNull();
  });

  test('a new first photo cuts the post-photo teaser again', async () => {
    const id = await newPost();
    await models.PulseReveal.create({ show_id: ids.show, item_type: 'image', image_kind: 'post_photo', item_id: id, moment: 'story_time', story_order: 99, mode: 'teaser', teaser_style: 'crop', crop_json: { x: 0, y: 0, w: 0.5, h: 0.5 } });
    expect((await upload(id, [GREEN, RED])).status).toBe(200);
    const reveal = await models.PulseReveal.findOne({ where: { show_id: ids.show, item_id: id } });
    expect(reveal.teaser_url).toBeTruthy();
    const { data } = await sharp(Buffer.from(reveal.teaser_url.split(',')[1], 'base64')).raw().toBuffer({ resolveWithObject: true });
    expect(data[1]).toBeGreaterThan(data[0]);   // cut from the green first photo
  });

  test('The Pulse sends none of a hidden photo\'s photos, and only the teaser image of a teaser post', async () => {
    const photos = [{ url: 'https://cdn/a.jpg', alt: 'a' }, { url: 'https://cdn/b.jpg', alt: 'b' }];
    const hiddenPhoto = await newPost({ status: 'live', photos, image_url: photos[0].url, content_text: `hidden photos ${tag}` });
    const teased = await newPost({ status: 'live', photos, image_url: photos[0].url, content_text: `teased ${tag}` });
    await models.PulseReveal.create({ show_id: ids.show, item_type: 'image', image_kind: 'post_photo', item_id: hiddenPhoto, moment: 'story_time', story_order: 99, mode: 'hidden' });
    await models.PulseReveal.create({ show_id: ids.show, item_type: 'post', item_id: teased, moment: 'story_time', story_order: 99, mode: 'teaser', teaser_url: 'https://cdn/teaser.jpg' });
    const res = await request(app).get(`/api/v1/feed-posts?show_id=${ids.show}&at=present`);
    const byId = Object.fromEntries(res.body.data.map((p) => [p.id, p]));
    expect(byId[hiddenPhoto].photos).toEqual([]);
    expect(byId[hiddenPhoto].image_url).toBeNull();
    expect(byId[teased].photos).toEqual([{ url: 'https://cdn/teaser.jpg', alt: '' }]);
    expect(JSON.stringify(res.body)).not.toContain('https://cdn/b.jpg');
  });
});
