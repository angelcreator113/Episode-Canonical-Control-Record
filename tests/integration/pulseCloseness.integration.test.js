/**
 * Relationship consequences (Task #2983; The Pulse spec §9), against the test
 * database:
 * - a live comment and an @mention move a pair closer; a close tie's post
 *   left without a reaction for a full episode moves them apart;
 * - each pair, cause and source is proposed once;
 * - small changes between other characters auto-accept; Lala's, and a pair
 *   moving more than AUTO_MOMENT at one story moment, wait;
 * - /api/v1/pulse-closeness lists the waiting changes and takes Accept,
 *   Adjust (a change and a reason) and Reject from an admin only, once.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const closeness = require('../../src/services/pulseCloseness');
const { lalaProfileId } = require('../../src/services/lalaFeedProfile');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('The Pulse closeness ledger (Task #2983)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid() };
  const p = {};
  let lala;
  let madeLala = false;
  let admin;
  let editor;
  const as = (token, req) => req.set('Authorization', `Bearer ${token}`);
  const put = (id, action, body = {}, token = admin) => as(token, request(app).put(`/api/v1/pulse-closeness/${id}/${action}`)).send(body);
  const rowsFor = (a, b, where = {}) => {
    const [x, y] = closeness.pairOf(a, b);
    return models.PulseCloseness.findAll({ where: { show_id: ids.show, profile_a_id: x, profile_b_id: y, ...where }, order: [['created_at', 'ASC']] });
  };
  const post = (key, order, text = 'just a day') => models.FeedPost.create({
    show_id: ids.show, social_profile_id: p[key], poster_handle: `${key}${tag}`, poster_display_name: key, poster_platform: 'lalaverse',
    post_type: 'post', content_text: text, status: 'live', story_order: order, likes: 0, comments_count: 0, shares: 0, sample_comments: [], sort_order: 0,
  });
  const comment = (postRow, key, text = 'obsessed') => models.FeedComment.create({
    feed_post_id: postRow.id, show_id: ids.show, social_profile_id: p[key], handle: `${key}${tag}`, display_name: key, text, status: 'live', sort_order: 0,
  });

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-close', email: 'evoni@close.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-close', email: 'ed@close.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Closeness ${tag}`, slug: `closeness-${tag}` });
    lala = await lalaProfileId(sequelize);
    if (!lala) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES ('lala', 'instagram', 'test', 'Lala', 'lalaverse', NOW(), NOW()) RETURNING id`);
      lala = row.id;
      madeLala = true;
    }
    p.lala = lala;
    for (const key of ['marcus', 'kim', 'nia']) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}`, display: `${key}${tag}` });
      p[key] = row.id;
    }
    // Marcus and Kim collaborate (0.7, close); Nia knows nobody.
    await run(`INSERT INTO social_profile_relationships (source_profile_id, target_profile_id, relationship_type, created_at, updated_at)
               VALUES (:marcus, :kim, 'collab', NOW(), NOW())`, { marcus: p.marcus, kim: p.kim });
  });

  afterAll(async () => {
    await new Promise((r) => { setTimeout(r, 300); });
    await run('DELETE FROM pulse_closeness WHERE show_id = :show', ids);
    await run('DELETE FROM feed_comments WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_post_numbers WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM social_profile_relationships WHERE source_profile_id IN (:a) OR target_profile_id IN (:a)', { a: [p.marcus, p.kim, p.nia] });
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: [p.marcus, p.kim, p.nia, ...(madeLala ? [lala] : [])] });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('a pair starts at its relationship type, or 0 with none', async () => {
    expect(await closeness.closenessAt(models, ids.show, p.marcus, p.kim, 10)).toBe(0.7);
    expect(await closeness.closenessAt(models, ids.show, p.kim, p.marcus, 10)).toBe(0.7);
    expect(await closeness.closenessAt(models, ids.show, p.nia, p.marcus, 10)).toBe(0);
  });

  test('a live comment moves the pair closer, auto-accepted, from its moment on; proposing again is a no-op', async () => {
    const first = await post('marcus', 11);
    await comment(first, 'kim');
    const made = await closeness.proposeFromPost(models, first.id);
    expect(made).toHaveLength(1);
    expect(made[0]).toMatchObject({ cause: 'comment', status: 'accepted', decided_by: 'auto', story_order: 11 });
    expect(Number(made[0].delta)).toBe(0.03);
    expect(Number(made[0].closeness_after)).toBe(0.73);
    expect(await closeness.proposeFromPost(models, first.id)).toEqual([]);
    expect(await rowsFor(p.marcus, p.kim)).toHaveLength(1);
    expect(await closeness.closenessAt(models, ids.show, p.marcus, p.kim, 10)).toBe(0.7);
    expect(await closeness.closenessAt(models, ids.show, p.marcus, p.kim, 11)).toBe(0.73);
  });

  test("Lala's comment waits for Evoni; an @mention between others is accepted", async () => {
    const second = await post('marcus', 12);
    await comment(second, 'lala', 'love this');
    const waiting = await closeness.proposeFromPost(models, second.id);
    expect(waiting.map((r) => [r.cause, r.status])).toEqual([['comment', 'proposed']]);
    const shout = await post('nia', 13, `big love to @marcus${tag}.`);
    const made = await closeness.proposeFromPost(models, shout.id);
    expect(made.map((r) => [r.cause, r.status, Number(r.delta)])).toEqual([['mention', 'accepted', 0.02]]);
  });

  test("a close tie's post left a full episode without a reaction moves them apart; strangers are not counted", async () => {
    // Marcus's post at 12 got no comment from Kim (close); a post at 22 is a full episode later.
    const later = await post('nia', 22);
    const made = await closeness.proposeFromPost(models, later.id);
    const ignored = made.filter((r) => r.cause === 'ignored');
    expect(ignored).toHaveLength(1);
    const [x, y] = closeness.pairOf(p.marcus, p.kim);
    expect(ignored[0]).toMatchObject({ profile_a_id: x, profile_b_id: y, story_order: 22, status: 'accepted' });
    expect(Number(ignored[0].delta)).toBe(-0.02);
    // Kim did comment on the post at 11, so that one is not ignored.
    expect((await rowsFor(p.marcus, p.kim, { cause: 'ignored' })).map((r) => r.source_id)).toEqual([(await models.FeedPost.findOne({ where: { show_id: ids.show, story_order: 12 } })).id]);
  });

  test('a pair moving more than AUTO_MOMENT at one moment waits', async () => {
    const statuses = [];
    for (let i = 0; i < 6; i += 1) {
      const row = await closeness.propose(models, { showId: ids.show, a: p.nia, b: p.kim, at: 30, cause: 'comment', sourceId: `burst-${i}` });
      statuses.push(row.status);
    }
    expect(statuses).toEqual(['accepted', 'accepted', 'accepted', 'accepted', 'accepted', 'proposed']);
  });

  test('GET lists the waiting changes with both profiles and the comment behind it; decisions are admin-only and once', async () => {
    const res = await as(admin, request(app).get(`/api/v1/pulse-closeness?show_id=${ids.show}`));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    const lalas = res.body.changes.find((c) => c.cause === 'comment' && [c.profile_a_id, c.profile_b_id].includes(Number(lala)));
    expect(lalas).toMatchObject({ status: 'proposed', delta: 0.03, closeness_before: 0, closeness_after: 0.03 });
    expect([lalas.a.handle, lalas.b.handle].sort()).toEqual(['lala', `marcus${tag}`].sort());
    expect(lalas.source).toMatchObject({ comment_text: 'love this', poster_handle: `marcus${tag}` });

    expect((await put(lalas.id, 'accept', {}, editor)).status).toBe(403);
    expect((await put(lalas.id, 'adjust', { delta: 0.05 })).status).toBe(400);              // no reason
    expect((await put(lalas.id, 'adjust', { delta: 0.5, reason: 'too much' })).status).toBe(400);
    const adj = await put(lalas.id, 'adjust', { delta: 0.1, reason: 'They hit it off at the gala.' });
    expect(adj.status).toBe(200);
    expect(adj.body.change).toMatchObject({ status: 'accepted', delta: 0.1, closeness_after: 0.1, reason: 'They hit it off at the gala.', decided_by: 'evoni@close.dev' });
    expect((await put(lalas.id, 'accept')).status).toBe(409);
    expect(await closeness.closenessAt(models, ids.show, lala, p.marcus, 12)).toBe(0.1);
    expect((await closeness.ledgerDeltas(models, ids.show, lala, 12)).get(Number(p.marcus))).toBe(0.1);

    const burst = res.body.changes.find((c) => c.source_id === 'burst-5');
    const rej = await put(burst.id, 'reject');
    expect(rej.body.change.status).toBe('rejected');
    expect((await as(admin, request(app).get(`/api/v1/pulse-closeness?show_id=${ids.show}`))).body.total).toBe(0);
    expect((await as(admin, request(app).get('/api/v1/pulse-closeness?show_id=nope'))).status).toBe(400);
  });

  test('releasing a draft proposes its changes after the response', async () => {
    const draft = await models.FeedPost.create({
      show_id: ids.show, social_profile_id: p.kim, poster_handle: `kim${tag}`, poster_display_name: 'kim', poster_platform: 'lalaverse',
      post_type: 'post', content_text: `with @nia${tag} today`, status: 'draft', story_order: 31, likes: 0, comments_count: 0, shares: 0, sample_comments: [], sort_order: 0,
    });
    const res = await as(admin, request(app).put(`/api/v1/feed-posts/${draft.id}`)).send({ status: 'live' });
    expect(res.status).toBe(200);
    let rows = [];
    for (let i = 0; i < 40 && rows.length === 0; i += 1) {
      await new Promise((r) => { setTimeout(r, 50); });
      rows = await rowsFor(p.kim, p.nia, { cause: 'mention' });
    }
    expect(rows).toHaveLength(1);
    expect(rows[0].source_id).toBe(draft.id);
  });
});
