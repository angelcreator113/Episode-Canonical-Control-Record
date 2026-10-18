/**
 * Trust per character (services/pulseTrust; Evoni, 2026-10-18), through the
 * drafter with the Anthropic calls mocked (the draft, then the voice score):
 *   - trusted (the default) keeps today's rules: a low voice score waits
 *   - fully trusted: a post flagged only for its voice goes out, marked
 *     released_on_trust; one about Lala, one that reveals story, and one that
 *     quotes a secret still wait
 *   - review everything holds a post that passed
 *   - the trust routes are ADMIN only; Undo puts a post back in Review once
 *   - the daily update lists what went out on trust, until it is undone
 *   - comments follow the same trust: a fully trusted character's comment held
 *     only for its voice goes out, is listed, and Undo takes it back
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const drafter = require('../../src/services/pulseDrafter');
const { lalaProfileId } = require('../../src/services/lalaFeedProfile');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const say = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });
const SECRET = 'secretly terrified the brand deal will collapse';

(shouldSkip ? describe.skip : describe)('Trust per character', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), character: uuid() };
  let profile;
  let lala;
  let madeLala = false;
  let admin;
  let user;
  let trustedPostId;
  let other;

  const draft = async ({ text, revealsStory = false, score = 0.9 }) => {
    mockCreate.mockResolvedValueOnce(say({ text, hashtag: null, reveals_story: revealsStory }));
    mockCreate.mockResolvedValueOnce(say({ score, why: 'reads like them' }));
    return drafter.draftAndRoute(models, { showId: ids.show, characterId: ids.character, moment: 5, context: { about: 'the week' } });
  };
  const setTrust = (level) => run('UPDATE social_profiles SET pulse_trust = :level WHERE id = :id', { id: profile, level });
  const as = (req, token = admin) => req.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-trust', email: 'evoni@trust.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    user = TokenService.generateTokenPair({ id: 'test-user-trust', email: 'user@trust.dev', name: 'User', groups: ['USER'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Trust ${tag}`, slug: `trust-${tag}` });
    await require('../../src/services/pulseQueue').saveSettings(models, ids.show, { automated_requests: 100, manual_requests: 100 });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Trust registry', :show, NOW(), NOW())", ids);
    lala = await lalaProfileId(sequelize);
    if (!lala) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES ('lala', 'instagram', 'test', 'Lala', 'lalaverse', NOW(), NOW()) RETURNING id`);
      lala = row.id;
      madeLala = true;
    }
    const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
      VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', NOW(), NOW()) RETURNING id`, { handle: `trusty${tag}`, display: `Trusty ${tag}` });
    profile = row.id;
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, feed_profile_id, living_state, created_at, updated_at)
               VALUES (:id, :reg, :key, 'Trusty', 'alive', :feed, CAST(:state AS jsonb), NOW(), NOW())`,
    { id: ids.character, reg: ids.reg, key: `trusty-${tag}`, feed: profile, state: JSON.stringify({ worry: SECRET }) });
    await models.PulseVoice.create({ registry_character_id: ids.character, social_profile_id: profile, habits_json: { case: 'lowercase' },
      examples_json: [{ id: uuid(), text: 'ok but who approved beige', kind: 'pinned' }], status: 'built' });
  });

  beforeEach(() => mockCreate.mockReset());

  afterAll(async () => {
    await new Promise((r) => { setTimeout(r, 300); });
    await run('DELETE FROM feed_comments WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_post_numbers WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_voices WHERE registry_character_id = :character', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: [profile, ...(other ? [other] : []), ...(madeLala ? [lala] : [])] });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('trusted, the default, keeps today\'s rules: a low voice score waits', async () => {
    const r = await draft({ text: 'a quiet week, honestly', score: 0.3 });
    expect(r.published).toBe(false);
    expect(r.review).toEqual(['gate']);
    await r.post.reload();
    expect(r.post.gate_json.released_on_trust).toBeUndefined();
  });

  test('fully trusted: a post flagged only for its voice goes out, marked released_on_trust', async () => {
    await setTrust('full');
    const r = await draft({ text: 'a quiet week, honestly', score: 0.3 });
    expect(r.published).toBe(true);
    expect(r.review).toEqual([]);
    await r.post.reload();
    expect(r.post.status).toBe('live');
    expect(r.post.gate_json.pass).toBe(false);
    expect(r.post.gate_json.released_on_trust).toMatchObject({ level: 'full', waived: ['gate'], flags: ['voice'] });
    trustedPostId = r.post.id;
  });

  test('fully trusted still waits on Lala, a story reveal and a secret quoted', async () => {
    const aboutLala = await draft({ text: 'saw lala at the market today', score: 0.3 });
    expect(aboutLala.published).toBe(false);
    expect(aboutLala.review).toContain('about_lala');
    const reveal = await draft({ text: 'a quiet week, honestly', revealsStory: true, score: 0.3 });
    expect(reveal.published).toBe(false);
    expect(reveal.review).toContain('reveals_story');
    const secret = await draft({ text: `between us, ${SECRET}`, score: 0.3 });
    expect(secret.published).toBe(false);
    expect(secret.review).toEqual(['gate']);
    expect(secret.gate.flags.map((f) => f.code)).toContain('private_state');
  });

  test('review everything holds a post that passed', async () => {
    await setTrust('review_all');
    const r = await draft({ text: 'ok but who approved the beige', score: 0.9 });
    expect(r.gate.pass).toBe(true);
    expect(r.published).toBe(false);
    expect(r.review).toEqual(['trust_review_all']);
    await setTrust(null);
  });

  test('the trust routes are ADMIN only, and save a level', async () => {
    expect((await as(request(app).get(`/api/v1/pulse-trust/profiles/${profile}`), user)).status).toBe(403);
    expect((await as(request(app).put(`/api/v1/pulse-trust/profiles/${profile}`), user).send({ level: 'full' })).status).toBe(403);
    expect((await as(request(app).put(`/api/v1/pulse-trust/profiles/${profile}`)).send({ level: 'sometimes' })).status).toBe(400);
    const saved = await as(request(app).put(`/api/v1/pulse-trust/profiles/${profile}`)).send({ level: 'full' });
    expect(saved.body).toMatchObject({ success: true, level: 'full' });
    const read = await as(request(app).get(`/api/v1/pulse-trust/profiles/${profile}`));
    expect(read.body).toMatchObject({ level: 'full', always_review: ['lala', 'about_lala', 'reveals_story', 'brand_deal'] });
    await as(request(app).put(`/api/v1/pulse-trust/profiles/${profile}`)).send({ level: 'trusted' });
    const [[back]] = await run('SELECT pulse_trust FROM social_profiles WHERE id = :id', { id: profile });
    expect(back.pulse_trust).toBeNull();
  });

  test('the daily update lists what went out on trust; Undo puts it back in Review, once', async () => {
    const before = await as(request(app).get('/api/v1/daily-update'));
    const listed = before.body.since_yesterday.on_trust.items.find((p) => p.id === trustedPostId);
    expect(listed).toMatchObject({ status: 'live', waived_flags: ['voice'] });

    expect((await as(request(app).post(`/api/v1/pulse-trust/undo/${trustedPostId}`), user)).status).toBe(403);
    const undone = await as(request(app).post(`/api/v1/pulse-trust/undo/${trustedPostId}`));
    expect(undone.body).toMatchObject({ success: true, post: { status: 'draft', review: ['gate'] } });
    const [[post]] = await run('SELECT status, release_state, gate_json FROM feed_posts WHERE id = :id', { id: trustedPostId });
    expect(post.status).toBe('draft');
    expect(post.gate_json.released_on_trust.undone_at).toBeTruthy();
    expect((await as(request(app).post(`/api/v1/pulse-trust/undo/${trustedPostId}`))).status).toBe(409);

    const after = await as(request(app).get('/api/v1/daily-update'));
    expect(after.body.since_yesterday.on_trust.items.some((p) => p.id === trustedPostId)).toBe(false);
  });

  test('comments follow the same trust: held for voice under trusted, out on trust under full, and Undo takes it back', async () => {
    const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
      VALUES (:handle, 'instagram', 'test', 'Other', 'lalaverse', NOW(), NOW()) RETURNING id`, { handle: `other${tag}` });
    other = row.id;
    const postId = uuid();
    await run(`INSERT INTO feed_posts (id, show_id, social_profile_id, poster_handle, content_text, status, posted_at, created_at, updated_at)
               VALUES (:id, :show, :other, :h, 'new coat, who dis', 'live', NOW(), NOW(), NOW())`, { id: postId, show: ids.show, other, h: `@other${tag}` });
    const comment = async () => {
      mockCreate.mockResolvedValueOnce(say({ text: 'the coat is giving' }));
      mockCreate.mockResolvedValueOnce(say({ score: 0.3, why: 'not quite them' }));
      return drafter.draftCommentAndRoute(models, { postId, characterId: ids.character });
    };
    const held = await comment();
    expect(held.published).toBe(false);
    expect(held.review).toEqual(['gate']);

    await setTrust('full');
    const out = await comment();
    expect(out.published).toBe(true);
    await out.comment.reload();
    expect(out.comment.status).toBe('live');
    expect(out.comment.released_on_trust).toMatchObject({ level: 'full', waived: ['gate'], flags: ['voice'] });
    await setTrust(null);

    const update = await as(request(app).get('/api/v1/daily-update'));
    expect(update.body.since_yesterday.on_trust.items.find((c) => c.id === out.comment.id)).toMatchObject({ kind: 'comment', status: 'live', waived_flags: ['voice'] });

    expect((await as(request(app).post(`/api/v1/pulse-trust/undo-comment/${out.comment.id}`), user)).status).toBe(403);
    const undone = await as(request(app).post(`/api/v1/pulse-trust/undo-comment/${out.comment.id}`));
    expect(undone.body).toMatchObject({ success: true, comment: { status: 'draft' } });
    expect((await as(request(app).post(`/api/v1/pulse-trust/undo-comment/${out.comment.id}`))).status).toBe(409);
    expect((await as(request(app).post(`/api/v1/pulse-trust/undo-comment/${held.comment.id}`))).status).toBe(409);
  });
});
