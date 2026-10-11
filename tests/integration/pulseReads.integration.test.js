/**
 * The reads The Pulse needs (Task #2924):
 * - GET /api/v1/feed-posts carries each post's author city and photo
 *   (author_portrait_url, from the registry character linked to the
 *   author's profile) and each live comment's author photo;
 * - trending counts live posts only, never drafts;
 * - Lala's profile read returns her cover_url;
 * - GET /api/v1/pulse-fits/latest returns the newer of the show's newest
 *   everyday fit and its latest published episode's Style Page front (else
 *   hero) photo, and creates no Lookbook row.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('The Pulse reads', () => {
  let token;
  const tag = crypto.randomUUID().slice(0, 8);
  const ids = {
    show: crypto.randomUUID(), reg: crypto.randomUUID(), rcAva: crypto.randomUUID(),
    post: crypto.randomUUID(), draft: crypto.randomUUID(),
    ep1: crypto.randomUUID(), ep2: crypto.randomUUID(), ep3: crypto.randomUUID(), lb2: crypto.randomUUID(),
  };
  const p = {};
  const auth = (req) => req.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-pulse-reads', email: 'evoni@reads.dev', name: 'Reads Test', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Reads ${tag}`, slug: `reads-${tag}` });
    for (const [key, city] of [['ava', 'echo_park'], ['zed', null]]) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, city, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', :city, NOW(), NOW()) RETURNING id`,
      { handle: `${key}-${tag}`, display: `${key} ${tag}`, city });
      p[key] = row.id;
    }
    await run(`INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:reg, 'Reads registry', NOW(), NOW())`, ids);
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, portrait_url, feed_profile_id, created_at, updated_at)
               VALUES (:rcAva, :reg, :key, 'Ava', 'https://cdn/ava.jpg', :prof, NOW(), NOW())`, { ...ids, key: `ava-${tag}`, prof: p.ava });

    await run(`INSERT INTO feed_posts (id, show_id, poster_handle, social_profile_id, content_text, status, posted_at, created_at, updated_at)
               VALUES (:post, :show, 'ava', :prof, 'Night out #NeonNights', 'live', NOW(), NOW(), NOW())`, { ...ids, prof: p.ava });
    await run(`INSERT INTO feed_posts (id, show_id, poster_handle, social_profile_id, content_text, status, posted_at, created_at, updated_at)
               VALUES (:draft, :show, 'zed', :prof, 'Secret #DraftOnly', 'draft', NOW(), NOW(), NOW())`, { ...ids, prof: p.zed });
    await run(`INSERT INTO feed_comments (feed_post_id, show_id, handle, text, status, social_profile_id)
               VALUES (:post, :show, 'ava', 'me again', 'live', :prof), (:post, :show, 'zed', 'cute', 'live', :zed)`,
    { ...ids, prof: p.ava, zed: p.zed });
  });

  afterAll(async () => {
    await run('DELETE FROM feed_comments WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_fits WHERE show_id = :show', ids);
    await run('DELETE FROM episode_lookbook_images WHERE episode_id IN (:ep1, :ep2, :ep3)', ids);
    await run('DELETE FROM episode_lookbooks WHERE episode_id IN (:ep1, :ep2, :ep3)', ids);
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM registry_characters WHERE id = :rcAva', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a, :z)', { a: p.ava, z: p.zed });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  it('feed posts carry the author city and photo; comments carry their authors\' photos', async () => {
    const res = await auth(request(app).get(`/api/v1/feed-posts?show_id=${ids.show}&with=comments`));
    expect(res.status).toBe(200);
    const [post] = res.body.data;
    expect(post.id).toBe(ids.post);
    expect(post.socialProfile.city).toBe('echo_park');
    expect(post.author_portrait_url).toBe('https://cdn/ava.jpg');
    const byHandle = Object.fromEntries(post.comments.map((c) => [c.handle, c.portrait_url]));
    expect(byHandle).toEqual({ ava: 'https://cdn/ava.jpg', zed: null });
  });

  it('trending counts live posts only', async () => {
    const res = await auth(request(app).get(`/api/v1/feed-enhanced/${ids.show}/trending`));
    expect(res.status).toBe(200);
    const topics = (res.body.data || res.body.topics || res.body).map((t) => t.topic.toLowerCase());
    expect(topics).toContain('#neonnights');
    expect(topics).not.toContain('#draftonly');
  });

  it("Lala's profile read returns her cover", async () => {
    const { getLalaFeedProfile } = require('../../src/services/lalaFeedProfile');
    const lalaKey = 'lala';
    const [[existing]] = await run("SELECT id FROM registry_characters WHERE character_key = 'lala' AND deleted_at IS NULL LIMIT 1");
    const lalaId = existing?.id || crypto.randomUUID();
    if (!existing) {
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, cover_url, created_at, updated_at)
                 VALUES (:id, :reg, :key, 'Lala', 'https://cdn/lala-cover.jpg', NOW(), NOW())`, { id: lalaId, reg: ids.reg, key: lalaKey });
    }
    const [[before]] = await run('SELECT cover_url FROM registry_characters WHERE id = :id', { id: lalaId });
    await run("UPDATE registry_characters SET cover_url = 'https://cdn/lala-cover.jpg', updated_at = NOW() WHERE id = :id", { id: lalaId });
    try {
      const read = await getLalaFeedProfile(models, ids.show);
      expect(read.cover_url).toBe('https://cdn/lala-cover.jpg');
    } finally {
      if (existing) await run('UPDATE registry_characters SET cover_url = :c WHERE id = :id', { id: lalaId, c: before.cover_url });
      else await run('DELETE FROM registry_characters WHERE id = :id', { id: lalaId });
    }
  });

  it('latest fit: the newer of an everyday fit and a published episode front/hero photo, creating nothing', async () => {
    const url = `/api/v1/pulse-fits/latest?show_id=${ids.show}`;
    let res = await auth(request(app).get(url));
    expect(res.status).toBe(200);
    expect(res.body.latest).toBeNull();

    // Episode 2 is published with a Style Page front photo; episode 3 is not
    // published; episode 1 is published but older.
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES
      (:ep1, :show, 'One', 1, 'published', NOW(), NOW()),
      (:ep2, :show, 'Two', 2, 'published', NOW(), NOW()),
      (:ep3, :show, 'Three', 3, 'draft', NOW(), NOW())`, ids);
    await run('INSERT INTO episode_lookbooks (id, episode_id) VALUES (:lb2, :ep2)', ids);
    await run(`INSERT INTO episode_lookbook_images (lookbook_id, episode_id, category, image_url, created_at) VALUES
      (:lb2, :ep2, 'hero', 'https://cdn/ep2-hero.jpg', NOW() - INTERVAL '2 days'),
      (:lb2, :ep2, 'front', 'https://cdn/ep2-front.jpg', NOW() - INTERVAL '2 days')`, ids);
    const [[{ n: lookbooksBefore }]] = await run('SELECT COUNT(*)::int AS n FROM episode_lookbooks WHERE episode_id IN (:ep1, :ep2, :ep3)', ids);

    res = await auth(request(app).get(url));
    expect(res.body.latest).toMatchObject({ source: 'episode', image_url: 'https://cdn/ep2-front.jpg', episode_number: 2 });

    await run(`INSERT INTO pulse_fits (show_id, image_url, caption, story_date) VALUES (:show, 'https://cdn/fit.jpg', 'Coffee run', '2026-03-01')`, ids);
    res = await auth(request(app).get(url));
    expect(res.body.latest).toMatchObject({ source: 'fit', image_url: 'https://cdn/fit.jpg', caption: 'Coffee run' });
    expect(res.body.episode.image_url).toBe('https://cdn/ep2-front.jpg');

    const [[{ n: lookbooksAfter }]] = await run('SELECT COUNT(*)::int AS n FROM episode_lookbooks WHERE episode_id IN (:ep1, :ep2, :ep3)', ids);
    expect(lookbooksAfter).toBe(lookbooksBefore);

    expect((await auth(request(app).get('/api/v1/pulse-fits/latest?show_id=nope'))).status).toBe(400);
    expect((await request(app).get(url)).status).toBe(401);
  });
});
