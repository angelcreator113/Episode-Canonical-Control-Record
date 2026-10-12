/**
 * Admin › The Pulse › Growth read (Task #2957; The Pulse spec §4):
 * GET /pulse-followers/growth gives Lala's accepted follower line in story
 * order, proposed episode changes as the projection, her best and worst
 * posts by locked likes, and her biggest jumps with their causes. Other
 * characters' rows and undecided numbers are left out.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { growthOf } = require('../../src/services/pulseGrowth');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('The Pulse Growth read (Task #2957)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), ep1: uuid(), ep2: uuid(), ep3: uuid() };
  const p = {};
  let token;

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-user-growth', email: 'ed@growth.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Growth ${tag}`, slug: `growth-${tag}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES
      (:ep1, :show, 'One', 1, 'published', NOW(), NOW()), (:ep2, :show, 'Two', 2, 'published', NOW(), NOW()), (:ep3, :show, 'Three', 3, 'draft', NOW(), NOW())`, ids);
    for (const key of ['lala', 'other']) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, follower_tier, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', 'mid', NOW(), NOW()) RETURNING id`, { handle: `${key}-${tag}`, display: key });
      p[key] = row.id;
    }
    const at = (s) => new Date(Date.now() - s * 1000);
    await models.PulseFollower.bulkCreate([
      { show_id: ids.show, social_profile_id: p.lala, story_order: 0, change: 50000, count_after: 50000, cause: 'start', status: 'accepted', decided_at: at(50) },
      { show_id: ids.show, social_profile_id: p.lala, story_order: 17, change: 4000, count_after: 54000, cause: 'episode', cause_id: ids.ep1, status: 'accepted', decided_at: at(40) },
      { show_id: ids.show, social_profile_id: p.lala, story_order: 18, change: -500, count_after: 53500, cause: 'override', reason: 'A quiet day.', status: 'accepted', decided_at: at(30) },
      { show_id: ids.show, social_profile_id: p.lala, story_order: 27, change: 9000, count_after: 62500, cause: 'episode', cause_id: ids.ep2, status: 'accepted', decided_at: at(20) },
      { show_id: ids.show, social_profile_id: p.lala, story_order: 37, change: 2500, count_after: 65000, cause: 'episode', cause_id: ids.ep3, status: 'proposed' },
      { show_id: ids.show, social_profile_id: p.other, story_order: 0, change: 999999, count_after: 999999, cause: 'start', status: 'accepted', decided_at: at(50) },
    ]);
    // Seven of Lala's posts with decided numbers, one undecided, and one of the other's.
    const likes = [100, 900, 300, 5000, 50, 2000, 700];
    for (const [i, n] of likes.entries()) {
      const post = uuid();
      await run(`INSERT INTO feed_posts (id, show_id, poster_handle, social_profile_id, content_text, status, created_at, updated_at)
                 VALUES (:post, :show, 'lala', :lala, :text, 'live', NOW(), NOW())`, { post, show: ids.show, lala: p.lala, text: `Post ${n}` });
      await models.PulsePostNumber.create({ post_id: post, show_id: ids.show, social_profile_id: p.lala, poster_handle: 'lala', proposed_likes: n, proposed_shares: 0, seed: i + 1, status: i === 3 ? 'viral' : 'accepted', final_likes: n, final_shares: Math.round(n / 10) });
    }
    for (const [who, status, n] of [[p.lala, 'proposed', 99999], [p.other, 'accepted', 88888]]) {
      const post = uuid();
      await run(`INSERT INTO feed_posts (id, show_id, poster_handle, social_profile_id, content_text, status, created_at, updated_at)
                 VALUES (:post, :show, 'x', :who, 'skip', 'live', NOW(), NOW())`, { post, show: ids.show, who });
      await models.PulsePostNumber.create({ post_id: post, show_id: ids.show, social_profile_id: who, proposed_likes: n, proposed_shares: 0, seed: 9, status, final_likes: status === 'accepted' ? n : null });
    }
  });

  afterAll(async () => {
    await run('DELETE FROM pulse_post_numbers WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_followers WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: Object.values(p) });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('the route needs a sign-in and a show id', async () => {
    expect((await request(app).get(`/api/v1/pulse-followers/growth?show_id=${ids.show}`)).status).toBe(401);
    expect((await request(app).get('/api/v1/pulse-followers/growth?show_id=nope').set('Authorization', `Bearer ${token}`)).status).toBe(400);
    const res = await request(app).get(`/api/v1/pulse-followers/growth?show_id=${ids.show}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test("Lala's line in story order, the projection on top of it, and her start", async () => {
    const g = await growthOf(models, ids.show, { lalaProfileId: p.lala });
    expect(g.profile).toMatchObject({ id: p.lala, follower_tier: 'mid' });
    expect(g.start).toMatchObject({ cause: 'start', status: 'accepted', count: 50000, label: 'Start' });
    expect(g.line.map((r) => [r.label, r.count])).toEqual([['Start', 50000], ['After Ep 1', 54000], ['The day after Ep 1', 53500], ['After Ep 2', 62500]]);
    expect(g.projection).toEqual([expect.objectContaining({ label: 'After Ep 3', change: 2500, count: 65000, episode_number: 3, status: 'proposed' })]);
  });

  test('best and worst five posts by locked likes; undecided and other characters\' posts left out', async () => {
    const g = await growthOf(models, ids.show, { lalaProfileId: p.lala });
    expect(g.best.map((x) => x.likes)).toEqual([5000, 2000, 900, 700, 300]);
    expect(g.worst.map((x) => x.likes)).toEqual([50, 100, 300, 700, 900]);
    expect(g.best[0]).toMatchObject({ status: 'viral', shares: 500, content_text: 'Post 5000' });
  });

  test('the biggest jumps with their causes, the start left out', async () => {
    const g = await growthOf(models, ids.show, { lalaProfileId: p.lala });
    expect(g.jumps.map((j) => [j.cause, j.change, j.episode_number])).toEqual([['episode', 9000, 2], ['episode', 4000, 1], ['override', -500, null]]);
    expect(g.jumps[2].reason).toBe('A quiet day.');
  });

  test('no Lala profile: an empty growth', async () => {
    expect(await growthOf(models, ids.show, { lalaProfileId: null })).toEqual({ profile: null, start: null, line: [], projection: [], best: [], worst: [], jumps: [] });
  });
});
