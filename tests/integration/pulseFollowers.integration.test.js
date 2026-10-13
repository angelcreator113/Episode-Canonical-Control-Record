/**
 * The follower ledger (Task #2952; The Pulse spec §8; Evoni, 2026-10-12):
 * followers change only through a pulse_followers row with a cause.
 * - POST /starts proposes one starting count per LalaVerse profile without
 *   one, from its estimate or its tier; Lala's waits for Evoni, the others
 *   are accepted; a second call adds none;
 * - the count at a story moment is the latest accepted row at or before it;
 * - adjust needs a reason; override adds an accepted change with a reason;
 * - reads need a sign-in, writes an admin.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const ledger = require('../../src/services/pulseFollowers');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('The Pulse follower ledger (Task #2952)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), other: uuid() };
  const p = {};
  let admin;
  let editor;
  const as = (token, req) => req.set('Authorization', `Bearer ${token}`);
  const mine = (rows) => rows.filter((r) => Object.values(p).includes(r.social_profile_id));

  beforeAll(async () => {
    admin = TokenService.generateTokenPair({ id: 'test-admin-followers', email: 'evoni@followers.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-followers', email: 'ed@followers.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    for (const show of [ids.show, ids.other]) {
      await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
        { show, name: `Followers ${show.slice(0, 8)}`, slug: `followers-${show.slice(0, 8)}` });
    }
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'One', 1, 'published', NOW(), NOW())`, { ep: uuid(), show: ids.show });
    const make = [
      ['est', '47k', null, 'lalaverse'],
      ['tier', null, 'mid', 'lalaverse'],
      ['none', null, null, 'lalaverse'],
      ['real', '9k', null, 'real_world'],
    ];
    for (const [key, approx, tier, layer] of make) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, follower_count_approx, follower_tier, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, :layer, :approx, CAST(:tier AS enum_social_profiles_follower_tier), NOW(), NOW()) RETURNING id`,
      { handle: `${key}-${tag}`, display: `${key} ${tag}`, layer, approx, tier });
      p[key] = row.id;
    }
  });

  afterAll(async () => {
    await run('DELETE FROM pulse_followers WHERE show_id IN (:show, :other)', ids);
    await run('DELETE FROM episodes WHERE show_id IN (:show, :other)', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: Object.values(p) });
    await run('DELETE FROM shows WHERE id IN (:show, :other)', ids);
  });

  test('reads need a sign-in and writes an admin', async () => {
    expect((await request(app).get(`/api/v1/pulse-followers?show_id=${ids.show}`)).status).toBe(401);
    expect((await as(editor, request(app).post('/api/v1/pulse-followers/starts')).send({ show_id: ids.show })).status).toBe(403);
    expect((await as(editor, request(app).post('/api/v1/pulse-followers/override')).send({ show_id: ids.show })).status).toBe(403);
    expect((await as(admin, request(app).get('/api/v1/pulse-followers?show_id=nope'))).status).toBe(400);
  });

  test('starts: proposed once, from the estimate or the tier; LalaVerse profiles only; none without either', async () => {
    const first = await as(admin, request(app).post('/api/v1/pulse-followers/starts')).send({ show_id: ids.show });
    expect(first.status).toBe(201);
    const res = await as(admin, request(app).get(`/api/v1/pulse-followers?show_id=${ids.show}`));
    expect(res.status).toBe(200);
    const counts = Object.fromEntries(mine(res.body.counts).map((c) => [c.social_profile_id, c]));
    expect(counts[p.est].count).toBe(47000);
    expect(counts[p.est].handle).toBe(`est-${tag}`);
    expect(counts[p.tier].count).toBe(50000);
    // The tier is worked out from the count (Task #3033): 50,000 is Mid-tier, 47,000 is Micro.
    expect(counts[p.tier].tier).toEqual({ key: 'mid', label: 'Mid-tier', from: 50000 });
    expect(counts[p.est].tier.label).toBe('Micro');
    expect(counts[p.tier].follower_tier).toBeUndefined();
    expect(counts[p.none]).toBeUndefined();
    expect(counts[p.real]).toBeUndefined();

    const again = await as(admin, request(app).post('/api/v1/pulse-followers/starts')).send({ show_id: ids.show });
    expect(again.status).toBe(200);
    expect(again.body.created).toBe(0);
    const [[{ n }]] = await run(`SELECT COUNT(*)::int AS n FROM pulse_followers WHERE show_id = :show AND social_profile_id = :id`, { show: ids.show, id: p.est });
    expect(n).toBe(1);
  });

  test("Lala's start waits for Evoni; adjust needs a reason and recomputes the change", async () => {
    const result = await ledger.proposeStarts(models, ids.other, { lalaProfileId: p.est });
    expect(result.waiting).toBe(1);
    const res = await as(admin, request(app).get(`/api/v1/pulse-followers?show_id=${ids.other}`));
    const waiting = mine(res.body.proposed);
    expect(waiting.map((r) => r.social_profile_id)).toEqual([p.est]);
    expect(mine(res.body.counts).map((c) => c.social_profile_id)).toEqual([p.tier]);
    const id = waiting[0].id;

    const noReason = await as(admin, request(app).put(`/api/v1/pulse-followers/${id}/adjust`)).send({ count: 12000 });
    expect(noReason.status).toBe(400);
    const adjusted = await as(admin, request(app).put(`/api/v1/pulse-followers/${id}/adjust`)).send({ count: 12000, reason: 'She is just starting out.' });
    expect(adjusted.status).toBe(200);
    expect(adjusted.body.change).toMatchObject({ status: 'accepted', count_after: 12000, change: 12000, decided_by: 'evoni@followers.dev' });
    const twice = await as(admin, request(app).put(`/api/v1/pulse-followers/${id}/accept`));
    expect(twice.status).toBe(409);
  });

  test('override: a reason, a moment, never below 0; the count at a moment is the latest at or before it', async () => {
    const post = (body) => as(admin, request(app).post('/api/v1/pulse-followers/override')).send({ show_id: ids.show, profile_id: p.est, ...body });
    expect((await post({ change: 500 })).status).toBe(400);
    expect((await post({ change: 0, reason: 'x' })).status).toBe(400);
    expect((await post({ change: -100000, reason: 'x', at: 15 })).status).toBe(400);
    expect((await post({ change: 5, reason: 'x', at: 'whenever' })).status).toBe(400);
    expect((await as(admin, request(app).post('/api/v1/pulse-followers/override'))
      .send({ show_id: ids.show, profile_id: p.none, change: 5, reason: 'x' })).status).toBe(409);

    const ep2 = await post({ change: 3000, reason: 'The gala clip went round.', at: 'ep:2:after_episode' });
    expect(ep2.status).toBe(201);
    expect(ep2.body.change).toMatchObject({ cause: 'override', story_order: 27, change: 3000, count_after: 50000 });
    // No `at`: the present (after episode 1, the latest published).
    const now = await post({ change: -1000, reason: 'A quiet week.' });
    expect(now.body.change).toMatchObject({ story_order: 17, count_after: 46000 });

    expect(await ledger.countAt(models, ids.show, p.est, 0)).toBe(47000);
    expect(await ledger.countAt(models, ids.show, p.est, 17)).toBe(46000);
    expect(await ledger.countAt(models, ids.show, p.est, 30)).toBe(50000);
    const at = async (value) => {
      const res = await as(admin, request(app).get(`/api/v1/pulse-followers?show_id=${ids.show}&at=${value}`));
      return mine(res.body.counts).find((c) => c.social_profile_id === p.est).count;
    };
    expect(await at('ep:1:before_episode')).toBe(47000);
    expect(await at('present')).toBe(46000);
    expect(await at('ep:3:during_episode')).toBe(50000);

    const history = await as(admin, request(app).get(`/api/v1/pulse-followers/history?show_id=${ids.show}&profile_id=${p.est}`));
    expect(history.body.history.map((r) => [r.cause, r.story_order, r.count_after])).toEqual([['start', 0, 47000], ['override', 17, 46000], ['override', 27, 50000]]);
  });
});
