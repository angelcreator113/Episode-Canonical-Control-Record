/**
 * Deliverables that check themselves (services/deliverableProgress, migration
 * 20261019140000-deliverable-posts; Evoni, 2026-10-19), through the routes:
 *   - a post is linked by hand to a deliverable of its format, once; another
 *     format or a second deliverable is refused
 *   - "Pulse stories: 2 of 3", then done; the deal's deliverables all done
 *   - a post taken down stops counting; unlinking takes it off
 *   - suggestions rank the post naming the brand first
 *   - the daily update lists the deal done, and a deal going public with
 *     deliverables left
 *   - writes are ADMIN only; the migration's down drops only its table
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');
const migration = require('../../src/migrations/20261019140000-deliverable-posts');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });

(shouldSkip ? describe.skip : describe)('Deliverables that check themselves', () => {
  const tag = uuid().slice(0, 8);
  const ids = {
    show: uuid(), event: uuid(), event2: uuid(), opp: uuid(), opp2: uuid(),
    stories: uuid(), video: uuid(), bio: uuid(), later: uuid(),
    s1: uuid(), s2: uuid(), s3: uuid(), s4: uuid(), v1: uuid(), p1: uuid(),
  };
  let admin;
  let user;
  const as = (req, token = admin) => req.set('Authorization', `Bearer ${token}`);
  const base = '/api/v1/deliverable-progress';
  const linkPost = (deliverable, post, token) => as(request(app).post(`${base}/deliverables/${deliverable}/posts`), token).send({ post_id: post });
  const line = (body, id) => body.deliverables.find((d) => d.id === id).line;

  beforeAll(async () => {
    admin = TokenService.generateTokenPair({ id: 'test-admin-deliv', email: 'evoni@deliv.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    user = TokenService.generateTokenPair({ id: 'test-user-deliv', email: 'u@deliv.dev', name: 'U', groups: ['USER'], role: 'USER' }).accessToken;
    const today = new Date().toISOString().slice(0, 10);
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Deliv ${tag}`, slug: `deliv-${tag}` });
    await run(`INSERT INTO world_events (id, show_id, name, created_at, updated_at) VALUES (:event, :show, 'Velour Gala', NOW(), NOW()),
               (:event2, :show, 'Aura launch', NOW(), NOW())`, ids);
    await run(`INSERT INTO opportunities (id, show_id, name, opportunity_type, status, brand_or_company, event_id, publish_date, created_at, updated_at)
               VALUES (:opp, :show, 'Velour cover', 'brand_deal', 'booked', 'Velour Atelier', :event, NULL, NOW(), NOW()),
                      (:opp2, :show, 'Aura launch', 'brand_deal', 'booked', 'Aura', :event2, :today, NOW(), NOW())`, { ...ids, today });
    await run(`INSERT INTO event_deliverables (id, event_id, description, deliverable_type, quantity, created_at, updated_at) VALUES
               (:stories, :event, '3 Pulse stories', 'pulse_stories', 3, NOW(), NOW()),
               (:video, :event, '1 Pulse video', 'pulse_video', 1, NOW(), NOW()),
               (:bio, :event, 'Link in bio', 'link_in_bio', 7, NOW(), NOW()),
               (:later, :event2, '1 Pulse post', 'pulse_post', 1, NOW(), NOW())`, ids);
    const post = (id, format, text, status = 'live') => run(`INSERT INTO feed_posts (id, show_id, poster_handle, content_text, status, post_format, posted_at, created_at, updated_at)
      VALUES (:id, :show, '@lala', :text, :status, :format, NOW(), NOW(), NOW())`, { id, show: ids.show, text, status, format });
    await post(ids.s1, 'story', 'getting ready for the gala');
    await post(ids.s2, 'story', 'a quiet morning');
    await post(ids.s3, 'story', 'in Velour Atelier tonight');
    await post(ids.s4, 'story', 'one more');
    await post(ids.v1, 'video', 'the Velour Atelier look, start to finish');
    await post(ids.p1, 'post', 'a post, not a story');
  });

  afterAll(async () => {
    await run('DELETE FROM deliverable_posts WHERE deliverable_id IN (:d)', { d: [ids.stories, ids.video, ids.bio, ids.later] }).catch((err) => console.error('cleanup', err.message));
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM event_deliverables WHERE event_id IN (:event, :event2)', ids);
    await run('DELETE FROM opportunities WHERE id IN (:opp, :opp2)', ids);
    await run('DELETE FROM world_events WHERE id IN (:event, :event2)', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  it('linking is ADMIN only; a post of another format, or one already counting elsewhere, is refused', async () => {
    expect((await linkPost(ids.stories, ids.s1, user)).status).toBe(403);
    expect((await as(request(app).get(`${base}/deliverables/${ids.stories}/suggestions`), user)).status).toBe(403);
    expect((await linkPost(ids.stories, ids.p1)).status).toBe(409);
    expect((await linkPost(ids.bio, ids.p1)).status).toBe(409);
    expect((await linkPost(ids.stories, ids.s1)).status).toBe(200);
    expect((await linkPost(ids.later, ids.s1)).status).toBe(409);
  });

  it('suggestions put the story naming the brand first, and leave out what already counts', async () => {
    const res = await as(request(app).get(`${base}/deliverables/${ids.stories}/suggestions`));
    expect(res.body.format).toBe('story');
    expect(res.body.posts[0].id).toBe(ids.s3);
    expect(res.body.posts.map((p) => p.id)).not.toContain(ids.s1);
    expect(res.body.posts.map((p) => p.id)).not.toContain(ids.p1);
  });

  it('"Pulse stories: 2 of 3", then done; with the video the deal\'s deliverables are all done', async () => {
    const two = await linkPost(ids.stories, ids.s3);
    expect(line(two.body, ids.stories)).toBe('Pulse stories: 2 of 3');
    expect(two.body.all_done).toBe(false);
    await linkPost(ids.stories, ids.s2);
    const done = await linkPost(ids.video, ids.v1);
    expect(done.body.deliverables.find((d) => d.id === ids.stories)).toMatchObject({ done: true, line: 'Pulse stories: 3 of 3' });
    expect(done.body).toMatchObject({ countable: 2, done: 2, all_done: true });
    expect(done.body.deliverables.find((d) => d.id === ids.bio)).toMatchObject({ countable: false, line: null });

    const viaDeal = await as(request(app).get(`${base}/opportunities/${ids.opp}`), user);
    expect(viaDeal.body).toMatchObject({ opportunity_id: ids.opp, all_done: true });
    const brand = await as(request(app).get(`${base}/brands?name=velour atelier`));
    expect(brand.body.deals.map((d) => d.opportunity_id)).toEqual([ids.opp]);

    const post = await as(request(app).get(`${base}/posts/${ids.s4}`));
    expect(post.body.counts_toward).toBeNull();
    expect(post.body.open).toEqual([]);
    const counted = await as(request(app).get(`${base}/posts/${ids.s3}`));
    expect(counted.body.counts_toward).toMatchObject({ deliverable_id: ids.stories, name: 'Velour cover · Pulse stories' });
  });

  it('the daily update lists the deal done, and a deal going public with a deliverable left', async () => {
    const res = await as(request(app).get('/api/v1/daily-update'));
    expect(res.status).toBe(200);
    expect(res.body.since_yesterday.deals_done.find((d) => d.id === ids.opp)).toMatchObject({ brand: 'Velour Atelier', lines: ['Pulse stories: 3 of 3', 'Pulse video: 1 of 1'] });
    expect(res.body.coming_up.deliverables_due.find((d) => d.id === ids.opp2)).toMatchObject({ brand: 'Aura', left: ['Pulse post: 0 of 1'] });
  });

  it('a post taken down stops counting; unlinking takes it off', async () => {
    await run("UPDATE feed_posts SET status = 'draft' WHERE id = :s2", ids);
    const read = await as(request(app).get(`${base}/events/${ids.event}`));
    expect(line(read.body, ids.stories)).toBe('Pulse stories: 2 of 3');
    expect(read.body.all_done).toBe(false);
    expect(read.body.deliverables.find((d) => d.id === ids.stories).posts.find((p) => p.id === ids.s2).counts).toBe(false);

    expect((await as(request(app).delete(`${base}/deliverables/${ids.stories}/posts/${ids.s3}`), user)).status).toBe(403);
    const off = await as(request(app).delete(`${base}/deliverables/${ids.stories}/posts/${ids.s3}`));
    expect(line(off.body, ids.stories)).toBe('Pulse stories: 1 of 3');
    expect((await as(request(app).delete(`${base}/deliverables/${ids.stories}/posts/${ids.s3}`))).status).toBe(404);
  });

  it('the migration\'s down drops only its table, and up brings it back', async () => {
    await run('DELETE FROM deliverable_posts WHERE deliverable_id IN (:d)', { d: [ids.stories, ids.video, ids.bio, ids.later] });
    await migration.down(sequelize.getQueryInterface());
    const [gone] = await q("SELECT to_regclass('public.deliverable_posts') AS t");
    expect(gone.t).toBeNull();
    const [still] = await q("SELECT to_regclass('public.event_deliverables') AS t");
    expect(still.t).toBe('event_deliverables');
    await migration.up(sequelize.getQueryInterface());
    const [back] = await q("SELECT to_regclass('public.deliverable_posts') AS t");
    expect(back.t).toBe('deliverable_posts');
  });
});
