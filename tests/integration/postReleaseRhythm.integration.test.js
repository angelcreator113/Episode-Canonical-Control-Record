/**
 * Scheduling that keeps up (Evoni, 2026-10-17: "Yes I want them all";
 * services/postRelease):
 * - an episode's air date moves: its scheduled posts move with it, and one
 *   that would land in the past is held;
 * - each poster's rhythm: a lurker's posts are planned a day apart;
 * - the suggestions learn the hours she schedules at, overall and for a
 *   story phase.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { releaseHabits, planReleases } = require('../../src/services/postRelease');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const uuid = () => crypto.randomUUID();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

(shouldSkip ? describe.skip : describe)('scheduling keeps up: air dates, rhythm, her hours', () => {
  const tag = uuid().slice(0, 8);
  const shows = { shift: uuid(), rhythm: uuid(), learn: uuid() };
  const ids = { reg: uuid(), char: uuid(), ep: uuid() };
  let profileId;
  let admin;
  const air = new Date(Date.now() + 20 * DAY);
  air.setUTCHours(0, 0, 0, 0);
  const draft = (show, extra = {}) => models.FeedPost.create({
    show_id: show, poster_handle: `rh${tag}`, poster_display_name: 'Rh', poster_platform: 'lalaverse', post_type: 'post',
    content_text: 'soon.', status: 'draft', story_order: 31, likes: 0, comments_count: 0, shares: 0, sample_comments: [], sort_order: 0, ...extra,
  });

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-rhythm', email: 'evoni@rhythm.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    for (const [key, id] of Object.entries(shows)) {
      await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :name, :slug, NOW(), NOW())', { id, name: `Rhythm ${key} ${tag}`, slug: `rhythm-${key}-${tag}` });
      await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, air_date, created_at, updated_at)
                 VALUES (:eid, :id, 'Three', 3, 'draft', :air, NOW(), NOW())`, { eid: key === 'shift' ? ids.ep : uuid(), id, air });
    }
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Rhythm', :show, NOW(), NOW())", { reg: ids.reg, show: shows.rhythm });
    const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
      VALUES (:handle, 'instagram', 'test', 'Lurk', 'lalaverse', NOW(), NOW()) RETURNING id`, { handle: `lurk${tag}` });
    profileId = row.id;
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, feed_profile_id, created_at, updated_at)
               VALUES (:char, :reg, :key, 'Lurk', 'alive', :pid, NOW(), NOW())`, { char: ids.char, reg: ids.reg, key: `lurk-${tag}`, pid: profileId });
    await models.PulseVoice.create({ registry_character_id: ids.char, social_profile_id: profileId, habits_json: { temperament: 'lurker' }, examples_json: [], status: 'built' });
  });

  afterAll(async () => {
    await run('DELETE FROM feed_posts WHERE show_id IN (:s)', { s: Object.values(shows) });
    await run('DELETE FROM pulse_voices WHERE registry_character_id = :char', ids);
    await run('DELETE FROM registry_characters WHERE id = :char', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id = :pid', { pid: profileId });
    await run('DELETE FROM episodes WHERE show_id IN (:s)', { s: Object.values(shows) });
    await run('DELETE FROM shows WHERE id IN (:s)', { s: Object.values(shows) });
    await sequelize.close();
  });

  it('a moved air date moves its scheduled posts; one that would be past is held; other episodes stay', async () => {
    const twoDaysBefore = new Date(air.getTime() - 2 * DAY + 18 * HOUR);
    const soon = new Date(Date.now() + 2 * DAY);
    const p = await draft(shows.shift, { release_state: 'scheduled', release_at: twoDaysBefore });
    const q = await draft(shows.shift, { release_state: 'scheduled', release_at: soon });
    const other = await draft(shows.shift, { story_order: 41, release_state: 'scheduled', release_at: twoDaysBefore });
    // Ten days earlier: p moves ten days earlier, q would be in the past.
    const newAir = new Date(air.getTime() - 10 * DAY);
    const res = await request(app).put(`/api/v1/episodes/${ids.ep}`).set('Authorization', `Bearer ${admin}`).send({ air_date: newAir.toISOString() });
    expect(res.status).toBe(200);
    expect(res.body.release_shift).toEqual({ shifted: [p.id], held: [q.id] });
    await p.reload(); await q.reload(); await other.reload();
    expect(p.release_at.getTime()).toBe(twoDaysBefore.getTime() - 10 * DAY);
    expect(q).toMatchObject({ release_state: 'held', release_at: null });
    expect(other.release_at.getTime()).toBe(twoDaysBefore.getTime());
    // A save that doesn't touch the air date moves nothing.
    const again = await request(app).put(`/api/v1/episodes/${ids.ep}`).set('Authorization', `Bearer ${admin}`).send({ title: 'Three again' });
    expect(again.body.release_shift).toBeUndefined();
  });

  it('a lurker\'s posts are planned a day apart', async () => {
    await draft(shows.rhythm, { social_profile_id: profileId });
    await draft(shows.rhythm, { social_profile_id: profileId });
    const { items } = await planReleases(models, { showId: shows.rhythm, tzOffset: 0 });
    expect(items).toHaveLength(2);
    const [a, b] = items.map((i) => new Date(i.at).getTime()).sort((x, y) => x - y);
    expect(b - a).toBeGreaterThanOrEqual(DAY);
  });

  it('learns the hours she schedules at: her slots, and her hour for a story phase', async () => {
    expect((await releaseHabits(models, shows.learn)).learned).toBe(0);
    const day = (n) => { const d = new Date(Date.now() + n * DAY); d.setUTCHours(9, 0, 0, 0); return d; };
    for (let n = 1; n <= 5; n += 1) {
      const p = await draft(shows.learn, { story_order: 32 });
      const res = await request(app).put(`/api/v1/feed-posts/${p.id}/release-time`).set('Authorization', `Bearer ${admin}`)
        .send({ mode: 'schedule', at: day(n).toISOString(), tz_offset: 0 });
      expect(res.status).toBe(200);
    }
    const habits = await releaseHabits(models, shows.learn);
    expect(habits.learned).toBe(5);
    expect(habits.slots).toEqual([9]);
    expect(habits.phaseHours).toEqual({ 2: 9 });
    const next = await draft(shows.learn, { story_order: 32 });
    const res = await request(app).get(`/api/v1/feed-posts/${next.id}/release-time/suggest?tz_offset=0`).set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(200);
    const want = new Date(air.getTime() - 7 * DAY);
    want.setUTCHours(9);
    expect(res.body.at).toBe(want.toISOString());
    expect(res.body.why).toMatch(/at the hour you usually choose/);
    // Other metadata on the show is kept.
    const [[row]] = await run("SELECT metadata->'pulse_release'->'hours' AS h FROM shows WHERE id = :id", { id: shows.learn });
    expect(row.h).toEqual({ 9: 5 });
  });

  it('the release calendar lists the scheduled drafts by time, soonest first, with their story time', async () => {
    const later = await draft(shows.rhythm, { story_order: 32, release_state: 'scheduled', release_at: new Date(Date.now() + 5 * DAY) });
    const sooner = await draft(shows.rhythm, { story_order: 31, post_weight: 'load_bearing', release_state: 'scheduled', release_at: new Date(Date.now() + 2 * DAY) });
    await draft(shows.rhythm, { release_state: 'scheduled', release_at: new Date(Date.now() + 60 * DAY) });
    await draft(shows.rhythm, { release_state: 'held' });
    const res = await request(app).get(`/api/v1/feed-posts/release-calendar?show_id=${shows.rhythm}`).set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(200);
    expect(res.body.posts.map((p) => p.post_id)).toEqual([sooner.id, later.id]);
    expect(res.body.posts[0]).toMatchObject({ story: 'Before Ep 3', post_weight: 'load_bearing', handle: `rh${tag}` });
    expect((await request(app).get('/api/v1/feed-posts/release-calendar').set('Authorization', `Bearer ${admin}`)).status).toBe(400);
    expect((await request(app).get(`/api/v1/feed-posts/release-calendar?show_id=${shows.rhythm}`)).status).toBe(401);
  });
});
