/**
 * Scene-set production writes, their paid routes and generate-venue are an
 * ADMIN's (P2b; Evoni, 2026-11-22;
 * docs/audit/F-AUTH-1_SceneSetProductionWrites_AdminOnly_Amendment_2026-11-22.md).
 *
 * Forty-six write routes of routes/sceneSetRoutes.js and POST
 * /world/:showId/events/:eventId/generate-venue carry requireAuth then
 * authorize(['ADMIN']), before any rate limiter, upload handling or handler.
 * For each of the forty-seven, on the migrated database through the real app
 * and the real auth middleware:
 *   - signed out: 401;
 *   - signed in but not an admin: 403 with authorize's own body;
 *   - during that refusal no statement that writes is sent to the database
 *     (every statement is recorded, tests/helpers/lockTrace), every row the
 *     routes could change is as it was, no provider is called (axios,
 *     Replicate, Anthropic), nothing is sent to storage, no upload is read
 *     and no job is queued;
 *   - an admin is never answered by authorize.
 * What an admin then gets from each scene-set route is unchanged and is the
 * subject of the routes' own suites, which now ask as an admin.
 *
 * Also here: what stays any signed-in account's in the file (read from its
 * source), the reads, and generate-venue's Place lock (utils/placeLock): on an
 * event whose episode is accepted a new venue, `force` or not, and the missing
 * base of the set the event has are refused, for an admin too, before anything
 * is generated, stored, made or changed; "already available" is as before.
 *
 * This suite deletes no scene and changes no schema.
 */
jest.unmock('uuid');

const mockAnthropic = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockAnthropic } })));
const mockReplicateRun = jest.fn();
jest.mock('replicate', () => jest.fn(() => ({ run: mockReplicateRun, predictions: { create: mockReplicateRun, get: mockReplicateRun } })));
jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return { ...actual, post: jest.fn(), get: jest.fn(), put: jest.fn(), delete: jest.fn(), request: jest.fn(), create: actual.create };
});
const mockS3Send = jest.fn(async () => ({}));
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return { ...actual, S3Client: jest.fn(() => ({ send: mockS3Send })) };
});
const mockAddRefinementJob = jest.fn();
jest.mock('../../src/queues/sceneRefinementQueue', () => ({
  ...jest.requireActual('../../src/queues/sceneRefinementQueue'),
  addRefinementJob: (...args) => mockAddRefinementJob(...args),
}));

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');
const axios = require('axios');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const lockTrace = require('../helpers/lockTrace');
const { PLACE_LOCKED_CODE, PLACE_LOCKED_MESSAGE } = require('../../src/utils/placeLock');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
const src = (file) => fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'routes', file), 'utf8');

const AUTHORIZE_BODY = { error: 'Forbidden', message: 'User must be in one of these groups: ADMIN', code: 'AUTH_GROUP_REQUIRED' };

