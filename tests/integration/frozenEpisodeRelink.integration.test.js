/**
 * A1.2c relink guards (Evoni, 2026-11-06): an event whose filmed episode was
 * deleted never joins another episode, also through the two edits that could
 * still link it. Found by the merge-readiness audit and reproduced on the
 * test database:
 *   - the event edit (PUT …/events/:id { used_in_episode_id }) relinked it;
 *   - the brief edit (PUT /episode-brief/:id { event_id }) named it on
 *     another episode's empty brief.
 * Both now answer 409 EVENT_EPISODE_FROZEN, and nothing in the refused
 * request is written. Unfilmed histories, the stored link re-sent, clearing
 * the link, and unrelated edits behave as before. The check takes the
 * event's linked episodes and the target first (episode-first, FOR UPDATE),
 * then the event, so a clip attach or a delete in progress takes turns with
 * it, and two competing link changes serialize without a deadlock.
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
const { lockEpisodes, isLockConflict } = require('../../src/utils/episodeLocks');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function track(promise) {
  const t = { settled: false, value: undefined, error: undefined };
  t.promise = promise.then((v) => { t.settled = true; t.value = v; return v; }, (e) => { t.settled = true; t.error = e; throw e; });
  t.promise.catch(() => {});
  return t;
}

(shouldSkip ? describe.skip : describe)('A1.2c relink guards: a deleted, filmed episode\'s event joins no other episode', () => {
  const shows = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const putEvent = (f, body) => auth(request(app).put(`/api/v1/world/${f.show}/events/${f.eventId}`)).send(body);
  const putBrief = (episodeId, body) => auth(request(app).put(`/api/v1/episode-brief/${episodeId}`)).send(body);
  const eventRow = async (id) => (await rows('SELECT name, used_in_episode_id FROM world_events WHERE id = :id', { id }))[0];
  const briefRow = async (episodeId) => (await rows('SELECT event_id, narrative_purpose FROM episode_briefs WHERE episode_id = :episodeId', { episodeId }))[0];
  const clipFor = (episodeId, show) => ({ id: uuid(), episode_id: episodeId, show_id: show, performer: 'lala', s3_key_raw: `episodes/${episodeId}/raw-clips/${uuid()}/original.mp4` });

  /**
   * An event that started `gone` (deleted by SQL, outside the app; filmed
   * unless film: false), plus a live episode `other` with an empty brief.
   */
  async function seed({ film = true } = {}) {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :n, :n, '{}'::jsonb, NOW(), NOW())`, { show, n: `relink-${show.slice(0, 8)}` });
    const gone = uuid();
    const other = uuid();
    const eventId = uuid();
    for (const [id, n] of [[gone, 1], [other, 2]]) {
      await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:id, :show, :t, :n, 'draft', NOW(), NOW())`, { id, show, t: `Episode ${n}`, n });
    }
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, strictness, cost_coins, used_in_episode_id, times_used, is_paid, payment_amount, canon_consequences, created_at, updated_at)
               VALUES (:eventId, :show, 'Filmed gala', 'invite', 'used', 3, 5, 0, :gone, 1, false, 0, '{}'::jsonb, NOW(), NOW())`, { eventId, show, gone });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, created_at, updated_at) VALUES (:b, :gone, :show, :eventId, 'draft', NOW(), NOW())`, { b: uuid(), gone, show, eventId });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, status, created_at, updated_at) VALUES (:b, :other, :show, 'draft', NOW(), NOW())`, { b: uuid(), other, show });
    if (film) await clips.createClip(sequelize, clipFor(gone, show));
    await run('UPDATE episodes SET deleted_at = NOW() WHERE id = :gone', { gone });
    return { show, gone, other, eventId };
  }
  async function addEpisode(show, n) {
    const id = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:id, :show, :t, :n, 'draft', NOW(), NOW())`, { id, show, t: `Episode ${n}`, n });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, status, created_at, updated_at) VALUES (:b, :id, :show, 'draft', NOW(), NOW())`, { b: uuid(), id, show });
    return id;
  }

  beforeAll(() => {
    token = TokenService.generateTokenPair({ id: 'test-user-relink', email: 'relink@test.dev', name: 'Relink', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
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

  // ── The two reproductions, now refusals ─────────────────────────────────
  test('event edit: relinking to another episode is refused (409 EVENT_EPISODE_FROZEN); nothing in the request is written', async () => {
    const f = await seed();
    const res = await putEvent(f, { used_in_episode_id: f.other, name: 'Renamed in the same save' });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, code: 'EVENT_EPISODE_FROZEN', event_id: f.eventId, episode_id: f.gone });
    expect(res.body.error).toMatch(/was filmed .* and later deleted, so the event cannot start or join another episode/);
    expect(await eventRow(f.eventId)).toEqual({ name: 'Filmed gala', used_in_episode_id: f.gone });
  });

  test('event edit: refused also once the stale link was cleared (only a brief still names the filmed episode)', async () => {
    const f = await seed();
    await run('UPDATE world_events SET used_in_episode_id = NULL WHERE id = :id', { id: f.eventId });
    const res = await putEvent(f, { used_in_episode_id: f.other });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EVENT_EPISODE_FROZEN');
    expect((await eventRow(f.eventId)).used_in_episode_id).toBeNull();
  });

  test('brief edit: naming the event on another episode\'s brief is refused (409); nothing in the request is written', async () => {
    const f = await seed();
    const res = await putBrief(f.other, { event_id: f.eventId, narrative_purpose: 'Sent in the same save' });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'EVENT_EPISODE_FROZEN', event_id: f.eventId, episode_id: f.gone });
    expect(await briefRow(f.other)).toEqual({ event_id: null, narrative_purpose: null });
  });

  // ── What stays as before ────────────────────────────────────────────────
  test('an unfilmed deleted episode\'s event relinks as before (event edit and brief edit)', async () => {
    const f = await seed({ film: false });
    expect((await putEvent(f, { used_in_episode_id: f.other })).status).toBe(200);
    expect((await eventRow(f.eventId)).used_in_episode_id).toBe(f.other);
    const g = await seed({ film: false });
    const third = await addEpisode(g.show, 3);
    expect((await putBrief(third, { event_id: g.eventId })).status).toBe(200);
    expect((await briefRow(third)).event_id).toBe(g.eventId);
  });

  test('clearing the link and re-sending the stored link are not refused; unrelated event edits save', async () => {
    const f = await seed();
    const resend = await putEvent(f, { used_in_episode_id: f.gone, name: 'Renamed' });
    expect(resend.status).toBe(200);
    expect(await eventRow(f.eventId)).toEqual({ name: 'Renamed', used_in_episode_id: f.gone });
    const clear = await putEvent(f, { used_in_episode_id: null });
    expect(clear.status).toBe(200);
    expect((await eventRow(f.eventId)).used_in_episode_id).toBeNull();
    expect((await putEvent(f, { name: 'Renamed again' })).status).toBe(200);
  });

  test('a normal event links through either edit, and unrelated brief edits save on any episode', async () => {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :n, :n, '{}'::jsonb, NOW(), NOW())`, { show, n: `relink-${show.slice(0, 8)}` });
    const a = await addEpisode(show, 1);
    const b = await addEpisode(show, 2);
    const ev = uuid();
    const ev2 = uuid();
    for (const id of [ev, ev2]) {
      await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, strictness, cost_coins, times_used, is_paid, payment_amount, canon_consequences, created_at, updated_at)
                 VALUES (:id, :show, 'Fresh', 'invite', 'ready', 3, 5, 0, 0, false, 0, '{}'::jsonb, NOW(), NOW())`, { id, show });
    }
    const viaEvent = await auth(request(app).put(`/api/v1/world/${show}/events/${ev}`)).send({ used_in_episode_id: a });
    expect(viaEvent.status).toBe(200);
    expect((await eventRow(ev)).used_in_episode_id).toBe(a);
    const viaBrief = await putBrief(b, { event_id: ev2, narrative_purpose: 'Her purpose' });
    expect(viaBrief.status).toBe(200);
    expect(await briefRow(b)).toEqual({ event_id: ev2, narrative_purpose: 'Her purpose' });
    expect((await putBrief(a, { forward_hook: 'Next week' })).status).toBe(200);
  });

  test('the existing brief rule is unchanged: a brief\'s event, once set, cannot change (EVENT_TERMS_LOCKED)', async () => {
    const f = await seed({ film: false });
    const res = await putBrief(f.gone, { event_id: uuid() });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EVENT_TERMS_LOCKED');
  });

  // ── Concurrency ─────────────────────────────────────────────────────────
  test('a clip attaching to the deleted episode while a relink is checked: the relink waits, then is refused', async () => {
    const f = await seed({ film: false }); // unfilmed when the relink starts
    const t1 = await sequelize.transaction();
    let relink;
    try {
      await lockEpisodes(sequelize, [f.gone], { transaction: t1, mode: 'share' }); // as rawClipsService.attachClip
      await sequelize.query(
        `INSERT INTO episode_raw_clips (id, episode_id, show_id, performer, s3_key_raw, key_status, key_strength, created_at, updated_at)
         VALUES (:id, :gone, :show, 'lala', :key, 'none', 'medium', NOW(), NOW())`,
        { replacements: { id: uuid(), gone: f.gone, show: f.show, key: `episodes/${f.gone}/raw-clips/x/original.mp4` }, transaction: t1 });
      relink = track(putEvent(f, { used_in_episode_id: f.other }));
      await wait(400);
      expect(relink.settled).toBe(false); // the relink's FOR UPDATE waits on the attach's FOR SHARE
      await t1.commit();
    } catch (err) {
      await t1.rollback().catch(() => {});
      throw err;
    }
    const res = await relink.promise;
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EVENT_EPISODE_FROZEN');
    expect((await eventRow(f.eventId)).used_in_episode_id).toBe(f.gone);
  });

  test('the brief edit takes the same turn: a clip attach in progress makes it wait, then refuse', async () => {
    const f = await seed({ film: false });
    const t1 = await sequelize.transaction();
    let link;
    try {
      await lockEpisodes(sequelize, [f.gone], { transaction: t1, mode: 'share' });
      await sequelize.query(
        `INSERT INTO episode_raw_clips (id, episode_id, show_id, performer, s3_key_raw, key_status, key_strength, created_at, updated_at)
         VALUES (:id, :gone, :show, 'lala', :key, 'none', 'medium', NOW(), NOW())`,
        { replacements: { id: uuid(), gone: f.gone, show: f.show, key: `episodes/${f.gone}/raw-clips/y/original.mp4` }, transaction: t1 });
      link = track(putBrief(f.other, { event_id: f.eventId }));
      await wait(400);
      expect(link.settled).toBe(false);
      await t1.commit();
    } catch (err) {
      await t1.rollback().catch(() => {});
      throw err;
    }
    const res = await link.promise;
    expect(res.status).toBe(409);
    expect((await briefRow(f.other)).event_id).toBeNull();
  });

  test('two competing event-link changes serialize on the event: one links, the other is refused by the terms lock; no deadlock', async () => {
    const f = await seed({ film: false });
    const third = await addEpisode(f.show, 3);
    for (let i = 0; i < 3; i += 1) {
      await run('UPDATE world_events SET used_in_episode_id = :gone WHERE id = :id', { gone: f.gone, id: f.eventId });
      const [x, y] = await Promise.all([putEvent(f, { used_in_episode_id: f.other }), putEvent(f, { used_in_episode_id: third })]);
      const statuses = [x.status, y.status].sort();
      expect(statuses).toEqual([200, 409]);
      const refused = x.status === 409 ? x : y;
      expect(['EVENT_TERMS_LOCKED', 'EVENT_LINK_CHANGED_RETRY']).toContain(refused.body.code);
      expect([f.other, third]).toContain((await eventRow(f.eventId)).used_in_episode_id);
    }
  });

  test('an event-edit relink and a brief-edit link of the same event, at once: consistent, no deadlock', async () => {
    const f = await seed({ film: false });
    const third = await addEpisode(f.show, 3);
    const [viaEvent, viaBrief] = await Promise.allSettled([
      putEvent(f, { used_in_episode_id: f.other }),
      putBrief(third, { event_id: f.eventId }),
    ]);
    for (const r of [viaEvent, viaBrief]) {
      expect(r.status).toBe('fulfilled');
      expect(r.value.status).not.toBe(500);
      expect(isLockConflict(r.value.body)).toBe(false);
    }
    expect((await eventRow(f.eventId)).used_in_episode_id).toBe(viaEvent.value.status === 200 ? f.other : f.gone);
    expect(mockAsk.create).not.toHaveBeenCalled();
  });
});
