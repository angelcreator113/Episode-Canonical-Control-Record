/**
 * Multi-event episodes, step 1 (Evoni, 2026-11-12; services/episodeSecondaryEvents).
 *
 * An episode has one primary event (its brief's) and may have other events
 * linked by their own link (world_events.used_in_episode_id). Step 1 is the
 * backend rules, behind MULTI_EVENT_ATTACH_ENABLED (default off):
 *
 *   - the switch gates NEW second attachments only; a first link, the
 *     primary's own link and every single-event Start are as before;
 *   - a second event carrying any commitment is refused (the obligations
 *     gate), and anything that cannot be read counts as a commitment;
 *   - multi-event Start links every chosen event in the Start's own
 *     transaction, or creates nothing;
 *   - while world_events_used_in_episode_unique remains, a second link is
 *     answered 409 EPISODE_EVENT_LINK_TAKEN (never 500);
 *   - completion, finalize and the first take are refused for an episode
 *     whose second event carries commitments, whatever the switch says;
 *   - terms are not reopened for a second event, and a two-parter's terms
 *     only while every episode that shares them is a draft;
 *   - a second event is removed only where it is safe, once, and audited.
 *
 * One block drops that index in this throwaway test database and puts it
 * back, to prove the rules hold without it. No model is called.
 */
jest.unmock('uuid');

const mockAsk = { create: jest.fn(async () => { throw new Error('the model must not be asked'); }) };
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: (...a) => mockAsk.create(...a) } })));

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const secondary = require('../../src/services/episodeSecondaryEvents');
const {
  isEpisodeEventLinkConflict, episodeEventLinkTakenBody, EVENT_EPISODE_LINK_INDEX, EPISODE_EVENT_LINK_TAKEN_CODE,
} = require('../../src/utils/eventEpisodeLink');
const { eligibilityReasons, reopenEligibility, REOPEN_REASONS } = require('../../src/services/termsReopenService');

const { sequelize } = models;
const SWITCH = 'MULTI_EVENT_ATTACH_ENABLED';

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

describe('the switch', () => {
  test('is MULTI_EVENT_ATTACH_ENABLED, on only for the exact word true', () => {
    expect(secondary.SWITCH).toBe(SWITCH);
    for (const off of [undefined, '', '0', '1', 'false', 'yes', 'on', 'enabled']) expect(secondary.attachEnabled({ [SWITCH]: off })).toBe(false);
    for (const on of ['true', 'TRUE', ' true ']) expect(secondary.attachEnabled({ [SWITCH]: on })).toBe(true);
    expect(secondary.attachEnabled({})).toBe(false);
  });
});

describe('isEpisodeEventLinkConflict: only the one known conflict', () => {
  const pg = (code, constraint) => ({ name: 'SequelizeUniqueConstraintError', message: 'Validation error', original: { code, constraint } });

  test('23505 on the event-episode link index, as Sequelize reports it (original or parent)', () => {
    expect(isEpisodeEventLinkConflict(pg('23505', EVENT_EPISODE_LINK_INDEX))).toBe(true);
    expect(isEpisodeEventLinkConflict({ parent: { code: '23505', constraint: EVENT_EPISODE_LINK_INDEX } })).toBe(true);
    expect(EVENT_EPISODE_LINK_INDEX).toBe('world_events_used_in_episode_unique');
  });

  test('another unique index, another error code, a bare error, and nothing at all are not it', () => {
    expect(isEpisodeEventLinkConflict(pg('23505', 'world_events_pkey'))).toBe(false);
    expect(isEpisodeEventLinkConflict(pg('23505', undefined))).toBe(false);
    expect(isEpisodeEventLinkConflict(pg('23503', EVENT_EPISODE_LINK_INDEX))).toBe(false);
    expect(isEpisodeEventLinkConflict(pg('40001', EVENT_EPISODE_LINK_INDEX))).toBe(false);
    expect(isEpisodeEventLinkConflict({ name: 'SequelizeUniqueConstraintError', message: 'Validation error' })).toBe(false);
    expect(isEpisodeEventLinkConflict(new Error(`duplicate key value violates unique constraint "${EVENT_EPISODE_LINK_INDEX}"`))).toBe(false);
    expect(isEpisodeEventLinkConflict(null)).toBe(false);
    expect(isEpisodeEventLinkConflict(undefined)).toBe(false);
  });

  test('the body: { success, error, code }, naming the event that holds the link; it states no one-event rule', () => {
    const body = episodeEventLinkTakenBody({ episodeId: 'ep-1', holder: { id: 'ev-1', name: 'Studio Session' } });
    expect(body).toEqual({
      success: false,
      error: 'This episode already has "Studio Session" linked to it, and a second event cannot be linked to an episode yet. Nothing was changed.',
      code: 'EPISODE_EVENT_LINK_TAKEN',
      fields: ['used_in_episode_id'],
      episode_id: 'ep-1',
      linked_event: { id: 'ev-1', name: 'Studio Session' },
    });
    expect(body.error).not.toMatch(/holds one|one linked event|only one/i);
    expect(episodeEventLinkTakenBody({ episodeId: 'ep-1' })).toMatchObject({ error: expect.stringContaining('already has another event linked'), linked_event: null });
    expect(EPISODE_EVENT_LINK_TAKEN_CODE).toBe('EPISODE_EVENT_LINK_TAKEN');
  });
});

describe('reopen eligibility, pure', () => {
  const lockEpisode = { id: 'ep-2', title: 'Part 2' };
  test('one draft episode with nothing booked is eligible, as before', () => {
    expect(eligibilityReasons({ lockEpisode, episodeStatus: 'draft' })).toEqual([]);
  });
  test('another episode sharing the terms must be a draft too', () => {
    const reasons = eligibilityReasons({ lockEpisode, episodeStatus: 'draft', otherEpisodes: [{ id: 'ep-1', title: 'Part 1', status: 'completed' }] });
    expect(reasons).toEqual([{ code: REOPEN_REASONS.OTHER_EPISODE_NOT_DRAFT, message: '"Part 1" shares these terms and is completed, not a draft.' }]);
    expect(eligibilityReasons({ lockEpisode, episodeStatus: 'draft', otherEpisodes: [{ id: 'ep-1', title: 'Part 1', status: 'draft' }] })).toEqual([]);
  });
  test('a second event of its episode is never eligible', () => {
    expect(eligibilityReasons({ lockEpisode, episodeStatus: 'draft', secondaryOf: 'ep-2' }).map((r) => r.code)).toEqual([REOPEN_REASONS.SECONDARY_EVENT]);
  });
});