(shouldSkip ? describe.skip : describe)("Scene-set production writes, their paid routes and generate-venue are an admin's (P2b)", () => {
  const show = uuid();
  const set = uuid();
  const angle = uuid();
  const pendingAngle = uuid();
  const location = uuid();
  const event = uuid();
  const TAG = show.slice(0, 8);
  const tokens = {};
  let ip = 0;
  const from = (r) => r.set('X-Forwarded-For', `10.93.${Math.floor(ip / 250)}.${(ip % 250) + 1}`);
  // The AI rate limiter counts by account, and only an admin now reaches it:
  // each admin request is a different admin, so the limiter is never what
  // answers here.
  let admins = 0;
  const adminToken = () => {
    admins += 1;
    return TokenService.generateTokenPair({ id: `p2b-admin-${TAG}-${admins}`, email: `admin${admins}@p2b.dev`, name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
  };
  const as = (who) => (r) => {
    if (!who) return from(r);
    return from(r).set('Authorization', `Bearer ${who === 'admin' ? adminToken() : tokens[who]}`);
  };

  const SETS = `/api/v1/scene-sets/${set}`;
  const ANGLE = `${SETS}/angles/${angle}`;
  const VARIANT = `${SETS}/look-variants/time/night`;
  const VENUE = (eventId) => `/api/v1/world/${show}/events/${eventId}/generate-venue`;

  // [name, method, path, body, upload field?]: a request an admin could send.
  const ROUTES = [
    // The five that are paid and write nothing
    ['ai-describe', 'post', '/api/v1/scene-sets/ai-describe', { name: 'A loft', scene_type: 'HOME_BASE' }],
    ['refine-description', 'post', `${SETS}/refine-description`, { instruction: 'warmer' }],
    ['suggest-angles', 'post', `${SETS}/suggest-angles`, {}],
    ['ai-camera-direction', 'post', `${SETS}/ai-camera-direction`, { angle_label: 'WIDE' }],
    ['spec validate-angle', 'post', `${SETS}/spec/validate-angle`, { angle_label: 'WIDE' }],
    // Base image (6)
    ['upload-base', 'post', `${SETS}/upload-base`, null, 'image'],
    ['generate-base', 'post', `${SETS}/generate-base`, {}],
    ['cascade-regenerate', 'post', `${SETS}/cascade-regenerate`, { canonical_description: 'Changed' }],
    ['promote-to-base', 'post', `${SETS}/promote-to-base`, { angle_id: angle }],
    ['approve-base', 'post', `${SETS}/approve-base`, {}],
    ['approve-base removed', 'delete', `${SETS}/approve-base`, {}],
    // Angles (16)
    ['angle create', 'post', `${SETS}/angles`, { angle_name: 'New', angle_label: 'NEW' }],
    ['angle edit', 'patch', ANGLE, { angle_name: 'Changed', generation_status: 'pending' }],
    ['angles reorder', 'patch', `${SETS}/angles/reorder`, { order: [pendingAngle, angle] }],
    ['angle delete', 'delete', ANGLE, {}],
    ['angles delete all', 'delete', `${SETS}/angles`, {}],
    ['angle upload', 'post', `${ANGLE}/upload`, null, 'image'],
    ['angle generate', 'post', `${ANGLE}/generate`, {}],
    ['angle regenerate', 'post', `${ANGLE}/regenerate`, {}],
    ['generate-all-angles', 'post', `${SETS}/generate-all-angles`, {}],
    ['angle generate-video', 'post', `${ANGLE}/generate-video`, {}],
    ['angle post-process', 'post', `${ANGLE}/post-process`, {}],
    ['angle auto-refine', 'post', `${ANGLE}/auto-refine`, {}],
    ['angle review', 'post', `${ANGLE}/review`, { quality_score: 2, artifact_flags: ['warped'] }],
    ['angle analyze', 'post', `${ANGLE}/analyze`, {}],
    ['angle favorite', 'patch', `${ANGLE}/favorite`, { favorite: true }],
    ['angle reject', 'patch', `${ANGLE}/reject`, { reason: 'no' }],
    // Look variants and the venue photo (5)
    ['look variant generate', 'post', `${VARIANT}/generate`, {}],
    ['look variant upload', 'post', `${VARIANT}/upload`, null, 'image'],
    ['look variant delete', 'delete', VARIANT, {}],
    ['venue photo upload', 'post', `${SETS}/venue-photo`, null, 'image'],
    ['venue photo delete', 'delete', `${SETS}/venue-photo`, {}],
    // Description, location, spec and variants (14)
    ['description-review', 'post', `${SETS}/description-review`, { canonical_description: 'Changed' }],
    ['learn-location', 'post', `${SETS}/learn-location`, { name: 'Somewhere new' }],
    ['analyze-image', 'post', `${SETS}/analyze-image`, {}],
    ['suggest-angles-from-image', 'post', `${SETS}/suggest-angles-from-image`, {}],
    ['lock-style', 'post', `${SETS}/lock-style`, {}],
    ['spec generate', 'post', `${SETS}/spec/generate`, {}],
    ['spec replace', 'put', `${SETS}/spec`, { scene_spec: { zones: [] } }],
    ['spec merge', 'patch', `${SETS}/spec`, { zones: [] }],
    ['spec create-angles', 'post', `${SETS}/spec/create-angles`, {}],
    ['time-variants', 'post', `${SETS}/time-variants`, { times: ['night'] }],
    ['season-variants', 'post', `${SETS}/season-variants`, { seasons: ['winter'] }],
    ['mood-variants', 'post', `${SETS}/mood-variants`, { moods: ['warm'] }],
    ['apply-template', 'post', `${SETS}/apply-template`, { template_id: 'loft' }],
    ['cover-angle', 'patch', `${SETS}/cover-angle`, { angle_id: angle }],
    // routes/worldEvents/venue.js (1)
    ['generate-venue', 'post', VENUE(event), { force: true }],
  ];
  const send = (who, [, method, urlPath, body, upload]) => {
    const r = as(who)(request(app)[method](urlPath));
    if (upload) return r.attach(upload, Buffer.from('not really a file'), { filename: 'room.png', contentType: 'image/png' });
    return r.send(body);
  };

  // Every row a P2b route could change, whole. Scoped to this file's show,
  // set and location; the two job counts are of the whole tables.
  const snapshot = async () => ({
    sets: await rows('SELECT * FROM scene_sets WHERE show_id = :show ORDER BY id', { show }),
    angles: await rows('SELECT * FROM scene_angles WHERE scene_set_id IN (SELECT id FROM scene_sets WHERE show_id = :show) ORDER BY id', { show }),
    variants: await rows('SELECT * FROM location_look_variants WHERE scene_set_id = :set OR world_location_id = :location ORDER BY id', { set, location }),
    locations: await rows('SELECT * FROM world_locations WHERE id = :location', { location }),
    looks: await rows('SELECT * FROM scene_set_looks WHERE scene_set_id = :set ORDER BY id', { set }),
    setLinks: await rows('SELECT * FROM scene_set_episodes WHERE scene_set_id IN (SELECT id FROM scene_sets WHERE show_id = :show) ORDER BY id', { show }),
    events: await rows('SELECT * FROM world_events WHERE show_id = :show ORDER BY id', { show }),
    episodes: await rows('SELECT * FROM episodes WHERE show_id = :show ORDER BY id', { show }),
    plans: await rows('SELECT * FROM scene_plans WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show) ORDER BY id', { show }),
    scenes: await rows('SELECT * FROM scenes WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show) ORDER BY id', { show }),
    jobs: (await rows('SELECT COUNT(*)::int AS n FROM generation_jobs'))[0].n,
    knowledge: (await rows('SELECT COUNT(*)::int AS n FROM franchise_knowledge'))[0].n,
    locationCount: (await rows('SELECT COUNT(*)::int AS n FROM world_locations'))[0].n,
  });
  const writesIn = (records) => records.filter((r) => r.kind === 'write' || r.kind === 'insert'
    || (r.kind === 'other' && /^\s*(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|CREATE|DROP)\b/i.test(r.sql || '')));
  const providersCalled = () => [
    mockAnthropic, mockReplicateRun, axios.post, axios.get, axios.put, axios.delete, axios.request, mockS3Send,
  ].reduce((n, fn) => n + fn.mock.calls.length, 0);

  beforeAll(async () => {
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@p2b.dev`, name: id, groups, role }).accessToken;
    tokens.editor = token('p2b-editor', ['USER', 'EDITOR'], 'USER');
    tokens.viewer = token('p2b-viewer', ['viewer'], 'USER');
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, '{}', NOW(), NOW())`,
      { show, name: `P2b ${TAG}`, slug: `p2b-${TAG}` });
    await run(`INSERT INTO world_locations (id, name, description, city, venue_type, created_at, updated_at)
               VALUES (:location, :name, 'A hall under a glass roof.', 'Echo Park', 'event_hall', NOW(), NOW())`, { location, name: `P2b hall ${TAG}` });
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, world_location_id, base_still_url, generation_status, created_at, updated_at)
               VALUES (:set, :name, 'EVENT_LOCATION', :show, :location, 'https://x/p2b-base.jpg', 'complete', NOW(), NOW())`, { set, show, location, name: `P2b set ${TAG}` });
    await run(`INSERT INTO scene_angles (id, scene_set_id, angle_name, angle_label, still_image_url, generation_status, sort_order, created_at, updated_at)
               VALUES (:angle, :set, 'Wide', 'WIDE', 'https://x/p2b-wide.jpg', 'complete', 0, NOW(), NOW())`, { angle, set });
    await run(`INSERT INTO scene_angles (id, scene_set_id, angle_name, angle_label, generation_status, sort_order, created_at, updated_at)
               VALUES (:pendingAngle, :set, 'Close', 'CLOSE', 'pending', 1, NOW(), NOW())`, { pendingAngle, set });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, prestige, status, venue_location_id, venue_name, created_at, updated_at)
               VALUES (:event, :show, 'P2b night', 'invite', 5, 'ready', :location, 'The hall', NOW(), NOW())`, { event, show, location });
  });
  beforeEach(() => {
    ip += 1;
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    const q = (sql) => sequelize.query(sql, { replacements: { show, set, location } }).catch((err) => console.error('cleanup:', err.message));
    await q('DELETE FROM episode_raw_clips WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)');
    await q('UPDATE world_events SET used_in_episode_id = NULL, scene_set_id = NULL WHERE show_id = :show');
    await q('DELETE FROM location_look_variants WHERE scene_set_id IN (SELECT id FROM scene_sets WHERE show_id = :show) OR world_location_id = :location');
    await q('DELETE FROM scene_angles WHERE scene_set_id IN (SELECT id FROM scene_sets WHERE show_id = :show)');
    await q('DELETE FROM scene_sets WHERE show_id = :show');
    await q('DELETE FROM world_events WHERE show_id = :show');
    await q('DELETE FROM episodes WHERE show_id = :show');
    await q('DELETE FROM world_locations WHERE id = :location');
    await q('DELETE FROM shows WHERE id = :show');
    await sequelize.close();
  });

  it('the table names forty-seven routes, each once', () => {
    expect(ROUTES).toHaveLength(47);
    expect(new Set(ROUTES.map((r) => `${r[1]} ${r[2]}`)).size).toBe(47);
  });

  describe.each(ROUTES)('%s', (...route) => {
    it('signed out: 401, nothing written, no provider, storage, upload or job', async () => {
      const before = await snapshot();
      const uploadSpy = jest.spyOn(multer.memoryStorage().constructor.prototype, '_handleFile');
      const trace = lockTrace.install(sequelize);
      let res;
      try { res = await send(null, route); } finally { trace.uninstall(); }
      expect(res.status).toBe(401);
      expect(writesIn(trace.records)).toEqual([]);
      expect(await snapshot()).toEqual(before);
      expect(providersCalled()).toBe(0);
      expect(uploadSpy).not.toHaveBeenCalled();
      expect(mockAddRefinementJob).not.toHaveBeenCalled();
    });

    it.each(['editor', 'viewer'])('signed in as %s, not an admin: 403 from authorize, no statement that writes, every row as it was, no provider, storage, upload or job', async (who) => {
      const before = await snapshot();
      const uploadSpy = jest.spyOn(multer.memoryStorage().constructor.prototype, '_handleFile');
      const trace = lockTrace.install(sequelize);
      let res;
      try { res = await send(who, route); } finally { trace.uninstall(); }
      expect(res.status).toBe(403);
      expect(res.body).toEqual(AUTHORIZE_BODY);
      expect(writesIn(trace.records)).toEqual([]);
      expect(await snapshot()).toEqual(before);
      expect(providersCalled()).toBe(0);
      expect(uploadSpy).not.toHaveBeenCalled();
      expect(mockAddRefinementJob).not.toHaveBeenCalled();
    });

    it('an admin is not stopped by the check', async () => {
      // What the route then does is its own suites' subject; here only that
      // an admin is never answered by authorize. It is asked about a set, an
      // angle and an event that do not exist, with an empty body, so nothing
      // is made, changed or spent.
      const [, method, urlPath] = route;
      const ghost = [show, set, angle, event].reduce((p, id) => p.split(id).join(uuid()), urlPath);
      const before = await snapshot();
      const trace = lockTrace.install(sequelize);
      let res;
      try { res = await as('admin')(request(app)[method](ghost)).send({}); } finally { trace.uninstall(); }
      expect([401, 403]).not.toContain(res.status);
      expect(res.body?.code).not.toBe('AUTH_GROUP_REQUIRED');
      expect(trace.records.filter((r) => /\b(DROP|CREATE|ALTER)\s+(UNIQUE\s+)?(INDEX|TABLE)\b/i.test(r.sql || ''))).toEqual([]);
      expect(await snapshot()).toEqual(before);
      expect(providersCalled()).toBe(0);
    });
  });

  describe('the routes that remove or replace angles leave every angle as it was when refused', () => {
    it.each([
      ['DELETE /angles', (who) => as(who)(request(app).delete(`${SETS}/angles`)).send()],
      ['DELETE /angles/:angleId', (who) => as(who)(request(app).delete(ANGLE)).send()],
      ['analyze-image', (who) => as(who)(request(app).post(`${SETS}/analyze-image`)).send({})],
      ['apply-template', (who) => as(who)(request(app).post(`${SETS}/apply-template`)).send({ template_id: 'loft' })],
    ])('%s', async (_label, call) => {
      const before = await rows('SELECT * FROM scene_angles WHERE scene_set_id = :set ORDER BY id', { set });
      expect(before).toHaveLength(2);
      for (const who of [null, 'editor', 'viewer']) {
        const res = await call(who);
        expect(res.status).toBe(who ? 403 : 401);
      }
      expect(await rows('SELECT * FROM scene_angles WHERE scene_set_id = :set ORDER BY id', { set })).toEqual(before);
    });
  });

  describe('what the source of sceneSetRoutes.js declares', () => {
    const declarations = src('sceneSetRoutes.js').split('\n')
      .map((line) => line.match(/^router\.(post|put|patch|delete)\('([^']+)',(.*)$/))
      .filter(Boolean)
      .map(([, method, routePath, chain]) => ({ method, routePath, chain, key: `${method} ${routePath}` }));

    it('every write is declared on one line, sixty-four in all, each path once', () => {
      const multiLine = src('sceneSetRoutes.js').split('\n').filter((l) => /^router\.(post|put|patch|delete)\(\s*$/.test(l));
      expect(multiLine).toEqual([]);
      expect(declarations).toHaveLength(64);
      expect(new Set(declarations.map((d) => d.key)).size).toBe(64);
    });

    it("the only writes that stay any signed-in account's are the set's creation, the brief and the look-variant estimate", () => {
      const open = declarations.filter((d) => !/authorize\(\['ADMIN'\]\)/.test(d.chain)).map((d) => d.key).sort();
      expect(open).toEqual(['post /', 'post /:id/brief', 'post /:id/look-variants/:kind/:value/estimate']);
      for (const d of declarations.filter((x) => open.includes(x.key))) expect(d.chain).toMatch(/\brequireAuth\b/);
    });

    it('on the other sixty-one, authorize sits directly after requireAuth, so before any rate limiter and any upload', () => {
      const admin = declarations.filter((d) => /authorize\(\['ADMIN'\]\)/.test(d.chain));
      expect(admin).toHaveLength(61);
      for (const d of admin) {
        expect(d.chain).toMatch(/requireAuth,\s*authorize\(\['ADMIN'\]\),/);
        const at = d.chain.indexOf("authorize(['ADMIN'])");
        for (const later of ['aiRateLimiter', 'uploadSceneSetImages', 'uploadVenuePhoto', 'variantUploadOr400']) {
          const i = d.chain.indexOf(later);
          if (i !== -1) expect(i).toBeGreaterThan(at);
        }
      }
    });

    it('each of the forty-six of this change is among them', () => {
      const admin = new Set(declarations.filter((d) => /authorize\(\['ADMIN'\]\)/.test(d.chain)).map((d) => d.key));
      const generic = (p) => p.replace('/api/v1/scene-sets', '').split(set).join(':id').split(angle).join(':angleId')
        .replace('/look-variants/time/night', '/look-variants/:kind/:value');
      for (const [, method, urlPath] of ROUTES.slice(0, 46)) expect(admin.has(`${method} ${generic(urlPath)}`)).toBe(true);
    });

    it('generate-venue is declared once, with authorize before the rate limiter, and its router is mounted once', () => {
      const venue = src(path.join('worldEvents', 'venue.js'));
      const found = venue.match(/router\.post\('\/world\/:showId\/events\/:eventId\/generate-venue',[^\n]*/g) || [];
      expect(found).toHaveLength(1);
      expect(found[0]).toMatch(/generate-venue', requireAuth, authorize\(\['ADMIN'\]\), aiRateLimiter, async/);
      expect((src(path.join('worldEvents', 'index.js')).match(/require\('\.\/venue'\)/g) || [])).toHaveLength(1);
    });
  });

  describe("reads, and the two POSTs that only read, stay any signed-in account's", () => {
    const READS = [
      ['sets list', `/api/v1/scene-sets?show_id=${show}`],
      ['generation-check', '/api/v1/scene-sets/generation-check'],
      ['base-models', '/api/v1/scene-sets/base-models'],
      ['model-comparison list', '/api/v1/scene-sets/model-comparison'],
      ['artifact-categories', '/api/v1/scene-sets/artifact-categories'],
      ['templates list', '/api/v1/scene-sets/templates/list'],
      ['by-type', '/api/v1/scene-sets/by-type/EVENT_LOCATION'],
      ['for-beat', `/api/v1/scene-sets/for-beat/1?show_id=${show}`],
      ['one set', SETS],
      ['version-options', `${SETS}/version-options`],
      ['uses', `${SETS}/uses`],
      ['preview-prompt', `${SETS}/preview-prompt`],
      ['jobs of a set', `/api/v1/scene-sets/jobs/set/${set}`],
      ['one job', `/api/v1/scene-sets/jobs/${uuid()}`],
      ['look-variants list', `${SETS}/look-variants`],
      ['spec', `${SETS}/spec`],
      ['canvas', `${SETS}/canvas`],
      ['angle history', `${ANGLE}/history`],
      ['comparison', `${SETS}/comparison`],
    ];
    it.each(READS)('%s: an editor and a viewer are answered as an admin is', async (_label, urlPath) => {
      const admin = await as('admin')(request(app).get(urlPath));
      expect([401, 403]).not.toContain(admin.status);
      for (const who of ['editor', 'viewer']) {
        const res = await as(who)(request(app).get(urlPath));
        expect(res.status).toBe(admin.status);
        expect(res.body?.code).not.toBe('AUTH_GROUP_REQUIRED');
      }
    });

    it.each([
      ['the set brief', `${SETS}/brief`],
      ['the look-variant estimate', `${VARIANT}/estimate`],
    ])('%s still answers someone who is not an admin, as it answers an admin, and writes nothing', async (_label, urlPath) => {
      const admin = await as('admin')(request(app).post(urlPath)).send({});
      expect([401, 403]).not.toContain(admin.status);
      for (const who of ['editor', 'viewer']) {
        const before = await snapshot();
        const trace = lockTrace.install(sequelize);
        let res;
        try { res = await as(who)(request(app).post(urlPath)).send({}); } finally { trace.uninstall(); }
        expect(res.status).toBe(admin.status);
        expect(res.body?.code).not.toBe('AUTH_GROUP_REQUIRED');
        expect(writesIn(trace.records)).toEqual([]);
        expect(await snapshot()).toEqual(before);
        expect(providersCalled()).toBe(0);
      }
    });
  });

  describe('generate-venue and the Place lock', () => {
    // Evoni, 2026-11-22: on an event whose episode is accepted nothing is
    // generated: not a new venue, `force` or not, and not the missing base of
    // the set the event has. "Already available" is answered as before, on a
    // locked event too. An event whose Place is not locked is as on main.
    const saved = {};
    const made = {};
    let PNG;
    const LOCKED = { success: false, code: PLACE_LOCKED_CODE, error: PLACE_LOCKED_MESSAGE };
    const BASE = 'https://x/p2b-venue-base.jpg';
    const falCalls = () => axios.post.mock.calls.filter(([u]) => String(u).startsWith('https://fal.run/'));
    const eventRow = async (id) => (await rows('SELECT * FROM world_events WHERE id = :id', { id }))[0];
    const setRow = async (id) => (await rows('SELECT * FROM scene_sets WHERE id = :id', { id }))[0];
    const setCount = async () => (await rows('SELECT COUNT(*)::int AS n FROM scene_sets WHERE show_id = :show', { show }))[0].n;
    const generate = (who, eventId, body = {}) => as(who)(request(app).post(VENUE(eventId))).send(body);

    // The episode an event belongs to.
    const EPISODES = {
      accepted: { episode: true, accepted: true },
      draft: { episode: true },
      // Footage and not accepted: not locked by the existing lock, and not
      // changed here (S2 tracks it).
      filmed: { episode: true, filmed: true },
      unlinked: {},
    };
    // What the event has, and what is asked.
    const ASKS = {
      available: { withSet: true, base: BASE, body: {} },
      noBase: { withSet: true, base: null, body: {} },
      noSet: { withSet: false, body: {} },
      force: { withSet: true, base: BASE, body: { force: true } },
    };
    // [episode, ask, what is expected]
    const TABLE = [
      ['accepted', 'available', 'already_available'],
      ['accepted', 'noBase', 'locked'],
      ['accepted', 'noSet', 'locked'],
      ['accepted', 'force', 'locked'],
      ['draft', 'available', 'already_available'],
      ['draft', 'noBase', 'base'],
      ['draft', 'noSet', 'venue'],
      ['draft', 'force', 'venue'],
      ['filmed', 'available', 'already_available'],
      ['filmed', 'noBase', 'base'],
      ['filmed', 'noSet', 'venue'],
      ['filmed', 'force', 'venue'],
      ['unlinked', 'available', 'already_available'],
      ['unlinked', 'noBase', 'base'],
      ['unlinked', 'noSet', 'venue'],
      ['unlinked', 'force', 'venue'],
    ];

    async function makeEvent(name, { episode = false, accepted = false, filmed = false, withSet = false, base = null } = {}) {
      const id = uuid();
      let episodeId = null;
      if (episode) {
        episodeId = uuid();
        await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, evaluation_status, created_at, updated_at)
                   VALUES (:episodeId, :show, :title, :n, 'draft', :evaluation, NOW(), NOW())`,
        { episodeId, show, title: `P2b ${name}`, n: Math.floor(Math.random() * 100000) + 700, evaluation: accepted ? 'accepted' : null });
        if (filmed) {
          await run(`INSERT INTO episode_raw_clips (episode_id, show_id, performer, s3_key_raw) VALUES (:episodeId, :show, 'lala', :key)`,
            { episodeId, show, key: `raw/${episodeId}/take.mp4` });
        }
      }
      let setId = null;
      const setName = `P2b ${name} set ${TAG}`;
      if (withSet) {
        setId = uuid();
        await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, world_location_id, base_still_url, created_at, updated_at)
                   VALUES (:setId, :setName, 'EVENT_LOCATION', :show, :location, :base, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day')`,
        { setId, show, location, base, setName });
      }
      const eventName = `P2b ${name} ${TAG}`;
      await run(`INSERT INTO world_events (id, show_id, name, event_type, prestige, status, venue_location_id, venue_name, scene_set_id, used_in_episode_id, created_at, updated_at)
                 VALUES (:id, :show, :eventName, 'invite', 5, 'ready', :location, 'The hall', :setId, :episodeId, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day')`,
      { id, show, location, setId, episodeId, eventName });
      return { id, episodeId, setId, setName, eventName };
    }

    beforeAll(async () => {
      PNG = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#ffffff' } }).png().toBuffer();
      for (const [episode, ask] of TABLE) {
        made[`${episode}/${ask}`] = await makeEvent(`${episode} ${ask}`, { ...EPISODES[episode], ...ASKS[ask] });
      }
    });
    beforeEach(() => {
      for (const k of ['FAL_KEY', 'AI_DAILY_IMAGE_BUDGET_USD', 'AI_DAILY_BUDGET_USD']) saved[k] = process.env[k];
      process.env.FAL_KEY = 'test-fal';
      process.env.AI_DAILY_IMAGE_BUDGET_USD = '100000';
      process.env.AI_DAILY_BUDGET_USD = '100000';
      // Provider doubles: no request leaves the process. A real (tiny) image,
      // since the base path stores it through sharp.
      axios.get.mockImplementation(async () => ({ data: PNG }));
      axios.post.mockImplementation(async (url) => {
        if (String(url).startsWith('https://fal.run/')) return { status: 200, data: { images: [{ url: `https://fal.media/p2b-${axios.post.mock.calls.length}.jpg` }] } };
        throw new Error(`unexpected provider call ${url}`);
      });
    });
    afterEach(() => {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    });

    // The refusal, and that nothing at all was done: no provider call,
    // nothing put to or deleted from storage, no statement that writes, no
    // new scene set, and the event, sets, angles, plans, set links and
    // scenes whole as they were (updated_at included).
    async function expectLocked(target, body) {
      const before = await snapshot();
      const event = await eventRow(target.id);
      const sets = await setCount();
      const trace = lockTrace.install(sequelize);
      let res;
      try { res = await generate('admin', target.id, body); } finally { trace.uninstall(); }
      expect(res.status).toBe(409);
      expect(res.body).toEqual(LOCKED);
      expect(providersCalled()).toBe(0);
      expect(mockS3Send).not.toHaveBeenCalled();
      expect(writesIn(trace.records)).toEqual([]);
      expect(await setCount()).toBe(sets);
      expect(await eventRow(target.id)).toEqual(event);
      expect(await snapshot()).toEqual(before);
    }

    describe.each(TABLE)('an admin, the event of an episode that is %s, asked "%s"', (episode, ask, expected) => {
      const target = () => made[`${episode}/${ask}`];
      const body = ASKS[ask].body;

      if (expected === 'locked') {
        it("the Place lock's 409; nothing generated, stored, made or changed", async () => {
          await expectLocked(target(), body);
        });
        it('the same with no provider key set: the lock answers before the key is looked for', async () => {
          delete process.env.FAL_KEY;
          await expectLocked(target(), body);
        });
      }

      if (expected === 'already_available') {
        it('"already available", in the same words whatever the episode: nothing generated, nothing written', async () => {
          const t = target();
          const before = await snapshot();
          const trace = lockTrace.install(sequelize);
          let res;
          try { res = await generate('admin', t.id, body); } finally { trace.uninstall(); }
          expect(res.status).toBe(200);
          expect(res.body).toEqual({
            success: true,
            skipped: true,
            outcome: 'already_available',
            data: { kind: 'base', scene_set_id: t.setId, venue_image_url: BASE, venue_name: t.setName },
            message: `Venue images already available for "${t.eventName}": nothing generated`,
          });
          expect(providersCalled()).toBe(0);
          expect(writesIn(trace.records)).toEqual([]);
          expect(await snapshot()).toEqual(before);
        });
      }

      if (expected === 'base') {
        it('the missing base of the set the event has is generated, as on main: one provider call, the base stored on that set, the event still on it', async () => {
          const t = target();
          const sets = await setCount();
          const res = await generate('admin', t.id, body);
          expect(res.body.error).toBeUndefined();
          expect(res.status).toBe(200);
          expect(res.body).toMatchObject({ success: true, outcome: 'generated', data: { kind: 'base', scene_set_id: t.setId, venue_name: t.setName } });
          expect(res.body.skipped).toBeUndefined();
          expect(falCalls()).toHaveLength(1);
          const set = await setRow(t.setId);
          expect(set.base_still_url).toBeTruthy();
          expect(res.body.data.venue_image_url).toBe(set.base_still_url);
          expect(set.generation_status).toBe('complete');
          expect((await eventRow(t.id)).scene_set_id).toBe(t.setId);
          expect(await setCount()).toBe(sets);
        });
      }

      if (expected === 'venue') {
        it('a new venue is generated and the event is moved to it, as on main', async () => {
          const t = target();
          const sets = await setCount();
          const res = await generate('admin', t.id, body);
          expect(res.body.error).toBeUndefined();
          expect(res.status).toBe(200);
          expect(res.body).toMatchObject({ success: true, outcome: 'generated', data: { kind: 'venue' } });
          expect(falCalls().length).toBeGreaterThanOrEqual(1);
          expect(res.body.data.scene_set_id).toBeTruthy();
          expect(res.body.data.scene_set_id).not.toBe(t.setId);
          expect((await eventRow(t.id)).scene_set_id).toBe(res.body.data.scene_set_id);
          expect(await setCount()).toBe(sets + 1);
        });
      }
    });

    it('force sent as anything but true is not force: on the accepted event with its image, "already available"', async () => {
      const t = made['accepted/available'];
      for (const force of ['true', 1, { value: true }, [true]]) {
        const before = await snapshot();
        const res = await generate('admin', t.id, { force });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ success: true, skipped: true, outcome: 'already_available', data: { scene_set_id: t.setId } });
        expect(providersCalled()).toBe(0);
        expect(await snapshot()).toEqual(before);
      }
    });

    it('force: true on the accepted event whose set has no base: refused all the same', async () => {
      await expectLocked(made['accepted/noBase'], { force: true });
    });

    it.each(['accepted/force', 'accepted/noBase', 'accepted/noSet'])("someone who is not an admin, on %s: authorize's 403, not the lock's answer, and nothing done", async (key) => {
      for (const who of ['editor', 'viewer']) {
        const before = await snapshot();
        const res = await generate(who, made[key].id, { force: true });
        expect(res.status).toBe(403);
        expect(res.body).toEqual(AUTHORIZE_BODY);
        expect(providersCalled()).toBe(0);
        expect(await snapshot()).toEqual(before);
      }
    });
  });
});
