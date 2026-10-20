/**
 * The engine's post formats and pictures for posts that go live without
 * Evoni's click (Evoni, 2026-10-19: "yes … with your recommendations";
 * services/postFormatMix, services/postPictures.afterRelease), against the
 * test database with the Anthropic calls, the image tool and the storage
 * upload faked:
 *   - the drafter picks the post's format from who they are and writes the
 *     prompt for it; a text draft stays words only
 *   - a post their trust lets out goes live with its picture made after it,
 *     from their headshot; a held one (a draft) gets none
 *   - a post the engine scheduled (world moments, a brand's week) gets its
 *     picture when its time comes; one already made is not made again, and a
 *     failed one is left for her Retry
 *   - the day's limit holds auto posts too; Dr. Sinclair's are skipped
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const crypto = require('crypto');
const request = require('supertest');
const axios = require('axios');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const drafter = require('../../src/services/pulseDrafter');
const postRelease = require('../../src/services/postRelease');
const formatMix = require('../../src/services/postFormatMix');
const pulseImage = require('../../src/services/pulseImageService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const say = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

(shouldSkip ? describe.skip : describe)('Engine post formats and pictures for posts that go live on their own', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), maren: uuid(), dr: uuid() };
  const pids = {};
  const posts = [];
  let admin;
  let stored = 0;

  const jobOf = async (id) => (await q('SELECT picture_job FROM feed_posts WHERE id = :id', { id }))[0].picture_job;
  const waitFor = async (id, states) => {
    for (let i = 0; i < 80; i += 1) {
      const job = await jobOf(id);
      if (job && states.includes(job.state)) return job;
      await sleep(50);
    }
    return jobOf(id);
  };
  const draft = async ({ text, score = 0.9 }) => {
    mockCreate.mockResolvedValueOnce(say({ text, hashtag: null, reveals_story: false }));
    mockCreate.mockResolvedValueOnce(say({ score, why: 'reads like them' }));
    const r = await drafter.draftAndRoute(models, { showId: ids.show, characterId: ids.maren, moment: 5, context: { about: 'the week' } });
    posts.push(r.post.id);
    return r;
  };
  // A post the engine scheduled, its time already come.
  const scheduled = async (profile, text, { format = 'post', job = null } = {}) => {
    const id = uuid();
    await run(`INSERT INTO feed_posts (id, show_id, poster_handle, social_profile_id, content_text, status, post_format,
                 release_state, release_at, picture_job, created_at, updated_at)
               VALUES (:id, :show, :handle, :pid, :text, 'draft', :format, 'scheduled', NOW() - INTERVAL '1 minute', CAST(:job AS JSONB), NOW(), NOW())`,
    { id, show: ids.show, handle: `auto${tag}`, pid: pids[profile], text, format, job: job ? JSON.stringify(job) : null });
    posts.push(id);
    return id;
  };

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
    admin = TokenService.generateTokenPair({ id: 'test-admin-auto', email: 'evoni@auto.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Auto ${tag}`, slug: `auto-${tag}` });
    await require('../../src/services/pulseQueue').saveSettings(models, ids.show, { automated_requests: 100, manual_requests: 100 });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Auto registry', :show, NOW(), NOW())", ids);
    for (const [key, persona] of [['maren', 'baker and early riser, bread and coffee photos'], ['dr', null]]) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, content_persona, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', :persona, NOW(), NOW()) RETURNING id`, { handle: `auto${key}${tag}`, display: `Auto ${key}`, persona });
      pids[key] = row.id;
    }
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, world, feed_profile_id, created_at, updated_at)
               VALUES (:id, :reg, :key, 'Auto Maren', 'alive', 'lalaverse', :feed, NOW(), NOW())`, { id: ids.maren, reg: ids.reg, key: `auto-maren-${tag}`, feed: pids.maren });
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, world, feed_profile_id, extra_fields, created_at, updated_at)
               VALUES (:id, :reg, :key, 'Auto Dr', 'lalaverse', :feed, '{"classification":"confidential_professional"}', NOW(), NOW())`, { id: ids.dr, reg: ids.reg, key: `auto-dr-${tag}`, feed: pids.dr });
    await models.PulseVoice.create({ registry_character_id: ids.maren, social_profile_id: pids.maren, habits_json: { case: 'lowercase' },
      examples_json: [{ id: uuid(), text: 'first loaf, still warm', kind: 'pinned' }], status: 'built' });
    await run("UPDATE social_profiles SET pulse_trust = 'full' WHERE id = :id", { id: pids.maren });

    jest.spyOn(axios, 'post').mockImplementation(async () => ({ data: { data: [{ b64_json: 'iVBORw0KGgo=' }] } }));
    jest.spyOn(axios, 'get').mockImplementation(async () => ({ data: Buffer.from('iVBORw0KGgo=', 'base64'), headers: { 'content-type': 'image/png' } }));
    jest.spyOn(pulseImage, 'storePulseImage').mockImplementation(async () => {
      stored += 1;
      return { url: `https://cdn.test/${tag}/made-${stored}.jpg`, key: `auto/${tag}-${stored}.jpg`, width: 1024, height: 1536 };
    });
    const head = await request(app).put(`/api/v1/camera-roll/characters/${ids.maren}/headshot`)
      .set('Authorization', `Bearer ${admin}`).send({ url: `https://cdn.test/${tag}/headshot.jpg` });
    expect(head.status).toBe(200);
  });

  beforeEach(() => { mockCreate.mockReset(); delete process.env.PULSE_POST_IMAGES_PER_DAY; });

  afterAll(async () => {
    formatMix.setRandom(null);
    await sleep(300);
    jest.restoreAllMocks();
    delete process.env.PULSE_POST_IMAGES_PER_DAY;
    const chars = [ids.maren, ids.dr];
    await run('DELETE FROM camera_roll_moments WHERE character_id IN (:chars)', { chars });
    await run('DELETE FROM media_asset_links WHERE asset_id IN (SELECT id FROM media_assets WHERE url LIKE :pre)', { pre: `https://cdn.test/${tag}/%` });
    await run('DELETE FROM media_assets WHERE url LIKE :pre', { pre: `https://cdn.test/${tag}/%` });
    await run("DELETE FROM ai_usage_logs WHERE route_name IN ('pulse-post-picture', 'camera-roll') AND created_at > NOW() - INTERVAL '1 hour'");
    await run('DELETE FROM feed_comments WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_post_numbers WHERE show_id = :show', ids).catch((err) => console.error(err.message));
    await run('DELETE FROM pulse_closeness WHERE show_id = :show', ids).catch((err) => console.error(err.message));
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_voices WHERE registry_character_id = :id', { id: ids.maren });
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:p)', { p: Object.values(pids) });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('a photo post their trust lets out goes live, and its picture is made after it from their headshot', async () => {
    formatMix.setRandom(() => 0.5);   // within "post" for a visual creator
    const r = await draft({ text: 'first loaf out at six', score: 0.3 });
    expect(r.published).toBe(true);
    const [row] = await q('SELECT status, post_format FROM feed_posts WHERE id = :id', { id: r.post.id });
    expect(row).toEqual({ status: 'live', post_format: 'post' });
    expect(mockCreate.mock.calls[0][0].messages[0].content).toContain('This post goes with one photo from their day');
    const job = await waitFor(r.post.id, ['made', 'failed']);
    expect(job).toMatchObject({ state: 'made', count: 1 });
    const [moment] = await q('SELECT purpose, post_id FROM camera_roll_moments WHERE post_id = :id', { id: r.post.id });
    expect(moment.purpose).toBe('posted');
  });

  test('a text post goes live words only: no picture job, no image call', async () => {
    formatMix.setRandom(() => 0);   // "text" comes first
    const before = axios.post.mock.calls.length;
    const r = await draft({ text: 'thinking about rye again', score: 0.3 });
    expect(r.published).toBe(true);
    expect(mockCreate.mock.calls[0][0].messages[0].content).toContain('This post is words only');
    await sleep(200);
    const [row] = await q('SELECT post_format, picture_job FROM feed_posts WHERE id = :id', { id: r.post.id });
    expect(row).toEqual({ post_format: 'text', picture_job: null });
    expect(axios.post.mock.calls.length).toBe(before);
  });

  test('a post held for Review stays a draft and gets no picture', async () => {
    formatMix.setRandom(() => 0.5);
    await run("UPDATE social_profiles SET pulse_trust = 'review_all' WHERE id = :id", { id: pids.maren });
    const r = await draft({ text: 'the oven is temperamental', score: 0.9 });
    await run("UPDATE social_profiles SET pulse_trust = 'full' WHERE id = :id", { id: pids.maren });
    expect(r.published).toBe(false);
    await sleep(200);
    const [row] = await q('SELECT status, picture_job FROM feed_posts WHERE id = :id', { id: r.post.id });
    expect(row).toEqual({ status: 'draft', picture_job: null });
  });

  test('a post the engine scheduled gets its picture when its time comes; one already made is not made again; a failed one waits for Retry', async () => {
    const fresh = await scheduled('maren', 'sourdough at the window');
    const made = await scheduled('maren', 'already pictured', { job: { state: 'made', count: 1 } });
    const failed = await scheduled('maren', 'went wrong before', { job: { state: 'failed', count: 1, error: 'boom' } });
    // A format she chose in Review is kept: a quote goes out as a quote, with no picture.
    const quote = await scheduled('maren', 'bake slow, eat warm', { format: 'quote' });
    await postRelease.releaseDue(models);
    const job = await waitFor(fresh, ['made', 'failed']);
    expect(job).toMatchObject({ state: 'made', count: 1 });
    await sleep(200);
    expect(await jobOf(made)).toEqual({ state: 'made', count: 1 });
    expect(await jobOf(failed)).toMatchObject({ state: 'failed', error: 'boom' });
    expect((await q('SELECT post_format, picture_job FROM feed_posts WHERE id = :id', { id: quote }))[0]).toEqual({ post_format: 'quote', picture_job: null });
    const [live] = await q('SELECT status FROM feed_posts WHERE id = :id', { id: fresh });
    expect(live.status).toBe('live');
  });

  test("the day's limit holds posts that go live on their own; Dr. Sinclair's are skipped", async () => {
    process.env.PULSE_POST_IMAGES_PER_DAY = '0';
    const capped = await scheduled('maren', 'flour everywhere');
    const dr = await scheduled('dr', 'a quiet office');
    await postRelease.releaseDue(models);
    expect((await waitFor(capped, ['waiting_cap'])).state).toBe('waiting_cap');
    expect((await waitFor(dr, ['skipped'])).state).toBe('skipped');
  });
});
