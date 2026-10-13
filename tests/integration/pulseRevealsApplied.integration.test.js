/**
 * Reveals applied in The Pulse's reads (Task #2939; The Pulse spec §5).
 * With ?at= a read honours each item's reveal at that story moment, on the
 * server, so hidden content never reaches the browser:
 * - posts: hidden left out; a teaser keeps author and time, loses words and
 *   comments, and flags its photos; a post photo's own reveal flags or
 *   removes the photos; posts and comments of characters Lala has not met
 *   yet are left out;
 * - the latest fit: a hidden fit is passed over, a teaser flagged;
 * - the sidebar: a hidden event left out, a teaser its name only; people
 *   Lala has not met yet left out; Lala's friends likewise;
 * - the cover: hidden left out, a teaser flagged;
 * - /pulse-reveals/state: the Dream Cities' image states.
 * Without ?at= (Director view) everything shows.
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

(shouldSkip ? describe.skip : describe)('The Pulse reveals applied (Task #2939)', () => {
  const tag = uuid().slice(0, 8);
  const ids = {
    show: uuid(), ep1: uuid(), ep2: uuid(), ep3: uuid(), ev2: uuid(), ev3: uuid(),
    hiddenPost: uuid(), teaserPost: uuid(), photoPost: uuid(), strangerPost: uuid(), plainPost: uuid(),
    fitTeaser: uuid(), fitHidden: uuid(),
  };
  const p = {};
  let token;
  const get = (url) => request(app).get(url).set('Authorization', `Bearer ${token}`);
  const reveal = (fields) => models.PulseReveal.create({ show_id: ids.show, source: 'set', mode: 'teaser', ...fields });

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-reveals-applied', email: 'evoni@applied.dev', name: 'Applied Test', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, CAST(:meta AS jsonb), NOW(), NOW())`,
      { show: ids.show, name: `Applied ${tag}`, slug: `applied-${tag}`, meta: JSON.stringify({ pulse_cover: { url: 'https://cdn/cover.jpg', alt: 'Night' } }) });
    // Episode 1 is published: the present is 17.
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES
      (:ep1, :show, 'One', 1, 'published', NOW(), NOW()),
      (:ep2, :show, 'Two', 2, 'draft', NOW(), NOW()),
      (:ep3, :show, 'Three', 3, 'draft', NOW(), NOW())`, ids);
    for (const [key, rel] of [['stranger', null], ['newfriend', 'direct']]) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, lala_relationship, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', :rel, NOW(), NOW()) RETURNING id`, { handle: `${key}-${tag}`, display: `${key} ${tag}`, rel });
      p[key] = row.id;
    }
    // Lala meets both at episode 2's event; episode 3's event is a secret.
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, venue_name, event_date, canon_consequences, created_at, updated_at) VALUES
      (:ev2, :show, :n2, 'used', :ep2, 'Atelier Nine', '2026-11-12', CAST(:cc AS jsonb), NOW(), NOW()),
      (:ev3, :show, :n3, 'used', :ep3, 'The Vault', '2026-12-01', '{}'::jsonb, NOW(), NOW())`,
    { ...ids, n2: `Gala ${tag}`, n3: `Secret ${tag}`, cc: JSON.stringify({ automation: { guest_profiles: [{ profile_id: p.stranger }, { profile_id: p.newfriend }] } }) });

    const post = (id, extra = {}) => run(
      `INSERT INTO feed_posts (id, show_id, poster_handle, social_profile_id, content_text, image_url, status, story_order, posted_at, created_at, updated_at)
       VALUES (:id, :show, 'lala', :prof, :text, :img, 'live', 17, NOW(), NOW(), NOW())`,
      { id, show: ids.show, prof: null, text: `words of ${id}`, img: null, ...extra });
    await post(ids.hiddenPost);
    await post(ids.teaserPost, { img: 'https://cdn/teaser.jpg' });
    await post(ids.photoPost, { img: 'https://cdn/photo.jpg' });
    await post(ids.strangerPost, { prof: p.stranger });
    await post(ids.plainPost);
    await run(`INSERT INTO feed_comments (feed_post_id, show_id, handle, text, status, social_profile_id) VALUES
      (:plain, :show, 'stranger', 'hi from later', 'live', :stranger), (:plain, :show, 'lala', 'mine', 'live', NULL),
      (:teaser, :show, 'lala', 'spoiler', 'live', NULL)`,
    { plain: ids.plainPost, teaser: ids.teaserPost, show: ids.show, stranger: p.stranger });

    await run(`INSERT INTO pulse_fits (id, show_id, image_url, caption, story_order, created_at, updated_at) VALUES
      (:fitTeaser, :show, 'https://cdn/fit-a.jpg', 'Coffee run', 17, NOW() - INTERVAL '1 day', NOW()),
      (:fitHidden, :show, 'https://cdn/fit-b.jpg', 'Gala dress', 17, NOW(), NOW())`, ids);

    await reveal({ item_type: 'post', item_id: ids.hiddenPost, event_id: ids.ev2, moment: 'during', mode: 'hidden' });
    // A teaser's image is cut once from the full one (Task #3034); here it is set directly.
    await reveal({ item_type: 'post', item_id: ids.teaserPost, episode_id: ids.ep2, moment: 'after', teaser_url: 'https://cdn/teasers/post.jpg' });
    await reveal({ item_type: 'image', image_kind: 'post_photo', item_id: ids.photoPost, moment: 'story_time', story_order: 27, teaser_style: 'blur', teaser_url: 'https://cdn/teasers/photo.jpg' });
    await reveal({ item_type: 'image', image_kind: 'fit', item_id: ids.fitTeaser, moment: 'story_time', story_order: 27, teaser_url: 'https://cdn/teasers/fit.jpg' });
    await reveal({ item_type: 'image', image_kind: 'fit', item_id: ids.fitHidden, moment: 'story_time', story_order: 27, mode: 'hidden' });
    await reveal({ item_type: 'event', item_id: ids.ev2, event_id: ids.ev2, moment: 'announced' });
    await reveal({ item_type: 'event', item_id: ids.ev3, event_id: ids.ev3, moment: 'announced', mode: 'hidden' });
    await reveal({ item_type: 'image', image_kind: 'cover', item_id: ids.show, moment: 'story_time', story_order: 27, teaser_url: 'https://cdn/teasers/cover.jpg' });
    await reveal({ item_type: 'image', image_kind: 'city', item_id: 'dazzle_district', moment: 'story_time', story_order: 27, teaser_url: 'https://cdn/teasers/dazzle.jpg' });
    await reveal({ item_type: 'image', image_kind: 'city_bubble', item_id: 'echo_park', moment: 'story_time', story_order: 27, mode: 'hidden' });
    await reveal({ item_type: 'image', image_kind: 'city', item_id: 'radiance_row', moment: 'story_time', story_order: 7 });
  });

  afterAll(async () => {
    await run('DELETE FROM pulse_reveals WHERE show_id = :show', ids);
    await run('DELETE FROM feed_comments WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_fits WHERE show_id = :show', ids);
    await run('DELETE FROM world_events WHERE show_id = :show', ids);
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: Object.values(p) });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  const byId = (res) => new Map(res.body.data.map((x) => [x.id, x]));

  it('posts: hidden ones and those of characters not met yet never arrive; a teaser has no words, comments or full photo', async () => {
    const res = await get(`/api/v1/feed-posts?show_id=${ids.show}&at=present&with=comments`);
    expect(res.status).toBe(200);
    const posts = byId(res);
    expect(posts.has(ids.hiddenPost)).toBe(false);
    expect(posts.has(ids.strangerPost)).toBe(false);
    expect(res.body.total).toBe(3);
    expect(posts.get(ids.teaserPost)).toMatchObject({ teaser: true, photo_teaser: true, content_text: null, comments: [], image_url: 'https://cdn/teasers/post.jpg', teaser_style: 'crop' });
    expect(JSON.stringify(res.body)).not.toContain(`words of ${ids.teaserPost}`);
    expect(JSON.stringify(res.body)).not.toContain('spoiler');
    expect(posts.get(ids.photoPost)).toMatchObject({ photo_teaser: true, content_text: `words of ${ids.photoPost}`, image_url: 'https://cdn/teasers/photo.jpg', teaser_style: 'blur' });
    expect(posts.get(ids.photoPost).teaser).toBeUndefined();
    // No teaser response carries the full image URL (Task #3034).
    expect(JSON.stringify(res.body)).not.toContain('https://cdn/teaser.jpg');
    expect(JSON.stringify(res.body)).not.toContain('https://cdn/photo.jpg');
    expect(posts.get(ids.plainPost).comments.map((c) => c.text)).toEqual(['mine']);
  });

  it('posts: from their moment everything shows, and without at (Director view) nothing is held back', async () => {
    let posts = byId(await get(`/api/v1/feed-posts?show_id=${ids.show}&at=ep:2:after_episode&with=comments`));
    expect(posts.size).toBe(5);
    expect(posts.get(ids.teaserPost)).toMatchObject({ content_text: `words of ${ids.teaserPost}` });
    expect(posts.get(ids.teaserPost).teaser).toBeUndefined();
    posts = byId(await get(`/api/v1/feed-posts?show_id=${ids.show}&with=comments`));
    expect(posts.size).toBe(5);
    expect(posts.get(ids.plainPost).comments).toHaveLength(2);
  });

  it('the latest fit passes over a hidden fit; a teaser sends its teaser image, not the fit or its caption', async () => {
    let res = await get(`/api/v1/pulse-fits/latest?show_id=${ids.show}`);
    expect(res.body.latest).toMatchObject({ source: 'fit', image_url: 'https://cdn/teasers/fit.jpg', teaser: true, teaser_style: 'crop', caption: null });
    expect(JSON.stringify(res.body)).not.toContain('https://cdn/fit-a.jpg');
    expect(JSON.stringify(res.body)).not.toContain('Coffee run');
    res = await get(`/api/v1/pulse-fits/latest?show_id=${ids.show}&at=27`);
    expect(res.body.latest).toMatchObject({ image_url: 'https://cdn/fit-b.jpg' });
    expect(res.body.latest.teaser).toBeUndefined();
  });

  it('the sidebar: a hidden event never arrives, a teaser is its name only; people not met yet are left out', async () => {
    let res = await get(`/api/v1/social-profiles/lala/sidebar?show_id=${ids.show}&at=present`);
    expect(res.status).toBe(200);
    expect(res.body.data.upcoming).toEqual([expect.objectContaining({ id: ids.ev2, name: `Gala ${tag}`, venue: null, date: null, teaser: true })]);
    expect(JSON.stringify(res.body)).not.toContain('Atelier Nine');
    expect(JSON.stringify(res.body)).not.toContain(`Secret ${tag}`);
    expect(res.body.data.may_know.map((x) => x.id)).not.toContain(p.stranger);

    res = await get(`/api/v1/social-profiles/lala/sidebar?show_id=${ids.show}`);
    expect(res.body.data.upcoming.map((e) => e.name).sort()).toEqual([`Gala ${tag}`, `Secret ${tag}`]);
    expect(res.body.data.may_know.map((x) => x.id)).toContain(p.stranger);
  });

  it("Lala's friends leave out a friend she has not met yet", async () => {
    const ids_ = async (q) => (await get(`/api/v1/social-profiles/lala?show_id=${ids.show}&friends=all${q}`)).body.data.friends.list.map((f) => f.id);
    expect(await ids_('&at=present')).not.toContain(p.newfriend);
    expect(await ids_('&at=27')).toContain(p.newfriend);
    expect(await ids_('')).toContain(p.newfriend);
    expect((await get(`/api/v1/social-profiles/lala?show_id=${ids.show}&at=soon`)).status).toBe(400);
  });

  it('the cover sends its teaser image before its moment; the cities report their image states and teaser images', async () => {
    let res = await get(`/api/v1/shows/${ids.show}/pulse-cover?at=present`);
    expect(res.body.cover).toMatchObject({ url: 'https://cdn/teasers/cover.jpg', teaser: true, teaser_style: 'crop', alt: '' });
    expect(JSON.stringify(res.body)).not.toContain('https://cdn/cover.jpg');
    res = await get(`/api/v1/shows/${ids.show}/pulse-cover`);
    expect(res.body.cover.teaser).toBeUndefined();
    await models.PulseReveal.update({ mode: 'hidden' }, { where: { show_id: ids.show, image_kind: 'cover' } });
    expect((await get(`/api/v1/shows/${ids.show}/pulse-cover?at=present`)).body.cover).toBeNull();

    res = await get(`/api/v1/pulse-reveals/state?show_id=${ids.show}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ at: 17, cities: { 'city:dazzle_district': 'teaser', 'city_bubble:echo_park': 'hidden' } });
    expect(res.body.teasers).toEqual({ 'city:dazzle_district': 'https://cdn/teasers/dazzle.jpg' });
    expect(res.body.cities['city:radiance_row']).toBeUndefined();
  });
});
