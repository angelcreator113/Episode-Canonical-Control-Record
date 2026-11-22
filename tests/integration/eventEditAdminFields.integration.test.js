/**
 * The event save, PUT /api/v1/world/:showId/events/:eventId: two of its
 * fields reach an episode, and changing them is an ADMIN's (Evoni,
 * 2026-11-22; docs/audit/F-AUTH-1_PlanAndStartEpisode_AdminOnly_Amendment_2026-11-22.md).
 *
 *   - used_in_episode_id: any change links, unlinks or moves an episode.
 *   - scene_set_id: a change needs an admin "when an episode is currently
 *     linked or would become linked through the same operation".
 *
 * The rule is judged on the normalized values against the locked row; a
 * value sent unchanged is not a change. A refusal is 403 for the whole
 * request, with nothing written, and its body names fields only. Every
 * other field of the event stays any signed-in account's.
 *
 * Through the real route and the real auth middleware, on the migrated
 * database. Every statement is recorded (tests/helpers/lockTrace) to show
 * that a refusal writes nothing.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const lockTrace = require('../helpers/lockTrace');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

const SENTENCE = 'Only an admin can link an event to an episode or change the place of an event that has an episode.';
const refusal = (fields) => ({ success: false, code: 'AUTH_GROUP_REQUIRED', error: SENTENCE, message: SENTENCE, fields });

// The shapes the route unwraps a value from, and the ways it reads "none".
const SHAPES = [['plain', (v) => v], ['{ id }', (v) => ({ id: v })], ['{ value }', (v) => ({ value: v })]];
const EMPTIES = [['null', null], ["''", ''], ["'null'", 'null'], ["'undefined'", 'undefined'], ['{ value: null }', { value: null }]];

(shouldSkip ? describe.skip : describe)("The event save: its episode-affecting fields are an admin's", () => {
  const show = uuid();
  const TITLE = `Secret title ${show.slice(0, 8)}`;
  const tokens = {};
  let ip = 0;
  const as = (who) => (r) => {
    ip += 1;
    const from = r.set('X-Forwarded-For', `10.92.${Math.floor(ip / 250) % 250}.${(ip % 250) + 1}`);
    return who ? from.set('Authorization', `Bearer ${tokens[who]}`) : from;
  };
  const put = (who, ev, body) => as(who)(request(app).put(`/api/v1/world/${show}/events/${ev}`)).send(body);

  /**
   * An event with two sets to choose from. linked: 'stamp' (its own
   * used_in_episode_id names a draft episode), 'brief' (only the episode's
   * brief names it), or null (no episode). A linked episode has its event
   * location, a beat at the event's set and that beat's scene.
   */
  async function world({ linked = 'stamp', evaluation = 'pending', filmed = false } = {}) {
    const w = { ev: uuid(), setA: uuid(), setB: uuid(), ep: null, otherEp: uuid(), number: null };
    for (const [id, name] of [[w.setA, 'Hall'], [w.setB, 'Garden']]) {
      await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, base_still_url, generation_status, created_at, updated_at)
                 VALUES (:id, :name, 'EVENT_LOCATION', :show, :url, 'complete', NOW(), NOW())`, { id, name, show, url: `https://x/${id}.jpg` });
    }
    const episode = async (id, title) => {
      const n = Math.floor(Math.random() * 1000000) + 700;
      await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, evaluation_status, created_at, updated_at)
               VALUES (:id, :show, :title, :n, 'draft', :evaluation, NOW(), NOW())`, { id, show, title, n, evaluation });
      return n;
    };
    await episode(w.otherEp, `Other ${TITLE}`);
    if (linked) { w.ep = uuid(); w.number = await episode(w.ep, TITLE); }
    // Filmed: a raw clip is on the episode (the freeze's own sign).
    if (linked && filmed) {
      await run(`INSERT INTO episode_raw_clips (episode_id, show_id, performer, s3_key_raw) VALUES (:ep, :show, 'lala', :key)`, { ep: w.ep, show, key: `raw/${w.ep}.mp4` });
    }
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, scene_set_id, used_in_episode_id, description, created_at, updated_at)
               VALUES (:ev, :show, 'Gala', 'invite', :status, 5, :setA, :link, 'as seeded', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour')`,
    { ev: w.ev, show, setA: w.setA, status: linked === 'stamp' ? 'used' : 'ready', link: linked === 'stamp' ? w.ep : null });
    if (linked) {
      await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, narrative_purpose, created_at, updated_at)
                 VALUES (gen_random_uuid(), :ep, :show, :ev, 'draft', 'as seeded', NOW(), NOW())`, { ep: w.ep, show, ev: w.ev });
      await run(`INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, role, sort_order, created_at, updated_at)
                 VALUES (gen_random_uuid(), :setA, :ep, 'event', 0, NOW(), NOW())`, { setA: w.setA, ep: w.ep });
      const plan = uuid();
      await run(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, scene_set_id, angle_label, sort_order, locked, ai_suggested, created_at, updated_at)
                 VALUES (:plan, :ep, 10, 'Arrival', :setA, 'WIDE', 10, false, true, NOW(), NOW())`, { plan, ep: w.ep, setA: w.setA });
      await run(`INSERT INTO scenes (id, episode_id, scene_number, title, scene_set_id, scene_plan_id, background_url, created_at, updated_at)
                 VALUES (gen_random_uuid(), :ep, 10, 'Arrival', :setA, :plan, :url, NOW(), NOW())`, { ep: w.ep, setA: w.setA, plan, url: `https://x/${w.setA}.jpg` });
    }
    return w;
  }
  // Every row the save could reach, whole (the event with its updated_at).
  const snapshot = async (w) => {
    const eps = [w.ep, w.otherEp].filter(Boolean);
    return {
      event: await rows('SELECT * FROM world_events WHERE id = :ev', { ev: w.ev }),
      briefs: await rows('SELECT * FROM episode_briefs WHERE episode_id IN (:eps) ORDER BY id', { eps }),
      plans: await rows('SELECT * FROM scene_plans WHERE episode_id IN (:eps) ORDER BY id', { eps }),
      links: await rows('SELECT * FROM scene_set_episodes WHERE episode_id IN (:eps) ORDER BY id', { eps }),
      scenes: await rows('SELECT * FROM scenes WHERE episode_id IN (:eps) ORDER BY id', { eps }),
      episodes: await rows('SELECT * FROM episodes WHERE id IN (:eps) ORDER BY id', { eps }),
    };
  };
  const eventRow = async (ev) => (await rows('SELECT name, description, status, scene_set_id, used_in_episode_id FROM world_events WHERE id = :ev', { ev }))[0];
  const writesIn = (records) => records.filter((r) => r.kind === 'write' || r.kind === 'insert'
    || (r.kind === 'other' && /^\s*(INSERT|UPDATE|DELETE)\b/i.test(r.sql || '')));

  /** Nothing of an episode in an answer: no id, no title, no number, no episode object. */
  function expectNoEpisodeIn(body, w) {
    const text = JSON.stringify(body);
    for (const secret of [w.ep, w.otherEp, TITLE].filter(Boolean)) expect(text).not.toContain(secret);
    expect(text).not.toMatch(/"episode"\s*:|"episode_number"\s*:|"episode_id"\s*:/);
    if (w.number != null) expect(text).not.toContain(`Episode ${w.number}`);
  }

  /** A save refused 403: the exact body, no statement that writes, every row as it was, nothing of the episode in the answer. */
  async function expectRefused(who, w, body, fields) {
    const before = await snapshot(w);
    const trace = lockTrace.install(sequelize);
    let res;
    try { res = await put(who, w.ev, body); } finally { trace.uninstall(); }
    expect(res.status).toBe(403);
    expect(res.body).toEqual(refusal(fields));
    expectNoEpisodeIn(res.body, w);
    expect(writesIn(trace.records)).toEqual([]);
    expect(await snapshot(w)).toEqual(before);
  }

  beforeAll(async () => {
    tokens.editor = TokenService.generateTokenPair({ id: 'p1-edit-editor', email: 'editor@p1-edit.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    tokens.viewer = TokenService.generateTokenPair({ id: 'p1-edit-viewer', email: 'viewer@p1-edit.dev', name: 'Viewer', groups: ['VIEWER'], role: 'USER' }).accessToken;
    tokens.admin = TokenService.generateTokenPair({ id: 'p1-edit-admin', email: 'admin@p1-edit.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, '{}', NOW(), NOW())`,
      { show, name: `P1 edit ${show.slice(0, 8)}`, slug: `p1-edit-${show.slice(0, 8)}` });
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    const q = (sql) => sequelize.query(sql, { replacements: { show } }).catch(() => {});
    await q('DELETE FROM episode_raw_clips WHERE show_id = :show');
    await q('DELETE FROM scenes WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)');
    await q('DELETE FROM scene_plans WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)');
    await q('DELETE FROM scene_set_episodes WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)');
    await q('DELETE FROM episode_briefs WHERE show_id = :show');
    await q('UPDATE world_events SET used_in_episode_id = NULL, scene_set_id = NULL WHERE show_id = :show');
    await q('DELETE FROM episodes WHERE show_id = :show');
    await q('DELETE FROM world_events WHERE show_id = :show');
    await q('DELETE FROM scene_sets WHERE show_id = :show');
    await q('DELETE FROM shows WHERE id = :show');
    await sequelize.close();
  });

  it('signed out: 401, nothing written', async () => {
    const w = await world();
    const before = await snapshot(w);
    const res = await put(null, w.ev, { used_in_episode_id: null, scene_set_id: w.setB, name: 'Renamed' });
    expect(res.status).toBe(401);
    expect(await snapshot(w)).toEqual(before);
  });

  describe('an event with no episode (not an admin)', () => {
    it.each(SHAPES)('its place can be changed: scene_set_id as %s is saved', async (_name, shape) => {
      const w = await world({ linked: null });
      const res = await put('editor', w.ev, { scene_set_id: shape(w.setB) });
      expect(res.status).toBe(200);
      expect((await eventRow(w.ev)).scene_set_id).toBe(w.setB);
    });

    it.each(EMPTIES)('its place can be cleared: scene_set_id as %s, with the link re-sent as none', async (_name, empty) => {
      const w = await world({ linked: null });
      const res = await put('viewer', w.ev, { scene_set_id: empty, used_in_episode_id: empty });
      expect(res.status).toBe(200);
      expect(await eventRow(w.ev)).toMatchObject({ scene_set_id: null, used_in_episode_id: null });
    });

    it.each(SHAPES)('linking it to an episode is refused: used_in_episode_id as %s', async (_name, shape) => {
      const w = await world({ linked: null });
      await expectRefused('editor', w, { used_in_episode_id: shape(w.otherEp) }, ['used_in_episode_id']);
    });

    it.each(SHAPES)('linking it and changing its place in one save is refused for both fields (%s): it would become linked', async (_name, shape) => {
      const w = await world({ linked: null });
      await expectRefused('editor', w, { used_in_episode_id: shape(w.otherEp), scene_set_id: shape(w.setB) }, ['used_in_episode_id', 'scene_set_id']);
    });

    it('a link that names no episode at all is refused the same way, before any check of the reference', async () => {
      const w = await world({ linked: null });
      await expectRefused('editor', w, { used_in_episode_id: uuid() }, ['used_in_episode_id']);
      await expectRefused('editor', w, { used_in_episode_id: 'not-a-uuid' }, ['used_in_episode_id']);
    });
  });

  describe.each([['its own link', 'stamp'], ["only the episode's brief", 'brief']])('an event that has an episode, by %s (not an admin)', (_how, linked) => {
    it.each(SHAPES)('changing its place is refused: scene_set_id as %s', async (_name, shape) => {
      const w = await world({ linked });
      await expectRefused('editor', w, { scene_set_id: shape(w.setB) }, ['scene_set_id']);
    });

    it.each(EMPTIES)('clearing its place is refused: scene_set_id as %s', async (_name, empty) => {
      const w = await world({ linked });
      await expectRefused('viewer', w, { scene_set_id: empty }, ['scene_set_id']);
    });

    it('the stored values sent back are not a change: a full-form save of its other fields is saved', async () => {
      const w = await world({ linked });
      const stored = await eventRow(w.ev);
      for (const [, shape] of SHAPES) {
        const res = await put('editor', w.ev, {
          name: 'Renamed', scene_set_id: shape(stored.scene_set_id),
          used_in_episode_id: stored.used_in_episode_id ? shape(stored.used_in_episode_id) : null,
        });
        expect(res.status).toBe(200);
        expectNoEpisodeIn({ ...res.body, event: undefined }, w);
      }
      // The same id in capitals is the same place: saved, and the episode's
      // plan, set links and scenes do not move.
      const before = await snapshot(w);
      expect((await put('editor', w.ev, { description: 'Echoed in capitals', scene_set_id: stored.scene_set_id.toUpperCase() })).status).toBe(200);
      const after = await snapshot(w);
      for (const part of ['briefs', 'plans', 'links', 'scenes', 'episodes']) expect(after[part]).toEqual(before[part]);
      expect(await eventRow(w.ev)).toMatchObject({ name: 'Renamed', description: 'Echoed in capitals', scene_set_id: w.setA, used_in_episode_id: stored.used_in_episode_id });
    });
  });

  describe('an event linked to an episode by its own link (not an admin)', () => {
    it.each(EMPTIES)('unlinking it is refused: used_in_episode_id as %s', async (_name, empty) => {
      const w = await world();
      await expectRefused('editor', w, { used_in_episode_id: empty }, ['used_in_episode_id']);
    });

    it.each(SHAPES)('moving it to another episode is refused: used_in_episode_id as %s', async (_name, shape) => {
      const w = await world();
      await expectRefused('editor', w, { used_in_episode_id: shape(w.otherEp) }, ['used_in_episode_id']);
    });

    it('unlinking it and changing its place in one save is refused for both: it is linked now', async () => {
      const w = await world();
      await expectRefused('editor', w, { used_in_episode_id: null, scene_set_id: w.setB }, ['used_in_episode_id', 'scene_set_id']);
    });
  });

  describe('a mixed save (not an admin)', () => {
    it.each([
      ['a link change', (w) => ({ used_in_episode_id: w.otherEp }), ['used_in_episode_id']],
      ['an unlink', () => ({ used_in_episode_id: '' }), ['used_in_episode_id']],
      ['a place change', (w) => ({ scene_set_id: { id: w.setB } }), ['scene_set_id']],
    ])('%s sent with other fields: 403, and none of the other fields is saved', async (_name, gated, fields) => {
      const w = await world();
      await expectRefused('editor', w, {
        name: 'Renamed in the same save', description: 'Also sent', status: 'ready', prestige: 9, venue_name: 'Elsewhere',
        canon_consequences: { automation: { venue_name: 'Elsewhere' } }, ...gated(w),
      }, fields);
      expect(await eventRow(w.ev)).toMatchObject({ name: 'Gala', description: 'as seeded', status: 'used', scene_set_id: w.setA, used_in_episode_id: w.ep });
    });

    it('a key the route does not read (episode_id) is not a link: 400, as before, for anyone', async () => {
      const w = await world({ linked: null });
      for (const who of ['editor', 'admin']) {
        const res = await put(who, w.ev, { episode_id: w.otherEp });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('No valid fields to update');
      }
      expect((await eventRow(w.ev)).used_in_episode_id).toBeNull();
    });
  });

  describe('everything else about an event stays any signed-in account\'s', () => {
    it('an unstarted event: name, status, venue, a canon_consequences key and its deal fields are saved', async () => {
      const w = await world({ linked: null });
      const res = await put('editor', w.ev, {
        name: 'Spring Gala', status: 'draft', venue_name: 'The Orangery', description: 'Edited',
        canon_consequences: { automation: { host_brand: 'Maison' } }, is_paid: true, payment_amount: 500,
      });
      expect(res.status).toBe(200);
      const [row] = await rows('SELECT name, status, venue_name, description, is_paid, payment_amount, canon_consequences FROM world_events WHERE id = :ev', { ev: w.ev });
      expect(row).toMatchObject({ name: 'Spring Gala', status: 'draft', venue_name: 'The Orangery', description: 'Edited', is_paid: true, payment_amount: 500 });
      expect(row.canon_consequences.automation.host_brand).toBe('Maison');
    });

    it('an event with an episode: its name, description and venue are still saved', async () => {
      const w = await world();
      const res = await put('viewer', w.ev, { name: 'Gala night', description: 'Edited after Start', venue_name: 'The Orangery' });
      expect(res.status).toBe(200);
      expect(await eventRow(w.ev)).toMatchObject({ name: 'Gala night', description: 'Edited after Start', scene_set_id: w.setA, used_in_episode_id: w.ep });
    });
  });

  describe('the refusal comes before any answer that would describe the episode', () => {
    it('an accepted episode: an admin changing the place gets 409 PLACE_LOCKED; anyone else gets the 403', async () => {
      const w = await world({ evaluation: 'accepted' });
      await expectRefused('editor', w, { scene_set_id: w.setB }, ['scene_set_id']);
      const admin = await put('admin', w.ev, { scene_set_id: w.setB });
      expect(admin.status).toBe(409);
      expect(admin.body.code).toBe('PLACE_LOCKED');
    });

    it('a started event (terms locked): an admin changing the link gets its 409; anyone else gets the 403', async () => {
      const w = await world();
      await expectRefused('editor', w, { used_in_episode_id: w.otherEp }, ['used_in_episode_id']);
      await expectRefused('editor', w, { used_in_episode_id: null }, ['used_in_episode_id']);
      const admin = await put('admin', w.ev, { used_in_episode_id: null });
      expect(admin.status).toBe(409);
      expect(admin.body.code).not.toBe('AUTH_GROUP_REQUIRED');
      expect((await eventRow(w.ev)).used_in_episode_id).toBe(w.ep);
    });

    it('a stale save that carries such a change gets the 403, not the stale answer (which carries the event row and its link)', async () => {
      const w = await world();
      const stale = { expected_updated_at: '2001-01-01T00:00:00.000Z' };
      await expectRefused('editor', w, { scene_set_id: w.setB, ...stale }, ['scene_set_id']);
      await expectRefused('editor', w, { used_in_episode_id: { id: w.otherEp }, ...stale }, ['used_in_episode_id']);
      // A stale save of the event's own fields is answered as stale, as before.
      const own = await put('editor', w.ev, { name: 'Renamed', ...stale });
      expect(own.status).toBe(409);
      expect(own.body.code).not.toBe('AUTH_GROUP_REQUIRED');
      expect((await eventRow(w.ev)).name).toBe('Gala');
    });
  });

  // Evoni, 2026-11-22: "A non-admin request must not receive a 409 body that
  // discloses a linked episode merely because it echoes a wrapped stored
  // link." The terms lock compared the link as it was sent, so the stored
  // link sent back as { id } or { value } read as a change and was answered
  // with the lock's 409, whose body names the episode.
  describe.each([
    ['a started event (terms locked)', {}],
    ['an event whose episode is accepted', { evaluation: 'accepted' }],
    ['an event whose episode is filmed', { filmed: true }],
    ['an event whose episode is accepted and filmed', { evaluation: 'accepted', filmed: true }],
  ])('the stored link sent back, on %s', (_name, options) => {
    const ECHOES = [...SHAPES, ['in capitals', (v) => v.toUpperCase()], ['{ id } in capitals', (v) => ({ id: v.toUpperCase() })]];

    it.each(ECHOES)('not an admin, the link alone as %s: 200, nothing of the episode in the answer beyond the event\'s own row, nothing moved', async (_shape, shape) => {
      const w = await world(options);
      const before = await snapshot(w);
      const res = await put('editor', w.ev, { used_in_episode_id: shape(w.ep) });
      expect(res.status).toBe(200);
      expect(res.body.code).toBeUndefined();
      expectNoEpisodeIn({ ...res.body, event: undefined }, w);
      const after = await snapshot(w);
      for (const part of ['briefs', 'plans', 'links', 'scenes', 'episodes']) expect(after[part]).toEqual(before[part]);
      expect(await eventRow(w.ev)).toMatchObject({ name: 'Gala', scene_set_id: w.setA, used_in_episode_id: w.ep });
    });

    it.each(ECHOES)('not an admin, the link as %s with the place sent back and a field of the event: 200, the field saved', async (_shape, shape) => {
      const w = await world(options);
      const res = await put('viewer', w.ev, { used_in_episode_id: shape(w.ep), scene_set_id: shape(w.setA), name: 'Renamed', description: 'Edited' });
      expect(res.status).toBe(200);
      expect(await eventRow(w.ev)).toMatchObject({ name: 'Renamed', description: 'Edited', scene_set_id: w.setA, used_in_episode_id: w.ep });
    });

    it.each(ECHOES)('not an admin, the link as %s with a changed place: 403 for the place, nothing saved', async (_shape, shape) => {
      const w = await world(options);
      await expectRefused('editor', w, { used_in_episode_id: shape(w.ep), scene_set_id: w.setB, name: 'Renamed' }, ['scene_set_id']);
    });

    it.each(SHAPES)('not an admin, a real change of the link as %s: 403, alone or with other fields', async (_shape, shape) => {
      const w = await world(options);
      await expectRefused('editor', w, { used_in_episode_id: shape(w.otherEp) }, ['used_in_episode_id']);
      await expectRefused('editor', w, { used_in_episode_id: shape(w.otherEp), name: 'Renamed', description: 'Also sent' }, ['used_in_episode_id']);
      await expectRefused('viewer', w, { used_in_episode_id: shape(uuid()) }, ['used_in_episode_id']);
    });

    it.each(EMPTIES)('not an admin, the link cleared as %s: 403', async (_empty, empty) => {
      const w = await world(options);
      await expectRefused('editor', w, { used_in_episode_id: empty }, ['used_in_episode_id']);
    });

    it.each(ECHOES)('an admin, the link as %s: unchanged too (200); a real change is still the lock\'s 409', async (_shape, shape) => {
      const w = await world(options);
      const echo = await put('admin', w.ev, { used_in_episode_id: shape(w.ep), name: 'Renamed by admin' });
      expect(echo.status).toBe(200);
      expect(await eventRow(w.ev)).toMatchObject({ name: 'Renamed by admin', used_in_episode_id: w.ep });
      const cleared = await put('admin', w.ev, { used_in_episode_id: null });
      expect(cleared.status).toBe(409);
      expect(cleared.body.code).not.toBe('AUTH_GROUP_REQUIRED');
      expect((await eventRow(w.ev)).used_in_episode_id).toBe(w.ep);
    });
  });

  // Evoni, 2026-11-22: "An unauthorized request must receive 403 without
  // private episode details, regardless of stale version. Preserve existing
  // stale-save behavior for authorized event-only edits and ADMIN requests."
  describe('a save made from an older read of the event (expected_updated_at)', () => {
    const STALE = { expected_updated_at: '2001-01-01T00:00:00.000Z' };
    const expectStale = async (who, w, body) => {
      const before = await snapshot(w);
      const res = await put(who, w.ev, { ...body, ...STALE });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EVENT_CHANGED');
      expect(res.body.expected_updated_at).toBe(STALE.expected_updated_at);
      expect(await snapshot(w)).toEqual(before);
      return res;
    };

    it.each(SHAPES)('not an admin, a change of the link as %s: the 403, with no event row and nothing of the episode, nothing written', async (_name, shape) => {
      const w = await world();
      await expectRefused('editor', w, { used_in_episode_id: shape(w.otherEp), ...STALE }, ['used_in_episode_id']);
      await expectRefused('viewer', w, { used_in_episode_id: shape(w.otherEp), name: 'Renamed', ...STALE }, ['used_in_episode_id']);
    });

    it.each(EMPTIES)('not an admin, the link cleared as %s: the 403', async (_name, empty) => {
      const w = await world();
      await expectRefused('editor', w, { used_in_episode_id: empty, ...STALE }, ['used_in_episode_id']);
    });

    it.each(SHAPES)('not an admin, a change of the place of a linked event as %s: the 403', async (_name, shape) => {
      const w = await world();
      await expectRefused('editor', w, { scene_set_id: shape(w.setB), ...STALE }, ['scene_set_id']);
      await expectRefused('viewer', w, { scene_set_id: shape(w.setB), name: 'Renamed', description: 'Also sent', ...STALE }, ['scene_set_id']);
    });

    it('not an admin, an event with no episode being linked and placed: the 403 for both', async () => {
      const w = await world({ linked: null });
      await expectRefused('editor', w, { used_in_episode_id: w.otherEp, scene_set_id: w.setB, ...STALE }, ['used_in_episode_id', 'scene_set_id']);
    });

    it("not an admin, the event's own fields: answered as stale, as before, nothing written", async () => {
      const w = await world();
      await expectStale('editor', w, { name: 'Renamed', description: 'Edited' });
      const free = await world({ linked: null });
      await expectStale('viewer', free, { name: 'Renamed', scene_set_id: free.setB });
    });

    it.each([...SHAPES, ['in capitals', (v) => v.toUpperCase()]])('not an admin, the stored link and place sent back as %s with a field of the event: not a change of either, so answered as stale', async (_name, shape) => {
      const w = await world();
      await expectStale('editor', w, { used_in_episode_id: shape(w.ep), scene_set_id: shape(w.setA), name: 'Renamed' });
    });

    it('an admin: stale is stale, whatever the save carries, as before', async () => {
      const w = await world();
      await expectStale('admin', w, { name: 'Renamed' });
      await expectStale('admin', w, { scene_set_id: w.setB });
      await expectStale('admin', w, { used_in_episode_id: null, name: 'Renamed' });
      await expectStale('admin', w, { used_in_episode_id: { id: w.ep }, scene_set_id: { value: w.setB } });
    });
  });

  // The same id in another letter case is the same id, for both fields.
  describe.each([
    ['a draft episode', {}],
    ['an accepted episode', { evaluation: 'accepted' }],
  ])('ids that differ only in letter case, on the event of %s', (_name, options) => {
    it.each(['editor', 'admin'])('%s: the stored link and place in capitals are unchanged: 200, nothing of the episode moved', async (who) => {
      const w = await world(options);
      const before = await snapshot(w);
      for (const body of [
        { scene_set_id: w.setA.toUpperCase() },
        { used_in_episode_id: w.ep.toUpperCase() },
        { used_in_episode_id: { id: w.ep.toUpperCase() }, scene_set_id: { value: w.setA.toUpperCase() }, description: 'Edited' },
      ]) {
        const res = await put(who, w.ev, body);
        expect(res.status).toBe(200);
        expect(res.body.code).toBeUndefined();
      }
      const after = await snapshot(w);
      for (const part of ['briefs', 'plans', 'links', 'scenes', 'episodes']) expect(after[part]).toEqual(before[part]);
      expect(await eventRow(w.ev)).toMatchObject({ description: 'Edited', scene_set_id: w.setA, used_in_episode_id: w.ep });
    });
  });

  // A value the route does not read as the stored id is either refused as
  // malformed before anything is read (400, for anyone), or it is a change:
  // the 403 for someone who is not an admin. Neither names the episode.
  describe.each([
    ['a started event (terms locked)', {}],
    ['an event whose episode is accepted and filmed', { evaluation: 'accepted', filmed: true }],
  ])('the stored ids sent back in a shape the route does not unwrap, on %s (not an admin)', (_name, options) => {
    const MALFORMED = [
      ['{ id: { id } }', (v) => ({ id: { id: v } })],
      ['{ value: { id } }', (v) => ({ value: { id: v } })],
      ['{ value: { value } }', (v) => ({ value: { value: v } })],
      ['[id]', (v) => [v]],
      ['{ uuid }', (v) => ({ uuid: v })],
      ['a number', () => 12345],
      ['true', () => true],
    ];
    it.each(MALFORMED)('the link as %s: 400 before anything is read, nothing of the episode, nothing written', async (_shape, shape) => {
      const w = await world(options);
      const before = await snapshot(w);
      const res = await put('editor', w.ev, { used_in_episode_id: shape(w.ep), name: 'Renamed' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid value for used_in_episode_id');
      expectNoEpisodeIn(res.body, w);
      expect(await snapshot(w)).toEqual(before);
    });

    it.each(MALFORMED)('the place as %s: 400 before anything is read, nothing of the episode, nothing written', async (_shape, shape) => {
      const w = await world(options);
      const before = await snapshot(w);
      const res = await put('editor', w.ev, { scene_set_id: shape(w.setA), name: 'Renamed' });
      expect(res.status).toBe(400);
      expectNoEpisodeIn(res.body, w);
      expect(await snapshot(w)).toEqual(before);
    });

    it('the link padded with spaces is not the stored id: a change, so the 403', async () => {
      const w = await world(options);
      await expectRefused('editor', w, { used_in_episode_id: ` ${w.ep} `, name: 'Renamed' }, ['used_in_episode_id']);
      await expectRefused('editor', w, { used_in_episode_id: { id: `${w.ep}\n` } }, ['used_in_episode_id']);
    });

    it('the place padded with spaces is never answered with a body that names the episode, and nothing is written', async () => {
      const w = await world(options);
      const before = await snapshot(w);
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const res = await put('editor', w.ev, { scene_set_id: ` ${w.setA} `, name: 'Renamed' });
      expect(res.status).not.toBe(200);
      expect(res.status).not.toBe(409);
      expectNoEpisodeIn(res.body, w);
      expect(await snapshot(w)).toEqual(before);
    });
  });

  describe('an admin saves as before', () => {
    it('links an event to an episode, changes the place of a linked event (its draft episode follows), and unlinks one with no episode started from it', async () => {
      const free = await world({ linked: null });
      const linkedRes = await put('admin', free.ev, { used_in_episode_id: { id: free.otherEp }, scene_set_id: free.setB });
      expect(linkedRes.status).toBe(200);
      expect(await eventRow(free.ev)).toMatchObject({ used_in_episode_id: free.otherEp, scene_set_id: free.setB });

      const w = await world();
      const moved = await put('admin', w.ev, { scene_set_id: w.setB });
      expect(moved.status).toBe(200);
      expect((await eventRow(w.ev)).scene_set_id).toBe(w.setB);
      const [link] = await rows(`SELECT scene_set_id FROM scene_set_episodes WHERE episode_id = :ep AND role = 'event' AND deleted_at IS NULL`, { ep: w.ep });
      expect(link.scene_set_id).toBe(w.setB);
      const [plan] = await rows('SELECT scene_set_id, angle_label FROM scene_plans WHERE episode_id = :ep AND beat_number = 10', { ep: w.ep });
      expect(plan).toEqual({ scene_set_id: w.setB, angle_label: null });
    });
  });

  describe('the retry the route makes when a column is missing', () => {
    // The first UPDATE of the event is made to fail the way a missing column
    // does; the route then saves the core fields in a second transaction,
    // which asks the same question of the locked row.
    const failFirstUpdate = () => {
      const real = sequelize.query.bind(sequelize);
      let failed = 0;
      const spy = jest.spyOn(sequelize, 'query').mockImplementation((sql, options) => {
        if (typeof sql === 'string' && /^UPDATE world_events SET /.test(sql) && failed === 0) {
          failed += 1;
          return Promise.reject(new Error('column "venue_name" of relation "world_events" does not exist'));
        }
        return real(sql, options);
      });
      return { spy, attempts: () => spy.mock.calls.filter(([sql]) => typeof sql === 'string' && /^UPDATE world_events SET /.test(sql)).length };
    };

    it('not an admin, a place change on a linked event: 403 before any UPDATE is tried, in either transaction', async () => {
      const w = await world();
      const before = await snapshot(w);
      const rigged = failFirstUpdate();
      const res = await put('editor', w.ev, { name: 'Renamed', venue_name: 'Elsewhere', scene_set_id: w.setB });
      const attempts = rigged.attempts();
      rigged.spy.mockRestore();
      expect(res.status).toBe(403);
      expect(res.body).toEqual(refusal(['scene_set_id']));
      expect(attempts).toBe(0);
      expect(await snapshot(w)).toEqual(before);
    });

    it('not an admin, event-only fields: the retry saves them (the second transaction asks again and allows it)', async () => {
      const w = await world();
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const rigged = failFirstUpdate();
      const res = await put('editor', w.ev, { name: 'Renamed by retry', venue_name: 'Elsewhere' });
      const attempts = rigged.attempts();
      rigged.spy.mockRestore();
      expect(res.status).toBe(200);
      expect(attempts).toBe(2);
      expect(await eventRow(w.ev)).toMatchObject({ name: 'Renamed by retry', scene_set_id: w.setA, used_in_episode_id: w.ep });
    });

    it('a place change that became an admin\'s between the two transactions is refused by the second', async () => {
      // No episode when the first transaction checks; one links the event
      // before the retry's transaction checks again.
      const w = await world({ linked: null });
      const real = sequelize.query.bind(sequelize);
      let failed = 0;
      const spy = jest.spyOn(sequelize, 'query').mockImplementation(async (sql, options) => {
        if (typeof sql === 'string' && /^UPDATE world_events SET /.test(sql) && failed === 0) {
          failed += 1;
          throw new Error('column "venue_name" of relation "world_events" does not exist');
        }
        if (typeof sql === 'string' && /^ROLLBACK/.test(sql) && failed === 1) {
          const out = await real(sql, options);
          failed += 1;
          await real('UPDATE world_events SET used_in_episode_id = :ep WHERE id = :ev', { replacements: { ep: w.otherEp, ev: w.ev } });
          return out;
        }
        return real(sql, options);
      });
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const res = await put('editor', w.ev, { name: 'Renamed', venue_name: 'Elsewhere', scene_set_id: w.setB });
      spy.mockRestore();
      expect(res.status).toBe(403);
      expect(res.body).toEqual(refusal(['scene_set_id']));
      expect(await eventRow(w.ev)).toMatchObject({ name: 'Gala', scene_set_id: w.setA, used_in_episode_id: w.otherEp });
    });
  });
});
