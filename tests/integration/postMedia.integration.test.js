/**
 * Visual Memory phase 2 with real Pulse post formats (services/postMedia,
 * migration 20261019130000-post-format), against the test database through
 * the routes:
 *   - a post points at a library picture; the file is not copied (one row)
 *     and the caption does not change
 *   - a draft can use a private picture, but can't go live with it until
 *     "Approve and make public"; a live post can't take a private one
 *   - the public feed never shows a picture that isn't approved and public,
 *     nor a story past its 24 hours; an ADMIN still sees both
 *   - a carousel takes 2 to 10 pictures
 *   - text-only posts are listed, with the poster's pictures ranked for the caption
 *   - every write is ADMIN only; the migration's down drops its one column
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const media = require('../../src/services/mediaLibrary');
const migration = require('../../src/migrations/20261019130000-post-format');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });

(shouldSkip ? describe.skip : describe)('Visual Memory phase 2: pictures on posts, and Pulse formats', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), maren: uuid(), draft: uuid(), live: uuid(), leaky: uuid(), story: uuid(), old: uuid() };
  const url = (name) => `https://cdn.test/${tag}/${name}.jpg`;
  const pics = {};
  let admin;
  let user;
  let pid;
  const as = (req, token = admin) => req.set('Authorization', `Bearer ${token}`);
  const editor = (postId) => `/api/v1/post-media/posts/${postId}`;

  beforeAll(async () => {
    admin = TokenService.generateTokenPair({ id: 'test-admin-pm', email: 'evoni@pm.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    user = TokenService.generateTokenPair({ id: 'test-user-pm', email: 'user@pm.dev', name: 'User', groups: ['USER'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `PM ${tag}`, slug: `pm-${tag}` });
    await run("INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:reg, 'PM registry', NOW(), NOW())", ids);
    const [[p]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
      VALUES (:h, 'pulse', 'test', 'PM Maren', 'lalaverse', NOW(), NOW()) RETURNING id`, { h: `pmmaren${tag}` });
    pid = p.id;
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, feed_profile_id, created_at, updated_at)
               VALUES (:maren, :reg, :key, 'PM Maren', :pid, NOW(), NOW())`, { ...ids, key: `pm-maren-${tag}`, pid });
    const post = (id, extra) => run(`INSERT INTO feed_posts (id, show_id, social_profile_id, poster_handle, content_text, status, image_url, post_format, posted_at, created_at, updated_at)
      VALUES (:id, :show, :pid, :h, :text, :status, :image, :format, :posted, NOW(), NOW())`,
    { id, show: ids.show, pid, h: `@pmmaren${tag}`, text: 'a post', status: 'draft', image: null, format: null, posted: null, ...extra });
    await post(ids.draft, { text: 'still here. the bread is rising.' });
    await post(ids.live, { text: 'quiet sunday', status: 'live', posted: new Date() });
    await post(ids.old, { text: 'the bread is rising again', status: 'live', posted: new Date() });
    const make = async (name, fields) => (await media.createAsset(models, {
      url: url(name), links: [{ entity_type: 'character', entity_id: ids.maren }], ...fields,
    })).asset;
    pics.dough = await make('dough', { caption: 'Dough rising in a ceramic bowl', status: 'draft', visibility: 'private', details: { objects: ['bread', 'ceramic bowl'] } });
    pics.kitchen = await make('kitchen', { caption: 'Morning in the kitchen', status: 'approved', visibility: 'public' });
    pics.gala = await make('gala', { caption: 'Gala gown on the runway', status: 'approved', visibility: 'public' });
    pics.secret = await make('secret', { caption: 'Behind the scenes', status: 'approved', visibility: 'internal' });
    // Already on posts, as the Pulse reads them: one not public, one story past its day.
    await post(ids.leaky, { text: 'a peek', status: 'live', posted: new Date(), image: url('secret') });
    await run('UPDATE feed_posts SET photos = CAST(:photos AS JSONB) WHERE id = :id', { id: ids.leaky, photos: JSON.stringify([{ url: url('secret'), alt: '' }, { url: url('gala'), alt: '' }]) });
    await post(ids.story, { text: 'yesterday', status: 'live', format: 'story', posted: new Date(Date.now() - 30 * 3600000) });
  });

  afterAll(async () => {
    await run('DELETE FROM media_asset_links WHERE asset_id IN (SELECT id FROM media_assets WHERE url LIKE :pre)', { pre: `https://cdn.test/${tag}/%` });
    await run('DELETE FROM media_assets WHERE url LIKE :pre', { pre: `https://cdn.test/${tag}/%` });
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM registry_characters WHERE id = :maren', ids);
    await run('DELETE FROM social_profiles WHERE id = :pid', { pid });
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  it('every write is ADMIN only', async () => {
    expect((await as(request(app).get(editor(ids.draft)), user)).status).toBe(403);
    expect((await as(request(app).put(editor(ids.draft)), user).send({ asset_ids: [pics.kitchen.id] })).status).toBe(403);
    expect((await as(request(app).post(`${editor(ids.draft)}/approve-pictures`), user)).status).toBe(403);
    expect((await as(request(app).get('/api/v1/post-media/needs-picture'), user)).status).toBe(403);
  });

  it('a draft takes a library picture without copying it, and keeps its caption', async () => {
    const res = await as(request(app).put(editor(ids.draft))).send({ asset_ids: [pics.dough.id] });
    expect(res.status).toBe(200);
    expect(res.body.pictures.map((p) => p.asset?.id)).toEqual([pics.dough.id]);
    const [post] = await q('SELECT content_text, image_url, photos FROM feed_posts WHERE id = :draft', ids);
    expect(post.content_text).toBe('still here. the bread is rising.');
    expect(post.image_url).toBe(url('dough'));
    expect(post.photos).toEqual([{ url: url('dough'), alt: 'Dough rising in a ceramic bowl' }]);
    const [{ n }] = await q('SELECT COUNT(*)::int AS n FROM media_assets WHERE md5(url) = md5(:u) AND deleted_at IS NULL', { u: url('dough') });
    expect(n).toBe(1);
    const [link] = await q("SELECT role FROM media_asset_links WHERE asset_id = :a AND entity_type = 'post' AND entity_id = :draft AND deleted_at IS NULL", { a: pics.dough.id, draft: ids.draft });
    expect(link.role).toBe('pictured');
  });

  it('it can\'t go live with a private picture until it is approved and made public', async () => {
    const blocked = await as(request(app).put(`/api/v1/feed-posts/${ids.draft}`)).send({ status: 'live' });
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('pictures_not_public');
    expect(blocked.body.pictures.map((p) => p.id)).toEqual([pics.dough.id]);
    const schedule = await as(request(app).put(`/api/v1/feed-posts/${ids.draft}/release-time`)).send({ mode: 'schedule', at: new Date(Date.now() + 86400000).toISOString() });
    expect(schedule.status).toBe(409);
    const approved = await as(request(app).post(`${editor(ids.draft)}/approve-pictures`));
    expect(approved.body.approved).toEqual([pics.dough.id]);
    const live = await as(request(app).put(`/api/v1/feed-posts/${ids.draft}`)).send({ status: 'live' });
    expect(live.status).toBe(200);
    const [asset] = await q('SELECT status, visibility FROM media_assets WHERE id = :id', { id: pics.dough.id });
    expect(asset).toEqual({ status: 'approved', visibility: 'public' });
  });

  it('a live post can\'t take a picture that isn\'t approved and public', async () => {
    const res = await as(request(app).put(editor(ids.live))).send({ asset_ids: [pics.secret.id] });
    expect(res.status).toBe(409);
    expect(res.body.pictures.map((p) => p.id)).toEqual([pics.secret.id]);
    const [post] = await q('SELECT image_url FROM feed_posts WHERE id = :live', ids);
    expect(post.image_url).toBeNull();
  });

  it('the public feed never shows a picture that isn\'t approved and public, nor an ended story; an ADMIN sees both', async () => {
    const pub = await request(app).get(`/api/v1/feed-posts?show_id=${ids.show}`);
    expect(pub.status).toBe(200);
    const leaky = pub.body.data.find((p) => p.id === ids.leaky);
    expect(leaky.photos).toEqual([{ url: url('gala'), alt: '' }]);
    expect(leaky.image_url).toBe(url('gala'));
    expect(pub.body.data.some((p) => p.id === ids.story)).toBe(false);
    const one = await request(app).get(`/api/v1/feed-posts/post/${ids.leaky}`);
    expect(one.body.data.image_url).toBe(url('gala'));
    expect((await request(app).get(`/api/v1/feed-posts/post/${ids.story}`)).status).toBe(404);
    const timeline = await request(app).get(`/api/v1/feed-posts/${ids.show}/timeline`);
    expect(timeline.body.data.find((p) => p.id === ids.leaky).image_url).toBe(url('gala'));

    const asAdmin = await as(request(app).get(`/api/v1/feed-posts?show_id=${ids.show}`));
    expect(asAdmin.body.data.find((p) => p.id === ids.leaky).image_url).toBe(url('secret'));
    expect(asAdmin.body.data.some((p) => p.id === ids.story)).toBe(true);
  });

  it('a carousel takes 2 to 10 pictures, and is saved as one', async () => {
    const one = await as(request(app).put(editor(ids.live))).send({ asset_ids: [pics.kitchen.id], format: 'carousel' });
    expect(one.status).toBe(400);
    expect(one.body.error).toMatch(/at least 2/);
    const two = await as(request(app).put(editor(ids.live))).send({ asset_ids: [pics.kitchen.id, pics.gala.id], format: 'carousel' });
    expect(two.status).toBe(200);
    expect(two.body.post.format).toBe('carousel');
    const [post] = await q('SELECT post_format, photos, content_text FROM feed_posts WHERE id = :live', ids);
    expect(post.post_format).toBe('carousel');
    expect(post.photos.map((p) => p.url)).toEqual([url('kitchen'), url('gala')]);
    expect(post.content_text).toBe('quiet sunday');
  });

  it('text-only posts are listed, with the poster\'s pictures ranked for the caption', async () => {
    const list = await as(request(app).get(`/api/v1/post-media/needs-picture?show_id=${ids.show}`));
    expect(list.status).toBe(200);
    const ids_ = list.body.posts.map((p) => p.id);
    expect(ids_).toContain(ids.old);
    expect(ids_).not.toContain(ids.draft);
    const s = await as(request(app).get(`${editor(ids.old)}/suggestions`));
    expect(s.body.suggestions[0].id).toBe(pics.dough.id);
    expect(s.body.suggestions.some((x) => x.id === pics.gala.id)).toBe(false);
    const [post] = await q('SELECT content_text FROM feed_posts WHERE id = :old', ids);
    expect(post.content_text).toBe('the bread is rising again');
  });

  it('the migration\'s down drops post_format, and up brings it back', async () => {
    const qi = sequelize.getQueryInterface();
    await migration.down(qi);
    expect((await q("SELECT 1 FROM information_schema.columns WHERE table_name = 'feed_posts' AND column_name = 'post_format'")).length).toBe(0);
    await migration.up(qi);
    expect((await q("SELECT 1 FROM information_schema.columns WHERE table_name = 'feed_posts' AND column_name = 'post_format'")).length).toBe(1);
  });
});
