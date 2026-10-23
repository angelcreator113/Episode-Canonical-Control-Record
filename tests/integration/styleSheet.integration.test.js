/**
 * The episode's style sheet (docs/design/2026-10-landing-and-stylesheet.md
 * Part 2; Task #2814), checked against the spec's Episode 1 reference
 * values: the real event, host, dress code, time, vibe, venue and city, the
 * saved pieces in their columns, Body "Needed", nothing invented; images
 * inlined as data URLs; Approve and Reopen; read-only while approved.
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

(shouldSkip ? describe.skip : describe)('Episode style sheet', () => {
  let token;
  const shows = [];
  const cleanup = { profiles: [], locations: [] };
  const savedBuckets = {};
  let dataPng;

  beforeAll(async () => {
    for (const k of ['S3_PRIMARY_BUCKET', 'AWS_S3_BUCKET']) { savedBuckets[k] = process.env[k]; delete process.env[k]; }
    token = TokenService.generateTokenPair({
      id: 'test-user-sheet', email: 'evoni@sheet.dev', name: 'Sheet Test', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    const buf = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 160, g: 20, b: 40 } } }).jpeg().toBuffer();
    dataPng = `data:image/jpeg;base64,${buf.toString('base64')}`;
  });

  afterAll(async () => {
    for (const [k, v] of Object.entries(savedBuckets)) if (v !== undefined) process.env[k] = v;
    for (const show of shows) {
      await run('DELETE FROM episode_lookbook_images WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)', { show });
      await run('DELETE FROM episode_character_poses WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)', { show });
      await run('DELETE FROM episode_lookbooks WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)', { show });
      await run('DELETE FROM episode_wardrobe WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)', { show });
      await run('DELETE FROM wardrobe WHERE show_id = :show', { show });
      await run('DELETE FROM world_events WHERE show_id = :show', { show });
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
    for (const id of cleanup.profiles) await run('DELETE FROM social_profiles WHERE id = :id', { id });
    for (const id of cleanup.locations) await run('DELETE FROM world_locations WHERE id = :id', { id });
  });

  const auth = (req) => req.set('Authorization', `Bearer ${token}`);
  const sheetUrl = (ep) => `/api/v1/episodes/${ep}/style-sheet`;

  // Episode 1's reference values (spec Part 2).
  async function seedEpisodeOne() {
    const ids = { show: uuid(), ep: uuid(), event: uuid(), loc: uuid() };
    shows.push(ids.show);
    cleanup.locations.push(ids.loc);
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())',
      { ...ids, name: `Sheet ${ids.show.slice(0, 8)}`, slug: `sheet-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Wearable Experiments', 1, 'draft', NOW(), NOW())`, ids);
    const [[profile]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, created_at, updated_at)
               VALUES (:handle, 'instagram', 'A studio.', 'STUDIO BY SABLE', NOW(), NOW()) RETURNING id`, { handle: `sable_${ids.show.slice(0, 6)}` });
    cleanup.profiles.push(profile.id);
    await run(`INSERT INTO world_locations (id, name, city, district, created_at, updated_at)
               VALUES (:loc, 'STUDIO BY SABLE''s Studio', 'LalaVerse', 'Echo Park', NOW(), NOW())`, ids);
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, source_profile_id, format, dress_code,
                 dress_code_keywords, event_date, event_time, venue_name, venue_location_id, created_at, updated_at)
               VALUES (:event, :show, 'Wearable Experiments Studio Session', 'used', :ep, :profile, 'Studio session',
                 'elevated contemporary, smart-casual', CAST(:kw AS jsonb), 'Thu, Nov 12', '6:30 PM',
                 'STUDIO BY SABLE''s Studio', :loc, NOW(), NOW())`,
      { ...ids, profile: profile.id, kw: JSON.stringify(['statement', 'modern', 'elevated', 'sophisticated', 'creative']) });
    const pump = await models.Wardrobe.create({ name: 'Crimson Satin Ballerina Pump', clothing_category: 'shoes', show_id: ids.show, s3_url: dataPng });
    const studs = await models.Wardrobe.create({ name: 'Crimson Bloom Enamel Stud Earrings', clothing_category: 'jewelry', show_id: ids.show });
    for (const w of [pump, studs]) {
      await run(`INSERT INTO episode_wardrobe (id, episode_id, wardrobe_id, approval_status, created_at, updated_at)
                 VALUES (:id, :ep, :w, 'pending', NOW(), NOW())`, { id: uuid(), ep: ids.ep, w: w.id });
    }
    return ids;
  }

  it('every route needs a signed-in user', async () => {
    const ids = await seedEpisodeOne();
    for (const res of await Promise.all([
      request(app).get(sheetUrl(ids.ep)),
      request(app).post(`${sheetUrl(ids.ep)}/approve`),
      request(app).post(`${sheetUrl(ids.ep)}/reopen`),
    ])) expect(res.status).toBe(401);
  });

  it('Episode 1 renders with its real event, venue and pieces; Body is Needed', async () => {
    const ids = await seedEpisodeOne();
    const res = await auth(request(app).get(sheetUrl(ids.ep)));
    expect(res.status).toBe(200);
    const s = res.body.data;
    expect(s.episode).toMatchObject({ number: 1, label: 'EPISODE 01' });
    expect(s.event).toMatchObject({
      name: 'Wearable Experiments Studio Session',
      host: 'STUDIO BY SABLE',
      type: 'Studio session',
      dress_code: 'elevated contemporary, smart-casual',
      when: 'Thu, Nov 12, 6:30 PM',
      vibe: 'statement, modern, elevated, sophisticated, creative',
    });
    expect(s.venue).toMatchObject({ name: "STUDIO BY SABLE's Studio", chip: 'Echo Park' });
    const col = Object.fromEntries(s.wardrobe.columns.map((c) => [c.key, c]));
    expect(s.wardrobe.columns.map((c) => c.label)).toEqual(['BODY', 'SHOES', 'BAG', 'JEWELRY', 'HAIR', 'PERFUME', 'NAILS']);
    expect(col.shoes).toMatchObject({ name: 'Crimson Satin Ballerina Pump', needed: false });
    expect(col.shoes.image).toMatch(/^data:image\/jpeg;base64,/);
    expect(col.jewelry).toMatchObject({ name: 'Crimson Bloom Enamel Stud Earrings', image: null, needed: false });
    expect(col.body).toMatchObject({ name: null, image: null, needed: true });
    // Not required and empty: blank, never invented, never "Needed".
    for (const k of ['bag', 'hair', 'perfume', 'nails']) expect(col[k]).toMatchObject({ name: null, image: null, needed: false });
    expect(s.mood_words).toEqual(['statement', 'modern', 'elevated', 'sophisticated', 'creative']);
    expect(s.palette_sources).toHaveLength(1);
    expect(s.tagline).toBeNull();
    expect(s.status).toBe('draft');
    expect(s.cost_usd).toBe(0);
    const row = Object.fromEntries(s.rows.map((r) => [r.key, r]));
    expect(row.wardrobe).toMatchObject({ state: 'partial', detail: 'Needed: Body' });
    expect(row.event.state).toBe('ready');
  });

  it('with no event nothing is invented: the event, venue and city are empty', async () => {
    const ids = await seedEpisodeOne();
    await run('UPDATE world_events SET used_in_episode_id = NULL WHERE id = :event', ids);
    await run('DELETE FROM episode_wardrobe WHERE episode_id = :ep', ids);
    const s = (await auth(request(app).get(sheetUrl(ids.ep)))).body.data;
    expect(s.event).toBeNull();
    expect(s.venue).toMatchObject({ name: null, chip: null, image: null });
    expect(s.mood_words).toEqual([]);
    expect(s.rows.find((r) => r.key === 'event').state).toBe('missing');
  });

  it('Lookbook values print: hair and nails names, the look photos, tagline', async () => {
    const ids = await seedEpisodeOne();
    await auth(request(app).put(`/api/v1/episodes/${ids.ep}/lookbook`)).send({ hair_name: 'soft glam waves', tagline: 'Every look tells a story.' });
    const png = await sharp({ create: { width: 4, height: 4, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 0.5 } } }).png().toBuffer();
    await auth(request(app).post(`/api/v1/episodes/${ids.ep}/lookbook/images`)).field('category', 'hero').attach('files', png, { filename: 'hero.png', contentType: 'image/png' });
    const s = (await auth(request(app).get(sheetUrl(ids.ep)))).body.data;
    expect(s.hair_name).toBe('soft glam waves');
    expect(s.wardrobe.columns.find((c) => c.key === 'hair').name).toBe('soft glam waves');
    expect(s.tagline).toBe('Every look tells a story.');
    expect(s.look.hero).toMatch(/^data:image\/png;base64,/);
    expect(s.look.front).toBeNull();
  });

  it('Approve saves the status, who and when; an edit returns it to Draft; Reopen returns it to Draft', async () => {
    const ids = await seedEpisodeOne();
    const approved = await auth(request(app).post(`${sheetUrl(ids.ep)}/approve`));
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('approved');
    expect(approved.body.data.stale).toBe(false);
    const [[row]] = await run('SELECT sheet_status, approved_by, approved_at, sheet_inputs_hash FROM episode_lookbooks WHERE episode_id = :ep', ids);
    expect(row.sheet_status).toBe('approved');
    expect(row.approved_by).toBe('evoni@sheet.dev');
    expect(row.approved_at).not.toBeNull();
    expect(row.sheet_inputs_hash).toHaveLength(64);
    expect((await auth(request(app).post(`${sheetUrl(ids.ep)}/approve`))).status).toBe(409);
    // The canon changes under it: the approval is marked out of date.
    await run("UPDATE world_events SET dress_code = 'black tie' WHERE id = :event", ids);
    expect((await auth(request(app).get(sheetUrl(ids.ep)))).body.data.stale).toBe(true);
    const reopened = await auth(request(app).post(`${sheetUrl(ids.ep)}/reopen`));
    expect(reopened.body.data.status).toBe('draft');
    expect((await auth(request(app).put(`/api/v1/episodes/${ids.ep}/lookbook`)).send({ tagline: 'x' })).status).toBe(200);
    // Approved again, then edited: the edit goes through and the sheet is a Draft again (Task #2877).
    expect((await auth(request(app).post(`${sheetUrl(ids.ep)}/approve`))).status).toBe(200);
    expect((await auth(request(app).put(`/api/v1/episodes/${ids.ep}/lookbook`)).send({ tagline: 'y' })).status).toBe(200);
    expect((await auth(request(app).get(sheetUrl(ids.ep)))).body.data.status).toBe('draft');
  });

  it('readiness: the 12 chips, computed on the server (Task #2877)', async () => {
    const ids = await seedEpisodeOne();
    const s = (await auth(request(app).get(sheetUrl(ids.ep)))).body.data;
    expect(s.readiness.total).toBe(12);
    expect(s.readiness.items.map((i) => i.key)).toEqual(['front', 'side', 'back', 'hero', 'hair', 'nails', 'beauty', 'venue', 'inspo', 'wardrobe', 'palette', 'tagline']);
    // Body is still needed on Episode 1, so Wardrobe is not ready.
    expect(s.readiness.items.find((i) => i.key === 'wardrobe').ready).toBe(false);
    expect(s.readiness.done).toBe(s.readiness.items.filter((i) => i.ready).length);
  });

  // Evoni's SP1 ruling, "every required slot, Body included" (Task #3156): a
  // show's configured required slots replace the defaults, but Body stays.
  it("Body is needed whatever the show's required slots; with a dress Wardrobe is ready", async () => {
    const ids = await seedEpisodeOne();
    await run(`UPDATE shows SET metadata = CAST(:m AS jsonb) WHERE id = :show`, { show: ids.show, m: JSON.stringify({ required_slots: ['shoes'] }) });
    const get = async () => (await auth(request(app).get(sheetUrl(ids.ep)))).body.data;
    let s = await get();
    const body = () => s.wardrobe.columns.find((c) => c.key === 'body');
    expect(body()).toMatchObject({ name: null, needed: true });
    expect(s.readiness.items.find((i) => i.key === 'wardrobe').ready).toBe(false);

    const dress = await models.Wardrobe.create({ name: 'Ink Column Dress', clothing_category: 'dress', show_id: ids.show, s3_url: dataPng });
    await run(`INSERT INTO episode_wardrobe (id, episode_id, wardrobe_id, approval_status, created_at, updated_at)
               VALUES (:id, :ep, :w, 'pending', NOW(), NOW())`, { id: uuid(), ep: ids.ep, w: dress.id });
    s = await get();
    expect(body()).toMatchObject({ name: 'Ink Column Dress', needed: false });
    expect(s.readiness.items.find((i) => i.key === 'wardrobe').ready).toBe(true);
  });

  it('exports: refused while Draft and while out of date; each size at its dimensions once approved (Task #2877)', async () => {
    const ids = await seedEpisodeOne();
    const exp = (size) => auth(request(app).get(`${sheetUrl(ids.ep)}/export/${size}`)).buffer(true).parse((res, cb) => {
      const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect((await request(app).get(`${sheetUrl(ids.ep)}/export/sheet`)).status).toBe(401);
    let res = await auth(request(app).get(`${sheetUrl(ids.ep)}/export/sheet`));
    expect([res.status, res.body.code]).toEqual([409, 'SHEET_NOT_APPROVED']);
    res = await auth(request(app).get(`${sheetUrl(ids.ep)}/export/poster`));
    expect([res.status, res.body.code]).toEqual([400, 'UNKNOWN_SIZE']);

    expect((await auth(request(app).post(`${sheetUrl(ids.ep)}/approve`))).status).toBe(200);
    const want = { sheet: [1024, 1536], pin: [1000, 1500], story: [1080, 1920], post: [1080, 1350] };
    for (const [size, [w, h]] of Object.entries(want)) {
      res = await exp(size);
      expect([size, res.status, res.headers['content-type']]).toEqual([size, 200, 'image/png']);
      expect(res.headers['content-disposition']).toBe(`attachment; filename="style-sheet-episode-01-${size}.png"`);
      const meta = await sharp(res.body).metadata();
      expect([size, meta.width, meta.height]).toEqual([size, w, h]);
    }
    res = await exp('look');
    const look = await sharp(res.body).metadata();
    expect(look.height).toBeGreaterThan(look.width);
    res = await exp('pdf');
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.body.slice(0, 5).toString()).toBe('%PDF-');

    // Out of date after approval: refused until approved again.
    await run("UPDATE world_events SET dress_code = 'black tie' WHERE id = :event", ids);
    res = await auth(request(app).get(`${sheetUrl(ids.ep)}/export/pin`));
    expect([res.status, res.body.code]).toEqual([409, 'SHEET_OUT_OF_DATE']);
  });

  // A zip's file names, read from its central directory (no unzip library).
  function zipNames(buf) {
    const names = [];
    let at = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    const count = buf.readUInt16LE(at + 10);
    at = buf.readUInt32LE(at + 16);
    for (let i = 0; i < count; i++) {
      const nameLen = buf.readUInt16LE(at + 28);
      const extra = buf.readUInt16LE(at + 30);
      const comment = buf.readUInt16LE(at + 32);
      names.push(buf.slice(at + 46, at + 46 + nameLen).toString());
      at += 46 + nameLen + extra + comment;
    }
    return names;
  }

  it("Evoni's five designs: the page gets them with this episode's values; downloads once approved, one or zipped", async () => {
    const ids = await seedEpisodeOne();
    const bin = (url) => auth(request(app).get(url)).buffer(true).parse((res, cb) => {
      const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    const s = (await auth(request(app).get(sheetUrl(ids.ep)))).body.data;
    expect(s.designs.map((d) => d.key)).toEqual(['episode_look', 'style_diary', 'runway', 'color_story', 'invited']);
    expect(s.design_sizes.map((z) => z.key)).toEqual(['pinterest', 'fb_feed', 'fb_story', 'ig_feed', 'ig_story', 'tiktok']);
    expect(s.design_values.fields.episode_event).toBe("EPISODE 01  •  WEARABLE EXPERIMENTS STUDIO SESSION / STUDIO BY SABLE'S STUDIO");
    expect(s.design_values.photo_paths.shoes).toMatch(/^wardrobe\.columns\.\d\.image$/);

    const one = `${sheetUrl(ids.ep)}/design/runway/ig_story`;
    expect((await request(app).get(one)).status).toBe(401);
    let res = await auth(request(app).get(one));
    expect([res.status, res.body.code]).toEqual([409, 'SHEET_NOT_APPROVED']);
    res = await auth(request(app).get(`${sheetUrl(ids.ep)}/design/poster/ig_story`));
    expect([res.status, res.body.code]).toEqual([400, 'UNKNOWN_DESIGN']);
    res = await auth(request(app).get(`${sheetUrl(ids.ep)}/design/runway/billboard`));
    expect([res.status, res.body.code]).toEqual([400, 'UNKNOWN_SIZE']);
    res = await auth(request(app).get(`${sheetUrl(ids.ep)}/designs-zip/pinterest`));
    expect([res.status, res.body.code]).toEqual([409, 'SHEET_NOT_APPROVED']);

    expect((await auth(request(app).post(`${sheetUrl(ids.ep)}/approve`))).status).toBe(200);
    res = await bin(one);
    expect([res.status, res.headers['content-type'], res.headers['content-disposition']])
      .toEqual([200, 'image/png', 'attachment; filename="style-runway-episode-01-ig-story.png"']);
    const meta = await sharp(res.body).metadata();
    expect([meta.width, meta.height]).toEqual([1080, 1920]);

    res = await bin(`${sheetUrl(ids.ep)}/designs-zip/pinterest`);
    expect([res.status, res.headers['content-type']]).toEqual([200, 'application/zip']);
    expect(res.headers['content-disposition']).toBe('attachment; filename="style-designs-episode-01-pinterest.zip"');
    expect(zipNames(res.body)).toEqual(['episode-look', 'style-diary', 'runway', 'color-story', 'invited'].map((d) => `style-${d}-episode-01-pinterest.png`));
    res = await bin(`${sheetUrl(ids.ep)}/designs-zip/all`);
    expect(zipNames(res.body)).toHaveLength(30);
  });

  it('Template Studio › Style sheets: a design switched off for the show leaves the page, the zip and single downloads', async () => {
    const ids = await seedEpisodeOne();
    const lib = `/api/v1/shows/${ids.show}/style-designs`;
    const bin = (url) => auth(request(app).get(url)).buffer(true).parse((res, cb) => {
      const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect((await request(app).get(lib)).status).toBe(401);
    let res = await auth(request(app).get(lib));
    expect(res.status).toBe(200);
    expect(res.body.data.designs.map((d) => d.key)).toEqual(['episode_look', 'style_diary', 'runway', 'color_story', 'invited']);
    expect(res.body.data.off).toEqual([]);
    expect((await auth(request(app).put(lib)).send({ off: ['poster'] })).status).toBe(400);
    expect((await auth(request(app).put(lib)).send({ off: 'runway' })).status).toBe(400);
    // Another metadata key is kept.
    await run("UPDATE shows SET metadata = '{\"tagline\":\"kept\"}' WHERE id = :show", ids);
    res = await auth(request(app).put(lib)).send({ off: ['runway', 'invited', 'runway'] });
    expect([res.status, res.body.data.off]).toEqual([200, ['runway', 'invited']]);
    const [[show]] = await run('SELECT metadata FROM shows WHERE id = :show', ids);
    const meta = typeof show.metadata === 'string' ? JSON.parse(show.metadata) : show.metadata;
    expect(meta).toEqual({ tagline: 'kept', style_designs: { off: ['runway', 'invited'] } });

    const s = (await auth(request(app).get(sheetUrl(ids.ep)))).body.data;
    expect(s.designs.map((d) => d.key)).toEqual(['episode_look', 'style_diary', 'color_story']);
    expect((await auth(request(app).post(`${sheetUrl(ids.ep)}/approve`))).status).toBe(200);
    res = await auth(request(app).get(`${sheetUrl(ids.ep)}/design/runway/ig_story`));
    expect([res.status, res.body.code]).toEqual([409, 'DESIGN_OFF']);
    res = await bin(`${sheetUrl(ids.ep)}/designs-zip/pinterest`);
    expect(zipNames(res.body)).toEqual(['episode-look', 'style-diary', 'color-story'].map((d) => `style-${d}-episode-01-pinterest.png`));
    // Every design off: the zip is refused.
    await auth(request(app).put(lib)).send({ off: ['episode_look', 'style_diary', 'runway', 'color_story', 'invited'] });
    res = await auth(request(app).get(`${sheetUrl(ids.ep)}/designs-zip/pinterest`));
    expect([res.status, res.body.code]).toEqual([409, 'DESIGN_OFF']);
    expect((await auth(request(app).get('/api/v1/shows/00000000-0000-4000-8000-000000000000/style-designs'))).status).toBe(404);
  });

  it('the Detail spot (the designs\' Detail shot) holds one photo and shows on the sheet', async () => {
    const ids = await seedEpisodeOne();
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 9, g: 90, b: 9 } } }).png().toBuffer();
    let res = await auth(request(app).post(`/api/v1/episodes/${ids.ep}/lookbook/images`)).field('category', 'detail').attach('files', png, { filename: 'd.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    res = await auth(request(app).post(`/api/v1/episodes/${ids.ep}/lookbook/images`)).field('category', 'detail')
      .attach('files', png, { filename: 'a.png', contentType: 'image/png' }).attach('files', png, { filename: 'b.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    const s = (await auth(request(app).get(sheetUrl(ids.ep)))).body.data;
    expect(s.look.detail).toMatch(/^data:image\//);
    expect(s.design_values.photo_paths.detail).toBe('look.detail');
    expect(s.readiness.total).toBe(12); // not one of the readiness items
  });

  // The Files tab's Character poses (Evoni, 2026-10-22). Pose photos live in
  // S3; the test answers those reads with a small PNG.
  async function addPose(ep, character, pose, extra = {}) {
    const id = uuid();
    await run(`INSERT INTO episode_character_poses (id, episode_id, character_key, pose, is_default, original_key, status, final_url)
               VALUES (:id, :ep, :character, :pose, :isDefault, 'k', :status, :url)`,
      { id, ep, character, pose, isDefault: Boolean(extra.isDefault), status: extra.status || 'ready', url: extra.url === undefined ? `https://bucket.s3.amazonaws.com/${id}.png` : extra.url });
    return id;
  }
  async function poseReads() {
    const png = await sharp({ create: { width: 6, height: 9, channels: 4, background: { r: 200, g: 100, b: 150, alpha: 1 } } }).png().toBuffer();
    const axios = require('axios');
    const axiosGet = jest.spyOn(axios, 'get').mockImplementation(async () => ({ data: png }));
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async () => new Response(png, { status: 200, headers: { 'content-type': 'image/png' } }));
    return () => { axiosGet.mockRestore(); fetchSpy.mockRestore(); };
  }

  it("Front, Side and Back are Lala's starred pose from Files; a Lookbook photo filed under back is not used", async () => {
    const ids = await seedEpisodeOne();
    const restore = await poseReads();
    try {
      await addPose(ids.ep, 'lala', 'back');
      const defaultBack = await addPose(ids.ep, 'lala', 'back', { isDefault: true });
      await addPose(ids.ep, 'justawoman', 'side', { isDefault: true }); // only Lala's fill the look
      await addPose(ids.ep, 'lala', 'front', { status: 'processing', url: null }); // not ready
      const s = (await auth(request(app).get(sheetUrl(ids.ep)))).body.data;
      expect(Object.keys(s.look_from_files)).toEqual(['back']);
      expect(s.look_from_files.back).toEqual({ id: defaultBack, url: `https://bucket.s3.amazonaws.com/${defaultBack}.png`, label: 'Lala · back' });
      expect(s.look.back).toMatch(/^data:image\/png;base64,/);
      expect(s.look.front).toBeNull();
      expect(s.look.side).toBeNull();
      const chip = (key) => s.readiness.items.find((i) => i.key === key).ready;
      expect([chip('front'), chip('side'), chip('back')]).toEqual([false, false, true]);

      // A photo filed under back in the Lookbook (before 2026-10-22) is not the sheet's Back: the pose stays.
      const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 9, g: 9, b: 9 } } }).jpeg().toBuffer();
      await auth(request(app).post(`/api/v1/episodes/${ids.ep}/lookbook/images`)).field('category', 'back').attach('files', png, { filename: 'b.jpg', contentType: 'image/jpeg' });
      const after = (await auth(request(app).get(sheetUrl(ids.ep)))).body.data;
      expect(after.look_from_files.back.id).toBe(defaultBack);
      expect(after.look.back).toBe(s.look.back);
      expect(after.readiness.items.find((i) => i.key === 'back').ready).toBe(true);
    } finally {
      restore();
    }
  });

  it('Choose from Files copies a ready pose into a spot; another episode\'s or an unready one is refused', async () => {
    const ids = await seedEpisodeOne();
    const other = await seedEpisodeOne();
    const restore = await poseReads();
    try {
      const url = `/api/v1/episodes/${ids.ep}/lookbook/images/from-pose`;
      const glamour = await addPose(ids.ep, 'lala', 'glamour');
      const theirs = await addPose(other.ep, 'lala', 'front');
      const busy = await addPose(ids.ep, 'justawoman', 'front', { status: 'processing', url: null });

      expect((await request(app).post(url).send({ pose_id: glamour, category: 'hero' })).status).toBe(401);
      const res = await auth(request(app).post(url)).send({ pose_id: glamour, category: 'hero' });
      expect(res.status).toBe(201);
      const hero = res.body.data.lookbook.images.hero;
      expect(hero).toHaveLength(1);
      expect(hero[0]).toMatchObject({ source: 'upload', file_name: 'lala glamour.png' });
      const s = (await auth(request(app).get(sheetUrl(ids.ep)))).body.data;
      expect(s.look.hero).toMatch(/^data:image\/png;base64,/);

      expect((await auth(request(app).post(url)).send({ pose_id: theirs, category: 'hero' })).status).toBe(404);
      expect((await auth(request(app).post(url)).send({ pose_id: busy, category: 'front' })).status).toBe(409);
      expect((await auth(request(app).post(url)).send({ pose_id: 'nope', category: 'front' })).status).toBe(400);
      expect((await auth(request(app).post(url)).send({ pose_id: glamour, category: 'elbow' })).status).toBe(400);
    } finally {
      restore();
    }
  });

  it('an unknown episode is 404', async () => {
    expect((await auth(request(app).get(sheetUrl(uuid())))).status).toBe(404);
  });
});
