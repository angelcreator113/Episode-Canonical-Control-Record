/**
 * The Feed page's right column (Task #2750): Upcoming Events are the events
 * tied to Lala's unpublished episodes, soonest first; People You May Know
 * are the guests on them who are not yet her friends, up to five.
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

(shouldSkip ? describe.skip : describe)('Feed sidebar (Task #2750)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), ep1: uuid(), ep2: uuid(), ep3: uuid(), ep4: uuid(), ev1: uuid(), ev2: uuid(), ev3: uuid(), ev4: uuid(), ev5: uuid() };
  const p = {};
  let token;
  const get = (url) => request(app).get(url).set('Authorization', `Bearer ${token}`);

  const profile = async (key, rel) => {
    const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, lala_relationship, created_at, updated_at)
      VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', :rel, NOW(), NOW()) RETURNING id`, { handle: `${key}-${tag}`, display: `${key} ${tag}`, rel });
    p[key] = row.id;
  };
  const guest = (key) => ({ profile_id: p[key], handle: `${key}-${tag}`, display_name: `${key} ${tag}` });
  const event = (id, name, { episode = null, status = 'ready', date = null, guests = [], auto = {} } = {}) => run(
    `INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, event_date, venue_name, canon_consequences, created_at, updated_at)
     VALUES (:id, :show, :name, :status, :episode, :date, :venue, CAST(:cc AS jsonb), NOW(), NOW())`,
    { id, show: ids.show, name, status, episode, date, venue: auto.venue_name ? null : 'STUDIO BY SABLE\'s Studio', cc: JSON.stringify({ automation: { guest_profiles: guests, ...auto } }) });

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-user-feed-sidebar', email: 'evoni@feed-sidebar.dev', name: 'Sidebar', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Sidebar ${tag}`, slug: `sidebar-${tag}` });
    for (const [key, num, status] of [['ep1', 1, 'draft'], ['ep2', 2, 'published'], ['ep3', 3, 'draft'], ['ep4', 4, 'draft']]) {
      await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:id, :show, :title, :num, :status, NOW(), NOW())`,
        { id: ids[key], show: ids.show, title: `Episode ${num}`, num, status });
    }
    await profile('friend', 'direct');
    for (const k of ['s1', 's2', 's3', 's4', 's5', 's6']) await profile(k, 'aware');

    await event(ids.ev1, 'Wearable Experiments Studio Session', { episode: ids.ep1, date: '2026-11-12', guests: [guest('friend'), guest('s1'), guest('s2')] });
    await event(ids.ev2, 'Already Aired Gala', { episode: ids.ep2, date: '2026-10-01', guests: [guest('s6')] });
    // Episode 3's brief names this event; its date and venue live in the automation copy.
    await event(ids.ev3, 'Rooftop Launch', { date: null, guests: [guest('s3'), guest('s4'), guest('s5'), { handle: 'no-profile' }], auto: { event_date: '2026-11-20', venue_name: 'Echo Park Rooftop' } });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, created_at, updated_at) VALUES (:id, :ep, :show, :ev, 'draft', NOW(), NOW())`,
      { id: uuid(), ep: ids.ep3, show: ids.show, ev: ids.ev3 });
    await event(ids.ev4, 'Archived Brunch', { episode: ids.ep4, status: 'archived', date: '2026-11-01' });
    await event(ids.ev5, 'Unused Invitation', { date: '2026-11-02' });
  });

  afterAll(async () => {
    await run('DELETE FROM episode_briefs WHERE show_id = :show', ids);
    await run('DELETE FROM world_events WHERE show_id = :show', ids);
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:ids)', { ids: Object.values(p) });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  it('needs a signed-in user and a show id', async () => {
    expect((await request(app).get(`/api/v1/social-profiles/lala/sidebar?show_id=${ids.show}`)).status).toBe(401);
    expect((await get('/api/v1/social-profiles/lala/sidebar?show_id=nope')).status).toBe(400);
  });

  it('upcoming: events of unpublished episodes, soonest first, with date, venue and episode', async () => {
    const res = await get(`/api/v1/social-profiles/lala/sidebar?show_id=${ids.show}`);
    expect(res.status).toBe(200);
    expect(res.body.data.upcoming).toEqual([
      expect.objectContaining({ id: ids.ev1, name: 'Wearable Experiments Studio Session', date: '2026-11-12', venue: "STUDIO BY SABLE's Studio", episode: expect.objectContaining({ id: ids.ep1, number: 1 }), guest_count: 3 }),
      expect.objectContaining({ id: ids.ev3, name: 'Rooftop Launch', date: '2026-11-20', venue: 'Echo Park Rooftop', episode: expect.objectContaining({ id: ids.ep3, number: 3 }) }),
    ]);
  });

  it('may know: guests of those events who are not her friends, up to five', async () => {
    const d = (await get(`/api/v1/social-profiles/lala/sidebar?show_id=${ids.show}`)).body.data;
    expect(d.may_know.map((x) => x.id)).toEqual([p.s1, p.s2, p.s3, p.s4, p.s5]);
    expect(d.may_know.map((x) => x.id)).not.toContain(p.friend);
    expect(d.may_know.map((x) => x.id)).not.toContain(p.s6);
  });
});
