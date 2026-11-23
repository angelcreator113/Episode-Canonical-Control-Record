/**
 * Foundation A, the strict Place lock (Evoni, 2026-11-23): "an event is
 * locked when ANY canonically linked live episode is accepted. Include
 * primary, non-primary and two-part-special relationships."
 *
 * On the migrated test database, through utils/placeLock and the real
 * routes and services that ask it. Three states lock now that did not:
 *   - a two-part special with Part 1 accepted and Part 2 not;
 *   - an event stamped on an accepted episode while a draft's Brief names it;
 *   - a stray stamp on an accepted episode while the event is a draft's own.
 * The old rule (one episode: the newest live Brief's, else the stamped one)
 * is written out again below, and the new rule is never weaker than it.
 *
 * This file sends no DDL and calls no provider or object storage.
 */
jest.unmock('uuid');

const mockAnthropic = jest.fn(async () => { throw new Error('no model call is expected: every case here is refused first'); });
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockAnthropic } })));
const mockS3Send = jest.fn(async () => ({}));
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return { ...actual, S3Client: jest.fn(() => ({ send: mockS3Send })) };
});

process.env.FAL_KEY = process.env.FAL_KEY || 'test-fal-key';

const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const sceneGen = require('../../src/services/sceneGenerationService');
const placeLock = require('../../src/utils/placeLock');
const { linkedLiveEpisodes } = require('../../src/utils/eventEpisodeLink');
const { findTermsLockEpisode } = require('../../src/utils/eventTermsLock');
const uses = require('../../src/services/sceneSetUsesService');
const versions = require('../../src/services/sceneSetVersionService');
const { lockedEventsAtLocation } = require('../../src/services/approvedBaseService');
const { seedArc } = require('../../src/services/arcProgressionService');
const { placeLockFixtures } = require('../helpers/placeLockFixtures');

const { sequelize } = models;
const { isPlaceLocked, PLACE_LOCKED_CODE } = placeLock;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

/**
 * The rule before Foundation A, word for word what utils/placeLock did on
 * main: the terms-lock episode (the newest live Brief's live episode, else
 * the live stamped one), else the stamp; accepted and live.
 */
async function oldRule(eventId, options = {}) {
  let episodeId = (await findTermsLockEpisode(sequelize, eventId, options))?.id || null;
  if (!episodeId) {
    const [[row]] = await sequelize.query('SELECT used_in_episode_id FROM world_events WHERE id = :eventId', { replacements: { eventId }, ...options });
    episodeId = row?.used_in_episode_id || null;
  }
  if (!episodeId) return false;
  const [[episode]] = await sequelize.query(
    'SELECT evaluation_status FROM episodes WHERE id = :episodeId AND deleted_at IS NULL', { replacements: { episodeId }, ...options });
  return episode?.evaluation_status === 'accepted';
}