(shouldSkip ? describe.skip : describe)('second events of an episode', () => {
  const shows = [];
  let token;
  let adminToken;
  let savedSwitch;
  // Each test its own address (trust proxy is 1): the 60-writes-a-minute limit is per address.
  let testNumber = 0;
  const from = (r) => r.set('X-Forwarded-For', `10.61.${Math.floor(testNumber / 250)}.${(testNumber % 250) + 1}`);
  const auth = (r) => from(r).set('Authorization', `Bearer ${token}`);
  const asAdmin = (r) => from(r).set('Authorization', `Bearer ${adminToken}`);
  const putEvent = (show, eventId, body) => auth(request(app).put(`/api/v1/world/${show}/events/${eventId}`)).send(body);
  const startMany = (show, ids, { key, body = {} } = {}) => {
    const r = auth(request(app).post(`/api/v1/world/${show}/events/generate-episode-from-many`));
    if (key) r.set('Idempotency-Key', key);
    return r.send({ event_ids: ids, ...body });
  };
  const startOne = (show, eventId) => auth(request(app).post(`/api/v1/world/${show}/events/${eventId}/generate-episode`)).send({ draft_script: false });
  const detach = (show, eventId, body = { reason: 'Picked by mistake' }) => auth(request(app).post(`/api/v1/world/${show}/events/${eventId}/detach-episode`)).send(body);
  const eventRow = async (id) => (await rows('SELECT name, description, used_in_episode_id, status, prestige FROM world_events WHERE id = :id', { id }))[0];
  const linkOf = async (id) => (await rows('SELECT used_in_episode_id FROM world_events WHERE id = :id', { id }))[0]?.used_in_episode_id ?? null;
  const episodesOf = (show) => rows('SELECT id FROM episodes WHERE show_id = :show AND deleted_at IS NULL', { show });
  const on = () => { process.env[SWITCH] = 'true'; };
  const off = () => { delete process.env[SWITCH]; };

  async function addShow() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :n, :n, '{}'::jsonb, NOW(), NOW())`, { show, n: `secondary-${show.slice(0, 8)}` });
    await models.CharacterState.create({ show_id: show, character_key: 'lala', coins: 1000, reputation: 3 });
    return show;
  }
  /** An event with no commitment of any kind (cost_coins defaults to 100, so it is set to 0). */
  async function addEvent(show, name, { episodeId = null, set = {} } = {}) {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, strictness, cost_coins, used_in_episode_id, times_used, is_paid, payment_amount, canon_consequences, created_at, updated_at)
               VALUES (:id, :show, :name, 'invite', :status, 3, 5, 0, :episodeId, :times, false, 0, '{}'::jsonb, NOW(), NOW())`,
    { id, show, name, episodeId, status: episodeId ? 'used' : 'ready', times: episodeId ? 1 : 0 });
    for (const [column, value] of Object.entries(set)) {
      await run(`UPDATE world_events SET ${column} = ${typeof value === 'object' && value !== null ? 'CAST(:value AS jsonb)' : ':value'} WHERE id = :id`,
        { id, value: typeof value === 'object' && value !== null ? JSON.stringify(value) : value });
    }
    return id;
  }
  async function addEpisode(show, n = 1, status = 'draft') {
    const id = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:id, :show, :t, :n, :status, NOW(), NOW())`,
      { id, show, t: `Episode ${n}`, n, status });
    return id;
  }
  const addBrief = (show, episode, event) => run(
    `INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, created_at, updated_at) VALUES (:id, :episode, :show, :event, 'draft', NOW(), NOW())`,
    { id: uuid(), episode, show, event });
  /** A second event already on an episode, written directly: what an attach leaves, without needing the index gone. */
  const film = (show, episode) => run(
    `INSERT INTO episode_raw_clips (id, episode_id, show_id, performer, original_filename, s3_key_raw, url_raw, key_status, created_at, updated_at)
     VALUES (:id, :episode, :show, 'lala', 'take.mp4', :key, 'https://example.invalid/take.mp4', 'none', NOW(), NOW())`,
    { id: uuid(), episode, show, key: `episodes/${episode}/raw-clips/${uuid()}/original.mp4` });

  /** An unfilmed episode whose brief names `first` (also linked by its own link), an empty episode, and an unstarted event `second`. */
  async function seed({ brief = true } = {}) {
    const show = await addShow();
    const episode = await addEpisode(show, 1);
    const empty = await addEpisode(show, 2);
    const first = await addEvent(show, 'Studio Session', { episodeId: episode });
    if (brief) await addBrief(show, episode, first);
    const second = await addEvent(show, 'Charity Gala');
    return { show, episode, empty, first, second };
  }

  const INDEX_SQL = `CREATE UNIQUE INDEX IF NOT EXISTS world_events_used_in_episode_unique ON world_events (used_in_episode_id) WHERE used_in_episode_id IS NOT NULL`;
  const indexThere = async () => (await rows(`SELECT 1 FROM pg_indexes WHERE indexname = 'world_events_used_in_episode_unique'`)).length === 1;

  async function cleanup() {
    if (!shows.length) return;
    const q = (sql) => sequelize.query(sql, { replacements: { shows } }).catch(() => {});
    await q('DELETE FROM scene_plans WHERE episode_id IN (SELECT id FROM episodes WHERE show_id IN (:shows))');
    await q('DELETE FROM scene_set_episodes WHERE episode_id IN (SELECT id FROM episodes WHERE show_id IN (:shows))');
    for (const t of ['episode_spending_lines', 'episode_briefs', 'episode_todo_lists', 'episode_raw_clips']) {
      await q(`DELETE FROM ${t} WHERE episode_id IN (SELECT id FROM episodes WHERE show_id IN (:shows))`);
    }
    for (const t of ['event_deliverables', 'event_costs', 'deal_price_snapshots']) {
      await q(`DELETE FROM ${t} WHERE event_id IN (SELECT id FROM world_events WHERE show_id IN (:shows))`);
    }
    for (const t of ['feed_posts', 'financial_transactions', 'character_state_history', 'character_state', 'season_slots']) {
      await q(`DELETE FROM ${t} WHERE show_id IN (:shows)`);
    }
    await q('UPDATE world_events SET used_in_episode_id = NULL WHERE show_id IN (:shows)');
    await q('UPDATE opportunities SET event_id = NULL WHERE show_id IN (:shows)');
    await q('DELETE FROM episodes WHERE show_id IN (:shows)');
    await q('DELETE FROM opportunities WHERE show_id IN (:shows)');
    await q('DELETE FROM world_events WHERE show_id IN (:shows)');
    await q('DELETE FROM shows WHERE id IN (:shows)');
    shows.length = 0;
  }

  beforeAll(() => {
    savedSwitch = process.env[SWITCH];
    token = TokenService.generateTokenPair({ id: 'test-user-secondary', email: 'secondary@test.dev', name: 'Secondary', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    adminToken = TokenService.generateTokenPair({ id: 'test-admin-secondary', email: 'admin@test.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
  });
  beforeEach(() => {
    testNumber += 1;
    off();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (savedSwitch === undefined) delete process.env[SWITCH]; else process.env[SWITCH] = savedSwitch;
    await cleanup();
    await run(INDEX_SQL).catch(() => {});
    await sequelize.close();
  });

  test('the database still has the one-link index: this PR does not change it', async () => {
    expect(await indexThere()).toBe(true);
    const [def] = await rows(`SELECT indexdef FROM pg_indexes WHERE indexname = 'world_events_used_in_episode_unique'`);
    expect(def.indexdef).toMatch(/UNIQUE INDEX world_events_used_in_episode_unique ON .*world_events .*\(used_in_episode_id\) WHERE \(used_in_episode_id IS NOT NULL\)/);
  });

  // ── The obligations gate ───────────────────────────────────────────────
  describe('what counts as a commitment (reusing the records that hold it)', () => {
    const kinds = async (eventId) => (await secondary.eventObligations(sequelize, eventId)).obligations.map((o) => o.kind).sort();

    test('an event with none: nothing found, and known', async () => {
      const show = await addShow();
      const ev = await addEvent(show, 'Plain');
      expect(await secondary.eventObligations(sequelize, ev)).toMatchObject({ known: true, obligations: [] });
    });

    test.each([
      ['a deal type', { deal_type: 'brand_partnership' }, 'deal'],
      ['deal components', { deal_components: ['paid_deliverables'] }, 'deal'],
      ['marked paid, amount 0 (zero-value)', { is_paid: true }, 'payment'],
      ['a payment amount', { payment_amount: 500 }, 'payment'],
      ['an appearance fee', { appearance_fee: 250 }, 'payment'],
      ['a gifted value', { gifted_value: 40 }, 'payment'],
      ['an entry cost', { cost_coins: 100 }, 'cost'],
      ['bonus terms', { bonus_terms: { views: 1000 } }, 'contract'],
      ['restrictions', { restrictions: ['no competing brands'] }, 'contract'],
      ['access requirements', { requirements: { reputation_min: 4 } }, 'contract'],
    ])('%s', async (_label, set, kind) => {
      const show = await addShow();
      const ev = await addEvent(show, 'Committed', { set });
      expect(await kinds(ev)).toContain(kind);
    });

    test('a deliverable with no fee, pending, waived or deferred: its record exists, so it counts', async () => {
      const show = await addShow();
      for (const status of ['pending', 'waived', 'deferred', 'delivered']) {
        const ev = await addEvent(show, `Deliverable ${status}`);
        await run(`INSERT INTO event_deliverables (id, event_id, description, status, fee, created_at, updated_at) VALUES (:id, :ev, 'One post', :status, NULL, NOW(), NOW())`,
          { id: uuid(), ev, status });
        expect(await kinds(ev)).toEqual(['deliverable']);
      }
    });

    test('an itemised cost of 0 counts; a deleted one does not', async () => {
      const show = await addShow();
      const ev = await addEvent(show, 'Costed');
      const cost = uuid();
      await run(`INSERT INTO event_costs (id, event_id, kind, label, amount, paid_by, created_at, updated_at) VALUES (:cost, :ev, 'travel', 'Car', 0, 'lala', NOW(), NOW())`, { cost, ev });
      expect(await kinds(ev)).toEqual(['cost']);
      await run('UPDATE event_costs SET deleted_at = NOW() WHERE id = :cost', { cost });
      expect(await kinds(ev)).toEqual([]);
    });

    test('an opportunity: open, pending, or of an unknown status counts; only a conclusively closed one does not', async () => {
      const show = await addShow();
      const { CLOSED_STATUSES } = require('../../src/services/startOfferDecision');
      const withOpp = async (status) => {
        const ev = await addEvent(show, `Offer ${status}`);
        await run(`INSERT INTO opportunities (id, show_id, name, opportunity_type, status, status_history, payment_amount, event_id, created_at, updated_at)
                   VALUES (:id, :show, :name, 'campaign', :status, '[]'::jsonb, 0, :ev, NOW(), NOW())`, { id: uuid(), show, name: `Offer ${status}`, status, ev });
        return kinds(ev);
      };
      for (const status of ['offered', 'negotiating', 'pending', 'booked', 'some_new_status']) {
        if (CLOSED_STATUSES.includes(status)) continue;
        expect(await withOpp(status)).toEqual(['offer']);
      }
      expect(CLOSED_STATUSES.length).toBeGreaterThan(0);
      for (const status of CLOSED_STATUSES) expect(await withOpp(status)).toEqual([]);
    });

    test('a record that cannot be read counts, and the result says it is not known (fail closed)', async () => {
      const show = await addShow();
      const ev = await addEvent(show, 'Unreadable');
      const real = sequelize.query.bind(sequelize);
      jest.spyOn(sequelize, 'query').mockImplementation((sql, ...rest) => (
        typeof sql === 'string' && /FROM event_costs/.test(sql) ? Promise.reject(new Error('relation unavailable')) : real(sql, ...rest)));
      const found = await secondary.eventObligations(sequelize, ev);
      expect(found.known).toBe(false);
      expect(found.obligations).toEqual([{ kind: 'cost', detail: 'could not be read, so it counts as an obligation' }]);
      await expect(secondary.assertNoObligations(sequelize, ev)).rejects.toMatchObject({ status: 409, code: 'SECONDARY_EVENT_HAS_OBLIGATIONS' });
    });

    test('an event that is not there cannot be classified, so it is refused', async () => {
      const found = await secondary.eventObligations(sequelize, uuid());
      expect(found).toMatchObject({ known: false, event: null });
      expect(found.obligations).toHaveLength(1);
    });
  });

  // ── The event edit (PUT) ────────────────────────────────────────────────
  describe('PUT …/events/:id { used_in_episode_id }', () => {
    test('switch off: a second event is refused 409 SECONDARY_EVENTS_NOT_ENABLED, not 500, and nothing in the request is saved', async () => {
      const f = await seed();
      const before = { first: await eventRow(f.first), second: await eventRow(f.second) };
      const res = await putEvent(f.show, f.second, { name: 'Renamed in the same save', description: 'Also sent', prestige: 9, used_in_episode_id: f.episode });
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ success: false, code: 'SECONDARY_EVENTS_NOT_ENABLED' });
      expect(await eventRow(f.second)).toEqual(before.second);
      expect(await eventRow(f.first)).toEqual(before.first);
      expect(before.second).toEqual({ name: 'Charity Gala', description: null, used_in_episode_id: null, status: 'ready', prestige: 3 });
    });

    test('switch off: the ordinary saves are untouched (no link; a first link; the primary re-sent)', async () => {
      const f = await seed();
      expect((await putEvent(f.show, f.second, { name: 'Renamed', description: 'Saved' })).status).toBe(200);
      expect(await eventRow(f.second)).toMatchObject({ name: 'Renamed', description: 'Saved', used_in_episode_id: null });
      expect((await putEvent(f.show, f.second, { used_in_episode_id: f.empty })).status).toBe(200);
      expect((await eventRow(f.second)).used_in_episode_id).toBe(f.empty);
      expect((await putEvent(f.show, f.first, { used_in_episode_id: f.episode, description: 'Mine already' })).status).toBe(200);
      expect(await eventRow(f.first)).toMatchObject({ used_in_episode_id: f.episode, description: 'Mine already' });
    });

    test('switch on, index in place: 409 EPISODE_EVENT_LINK_TAKEN naming the event that holds the link; nothing saved', async () => {
      const f = await seed();
      on();
      const before = await eventRow(f.second);
      const res = await putEvent(f.show, f.second, { description: 'Also sent', used_in_episode_id: f.episode });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        success: false,
        error: 'This episode already has "Studio Session" linked to it, and a second event cannot be linked to an episode yet. Nothing was changed.',
        code: 'EPISODE_EVENT_LINK_TAKEN',
        fields: ['used_in_episode_id'],
        episode_id: f.episode,
        linked_event: { id: f.first, name: 'Studio Session' },
      });
      expect(await eventRow(f.second)).toEqual(before);
    });

    test('switch on: once the first event no longer holds the link, the link follows the database, not a guess', async () => {
      const f = await seed({ brief: false });
      on();
      await run('UPDATE world_events SET used_in_episode_id = NULL WHERE id = :id', { id: f.first });
      const res = await putEvent(f.show, f.second, { used_in_episode_id: f.episode });
      expect(res.status).toBe(200);
      expect((await eventRow(f.second)).used_in_episode_id).toBe(f.episode);
    });

    test('switch on: the brief must name the primary first (409 PRIMARY_EVENT_REQUIRED)', async () => {
      const f = await seed({ brief: false });
      on();
      const res = await putEvent(f.show, f.second, { used_in_episode_id: f.episode });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('PRIMARY_EVENT_REQUIRED');
      expect(await linkOf(f.second)).toBeNull();
    });

    test('switch on: a second event with a commitment is refused 409 SECONDARY_EVENT_HAS_OBLIGATIONS, listing it', async () => {
      const f = await seed();
      on();
      await run('UPDATE world_events SET is_paid = true WHERE id = :id', { id: f.second });
      const res = await putEvent(f.show, f.second, { used_in_episode_id: f.episode });
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'SECONDARY_EVENT_HAS_OBLIGATIONS', event_id: f.second, obligations: [{ kind: 'payment', detail: 'marked as paid work' }] });
      expect(await linkOf(f.second)).toBeNull();
    });

    test('switch on: a filmed episode takes no second event (409 EPISODE_SNAPSHOT_FROZEN)', async () => {
      const f = await seed();
      on();
      await film(f.show, f.episode);
      const res = await putEvent(f.show, f.second, { used_in_episode_id: f.episode });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EPISODE_SNAPSHOT_FROZEN');
      expect(await linkOf(f.second)).toBeNull();
    });

    describe('every other failure answers as before', () => {
      const failUpdateWith = (err) => {
        const real = sequelize.query.bind(sequelize);
        return jest.spyOn(sequelize, 'query').mockImplementation((sql, ...rest) => {
          if (typeof sql === 'string' && /^\s*UPDATE world_events SET /.test(sql) && /WHERE id = :eventId/.test(sql)) return Promise.reject(err);
          return real(sql, ...rest);
        });
      };
      const unique = (constraint) => Object.assign(new Error('Validation error'), { name: 'SequelizeUniqueConstraintError', original: { code: '23505', constraint } });

      test('a unique violation on another index is still a 500, and is not called an episode-link conflict', async () => {
        const f = await seed();
        failUpdateWith(unique('some_other_unique_index'));
        const res = await putEvent(f.show, f.second, { description: 'x' });
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ success: false, error: 'Failed to update event' });
        expect(res.body.code).toBeUndefined();
      });

      test('an unrelated database error is still a 500', async () => {
        const f = await seed();
        failUpdateWith(Object.assign(new Error('connection terminated unexpectedly'), { name: 'SequelizeConnectionError' }));
        const res = await putEvent(f.show, f.second, { description: 'x' });
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ success: false, error: 'Failed to update event' });
      });

      test('a foreign-key failure keeps its own 400', async () => {
        const f = await seed();
        failUpdateWith(Object.assign(new Error('insert or update violates foreign key constraint'), { name: 'SequelizeForeignKeyConstraintError', original: { code: '23503', constraint: EVENT_EPISODE_LINK_INDEX } }));
        const res = await putEvent(f.show, f.second, { description: 'x' });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_SCENE_SET_ID');
      });

      test('the terms lock keeps its own 409: an event that started an episode is not moved', async () => {
        const f = await seed();
        on();
        const res = await putEvent(f.show, f.first, { used_in_episode_id: f.empty });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('EVENT_TERMS_LOCKED');
      });

      test('an episode that does not exist keeps its own 400', async () => {
        const f = await seed();
        on();
        expect((await putEvent(f.show, f.second, { used_in_episode_id: uuid() })).status).toBe(400);
      });
    });
  });

  describe('inject', () => {
    const inject = (show, eventId, episode) => auth(request(app).post(`/api/v1/world/${show}/events/${eventId}/inject`)).send({ episode_id: episode });
    test('a second event is never injected (it would replace the script\'s event tag): refused, nothing written, switch off or on', async () => {
      const f = await seed();
      await run(`UPDATE episodes SET script_content = '[EVENT: name="Studio Session"]' WHERE id = :id`, { id: f.episode });
      const offRes = await inject(f.show, f.second, f.episode);
      expect(offRes.status).toBe(409);
      expect(offRes.body.code).toBe('SECONDARY_EVENTS_NOT_ENABLED');
      on();
      const onRes = await inject(f.show, f.second, f.episode);
      expect(onRes.status).toBe(409);
      expect(onRes.body.code).toBe('SECONDARY_EVENT_INJECT_UNSUPPORTED');
      expect(await linkOf(f.second)).toBeNull();
      expect((await rows('SELECT script_content FROM episodes WHERE id = :id', { id: f.episode }))[0].script_content).toBe('[EVENT: name="Studio Session"]');
    });
  });

  // ── Start Episode ───────────────────────────────────────────────────────
  describe('Start Episode', () => {
    test('one event: starts as before with the switch off, by either route', async () => {
      const show = await addShow();
      const a = await addEvent(show, 'Solo A');
      const b = await addEvent(show, 'Solo B');
      const one = await startOne(show, a);
      expect(one.status).toBe(201);
      expect(await linkOf(a)).toBe(one.body.data.episode.id);
      const many = await startMany(show, [b]);
      expect(many.status).toBe(201);
      expect(many.body).toMatchObject({ anchor_event_id: b, linked_extras: [], skipped_extras: [], partial: false });
      expect(many.body.post_commit.season_slot.status).toBeDefined();
      expect(many.body.post_commit.deliverable_stamp).toEqual({ status: 'not_needed' });
      expect(await linkOf(b)).toBe(many.body.data.episode.id);
    });

    test('a step after the commit that fails is reported, and the episode stands: partial, with what did not finish', async () => {
      const show = await addShow();
      const a = await addEvent(show, 'Slotless');
      jest.spyOn(require('../../src/services/seasonSlotService'), 'assignOnStart').mockRejectedValue(new Error('slot table busy'));
      const res = await startMany(show, [a]);
      expect(res.status).toBe(201);
      expect(res.body.partial).toBe(true);
      expect(res.body.post_commit.season_slot.status).toBe('failed');
      expect(res.body.unfinished_steps).toEqual([{ step: 'season_slot', reason: expect.stringContaining('slot table busy') }]);
      expect(res.body.message).toMatch(/Not finished: the episode is in no season slot yet/);
      expect(await linkOf(a)).toBe(res.body.data.episode.id);
    });

    test('the same event chosen twice is refused 400 before anything is asked or created', async () => {
      const show = await addShow();
      on();
      const a = await addEvent(show, 'Anchor');
      const b = await addEvent(show, 'Extra');
      const res = await startMany(show, [a, b, b]);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DUPLICATE_EVENT_IDS');
      expect(await episodesOf(show)).toEqual([]);
    });

    test('switch off: several events are refused 409 SECONDARY_EVENTS_NOT_ENABLED before anything is created', async () => {
      const show = await addShow();
      const a = await addEvent(show, 'Anchor');
      const b = await addEvent(show, 'Extra');
      const res = await startMany(show, [a, b]);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('SECONDARY_EVENTS_NOT_ENABLED');
      expect(await episodesOf(show)).toEqual([]);
      expect([await linkOf(a), await linkOf(b)]).toEqual([null, null]);
    });

    test('switch on: an extra with a commitment refuses the whole Start; it is never skipped', async () => {
      const show = await addShow();
      on();
      const a = await addEvent(show, 'Anchor');
      const b = await addEvent(show, 'Paid Extra', { set: { payment_amount: 300 } });
      const res = await startMany(show, [a, b]);
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'SECONDARY_EVENT_HAS_OBLIGATIONS', event_id: b });
      expect(await episodesOf(show)).toEqual([]);
      expect(await linkOf(a)).toBeNull();
    });

    test('switch on: an extra that already has an episode refuses the whole Start (409 EVENT_ALREADY_HAS_EPISODE)', async () => {
      const f = await seed();
      on();
      const anchor = await addEvent(f.show, 'New Anchor');
      const res = await startMany(f.show, [anchor, f.first]);
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'EVENT_ALREADY_HAS_EPISODE', event_id: f.first, episode: { id: f.episode } });
      expect(await linkOf(anchor)).toBeNull();
      expect((await episodesOf(f.show)).length).toBe(2);
    });

    test('switch on, index in place: the second link is refused by the database; the Start rolls back whole and answers 409 EPISODE_EVENT_LINK_TAKEN', async () => {
      const show = await addShow();
      on();
      const a = await addEvent(show, 'Anchor');
      const b = await addEvent(show, 'Extra');
      const res = await startMany(show, [a, b]);
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ success: false, code: 'EPISODE_EVENT_LINK_TAKEN' });
      expect(res.body.error).toMatch(/No episode was created/);
      // Atomic: no episode, no brief, no link, no status change on either event.
      expect(await rows('SELECT id FROM episodes WHERE show_id = :show', { show })).toEqual([]);
      expect(await rows('SELECT id FROM episode_briefs WHERE show_id = :show', { show })).toEqual([]);
      expect(await eventRow(a)).toMatchObject({ used_in_episode_id: null, status: 'ready' });
      expect(await eventRow(b)).toMatchObject({ used_in_episode_id: null, status: 'ready' });
    });
  });

  // ── Without the index: the rules hold by themselves ─────────────────────
  describe('with the index out of the way (this test database only)', () => {
    beforeAll(async () => { await run('DROP INDEX IF EXISTS world_events_used_in_episode_unique'); });
    afterAll(async () => {
      await cleanup();
      await run(INDEX_SQL);
      expect(await indexThere()).toBe(true);
    });

    test('switch off: still refused, by the rule and not by the index', async () => {
      const f = await seed();
      expect((await putEvent(f.show, f.second, { used_in_episode_id: f.episode })).body.code).toBe('SECONDARY_EVENTS_NOT_ENABLED');
      const a = await addEvent(f.show, 'Anchor');
      expect((await startMany(f.show, [a, f.second])).body.code).toBe('SECONDARY_EVENTS_NOT_ENABLED');
      expect(await linkOf(f.second)).toBeNull();
    });

    test('switch on: a second event with no commitment is linked by the event edit; the primary is unchanged', async () => {
      const f = await seed();
      on();
      const res = await putEvent(f.show, f.second, { used_in_episode_id: f.episode });
      expect(res.status).toBe(200);
      expect(await linkOf(f.second)).toBe(f.episode);
      expect(await linkOf(f.first)).toBe(f.episode);
      expect(await secondary.primaryEventId(sequelize, f.episode)).toBe(f.first);
      expect((await secondary.secondaryEventsOf(sequelize, f.episode)).secondary.map((e) => e.id)).toEqual([f.second]);
      // Sent again: it is already linked, so nothing is asked and nothing changes.
      expect((await putEvent(f.show, f.second, { used_in_episode_id: f.episode })).status).toBe(200);
    });

    test('switch on: the gate still refuses commitments, a missing primary and a filmed episode', async () => {
      const f = await seed();
      on();
      const paid = await addEvent(f.show, 'Paid', { set: { appearance_fee: 100 } });
      expect((await putEvent(f.show, paid, { used_in_episode_id: f.episode })).body.code).toBe('SECONDARY_EVENT_HAS_OBLIGATIONS');
      await film(f.show, f.episode);
      expect((await putEvent(f.show, f.second, { used_in_episode_id: f.episode })).body.code).toBe('EPISODE_SNAPSHOT_FROZEN');
      const g = await seed({ brief: false });
      expect((await putEvent(g.show, g.second, { used_in_episode_id: g.episode })).body.code).toBe('PRIMARY_EVENT_REQUIRED');
    });

    test('switch on: a commitment sent in the same save as the link is refused with it; neither is saved', async () => {
      const f = await seed();
      on();
      const res = await putEvent(f.show, f.second, { used_in_episode_id: f.episode, is_paid: true, payment_amount: 750 });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('SECONDARY_EVENT_HAS_OBLIGATIONS');
      expect((await rows('SELECT used_in_episode_id, is_paid, payment_amount FROM world_events WHERE id = :id', { id: f.second }))[0])
        .toEqual({ used_in_episode_id: null, is_paid: false, payment_amount: 0 });
    });

    test('multi-event Start: the episode, its brief, the primary link and every second link commit together', async () => {
      const show = await addShow();
      on();
      const a = await addEvent(show, 'Anchor');
      const b = await addEvent(show, 'Second');
      const c = await addEvent(show, 'Third');
      const res = await startMany(show, [a, b, c]);
      expect(res.status).toBe(201);
      const episode = res.body.data.episode.id;
      expect(res.body).toMatchObject({
        anchor_event_id: a, skipped_extras: [], partial: false,
        linked_extras: [{ id: b, name: 'Second' }, { id: c, name: 'Third' }],
      });
      expect(res.body.message).toMatch(/created from 3 events$/);
      expect([await linkOf(a), await linkOf(b), await linkOf(c)]).toEqual([episode, episode, episode]);
      expect(await secondary.primaryEventId(sequelize, episode)).toBe(a);
      expect((await eventRow(b)).status).toBe('used');
      expect(await episodesOf(show)).toHaveLength(1);
      // No payout, price or ledger record was made for a second event.
      expect(await rows('SELECT id FROM deal_price_snapshots WHERE event_id IN (:ids)', { ids: [b, c] })).toEqual([]);
      expect(await rows('SELECT id FROM financial_transactions WHERE event_id IN (:ids)', { ids: [b, c] })).toEqual([]);
    });

    test('multi-event Start: a failure on the last link rolls back the episode, the brief and the earlier links', async () => {
      const show = await addShow();
      on();
      const a = await addEvent(show, 'Anchor');
      const b = await addEvent(show, 'Second');
      const c = await addEvent(show, 'Third');
      const real = secondary.attachSecondaryInStart;
      jest.spyOn(secondary, 'attachSecondaryInStart').mockImplementation(async (sq, args) => {
        if (args.event.id === c) throw new Error('the third link failed');
        return real(sq, args);
      });
      const res = await startMany(show, [a, b, c]);
      expect(res.status).toBe(500);
      expect(await rows('SELECT id FROM episodes WHERE show_id = :show', { show })).toEqual([]);
      expect(await rows('SELECT id FROM episode_briefs WHERE show_id = :show', { show })).toEqual([]);
      for (const id of [a, b, c]) expect(await eventRow(id)).toMatchObject({ used_in_episode_id: null, status: 'ready' });
    });

    test('multi-event Start: a commitment that appears after the up-front check is caught under the lock; nothing is created', async () => {
      const show = await addShow();
      on();
      const a = await addEvent(show, 'Anchor');
      const b = await addEvent(show, 'Second');
      const real = secondary.assertSecondaryCandidates;
      jest.spyOn(secondary, 'assertSecondaryCandidates').mockImplementation(async (...args) => {
        await real(...args);
        await run('UPDATE world_events SET is_paid = true WHERE id = :b', { b });
      });
      const res = await startMany(show, [a, b]);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('SECONDARY_EVENT_HAS_OBLIGATIONS');
      expect(await rows('SELECT id FROM episodes WHERE show_id = :show', { show })).toEqual([]);
      expect(await linkOf(a)).toBeNull();
    });

    test('retry protection: the same key and events answer 200 with the first episode; nothing is created twice', async () => {
      const show = await addShow();
      on();
      const a = await addEvent(show, 'Anchor');
      const b = await addEvent(show, 'Second');
      const first = await startMany(show, [a, b], { key: 'retry-key-1' });
      expect(first.status).toBe(201);
      const again = await startMany(show, [a, b], { key: 'retry-key-1' });
      expect(again.status).toBe(200);
      expect(again.body).toMatchObject({ replayed: true, anchor_event_id: a, linked_extras: [{ id: b, name: 'Second' }] });
      expect(again.body.data.episode.id).toBe(first.body.data.episode.id);
      expect(await episodesOf(show)).toHaveLength(1);
      // The same key with other events is another request: the anchor has its episode, so it is refused.
      const c = await addEvent(show, 'Third');
      const other = await startMany(show, [a, c], { key: 'retry-key-1' });
      expect(other.status).toBe(409);
      expect(await linkOf(c)).toBeNull();
    });

    test('two Starts at once that share a second event: one wins, the other creates nothing; the event belongs to one episode', async () => {
      const show = await addShow();
      on();
      const a1 = await addEvent(show, 'Anchor One');
      const a2 = await addEvent(show, 'Anchor Two');
      const shared = await addEvent(show, 'Shared');
      const [r1, r2] = await Promise.all([startMany(show, [a1, shared]), startMany(show, [a2, shared])]);
      expect([r1.status, r2.status].sort()).toEqual([201, 409]);
      const won = r1.status === 201 ? r1 : r2;
      const lost = r1.status === 201 ? r2 : r1;
      expect(lost.body.code).toBe('EVENT_ALREADY_HAS_EPISODE');
      expect(await episodesOf(show)).toHaveLength(1);
      expect(await linkOf(shared)).toBe(won.body.data.episode.id);
      const loserAnchor = r1.status === 201 ? a2 : a1;
      expect(await eventRow(loserAnchor)).toMatchObject({ used_in_episode_id: null, status: 'ready' });
    });

    test('the same multi-event Start sent twice at once: one episode', async () => {
      const show = await addShow();
      on();
      const a = await addEvent(show, 'Anchor');
      const b = await addEvent(show, 'Second');
      const [r1, r2] = await Promise.all([startMany(show, [a, b]), startMany(show, [a, b])]);
      expect([r1.status, r2.status].sort()).toEqual([201, 409]);
      expect(await episodesOf(show)).toHaveLength(1);
    });

    test('two events linked to one episode at once by the event edit: both are checked under the episode lock and both link', async () => {
      const f = await seed();
      on();
      const third = await addEvent(f.show, 'Third');
      const [r1, r2] = await Promise.all([
        putEvent(f.show, f.second, { used_in_episode_id: f.episode }), putEvent(f.show, third, { used_in_episode_id: f.episode })]);
      expect([r1.status, r2.status]).toEqual([200, 200]);
      expect((await secondary.secondaryEventsOf(sequelize, f.episode)).secondary.map((e) => e.id).sort()).toEqual([f.second, third].sort());
    });

    test('regenerate: an episode with a second event is not regenerated (it would be left behind)', async () => {
      const show = await addShow();
      on();
      const a = await addEvent(show, 'Anchor');
      const b = await addEvent(show, 'Second');
      const started = await startMany(show, [a, b]);
      expect(started.status).toBe(201);
      const res = await auth(request(app).post(`/api/v1/world/${show}/events/${a}/regenerate-episode`)).send({});
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'EPISODE_HAS_SECONDARY_EVENTS', events: [{ id: b, name: 'Second' }] });
      expect(await episodesOf(show)).toHaveLength(1);
      expect(await linkOf(b)).toBe(started.body.data.episode.id);
    });

    // ── Backstops: the switch does not hide what is already there ─────────
    describe('an episode whose second event carries a commitment', () => {
      /** The second event is linked, then gains a commitment directly (as older data, or a later write, could leave it). */
      async function committed() {
        const f = await seed();
        await run(`UPDATE world_events SET used_in_episode_id = :episode, status = 'used', is_paid = true, payment_amount = 400 WHERE id = :id`, { episode: f.episode, id: f.second });
        return f;
      }
      const complete = (f) => auth(request(app).post(`/api/v1/world/${f.show}/episodes/${f.episode}/complete`)).send({});
      const finalize = (f) => auth(request(app).post(`/api/v1/world/${f.show}/episodes/${f.episode}/finalize-financials`)).send({});
      const startUpload = (f) => auth(request(app).post(`/api/v1/episode-clips/${f.episode}/uploads`))
        .send({ performer: 'lala', filename: 'take.mp4', content_type: 'video/mp4', size: 1024 });

      test.each([['off', off], ['on', on]])('switch %s: completion is refused 409 UNSUPPORTED_SECONDARY_OBLIGATIONS and books nothing', async (_n, set) => {
        const f = await committed();
        set();
        const res = await complete(f);
        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ success: false, code: 'UNSUPPORTED_SECONDARY_OBLIGATIONS', episode_id: f.episode });
        expect(res.body.events.map((e) => e.id)).toEqual([f.second]);
        expect(await rows('SELECT id FROM financial_transactions WHERE episode_id = :episode', f)).toEqual([]);
        expect((await rows('SELECT status FROM episodes WHERE id = :episode', f))[0].status).toBe('draft');
      });

      test('finalize is refused the same way, under the episode lock', async () => {
        const f = await committed();
        const res = await finalize(f);
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('UNSUPPORTED_SECONDARY_OBLIGATIONS');
        expect(await rows('SELECT id FROM financial_transactions WHERE episode_id = :episode', f)).toEqual([]);
      });

      test.each([['off', off], ['on', on]])('switch %s: the first take is refused at the upload\'s start, before any file is sent', async (_n, set) => {
        const f = await committed();
        set();
        const res = await startUpload(f);
        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ success: false, code: 'UNSUPPORTED_SECONDARY_OBLIGATIONS' });
        expect(await rows('SELECT id FROM episode_raw_clips WHERE episode_id = :episode', f)).toEqual([]);
      });

      test('the first take is refused again where the take is attached (under the episode lock), and by the one-request upload', async () => {
        const f = await committed();
        const clips = require('../../src/services/rawClipsService');
        await expect(sequelize.transaction((transaction) => clips.assertFirstTakeAllowed(sequelize, f.episode, { transaction })))
          .rejects.toMatchObject({ status: 409, code: 'UNSUPPORTED_SECONDARY_OBLIGATIONS' });
        const res = await auth(request(app).post(`/api/v1/episode-clips/${f.episode}`)).field('performer', 'lala');
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('UNSUPPORTED_SECONDARY_OBLIGATIONS');
        expect(await rows('SELECT id FROM episode_raw_clips WHERE episode_id = :episode', f)).toEqual([]);
      });

      test('a two-parter: Part 2 with such a second event is not completed (asked before the two-part hand-off)', async () => {
        const show = await addShow();
        const part1 = await addEpisode(show, 1);
        const event = await addEvent(show, 'The Finale', { episodeId: part1 });
        await addBrief(show, part1, event);
        const part2 = await addEpisode(show, 2);
        await addBrief(show, part2, event);
        const extra = await addEvent(show, 'Paid Extra', { episodeId: part2, set: { is_paid: true, payment_amount: 400 } });
        const res = await auth(request(app).post(`/api/v1/world/${show}/episodes/${part2}/complete`)).send({});
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('UNSUPPORTED_SECONDARY_OBLIGATIONS');
        expect(res.body.events.map((e) => e.id)).toEqual([extra]);
        expect(await rows('SELECT id FROM financial_transactions WHERE show_id = :show', { show })).toEqual([]);
        expect(await rows(`SELECT id FROM episodes WHERE show_id = :show AND evaluation_status = 'accepted'`, { show })).toEqual([]);
      });

      test('a linked second event cannot gain a commitment by an edit the terms lock does not cover (the entry cost)', async () => {
        const f = await seed();
        await run(`UPDATE world_events SET used_in_episode_id = :episode, status = 'used' WHERE id = :id`, { episode: f.episode, id: f.second });
        const res = await putEvent(f.show, f.second, { cost_coins: 200, description: 'Sent with it' });
        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ code: 'SECONDARY_EVENT_HAS_OBLIGATIONS', obligations: [{ kind: 'cost', detail: 'entry cost set' }] });
        expect((await rows('SELECT cost_coins, description FROM world_events WHERE id = :id', { id: f.second }))[0]).toEqual({ cost_coins: 0, description: null });
        // An edit that adds no commitment still saves; the primary's entry cost is its own and still editable.
        expect((await putEvent(f.show, f.second, { description: 'Just words' })).status).toBe(200);
        expect((await putEvent(f.show, f.first, { cost_coins: 150 })).status).toBe(200);
      });

      test('an episode already filmed keeps taking takes: only the first is asked', async () => {
        const f = await committed();
        await film(f.show, f.episode);
        const clips = require('../../src/services/rawClipsService');
        await expect(clips.assertFirstTakeAllowed(sequelize, f.episode)).resolves.toBeUndefined();
      });

      test('a second event with no commitment blocks nothing; an episode with one event is never asked', async () => {
        const f = await seed();
        await run(`UPDATE world_events SET used_in_episode_id = :episode, status = 'used' WHERE id = :id`, { episode: f.episode, id: f.second });
        expect(await secondary.unsupportedSecondaryObligations(sequelize, f.episode)).toEqual([]);
        const g = await seed();
        expect(await secondary.unsupportedSecondaryObligations(sequelize, g.episode)).toEqual([]);
        expect((await startUpload(g)).body.code).not.toBe('UNSUPPORTED_SECONDARY_OBLIGATIONS');
      });

      test('the primary event\'s own commitments are not this refusal: they are what the episode already handles', async () => {
        const f = await seed();
        await run('UPDATE world_events SET is_paid = true, payment_amount = 900 WHERE id = :id', { id: f.first });
        expect(await secondary.unsupportedSecondaryObligations(sequelize, f.episode)).toEqual([]);
      });
    });

    // ── The brief and the links disagree: told apart from an intended second event ──
    describe('an episode whose brief and links disagree', () => {
      /** The brief names `first`, which is not linked to the episode; `second` holds a link to it (a leftover of an older reassign). */
      async function disagreeing({ paid = false } = {}) {
        const f = await seed();
        await run('UPDATE world_events SET used_in_episode_id = NULL WHERE id = :id', { id: f.first });
        await run(`UPDATE world_events SET used_in_episode_id = :episode, status = 'used'${paid ? ', is_paid = true, payment_amount = 400' : ''} WHERE id = :id`, { episode: f.episode, id: f.second });
        return f;
      }

      test('episodeLinkState tells each case apart', async () => {
        const ok = await seed();
        expect(await secondary.episodeLinkState(sequelize, ok.episode)).toMatchObject({ state: 'ok', consistent: true, primaryId: ok.first, secondary: [], strays: [] });
        expect(await secondary.episodeLinkState(sequelize, ok.empty)).toMatchObject({ state: 'none', consistent: true, primaryId: null });
        const unbriefed = await seed({ brief: false });
        expect(await secondary.episodeLinkState(sequelize, unbriefed.episode)).toMatchObject({ state: 'unbriefed', consistent: true, primaryId: unbriefed.first });

        const intended = await seed();
        await run(`UPDATE world_events SET used_in_episode_id = :episode, status = 'used' WHERE id = :id`, { episode: intended.episode, id: intended.second });
        const a = await secondary.episodeLinkState(sequelize, intended.episode);
        expect(a).toMatchObject({ state: 'ok', consistent: true, strays: [] });
        expect(a.secondary.map((e) => e.id)).toEqual([intended.second]);

        const d = await disagreeing();
        const b = await secondary.episodeLinkState(sequelize, d.episode);
        expect(b).toMatchObject({ state: 'primary_link_missing', consistent: false, primaryId: d.first, secondary: [] });
        expect(b.strays.map((e) => e.id)).toEqual([d.second]);

        // A brief naming a deleted event names none (the one rule of utils/episodeEventSql):
        // the linked event is the episode's event, and nothing is refused for it.
        const gone = await disagreeing({ paid: true });
        await run('UPDATE world_events SET deleted_at = NOW() WHERE id = :id', { id: gone.first });
        expect(await secondary.episodeLinkState(sequelize, gone.episode)).toMatchObject({ state: 'unbriefed', consistent: true, primaryId: gone.second, secondary: [], strays: [] });
        expect(await secondary.unsupportedSecondaryObligations(sequelize, gone.episode)).toEqual([]);

        const many = await seed({ brief: false });
        await run(`UPDATE world_events SET used_in_episode_id = :episode, status = 'used' WHERE id = :id`, { episode: many.episode, id: many.second });
        expect(await secondary.episodeLinkState(sequelize, many.episode)).toMatchObject({ state: 'unbriefed_many', consistent: false });
      });

      test('a two-parter is consistent: Part 2\'s primary is linked to Part 1, whose brief names it too', async () => {
        const show = await addShow();
        const part1 = await addEpisode(show, 1);
        const event = await addEvent(show, 'The Finale', { episodeId: part1 });
        await addBrief(show, part1, event);
        const part2 = await addEpisode(show, 2);
        await addBrief(show, part2, event);
        expect(await secondary.episodeLinkState(sequelize, part2)).toMatchObject({ state: 'two_part', consistent: true, primaryId: event });
        expect(await secondary.episodeLinkState(sequelize, part1)).toMatchObject({ state: 'ok', consistent: true });
      });

      test('no other event is attached to it until it is repaired (409 EPISODE_EVENT_LINK_INCONSISTENT)', async () => {
        const f = await disagreeing();
        on();
        const third = await addEvent(f.show, 'Third');
        const res = await putEvent(f.show, third, { used_in_episode_id: f.episode });
        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ code: 'EPISODE_EVENT_LINK_INCONSISTENT', link_state: 'primary_link_missing', primary_event_id: f.first });
        expect(await linkOf(third)).toBeNull();
      });

      test('with no commitment on the other event, completion and filming are not refused for this', async () => {
        const f = await disagreeing();
        expect(await secondary.unsupportedSecondaryObligations(sequelize, f.episode)).toEqual([]);
        await expect(secondary.assertNoUnsupportedSecondaryObligations(sequelize, f.episode)).resolves.toBeUndefined();
      });

      test('with a commitment on the other event, completion is refused as an inconsistency, not as a second event', async () => {
        const f = await disagreeing({ paid: true });
        const res = await auth(request(app).post(`/api/v1/world/${f.show}/episodes/${f.episode}/complete`)).send({});
        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ code: 'EPISODE_EVENT_LINK_INCONSISTENT', link_state: 'primary_link_missing', primary_event_id: f.first });
        expect(res.body.events.map((e) => e.id)).toEqual([f.second]);
        expect(res.body.error).toMatch(/Restore the link of the event its brief names, or remove the other event/);
        expect(await rows('SELECT id FROM financial_transactions WHERE episode_id = :episode', f)).toEqual([]);
      });

      test('regenerate from an event that is not the episode\'s primary is refused: the primary is not left behind', async () => {
        const f = await disagreeing();
        const res = await auth(request(app).post(`/api/v1/world/${f.show}/events/${f.second}/regenerate-episode`)).send({});
        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ code: 'EPISODE_HAS_SECONDARY_EVENTS', primary_event_id: f.first });
        expect((await rows('SELECT deleted_at FROM episodes WHERE id = :episode', f))[0].deleted_at).toBeNull();
        expect(await linkOf(f.second)).toBe(f.episode);
      });
    });

    // ── Reopen ─────────────────────────────────────────────────────────────
    describe('reopening terms', () => {
      const reopen = (show, eventId) => asAdmin(request(app).post(`/api/v1/world/${show}/events/${eventId}/terms/reopen`)).send({ confirm: true });

      test('a second event\'s terms are not reopened, so reopening cannot add a commitment past the gate', async () => {
        const f = await seed();
        await run(`UPDATE world_events SET used_in_episode_id = :episode, status = 'used' WHERE id = :id`, { episode: f.episode, id: f.second });
        const check = await reopenEligibility(sequelize, f.second);
        expect(check.eligible).toBe(false);
        expect(check.reasons.map((r) => r.code)).toEqual([REOPEN_REASONS.SECONDARY_EVENT]);
        const res = await reopen(f.show, f.second);
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('TERMS_REOPEN_NOT_ELIGIBLE');
        expect((await rows('SELECT canon_consequences FROM world_events WHERE id = :id', { id: f.second }))[0].canon_consequences).toEqual({});
        // Its locked terms cannot be edited either: the lock is still on.
        const edit = await putEvent(f.show, f.second, { is_paid: true, payment_amount: 500 });
        expect(edit.status).toBe(409);
        expect(edit.body.code).toBe('EVENT_TERMS_LOCKED');
      });

      test('the primary event of a draft episode reopens as before', async () => {
        const f = await seed();
        const check = await reopenEligibility(sequelize, f.first);
        expect(check).toMatchObject({ eligible: true, reasons: [] });
        expect((await reopen(f.show, f.first)).status).toBe(200);
      });

      /** A two-parter: Part 1 holds the event's own link; both briefs name it. */
      async function twoParter(part1Status = 'draft') {
        const show = await addShow();
        const part1 = await addEpisode(show, 1, part1Status);
        const event = await addEvent(show, 'The Finale', { episodeId: part1 });
        await addBrief(show, part1, event);
        await run(`UPDATE episode_briefs SET created_at = NOW() - INTERVAL '1 hour' WHERE episode_id = :part1`, { part1 });
        const part2 = await addEpisode(show, 2, 'draft');
        await addBrief(show, part2, event);
        return { show, part1, part2, event };
      }

      test('a two-parter: both parts drafts, nothing booked: eligible, and neither part is taken for a second event', async () => {
        const t = await twoParter();
        const check = await reopenEligibility(sequelize, t.event);
        expect(check).toMatchObject({ eligible: true, reasons: [], episode: { id: t.part2 } });
      });

      test('a two-parter: Part 1 past draft refuses the reopen, though Part 2 (the lock episode) is a draft', async () => {
        const t = await twoParter('completed');
        const check = await reopenEligibility(sequelize, t.event);
        expect(check.eligible).toBe(false);
        expect(check.reasons).toEqual([{ code: REOPEN_REASONS.OTHER_EPISODE_NOT_DRAFT, message: '"Episode 1" shares these terms and is completed, not a draft.' }]);
        const res = await reopen(t.show, t.event);
        expect(res.status).toBe(409);
        expect(res.body.reasons.map((r) => r.code)).toEqual([REOPEN_REASONS.OTHER_EPISODE_NOT_DRAFT]);
      });

      test('a two-parter: a ledger row on Part 1 counts, though Part 2 has none', async () => {
        const t = await twoParter();
        await run(`INSERT INTO financial_transactions (id, show_id, episode_id, type, category, amount, description, status, created_at, updated_at)
                   VALUES (:id, :show, :part1, 'income', 'event_payment', 100, 'Part 1 payment', 'executed', NOW(), NOW())`, { id: uuid(), show: t.show, part1: t.part1 });
        const check = await reopenEligibility(sequelize, t.event);
        expect(check.eligible).toBe(false);
        expect(check.reasons.map((r) => r.code)).toEqual([REOPEN_REASONS.LEDGER_ROWS]);
      });
    });

    // ── Detach ─────────────────────────────────────────────────────────────
    describe('removing a second event', () => {
      async function attached() {
        const f = await seed();
        await run(`UPDATE world_events SET used_in_episode_id = :episode, status = 'used' WHERE id = :id`, { episode: f.episode, id: f.second });
        return f;
      }
      const audit = (eventId) => rows(`SELECT user_id, action, resource_type, resource_id, changes, created_at FROM activity_logs WHERE resource_id = :eventId AND action = 'detach_secondary_event' ORDER BY id`, { eventId });

      test('removed: the link is cleared, nothing is deleted, and the activity log has who, what, which episode, why, when and the outcome', async () => {
        const f = await attached();
        const res = await detach(f.show, f.second, { reason: 'Moved to next week' });
        expect(res.status).toBe(200);
        // Its status is left as it was (as the event edit leaves it when a link is cleared): not reset.
        expect(res.body).toEqual({ success: true, detached: true, already: false, event_id: f.second, episode_id: f.episode, status: 'used' });
        expect(await eventRow(f.second)).toMatchObject({ used_in_episode_id: null, status: 'used', name: 'Charity Gala' });
        expect(await linkOf(f.first)).toBe(f.episode);
        const log = await audit(f.second);
        expect(log).toHaveLength(1);
        expect(log[0]).toMatchObject({
          user_id: 'test-user-secondary', action: 'detach_secondary_event', resource_type: 'world_event', resource_id: f.second,
          changes: { meta: { reason: 'Moved to next week', episode_id: f.episode, outcome: 'detached', status_kept: 'used' } },
        });
        expect(log[0].created_at).toBeTruthy();
      });

      test('works with the switch off: removing is not a new attachment', async () => {
        const f = await attached();
        off();
        expect((await detach(f.show, f.second)).body.detached).toBe(true);
      });

      test('a repeat is a no-op, answered 200 and logged as nothing to do', async () => {
        const f = await attached();
        expect((await detach(f.show, f.second)).body.detached).toBe(true);
        const again = await detach(f.show, f.second);
        expect(again.status).toBe(200);
        expect(again.body).toMatchObject({ success: true, detached: false, already: true, episode_id: null });
        expect((await audit(f.second)).map((l) => l.changes.meta.outcome)).toEqual(['detached', 'nothing_to_do']);
      });

      test('two removals at once: one removes, the other finds nothing to do', async () => {
        const f = await attached();
        const [r1, r2] = await Promise.all([detach(f.show, f.second), detach(f.show, f.second)]);
        expect([r1.status, r2.status]).toEqual([200, 200]);
        expect([r1.body.detached, r2.body.detached].sort()).toEqual([false, true]);
        expect(await linkOf(f.second)).toBeNull();
      });

      test('a reason is required (400), and an unknown event is 404', async () => {
        const f = await attached();
        const res = await detach(f.show, f.second, { reason: '  ' });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('DETACH_REASON_REQUIRED');
        expect(await linkOf(f.second)).toBe(f.episode);
        const unknown = uuid();
        expect((await detach(f.show, unknown)).status).toBe(404);
        // Refusals of this kind are entries too: nothing about a detach goes unrecorded.
        expect((await audit(f.second)).map((l) => l.changes.meta)).toEqual([{ outcome: 'refused', code: 'DETACH_REASON_REQUIRED' }]);
        expect((await audit(unknown)).map((l) => l.changes.meta)).toEqual([{ reason: 'Picked by mistake', episode_id: null, outcome: 'failed', code: 'EVENT_NOT_FOUND' }]);
      });

      const refused = async (f, code) => {
        const res = await detach(f.show, f.second);
        expect(res.status).toBe(409);
        expect(res.body.code).toBe(code);
        expect(await linkOf(f.second)).toBe(f.episode);
        const log = await audit(f.second);
        expect(log[log.length - 1].changes.meta).toMatchObject({ outcome: 'refused', code, episode_id: f.episode });
        return res;
      };

      test('the primary event is never removed', async () => {
        const f = await attached();
        const res = await detach(f.show, f.first);
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('PRIMARY_EVENT_NOT_DETACHABLE');
        expect(await linkOf(f.first)).toBe(f.episode);
      });

      test('a filmed episode keeps its events', async () => {
        const f = await attached();
        await film(f.show, f.episode);
        await refused(f, 'EPISODE_SNAPSHOT_FROZEN');
      });

      test('reopened terms refuse', async () => {
        const f = await attached();
        await run(`UPDATE world_events SET canon_consequences = '{"terms_reopen":{"at":"2026-11-12T00:00:00Z"}}'::jsonb WHERE id = :id`, { id: f.second });
        await refused(f, 'EVENT_TERMS_REOPENED');
      });

      test('any commitment refuses, listing it', async () => {
        const f = await attached();
        await run('UPDATE world_events SET is_paid = true WHERE id = :id', { id: f.second });
        const res = await refused(f, 'SECONDARY_EVENT_IN_USE');
        expect(res.body.obligations).toEqual([{ kind: 'payment', detail: 'marked as paid work' }]);
      });

      test('the impact review: a script tag, a location and a spending line each refuse, and are listed in depends_on', async () => {
        const script = await attached();
        await run(`UPDATE episodes SET script_content = 'INT. HALL [EVENT: name="Charity Gala" prestige=3]' WHERE id = :id`, { id: script.episode });
        expect((await refused(script, 'SECONDARY_EVENT_IN_USE')).body.depends_on).toEqual([{ kind: 'script', detail: 'the script has this event\'s tag' }]);

        const money = await attached();
        await run(`INSERT INTO episode_spending_lines (id, episode_id, event_id, label, quantity, unit_price, created_at, updated_at) VALUES (:id, :episode, :event, 'Car', 1, 10, NOW(), NOW())`,
          { id: uuid(), episode: money.episode, event: money.second });
        expect((await refused(money, 'SECONDARY_EVENT_IN_USE')).body.depends_on).toEqual([{ kind: 'money', detail: '1 spending line of this episode' }]);
      });

      test('an uncertain case is refused: a reference that cannot be read counts as one', async () => {
        const f = await attached();
        const real = sequelize.query.bind(sequelize);
        jest.spyOn(sequelize, 'query').mockImplementation((sql, ...rest) => (
          typeof sql === 'string' && /FROM feed_posts WHERE event_id/.test(sql) ? Promise.reject(new Error('relation unavailable')) : real(sql, ...rest)));
        const res = await detach(f.show, f.second);
        expect(res.status).toBe(409);
        expect(res.body.depends_on).toEqual([{ kind: 'production', detail: 'could not be checked' }]);
        expect(await linkOf(f.second)).toBe(f.episode);
      });

      test('the entry goes through the one audit call (logger), inside the detach\'s transaction', async () => {
        const f = await attached();
        const { logger } = require('../../src/middleware/auditLog');
        const inTx = jest.spyOn(logger, 'logActionInTransaction');
        expect((await detach(f.show, f.second)).body.detached).toBe(true);
        expect(inTx).toHaveBeenCalledTimes(1);
        expect(inTx.mock.calls[0][0]).toBeTruthy(); // the transaction
        expect(inTx.mock.calls[0].slice(1, 5)).toEqual(['test-user-secondary', 'detach_secondary_event', 'world_event', f.second]);
        await expect(logger.logActionInTransaction(null, 'u', 'a', 'world_event', f.second)).rejects.toThrow(/needs the caller's transaction/);
      });

      test('a detach that cannot be audited does not happen', async () => {
        const f = await attached();
        jest.spyOn(models.ActivityLog, 'logActivity').mockRejectedValue(new Error('audit unavailable'));
        const res = await detach(f.show, f.second);
        expect(res.status).toBe(500);
        expect(await linkOf(f.second)).toBe(f.episode);
      });

      test('an event that was removed can be the first event of another episode', async () => {
        const f = await attached();
        expect((await detach(f.show, f.second)).body.detached).toBe(true);
        expect((await putEvent(f.show, f.second, { used_in_episode_id: f.empty })).status).toBe(200);
        expect(await linkOf(f.second)).toBe(f.empty);
      });
    });
  });

  // ── The repair path, with the index in place (as production is today) ───
  describe('repairing an episode whose brief and links disagree (index in place)', () => {
    const inject = (show, eventId, episode) => auth(request(app).post(`/api/v1/world/${show}/events/${eventId}/inject`)).send({ episode_id: episode });

    test('the other event is removed, then the brief\'s own event is linked again; inject never attaches the other event', async () => {
      expect(await indexThere()).toBe(true);
      const f = await seed();
      await run('UPDATE world_events SET used_in_episode_id = NULL WHERE id = :id', { id: f.first });
      await run(`UPDATE world_events SET used_in_episode_id = :episode, status = 'used' WHERE id = :id`, { episode: f.episode, id: f.second });
      const third = await addEvent(f.show, 'Third');

      // Inject does not attach another event, switch off or on.
      expect((await inject(f.show, third, f.episode)).body.code).toBe('SECONDARY_EVENTS_NOT_ENABLED');
      on();
      expect((await inject(f.show, third, f.episode)).body.code).toBe('SECONDARY_EVENT_INJECT_UNSUPPORTED');
      off();
      expect(await linkOf(third)).toBeNull();

      // The primary cannot take its link back while the other event holds it: said plainly (409), not a 500.
      const blocked = await inject(f.show, f.first, f.episode);
      expect(blocked.status).toBe(409);
      expect(blocked.body).toMatchObject({ code: 'EPISODE_EVENT_LINK_TAKEN', linked_event: { id: f.second, name: 'Charity Gala' } });
      expect(await linkOf(f.first)).toBeNull();

      // Step 1: remove the other event (safe: no commitment, nothing depends on it, not filmed).
      const removed = await detach(f.show, f.second, { reason: 'Left by an old reassign' });
      expect(removed.status).toBe(200);
      expect(removed.body.detached).toBe(true);
      // Step 2: the brief's own event is linked again.
      const restored = await inject(f.show, f.first, f.episode);
      expect(restored.status).toBe(200);
      expect(await linkOf(f.first)).toBe(f.episode);
      expect(await secondary.episodeLinkState(sequelize, f.episode)).toMatchObject({ state: 'ok', consistent: true, primaryId: f.first, secondary: [], strays: [] });
    });

    test('the other event is not removed when it carries a commitment: the repair is refused, and says why', async () => {
      const f = await seed();
      await run('UPDATE world_events SET used_in_episode_id = NULL WHERE id = :id', { id: f.first });
      await run(`UPDATE world_events SET used_in_episode_id = :episode, status = 'used', is_paid = true WHERE id = :id`, { episode: f.episode, id: f.second });
      const res = await detach(f.show, f.second, { reason: 'Left by an old reassign' });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('SECONDARY_EVENT_IN_USE');
      expect(await linkOf(f.second)).toBe(f.episode);
    });
  });

  test('the index is back as it was', async () => {
    expect(await indexThere()).toBe(true);
  });

  test('the model is never asked for a title in these tests beyond Start Episode\'s own best-effort call', () => {
    // Start Episode asks for a title and falls back to the event's name when the call fails; nothing else here calls a model.
    expect(mockAsk.create.mock.calls.length).toBeLessThanOrEqual(40);
  });
});
