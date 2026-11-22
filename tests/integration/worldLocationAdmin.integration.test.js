/**
 * World Location writes are an ADMIN's, and a location anything live uses is
 * not deleted (Evoni, 2026-11-22), against the test database.
 *
 * Two routes delete a World Location:
 *   DELETE /api/v1/world/locations/:id               (routes/worldStudio.js)
 *   DELETE /api/v1/tier/world-locations/:locationId  (routes/tierFeatures.js)
 * Both asked for a sign-in only and hard-deleted the row, whatever used it:
 * the foreign keys are ON DELETE SET NULL, so scene sets, event venues,
 * calendar events and profile homes were unlinked in silence, the Place lock
 * and the approved base were gone round, and a location with a location
 * inside it answered 500 with the database's message.
 *
 * Now both are an ADMIN's and use one function (services/approvedBaseService
 * deleteWorldLocation): one transaction, the location row locked FOR UPDATE,
 * a 409 with nothing changed when anything live uses it (PLACE_LOCKED, then
 * the approved base, then LOCATION_IN_USE), no override. The create, update,
 * studio-types and seed routes beside them are an ADMIN's too.
 *
 * Nothing here calls a provider or the object storage; the suite asserts it.
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

const crypto = require('crypto');
const request = require('supertest');
const axios = require('axios');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const lockTrace = require('../helpers/lockTrace');
const { PLACE_LOCKED_CODE } = require('../../src/utils/placeLock');
const { LOCATION_IN_USE_CODE } = require('../../src/services/approvedBaseService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

(shouldSkip ? describe.skip : describe)('World Location writes are an ADMIN\'s; a location in use is not deleted', () => {
  const tag = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
  const uuid = () => crypto.randomUUID();
  const show = uuid();
  const NON_ADMINS = ['editor', 'viewer', 'nogroup'];
  // Each delete route, and what it has always answered when it deletes.
  const DELETES = [
    ['/api/v1/world/locations', { deleted: true }],
    ['/api/v1/tier/world-locations', { success: true }],
  ];
  const NO_USES = {
    child_locations: 0, scene_sets: 0, events: 0, looks: 0, look_variants: 0,
    calendar_events: 0, profile_homes: 0, profile_venues: 0, feed_posts: 0, timeline_events: 0,
  };
  const tokens = {};
  // Every row the suite makes, by table, for the "nothing changed" reads and the cleanup.
  const made = {
    world_locations: [], scene_sets: [], world_events: [], episodes: [], scene_set_looks: [], location_look_variants: [],
    story_calendar_events: [], social_profiles: [], feed_posts: [], world_timeline_events: [],
  };
  let ipN = 0;
  let n = 0;

  const run = (sql, replacements = {}, options = {}) => sequelize.query(sql, { replacements, ...options });
  const rows = async (sql, replacements = {}) => (await run(sql, replacements))[0];
  const send = (method, who, path, body) => {
    ipN += 1;
    const r = request(app)[method](path).set('X-Forwarded-For', `198.51.182.${(ipN % 200) + 1}`);
    const signed = tokens[who] ? r.set('Authorization', `Bearer ${tokens[who]}`) : r;
    return body === undefined ? signed : signed.send(body);
  };
  const del = (who, base, id) => send('delete', who, `${base}/${id}`);

  /** Every row the suite made, every column: what a refused request must leave as it was. */
  const state = async () => {
    const out = {};
    for (const [table, ids] of Object.entries(made)) {
      // eslint-disable-next-line no-await-in-loop
      out[table] = ids.length ? await rows(`SELECT * FROM ${table} WHERE id IN (:ids) ORDER BY id`, { ids }) : [];
    }
    return out;
  };
  const locationRow = async (id) => (await rows('SELECT * FROM world_locations WHERE id = :id', { id }))[0] || null;
  const deleteEntries = (id) => rows(
    'SELECT user_id, action, resource_type, resource_id, changes FROM activity_logs WHERE resource_type = \'world_location\' AND resource_id = :id ORDER BY id',
    { id: String(id) });
  const providersCalled = () => [
    mockAnthropic, mockReplicateRun, axios.post, axios.get, axios.put, axios.delete, axios.request, mockS3Send,
  ].reduce((sum, fn) => sum + fn.mock.calls.length, 0);
  const writesIn = (records) => records.filter((r) => r.kind === 'write' || r.kind === 'insert'
    || (r.kind === 'other' && /^\s*(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|CREATE|DROP)\b/i.test(r.sql || '')));

  // ── Fixtures ────────────────────────────────────────────────────────────
  const mkLocation = async (extra = {}) => {
    const id = uuid();
    n += 1;
    const name = extra.name || `ZZ${tag} place ${n}`;
    await run(`INSERT INTO world_locations (id, name, slug, location_type, parent_location_id, approved_base_scene_set_id,
                                           approved_base_image_url, approved_base_at, deleted_at, created_at, updated_at)
               VALUES (:id, :name, :slug, :type, :parent, :baseSet, :baseUrl, :baseAt, :deletedAt, NOW(), NOW())`,
    {
      id, name, slug: `zz-${tag}-${n}`, type: extra.location_type || 'venue', parent: extra.parent || null,
      baseSet: extra.baseSet || null, baseUrl: extra.baseUrl || null, baseAt: extra.baseSet || extra.baseUrl ? new Date() : null,
      deletedAt: extra.deleted ? new Date() : null,
    });
    made.world_locations.push(id);
    return { id, name };
  };
  const mkSet = async (locationId, { deleted = false } = {}) => {
    const id = uuid();
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, world_location_id, generation_status, deleted_at, created_at, updated_at)
               VALUES (:id, :name, 'EVENT_LOCATION', :show, :loc, 'pending', :deletedAt, NOW(), NOW())`,
    { id, name: `ZZ${tag} set`, show, loc: locationId, deletedAt: deleted ? new Date() : null });
    made.scene_sets.push(id);
    return id;
  };
  const mkEpisode = async (evaluation) => {
    const id = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, evaluation_status, created_at, updated_at)
               VALUES (:id, :show, :title, :num, 'draft', :evaluation, NOW(), NOW())`,
    { id, show, title: `ZZ${tag} episode`, num: Math.floor(Math.random() * 900000) + 1000, evaluation });
    made.episodes.push(id);
    return id;
  };
  const mkEvent = async ({ venue = null, automation = null, set = null, episode = null, deleted = false } = {}) => {
    const id = uuid();
    n += 1;
    const name = `ZZ${tag} event ${n}`;
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, venue_location_id, scene_set_id,
                                        used_in_episode_id, canon_consequences, deleted_at, created_at, updated_at)
               VALUES (:id, :show, :name, 'invite', 'draft', 5, :venue, :set, :episode, CAST(:canon AS jsonb), :deletedAt, NOW(), NOW())`,
    {
      id, show, name, venue, set, episode, deletedAt: deleted ? new Date() : null,
      canon: JSON.stringify(automation ? { automation: { venue_location_id: automation } } : {}),
    });
    made.world_events.push(id);
    return { id, name };
  };
  const mkLook = async (setId, eventId, locationId, { deleted = false } = {}) => {
    const id = uuid();
    await run(`INSERT INTO scene_set_looks (id, scene_set_id, event_id, brief, deleted_at, created_at, updated_at)
               VALUES (:id, :setId, :eventId, CAST(:brief AS jsonb), :deletedAt, NOW(), NOW())`,
    { id, setId, eventId, brief: JSON.stringify({ world_location_id: locationId }), deletedAt: deleted ? new Date() : null });
    made.scene_set_looks.push(id);
    return id;
  };
  const mkVariant = async (locationId, { deleted = false } = {}) => {
    const id = uuid();
    n += 1;
    await run(`INSERT INTO location_look_variants (id, world_location_id, kind, value, deleted_at, created_at, updated_at)
               VALUES (:id, :loc, 'time', :value, :deletedAt, NOW(), NOW())`,
    { id, loc: locationId, value: `zz-${tag}-${n}`, deletedAt: deleted ? new Date() : null });
    made.location_look_variants.push(id);
    return id;
  };
  const mkCalendarEvent = async (locationId) => {
    const id = uuid();
    await run(`INSERT INTO story_calendar_events (id, title, event_type, start_datetime, location_id, created_at, updated_at)
               VALUES (:id, :title, 'world_event', NOW(), :loc, NOW(), NOW())`, { id, title: `ZZ${tag} calendar`, loc: locationId });
    made.story_calendar_events.push(id);
    return id;
  };
  const mkProfile = async ({ home = null, venues = null, deleted = false } = {}) => {
    n += 1;
    const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, home_location_id, frequent_venues, deleted_at, created_at, updated_at)
               VALUES (:handle, 'instagram', 'a test profile', :home, CAST(:venues AS jsonb), :deletedAt, NOW(), NOW()) RETURNING id`,
    { handle: `zz_${tag}_${n}`, home, venues: venues ? JSON.stringify(venues) : null, deletedAt: deleted ? new Date() : null });
    made.social_profiles.push(row.id);
    return row.id;
  };
  const mkFeedPost = async (locationId, { deleted = false } = {}) => {
    const id = uuid();
    await run(`INSERT INTO feed_posts (id, show_id, poster_handle, place_location_id, deleted_at, created_at, updated_at)
               VALUES (:id, :show, :handle, :loc, :deletedAt, NOW(), NOW())`,
    { id, show, handle: `zz_${tag}`, loc: locationId, deletedAt: deleted ? new Date() : null });
    made.feed_posts.push(id);
    return id;
  };
  const mkTimelineEvent = async (locationId, { deleted = false } = {}) => {
    const id = uuid();
    await run(`INSERT INTO world_timeline_events (id, event_name, location_id, deleted_at, created_at, updated_at)
               VALUES (:id, :name, :loc, :deletedAt, NOW(), NOW())`,
    { id, name: `ZZ${tag} timeline`, loc: locationId, deletedAt: deleted ? new Date() : null });
    made.world_timeline_events.push(id);
    return id;
  };

  const inUse = (location, uses, sentence) => ({
    success: false, code: LOCATION_IN_USE_CODE, uses: { ...NO_USES, ...uses },
    error: `${location.name} is used by ${sentence}. Nothing was deleted.`,
  });
  const placeLocked = (event) => ({
    success: false, code: PLACE_LOCKED_CODE, locked_events: [{ id: event.id, name: event.name }],
    error: `${event.name} is held here and its episode is accepted: the place is locked, so this location stays. Nothing was deleted.`,
  });
  const approvedBase = (location) => ({
    success: false,
    error: `${location.name} has an approved base. Un-approve it in Scene Sets before deleting the location. Nothing was deleted.`,
    approved_base_of: { world_location_id: location.id, name: location.name },
  });

  // Each: a location with one thing that uses it, and the 409 body both routes must send.
  const REFUSALS = [
    ['a Place-locked event (accepted episode) whose venue it is', async () => {
      const location = await mkLocation();
      const event = await mkEvent({ venue: location.id, episode: await mkEpisode('accepted') });
      return { location, body: placeLocked(event) };
    }],
    ['a Place-locked event (accepted episode) held at one of its sets', async () => {
      const location = await mkLocation();
      const event = await mkEvent({ set: await mkSet(location.id), episode: await mkEpisode('accepted') });
      return { location, body: placeLocked(event) };
    }],
    ['a Place-locked event (accepted episode) that names it only in its automation copy', async () => {
      const location = await mkLocation();
      const event = await mkEvent({ automation: location.id, episode: await mkEpisode('accepted') });
      return { location, body: placeLocked(event) };
    }],
    ['a Place-locked event, an approved base and a location inside it: the Place lock is named first', async () => {
      const location = await mkLocation({ baseSet: uuid(), baseUrl: 'https://x.test/approved.jpg' });
      await mkLocation({ parent: location.id });
      const event = await mkEvent({ venue: location.id, episode: await mkEpisode('accepted') });
      return { location, body: placeLocked(event) };
    }],
    ['an approved base (set and image)', async () => {
      const location = await mkLocation({ baseSet: uuid(), baseUrl: 'https://x.test/approved.jpg' });
      return { location, body: approvedBase(location) };
    }],
    ['an approved base set id alone, with no image (a partial, older state)', async () => {
      const location = await mkLocation({ baseSet: uuid() });
      return { location, body: approvedBase(location) };
    }],
    ['an approved base image alone', async () => {
      const location = await mkLocation({ baseUrl: 'https://x.test/approved-only.jpg' });
      return { location, body: approvedBase(location) };
    }],
    ['an approved base, a scene set and a location inside it: the approved base is named before the uses', async () => {
      const location = await mkLocation({ baseSet: uuid(), baseUrl: 'https://x.test/approved.jpg' });
      await mkSet(location.id);
      await mkLocation({ parent: location.id });
      return { location, body: approvedBase(location) };
    }],
    ['a location inside it (a 409, where it was a 500 with the database\'s message)', async () => {
      const location = await mkLocation();
      await mkLocation({ parent: location.id });
      return { location, body: inUse(location, { child_locations: 1 }, '1 location inside it') };
    }],
    ['a soft-deleted location inside it (its foreign key still blocks the delete in the database)', async () => {
      const location = await mkLocation();
      await mkLocation({ parent: location.id, deleted: true });
      return { location, body: inUse(location, { child_locations: 1 }, '1 location inside it') };
    }],
    ['a scene set', async () => {
      const location = await mkLocation();
      await mkSet(location.id);
      return { location, body: inUse(location, { scene_sets: 1 }, '1 scene set') };
    }],
    ['an event whose venue it is, its episode not accepted', async () => {
      const location = await mkLocation();
      await mkEvent({ venue: location.id, episode: await mkEpisode('pending') });
      return { location, body: inUse(location, { events: 1 }, '1 event') };
    }],
    ['an event that names it only in its automation copy (canon_consequences.automation.venue_location_id)', async () => {
      const location = await mkLocation();
      await mkEvent({ automation: location.id });
      return { location, body: inUse(location, { events: 1 }, '1 event') };
    }],
    ['an event look whose brief records it', async () => {
      const location = await mkLocation();
      const elsewhere = await mkLocation();
      const event = await mkEvent({});
      await mkLook(await mkSet(elsewhere.id), event.id, location.id);
      return { location, body: inUse(location, { looks: 1 }, '1 event look') };
    }],
    ['a look variant', async () => {
      const location = await mkLocation();
      await mkVariant(location.id);
      return { location, body: inUse(location, { look_variants: 1 }, '1 look variant') };
    }],
    ['a calendar event', async () => {
      const location = await mkLocation();
      await mkCalendarEvent(location.id);
      return { location, body: inUse(location, { calendar_events: 1 }, '1 calendar event') };
    }],
    ['a profile whose home it is', async () => {
      const location = await mkLocation();
      await mkProfile({ home: location.id });
      return { location, body: inUse(location, { profile_homes: 1 }, '1 profile based there') };
    }],
    ['a profile that lists it in frequent_venues', async () => {
      const location = await mkLocation();
      await mkProfile({ venues: [uuid(), location.id] });
      return { location, body: inUse(location, { profile_venues: 1 }, '1 profile that goes there') };
    }],
    ['a feed post placed there', async () => {
      const location = await mkLocation();
      await mkFeedPost(location.id);
      return { location, body: inUse(location, { feed_posts: 1 }, '1 feed post') };
    }],
    ['a timeline event', async () => {
      const location = await mkLocation();
      await mkTimelineEvent(location.id);
      return { location, body: inUse(location, { timeline_events: 1 }, '1 timeline event') };
    }],
    ['several kinds at once: each is counted and named', async () => {
      const location = await mkLocation();
      await mkSet(location.id);
      await mkSet(location.id);
      await mkEvent({ venue: location.id });
      await mkLocation({ parent: location.id });
      await mkFeedPost(location.id);
      return {
        location,
        body: inUse(location, { child_locations: 1, scene_sets: 2, events: 1, feed_posts: 1 },
          '1 location inside it, 2 scene sets, 1 event and 1 feed post'),
      };
    }],
  ];

  beforeAll(async () => {
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@wloc.dev`, name: id, groups, role }).accessToken;
    tokens.editor = token(`editor-${tag}`, ['USER', 'EDITOR'], 'USER');
    tokens.viewer = token(`viewer-${tag}`, ['viewer'], 'USER');
    tokens.nogroup = token(`nogroup-${tag}`, [], undefined);
    tokens.admin = token(`admin-${tag}`, ['ADMIN'], 'ADMIN');
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :name, NOW(), NOW())', { show, name: `wloc-${tag}` });
  });

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    // Only the rows this suite made, by id; referrers before what they refer to.
    const drop = async (table, where = 'id IN (:ids)') => {
      if (!made[table].length) return;
      await run(`DELETE FROM ${table} WHERE ${where}`, { ids: made[table] }).catch((err) => console.error(`[cleanup] ${table}:`, err.message));
    };
    await drop('scene_set_looks');
    await drop('location_look_variants');
    await drop('story_calendar_events');
    await drop('social_profiles');
    await drop('feed_posts');
    await drop('world_timeline_events');
    await drop('world_events');
    await drop('scene_sets');
    await drop('episodes');
    await drop('world_locations', 'id IN (:ids) AND parent_location_id IS NOT NULL');
    await drop('world_locations');
    await run('DELETE FROM activity_logs WHERE resource_type = \'world_location\' AND resource_id IN (:ids)', { ids: made.world_locations.map(String) })
      .catch((err) => console.error('[cleanup] activity_logs:', err.message));
    await run('DELETE FROM shows WHERE id = :show', { show }).catch((err) => console.error('[cleanup] shows:', err.message));
  });

  // ── Who may delete ──────────────────────────────────────────────────────
  describe.each(DELETES)('DELETE %s/:id: who may ask', (base) => {
    let location;
    let before;
    beforeEach(async () => {
      location = await mkLocation();
      await mkSet(location.id);
      await mkLocation({ parent: location.id });
      before = await state();
    });

    test('signed out: 401, and the location and what uses it are as they were', async () => {
      const res = await del(null, base, location.id);
      expect(res.status).toBe(401);
      expect(await state()).toEqual(before);
    });

    test.each(NON_ADMINS)('signed in as %s, not an admin: 403 AUTH_GROUP_REQUIRED before the handler, nothing changed', async (who) => {
      const trace = lockTrace.install(sequelize);
      let res;
      try { res = await del(who, base, location.id); } finally { trace.uninstall(); }
      expect({ status: res.status, code: res.body.code }).toEqual({ status: 403, code: 'AUTH_GROUP_REQUIRED' });
      expect(trace.records).toEqual([]);
      expect(await state()).toEqual(before);
    });

    test.each(NON_ADMINS)('signed in as %s: a location nothing uses is refused all the same and stays', async (who) => {
      const free = await mkLocation();
      const res = await del(who, base, free.id);
      expect({ status: res.status, code: res.body.code }).toEqual({ status: 403, code: 'AUTH_GROUP_REQUIRED' });
      expect(await locationRow(free.id)).not.toBeNull();
      expect(await deleteEntries(free.id)).toEqual([]);
    });
  });

  // ── An ADMIN, a location nothing uses ───────────────────────────────────
  describe.each(DELETES)('DELETE %s/:id as an ADMIN', (base, deletedBody) => {
    test('a location nothing uses is deleted, with the body the route has always sent, and one activity entry', async () => {
      const location = await mkLocation();
      const res = await del('admin', base, location.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(deletedBody);
      expect(await locationRow(location.id)).toBeNull();
      const entries = await deleteEntries(location.id);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ user_id: `admin-${tag}`, action: 'delete', resource_type: 'world_location', resource_id: location.id });
      expect(entries[0].changes.before).toMatchObject({ name: location.name, location_type: 'venue' });
    });

    test('a location that is itself inside another is deleted; its parent stays', async () => {
      const parent = await mkLocation();
      const child = await mkLocation({ parent: parent.id });
      const res = await del('admin', base, child.id);
      expect(res.status).toBe(200);
      expect(await locationRow(child.id)).toBeNull();
      expect(await locationRow(parent.id)).not.toBeNull();
    });

    test('no such location: 404', async () => {
      const res = await del('admin', base, uuid());
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Not found' });
    });

    test('an id that is no uuid: 404, not a database error', async () => {
      const res = await del('admin', base, 'not-a-location');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Not found' });
    });

    test('only soft-deleted things name it: they do not block, and it is deleted', async () => {
      const location = await mkLocation();
      const elsewhere = await mkLocation();
      await mkSet(location.id, { deleted: true });
      await mkEvent({ venue: location.id, automation: location.id, deleted: true });
      await mkEvent({ venue: location.id, episode: await mkEpisode('accepted'), deleted: true });
      const event = await mkEvent({});
      await mkLook(await mkSet(elsewhere.id), event.id, location.id, { deleted: true });
      // A live look of a set that was removed: the set is gone, so is its look.
      await mkLook(await mkSet(elsewhere.id, { deleted: true }), event.id, location.id);
      await mkVariant(location.id, { deleted: true });
      await mkProfile({ home: location.id, venues: [location.id], deleted: true });
      await mkFeedPost(location.id, { deleted: true });
      await mkTimelineEvent(location.id, { deleted: true });
      const res = await del('admin', base, location.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(deletedBody);
      expect(await locationRow(location.id)).toBeNull();
      expect(await locationRow(elsewhere.id)).not.toBeNull();
    });

    test('a lock wait that times out is a 409 RETRY, and nothing is deleted', async () => {
      const location = await mkLocation();
      const real = sequelize.query.bind(sequelize);
      jest.spyOn(sequelize, 'query').mockImplementation((sql, options) => (
        /FROM world_locations WHERE id = :id FOR UPDATE/.test(String(sql))
          ? Promise.reject(Object.assign(new Error('canceling statement due to lock timeout'), { original: { code: '55P03' } }))
          : real(sql, options)));
      const res = await del('admin', base, location.id);
      jest.restoreAllMocks();
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ success: false, code: 'RETRY' });
      expect(await locationRow(location.id)).not.toBeNull();
    });

    test('a foreign key this code does not count refuses the delete: a 409 LOCATION_IN_USE without the database\'s message', async () => {
      const location = await mkLocation();
      // Rows that name it but do not block (soft-deleted), so the delete reaches its DELETE statement.
      await mkSet(location.id, { deleted: true });
      await mkFeedPost(location.id, { deleted: true });
      const before = await state();
      const real = sequelize.query.bind(sequelize);
      jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(sequelize, 'query').mockImplementation((sql, options) => (
        /^DELETE FROM world_locations WHERE id = :id$/.test(String(sql))
          ? Promise.reject(Object.assign(new Error('update or delete on table "world_locations" violates foreign key constraint "x_fkey"'), { original: { code: '23503', constraint: 'x_fkey' } }))
          : real(sql, options)));
      const res = await del('admin', base, location.id);
      jest.restoreAllMocks();
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, code: LOCATION_IN_USE_CODE, uses: {}, error: 'Something else still refers to this location. Nothing was deleted.' });
      expect(res.text).not.toMatch(/violates|constraint|x_fkey/);
      // The transaction rolled back: the location, the rows that name it and every other row are as they were, and no delete was recorded.
      expect(await locationRow(location.id)).not.toBeNull();
      expect(await state()).toEqual(before);
      expect(await deleteEntries(location.id)).toEqual([]);
    });

    test('the activity entry is in the delete\'s transaction: when it cannot be written, the location is not deleted', async () => {
      const location = await mkLocation();
      const before = await state();
      jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(models.ActivityLog, 'logActivity').mockRejectedValue(new Error('the activity log is not writable'));
      const res = await del('admin', base, location.id);
      jest.restoreAllMocks();
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'The location could not be deleted' });
      expect(res.text).not.toMatch(/activity log is not writable/);
      expect(await state()).toEqual(before);
      expect(await deleteEntries(location.id)).toEqual([]);
    });
  });

  // ── Refusals: the same body from both routes, nothing changed ───────────
  describe('a location in use is refused by both routes with the same body, and nothing is changed', () => {
    test.each(REFUSALS)('%s', async (_name, build) => {
      const { location, body } = await build();
      const before = await state();
      const calls = providersCalled();
      const trace = lockTrace.install(sequelize);
      const answers = [];
      try {
        for (const [base] of DELETES) {
          // eslint-disable-next-line no-await-in-loop
          const res = await del('admin', base, location.id);
          answers.push({ status: res.status, body: res.body });
        }
      } finally { trace.uninstall(); }
      for (const answer of answers) expect(answer).toEqual({ status: 409, body });
      expect(answers[1]).toEqual(answers[0]);
      // No statement that writes ran, no row changed, no delete was recorded, nothing left the process.
      expect(writesIn(trace.records)).toEqual([]);
      expect(await state()).toEqual(before);
      expect(await deleteEntries(location.id)).toEqual([]);
      expect(providersCalled() - calls).toBe(0);
    });

    test('no override: confirm, force and replacement parameters change nothing', async () => {
      const location = await mkLocation();
      await mkSet(location.id);
      const before = await state();
      for (const [base] of DELETES) {
        for (const tail of ['?force=true', '?confirm_orphan=true', '?confirm=true', '?replacement_id=' + uuid()]) {
          // eslint-disable-next-line no-await-in-loop
          const res = await send('delete', 'admin', `${base}/${location.id}${tail}`, { force: true, confirm_orphan: true });
          expect({ tail, status: res.status, code: res.body.code }).toEqual({ tail, status: 409, code: LOCATION_IN_USE_CODE });
        }
      }
      expect(await state()).toEqual(before);
    });

    describe.each(DELETES)('DELETE %s/:id, an approved base in each state it can be in', (base) => {
      const setId = uuid();
      test.each([
        ['the set id alone (image null)', { baseSet: setId }, { approved_base_scene_set_id: setId, approved_base_image_url: null }],
        ['the image alone (set id null)', { baseUrl: 'https://x.test/legacy.jpg' }, { approved_base_scene_set_id: null, approved_base_image_url: 'https://x.test/legacy.jpg' }],
        ['both', { baseSet: setId, baseUrl: 'https://x.test/both.jpg' }, { approved_base_scene_set_id: setId, approved_base_image_url: 'https://x.test/both.jpg' }],
      ])('%s: refused with the approved-base body, and approved_base_scene_set_id, approved_base_image_url and approved_base_at are unchanged', async (_name, extra, columns) => {
        const location = await mkLocation(extra);
        const before = await locationRow(location.id);
        expect(before).toMatchObject(columns);
        expect(before.approved_base_at).not.toBeNull();
        const res = await del('admin', base, location.id);
        expect(res.status).toBe(409);
        expect(res.body).toEqual(approvedBase(location));
        expect(res.body.code).toBeUndefined();
        const after = await locationRow(location.id);
        expect(after).toMatchObject(columns);
        expect(after.approved_base_at).toEqual(before.approved_base_at);
        expect(after).toEqual(before);
        expect(await deleteEntries(location.id)).toEqual([]);
      });
    });

    test('an approved base is intact after the refusal, and the location is deleted once it is un-approved and unused', async () => {
      const setId = uuid();
      const location = await mkLocation({ baseSet: setId, baseUrl: 'https://x.test/kept.jpg' });
      const before = await locationRow(location.id);
      for (const [base] of DELETES) {
        // eslint-disable-next-line no-await-in-loop
        expect((await del('admin', base, location.id)).status).toBe(409);
      }
      const after = await locationRow(location.id);
      expect(after).toEqual(before);
      expect(after).toMatchObject({ approved_base_scene_set_id: setId, approved_base_image_url: 'https://x.test/kept.jpg' });
      expect(after.approved_base_at).not.toBeNull();
      await run('UPDATE world_locations SET approved_base_scene_set_id = NULL, approved_base_image_url = NULL, approved_base_at = NULL WHERE id = :id', { id: location.id });
      expect((await del('admin', DELETES[0][0], location.id)).status).toBe(200);
    });
  });

  // ── An attach and a delete at the same moment ───────────────────────────
  // The referrers below have a foreign key to world_locations, so writing
  // one takes a key-share lock on the location row, which the delete's FOR
  // UPDATE conflicts with. Each test holds one side open on its own
  // connection, sees the other wait in pg_stat_activity, then lets go.
  describe('an attach and a delete at the same moment take turns', () => {
    const waitingOn = async (pattern) => {
      const until = Date.now() + 8000;
      for (;;) {
        // eslint-disable-next-line no-await-in-loop
        const [[row]] = await run(
          `SELECT COUNT(*)::int AS n FROM pg_stat_activity
            WHERE datname = current_database() AND pid <> pg_backend_pid() AND wait_event_type = 'Lock' AND query ILIKE :pattern`,
          { pattern });
        if (row.n > 0) return row.n;
        if (Date.now() > until) throw new Error(`nothing waited on a lock with a query like ${pattern}`);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setImmediate(resolve));
      }
    };
    // Each: the write that points a foreign-key referrer at the location, the
    // text pg_stat_activity shows for it, the use the delete then counts, and
    // what must hold when the location was deleted first.
    const ATTACHES = [
      ['a new scene set at the location', {
        prepare: async () => ({ setId: uuid() }),
        attach: (ctx, location, options) => {
          made.scene_sets.push(ctx.setId);
          return run(`INSERT INTO scene_sets (id, name, scene_type, show_id, world_location_id, generation_status, created_at, updated_at)
                      VALUES (:id, 'ZZ attach set', 'EVENT_LOCATION', :show, :loc, 'pending', NOW(), NOW())`, { id: ctx.setId, show, loc: location.id }, options);
        },
        waitsLike: '%INSERT INTO scene_sets%ZZ attach set%',
        uses: { scene_sets: 1 }, sentence: '1 scene set',
        attached: async (ctx) => (await rows('SELECT world_location_id FROM scene_sets WHERE id = :id', { id: ctx.setId }))[0]?.world_location_id ?? null,
      }],
      ['an event whose venue becomes the location', {
        prepare: async () => ({ event: await mkEvent({}) }),
        attach: (ctx, location, options) => run('UPDATE world_events SET venue_location_id = :loc, venue_name = \'ZZ attach venue\' WHERE id = :id', { id: ctx.event.id, loc: location.id }, options),
        waitsLike: '%UPDATE world_events SET venue_location_id%ZZ attach venue%',
        uses: { events: 1 }, sentence: '1 event',
        attached: async (ctx) => (await rows('SELECT venue_location_id FROM world_events WHERE id = :id', { id: ctx.event.id }))[0]?.venue_location_id ?? null,
      }],
    ];
    const CASES = DELETES.flatMap(([base, deletedBody]) => ATTACHES.map(([name, how]) => [base, name, how, deletedBody]));

    test.each(CASES)('DELETE %s, %s: the attach is first, the delete waits for it and is refused; the reference stays', async (base, _name, how) => {
      const location = await mkLocation();
      const ctx = await how.prepare();
      const attachTx = await sequelize.transaction();
      let pending;
      try {
        await how.attach(ctx, location, { transaction: attachTx });
        // The attach is not committed: the delete cannot see it, and must not go ahead of it.
        pending = del('admin', base, location.id).then((res) => res);
        await waitingOn(`%FROM world_locations WHERE id = '${location.id}' FOR UPDATE%`);
        await attachTx.commit();
      } catch (err) {
        await attachTx.rollback().catch((rollbackErr) => console.error('[attach first] rollback:', rollbackErr.message));
        throw err;
      }
      const res = await pending;
      expect(res.status).toBe(409);
      expect(res.body).toEqual(inUse(location, how.uses, how.sentence));
      // Final state: the location is there and the reference still points at it (not nulled).
      expect(await locationRow(location.id)).not.toBeNull();
      expect(await how.attached(ctx)).toBe(location.id);
    });

    test.each(CASES)('DELETE %s, %s: the delete is first, the attach waits for it and fails on its foreign key; no orphan', async (base, _name, how, deletedBody) => {
      const location = await mkLocation();
      const ctx = await how.prepare();
      const trace = lockTrace.install(sequelize);
      let res;
      let attach;
      try {
        // The delete stops just after it has locked the location row.
        const gate = trace.gate((_rec, sql) => /FROM world_locations WHERE id = :id FOR UPDATE/.test(sql));
        const pending = del('admin', base, location.id).then((r) => r);
        await gate.reached;
        attach = how.attach(ctx, location).then(() => ({ ok: true }), (err) => ({ err }));
        await waitingOn(how.waitsLike);
        gate.open();
        res = await pending;
        attach = await attach;
      } finally { trace.uninstall(); }
      expect(res.status).toBe(200);
      expect(res.body).toEqual(deletedBody);
      expect(attach.ok).toBeUndefined();
      expect(attach.err.name).toBe('SequelizeForeignKeyConstraintError');
      expect(attach.err.original.code).toBe('23503');
      // Final state: the location is gone and nothing points at it.
      expect(await locationRow(location.id)).toBeNull();
      expect(await how.attached(ctx)).toBeNull();
      const [[orphans]] = await run(
        `SELECT (SELECT COUNT(*) FROM scene_sets WHERE world_location_id = :id)
              + (SELECT COUNT(*) FROM world_events WHERE venue_location_id = :id) AS n`, { id: location.id });
      expect(Number(orphans.n)).toBe(0);
    });
  });

  // ── The create, update, studio-types and seed routes ────────────────────
  describe('the other World Location writes are an ADMIN\'s', () => {
    let target;
    beforeAll(async () => {
      target = await mkLocation({ name: `ZZ${tag}'s Studio` });
      await run('UPDATE world_locations SET venue_type = \'other\', description = \'a signature studio in Echo Park\' WHERE id = :id', { id: target.id });
    });
    const named = (name) => rows('SELECT id FROM world_locations WHERE name = :name', { name });
    const count = async () => Number((await rows('SELECT COUNT(*) n FROM world_locations'))[0].n);
    // [what, method, path(), body(), nothing-changed check]
    const WRITES = [
      ['POST /api/v1/world/locations', 'post', () => '/api/v1/world/locations', (who) => ({ name: `ZZ${tag} refused ${who} a` })],
      ['PUT /api/v1/world/locations/:id', 'put', () => `/api/v1/world/locations/${target.id}`, () => ({ name: `ZZ${tag} renamed`, parent_location_id: null })],
      ['POST /api/v1/world/locations/studio-types', 'post', () => '/api/v1/world/locations/studio-types', () => ({ items: [{ location_id: target.id, venue_type: 'salon' }] })],
      ['POST /api/v1/world/locations/seed-infrastructure', 'post', () => '/api/v1/world/locations/seed-infrastructure', () => ({})],
      ['POST /api/v1/tier/world-locations', 'post', () => '/api/v1/tier/world-locations', (who) => ({ name: `ZZ${tag} refused ${who} b`, approved_base_image_url: 'https://x.test/planted.jpg' })],
      ['PUT /api/v1/tier/world-locations/:locationId', 'put', () => `/api/v1/tier/world-locations/${target.id}`, () => ({ name: `ZZ${tag} renamed`, approved_base_image_url: 'https://x.test/planted.jpg' })],
    ];

    test.each(WRITES)('%s: signed out 401; not an admin 403 AUTH_GROUP_REQUIRED; no location made or changed', async (_what, method, path, body) => {
      const before = await locationRow(target.id);
      const total = await count();
      const anon = await send(method, null, path(), body('anon'));
      expect(anon.status).toBe(401);
      for (const who of NON_ADMINS) {
        const trace = lockTrace.install(sequelize);
        let res;
        // eslint-disable-next-line no-await-in-loop
        try { res = await send(method, who, path(), body(who)); } finally { trace.uninstall(); }
        expect({ who, status: res.status, code: res.body.code }).toEqual({ who, status: 403, code: 'AUTH_GROUP_REQUIRED' });
        expect(trace.records).toEqual([]);
        // eslint-disable-next-line no-await-in-loop
        expect(await named(body(who).name || `ZZ${tag} none`)).toEqual([]);
      }
      expect(await locationRow(target.id)).toEqual(before);
      expect(await count()).toBe(total);
    });

    test('an ADMIN still creates and updates through /world/locations', async () => {
      const made1 = await send('post', 'admin', '/api/v1/world/locations', { name: `ZZ${tag} admin made`, city: 'echo_park' });
      expect(made1.status).toBe(200);
      const id = made1.body.location.id;
      made.world_locations.push(id);
      expect(made1.body.location).toMatchObject({ name: `ZZ${tag} admin made`, city: 'Echo Park' });
      const put = await send('put', 'admin', `/api/v1/world/locations/${id}`, { description: 'changed by an admin' });
      expect(put.status).toBe(200);
      expect((await locationRow(id)).description).toBe('changed by an admin');
    });

    test('an ADMIN still creates and updates through /tier/world-locations', async () => {
      const made2 = await send('post', 'admin', '/api/v1/tier/world-locations', { name: `ZZ${tag} tier made`, location_type: 'interior' });
      expect(made2.status).toBe(200);
      expect(made2.body.success).toBe(true);
      const id = made2.body.location.id;
      made.world_locations.push(id);
      const put = await send('put', 'admin', `/api/v1/tier/world-locations/${id}`, { description: 'changed by an admin' });
      expect(put.status).toBe(200);
      expect((await locationRow(id)).description).toBe('changed by an admin');
    });

    test('an ADMIN still applies a studio type', async () => {
      const res = await send('post', 'admin', '/api/v1/world/locations/studio-types', { items: [{ location_id: target.id, venue_type: 'salon' }] });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, changed: 1 });
      expect((await locationRow(target.id)).venue_type).toBe('salon');
    });

    test('an ADMIN still seeds the infrastructure (what it added is removed again here)', async () => {
      const before = new Set((await rows('SELECT id FROM world_locations')).map((r) => r.id));
      const res = await send('post', 'admin', '/api/v1/world/locations/seed-infrastructure', {});
      const added = (await rows('SELECT id FROM world_locations')).map((r) => r.id).filter((id) => !before.has(id));
      if (added.length) await run('DELETE FROM world_locations WHERE id IN (:ids)', { ids: added });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.created).toBe(added.length);
    });

    test('GET /api/v1/tier/world-locations and GET /api/v1/world/locations/studio-types still answer a signed-in account that is not an admin', async () => {
      for (const path of ['/api/v1/tier/world-locations', '/api/v1/world/locations/studio-types']) {
        // eslint-disable-next-line no-await-in-loop
        const res = await send('get', 'editor', path);
        expect({ path, status: res.status }).toEqual({ path, status: 200 });
      }
    });
  });

  // In a describe of its own, so it runs after every describe above.
  describe('at the end', () => {
    test('nothing in this suite called a provider or the object storage', () => {
      expect(providersCalled()).toBe(0);
    });
  });
});
