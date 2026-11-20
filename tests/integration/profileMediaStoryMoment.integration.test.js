/**
 * A profile's pinned posts, Tagged pictures and Highlights keep to the story's
 * release (Evoni's approval of 2026-11-15, scope D), against the test database.
 *
 * GET /api/v1/pulse-follows/profile/:handle/media took no story moment at all,
 * so a later episode's pictures showed on a profile at once. The moment a
 * reader reads at is now the server's to decide (services/storyClock readerAt):
 * never later than the present for anyone but an ADMIN, whatever is sent.
 *
 * The show has episode 1 published and episode 2 not, so the present is after
 * episode 1. Maren is the profile; Nia posts pictures with Maren in them.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const media = require('../../src/services/mediaLibrary');
const clock = require('../../src/services/storyClock');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

(shouldSkip ? describe.skip : describe)('a profile\'s pictures and the story\'s release', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const HANDLE = `maren.${tag}`;
  const uuid = () => crypto.randomUUID();
  const ids = { show: uuid(), other: uuid(), ep1: uuid(), ep2: uuid(), otherEp: uuid(), reg: uuid(), maren: uuid() };
  const post = {}; const asset = {}; const tokens = {};
  let marenPid; let niaPid;
  let ipN = 0;
  const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
  const url = (name) => `https://img.test/${name}-${tag}.png`;
  const EARLY = clock.orderOf(1, 'during_episode');
  const LATER = clock.orderOf(2, 'during_episode');
  const read = async (who, qs = '') => {
    ipN += 1;
    const r = request(app).get(`/api/v1/pulse-follows/profile/${HANDLE}/media${qs}`).set('X-Forwarded-For', `198.51.130.${(ipN % 200) + 1}`);
    return tokens[who] ? r.set('Authorization', `Bearer ${tokens[who]}`) : r;
  };
  const shape = (res) => ({
    pinned: res.body.data.pinned,
    tagged: res.body.data.tagged.map((t) => t.url).sort(),
    highlights: res.body.data.highlights.flatMap((h) => h.photos.map((p) => p.url)).sort(),
    counts: res.body.data.highlights.map((h) => h.count),
  });

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@moment.dev`, name: id, groups, role }).accessToken;
    tokens.viewer = token(`viewer-${tag}`, ['viewer'], 'USER');
    tokens.editor = token(`editor-${tag}`, ['USER', 'EDITOR'], 'USER');
    tokens.admin = token(`admin-${tag}`, ['ADMIN'], 'ADMIN');
    for (const [id, name] of [[ids.show, 'Moment'], [ids.other, 'Elsewhere']]) {
      await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :name, :slug, NOW(), NOW())', { id, name: `${name} ${tag}`, slug: `${name.toLowerCase()}-${tag}` });
    }
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES
                 (:ep1, :show, 'One', 1, 'published', NOW(), NOW()), (:ep2, :show, 'Two', 2, 'draft', NOW(), NOW()),
                 (:otherEp, :other, 'Other one', 1, 'published', NOW(), NOW())`, ids);
    const profile = async (h, name) => (await run(
      `INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, display_name, created_at, updated_at)
       VALUES (:h, 'pulse', 'Posts.', 'lalaverse', :name, NOW(), NOW()) RETURNING id`, { h, name }))[0][0].id;
    marenPid = await profile(HANDLE, `Maren ${tag}`);
    niaPid = await profile(`nia.${tag}`, `Nia ${tag}`);
    await run('INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, :t, :show, NOW(), NOW())', { ...ids, t: `Moment ${tag}` });
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, feed_profile_id, depth_level, created_at, updated_at)
               VALUES (:maren, :reg, :key, :name, :pid, 'active', NOW(), NOW())`, { ...ids, key: `maren-${tag}`, name: `Maren ${tag}`, pid: marenPid });

    const makePost = async (name, { by, show = ids.show, order, pinned = false }) => {
      post[name] = uuid();
      await run(`INSERT INTO feed_posts (id, show_id, social_profile_id, poster_handle, content_text, status, story_order, posted_at, pinned_at, created_at, updated_at)
                 VALUES (:id, :show, :by, :h, :text, 'live', :order, NOW(), ${pinned ? 'NOW()' : 'NULL'}, NOW(), NOW())`,
      { id: post[name], show, by, h: by === marenPid ? HANDLE : `nia.${tag}`, text: `${name} ${tag}`, order });
    };
    // Maren's own pinned posts, early and later.
    await makePost('pinEarly', { by: marenPid, order: EARLY, pinned: true });
    await makePost('pinLater', { by: marenPid, order: LATER, pinned: true });
    await makePost('pinHidden', { by: marenPid, order: EARLY, pinned: true });
    // Nia's posts with Maren pictured: early, later, hidden until later, a first look until later, and one in another show.
    for (const [name, show, order] of [['tagEarly', ids.show, EARLY], ['tagLater', ids.show, LATER], ['tagHidden', ids.show, EARLY], ['tagTeaser', ids.show, EARLY], ['tagElsewhere', ids.other, EARLY]]) {
      await makePost(name, { by: niaPid, show, order });
      const made = await media.createAsset(models, { url: url(name), status: 'approved', visibility: 'public', links: [
        { entity_type: 'character', entity_id: ids.maren, role: 'pictured' }, { entity_type: 'post', entity_id: post[name] }] });
      asset[name] = made.asset.id;
    }
    // Maren's camera-roll photos: one carried by an early post of hers, one by a later post, one by no post.
    await makePost('rollEarly', { by: marenPid, order: EARLY });
    await makePost('rollLater', { by: marenPid, order: LATER });
    for (const [name, carriedBy] of [['hiEarly', 'rollEarly'], ['hiLater', 'rollLater'], ['hiUnposted', null]]) {
      const made = await media.createAsset(models, {
        url: url(name), status: 'approved', visibility: 'public', generation: { camera_roll: { album: 'everyday', purpose: 'posted' } },
        links: [{ entity_type: 'character', entity_id: ids.maren, role: 'pictured' }, ...(carriedBy ? [{ entity_type: 'post', entity_id: post[carriedBy] }] : [])],
      });
      asset[name] = made.asset.id;
    }
    // Reveals: one post hidden, one a first look, one pinned post hidden, each until the later moment.
    const reveal = (name, mode) => run(
      `INSERT INTO pulse_reveals (id, show_id, item_type, item_id, moment, story_order, mode, source, teaser_style, created_at, updated_at)
       VALUES (:id, :show, 'post', :item, 'story_time', :order, :mode, 'set', 'crop', NOW(), NOW())`,
      { id: uuid(), show: ids.show, item: post[name], order: LATER, mode });
    await reveal('tagHidden', 'hidden');
    await reveal('tagTeaser', 'teaser');
    await reveal('pinHidden', 'hidden');
  });

  afterAll(async () => {
    const shows = [ids.show, ids.other];
    await run('DELETE FROM pulse_reveals WHERE show_id IN (:shows)', { shows });
    await run('DELETE FROM media_asset_links WHERE asset_id IN (:a)', { a: Object.values(asset) });
    await run('DELETE FROM media_assets WHERE id IN (:a)', { a: Object.values(asset) });
    await run('DELETE FROM feed_posts WHERE show_id IN (:shows)', { shows });
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:p)', { p: [marenPid, niaPid] });
    await run('DELETE FROM episodes WHERE show_id IN (:shows)', { shows });
    await run('DELETE FROM shows WHERE id IN (:shows)', { shows });
  });

  const PRESENT = { pinned: [expect.any(String)], tagged: [url('tagEarly')], highlights: [url('hiEarly')], counts: [1] };

  test('readerAt: an ADMIN reads as asked; anyone else never later than the present', async () => {
    const present = await clock.presentOrder(models, ids.show);
    expect(present).toBe(clock.orderOf(1, 'after_episode'));
    expect(await clock.readerAt(models, ids.show, undefined, { admin: true })).toBeUndefined();
    expect(await clock.readerAt(models, ids.show, String(LATER), { admin: true })).toBe(LATER);
    expect(await clock.readerAt(models, ids.show, undefined)).toBe(present);
    expect(await clock.readerAt(models, ids.show, 'present')).toBe(present);
    expect(await clock.readerAt(models, ids.show, String(LATER))).toBe(present);
    expect(await clock.readerAt(models, ids.show, 'ep:9:week_later')).toBe(present);
    expect(await clock.readerAt(models, ids.show, 'ep:1:before_episode')).toBe(clock.orderOf(1, 'before_episode'));
    await expect(clock.readerAt(models, ids.show, 'soon')).rejects.toMatchObject({ status: 400 });
  });

  describe.each(['viewer', 'editor'])('%s', (who) => {
    test('at the present: the early pictures only; nothing later, hidden, a first look, unposted or from another show', async () => {
      const res = await read(who, `?show_id=${ids.show}&at=present`);
      expect(res.status).toBe(200);
      expect(shape(res)).toEqual(PRESENT);
      expect(res.body.data.pinned).toEqual([post.pinEarly]);
      const raw = JSON.stringify(res.body);
      for (const name of ['tagLater', 'tagHidden', 'tagTeaser', 'tagElsewhere', 'hiLater', 'hiUnposted']) expect(raw).not.toContain(url(name));
      for (const name of ['pinLater', 'pinHidden', 'tagLater', 'rollLater']) expect(raw).not.toContain(post[name]);
    });

    test('the moment cannot be got past: left out, set later or set far later, it reads as the present', async () => {
      for (const qs of [`?show_id=${ids.show}`, `?show_id=${ids.show}&at=${LATER}`, `?show_id=${ids.show}&at=ep:2:week_later`, `?show_id=${ids.show}&at=ep:99:week_later`, `?show_id=${ids.show}&at=`]) {
        const res = await read(who, qs);
        expect([qs, res.status]).toEqual([qs, 200]);
        expect([qs, shape(res)]).toEqual([qs, PRESENT]);
      }
    });

    test('an earlier moment shows less, never more', async () => {
      const res = await read(who, `?show_id=${ids.show}&at=ep:1:before_episode`);
      expect(res.status).toBe(200);
      expect(shape(res)).toEqual({ pinned: [], tagged: [], highlights: [], counts: [] });
    });

    test('with no show there is no present to read at: nothing is shown', async () => {
      const res = await read(who, '');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ pinned: [], tagged: [], highlights: [] });
    });

    test('another show\'s pictures stay in that show', async () => {
      const res = await read(who, `?show_id=${ids.other}`);
      expect(res.status).toBe(200);
      expect(shape(res)).toEqual({ pinned: [], tagged: [url('tagElsewhere')], highlights: [], counts: [] });
    });

    test('a moment that cannot be read, or a show id that is not one, is a 400', async () => {
      expect((await read(who, `?show_id=${ids.show}&at=soon`)).status).toBe(400);
      expect((await read(who, '?show_id=not-a-show')).status).toBe(400);
    });
  });

  test('no token: 401', async () => {
    expect((await read('anon', `?show_id=${ids.show}`)).status).toBe(401);
  });

  describe('an ADMIN', () => {
    test('with no moment reads everything, as before (the director\'s view)', async () => {
      for (const qs of ['', `?show_id=${ids.show}`]) {
        const res = await read('admin', qs);
        expect(res.status).toBe(200);
        const got = shape(res);
        expect(got.tagged).toEqual(expect.arrayContaining(['tagEarly', 'tagLater', 'tagHidden', 'tagTeaser'].map(url)));
        expect(got.highlights).toEqual(['hiEarly', 'hiLater', 'hiUnposted'].map(url).sort());
        expect(got.counts).toEqual([3]);
        expect(res.body.data.pinned.sort()).toEqual([post.pinEarly, post.pinLater, post.pinHidden].sort());
      }
    });

    test('can preview a later moment: what is released by then shows, the reveals lifted', async () => {
      const res = await read('admin', `?show_id=${ids.show}&at=${LATER}`);
      expect(res.status).toBe(200);
      const got = shape(res);
      expect(got.tagged).toEqual(['tagEarly', 'tagLater', 'tagHidden', 'tagTeaser'].map(url).sort());
      expect(got.highlights).toEqual(['hiEarly', 'hiLater'].map(url).sort());
      expect(got.counts).toEqual([2]);
      expect(res.body.data.pinned.sort()).toEqual([post.pinEarly, post.pinLater, post.pinHidden].sort());
    });

    test('at the present reads what a viewer reads there', async () => {
      expect(shape(await read('admin', `?show_id=${ids.show}&at=present`))).toEqual(PRESENT);
    });
  });
});
