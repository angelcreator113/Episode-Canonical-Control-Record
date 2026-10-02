/**
 * Dressed angles, L10 (Evoni, 2026-10-02, her answers accepting the four
 * recommendations; docs/EVENT_EPISODE_FLOW.md §8(hh)), on the migrated
 * database through the real routes. The paid image call and S3 are stubbed.
 *   L10. "When an event has a dressed look, its episode's angles at that
 *   venue are made from the dressed look instead of the plain approved
 *   base (the look is the episode's room); without a look, the approved
 *   base is used as today."
 * - Stored per look; the set's angles stay plain (answer 1).
 * - Made by the Beat Plan's Generate angle and Upload image, only with a
 *   complete look (answer 2).
 * - Beats at the look's set show and count the dressed angle, else the
 *   plain one; with no look, as today (answer 3).
 * - One image call, its cost shown first (answer 4).
 */
jest.unmock('uuid');

process.env.FAL_KEY = process.env.FAL_KEY || 'test-fal-key';

jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn(() => ({ send: jest.fn(async () => ({})) })),
    PutObjectCommand: jest.fn((input) => ({ input })),
  };
});

const request = require('supertest');
const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const sceneGen = require('../../src/services/sceneGenerationService');
const approvedMigration = require('../../src/migrations/20261001220000-world-locations-approved-base');
const venueLookMigration = require('../../src/migrations/20261002110000-add-world-events-venue-look');
const kindMigration = require('../../src/migrations/20261002120000-add-scene-angle-kind');
const looksMigration = require('../../src/migrations/20261002130000-create-scene-set-looks');
const chosenMigration = require('../../src/migrations/20261002140000-add-scene-plan-chosen-by-user');
const lookAnglesMigration = require('../../src/migrations/20261002150000-create-scene-set-look-angles');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Dressed angles (§8(hh) L10)', () => {
  const show = uuid();
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const dressedUrl = (ep, angleId, tail) => `/api/v1/episode-brief/${ep}/dressed-angles/${angleId}/${tail}`;

  /**
   * A venue with an approved base, its set with a plain DOORWAY (Front, L14)
   * angle, an event linked to an episode, and that episode's plan: beat 10
   * at the venue's set, beat 1 at home. look: 'complete' | 'generating' | null.
   */
  async function world({ look = 'complete', plainImage = 'https://x/doorway-plain.jpg', linked = true } = {}) {
    const loc = uuid(); const set = uuid(); const home = uuid(); const angle = uuid(); const ev = uuid(); const ep = uuid();
    await run(`INSERT INTO world_locations (id, name, description, approved_base_scene_set_id, approved_base_image_url, created_at, updated_at)
               VALUES (:loc, 'The Glasshouse', 'A glass conservatory.', :set, 'https://x/approved.jpg', NOW(), NOW())`, { loc, set });
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, world_location_id, base_still_url, generation_status, created_at, updated_at)
               VALUES (:set, 'Glasshouse Hall', 'EVENT_LOCATION', :show, :loc, 'https://x/approved.jpg', 'complete', NOW(), NOW()),
                      (:home, 'Lala apartment', 'HOME_BASE', :show, NULL, 'https://x/home.jpg', 'complete', NOW(), NOW())`,
    { set, home, show, loc });
    await run(`INSERT INTO scene_angles (id, scene_set_id, angle_label, angle_name, angle_kind, still_image_url, generation_status, created_at, updated_at)
               VALUES (:angle, :set, 'DOORWAY', 'Entrance', 'front', :plainImage, :status, NOW(), NOW())`,
    { angle, set, plainImage, status: plainImage ? 'complete' : 'pending' });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Gala ep', :n, 'draft', NOW(), NOW())`, { ep, show, n: Math.floor(Math.random() * 100000) + 300 });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, venue_location_id, venue_name, scene_set_id, venue_look, used_in_episode_id, created_at, updated_at)
               VALUES (:ev, :show, 'Velour Gala', 'invite', 'used', 6, :loc, 'The Glasshouse', :set,
                       CAST(:venueLook AS jsonb), :usedIn, NOW(), NOW())`,
    { ev, show, loc, set, usedIn: linked ? ep : null, venueLook: JSON.stringify({ overall: 'Candlelit gala in ivory and gold.', decor: 'White orchids.' }) });
    let lookId = null;
    if (look) {
      lookId = uuid();
      await run(`INSERT INTO scene_set_looks (id, scene_set_id, event_id, status, image_url, created_at, updated_at)
                 VALUES (:lookId, :set, :ev, :status, :image, NOW(), NOW())`,
      { lookId, set, ev, status: look, image: look === 'complete' ? 'https://x/look.jpg' : null });
    }
    for (const [b, setId, label] of [[1, home, null], [10, set, 'DOORWAY']]) {
      await run(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, scene_set_id, angle_label, sort_order, locked, ai_suggested, created_at, updated_at)
                 VALUES (gen_random_uuid(), :ep, :b, :name, :setId, :label, :b, false, true, NOW(), NOW())`,
      { ep, b, name: `Beat ${b}`, setId, label });
    }
    return { loc, set, home, angle, ev, ep, lookId };
  }
  const plan = async (ep) => (await auth(request(app).get(`/api/v1/episode-brief/${ep}/plan`))).body;
  const beat = (body, n) => body.data.find((b) => b.beat_number === n);
  const until = async (check, ms = 5000) => {
    const end = Date.now() + ms;
    while (!(await check())) {
      if (Date.now() > end) throw new Error('timed out waiting for the background run');
      await new Promise((r) => setTimeout(r, 10));
    }
  };

  beforeAll(async () => {
    const qi = sequelize.getQueryInterface();
    for (const m of [approvedMigration, venueLookMigration, kindMigration, looksMigration, chosenMigration, lookAnglesMigration]) await m.up(qi, Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-dressed', email: 'user@dressed.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, '{}', NOW(), NOW())`,
      { show, name: `Dressed ${show.slice(0, 8)}`, slug: `dressed-${show.slice(0, 8)}` });
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('the migration is re-runnable and keeps one live dressed angle per look and angle', async () => {
    await lookAnglesMigration.up(sequelize.getQueryInterface(), Sequelize);
    const [index] = await rows(`SELECT indexdef FROM pg_indexes WHERE indexname = 'scene_set_look_angles_unique_look_angle'`);
    expect(index.indexdef).toMatch(/UNIQUE.*\(look_id, scene_angle_id\).*deleted_at IS NULL/);
  });

  it('the brief is the angle in the dressed room, made from the look image, its Kontext cost shown first', async () => {
    const w = await world();
    const res = await auth(request(app).post(dressedUrl(w.ep, w.angle, 'brief'))).send({});
    expect(res.status).toBe(200);
    expect(res.body.data.target).toMatchObject({ kind: 'dressed_angle', angle_id: w.angle, look_id: w.lookId });
    expect(res.body.data.brief.source).toEqual({ kind: 'look', look_id: w.lookId, image_url: 'https://x/look.jpg' });
    expect(res.body.data.brief.event_id).toBe(w.ev);
    expect(res.body.data.brief.lines.map((l) => l.key)).toEqual(expect.arrayContaining(['concept', 'camera', 'continuity']));
    expect(res.body.data.prompt).toContain('Candlelit gala in ivory and gold');
    expect(res.body.data.estimate.base_model).toBe('flux-kontext');
    expect(res.body.data.estimate).toHaveProperty('usd');
  });

  it('without a finished look the dressed routes refuse (409 NO_LOOK) and the plain angle applies', async () => {
    for (const w of [await world({ look: 'generating' }), await world({ look: null }), await world({ linked: false })]) {
      const res = await auth(request(app).post(dressedUrl(w.ep, w.angle, 'brief'))).send({});
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('NO_LOOK');
      const b10 = beat(await plan(w.ep), 10);
      expect(b10.location.look).toBeUndefined();
      expect(b10.location.angle.still_image_url).toBe('https://x/doorway-plain.jpg');
    }
  });

  it('Generate angle edits the look image once and stores the dressed angle per look; the set\'s angle stays plain', async () => {
    const w = await world();
    const dressed = jest.spyOn(sceneGen, 'generateDressedStill').mockResolvedValue({ stillUrl: 'https://x/doorway-dressed.jpg', cost: 0.04 });
    const res = await auth(request(app).post(dressedUrl(w.ep, w.angle, 'generate'))).send({});
    expect(res.status).toBe(202);
    expect(res.body.data).toMatchObject({ status: 'generating', look_id: w.lookId, angle_id: w.angle });
    const settled = async () => (await rows('SELECT status FROM scene_set_look_angles WHERE look_id = :look', { look: w.lookId }))[0]?.status !== 'generating';
    await until(settled);

    expect(dressed).toHaveBeenCalledTimes(1);
    const [setArg, prompt, source] = dressed.mock.calls[0];
    expect(setArg.id).toBe(w.set);
    expect(source).toBe('https://x/look.jpg');
    expect(prompt).toContain('Candlelit gala in ivory and gold');
    const [row] = await rows('SELECT status, image_url, source, cost_usd FROM scene_set_look_angles WHERE look_id = :look AND scene_angle_id = :angle', { look: w.lookId, angle: w.angle });
    expect(row).toMatchObject({ status: 'complete', image_url: 'https://x/doorway-dressed.jpg', source: 'generated' });
    expect(Number(row.cost_usd)).toBeCloseTo(0.04);
    expect((await rows('SELECT still_image_url FROM scene_angles WHERE id = :angle', { angle: w.angle }))[0].still_image_url).toBe('https://x/doorway-plain.jpg');
  });

  it('a failed dressed angle is marked failed with its reason, and the beat keeps the plain angle', async () => {
    const w = await world();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(sceneGen, 'generateDressedStill').mockRejectedValue(new Error('provider down'));
    await auth(request(app).post(dressedUrl(w.ep, w.angle, 'generate'))).send({});
    await until(async () => (await rows('SELECT status FROM scene_set_look_angles WHERE look_id = :look', { look: w.lookId }))[0]?.status === 'failed');
    const b10 = beat(await plan(w.ep), 10);
    expect(b10.location.angle.still_image_url).toBe('https://x/doorway-plain.jpg');
    expect(b10.location.angle.dressed).toMatchObject({ status: 'failed', error: 'provider down' });
  });

  it('Upload image stores the upload as the dressed angle', async () => {
    const w = await world({ plainImage: null });
    const res = await auth(request(app).post(dressedUrl(w.ep, w.angle, 'upload')))
      .attach('images', Buffer.from('fake-png'), { filename: 'door.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'complete', look_id: w.lookId, angle_id: w.angle });
    expect(res.body.data.image_url).toMatch(new RegExp(`/scene-sets/${w.set}/looks/${w.lookId}/angles/${w.angle}/still-\\d+\\.png$`));
    expect((await rows('SELECT still_image_url FROM scene_angles WHERE id = :angle', { angle: w.angle }))[0].still_image_url).toBeNull();
    const b10 = beat(await plan(w.ep), 10);
    expect(b10.location.missing).toBeNull();
    expect(b10.location.angle.still_image_url).toBe(res.body.data.image_url);
  });

  it('the plan shows and counts the dressed angle at the look\'s set, else the plain one; other sets are as today', async () => {
    const plainOnly = await world();
    let body = await plan(plainOnly.ep);
    expect(beat(body, 10).location.look).toEqual({ id: plainOnly.lookId, image_url: 'https://x/look.jpg' });
    expect(beat(body, 10).location.angle.still_image_url).toBe('https://x/doorway-plain.jpg');
    expect(body.readiness).toMatchObject({ ready: 2, total: 2 });

    const none = await world({ plainImage: null });
    body = await plan(none.ep);
    expect(beat(body, 10).location.missing).toMatchObject({ reason: 'no_image', angle_id: none.angle });
    expect(body.readiness).toMatchObject({ ready: 1, total: 2 });

    await run(`INSERT INTO scene_set_look_angles (id, look_id, scene_angle_id, status, image_url, source, created_at, updated_at)
               VALUES (gen_random_uuid(), :look, :angle, 'complete', 'https://x/doorway-dressed.jpg', 'generated', NOW(), NOW())`,
    { look: none.lookId, angle: none.angle });
    body = await plan(none.ep);
    expect(beat(body, 10).location.missing).toBeNull();
    expect(beat(body, 10).location.angle).toMatchObject({ still_image_url: 'https://x/doorway-dressed.jpg', plain_image_url: null, dressed: { status: 'complete' } });
    expect(body.readiness).toMatchObject({ ready: 2, total: 2 });
    expect(beat(body, 1).location.look).toBeUndefined();
  });
});
