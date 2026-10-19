/**
 * A Pulse post's picture from its poster's camera roll (Evoni, 2026-10-19:
 * "a text post is created it should also go through this generator and
 * create the image that goes with that post"; services/postPictures), and a
 * Pulse profile's grid extras (pins, Tagged, Highlights; routes/pulseFollowsRoutes),
 * against the test database through the routes. The image tool and the
 * storage upload are faked; nothing goes to the network.
 *   - a draft gets no picture; approving (an ADMIN publishing it) makes one,
 *     after the response: a camera-roll moment with purpose posted, made
 *     from their headshot, public, on the post
 *   - text and quote posts stay words only; a carousel gets three
 *   - a fitting posted photo already in their camera roll is used, with no image call
 *   - past the day's limit the post waits; Make now still makes it
 *   - a brand's post uses its library, else a product shot with no person
 *   - never for Dr. Sinclair
 *   - pins are ADMIN only, three at most; Tagged and Highlights show public photos only
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const axios = require('axios');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const pulseImage = require('../../src/services/pulseImageService');
const postPictures = require('../../src/services/postPictures');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

(shouldSkip ? describe.skip : describe)('Pulse post pictures and the profile grid', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), maren: uuid(), friend: uuid(), dr: uuid(), lala: uuid(), brand: uuid(), episode: uuid(), wardrobe: uuid() };
  const pids = {};
  const posts = [];
  let admin;
  let member;
  let stored = 0;
  const as = (req, token = admin) => req.set('Authorization', `Bearer ${token}`);
  const imageCalls = () => axios.post.mock.calls.map((c) => c[0]).filter((u) => /images\/(edits|generations)/.test(String(u)));
  const jobOf = async (id) => (await q('SELECT picture_job FROM feed_posts WHERE id = :id', { id }))[0].picture_job;
  const waitFor = async (id, states) => {
    for (let i = 0; i < 60; i += 1) {
      const job = await jobOf(id);
      if (job && states.includes(job.state)) return job;
      await sleep(50);
    }
    return jobOf(id);
  };
  const post = async (profile, text, { format = null, status = 'draft' } = {}) => {
    const id = uuid();
    await run(`INSERT INTO feed_posts (id, show_id, poster_handle, social_profile_id, content_text, status, post_format, posted_at)
               VALUES (:id, :show, :handle, :pid, :text, :status, :format, CASE WHEN :status = 'live' THEN NOW() ELSE NULL END)`,
    { id, show: ids.show, handle: `h${tag}`, pid: pids[profile], text, status, format });
    posts.push(id);
    return id;
  };
  const approve = (id, token = admin) => as(request(app).put(`/api/v1/feed-posts/${id}`), token).send({ status: 'live' });
  const asset = async ({ url, caption, visibility = 'public', roll = null, links = [] }) => {
    const [[row]] = await run(`INSERT INTO media_assets (url, caption, source, status, visibility, generation)
      VALUES (:url, :caption, 'generated', 'approved', :visibility, CAST(:gen AS JSONB)) RETURNING id`,
    { url, caption, visibility, gen: JSON.stringify(roll ? { camera_roll: roll } : {}) });
    for (const l of links) {
      await run('INSERT INTO media_asset_links (asset_id, entity_type, entity_id, role) VALUES (:a, :t, :e, :r)',
        { a: row.id, t: l[0], e: String(l[1]), r: l[2] });
    }
    return row.id;
  };

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
    admin = TokenService.generateTokenPair({ id: 'test-admin-pp', email: 'evoni@pp.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    member = TokenService.generateTokenPair({ id: 'test-user-pp', email: 'user@pp.dev', name: 'User', groups: ['USER'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())',
      { show: ids.show, name: `PP show ${tag}`, slug: `pp-show-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'PP reg', :show, NOW(), NOW())", ids);
    await run(`INSERT INTO lalaverse_brands (id, slug, name, category, aesthetic, created_at, updated_at)
               VALUES (:brand, :slug, :name, 'fashion', 'soft tailoring, ivory and gold', NOW(), NOW())`, { brand: ids.brand, slug: `pp-brand-${tag}`, name: `PP House ${tag}` });
    const profile = async (key, full = {}) => {
      const [[p]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, full_profile, created_at, updated_at)
        VALUES (:h, 'pulse', 'test', :d, 'lalaverse', CAST(:full AS JSONB), NOW(), NOW()) RETURNING id`, { h: `pp${key}${tag}`, d: `PP ${key}`, full: JSON.stringify(full) });
      pids[key] = p.id;
    };
    await profile('maren');
    await profile('friend');
    await profile('dr');
    await profile('brand', { lalaverse_brand_id: ids.brand, account: 'brand' });
    await profile('lala');
    const char = (id, key, name, pid, extra = '{}') => run(
      `INSERT INTO registry_characters (id, registry_id, character_key, display_name, world, feed_profile_id, extra_fields, created_at, updated_at)
       VALUES (:id, :reg, :key, :name, 'lalaverse', :pid, CAST(:extra AS JSONB), NOW(), NOW())`, { id, reg: ids.reg, key, name, pid, extra });
    await char(ids.maren, `pp-maren-${tag}`, 'PP Maren', pids.maren);
    await char(ids.friend, `pp-friend-${tag}`, 'PP Friend', pids.friend);
    await char(ids.dr, `pp-dr-${tag}`, 'PP Dr', pids.dr, '{"classification":"confidential_professional"}');
    await char(ids.lala, 'lala', 'Lala', pids.lala);
    // Her episode's wardrobe: what she wore that day.
    await run("INSERT INTO episodes (id, title) VALUES (:episode, 'PP episode')", ids);
    await run(`INSERT INTO wardrobe (id, name, clothing_category, color) VALUES (:wardrobe, 'Bias-cut slip dress', 'dress', 'champagne')`, ids);
    await run('INSERT INTO episode_wardrobe (episode_id, wardrobe_id) VALUES (:episode, :wardrobe)', ids);

    jest.spyOn(axios, 'post').mockImplementation(async () => ({ data: { data: [{ b64_json: 'iVBORw0KGgo=' }] } }));
    jest.spyOn(axios, 'get').mockImplementation(async () => ({ data: Buffer.from('iVBORw0KGgo=', 'base64'), headers: { 'content-type': 'image/png' } }));
    jest.spyOn(pulseImage, 'storePulseImage').mockImplementation(async () => {
      stored += 1;
      return { url: `https://cdn.test/${tag}/made-${stored}.jpg`, key: `pp/${tag}-${stored}.jpg`, width: 1536, height: 1024 };
    });
    // Maren's official headshot: every face in her photos comes from it.
    const head = await as(request(app).put(`/api/v1/camera-roll/characters/${ids.maren}/headshot`)).send({ url: `https://cdn.test/${tag}/headshot.jpg` });
    expect(head.status).toBe(200);
    const lalaHead = await as(request(app).put(`/api/v1/camera-roll/characters/${ids.lala}/headshot`)).send({ url: `https://cdn.test/${tag}/lala-headshot.jpg` });
    expect(lalaHead.status).toBe(200);
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    delete process.env.PULSE_POST_IMAGES_PER_DAY;
    const chars = [ids.maren, ids.friend, ids.dr, ids.lala];
    await run('DELETE FROM camera_roll_moments WHERE character_id IN (:chars)', { chars });
    await run('DELETE FROM media_asset_sources WHERE asset_id IN (SELECT id FROM media_assets WHERE url LIKE :pre)', { pre: `https://cdn.test/${tag}/%` });
    await run('DELETE FROM media_asset_links WHERE asset_id IN (SELECT id FROM media_assets WHERE url LIKE :pre)', { pre: `https://cdn.test/${tag}/%` });
    await run('DELETE FROM media_assets WHERE url LIKE :pre', { pre: `https://cdn.test/${tag}/%` });
    await run("DELETE FROM ai_usage_logs WHERE route_name IN ('pulse-post-picture', 'camera-roll') AND created_at > NOW() - INTERVAL '1 hour'");
    if (posts.length) await run('DELETE FROM feed_posts WHERE id IN (:posts)', { posts });
    await run('DELETE FROM registry_characters WHERE id IN (:chars)', { chars });
    await run('DELETE FROM social_profiles WHERE id IN (:p)', { p: Object.values(pids) });
    await run('DELETE FROM lalaverse_brands WHERE id = :brand', ids);
    await run('DELETE FROM episode_wardrobe WHERE episode_id = :episode', ids);
    await run('DELETE FROM wardrobe WHERE id = :wardrobe', ids);
    await run('DELETE FROM episodes WHERE id = :episode', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  beforeEach(() => { axios.post.mockClear(); });

  it('a draft gets no picture, and making one for it is refused', async () => {
    const id = await post('maren', 'New outfit for the market today');
    const status = await as(request(app).get(`/api/v1/post-media/posts/${id}/picture`));
    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({ takes: 1, approved: false, job: null, per_day: 20, estimate_usd: 0.2 });
    const res = await as(request(app).post(`/api/v1/post-media/posts/${id}/picture`)).send({});
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/approved/);
    expect(imageCalls()).toHaveLength(0);
    expect(await jobOf(id)).toBeNull();
  });

  it('approving it makes the picture after the response: a posted camera-roll moment from her headshot, public, on the post', async () => {
    const id = await post('maren', 'New outfit for the market today');
    const res = await approve(id);
    expect(res.status).toBe(200);
    const job = await waitFor(id, ['made', 'failed']);
    expect(job).toMatchObject({ state: 'made', count: 1, reused: false });
    expect(job.cost_usd).toBeGreaterThan(0);
    expect(imageCalls()).toEqual([expect.stringMatching(/images\/edits$/)]);     // the headshot is the reference

    const [m] = await q('SELECT * FROM camera_roll_moments WHERE post_id = :id', { id });
    expect(m).toMatchObject({ purpose: 'posted', status: 'made', character_id: ids.maren, album: 'fashion', shows_face: true });
    const [a] = await q('SELECT * FROM media_assets WHERE id = :id', { id: m.asset_id });
    expect(a).toMatchObject({ visibility: 'public', status: 'approved' });
    const [p] = await q('SELECT image_url, photos FROM feed_posts WHERE id = :id', { id });
    expect(p.image_url).toBe(a.url);
    const [log] = await q("SELECT COUNT(*)::int AS n FROM ai_usage_logs WHERE route_name = 'pulse-post-picture' AND created_at > NOW() - INTERVAL '1 minute'");
    expect(log.n).toBeGreaterThan(0);
    // Her planned roll is not filled by it: post photos are not in its number.
    const roll = await as(request(app).get(`/api/v1/camera-roll/characters/${ids.maren}`));
    expect(roll.body.data.moments.find((x) => x.id === m.id)).toMatchObject({ post_id: id });
  });

  it("Lala's post from an episode shows what she wore in it", async () => {
    const id = await post('lala', "Tonight's look");
    await run('UPDATE feed_posts SET episode_id = :episode WHERE id = :id', { episode: ids.episode, id });
    expect((await approve(id)).status).toBe(200);
    expect(await waitFor(id, ['made', 'failed'])).toMatchObject({ state: 'made' });
    const [m] = await q('SELECT prompt, episode_id FROM camera_roll_moments WHERE post_id = :id', { id });
    expect(m.episode_id).toBe(ids.episode);
    expect(m.prompt).toMatch(/Wearing: her look from this episode: champagne Bias-cut slip dress/);
  });

  it('text and quote posts stay words only', async () => {
    const text = await post('maren', 'Thinking about how slow mornings saved me', { format: 'text' });
    const quote = await post('maren', '"Bake like nobody is watching."', { format: 'quote' });
    expect((await approve(text)).status).toBe(200);
    expect((await approve(quote)).status).toBe(200);
    await sleep(150);
    expect(await jobOf(text)).toBeNull();
    expect(await jobOf(quote)).toBeNull();
    expect(imageCalls()).toHaveLength(0);
  });

  it('a fitting photo she already posted, on no other post, is used with no image call', async () => {
    const reuse = await asset({
      url: `https://cdn.test/${tag}/sourdough.jpg`, caption: 'Sourdough loaf cooling on the counter',
      roll: { purpose: 'posted', album: 'objects', taken_by: 'friend' }, links: [['character', ids.maren, 'owner']],
    });
    const id = await post('maren', 'The sourdough loaf finally rose');
    expect((await approve(id)).status).toBe(200);
    const job = await waitFor(id, ['made', 'failed']);
    expect(job).toMatchObject({ state: 'made', reused: true, asset_ids: [reuse], cost_usd: 0 });
    expect(imageCalls()).toHaveLength(0);
  });

  it("past the day's limit it waits; Make now still makes it, through the image budget", async () => {
    process.env.PULSE_POST_IMAGES_PER_DAY = String(await postPictures.madeToday(models));
    const id = await post('maren', 'Rainy walk to the bakery');
    expect((await approve(id)).status).toBe(200);
    const job = await waitFor(id, ['waiting_cap', 'made', 'failed']);
    expect(job.state).toBe('waiting_cap');
    expect(job.reason).toMatch(/limit .* reached.*Make now/);
    expect(imageCalls()).toHaveLength(0);
    const now = await as(request(app).post(`/api/v1/post-media/posts/${id}/picture`)).send({ make_now: true });
    expect(now.status).toBe(200);
    expect(now.body.job).toMatchObject({ state: 'made', make_now: true });
    expect(imageCalls()).toHaveLength(1);
    delete process.env.PULSE_POST_IMAGES_PER_DAY;
  });

  it('scheduling a post approves it too; a waiting one is made by the timer once the day allows', async () => {
    const id = await post('maren', 'Saturday flowers from the market');
    const at = new Date(Date.now() + 3 * 86400000).toISOString();
    process.env.PULSE_POST_IMAGES_PER_DAY = String(await postPictures.madeToday(models));
    const res = await as(request(app).put(`/api/v1/feed-posts/${id}/release-time`)).send({ mode: 'schedule', at, anyway: true });
    expect(res.status).toBe(200);
    expect(await waitFor(id, ['waiting_cap', 'made', 'failed'])).toMatchObject({ state: 'waiting_cap' });
    expect(await postPictures.runWaiting(models)).toEqual([]);                  // still over today's count
    expect(imageCalls()).toHaveLength(0);
    process.env.PULSE_POST_IMAGES_PER_DAY = '1000';
    const done = await postPictures.runWaiting(models);
    expect(done.map((d) => d.id)).toContain(id);
    expect(await jobOf(id)).toMatchObject({ state: 'made' });
    expect(imageCalls()).toHaveLength(1);
    delete process.env.PULSE_POST_IMAGES_PER_DAY;
  });

  it('a carousel gets three photos of one moment', async () => {
    const id = await post('maren', 'Market day in three pictures', { format: 'carousel' });
    expect((await approve(id)).status).toBe(200);
    const job = await waitFor(id, ['made', 'failed']);
    expect(job).toMatchObject({ state: 'made', count: 3 });
    const [p] = await q('SELECT photos, post_format FROM feed_posts WHERE id = :id', { id });
    expect(p.photos).toHaveLength(3);
    expect(p.post_format).toBe('carousel');
    expect(await q('SELECT 1 FROM camera_roll_moments WHERE post_id = :id', { id })).toHaveLength(3);
  });

  it("a brand's post uses its library when a picture fits, else a product shot with no person", async () => {
    const campaign = await asset({ url: `https://cdn.test/${tag}/ivory-coat.jpg`, caption: 'The ivory coat, autumn campaign', links: [['brand', ids.brand, 'owner']] });
    const fits = await post('brand', 'Our ivory coat is back for autumn');
    expect((await approve(fits)).status).toBe(200);
    expect(await waitFor(fits, ['made', 'failed'])).toMatchObject({ state: 'made', reused: true, asset_ids: [campaign] });
    expect(imageCalls()).toHaveLength(0);

    const fresh = await post('brand', 'Something new arrives Friday');
    expect((await approve(fresh)).status).toBe(200);
    const job = await waitFor(fresh, ['made', 'failed']);
    expect(job).toMatchObject({ state: 'made', reused: false });
    expect(imageCalls()).toEqual([expect.stringMatching(/images\/generations$/)]);   // no person, no reference
    const body = axios.post.mock.calls.find((c) => /generations$/.test(c[0]))[1];
    expect(body.prompt).toMatch(/No person/);
    const [link] = await q("SELECT entity_type, role FROM media_asset_links WHERE asset_id = :a AND entity_type = 'brand'", { a: job.asset_ids[0] });
    expect(link).toMatchObject({ entity_type: 'brand', role: 'owner' });
  });

  it('never for Dr. Sinclair: skipped, with no image call', async () => {
    const id = await post('dr', 'A quiet week of sessions');
    expect((await approve(id)).status).toBe(200);
    const job = await waitFor(id, ['skipped', 'made', 'failed']);
    expect(job.state).toBe('skipped');
    expect(job.reason).toMatch(/confidential/);
    expect(imageCalls()).toHaveLength(0);
  });

  it('a non-admin publishing gets no picture made, and the picture tools are ADMIN only', async () => {
    const id = await post('maren', 'Morning coffee and notes');
    expect((await as(request(app).get(`/api/v1/post-media/posts/${id}/picture`), member)).status).toBe(403);
    expect((await as(request(app).post(`/api/v1/post-media/posts/${id}/picture`), member).send({})).status).toBe(403);
    expect((await approve(id, member)).status).toBe(200);
    await sleep(150);
    expect(await jobOf(id)).toBeNull();
    expect(imageCalls()).toHaveLength(0);
  });

  it('the picture job is the studio\'s: a member reading the feed does not get it', async () => {
    const res = await as(request(app).get(`/api/v1/feed-posts?show_id=${ids.show}&status=live&profile_id=${pids.maren}&limit=50`), member);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((p) => !('picture_job' in p))).toBe(true);
    const adminRead = await as(request(app).get(`/api/v1/feed-posts?show_id=${ids.show}&status=live&profile_id=${pids.maren}&limit=50`));
    expect(adminRead.body.data.some((p) => p.picture_job)).toBe(true);
    // A draft tells an ADMIN what approving it will make, and about what it costs.
    const draft = await post('maren', 'Fresh flowers on the counter');
    const drafts = await as(request(app).get(`/api/v1/feed-posts?show_id=${ids.show}&status=draft&profile_id=${pids.maren}&limit=50`));
    expect(drafts.body.data.find((p) => p.id === draft).picture_plan).toEqual({ count: 1, estimate_usd: 0.2 });
    const memberDrafts = await as(request(app).get(`/api/v1/feed-posts?show_id=${ids.show}&status=draft&profile_id=${pids.maren}&limit=50`), member);
    expect((memberDrafts.body.data || []).every((p) => !('picture_plan' in p))).toBe(true);
  });

  it('pins: ADMIN only, live posts only, three at most', async () => {
    const live = [];
    for (let i = 0; i < 4; i += 1) live.push(await post('friend', `Pin me ${i}`, { status: 'live', format: 'text' }));
    const draft = await post('friend', 'A draft');
    const pin = (id, token = admin) => as(request(app).put(`/api/v1/pulse-follows/posts/${id}/pin`), token).send({});
    expect((await pin(live[0], member)).status).toBe(403);
    expect((await pin(draft)).status).toBe(409);
    for (const id of live.slice(0, 3)) expect((await pin(id)).status).toBe(200);
    const fourth = await pin(live[3]);
    expect(fourth.status).toBe(409);
    expect(fourth.body.error).toMatch(/3 pinned/);
    expect((await as(request(app).delete(`/api/v1/pulse-follows/posts/${live[0]}/pin`), member)).status).toBe(403);
    expect((await as(request(app).delete(`/api/v1/pulse-follows/posts/${live[0]}/pin`))).status).toBe(200);
    expect((await pin(live[3])).status).toBe(200);
    const media = await as(request(app).get(`/api/v1/pulse-follows/profile/ppfriend${tag}/media`), member);
    expect(media.status).toBe(200);
    expect(media.body.data.pinned.sort()).toEqual([live[1], live[2], live[3]].sort());
  });

  it('Tagged and Highlights show public photos only', async () => {
    const theirs = await post('friend', 'Brunch with Maren', { status: 'live' });
    const shown = await asset({ url: `https://cdn.test/${tag}/brunch.jpg`, caption: 'Brunch', links: [['character', ids.maren, 'pictured'], ['post', theirs, 'pictured']] });
    await asset({ url: `https://cdn.test/${tag}/hidden.jpg`, caption: 'Hidden', visibility: 'private',
      roll: { purpose: 'private', album: 'social' }, links: [['character', ids.maren, 'pictured'], ['post', theirs, 'pictured']] });
    await asset({ url: `https://cdn.test/${tag}/secret-roll.jpg`, caption: 'Kept for herself', visibility: 'private',
      roll: { purpose: 'private', album: 'travel' }, links: [['character', ids.maren, 'owner']] });
    const res = await as(request(app).get(`/api/v1/pulse-follows/profile/@ppmaren${tag}/media`), member);
    expect(res.status).toBe(200);
    const { tagged, highlights } = res.body.data;
    expect(tagged.map((t) => t.asset_id)).toEqual([shown]);
    expect(tagged[0]).toMatchObject({ post_id: theirs, poster_handle: `h${tag}` });
    const urls = highlights.flatMap((h) => h.photos.map((p) => p.url));
    expect(urls).not.toContain(`https://cdn.test/${tag}/secret-roll.jpg`);
    expect(urls).not.toContain(`https://cdn.test/${tag}/hidden.jpg`);
    expect(highlights.find((h) => h.key === 'travel')).toBeUndefined();
    expect(highlights.find((h) => h.key === 'fashion')).toMatchObject({ label: 'Fashion & Wardrobe' });
    expect(highlights.every((h) => h.count > 0 && h.cover)).toBe(true);
    expect((await request(app).get(`/api/v1/pulse-follows/profile/ppmaren${tag}/media`)).status).toBe(401);
  });
});
