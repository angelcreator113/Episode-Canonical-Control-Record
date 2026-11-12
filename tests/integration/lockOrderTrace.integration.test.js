/**
 * A1.3-0 (C6): the runtime lock trace. On the test database, each real
 * transaction path is run once with tests/helpers/lockTrace installed on the
 * shared sequelize instance, so every statement it runs (helpers included:
 * lockEpisodes, takeEvent, snapshotEpisode, pencilEventIn, model writes) is
 * recorded per transaction. Each traced transaction must take its locks in
 * the canonical order
 *
 *   E (existing episodes, id order) -> W (world events) -> P (specials and
 *   two-parters) -> S (slots, several in id order) -> A (arcs) -> X -> L
 *
 * with rows the transaction inserted itself (E*) left out, a row already
 * held free to take again, and every multi-row lock ORDER BY id. The known,
 * documented deviations are listed in KNOWN with the reason each forms no
 * cycle; the test fails on anything else.
 *
 * What the trace cannot see (trigger and foreign-key locks, the row order
 * inside one statement, other processes) is listed in
 * docs/reads/2026-11-06-episode-lock-order.md; the gated races in
 * lockOrderMatrix.integration.test.js cover those.
 */
jest.unmock('uuid');

const mockCreate = jest.fn(async () => { throw new Error('no model call is expected in the lock trace'); });
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockCreate } })));

const { Sequelize } = require('sequelize');
const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const slotsMigration = require('../../src/migrations/20261001230000-create-season-slots');
const specialsMigration = require('../../src/migrations/20261026150000-create-season-specials');
const { seedArc } = require('../../src/services/arcProgressionService');
const slots = require('../../src/services/seasonSlotService');
const intentions = require('../../src/services/seasonIntentionService');
const setup = require('../../src/services/seasonSetupService');
const specials = require('../../src/services/seasonSpecials');
const full = require('../../src/services/seasonFullSpecials');
const clips = require('../../src/services/rawClipsService');
const { generateEpisodeFromEvent } = require('../../src/services/episodeGeneratorService');
const lockTrace = require('../helpers/lockTrace');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Known deviations from the canonical order, each without a cycle:
 *   - A -> S: season setup (updateSetup) locks the arc, then its slots
 *     (design F3). No transaction takes a slot, then an arc, so no cycle;
 *     the note documents it.
 *   - S -> P: takeEvent (make, create and update special) clears the event's
 *     pencil from its slot, then from other specials; pencilEventIn writes
 *     its slots, then clears the event from specials. Every one of them
 *     locks the event (W) first (pencilEventIn since C4c), so on one event
 *     they take turns there; createTwoParter takes S -> P with no W, and
 *     the special it clears cannot exist (an event is in a slot or a
 *     special, never both).
 */
const KNOWN = [
  { from: 'A', to: 'S', why: 'season setup: arc, then slots (F3); no transaction takes S then A' },
  { from: 'S', to: 'P', why: 'takeEvent and pencilEventIn clear specials after slots, all under the event lock (W) taken first' },
];

