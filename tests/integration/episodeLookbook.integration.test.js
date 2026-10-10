/**
 * The episode's Lookbook (docs/design/2026-10-landing-and-stylesheet.md
 * Part 2; Task #2812): create, read, replace and delete a Lookbook photo,
 * every route behind requireAuth and scoped to the episode, the fields
 * validated, and the Lookbook read-only while the style sheet is approved.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const sharp = require('sharp');
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
const png = (r = 200) => sharp({ create: { width: 4, height: 6, channels: 3, background: { r, g: 120, b: 160 } } }).png().toBuffer();

(shouldSkip ? describe.skip : describe)("Episode Lookbook: data and upload routes", () => {
  let token;
  const shows = [];
  const savedBuckets = {};
  const sets = [];

  beforeAll(() => {
    // No bucket in tests: uploads are stored as data URLs (the uploadPng rule).
    for (const k of ['S3_PRIMARY_BUCKET', 'AWS_S3_BUCKET']) { savedBuckets[k] = process.env[k]; delete process.env[k]; }
    token = TokenService.generateTokenPair({
      id: 'test-user-lookbook', email: 'test@lookbook.dev', name: 'Lookbook Test', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  afterAll(async () => {
    for (const [k, v] of Object.entries(savedBuckets)) if (v !== undefined) process.env[k] = v;
    for (const set of sets) {
      await run('DELETE FROM scene_angles WHERE scene_set_id = :set', { set });
      await run('DELETE FROM scene_sets WHERE id = :set', { set });
    }
    for (const show of shows) {
      await run('DELETE FROM episode_lookbook_images WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)', { show });
      await run('DELETE FROM episode_lookbooks WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)', { show });
      await run('DELETE FROM world_events WHERE show_id = :show', { show });
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
  });

  async function seed() {
    const ids = { show: uuid(), ep: uuid(), other: uuid() };
    shows.push(ids.show);
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())',
      { ...ids, name: `Lookbook ${ids.show.slice(0, 8)}`, slug: `lookbook-${ids.show.slice(0, 8)}` });
    for (const [id, n] of [[ids.ep, 1], [ids.other, 2]]) {
      await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
                 VALUES (:id, :show, 'Lookbook episode', :n, 'draft', NOW(), NOW())`, { id, n, show: ids.show });
    }
    return ids;
  }

  const auth = (req) => req.set('Authorization', `Bearer ${token}`);
  const base = (ep) => `/api/v1/episodes/${ep}/lookbook`;
  const upload = async (ep, { category, files = 1, type = 'image/png', r } = {}) => {
    let req = auth(request(app).post(`${base(ep)}/images`));
    if (category) req = req.field('category', category);
    for (let i = 0; i < files; i++) {
      req = req.attach('files', await png(r === undefined ? 200 - i : r), { filename: `look-${i}.png`, contentType: type });
    }
    return req;
  };

  it('every route needs a signed-in user', async () => {
    const ids = await seed();
    const img = uuid();
    for (const res of await Promise.all([
      request(app).get(base(ids.ep)),
      request(app).put(base(ids.ep)).send({ tagline: 'x' }),
      request(app).post(`${base(ids.ep)}/images`),
      request(app).patch(`${base(ids.ep)}/images/${img}`).send({ category: 'hero' }),
      request(app).delete(`${base(ids.ep)}/images/${img}`),
    ])) expect(res.status).toBe(401);
  });

  it('reads an empty Lookbook, created on first read: 0 of 11', async () => {
    const ids = await seed();
    const res = await auth(request(app).get(base(ids.ep)));
    expect(res.status).toBe(200);
    const lb = res.body.data;
    expect(lb.episode_id).toBe(ids.ep);
    expect(lb.sheet_status).toBe('draft');
    expect(lb.images_in).toBe(0);
    expect(lb.readiness).toEqual({ done: 0, total: 11, missing: ['front', 'side', 'back', 'hero', 'hair', 'nails', 'eyes', 'lips', 'skin', 'venue', 'inspo'] });
    const again = await auth(request(app).get(base(ids.ep)));
    expect(again.body.data.id).toBe(lb.id);
    const [[{ n }]] = await run('SELECT COUNT(*)::int AS n FROM episode_lookbooks WHERE episode_id = :ep', ids);
    expect(n).toBe(1);
  });

  it('creates: a batch lands in To sort, with its type, size and dimensions', async () => {
    const ids = await seed();
    const res = await upload(ids.ep, { files: 3 });
    expect(res.status).toBe(201);
    expect(res.body.data.images).toHaveLength(3);
    const first = res.body.data.images[0];
    expect(first).toMatchObject({ category: 'unsorted', source: 'upload', content_type: 'image/png', width: 4, height: 6, file_name: 'look-0.png' });
    expect(first.image_url).toMatch(/^data:image\/png;base64,/);
    expect(res.body.data.lookbook.images.unsorted).toHaveLength(3);
    expect(res.body.data.lookbook.readiness.done).toBe(0);
  });

  it('reads back by category and counts readiness; sorting a photo moves it', async () => {
    const ids = await seed();
    const up = await upload(ids.ep, { files: 2 });
    const [a, b] = up.body.data.images;
    const moved = await auth(request(app).patch(`${base(ids.ep)}/images/${a.id}`)).send({ category: 'hero' });
    expect(moved.status).toBe(200);
    expect(moved.body.data.image.category).toBe('hero');
    await auth(request(app).patch(`${base(ids.ep)}/images/${b.id}`)).send({ category: 'venue', sort_order: 2 });
    const res = await auth(request(app).get(base(ids.ep)));
    expect(res.body.data.images.hero.map((i) => i.id)).toEqual([a.id]);
    expect(res.body.data.images.venue.map((i) => [i.id, i.sort_order, i.in_lookbook])).toEqual([[b.id, 2, true]]);
    expect(res.body.data.readiness.done).toBe(2);
    // A venue photo toggled out of the lookbook no longer counts.
    await auth(request(app).patch(`${base(ids.ep)}/images/${b.id}`)).send({ in_lookbook: false });
    const after = await auth(request(app).get(base(ids.ep)));
    expect(after.body.data.readiness.done).toBe(1);
    expect(after.body.data.readiness.missing).toContain('venue');
  });

  it('replaces: a new photo in a single-photo spot soft-deletes the old one', async () => {
    const ids = await seed();
    const first = await upload(ids.ep, { category: 'front' });
    const second = await upload(ids.ep, { category: 'front', r: 10 });
    expect(second.status).toBe(201);
    const res = await auth(request(app).get(base(ids.ep)));
    expect(res.body.data.images.front.map((i) => i.id)).toEqual([second.body.data.images[0].id]);
    const [[old]] = await run('SELECT deleted_at FROM episode_lookbook_images WHERE id = :id', { id: first.body.data.images[0].id });
    expect(old.deleted_at).not.toBeNull();
    // Sorting a tray photo into the spot replaces it too.
    const tray = await upload(ids.ep);
    await auth(request(app).patch(`${base(ids.ep)}/images/${tray.body.data.images[0].id}`)).send({ category: 'front' });
    const now = await auth(request(app).get(base(ids.ep)));
    expect(now.body.data.images.front.map((i) => i.id)).toEqual([tray.body.data.images[0].id]);
    // A single-photo spot takes one file per upload.
    const two = await upload(ids.ep, { category: 'hair', files: 2 });
    expect(two.status).toBe(400);
  });

  it('deletes: a soft delete that removes the photo from the Lookbook', async () => {
    const ids = await seed();
    const up = await upload(ids.ep, { category: 'lips' });
    const id = up.body.data.images[0].id;
    const del = await auth(request(app).delete(`${base(ids.ep)}/images/${id}`));
    expect(del.status).toBe(200);
    expect(del.body.data.deleted).toBe(id);
    expect(del.body.data.lookbook.images.lips).toEqual([]);
    const [[row]] = await run('SELECT deleted_at FROM episode_lookbook_images WHERE id = :id', { id });
    expect(row.deleted_at).not.toBeNull();
    const again = await auth(request(app).delete(`${base(ids.ep)}/images/${id}`));
    expect(again.status).toBe(404);
  });

  it("scoped to the episode: another episode's photo is not found through this one", async () => {
    const ids = await seed();
    const mine = await upload(ids.other, { category: 'eyes' });
    const id = mine.body.data.images[0].id;
    const patch = await auth(request(app).patch(`${base(ids.ep)}/images/${id}`)).send({ category: 'hero' });
    const del = await auth(request(app).delete(`${base(ids.ep)}/images/${id}`));
    expect([patch.status, del.status]).toEqual([404, 404]);
    const res = await auth(request(app).get(base(ids.other)));
    expect(res.body.data.images.eyes.map((i) => i.id)).toEqual([id]);
    expect((await auth(request(app).get(base(ids.ep)))).body.data.images_in).toBe(0);
  });

  it('a deleted or unknown episode is 404', async () => {
    const ids = await seed();
    await run('UPDATE episodes SET deleted_at = NOW() WHERE id = :ep', ids);
    expect((await auth(request(app).get(base(ids.ep)))).status).toBe(404);
    expect((await auth(request(app).get(base(uuid())))).status).toBe(404);
    expect((await upload(ids.ep)).status).toBe(404);
  });

  it('refuses other file types and unknown spots', async () => {
    const ids = await seed();
    const gif = await auth(request(app).post(`${base(ids.ep)}/images`)).attach('files', Buffer.from('GIF89a'), { filename: 'x.gif', contentType: 'image/gif' });
    expect(gif.status).toBe(400);
    expect(gif.body.code).toBe('INVALID_TYPE');
    expect((await upload(ids.ep, { category: 'shoes' })).body.code).toBe('INVALID_CATEGORY');
    expect((await auth(request(app).post(`${base(ids.ep)}/images`))).body.code).toBe('NO_FILE');
  });

  it('key inspo holds two of her photos', async () => {
    const ids = await seed();
    expect((await upload(ids.ep, { category: 'inspo', files: 2 })).status).toBe(201);
    const third = await upload(ids.ep, { category: 'inspo' });
    expect(third.status).toBe(409);
    expect(third.body.code).toBe('INSPO_FULL');
  });

  it('saves the fields, validated, and trims them', async () => {
    const ids = await seed();
    const res = await auth(request(app).put(base(ids.ep))).send({
      hair_name: '  soft glam waves ', nails_name: 'crimson almond',
      beauty_notes: { eyes: 'bronze smoke', lips: 'crimson satin' },
      palette: [{ hex: '#b8962e', source: 'auto' }, { hex: '#E9C4D5' }],
      mood_words: ['statement', 'modern'], tagline: 'Every look tells a story.',
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      hair_name: 'soft glam waves', nails_name: 'crimson almond',
      beauty_notes: { eyes: 'bronze smoke', lips: 'crimson satin' },
      palette: [{ hex: '#B8962E', source: 'auto' }, { hex: '#E9C4D5', source: 'edited' }],
      mood_words: ['statement', 'modern'], tagline: 'Every look tells a story.',
    });
    for (const bad of [
      { palette: [{ hex: 'gold' }] },
      { palette: Array(6).fill({ hex: '#000000' }) },
      { beauty_notes: { cheeks: 'x' } },
      { tagline: 'x'.repeat(201) },
      { hair_name: 5 },
    ]) expect((await auth(request(app).put(base(ids.ep))).send(bad)).status).toBe(400);
  });

  // Task #2877: editing an approved sheet goes through and returns it to Draft.
  it('editing while the style sheet is approved returns it to Draft', async () => {
    const ids = await seed();
    const up = await upload(ids.ep, { category: 'skin' });
    const id = up.body.data.images[0].id;
    const approve = () => run("UPDATE episode_lookbooks SET sheet_status = 'approved', approved_at = NOW(), sheet_inputs_hash = :h WHERE episode_id = :ep", { ...ids, h: 'x'.repeat(64) });
    const status = async () => (await run('SELECT sheet_status, approved_at, sheet_inputs_hash FROM episode_lookbooks WHERE episode_id = :ep', ids))[0][0];
    for (const edit of [
      () => auth(request(app).put(base(ids.ep))).send({ tagline: 'new' }),
      () => upload(ids.ep),
      () => auth(request(app).patch(`${base(ids.ep)}/images/${id}`)).send({ category: 'hero' }),
      () => auth(request(app).delete(`${base(ids.ep)}/images/${id}`)),
    ]) {
      await approve();
      const res = await edit();
      expect(res.status).toBe(res.req.method === 'POST' ? 201 : 200);
      expect(await status()).toEqual({ sheet_status: 'draft', approved_at: null, sheet_inputs_hash: null });
    }
  });

  // ── Venue pre-fill (Task #2813) ──
  async function seedVenue(ids, { otherSet = false } = {}) {
    const set = uuid(); const other = uuid(); const angle = uuid(); const foreignAngle = uuid(); const event = uuid();
    sets.push(set, other);
    for (const [id, name] of [[set, 'Studio by Sable'], [other, 'Elsewhere']]) {
      await run(`INSERT INTO scene_sets (id, name, scene_type, base_still_url, created_at, updated_at)
                 VALUES (:id, :name, 'EVENT_LOCATION', :base, NOW(), NOW())`, { id, name, base: `https://cdn.example/${id}.jpg` });
    }
    await run(`INSERT INTO scene_angles (id, scene_set_id, angle_name, angle_label, still_image_url, sort_order, created_at, updated_at)
               VALUES (:angle, :set, 'wide', 'Wide', 'https://cdn.example/wide.jpg', 1, NOW(), NOW()),
                      (:foreign, :other, 'door', 'Door', 'https://cdn.example/door.jpg', 1, NOW(), NOW())`,
      { angle, set, other, foreign: foreignAngle });
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, scene_set_id, created_at, updated_at)
               VALUES (:event, :show, 'Studio Session', 'used', :ep, :set, NOW(), NOW())`, { event, show: ids.show, ep: ids.ep, set: otherSet ? other : set });
    return { set, other, angle, foreignAngle, event };
  }

  it("pre-fills Venue from the event's scene set; toggling makes a row that counts", async () => {
    const ids = await seed();
    const v = await seedVenue(ids);
    const res = await auth(request(app).get(base(ids.ep)));
    expect(res.body.data.event).toEqual({ id: v.event, name: 'Studio Session' });
    expect(res.body.data.scene_set).toEqual({ id: v.set, name: 'Studio by Sable' });
    expect(res.body.data.venue_options.map((o) => [o.source, o.ref_id, o.label, o.in_lookbook])).toEqual([
      ['scene_set_base', v.set, 'Set base', false],
      ['scene_angle', v.angle, 'Wide', false],
    ]);
    const on = await auth(request(app).put(`${base(ids.ep)}/venue`)).send({ source: 'scene_angle', ref_id: v.angle, in_lookbook: true });
    expect(on.status).toBe(200);
    const opt = on.body.data.venue_options.find((o) => o.ref_id === v.angle);
    expect(opt.in_lookbook).toBe(true);
    expect(on.body.data.images.venue.map((i) => [i.source, i.scene_angle_id, i.image_url])).toEqual([['scene_angle', v.angle, 'https://cdn.example/wide.jpg']]);
    expect(on.body.data.readiness.missing).not.toContain('venue');
    const off = await auth(request(app).put(`${base(ids.ep)}/venue`)).send({ source: 'scene_angle', ref_id: v.angle, in_lookbook: false });
    expect(off.body.data.venue_options.find((o) => o.ref_id === v.angle).in_lookbook).toBe(false);
    expect(off.body.data.images.venue).toHaveLength(1);
    expect(off.body.data.readiness.missing).toContain('venue');
  });

  it("refuses a venue image the episode's event does not offer", async () => {
    const ids = await seed();
    const v = await seedVenue(ids);
    const res = await auth(request(app).put(`${base(ids.ep)}/venue`)).send({ source: 'scene_angle', ref_id: v.foreignAngle, in_lookbook: true });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('VENUE_IMAGE_NOT_FOUND');
    expect((await auth(request(app).put(`${base(ids.ep)}/venue`)).send({ source: 'wardrobe', ref_id: v.angle, in_lookbook: true })).status).toBe(400);
  });

  it('with no event the venue list is empty', async () => {
    const ids = await seed();
    const res = await auth(request(app).get(base(ids.ep)));
    expect([res.body.data.event, res.body.data.scene_set, res.body.data.venue_options, res.body.data.texture_pieces]).toEqual([null, null, [], []]);
  });
});
