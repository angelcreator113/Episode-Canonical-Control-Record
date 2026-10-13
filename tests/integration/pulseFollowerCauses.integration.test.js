/**
 * Follower causes through Review (Task #3086; Evoni, 2026-10-13): a
 * published original post (once its numbers lock), an approved event
 * deliverable and an accepted episode outcome propose follower changes.
 * Drafts, teasers (until revealed), invitations and merely attending do
 * not. Each change waits in Review with its source, story time, reason and
 * amount; each source applies once; accepting moves followers only.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const ledger = require('../../src/services/pulseFollowers');
const numbers = require('../../src/services/pulseNumbers');
const { lalaProfileId } = require('../../src/services/lalaFeedProfile');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const waitFor = async (fn, ms = 3000) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v || Date.now() > end) return v;
    await new Promise((r) => { setTimeout(r, 50); });
  }
};

(shouldSkip ? describe.skip : describe)('The Pulse follower causes (Task #3086)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), ep2: uuid(), ev: uuid() };
  const p = {};
  let lala;
  let madeLala = false;
  let admin;
  const as = (req) => req.set('Authorization', `Bearer ${admin}`);

  const post = async (key, parts = {}) => {
    const id = uuid();
    await run(`INSERT INTO feed_posts (id, show_id, social_profile_id, poster_handle, content_text, post_type, status, story_order, created_at, updated_at)
               VALUES (:id, :show, :profile, :handle, :text, :type, :status, :order, NOW(), NOW())`,
    { id, show: ids.show, profile: p.nia, handle: `nia${tag}`, text: `${key} post`, type: 'post', status: 'live', order: 35, ...parts });
    return id;
  };
  const numbersFor = (postId, likes = 2000) => models.PulsePostNumber.create({
    post_id: postId, show_id: ids.show, social_profile_id: p.nia, proposed_likes: likes, proposed_shares: 0, seed: 1, status: 'proposed', story_order: 35,
  });
  const followerRow = (cause, causeId) => models.PulseFollower.findOne({ where: { show_id: ids.show, cause, cause_id: String(causeId) } });

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-causes', email: 'evoni@causes.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    lala = await lalaProfileId(sequelize);
    if (!lala) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES ('lala', 'instagram', 'test', 'Lala', 'lalaverse', NOW(), NOW()) RETURNING id`);
      lala = row.id;
      madeLala = true;
    }
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Causes ${tag}`, slug: `causes-${tag}` });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:id, :show, 'lala', 1000, 3, 3, 3, 2, NOW(), NOW())`, { id: uuid(), show: ids.show });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep2, :show, 'Two', 2, 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, cost_coins, prestige, created_at, updated_at)
               VALUES (:ev, :show, :name, 'used', :ep2, 0, 5, NOW(), NOW())`, { ...ids, name: `Gala ${tag}` });
    for (const key of ['nia', 'nostart']) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}`, display: key });
      p[key] = row.id;
    }
    for (const [profile, count] of [[p.nia, 12000], [lala, 100000]]) {
      await models.PulseFollower.create({ show_id: ids.show, social_profile_id: profile, story_order: 0, change: count, count_after: count, cause: 'start', status: 'accepted', decided_at: new Date() });
    }
  });

  afterAll(async () => {
    await run('DELETE FROM event_deliverables WHERE event_id = :ev', ids);
    for (const t of ['pulse_followers', 'pulse_post_numbers', 'pulse_reveals', 'feed_posts', 'character_state_history', 'character_state', 'world_events', 'episodes']) {
      await run(`DELETE FROM ${t} WHERE show_id = :show`, ids);
    }
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: [p.nia, p.nostart, ...(madeLala ? [lala] : [])] });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('a post whose numbers Evoni accepts proposes its change for Review: likes × 2%, at its story time, with its source; once', async () => {
    const id = await post('accepted');
    const row = await numbersFor(id);
    await numbers.decide(row, 'accept', { by: 'evoni' });
    const change = await waitFor(() => followerRow('post', id));
    expect(change).toMatchObject({ social_profile_id: p.nia, status: 'proposed', story_order: 35, change: 40, count_after: 12040, reason: 'A post: 2,000 likes.' });
    expect(change.factors_json).toMatchObject({ likes: 2000, rate: 0.02, numbers: 'accepted', post_text: 'accepted post', poster_handle: `nia${tag}` });
    const again = await ledger.proposeFromPost(models, await row.reload());
    expect(again.id).toBe(change.id);
    expect(await models.PulseFollower.count({ where: { show_id: ids.show, cause: 'post', cause_id: id } })).toBe(1);
  });

  test('a flop loses what it would have gained; drafts and non-authored posts never count', async () => {
    const flopped = await post('flop');
    const row = await numbersFor(flopped);
    await numbers.decide(row, 'flop', { by: 'evoni' });
    const change = await waitFor(() => followerRow('post', flopped));
    expect(change.change).toBe(-Math.round(row.final_likes * 0.02));
    expect(change.reason).toBe('A post Evoni made a flop.');

    const draft = await post('draft', { status: 'draft' });
    expect(await ledger.proposeFromPost(models, { post_id: draft, status: 'accepted', final_likes: 500 })).toBeNull();
    const shot = await post('shot', { type: 'dm_screenshot' });
    expect(await ledger.proposeFromPost(models, { post_id: shot, status: 'accepted', final_likes: 500 })).toBeNull();
    expect(await ledger.proposeFromPost(models, { post_id: shot, status: 'proposed', final_likes: null })).toBeNull();
  });

  test('a teaser changes nothing until it is revealed: the change is stamped at its reveal; an unknown reveal moment proposes nothing yet', async () => {
    const teased = await post('teased');
    await models.PulseReveal.create({ show_id: ids.show, item_type: 'post', item_id: teased, moment: 'story_time', story_order: 57, mode: 'teaser', source: 'set' });
    const change = await ledger.proposeFromPost(models, { post_id: teased, status: 'accepted', final_likes: 1000 });
    expect(change).toMatchObject({ story_order: 57, change: 20 });

    const unknown = await post('unknown');
    await models.PulseReveal.create({ show_id: ids.show, item_type: 'post', item_id: unknown, moment: 'after', mode: 'teaser', source: 'set' });
    expect(await ledger.proposeFromPost(models, { post_id: unknown, status: 'accepted', final_likes: 1000 })).toBeNull();
  });

  test('approving an event deliverable proposes Lala\'s change: 0.5% of her followers per piece, at the episode\'s After; once', async () => {
    const id = uuid();
    await run(`INSERT INTO event_deliverables (id, event_id, description, required, owed_to, status, quantity, created_at, updated_at)
               VALUES (:id, :ev, '3 Instagram Stories', true, 'host', 'submitted', 3, NOW(), NOW())`, { ...ids, id });
    const res = await as(request(app).post(`/api/v1/world/${ids.show}/events/${ids.ev}/deliverables/${id}/status`)).send({ status: 'approved' });
    expect(res.status).toBe(200);
    const change = await followerRow('event', id);
    expect(change).toMatchObject({ social_profile_id: Number(lala), status: 'proposed', story_order: 27, change: 1500, count_after: 101500 });
    expect(change.factors_json).toMatchObject({ followers: 100000, rate: 0.005, pieces: 3, deliverable: '3 Instagram Stories', event_name: `Gala ${tag}` });
    const [deliverable] = await sequelize.query('SELECT * FROM event_deliverables WHERE id = :id', { replacements: { id }, type: sequelize.QueryTypes.SELECT });
    expect((await ledger.proposeFromDeliverable(models, { showId: ids.show, deliverable })).id).toBe(change.id);
    expect(await ledger.proposeFromDeliverable(models, { showId: ids.show, deliverable: { ...deliverable, status: 'submitted' } })).toBeNull();
  });

  test('accepting moves followers only: no Influence, no Decision Log row; a change before the starting count is refused', async () => {
    const id = await post('accept-me');
    const change = await ledger.proposeFromPost(models, { post_id: id, status: 'accepted', final_likes: 5000 });
    const res = await as(request(app).put(`/api/v1/pulse-followers/${change.id}/accept`));
    expect(res.status).toBe(200);
    await change.reload();
    expect(change).toMatchObject({ status: 'accepted', change: 100 });
    expect(await ledger.countAt(models, ids.show, p.nia, 35)).toBeGreaterThan(12000);
    const [[state]] = await run("SELECT influence FROM character_state WHERE show_id = :show AND character_key = 'lala'", ids);
    expect(Number(state.influence)).toBe(3);
    const [history] = await run('SELECT id FROM character_state_history WHERE show_id = :show', ids);
    expect(history).toEqual([]);

    const orphan = await models.PulseFollower.create({ show_id: ids.show, social_profile_id: p.nostart, story_order: 35, change: 10, cause: 'post', cause_id: uuid(), status: 'proposed' });
    const refused = await as(request(app).put(`/api/v1/pulse-followers/${orphan.id}/accept`));
    expect(refused.status).toBe(409);
    expect(refused.body.error).toBe('Accept the starting follower count first.');
  });

  test('Review lists the post and event changes with the episode ones (GET /pulse-followers proposed)', async () => {
    const res = await as(request(app).get(`/api/v1/pulse-followers?show_id=${ids.show}`));
    const causes = new Set(res.body.proposed.map((r) => r.cause));
    expect(causes.has('post')).toBe(true);
    expect(causes.has('event')).toBe(true);
    const postRow = res.body.proposed.find((r) => r.cause === 'post');
    expect(postRow).toMatchObject({ story_order: expect.any(Number), reason: expect.any(String), factors: expect.objectContaining({ post_text: expect.any(String) }) });
  });
});
