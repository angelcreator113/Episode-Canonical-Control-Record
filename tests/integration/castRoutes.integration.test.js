/**
 * The cast's review of the old system (routes/castRoutes.js; the
 * Characters page, Evoni's mock, 2026-10-08): Keep, Match to feed person,
 * Archived with Bring back, Delete permanently, and how many episodes use
 * each character (its feed profile hosts or is a guest of the episode's
 * event).
 *
 * The database is the local migrated test DB.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('the cast: review of the old system', () => {
  let token;
  const TAG = crypto.randomUUID().slice(0, 8);
  const ids = {
    show: crypto.randomUUID(), reg: crypto.randomUUID(), ep: crypto.randomUUID(), ev: crypto.randomUUID(), rel: crypto.randomUUID(),
    host: crypto.randomUUID(), guest: crypto.randomUUID(), old: crypto.randomUUID(), friend: crypto.randomUUID(),
    loc: crypto.randomUUID(), post: crypto.randomUUID(),
  };
  const profiles = {};
  const auth = () => `Bearer ${token}`;

  const addCharacter = (id, name, feedProfileId = null) => run(
    `INSERT INTO registry_characters (id, registry_id, character_key, display_name, selected_name, role_type, status, feed_profile_id, created_at, updated_at)
     VALUES (:id, :reg, :key, :name, :name, 'support', 'accepted', :feedProfileId, NOW(), NOW())`,
    { id, reg: ids.reg, key: `cast-${crypto.randomUUID().slice(0, 8)}`, name: `${name} ${TAG}`, feedProfileId });
  const addProfile = async (key, layer = 'lalaverse') => {
    const [[row]] = await run(
      `INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, created_at, updated_at)
       VALUES (:handle, 'instagram', 'test', :layer, NOW(), NOW()) RETURNING id`,
      { handle: `${key}${TAG}`, layer });
    profiles[key] = row.id;
  };

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-cast-review', email: 'test@cast-review.dev', name: 'Cast Review Test', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Cast ${TAG}`, slug: `cast-${TAG}` });
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, :title, :show, NOW(), NOW())`,
      { ...ids, title: `Cast ${TAG}` });
    await addProfile('host'); await addProfile('guest'); await addProfile('free'); await addProfile('celeb', 'real_world');
    await addCharacter(ids.host, 'Host', profiles.host);
    await addCharacter(ids.guest, 'Guest', profiles.guest);
    await addCharacter(ids.old, 'Old');
    await addCharacter(ids.friend, 'Friend');
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Cast episode', 1, 'draft', NOW(), NOW())`, ids);
    // The host by source_profile_id; the guest in the automation copy, by profile_id.
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, source_profile_id, canon_consequences, created_at, updated_at)
               VALUES (:ev, :show, 'Cast event', 'used', :ep, :hostProfile, :cc::jsonb, NOW(), NOW())`,
    { ...ids, hostProfile: profiles.host, cc: JSON.stringify({ automation: {
      guest_profiles: [{ profile_id: profiles.guest }, { id: 'not-a-number' }],
      relationship_goals: [{ slot: 'relationship_host', label: 'Follow up with the host after the event' }],
    } }) });
    await run(`UPDATE world_events SET event_date = 'Nov 12', venue_name = 'The Studio', is_paid = true, payment_amount = 439 WHERE id = :ev`, ids);
    // The host lives at a place with one scene set, and has one post.
    await run(`INSERT INTO world_locations (id, name, created_at, updated_at) VALUES (:loc, :name, NOW(), NOW())`, { ...ids, name: `Studio ${TAG}` });
    await run('UPDATE social_profiles SET home_location_id = :loc, lala_relationship = \'direct\' WHERE id = :p', { ...ids, p: profiles.host });
    await run(`INSERT INTO scene_sets (id, name, scene_type, world_location_id, created_at, updated_at) VALUES (:id, 'Studio set', 'EVENT_LOCATION', :loc, NOW(), NOW())`, { ...ids, id: crypto.randomUUID() });
    await run(`INSERT INTO feed_posts (id, show_id, poster_handle, social_profile_id, created_at, updated_at) VALUES (:post, :show, 'host', :p, NOW(), NOW())`, { ...ids, p: profiles.host });
  });

  afterAll(async () => {
    await run('DELETE FROM character_relationships WHERE id = :rel', ids);
    await run('DELETE FROM feed_posts WHERE id = :post', ids);
    await run('DELETE FROM scene_sets WHERE world_location_id = :loc', ids);
    await run('UPDATE social_profiles SET home_location_id = NULL WHERE home_location_id = :loc', ids);
    await run('DELETE FROM world_locations WHERE id = :loc', ids);
    await run('DELETE FROM world_events WHERE id = :ev', ids);
    await run('DELETE FROM episodes WHERE id = :ep', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:p)', { p: Object.values(profiles) });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  const review = () => request(app).get(`/api/v1/cast/review?registry_id=${ids.reg}`).set('Authorization', auth());

  it('needs a sign-in and a registry id', async () => {
    expect((await request(app).get(`/api/v1/cast/review?registry_id=${ids.reg}`)).status).toBe(401);
    expect((await request(app).get('/api/v1/cast/review?registry_id=nope').set('Authorization', auth())).status).toBe(400);
  });

  it('counts the episodes whose event a character hosts or is a guest of', async () => {
    const res = await review();
    expect(res.status).toBe(200);
    expect(res.body.episode_counts).toMatchObject({ [ids.host]: 1, [ids.guest]: 1, [ids.old]: 0, [ids.friend]: 0 });
    expect(res.body.characters).toHaveLength(4);
    expect(res.body.archived).toEqual([]);
  });

  it('where a character shows up: its events with episode, goals and pay, its place and its posts', async () => {
    const res = await request(app).get(`/api/v1/cast/characters/${ids.host}/appearances`).set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(res.body.linked).toBe(true);
    expect(res.body.events).toHaveLength(1);
    expect(res.body.events[0]).toMatchObject({
      id: ids.ev, show_id: ids.show, role: 'host', event_date: 'Nov 12', venue_name: 'The Studio', is_paid: true, payment_amount: 439,
      goals: [{ slot: 'relationship_host', label: 'Follow up with the host after the event' }],
      episode: { id: ids.ep, episode_number: 1, title: 'Cast episode' },
    });
    expect(res.body.episodes).toEqual([{ id: ids.ep, episode_number: 1, title: 'Cast episode' }]);
    expect(res.body.place).toMatchObject({ id: ids.loc, residents: 1, scene_sets: 1 });
    expect(res.body.feed).toEqual({ posts: 1, lala_relationship: 'direct' });

    const guest = await request(app).get(`/api/v1/cast/characters/${ids.guest}/appearances`).set('Authorization', auth());
    expect(guest.body.events.map((e) => e.role)).toEqual(['guest']);
    expect(guest.body.place).toBeNull();

    const none = await request(app).get(`/api/v1/cast/characters/${ids.old}/appearances`).set('Authorization', auth());
    expect(none.body).toMatchObject({ linked: false, events: [], episodes: [], place: null, feed: null });
  });

  it('Keep marks a character kept, and back to review', async () => {
    const keep = await request(app).post(`/api/v1/cast/characters/${ids.old}/keep`).set('Authorization', auth()).send({ kept: true });
    expect(keep.status).toBe(200);
    let row = (await review()).body.characters.find((c) => c.id === ids.old);
    expect(row.cast_review).toBe('kept');
    expect(row.cast_reviewed_at).toBeTruthy();
    await request(app).post(`/api/v1/cast/characters/${ids.old}/keep`).set('Authorization', auth()).send({ kept: false });
    row = (await review()).body.characters.find((c) => c.id === ids.old);
    expect(row.cast_review).toBeNull();
    expect((await request(app).post(`/api/v1/cast/characters/${ids.old}/keep`).set('Authorization', auth()).send({ kept: 'yes' })).status).toBe(400);
  });

  it('Match to feed person links a free LalaVerse profile, and refuses a taken or real-world one', async () => {
    const put = (feed_profile_id) => request(app).put(`/api/v1/cast/characters/${ids.old}/feed-profile`).set('Authorization', auth()).send({ feed_profile_id });
    const taken = await put(profiles.host);
    expect(taken.status).toBe(409);
    expect(taken.body.error).toContain('already');
    expect((await put(profiles.celeb)).status).toBe(400);
    const ok = await put(profiles.free);
    expect(ok.status).toBe(200);
    const row = (await review()).body.characters.find((c) => c.id === ids.old);
    expect(row.feed_profile_id).toBe(profiles.free);
  });

  it('an archived character is listed, can come back, and is refused back while another holds its profile', async () => {
    await run('UPDATE registry_characters SET deleted_at = NOW() WHERE id = :guest', ids);
    let res = await review();
    expect(res.body.archived.map((c) => c.id)).toEqual([ids.guest]);
    expect(res.body.characters.map((c) => c.id)).not.toContain(ids.guest);
    const back = await request(app).post(`/api/v1/cast/characters/${ids.guest}/restore`).set('Authorization', auth());
    expect(back.status).toBe(200);
    expect(back.body.restored).toBe(true);
    res = await review();
    expect(res.body.archived).toEqual([]);

    // Archived again, its profile goes to another character: it may not come back with it.
    await run('UPDATE registry_characters SET deleted_at = NOW() WHERE id = :guest', ids);
    await run('UPDATE registry_characters SET feed_profile_id = :p WHERE id = :friend', { ...ids, p: profiles.guest });
    const refused = await request(app).post(`/api/v1/cast/characters/${ids.guest}/restore`).set('Authorization', auth());
    expect(refused.status).toBe(409);
    await run('UPDATE registry_characters SET feed_profile_id = NULL WHERE id = :friend', ids);
  });

  it('Delete permanently: only when archived, not while an episode uses it or rows would go with it', async () => {
    const del = (id) => request(app).delete(`/api/v1/cast/characters/${id}/permanent`).set('Authorization', auth());
    // Live: archive first.
    expect((await del(ids.old)).status).toBe(409);
    // The guest is archived but its event's episode still uses it.
    const used = await del(ids.guest);
    expect(used.status).toBe(409);
    expect(used.body.episodes).toBe(1);
    // A relationship would cascade.
    await run('UPDATE registry_characters SET deleted_at = NOW() WHERE id = :friend', ids);
    await run(`INSERT INTO character_relationships (id, character_id_a, character_id_b, relationship_type) VALUES (:rel, :friend, :host, 'friend')`, ids);
    const linked = await del(ids.friend);
    expect(linked.status).toBe(409);
    expect(linked.body.linked).toEqual({ relationships: 1 });
    await run('DELETE FROM character_relationships WHERE id = :rel', ids);
    const gone = await del(ids.friend);
    expect(gone.status).toBe(200);
    const [rows] = await run('SELECT id FROM registry_characters WHERE id = :friend', ids);
    expect(rows).toHaveLength(0);
  });
});
