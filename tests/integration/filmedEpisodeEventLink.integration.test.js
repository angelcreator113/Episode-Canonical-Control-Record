/**
 * A filmed episode takes no new event (Evoni's ruling, 2026-11-12).
 *
 * Found while tracing the Episode Overview's "Link an event": the event edit
 * (PUT …/events/:id { used_in_episode_id }) accepted an unstarted event onto
 * a filmed episode, and the link then could not be removed (the terms lock).
 * The brief edit (PUT /episode-brief/:id { event_id }) could likewise name a
 * first source event on a filmed episode whose brief had none.
 *
 * Both now answer 409 EPISODE_SNAPSHOT_FROZEN and write nothing from the
 * request. Unfilmed episodes, the stored link re-sent, the source event's
 * own link restored, clearing, and unrelated edits behave as before.
 * "Filmed" is the one definition (src/utils/snapshotFreeze.js,
 * frozenEpisode.js): any episode_raw_clips row, removed clips included.
 * No model is called (the SDK is a stub that fails if asked).
 */
jest.unmock('uuid');

const mockAsk = { create: jest.fn(async () => { throw new Error('the model must not be asked'); }) };
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: (...a) => mockAsk.create(...a) } })));

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const clips = require('../../src/services/rawClipsService');
const { assertEpisodeAcceptsEventLink, isFrozenEpisodeError } = require('../../src/utils/frozenEpisode');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('a filmed episode takes no new event', () => {
  const shows = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const putEvent = (show, eventId, body) => auth(request(app).put(`/api/v1/world/${show}/events/${eventId}`)).send(body);
  const putBrief = (episodeId, body) => auth(request(app).put(`/api/v1/episode-brief/${episodeId}`)).send(body);
  const eventRow = async (id) => (await rows('SELECT name, description, used_in_episode_id, status FROM world_events WHERE id = :id', { id }))[0];
  const briefRow = async (episodeId) => (await rows('SELECT event_id, narrative_purpose FROM episode_briefs WHERE episode_id = :episodeId', { episodeId }))[0];
  const episodeRow = async (id) => (await rows('SELECT title, script_content, status, deleted_at FROM episodes WHERE id = :id', { id }))[0];
  const clipCount = async (episodeId) => Number((await rows('SELECT COUNT(*)::int AS n FROM episode_raw_clips WHERE episode_id = :episodeId', { episodeId }))[0].n);
  const clipFor = (episodeId, show) => ({ id: uuid(), episode_id: episodeId, show_id: show, performer: 'lala', s3_key_raw: `episodes/${episodeId}/raw-clips/${uuid()}/original.mp4`, file_name: 'take.mp4', content_type: 'video/mp4', file_size: 10 });

  async function addEvent(show, { name = 'Event', episodeId = null } = {}) {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, strictness, cost_coins, used_in_episode_id, times_used, is_paid, payment_amount, canon_consequences, created_at, updated_at)
               VALUES (:id, :show, :name, 'invite', :status, 3, 5, 0, :episodeId, :times, false, 0, '{}'::jsonb, NOW(), NOW())`,
    { id, show, name, episodeId, status: episodeId ? 'used' : 'draft', times: episodeId ? 1 : 0 });
    return id;
  }
  async function addEpisode(show, n, { briefEventId = null, script = null } = {}) {
    const id = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, created_at, updated_at) VALUES (:id, :show, :t, :n, 'draft', :script, NOW(), NOW())`, { id, show, t: `Episode ${n}`, n, script });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, created_at, updated_at) VALUES (:b, :id, :show, :ev, 'draft', NOW(), NOW())`, { b: uuid(), id, show, ev: briefEventId });
    return id;
  }
  /**
   * A show with: `filmed` (Episode 1, started from `source`, filmed unless
   * film: false; its event's own link stamped unless stamp: false, which is
   * the real Episode 1's shape), an unfilmed `draft` episode with an empty
   * brief, and two unstarted events `free` and `free2`.
   */
  async function seed({ film = true, stamp = true } = {}) {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :n, :n, '{}'::jsonb, NOW(), NOW())`, { show, n: `filmlink-${show.slice(0, 8)}` });
    const source = await addEvent(show, { name: 'Studio Session' });
    const filmed = await addEpisode(show, 1, { briefEventId: source, script: 'INT. STUDIO. The filmed script.' });
    if (stamp) await run(`UPDATE world_events SET used_in_episode_id = :filmed, status = 'used', times_used = 1 WHERE id = :source`, { filmed, source });
    const draft = await addEpisode(show, 2);
    const free = await addEvent(show, { name: 'Charity Gala' });
    const free2 = await addEvent(show, { name: 'After Party' });
    if (film) await clips.createClip(sequelize, clipFor(filmed, show));
    return { show, source, filmed, draft, free, free2 };
  }
  /** Everything about the filmed episode that must not move. */
  const history = async (f) => ({ episode: await episodeRow(f.filmed), brief: await briefRow(f.filmed), source: await eventRow(f.source), clips: await clipCount(f.filmed) });

  beforeAll(() => {
    token = TokenService.generateTokenPair({ id: 'test-user-filmlink', email: 'filmlink@test.dev', name: 'Filmlink', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    for (const show of shows) {
      const eps = '(SELECT id FROM episodes WHERE show_id = :show)';
      await run(`DELETE FROM episode_raw_clips WHERE show_id = :show OR episode_id IN ${eps}`, { show }).catch(() => {});
      await run(`DELETE FROM episode_briefs WHERE episode_id IN ${eps}`, { show }).catch(() => {});
      await run('UPDATE world_events SET used_in_episode_id = NULL WHERE show_id = :show', { show }).catch(() => {});
      await run('DELETE FROM episodes WHERE show_id = :show', { show }).catch(() => {});
      await run('DELETE FROM world_events WHERE show_id = :show', { show }).catch(() => {});
      await run('DELETE FROM shows WHERE id = :show', { show }).catch(() => {});
    }
    await sequelize.close();
  });

  // ── The event edit ──────────────────────────────────────────────────────
  describe('the event edit (PUT …/events/:id)', () => {
    test('a new event onto a filmed episode is refused, 409 EPISODE_SNAPSHOT_FROZEN, in the existing error shape', async () => {
      const f = await seed();
      const before = await history(f);
      const res = await putEvent(f.show, f.free, { used_in_episode_id: f.filmed });
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ success: false, code: 'EPISODE_SNAPSHOT_FROZEN', episode_id: f.filmed, event_id: f.free, fields: ['used_in_episode_id'] });
      expect(res.body.error).toMatch(/^This episode has been filmed \(since \d{4}-\d{2}-\d{2}\), so no other event can be linked to it: its events are part of its history\. Nothing was changed\.$/);
      expect(typeof res.body.frozen_at).toBe('string');
      expect(await eventRow(f.free)).toMatchObject({ used_in_episode_id: null, status: 'draft' });
      expect(await history(f)).toEqual(before);
    });

    test('atomic: other fields sent in the same request are not saved either', async () => {
      const f = await seed();
      const res = await putEvent(f.show, f.free, { name: 'Renamed in the same save', description: 'Also sent', used_in_episode_id: f.filmed, status: 'used' });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EPISODE_SNAPSHOT_FROZEN');
      expect(await eventRow(f.free)).toEqual({ name: 'Charity Gala', description: null, used_in_episode_id: null, status: 'draft' });
    });

    test('reassignment: an event linked to an unfilmed episode cannot be moved onto a filmed one; it stays where it was', async () => {
      const f = await seed();
      // free2 sits on the draft episode by its own link only (no brief names it, the draft is live: the terms lock holds it too).
      await run(`UPDATE world_events SET used_in_episode_id = :draft, status = 'used' WHERE id = :id`, { draft: f.draft, id: f.free2 });
      const res = await putEvent(f.show, f.free2, { used_in_episode_id: f.filmed });
      expect(res.status).toBe(409);
      expect((await eventRow(f.free2)).used_in_episode_id).toBe(f.draft);
      // And an event whose old episode is gone (so no terms lock) is still refused by this rule.
      await run('UPDATE world_events SET used_in_episode_id = NULL WHERE id = :id', { id: f.free2 });
      const again = await putEvent(f.show, f.free2, { used_in_episode_id: f.filmed });
      expect(again.status).toBe(409);
      expect(again.body.code).toBe('EPISODE_SNAPSHOT_FROZEN');
      expect((await eventRow(f.free2)).used_in_episode_id).toBeNull();
    });

    test('the same event onto an unfilmed episode is linked, as before', async () => {
      const f = await seed();
      const res = await putEvent(f.show, f.free, { used_in_episode_id: f.draft });
      expect(res.status).toBe(200);
      expect((await eventRow(f.free)).used_in_episode_id).toBe(f.draft);
    });

    test('an episode that was never filmed takes an event beside its brief\'s source event, as before', async () => {
      // stamp: false: the database allows one event's own link per episode
      // (world_events_used_in_episode_unique), so the source event's link is left unset here.
      const f = await seed({ film: false, stamp: false });
      const res = await putEvent(f.show, f.free, { used_in_episode_id: f.filmed });
      expect(res.status).toBe(200);
      expect((await eventRow(f.free)).used_in_episode_id).toBe(f.filmed);
    });

    test('a removed (soft-deleted) clip still counts as filmed', async () => {
      const f = await seed();
      await run('UPDATE episode_raw_clips SET deleted_at = NOW() WHERE episode_id = :id', { id: f.filmed });
      const res = await putEvent(f.show, f.free, { used_in_episode_id: f.filmed });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EPISODE_SNAPSHOT_FROZEN');
    });

    test('the stored link re-sent on a filmed episode is not a change: the save goes through and other fields are saved', async () => {
      const f = await seed();
      const res = await putEvent(f.show, f.source, { used_in_episode_id: f.filmed, description: 'A note added later' });
      expect(res.status).toBe(200);
      expect(await eventRow(f.source)).toMatchObject({ used_in_episode_id: f.filmed, description: 'A note added later' });
    });

    test('an unrelated edit to an event of a filmed episode is not blocked', async () => {
      const f = await seed();
      const res = await putEvent(f.show, f.source, { description: 'Only this' });
      expect(res.status).toBe(200);
      expect((await eventRow(f.source)).description).toBe('Only this');
      const other = await putEvent(f.show, f.free, { description: 'Unlinked event, edited' });
      expect(other.status).toBe(200);
    });

    test('the source event\'s own link, missing on a filmed episode (Episode 1\'s shape), can be restored: the brief already names it', async () => {
      const f = await seed({ stamp: false });
      expect((await eventRow(f.source)).used_in_episode_id).toBeNull();
      const before = { episode: await episodeRow(f.filmed), brief: await briefRow(f.filmed), clips: await clipCount(f.filmed) };
      const res = await putEvent(f.show, f.source, { used_in_episode_id: f.filmed });
      expect(res.status).toBe(200);
      expect((await eventRow(f.source)).used_in_episode_id).toBe(f.filmed);
      expect({ episode: await episodeRow(f.filmed), brief: await briefRow(f.filmed), clips: await clipCount(f.filmed) }).toEqual(before);
      // A different event is still refused on that same episode.
      const res2 = await putEvent(f.show, f.free, { used_in_episode_id: f.filmed });
      expect(res2.status).toBe(409);
    });

    test('nothing about the filmed episode moves on a refusal or on an allowed save: script, brief, source event, clips', async () => {
      const f = await seed();
      const before = await history(f);
      await putEvent(f.show, f.free, { used_in_episode_id: f.filmed });
      await putEvent(f.show, f.free2, { used_in_episode_id: f.filmed, name: 'x' });
      await putEvent(f.show, f.free, { used_in_episode_id: f.draft });
      expect(await history(f)).toEqual(before);
      expect(before.episode.script_content).toBe('INT. STUDIO. The filmed script.');
      expect(mockAsk.create).not.toHaveBeenCalled();
    });
  });

  // ── The brief edit ──────────────────────────────────────────────────────
  describe('the brief edit (PUT /episode-brief/:id)', () => {
    /** A filmed episode whose brief names no event (made by hand). */
    async function seedHandMade() {
      const f = await seed({ film: false });
      const hand = await addEpisode(f.show, 3, { script: 'A hand-made, filmed episode.' });
      await clips.createClip(sequelize, clipFor(hand, f.show));
      return { ...f, hand };
    }

    test('a first source event on a filmed episode is refused; nothing in the request is written', async () => {
      const f = await seedHandMade();
      const res = await putBrief(f.hand, { event_id: f.free, narrative_purpose: 'Sent in the same save' });
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ success: false, code: 'EPISODE_SNAPSHOT_FROZEN', episode_id: f.hand, event_id: f.free, fields: ['event_id'] });
      expect(await briefRow(f.hand)).toEqual({ event_id: null, narrative_purpose: null });
      expect((await eventRow(f.free)).used_in_episode_id).toBeNull();
    });

    test('an event whose own link already points at the filmed episode may be named on its brief (not a new association)', async () => {
      const f = await seedHandMade();
      await run(`UPDATE world_events SET used_in_episode_id = :hand, status = 'used' WHERE id = :id`, { hand: f.hand, id: f.free });
      const res = await putBrief(f.hand, { event_id: f.free });
      expect(res.status).toBe(200);
      expect((await briefRow(f.hand)).event_id).toBe(f.free);
    });

    test('an unfilmed episode\'s brief takes its first event, as before', async () => {
      const f = await seed();
      const res = await putBrief(f.draft, { event_id: f.free, narrative_purpose: 'Saved' });
      expect(res.status).toBe(200);
      expect(await briefRow(f.draft)).toEqual({ event_id: f.free, narrative_purpose: 'Saved' });
    });

    test('a filmed episode\'s brief still saves fields that are not the event, and its event re-sent unchanged', async () => {
      const f = await seed();
      const res = await putBrief(f.filmed, { narrative_purpose: 'A later note', event_id: f.source });
      expect(res.status).toBe(200);
      expect(await briefRow(f.filmed)).toEqual({ event_id: f.source, narrative_purpose: 'A later note' });
    });
  });

  // ── The third way an event is linked: inject ────────────────────────────
  describe('inject (POST …/events/:id/inject), already refused for a filmed episode', () => {
    const inject = (show, eventId, episodeId) => auth(request(app).post(`/api/v1/world/${show}/events/${eventId}/inject`)).send({ episode_id: episodeId });

    test('a filmed episode: refused (its script is never changed by a generator), and the event is not linked', async () => {
      const f = await seed({ stamp: false });
      const before = await history(f);
      const res = await inject(f.show, f.free, f.filmed);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('FILMED_SCRIPT_PROTECTED');
      expect(await eventRow(f.free)).toMatchObject({ used_in_episode_id: null, status: 'draft' });
      expect(await history(f)).toEqual(before);
    });
  });

  // ── The check itself ────────────────────────────────────────────────────
  describe('assertEpisodeAcceptsEventLink', () => {
    const ask = (args) => sequelize.transaction((transaction) => assertEpisodeAcceptsEventLink(sequelize, { ...args, transaction }));

    test('refuses only a filmed episode and only an event it is not already associated with; missing ids are not its business', async () => {
      const f = await seed();
      await expect(ask({ eventId: f.free, episodeId: f.filmed })).rejects.toMatchObject({ code: 'EPISODE_SNAPSHOT_FROZEN', status: 409 });
      await ask({ eventId: f.free, episodeId: f.filmed }).catch((err) => {
        expect(isFrozenEpisodeError(err)).toBe(true);
        expect(err.toJSON()).toMatchObject({ success: false, episode_id: f.filmed, event_id: f.free, fields: ['used_in_episode_id'] });
      });
      await expect(ask({ eventId: f.source, episodeId: f.filmed })).resolves.toBeUndefined();
      await expect(ask({ eventId: f.free, episodeId: f.draft })).resolves.toBeUndefined();
      await expect(ask({ eventId: null, episodeId: f.filmed })).resolves.toBeUndefined();
      await expect(ask({ eventId: f.free, episodeId: null })).resolves.toBeUndefined();
    });

    test('a removed brief or a deleted event does not make an association', async () => {
      const f = await seed();
      await run('UPDATE episode_briefs SET deleted_at = NOW() WHERE episode_id = :id', { id: f.filmed });
      await run('UPDATE world_events SET used_in_episode_id = NULL WHERE id = :id', { id: f.source });
      await expect(ask({ eventId: f.source, episodeId: f.filmed })).rejects.toMatchObject({ code: 'EPISODE_SNAPSHOT_FROZEN' });
    });
  });
});
