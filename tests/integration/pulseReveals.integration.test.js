/**
 * Reveals on The Pulse (Task #2938; The Pulse spec §5; Evoni, 2026-10-11):
 * one pulse_reveals row per item places its reveal on the story clock.
 * - PUT upserts one item's reveal (ADMIN only), resolving its story order
 *   from its event's episode or episode and its moment, or a set story time;
 * - GET lists them with the order resolved now (an event's episode may
 *   be set later); DELETE soft-deletes;
 * - GET /met derives the episode each profile meets Lala in (an event's
 *   guests first, else their earliest episode post) and a set character
 *   reveal overrides it.
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

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('The Pulse reveals (Task #2938)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), ep1: uuid(), ep2: uuid(), ep3: uuid(), ev2: uuid(), evLater: uuid(), post: uuid(), reg: uuid(), rcNobody: uuid() };
  const p = {};
  let admin;
  let editor;
  const as = (token, req) => req.set('Authorization', `Bearer ${token}`);
  const put = (body, token = admin) => as(token, request(app).put('/api/v1/pulse-reveals')).send({ show_id: ids.show, ...body });

  beforeAll(async () => {
    admin = TokenService.generateTokenPair({ id: 'test-admin-reveals', email: 'evoni@reveals.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-reveals', email: 'ed@reveals.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Reveals ${tag}`, slug: `reveals-${tag}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES
      (:ep1, :show, 'One', 1, 'published', NOW(), NOW()),
      (:ep2, :show, 'Two', 2, 'draft', NOW(), NOW()),
      (:ep3, :show, 'Three', 3, 'draft', NOW(), NOW())`, ids);
    for (const key of ['guest', 'poster', 'both', 'nobody']) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', NOW(), NOW()) RETURNING id`, { handle: `${key}-${tag}`, display: `${key} ${tag}` });
      p[key] = row.id;
    }
    // "nobody" is a Character Registry character, linked, whom Lala has not met (Task #2940).
    await run(`INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:reg, 'Reveals registry', NOW(), NOW())`, ids);
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, feed_profile_id, created_at, updated_at)
               VALUES (:rcNobody, :reg, :key, 'Nobody', :prof, NOW(), NOW())`, { ...ids, key: `nobody-${tag}`, prof: p.nobody });
    // Episode 2's event lists "guest" and "both"; "poster" and "both" post in episode 1 and 3.
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, canon_consequences, created_at, updated_at)
               VALUES (:id, :show, 'Gala', 'used', :ep, CAST(:cc AS jsonb), NOW(), NOW())`,
    { id: ids.ev2, show: ids.show, ep: ids.ep2, cc: JSON.stringify({ automation: { guest_profiles: [{ profile_id: p.guest }, { profile_id: p.both }] } }) });
    await run(`INSERT INTO world_events (id, show_id, name, status, created_at, updated_at) VALUES (:id, :show, 'Someday', 'ready', NOW(), NOW())`,
      { id: ids.evLater, show: ids.show });
    await run(`INSERT INTO feed_posts (id, show_id, poster_handle, social_profile_id, episode_id, content_text, status, created_at, updated_at) VALUES
      (:post, :show, 'poster', :poster, :ep3, 'later', 'live', NOW(), NOW()),
      (:p2, :show, 'poster', :poster, :ep1, 'first', 'live', NOW(), NOW()),
      (:p3, :show, 'both', :both, :ep1, 'early post', 'live', NOW(), NOW())`,
    { ...ids, p2: uuid(), p3: uuid(), poster: p.poster, both: p.both });
  });

  afterAll(async () => {
    await run('DELETE FROM pulse_reveals WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM world_events WHERE show_id = :show', ids);
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM registry_characters WHERE id = :rcNobody', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: Object.values(p) });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  it('writes are for admins; reads need a sign-in', async () => {
    expect((await put({ item_type: 'post', item_id: ids.post, event_id: ids.ev2, moment: 'during' }, editor)).status).toBe(403);
    expect((await request(app).put('/api/v1/pulse-reveals').send({})).status).toBe(401);
    expect((await request(app).get(`/api/v1/pulse-reveals?show_id=${ids.show}`)).status).toBe(401);
    expect((await as(editor, request(app).get(`/api/v1/pulse-reveals?show_id=${ids.show}`))).status).toBe(200);
  });

  it('upserts one reveal per item, resolving its story order from its event and moment', async () => {
    let res = await put({ item_type: 'post', item_id: ids.post, event_id: ids.ev2, moment: 'lala_arrives' });
    expect(res.status).toBe(201);
    expect(res.body.reveal).toMatchObject({ item_type: 'post', item_id: ids.post, moment: 'lala_arrives', story_order: 24, label: 'Lala arrives Ep 2', mode: 'teaser', source: 'set' });
    const first = res.body.reveal.id;

    res = await put({ item_type: 'post', item_id: ids.post, episode_id: ids.ep3, moment: 'after', mode: 'hidden' });
    expect(res.status).toBe(200);
    expect(res.body.reveal).toMatchObject({ id: first, story_order: 37, label: 'After Ep 3', mode: 'hidden' });

    // Images are told apart by their kind.
    expect((await put({ item_type: 'image', item_id: 'dazzle_district', image_kind: 'city', event_id: ids.ev2, moment: 'announced' })).body.reveal.story_order).toBe(22);
    expect((await put({ item_type: 'image', item_id: 'dazzle_district', image_kind: 'city_bubble', moment: 'story_time', at: 'ep:1:after_episode' })).body.reveal)
      .toMatchObject({ story_order: 17, label: 'After Ep 1' });
    const [[{ n }]] = await run('SELECT COUNT(*)::int AS n FROM pulse_reveals WHERE show_id = :show AND deleted_at IS NULL', ids);
    expect(n).toBe(3);
  });

  it('refuses what it cannot place', async () => {
    for (const body of [
      { item_type: 'song', item_id: 'x', moment: 'during', event_id: ids.ev2 },
      { item_type: 'post', item_id: 'bad id!', moment: 'during', event_id: ids.ev2 },
      { item_type: 'image', item_id: 'x', moment: 'during', event_id: ids.ev2 },
      { item_type: 'post', item_id: 'x', image_kind: 'city', moment: 'during', event_id: ids.ev2 },
      { item_type: 'post', item_id: 'x', moment: 'soon', event_id: ids.ev2 },
      { item_type: 'post', item_id: 'x', moment: 'during' },
      { item_type: 'post', item_id: 'x', moment: 'story_time', at: 'later' },
      { item_type: 'post', item_id: 'x', moment: 'during', event_id: ids.ev2, mode: 'blur' },
      { item_type: 'character', item_id: 'abc', moment: 'during', event_id: ids.ev2 },
    ]) {
      const res = await put(body);
      expect([res.status, body]).toEqual([400, body]);
    }
    expect((await put({ item_type: 'post', item_id: 'x', moment: 'during', event_id: ids.ev2, show_id: uuid() })).status).toBe(404);
  });

  it("an event with no episode yet has no order until it gets one; the list resolves it now", async () => {
    const res = await put({ item_type: 'event', item_id: ids.evLater, event_id: ids.evLater, moment: 'announced' });
    expect(res.body.reveal.story_order).toBeNull();
    await run('UPDATE world_events SET used_in_episode_id = :ep3 WHERE id = :id', { ep3: ids.ep3, id: ids.evLater });
    const list = await as(admin, request(app).get(`/api/v1/pulse-reveals?show_id=${ids.show}`));
    expect(list.status).toBe(200);
    expect(list.body.reveals.find((r) => r.item_id === ids.evLater)).toMatchObject({ story_order: 32, label: 'Announced Ep 3' });
  });

  it('derives the episode each profile meets Lala in, and a set one overrides it', async () => {
    const met = async () => (await as(admin, request(app).get(`/api/v1/pulse-reveals/met?show_id=${ids.show}`))).body.met;
    let rows = await met();
    const by = (list, id) => list.find((m) => m.profile_id === id);
    expect(by(rows, p.guest)).toMatchObject({ episode_number: 2, derived: { episode_number: 2, from: 'guest' }, set: null });
    expect(by(rows, p.poster)).toMatchObject({ episode_number: 1, derived: { episode_number: 1, from: 'post' } });
    // A guest list wins over an earlier post: being invited is meeting Lala.
    expect(by(rows, p.both)).toMatchObject({ episode_number: 2, derived: { from: 'guest' } });
    expect(by(rows, p.nobody)).toMatchObject({ registry_character_id: ids.rcNobody, derived: null, set: null, episode_number: null });
    expect(by(rows, p.guest).registry_character_id).toBeNull();

    const res = await put({ item_type: 'character', item_id: String(p.guest), episode_id: ids.ep3, moment: 'during', mode: 'hidden' });
    expect(res.status).toBe(201);
    rows = await met();
    expect(by(rows, p.guest)).toMatchObject({ episode_number: 3, derived: { episode_number: 2 }, set: { story_order: 35, mode: 'hidden' } });

    // Reset to derived: delete the set reveal.
    expect((await as(editor, request(app).delete(`/api/v1/pulse-reveals/${res.body.reveal.id}`))).status).toBe(403);
    expect((await as(admin, request(app).delete(`/api/v1/pulse-reveals/${res.body.reveal.id}`))).status).toBe(200);
    expect(by(await met(), p.guest)).toMatchObject({ episode_number: 2, set: null });
    expect((await as(admin, request(app).delete(`/api/v1/pulse-reveals/${res.body.reveal.id}`))).status).toBe(404);
  });
});