(shouldSkip ? describe.skip : describe)('A1.3-0: every traced transaction takes its locks in the canonical order', () => {
  const shows = [];
  let trace = null;

  async function seedShow() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST('{"starting_balance": 1000}' AS jsonb), NOW(), NOW())`,
      { show, name: `Trace ${show.slice(0, 8)}`, slug: `trace-${show.slice(0, 8)}` });
    const { arc_id: arcId } = await seedArc(show, models);
    return { show, arcId };
  }
  async function addEpisode(show, n = 1) {
    const id = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:id, :show, :title, :n, 'draft', NOW(), NOW())`, { id, show, title: `Trace episode ${n}`, n });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, status, created_at, updated_at)
               VALUES (:bid, :id, :show, 'draft', NOW(), NOW())`, { bid: uuid(), id, show });
    return id;
  }
  async function addEvent(show, name, { usedIn = null, status = 'draft' } = {}) {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, strictness, cost_coins, used_in_episode_id, canon_consequences, created_at, updated_at)
               VALUES (:id, :show, :name, 'invite', :status, 5, 5, 0, :usedIn, '{}'::jsonb, NOW(), NOW())`, { id, show, name, usedIn, status });
    return id;
  }
  const slotId = async (arcId, n) => (await rows('SELECT id FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0].id;
  const eventRow = async (id) => (await rows('SELECT * FROM world_events WHERE id = :id', { id }))[0];

  /** Runs fn with the trace installed; returns the traced transactions (each with its records). */
  async function traced(fn) {
    trace = lockTrace.install(sequelize);
    try {
      await fn();
    } finally {
      trace.uninstall();
    }
    const txs = [...trace.byTransaction().values()];
    trace = null;
    return txs;
  }
  function expectCanonical(txs, label) {
    expect(txs.length).toBeGreaterThan(0);
    for (const recs of txs) {
      const violations = lockTrace.checkOrder(recs, { allow: KNOWN });
      if (violations.length) {
        throw new Error(`${label}: ${JSON.stringify(violations, null, 1)}\nsequence: ${lockTrace.classSequence(recs).join(' -> ')}`);
      }
    }
    return txs.map((recs) => lockTrace.classSequence(recs));
  }

  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-user-lock-trace', email: 'trace@lock.dev', name: 'Trace', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await slotsMigration.up(sequelize.getQueryInterface(), Sequelize);
    if (!(await rows("SELECT to_regclass('public.season_specials') AS t"))[0].t) {
      await specialsMigration.up(sequelize.getQueryInterface(), Sequelize);
    }
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    if (trace) trace.uninstall();
    jest.restoreAllMocks();
  });
  afterAll(async () => {
    await wait(500); // Start's after-commit work
    expect(mockCreate).not.toHaveBeenCalled();
    for (const show of shows) {
      const eps = '(SELECT id FROM episodes WHERE show_id = :show)';
      for (const t of ['episode_raw_clips', 'episode_briefs', 'scene_plans', 'episode_todo_lists', 'episode_spending_lines', 'episode_wardrobe', 'feed_posts']) {
        await run(`DELETE FROM ${t} WHERE episode_id IN ${eps}`, { show }).catch(() => {});
      }
      for (const t of ['season_specials', 'season_slots', 'financial_transactions', 'character_state_history', 'character_state', 'show_arcs']) {
        await run(`DELETE FROM ${t} WHERE show_id = :show`, { show }).catch(() => {});
      }
      await run('UPDATE world_events SET used_in_episode_id = NULL WHERE show_id = :show', { show }).catch(() => {});
      await run('DELETE FROM episodes WHERE show_id = :show', { show }).catch(() => {});
      await run('DELETE FROM world_events WHERE show_id = :show', { show }).catch(() => {});
      await run('DELETE FROM shows WHERE id = :show', { show }).catch(() => {});
    }
    await sequelize.close();
  });

  test('the tracer sees transaction boundaries, explicit and implicit locks, model writes and multi-row order', async () => {
    const { show, arcId } = await seedShow();
    const a = await slotId(arcId, 2);
    const b = await slotId(arcId, 5);
    const txs = await traced(async () => {
      await sequelize.transaction(async (transaction) => {
        await sequelize.query('SELECT id FROM season_slots WHERE id IN (:ids) ORDER BY id FOR UPDATE', { replacements: { ids: [a, b] }, transaction });
        await sequelize.query('UPDATE season_slots SET updated_at = NOW() WHERE id = :a', { replacements: { a }, transaction });
        await models.Episode.create({ show_id: show, title: 'Traced', episode_number: 9, status: 'draft' }, { transaction });
      });
    });
    expect(txs).toHaveLength(1);
    const kinds = txs[0].map((r) => r.kind);
    expect(kinds[0]).toBe('begin');
    expect(kinds[kinds.length - 1]).toBe('commit');
    const lock = txs[0].find((r) => r.kind === 'lock');
    expect(lock).toMatchObject({ table: 'season_slots', cls: 'S', mode: 'update', ordered: true });
    expect(lock.ids).toEqual([a, b].sort());
    expect(txs[0].find((r) => r.kind === 'write')).toMatchObject({ table: 'season_slots', cls: 'S' });
    expect(txs[0].find((r) => r.kind === 'insert')).toMatchObject({ table: 'episodes', cls: 'E' });
    expect(txs[0].find((r) => r.kind === 'insert').ids).toHaveLength(1);

    // The checker: a decreasing class and an unordered multi-row lock are violations.
    const fake = [
      { kind: 'lock', cls: 'P', table: 'season_specials', ids: ['p1'], mode: 'update' },
      { kind: 'lock', cls: 'W', table: 'world_events', ids: ['w1'], mode: 'update' },
      { kind: 'lock', cls: 'S', table: 'season_slots', ids: ['s2', 's1'], ordered: false, mode: 'update' },
    ];
    expect(lockTrace.checkOrder(fake).map((v) => v.type)).toEqual(['order', 'unordered-multi-row']);
  });

  test('Start (first, weekly slot): the Start transaction, then the assignment', async () => {
    const { show } = await seedShow();
    const ev = await addEvent(show, 'Trace Start');
    const txs = await traced(async () => {
      await generateEpisodeFromEvent(await eventRow(ev), models, { showId: show, wardrobeItems: [] });
    });
    const seqs = expectCanonical(txs, 'Start');
    expect(seqs.some((s) => s.includes('W:world_events:update'))).toBe(true);
    expect(seqs.some((s) => s.some((x) => x.startsWith('S:season_slots')))).toBe(true);
  });

  test('Start (regenerate of a special\'s episode)', async () => {
    const { show, arcId } = await seedShow();
    const episodeId = await addEpisode(show);
    const ev = await addEvent(show, 'Trace Regen', { usedIn: episodeId, status: 'used' });
    await run(`INSERT INTO season_specials (id, show_id, arc_id, kind, event_id, episode_id, after_slot_number, locked_at, created_at, updated_at)
               VALUES (:id, :show, :arcId, 'bonus', :ev, :episodeId, 4, NOW(), NOW(), NOW())`, { id: uuid(), show, arcId, ev, episodeId });
    const txs = await traced(async () => {
      await generateEpisodeFromEvent(await eventRow(ev), models, { showId: show, wardrobeItems: [], replacingEpisodeId: episodeId });
    });
    expectCanonical(txs, 'Regenerate');
  });

  test('swapIntoSlot, makeSpecial, createSpecial, updateSpecial (event change)', async () => {
    const { show, arcId } = await seedShow();
    const evMake = await addEvent(show, 'Trace Make');
    await slots.pencilEvent(sequelize, show, await slotId(arcId, 6), evMake);
    expectCanonical(await traced(() => full.makeSpecial(sequelize, show, evMake)), 'makeSpecial');

    const evCreate = await addEvent(show, 'Trace Create');
    await slots.pencilEvent(sequelize, show, await slotId(arcId, 7), evCreate);
    expectCanonical(await traced(() => specials.createSpecial(sequelize, show, { kind: 'bonus', event_id: evCreate, after_slot_number: 2 })), 'createSpecial');

    const evA = await addEvent(show, 'Trace Update A');
    const evB = await addEvent(show, 'Trace Update B');
    await slots.pencilEvent(sequelize, show, await slotId(arcId, 8), evB);
    const sp = await specials.createSpecial(sequelize, show, { kind: 'bonus', event_id: evA, after_slot_number: 5 });
    const seqs = expectCanonical(await traced(() => specials.updateSpecial(sequelize, show, sp.id, { event_id: evB })), 'updateSpecial');
    const flat = seqs.flat();
    // C3: the new event (W) before the special (P).
    expect(flat.indexOf('W:world_events:update')).toBeLessThan(flat.indexOf('P:season_specials:update'));
    // The same event re-set (the T7 case).
    expectCanonical(await traced(() => specials.updateSpecial(sequelize, show, sp.id, { event_id: evB })), 'updateSpecial (same event)');

    const swapEv = await addEvent(show, 'Trace Swap 2');
    await specials.createSpecial(sequelize, show, { kind: 'bonus', event_id: swapEv, after_slot_number: 9 });
    const target = await slotId(arcId, 10);
    expectCanonical(await traced(() => full.swapIntoSlot(sequelize, show, swapEv, target)), 'swapIntoSlot');
  });

  test('swapIntoSlot over a pencilled event, confirmed by name: the event, the special, then the slot', async () => {
    // Specials pencil protection (2026-11-10): the target slot is locked and
    // read again before the pencil in it is handed to a special.
    const { show, arcId } = await seedShow();
    const pencilled = await addEvent(show, 'Trace Pencilled');
    const target = await slotId(arcId, 14);
    await slots.pencilEvent(sequelize, show, target, pencilled);
    const incoming = await addEvent(show, 'Trace Incoming');
    await specials.createSpecial(sequelize, show, { kind: 'bonus', event_id: incoming, after_slot_number: 9 });
    const seqs = expectCanonical(await traced(() => full.swapIntoSlot(sequelize, show, incoming, target,
      { confirmPencils: [{ slot_id: target, event_id: pencilled }] })), 'swapIntoSlot (pencil)');
    const locks = seqs.flat().filter((x) => !x.endsWith(':write'));
    const first = (cls) => locks.findIndex((x) => x.startsWith(`${cls}:`));
    expect(first('W')).toBeGreaterThanOrEqual(0);
    expect(first('P')).toBeGreaterThan(first('W'));
    expect(first('S')).toBeGreaterThan(first('P'));
    const [row] = await rows('SELECT event_id FROM season_slots WHERE id = :target', { target });
    expect(row.event_id).toBe(incoming);
    // The handoff: the pencilled event now has the special.
    const [sp] = await rows("SELECT event_id FROM season_specials WHERE arc_id = :arcId AND deleted_at IS NULL AND kind = 'bonus'", { arcId });
    expect(sp.event_id).toBe(pencilled);
    // And without the confirmation the same swap is refused before any write.
    const again = await addEvent(show, 'Trace Unconfirmed');
    await expect(full.swapIntoSlot(sequelize, show, again, target)).rejects.toMatchObject({ status: 409, code: 'SEASON_PLACE_NEEDS_CONFIRMATION' });
  });

  test('pencilEvent (moving an event between slots), placeEpisode, saveIntention, updateSetup', async () => {
    const { show, arcId } = await seedShow();
    const ev = await addEvent(show, 'Trace Pencil');
    await slots.pencilEvent(sequelize, show, await slotId(arcId, 9), ev);
    const s4 = await slotId(arcId, 4);
    const pencil = expectCanonical(await traced(() => slots.pencilEvent(sequelize, show, s4, ev)), 'pencilEvent');
    // C4: the two slots are locked together, in id order; C4c: the event first.
    expect(pencil.flat().filter((x) => x === 'S:season_slots:update').length).toBeGreaterThan(0);
    expect(pencil[0][0]).toBe('W:world_events:update');

    const episodeId = await addEpisode(show);
    const sid = await slotId(arcId, 1);
    expectCanonical(await traced(() => slots.placeEpisode(sequelize, show, sid, episodeId)), 'placeEpisode');
    expectCanonical(await traced(() => intentions.saveIntention(sequelize, show, sid, { story_purpose: 'Traced purpose' })), 'saveIntention');
    const body = { title: 'Season traced', tagline: 'Traced', phases: [1, 2, 3].map((n) => ({ title: `Part ${n}`, tagline: `T ${n}` })) };
    const seqs = expectCanonical(await traced(() => setup.updateSetup(sequelize, show, body)), 'updateSetup');
    // C4b: the setup's slot lock is one multi-row statement in id order.
    expect(seqs.flat()).toContain('S:season_slots:update');
  });

  test("placeEpisode with the episode's event pencilled in another slot: the episode, then both slots together", async () => {
    // Place pencil protection (2026-11-10): the target and the slot that
    // holds the episode's event are locked in one statement, in id order.
    const { show, arcId } = await seedShow();
    const own = await addEvent(show, 'Trace Place Holder');
    const episodeId = await addEpisode(show);
    await run('UPDATE episode_briefs SET event_id = :own WHERE episode_id = :episodeId', { own, episodeId });
    const holder = await slotId(arcId, 12);
    await slots.pencilEvent(sequelize, show, holder, own);
    const target = await slotId(arcId, 2);
    const seqs = expectCanonical(await traced(() => slots.placeEpisode(sequelize, show, target, episodeId,
      { confirmPencils: [{ slot_id: holder, event_id: own }] })), 'placeEpisode (holder)');
    const flat = seqs.flat();
    const locks = flat.filter((x) => !x.endsWith(':write'));
    // The episode lock comes first, and every slot lock after it: the new
    // statement (target and holder together), then the target's own lock.
    // Without the new statement there is one slot lock, not two.
    expect(locks[0]).toMatch(/^E:episodes:/);
    expect(locks.slice(1)).toEqual(['S:season_slots:update', 'S:season_slots:update']);
    expect(flat.some((x) => x.startsWith('W:') && !x.endsWith(':write'))).toBe(false);
    const [h] = await rows('SELECT event_id FROM season_slots WHERE id = :holder', { holder });
    const [t] = await rows('SELECT event_id, episode_id FROM season_slots WHERE id = :target', { target });
    expect(h.event_id).toBeNull();
    expect(t).toEqual({ event_id: own, episode_id: episodeId });
  });

  test('clip attach: the episode FOR SHARE, then the clip', async () => {
    const { show } = await seedShow();
    const episodeId = await addEpisode(show);
    const clip = { id: uuid(), episode_id: episodeId, show_id: show, performer: 'lala', s3_key_raw: `episodes/${episodeId}/raw-clips/x/original.mp4` };
    const seqs = expectCanonical(await traced(() => clips.createClip(sequelize, clip)), 'createClip');
    expect(seqs[0][0]).toBe('E:episodes:share');
  });
  test('routes: episode delete, event PUT (relink), Brief PUT (event link), inject', async () => {
    const { show } = await seedShow();
    const a = await addEpisode(show, 1);
    const b = await addEpisode(show, 2);
    const evLinked = await addEvent(show, 'Trace Linked', { usedIn: a, status: 'used' });
    const evFree = await addEvent(show, 'Trace Free');

    // The event PUT moving a link (A1.2c relink guard): E (linked and target) -> W.
    const put = await traced(() => auth(request(app).put(`/api/v1/world/${show}/events/${evFree}`)).send({ used_in_episode_id: b }).then((r) => expect(r.status).toBe(200)));
    expectCanonical(put, 'event PUT');

    // The Brief PUT naming an event on a brief with none: E -> W -> B.
    const c = await addEpisode(show, 3);
    const evBrief = await addEvent(show, 'Trace Brief');
    const brief = await traced(() => auth(request(app).put(`/api/v1/episode-brief/${c}`)).send({ event_id: evBrief }).then((r) => expect(r.status).toBe(200)));
    expectCanonical(brief, 'Brief PUT');

    // Inject: E (script save) -> W -> W UPDATE -> X.
    const d = await addEpisode(show, 4);
    const evInject = await addEvent(show, 'Trace Inject');
    const inj = await traced(() => auth(request(app).post(`/api/v1/world/${show}/events/${evInject}/inject`)).send({ episode_id: d }).then((r) => expect(r.status).toBe(200)));
    expectCanonical(inj, 'inject');

    // Delete (A1.2c): E -> E UPDATE -> L.
    const del = await traced(() => auth(request(app).delete(`/api/v1/episodes/${a}`)).then((r) => expect([200, 204]).toContain(r.status)));
    expectCanonical(del, 'episode delete');
    expect(evLinked).toBeTruthy();
  });
  test('applyPlacement (episodes and events) and createTwoParter', async () => {
    const { show, arcId } = await seedShow();
    const ev = await addEvent(show, 'Trace Apply');
    await specials.createSpecial(sequelize, show, { kind: 'bonus', event_id: ev, after_slot_number: 3 });
    const ep = await addEpisode(show);
    const sEp = await slotId(arcId, 6);
    const sEv = await slotId(arcId, 11);
    const apply = expectCanonical(await traced(() => setup.applyPlacement(sequelize, show, [{ slot_id: sEp, episode_id: ep }, { slot_id: sEv, event_id: ev }])), 'applyPlacement');
    // C4c: E (the episode) -> W (the events, before any slot) -> S -> P.
    const flat = apply.flat();
    expect(flat[0]).toBe('E:episodes:update');
    expect(flat).toContain('W:world_events:update');
    expect(flat.indexOf('W:world_events:update')).toBeLessThan(flat.findIndex((x) => x.startsWith('S:')));

    const ev2 = await addEvent(show, 'Trace Two-parter');
    const s14 = await slotId(arcId, 14);
    await slots.pencilEvent(sequelize, show, s14, ev2);
    const two = expectCanonical(await traced(() => specials.createTwoParter(sequelize, show, { slot_id: s14 })), 'createTwoParter');
    expect(two.flat().filter((x) => x.startsWith('W:'))).toEqual([]);
  });
});