(shouldSkip ? describe.skip : describe)('Foundation A: the Place locks when any linked live episode is accepted', () => {
  jest.setTimeout(60000);
  const fx = placeLockFixtures(sequelize, models);
  const { rows, run, mkShow, mkEpisode, mkEvent, mkBrief, mkSet, mkLocation } = fx;
  let show;
  let token;
  let editorToken;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const eventUrl = (ev, tail = '') => `/api/v1/world/${show}/events/${ev}${tail}`;

  /**
   * Every state, as rows in the shape the real writers leave. Each returns
   * { ev, episodes: { name: id } }. `fields` are the event's (set, loc).
   */
  const STATES = {
    // As before Foundation A.
    'no link': async (f) => ({ ev: await mkEvent(show, f), episodes: {} }),
    'one draft episode (stamp and Brief)': async (f) => {
      const a = await mkEpisode(show);
      const ev = await mkEvent(show, { ...f, stamp: a });
      await mkBrief(show, a, ev);
      return { ev, episodes: { a } };
    },
    'one accepted episode (stamp and Brief)': async (f) => {
      const a = await mkEpisode(show, { evaluation: 'accepted' });
      const ev = await mkEvent(show, { ...f, stamp: a });
      await mkBrief(show, a, ev);
      return { ev, episodes: { a } };
    },
    'one accepted episode (stamp only: a non-primary event)': async (f) => {
      const a = await mkEpisode(show, { evaluation: 'accepted' });
      const primary = await mkEvent(show);
      await mkBrief(show, a, primary);
      return { ev: await mkEvent(show, { ...f, stamp: a }), episodes: { a } };
    },
    'one accepted episode (Brief only)': async (f) => {
      const a = await mkEpisode(show, { evaluation: 'accepted' });
      const ev = await mkEvent(show, f);
      await mkBrief(show, a, ev);
      return { ev, episodes: { a } };
    },
    'a soft-deleted accepted episode (stamp and Brief)': async (f) => {
      const a = await mkEpisode(show, { evaluation: 'accepted', deleted: true });
      const ev = await mkEvent(show, { ...f, stamp: a });
      await mkBrief(show, a, ev);
      return { ev, episodes: { a } };
    },
    'an accepted episode whose Brief naming the event is soft-deleted, no stamp': async (f) => {
      const a = await mkEpisode(show, { evaluation: 'accepted' });
      const ev = await mkEvent(show, f);
      await mkBrief(show, a, ev, { deleted: true });
      return { ev, episodes: { a } };
    },
    'two drafts (a two-parter before either part is accepted)': async (f) => {
      const one = await mkEpisode(show);
      const two = await mkEpisode(show);
      const ev = await mkEvent(show, { ...f, stamp: one });
      await mkBrief(show, one, ev, { agoMinutes: 10 });
      await mkBrief(show, two, ev);
      return { ev, episodes: { one, two } };
    },
    'a two-parter with both parts accepted': async (f) => {
      const one = await mkEpisode(show, { evaluation: 'accepted' });
      const two = await mkEpisode(show, { evaluation: 'accepted' });
      const ev = await mkEvent(show, { ...f, stamp: one });
      await mkBrief(show, one, ev, { agoMinutes: 10 });
      await mkBrief(show, two, ev);
      return { ev, episodes: { one, two } };
    },
    // The three states that lock now.
    'NEW a two-parter, Part 1 accepted and Part 2 a draft': async (f) => {
      const one = await mkEpisode(show, { evaluation: 'accepted' });
      const two = await mkEpisode(show);
      const ev = await mkEvent(show, { ...f, stamp: one });
      await mkBrief(show, one, ev, { agoMinutes: 10 });
      await mkBrief(show, two, ev); // Part 2's Brief copies event_id, and is the newer one
      return { ev, episodes: { one, two } };
    },
    "NEW stamped on accepted A (its non-primary event) while draft B's Brief names it": async (f) => {
      const a = await mkEpisode(show, { evaluation: 'accepted' });
      const b = await mkEpisode(show);
      const primaryOfA = await mkEvent(show);
      await mkBrief(show, a, primaryOfA);
      const ev = await mkEvent(show, { ...f, stamp: a });
      await mkBrief(show, b, ev);
      return { ev, episodes: { a, b } };
    },
    "NEW a stray stamp on accepted A (which has no Brief) while the event is draft B's own": async (f) => {
      const a = await mkEpisode(show, { evaluation: 'accepted' });
      const b = await mkEpisode(show);
      const ev = await mkEvent(show, { ...f, stamp: a });
      await mkBrief(show, b, ev);
      return { ev, episodes: { a, b } };
    },
    // The same rule without a stamp: an older Brief's episode accepted.
    "NEW an older Brief's episode accepted, the newest Brief's a draft, no stamp": async (f) => {
      const a = await mkEpisode(show, { evaluation: 'accepted' });
      const b = await mkEpisode(show);
      const ev = await mkEvent(show, f);
      await mkBrief(show, a, ev, { agoMinutes: 10 });
      await mkBrief(show, b, ev);
      return { ev, episodes: { a, b } };
    },
  };
  // [state, the old rule, the new rule]
  const EXPECTED = [
    ['no link', false, false],
    ['one draft episode (stamp and Brief)', false, false],
    ['one accepted episode (stamp and Brief)', true, true],
    ['one accepted episode (stamp only: a non-primary event)', true, true],
    ['one accepted episode (Brief only)', true, true],
    ['a soft-deleted accepted episode (stamp and Brief)', false, false],
    ['an accepted episode whose Brief naming the event is soft-deleted, no stamp', false, false],
    ['two drafts (a two-parter before either part is accepted)', false, false],
    ['a two-parter with both parts accepted', true, true],
    ['NEW a two-parter, Part 1 accepted and Part 2 a draft', false, true],
    ["NEW stamped on accepted A (its non-primary event) while draft B's Brief names it", false, true],
    ["NEW a stray stamp on accepted A (which has no Brief) while the event is draft B's own", false, true],
    ["NEW an older Brief's episode accepted, the newest Brief's a draft, no stamp", false, true],
  ];
  const NEW_STATES = EXPECTED.filter(([name]) => name.startsWith('NEW ')).map(([name]) => name);
  // The three the ruling names carry a stamp; the fourth (no stamp) is the same rule.
  const NEW_STAMPED = NEW_STATES.slice(0, 3);

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-admin-place-strict', email: 'admin@placestrict.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editorToken = TokenService.generateTokenPair({ id: 'test-editor-place-strict', email: 'editor@placestrict.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    show = await mkShow('Place strict');
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300)); // Start Episode's after-commit work
    await fx.cleanup();
  });

  describe('the rule', () => {
    test('every state is covered by the table', () => {
      expect(EXPECTED.map(([name]) => name).sort()).toEqual(Object.keys(STATES).sort());
      expect(NEW_STATES).toHaveLength(4);
    });

    test.each(EXPECTED)('%s: the old rule %s, the new rule %s; never weaker; the same in a transaction', async (name, was, now) => {
      const { ev } = await STATES[name]({});
      expect(await oldRule(ev)).toBe(was);
      expect(await isPlaceLocked(sequelize, ev)).toBe(now);
      // Never false where the old rule was true.
      if (was) expect(now).toBe(true);
      await sequelize.transaction(async (transaction) => {
        expect(await isPlaceLocked(sequelize, ev, { transaction })).toBe(now);
        expect(await oldRule(ev, { transaction })).toBe(was);
      });
    });

    test('the old rule\'s one episode is always among the linked episodes (why the new rule is never weaker)', async () => {
      for (const [name] of EXPECTED) {
        const { ev } = await STATES[name]({});
        const one = await findTermsLockEpisode(sequelize, ev);
        const linked = (await linkedLiveEpisodes(sequelize, ev)).map((e) => e.id);
        if (one) expect(linked).toContain(one.id);
        else expect(linked).toEqual([]);
      }
    });

    test('the linked episodes: live only, each once, in id order, with their status', async () => {
      const { ev, episodes } = await STATES['NEW a two-parter, Part 1 accepted and Part 2 a draft']({});
      const linked = await linkedLiveEpisodes(sequelize, ev);
      expect(linked.map((e) => e.id)).toEqual([episodes.one, episodes.two].sort());
      expect(Object.fromEntries(linked.map((e) => [e.id, e.evaluation_status]))).toEqual({ [episodes.one]: 'accepted', [episodes.two]: 'pending' });
      expect(Object.keys(linked[0]).sort()).toEqual(['evaluation_status', 'id']);
      // Part 1 deleted: it links nothing, and the Place is open again.
      await run('UPDATE episodes SET deleted_at = NOW() WHERE id = :id', { id: episodes.one });
      expect((await linkedLiveEpisodes(sequelize, ev)).map((e) => e.id)).toEqual([episodes.two]);
      expect(await isPlaceLocked(sequelize, ev)).toBe(false);
      expect(await linkedLiveEpisodes(sequelize, null)).toEqual([]);
      expect(await isPlaceLocked(sequelize, fx.uuid())).toBe(false);
    });

    test('the export keeps its name and is read at call time (a caller\'s spy still works)', async () => {
      const { ev } = await STATES['one draft episode (stamp and Brief)']({});
      const set = await mkSet(show, 'Spy set');
      await run('UPDATE world_events SET scene_set_id = :set WHERE id = :ev', { set, ev });
      jest.spyOn(placeLock, 'isPlaceLocked').mockResolvedValue(true);
      expect(await uses.lockedEventsAt(sequelize, set)).toEqual([expect.objectContaining({ id: ev })]);
      jest.restoreAllMocks();
      expect(await uses.lockedEventsAt(sequelize, set)).toEqual([]);
    });
  });

  describe('a real two-part special (the season routes), Part 1 accepted and Part 2 not', () => {
    test('made by the two-parter routes and Start Episode: the Place is locked where the old rule said no', async () => {
      const seasonShow = await mkShow('Place strict season');
      const { arc_id: arcId } = await seedArc(seasonShow, models);
      const ev = await mkEvent(seasonShow, { name: 'The Finale Gala' });
      const slotId = async (n) => (await rows('SELECT id FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0].id;
      const asEditor = (r) => r.set('Authorization', `Bearer ${editorToken}`);
      expect((await asEditor(request(app).put(`/api/v1/world/${seasonShow}/season/slots/${await slotId(12)}/event`)).send({ event_id: ev })).status).toBe(200);
      const made = await asEditor(request(app).post(`/api/v1/world/${seasonShow}/season/two-parters`)).send({ slot_id: await slotId(12) });
      expect(made.status).toBe(201);
      const one = await auth(request(app).post(`/api/v1/world/${seasonShow}/events/${ev}/generate-episode`)).send({ draft_script: false });
      expect(one.status).toBe(201);
      const partOne = one.body.data.episode.id;
      const two = await asEditor(request(app).post(`/api/v1/world/${seasonShow}/season/two-parters/${made.body.data.id}/part-two`));
      expect(two.status).toBe(201);
      const partTwo = two.body.data.episode.id;
      expect(mockAnthropic).not.toHaveBeenCalled();

      // What the real writers left: the stamp on Part 1, a Brief on each part.
      expect((await fx.eventRow(ev)).used_in_episode_id).toBe(partOne);
      expect((await rows('SELECT episode_id FROM episode_briefs WHERE event_id = :ev AND deleted_at IS NULL ORDER BY episode_id', { ev })).map((r) => r.episode_id))
        .toEqual([partOne, partTwo].sort());
      expect((await linkedLiveEpisodes(sequelize, ev)).map((e) => e.id)).toEqual([partOne, partTwo].sort());
      expect(await isPlaceLocked(sequelize, ev)).toBe(false);

      // The window inside a two-part completion (Part 1 accepted and
      // committed, Part 2's own UPDATE not yet run), as a row write: the
      // completion itself closes it in one call (placeLockFinalizer's suite
      // holds the real one open).
      await fx.setEvaluation(partOne, 'accepted');
      expect(await oldRule(ev)).toBe(false); // the newest Brief is Part 2's, a draft
      expect(await isPlaceLocked(sequelize, ev)).toBe(true);
      const read = await auth(request(app).get(`/api/v1/world/${seasonShow}/events/${ev}`));
      expect(read.body.placeLocked).toBe(true);
      expect(read.body.termsLockedBy).toMatchObject({ id: partTwo, evaluation_status: expect.not.stringMatching(/^accepted$/) });
    });
  });

  describe.each(NEW_STAMPED)('every caller, in the state: %s', (name) => {
    let w;
    beforeAll(async () => {
      const loc = await mkLocation();
      const everyday = await mkSet(show, 'Studio', { world_location_id: loc });
      // The event is held at an event version of the everyday set.
      const held = await mkSet(show, 'Studio, dressed', { world_location_id: loc, version_of_set_id: everyday });
      const other = await mkSet(show, 'Studio annex', { world_location_id: loc });
      const state = await STATES[name]({ set: held, loc });
      w = { ...state, loc, everyday, held, other };
    });
    const eventState = async () => JSON.stringify(await rows('SELECT scene_set_id, venue_look, venue_location_id, deleted_at FROM world_events WHERE id = :ev', { ev: w.ev }));

    test('the old rule says open, the new rule says locked', async () => {
      expect(await oldRule(w.ev)).toBe(false);
      expect(await isPlaceLocked(sequelize, w.ev)).toBe(true);
    });

    test('the event PUT refuses a scene set change: 409 PLACE_LOCKED, nothing changed; the stored set re-sent is no change', async () => {
      const before = await eventState();
      const res = await auth(request(app).put(eventUrl(w.ev))).send({ scene_set_id: w.other });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe(PLACE_LOCKED_CODE);
      expect(res.body.error).toBe(placeLock.PLACE_LOCKED_MESSAGE);
      expect(await eventState()).toBe(before);
      expect((await auth(request(app).put(eventUrl(w.ev))).send({ scene_set_id: w.held })).status).toBe(200);
    });

    test('scene-set-link with a chosen set: 409 PLACE_LOCKED, nothing changed', async () => {
      const before = await eventState();
      const res = await auth(request(app).post(eventUrl(w.ev, '/scene-set-link'))).send({ scene_set_id: w.other });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe(PLACE_LOCKED_CODE);
      expect(await eventState()).toBe(before);
    });

    test('Generate this look and an uploaded look: 409 PLACE_LOCKED, nothing generated or stored', async () => {
      const dressed = jest.spyOn(sceneGen, 'generateDressedStill');
      const gen = await auth(request(app).post(eventUrl(w.ev, '/look/generate'))).send({});
      expect(gen.status).toBe(409);
      expect(gen.body.code).toBe(PLACE_LOCKED_CODE);
      expect(dressed).not.toHaveBeenCalled();
      const up = await auth(request(app).post(eventUrl(w.ev, '/look/upload'))).attach('image', PNG, { filename: 'gala.png', contentType: 'image/png' });
      expect(up.status).toBe(409);
      expect(up.body.code).toBe(PLACE_LOCKED_CODE);
      expect(mockS3Send).not.toHaveBeenCalled();
      expect(await rows('SELECT id FROM scene_set_looks WHERE event_id = :ev', { ev: w.ev })).toEqual([]);
    });

    test('the venue look: save and draft are refused with VENUE_LOOK_LOCKED; no model call', async () => {
      const before = await eventState();
      const save = await auth(request(app).put(eventUrl(w.ev, '/venue-look'))).send({ venue_look: { mood: 'Warm' } });
      expect(save.status).toBe(409);
      expect(save.body.code).toBe('VENUE_LOOK_LOCKED');
      const draft = await auth(request(app).post(eventUrl(w.ev, '/venue-look/draft'))).send({});
      expect(draft.status).toBe(409);
      expect(draft.body.code).toBe('VENUE_LOOK_LOCKED');
      expect(mockAnthropic).not.toHaveBeenCalled();
      expect(await eventState()).toBe(before);
    });

    test('an event version and "Stop using these photos": PLACE_LOCKED, the event stays at its set', async () => {
      const before = await eventState();
      const version = await auth(request(app).put(`/api/v1/scene-sets/${w.other}/version`)).send({ everyday_set_id: w.everyday, event_id: w.ev });
      expect(version.status).toBe(409);
      expect(version.body.code).toBe(PLACE_LOCKED_CODE);
      const back = await auth(request(app).put(`/api/v1/scene-sets/${w.held}/version`)).send({ everyday_set_id: null, return_event: true });
      expect(back.status).toBe(409);
      expect(back.body.code).toBe(PLACE_LOCKED_CODE);
      expect(await eventState()).toBe(before);
      expect((await rows('SELECT version_of_set_id FROM scene_sets WHERE id IN (:ids) ORDER BY id', { ids: [w.held, w.other] })).map((r) => r.version_of_set_id).sort())
        .toEqual([w.everyday, null].sort());
      // The services, as the routes call them.
      await expect(versions.makeEventVersion(sequelize, { setId: w.other, everydaySetId: w.everyday, eventId: w.ev })).rejects.toMatchObject({ code: PLACE_LOCKED_CODE, status: 409 });
      await expect(versions.makeEveryday(sequelize, w.held, { returnEvent: true })).rejects.toMatchObject({ code: PLACE_LOCKED_CODE, status: 409 });
    });

    test('the read flags say locked: placeLocked, editable, events[].locked', async () => {
      const read = await auth(request(app).get(eventUrl(w.ev)));
      expect(read.status).toBe(200);
      expect(read.body.placeLocked).toBe(true);
      // The guest controls follow this episode alone, and it is a draft.
      expect(read.body.termsLockedBy.evaluation_status).not.toBe('accepted');
      const pkg = await auth(request(app).get(eventUrl(w.ev, '/package')));
      expect(pkg.body.eventPayload.placeLocked).toBe(true);
      expect((await auth(request(app).get(eventUrl(w.ev, '/look')))).body.data.editable).toBe(false);
      expect((await auth(request(app).get(eventUrl(w.ev, '/venue-look')))).body.data.editable).toBe(false);
      const options = await auth(request(app).get(`/api/v1/scene-sets/${w.other}/version-options`));
      expect(options.status).toBe(200);
      expect(options.body.data.events.find((e) => e.id === w.ev)).toMatchObject({ locked: true });
      const listed = await versions.versionsForSets(sequelize, [{ id: w.everyday, version_of_set_id: null }, { id: w.held, version_of_set_id: w.everyday }]);
      expect(JSON.stringify([...listed.values()])).toContain(`"id":"${w.ev}"`);
      expect(JSON.stringify([...listed.values()])).toMatch(new RegExp(`"id":"${w.ev}"[^}]*"locked":true`));
    });

    test('deleting its Scene Set: 409 PLACE_LOCKED with locked_events; the set stays', async () => {
      expect(await uses.lockedEventsAt(sequelize, w.held)).toEqual([expect.objectContaining({ id: w.ev })]);
      const res = await auth(request(app).delete(`/api/v1/scene-sets/${w.held}`));
      expect(res.status).toBe(409);
      expect(res.body.code).toBe(PLACE_LOCKED_CODE);
      expect(res.body.locked_events).toEqual([expect.objectContaining({ id: w.ev })]);
      expect((await rows('SELECT deleted_at FROM scene_sets WHERE id = :id', { id: w.held }))[0].deleted_at).toBeNull();
    });

    test('deleting its World Location: 409 PLACE_LOCKED; the location stays', async () => {
      expect(await lockedEventsAtLocation(sequelize, w.loc)).toEqual([expect.objectContaining({ id: w.ev })]);
      const res = await auth(request(app).delete(`/api/v1/world/locations/${w.loc}`));
      expect(res.status).toBe(409);
      expect(res.body.code).toBe(PLACE_LOCKED_CODE);
      expect(res.body.locked_events).toEqual([expect.objectContaining({ id: w.ev })]);
      expect(await rows('SELECT id FROM world_locations WHERE id = :id', { id: w.loc })).toHaveLength(1);
    });
  });

  describe('the event read: the terms-lock episode\'s status rides along, and nothing else changes shape', () => {
    test('termsLockedBy carries evaluation_status; the terms lock still names one episode', async () => {
      const draft = await STATES['one draft episode (stamp and Brief)']({});
      const read = await auth(request(app).get(eventUrl(draft.ev)));
      expect(read.body.termsLockedBy).toEqual({ id: draft.episodes.a, episode_number: expect.any(Number), title: expect.any(String), evaluation_status: 'pending' });
      expect(read.body.placeLocked).toBe(false);
      const accepted = await STATES['one accepted episode (stamp only: a non-primary event)']({});
      const readAccepted = await auth(request(app).get(eventUrl(accepted.ev)));
      expect(readAccepted.body.termsLockedBy).toMatchObject({ id: accepted.episodes.a, evaluation_status: 'accepted' });
      expect(readAccepted.body.usedInEpisode).toMatchObject({ id: accepted.episodes.a, evaluation_status: 'accepted' });
      expect(readAccepted.body.placeLocked).toBe(true);
      expect((await auth(request(app).get(eventUrl((await STATES['no link']({})).ev)))).body.termsLockedBy).toBeNull();
    });

    test('Start readiness answers the live episode exactly as before (no new field)', async () => {
      const { ev, episodes } = await STATES['one accepted episode (stamp and Brief)']({});
      const res = await auth(request(app).get(eventUrl(ev, '/start-readiness')));
      expect(res.status).toBe(200);
      const blocker = res.body.data.blockers.find((b) => b.key === 'episode_exists');
      expect(Object.keys(blocker.episode).sort()).toEqual(['episode_number', 'id', 'show_id', 'title']);
      expect(blocker.episode.id).toBe(episodes.a);
    });

    test('the guest controls\' old answer, in every state: the terms-lock episode accepted is the old Place lock', async () => {
      for (const [name, was] of EXPECTED) {
        const { ev } = await STATES[name]({});
        const body = (await auth(request(app).get(eventUrl(ev)))).body;
        const used = Boolean(body.event.used_in_episode_id) || Boolean(body.termsLockedBy);
        // EventPackagePage: castLocked = used && termsLockedBy?.evaluation_status === 'accepted'
        expect([name, used && body.termsLockedBy?.evaluation_status === 'accepted']).toEqual([name, was]);
      }
    });
  });

  describe('sceneSetUsesService: lockedEventsAt in a transaction, acceptedEpisodeUses', () => {
    test('lockedEventsAt reads inside the caller\'s transaction', async () => {
      const set = await mkSet(show, 'Tx set');
      const { ev, episodes } = await STATES['one draft episode (stamp and Brief)']({ set });
      expect(await uses.lockedEventsAt(sequelize, set)).toEqual([]);
      const transaction = await sequelize.transaction();
      try {
        await sequelize.query('UPDATE episodes SET evaluation_status = \'accepted\' WHERE id = :id', { replacements: { id: episodes.a }, transaction });
        // Inside the transaction the acceptance is seen; outside it is not yet.
        expect(await uses.lockedEventsAt(sequelize, set, { transaction })).toEqual([expect.objectContaining({ id: ev })]);
        expect(await uses.lockedEventsAt(sequelize, set)).toEqual([]);
      } finally {
        await transaction.rollback();
      }
      expect(await uses.lockedEventsAt(sequelize, set, {})).toEqual([]);
    });

    const USE_TABLES = {
      scene_set_episodes: (id, set, episode, deleted) => run(
        `INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, sort_order, role, deleted_at, created_at, updated_at)
         VALUES (:id, :set, :episode, 0, 'event', :deletedAt, NOW(), NOW())`, { id, set, episode, deletedAt: deleted ? new Date() : null }),
      scene_plans: (id, set, episode, deleted) => run(
        `INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, scene_set_id, angle_label, locked, chosen_by_user, sort_order, ai_suggested, deleted_at, created_at, updated_at)
         VALUES (:id, :episode, 3, 'Beat', :set, 'WIDE', false, false, 3, false, :deletedAt, NOW(), NOW())`, { id, set, episode, deletedAt: deleted ? new Date() : null }),
      scenes: (id, set, episode, deleted) => run(
        `INSERT INTO scenes (id, episode_id, scene_number, title, scene_set_id, deleted_at, created_at, updated_at)
         VALUES (:id, :episode, 1, 'Scene', :set, :deletedAt, NOW(), NOW())`, { id, set, episode, deletedAt: deleted ? new Date() : null }),
    };

    test.each(Object.keys(USE_TABLES))('acceptedEpisodeUses through %s: accepted live episodes only, live rows only', async (table) => {
      const set = await mkSet(show, `Uses ${table}`);
      const accepted = await mkEpisode(show, { evaluation: 'accepted', title: 'Accepted' });
      const draft = await mkEpisode(show, { title: 'Draft' });
      const gone = await mkEpisode(show, { evaluation: 'accepted', deleted: true, title: 'Gone' });
      const removedUse = await mkEpisode(show, { evaluation: 'accepted', title: 'Removed use' });
      expect(await uses.acceptedEpisodeUses(sequelize, set)).toEqual([]);
      await USE_TABLES[table](fx.uuid(), set, accepted, false);
      await USE_TABLES[table](fx.uuid(), set, draft, false);
      await USE_TABLES[table](fx.uuid(), set, gone, false);
      await USE_TABLES[table](fx.uuid(), set, removedUse, true);
      const [ep] = await rows('SELECT episode_number, title FROM episodes WHERE id = :id', { id: accepted });
      expect(await uses.acceptedEpisodeUses(sequelize, set)).toEqual([{ id: accepted, episode_number: ep.episode_number, title: ep.title }]);
      const transaction = await sequelize.transaction();
      try {
        await sequelize.query('UPDATE episodes SET evaluation_status = \'accepted\' WHERE id = :id', { replacements: { id: draft }, transaction });
        expect((await uses.acceptedEpisodeUses(sequelize, set, { transaction })).map((e) => e.id).sort()).toEqual([accepted, draft].sort());
        expect((await uses.acceptedEpisodeUses(sequelize, set)).map((e) => e.id)).toEqual([accepted]);
      } finally {
        await transaction.rollback();
      }
      // Another set's uses are not this set's.
      expect(await uses.acceptedEpisodeUses(sequelize, await mkSet(show, 'Unused'))).toEqual([]);
      expect(await uses.acceptedEpisodeUses(sequelize, null)).toEqual([]);
    });

    test('an episode that uses the set three ways is listed once, by episode number', async () => {
      const set = await mkSet(show, 'Three ways');
      const first = await mkEpisode(show, { evaluation: 'accepted' });
      const second = await mkEpisode(show, { evaluation: 'accepted' });
      for (const table of Object.keys(USE_TABLES)) await USE_TABLES[table](fx.uuid(), set, second, false);
      await USE_TABLES.scenes(fx.uuid(), set, first, false);
      expect((await uses.acceptedEpisodeUses(sequelize, set)).map((e) => e.id)).toEqual([first, second]);
    });
  });
});
