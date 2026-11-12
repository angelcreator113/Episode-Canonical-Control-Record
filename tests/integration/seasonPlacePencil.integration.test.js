/**
 * Place pencil protection (Evoni's rulings, 2026-11-10;
 * docs/EVENT_EPISODE_FLOW.md §8): Place never replaces or clears a pencilled
 * event without a confirmation that names it.
 *
 * On the test database, through the real services and the real route:
 *   - the target slot's pencil (a different event, or the episode's own) needs
 *     confirm_pencils naming it: without, 409 SEASON_PLACE_NEEDS_CONFIRMATION
 *     with what would change; nothing written;
 *   - the episode's event pencilled in another slot is cleared only when that
 *     slot is named too; one confirmation carries both;
 *   - a confirmation that is not exactly the pencils as they are under the
 *     locks (changed, cleared, extra, missing) is 409 SEASON_SLOT_CHANGED;
 *     nothing written, no partial change;
 *   - a yes/no flag is not a confirmation (400);
 *   - a reference to a deleted event is neither a pencil nor overwritten
 *     (409 SEASON_SLOT_EVENT_ORPHANED);
 *   - filmed episodes, started slots, already-placed episodes and edited
 *     intentions are protected exactly as before, confirmation or not;
 *   - the season setup's Save goes through the same rule.
 */
jest.unmock('uuid');

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
const setup = require('../../src/services/seasonSetupService');
const lockTrace = require('../helpers/lockTrace');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

async function outcome(fn) {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    return { ok: false, error, code: error?.code || null, status: error?.status || null, details: error?.details || null };
  }
}

(shouldSkip ? describe.skip : describe)('Place asks before it replaces or clears a pencilled event', () => {
  jest.setTimeout(60000);
  const shows = [];
  let trace = null;
  let token;

  async function seedShow() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :n, :n, NOW(), NOW())`, { show, n: `place-${show.slice(0, 8)}` });
    const { arc_id: arcId } = await seedArc(show, models);
    return { show, arcId };
  }
  async function addEvent(show, name) {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, canon_consequences, created_at, updated_at)
               VALUES (:id, :show, :name, 'invite', 'draft', '{}'::jsonb, NOW(), NOW())`, { id, show, name });
    return id;
  }
  /** An episode in no slot; eventId makes that event its own (through its brief). */
  async function addEpisode(show, { eventId = null, title = 'Placed episode' } = {}) {
    const id = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:id, :show, :title, 1, 'draft', NOW(), NOW())`, { id, show, title });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, created_at, updated_at)
               VALUES (:bid, :id, :show, :eventId, 'draft', NOW(), NOW())`, { bid: uuid(), id, show, eventId });
    return id;
  }
  const slotId = async (arcId, n) => (await rows('SELECT id FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0].id;
  const slotRow = async (id) => (await rows('SELECT event_id, episode_id, locked_at FROM season_slots WHERE id = :id', { id }))[0];
  const placedIn = async (episodeId) => (await rows('SELECT id FROM season_slots WHERE episode_id = :episodeId AND deleted_at IS NULL', { episodeId })).map((r) => r.id);
  const contextOf = async (episodeId) => (await rows('SELECT season_context FROM episodes WHERE id = :episodeId', { episodeId }))[0].season_context;
  const place = (show, slot, episode, confirmPencils) => outcome(() => slots.placeEpisode(sequelize, show, slot, episode, { confirmPencils }));
  const untouched = { episode_id: null, locked_at: null };

  beforeAll(async () => {
    await slotsMigration.up(sequelize.getQueryInterface(), Sequelize);
    if (!(await rows("SELECT to_regclass('public.season_specials') AS t"))[0].t) {
      await specialsMigration.up(sequelize.getQueryInterface(), Sequelize);
    }
    token = TokenService.generateTokenPair({
      id: 'test-user-place-pencil', email: 'user@place-pencil.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    if (trace) trace.uninstall();
    trace = null;
    jest.restoreAllMocks();
  });
  afterAll(async () => {
    for (const show of shows) {
      await run('DELETE FROM episode_raw_clips WHERE show_id = :show', { show }).catch(() => {});
      await run('DELETE FROM episode_briefs WHERE show_id = :show', { show }).catch(() => {});
      for (const t of ['season_specials', 'season_slots', 'show_arcs']) await run(`DELETE FROM ${t} WHERE show_id = :show`, { show }).catch(() => {});
      await run('DELETE FROM episodes WHERE show_id = :show', { show }).catch(() => {});
      await run('DELETE FROM world_events WHERE show_id = :show', { show }).catch(() => {});
      await run('DELETE FROM shows WHERE id = :show', { show }).catch(() => {});
    }
    await sequelize.close();
  });

  // ── The target slot's pencil ────────────────────────────────────────────
  describe('the target slot holds a pencilled event', () => {
    test('without a confirmation: 409 that names the pencil and the episode; nothing is written', async () => {
      const { show, arcId } = await seedShow();
      const y = await addEvent(show, 'Pencilled Y');
      const ep = await addEpisode(show, { title: 'Left over' });
      const t = await slotId(arcId, 4);
      await slots.pencilEvent(sequelize, show, t, y);

      const res = await place(show, t, ep);

      expect(res).toMatchObject({ ok: false, status: 409, code: 'SEASON_PLACE_NEEDS_CONFIRMATION' });
      expect(res.details).toMatchObject({
        slot_id: t, slot_number: 4, episode: { id: ep, title: 'Left over' }, episode_event: null,
        affected_pencils: [{ slot_id: t, slot_number: 4, event: { id: y, name: 'Pencilled Y' }, change: 'replaced' }],
      });
      expect(await slotRow(t)).toMatchObject({ event_id: y, ...untouched });
      expect(await placedIn(ep)).toEqual([]);
      expect(await contextOf(ep)).toBeNull();
    });

    test('confirmed by name: an episode with no event takes the slot and the pencil is removed', async () => {
      const { show, arcId } = await seedShow();
      const y = await addEvent(show, 'Pencilled Y');
      const ep = await addEpisode(show);
      const t = await slotId(arcId, 4);
      await slots.pencilEvent(sequelize, show, t, y);

      const res = await place(show, t, ep, [{ slot_id: t, event_id: y }]);

      expect(res).toMatchObject({ ok: true, value: { slot_number: 4, episode_id: ep, event_id: null, replaced_event_id: y, cleared_from: [] } });
      const row = await slotRow(t);
      expect(row).toMatchObject({ episode_id: ep, event_id: null });
      expect(row.locked_at).not.toBeNull();
    });

    test('confirmed by name: an episode with its own event replaces the pencil with it', async () => {
      const { show, arcId } = await seedShow();
      const y = await addEvent(show, 'Pencilled Y');
      const own = await addEvent(show, 'Own event');
      const ep = await addEpisode(show, { eventId: own });
      const t = await slotId(arcId, 6);
      await slots.pencilEvent(sequelize, show, t, y);

      const asked = await place(show, t, ep);
      expect(asked.details).toMatchObject({ episode_event: { id: own, name: 'Own event' }, affected_pencils: [{ slot_id: t, event: { id: y }, change: 'replaced' }] });
      const res = await place(show, t, ep, [{ slot_id: t, event_id: y }]);

      expect(res.ok).toBe(true);
      expect(await slotRow(t)).toMatchObject({ episode_id: ep, event_id: own });
    });

    test("the episode's own event pencilled in the slot still needs the confirmation", async () => {
      const { show, arcId } = await seedShow();
      const own = await addEvent(show, 'Own event');
      const ep = await addEpisode(show, { eventId: own });
      const t = await slotId(arcId, 7);
      await slots.pencilEvent(sequelize, show, t, own);

      const asked = await place(show, t, ep);
      expect(asked).toMatchObject({ ok: false, status: 409, code: 'SEASON_PLACE_NEEDS_CONFIRMATION' });
      expect(asked.details.affected_pencils).toEqual([{ slot_id: t, slot_number: 7, event: { id: own, name: 'Own event' }, change: 'replaced' }]);
      expect(await slotRow(t)).toMatchObject({ event_id: own, ...untouched });

      const res = await place(show, t, ep, [{ slot_id: t, event_id: own }]);
      expect(res).toMatchObject({ ok: true, value: { event_id: own, replaced_event_id: null } });
      expect(await slotRow(t)).toMatchObject({ episode_id: ep, event_id: own });
    });

    test('a slot with no pencil needs no confirmation, as before', async () => {
      const { show, arcId } = await seedShow();
      const ep = await addEpisode(show);
      const t = await slotId(arcId, 2);
      const res = await place(show, t, ep);
      expect(res).toMatchObject({ ok: true, value: { slot_number: 2, replaced_event_id: null, cleared_from: [] } });
      expect((await slotRow(t)).episode_id).toBe(ep);
    });
  });

  // ── The episode's event pencilled in another slot ───────────────────────
  describe("the episode's own event is pencilled in another slot", () => {
    test('without a confirmation: 409 naming that slot; with it: cleared there, and the episode takes its event along', async () => {
      const { show, arcId } = await seedShow();
      const own = await addEvent(show, 'Own event');
      const ep = await addEpisode(show, { eventId: own });
      const t = await slotId(arcId, 3);
      const k = await slotId(arcId, 11);
      await slots.pencilEvent(sequelize, show, k, own);

      const asked = await place(show, t, ep);
      expect(asked).toMatchObject({ ok: false, status: 409, code: 'SEASON_PLACE_NEEDS_CONFIRMATION' });
      expect(asked.details.affected_pencils).toEqual([{ slot_id: k, slot_number: 11, event: { id: own, name: 'Own event' }, change: 'cleared' }]);
      expect(await slotRow(k)).toMatchObject({ event_id: own, ...untouched });
      expect(await slotRow(t)).toMatchObject({ event_id: null, ...untouched });

      const res = await place(show, t, ep, [{ slot_id: k, event_id: own }]);
      expect(res).toMatchObject({ ok: true, value: { event_id: own, cleared_from: [11] } });
      expect(await slotRow(k)).toMatchObject({ event_id: null, ...untouched });
      expect(await slotRow(t)).toMatchObject({ episode_id: ep, event_id: own });
    });

    test('both pencils change: one confirmation must name both; naming only one writes nothing', async () => {
      const { show, arcId } = await seedShow();
      const y = await addEvent(show, 'Pencilled Y');
      const own = await addEvent(show, 'Own event');
      const ep = await addEpisode(show, { eventId: own });
      const t = await slotId(arcId, 5);
      const k = await slotId(arcId, 14);
      await slots.pencilEvent(sequelize, show, t, y);
      await slots.pencilEvent(sequelize, show, k, own);

      const asked = await place(show, t, ep);
      expect(asked.details.affected_pencils.map((p) => [p.slot_number, p.event.id, p.change]))
        .toEqual([[5, y, 'replaced'], [14, own, 'cleared']]);

      for (const partial of [[{ slot_id: t, event_id: y }], [{ slot_id: k, event_id: own }]]) {
        expect(await place(show, t, ep, partial)).toMatchObject({ ok: false, status: 409, code: 'SEASON_SLOT_CHANGED' });
        expect(await slotRow(t)).toMatchObject({ event_id: y, ...untouched });
        expect(await slotRow(k)).toMatchObject({ event_id: own, ...untouched });
      }

      const res = await place(show, t, ep, [{ slot_id: k, event_id: own }, { slot_id: t, event_id: y }]);
      expect(res).toMatchObject({ ok: true, value: { event_id: own, replaced_event_id: y, cleared_from: [14] } });
      expect(await slotRow(t)).toMatchObject({ episode_id: ep, event_id: own });
      expect(await slotRow(k)).toMatchObject({ event_id: null, ...untouched });
    });

    test('a started slot that shares the event keeps it: refused, nothing changed, confirmation or not', async () => {
      const { show, arcId } = await seedShow();
      const own = await addEvent(show, 'Shared event');
      const started = await addEpisode(show, { title: 'Started' });
      const ep = await addEpisode(show, { eventId: own, title: 'Old take' });
      const k = await slotId(arcId, 9);
      const t = await slotId(arcId, 10);
      await run('UPDATE season_slots SET episode_id = :started, event_id = :own, locked_at = NOW() WHERE id = :k', { started, own, k });

      for (const confirm of [undefined, [{ slot_id: k, event_id: own }]]) {
        expect(await place(show, t, ep, confirm)).toMatchObject({ ok: false, status: 409, code: 'SEASON_SLOT_LOCKED' });
        expect(await slotRow(k)).toMatchObject({ episode_id: started, event_id: own });
        expect(await slotRow(t)).toMatchObject({ event_id: null, ...untouched });
      }
    });
  });

  // ── A confirmation that is no longer true ───────────────────────────────
  describe('stale confirmations', () => {
    test('the pencil was replaced since: 409 SEASON_SLOT_CHANGED, the newer pencil kept', async () => {
      const { show, arcId } = await seedShow();
      const y = await addEvent(show, 'Seen Y');
      const z = await addEvent(show, 'Newer Z');
      const ep = await addEpisode(show);
      const t = await slotId(arcId, 4);
      await slots.pencilEvent(sequelize, show, t, y);
      await slots.pencilEvent(sequelize, show, t, z);

      const res = await place(show, t, ep, [{ slot_id: t, event_id: y }]);

      expect(res).toMatchObject({ ok: false, status: 409, code: 'SEASON_SLOT_CHANGED' });
      expect(res.details.affected_pencils).toEqual([{ slot_id: t, slot_number: 4, event: { id: z, name: 'Newer Z' }, change: 'replaced' }]);
      expect(await slotRow(t)).toMatchObject({ event_id: z, ...untouched });
      expect(await placedIn(ep)).toEqual([]);
    });

    test('the pencil was cleared since: still refused, the slot stays empty', async () => {
      const { show, arcId } = await seedShow();
      const y = await addEvent(show, 'Seen Y');
      const ep = await addEpisode(show);
      const t = await slotId(arcId, 4);
      await slots.pencilEvent(sequelize, show, t, y);
      await slots.pencilEvent(sequelize, show, t, null);

      const res = await place(show, t, ep, [{ slot_id: t, event_id: y }]);

      expect(res).toMatchObject({ ok: false, status: 409, code: 'SEASON_SLOT_CHANGED' });
      expect(await slotRow(t)).toMatchObject({ event_id: null, ...untouched });
    });

    test("the other slot's pencil moved since: refused, neither slot changed", async () => {
      const { show, arcId } = await seedShow();
      const own = await addEvent(show, 'Own event');
      const ep = await addEpisode(show, { eventId: own });
      const t = await slotId(arcId, 3);
      const k = await slotId(arcId, 11);
      const m = await slotId(arcId, 12);
      await slots.pencilEvent(sequelize, show, k, own);
      await slots.pencilEvent(sequelize, show, m, own); // moved from E11 to E12 after the dialog

      const res = await place(show, t, ep, [{ slot_id: k, event_id: own }]);

      expect(res).toMatchObject({ ok: false, status: 409, code: 'SEASON_SLOT_CHANGED' });
      expect(await slotRow(m)).toMatchObject({ event_id: own, ...untouched });
      expect(await slotRow(t)).toMatchObject({ event_id: null, ...untouched });
      expect(await placedIn(ep)).toEqual([]);
    });

    test('a pencil committed while the Place waits for the slot: the confirmation is checked under the lock', async () => {
      const { show, arcId } = await seedShow();
      const y = await addEvent(show, 'Seen Y');
      const z = await addEvent(show, 'Raced Z');
      const ep = await addEpisode(show);
      const t = await slotId(arcId, 8);
      await slots.pencilEvent(sequelize, show, t, y);
      trace = lockTrace.install(sequelize);
      // The Place is held at its episode lock; the pencil commits; the Place goes on.
      const g = trace.gate((r) => r.kind === 'lock' && r.table === 'episodes');
      const placing = place(show, t, ep, [{ slot_id: t, event_id: y }]);
      await Promise.race([g.reached, placing]);
      const pencil = await outcome(() => slots.pencilEvent(sequelize, show, t, z));
      g.open();
      const res = await placing;

      expect(pencil.ok).toBe(true);
      expect(res).toMatchObject({ ok: false, status: 409, code: 'SEASON_SLOT_CHANGED' });
      expect(await slotRow(t)).toMatchObject({ event_id: z, ...untouched });
    });
  });

  // ── What is not a confirmation ──────────────────────────────────────────
  describe('the confirmation must name the pencils', () => {
    test('a flag, a bare id or a malformed list is refused (400); nothing is written', async () => {
      const { show, arcId } = await seedShow();
      const y = await addEvent(show, 'Pencilled Y');
      const ep = await addEpisode(show);
      const t = await slotId(arcId, 4);
      await slots.pencilEvent(sequelize, show, t, y);

      for (const bad of [true, 'yes', y, {}, [true], [{ slot_id: t }], [{ slot_id: t, event_id: 'not-an-id' }],
        [{ slot_id: t, event_id: y }, { slot_id: t, event_id: y }]]) {
        expect(await place(show, t, ep, bad)).toMatchObject({ ok: false, status: 400, code: 'SEASON_PLACE_INVALID' });
      }
      expect(await slotRow(t)).toMatchObject({ event_id: y, ...untouched });
    });

    test('naming a pencil for a slot that has none is refused: the slot is not as confirmed', async () => {
      const { show, arcId } = await seedShow();
      const y = await addEvent(show, 'Never pencilled');
      const ep = await addEpisode(show);
      const t = await slotId(arcId, 4);
      expect(await place(show, t, ep, [{ slot_id: t, event_id: y }])).toMatchObject({ ok: false, status: 409, code: 'SEASON_SLOT_CHANGED' });
      expect(await slotRow(t)).toMatchObject({ event_id: null, ...untouched });
    });

    test('a slot that points to a deleted event: an integrity refusal, not a pencil and not overwritten', async () => {
      const { show, arcId } = await seedShow();
      const gone = await addEvent(show, 'Deleted later');
      const ep = await addEpisode(show);
      const t = await slotId(arcId, 4);
      await slots.pencilEvent(sequelize, show, t, gone);
      await run('UPDATE world_events SET deleted_at = NOW() WHERE id = :gone', { gone });

      for (const confirm of [undefined, [{ slot_id: t, event_id: gone }]]) {
        const res = await place(show, t, ep, confirm);
        expect(res).toMatchObject({ ok: false, status: 409, code: 'SEASON_SLOT_EVENT_ORPHANED', details: { slot_id: t, slot_number: 4 } });
        expect(await slotRow(t)).toMatchObject({ event_id: gone, ...untouched });
      }
    });
  });

  // ── Existing protections, unchanged ─────────────────────────────────────
  describe('existing protections hold, with or without a confirmation', () => {
    test('a started slot stays locked to its episode', async () => {
      const { show, arcId } = await seedShow();
      const y = await addEvent(show, 'Its event');
      const first = await addEpisode(show);
      const second = await addEpisode(show);
      const t = await slotId(arcId, 1);
      await slots.pencilEvent(sequelize, show, t, y);
      expect((await place(show, t, first, [{ slot_id: t, event_id: y }])).ok).toBe(true);

      for (const confirm of [undefined, [{ slot_id: t, event_id: y }]]) {
        expect(await place(show, t, second, confirm)).toMatchObject({ ok: false, status: 409, code: 'SEASON_SLOT_LOCKED' });
      }
      expect((await slotRow(t)).episode_id).toBe(first);
    });

    test('an episode already in a slot is not placed again', async () => {
      const { show, arcId } = await seedShow();
      const y = await addEvent(show, 'Pencilled Y');
      const ep = await addEpisode(show);
      await place(show, await slotId(arcId, 1), ep);
      const t = await slotId(arcId, 2);
      await slots.pencilEvent(sequelize, show, t, y);

      expect(await place(show, t, ep, [{ slot_id: t, event_id: y }])).toMatchObject({ ok: false, status: 409, code: 'SEASON_EPISODE_PLACED' });
      expect(await slotRow(t)).toMatchObject({ event_id: y, ...untouched });
    });

    test('a filmed episode is refused before any pencil is considered', async () => {
      const { show, arcId } = await seedShow();
      const y = await addEvent(show, 'Pencilled Y');
      const ep = await addEpisode(show);
      await run(`INSERT INTO episode_raw_clips (id, episode_id, show_id, performer, s3_key_raw, key_status, key_strength, created_at, updated_at)
                 VALUES (:id, :ep, :show, 'lala', :key, 'none', 'medium', NOW(), NOW())`, { id: uuid(), ep, show, key: `episodes/${ep}/raw-clips/x/original.mp4` });
      const t = await slotId(arcId, 4);
      await slots.pencilEvent(sequelize, show, t, y);

      for (const confirm of [undefined, [{ slot_id: t, event_id: y }]]) {
        const res = await place(show, t, ep, confirm);
        expect(res.ok).toBe(false);
        expect(res.status).toBe(409);
        expect(['SEASON_PLACE_NEEDS_CONFIRMATION', 'SEASON_SLOT_CHANGED']).not.toContain(res.code);
      }
      expect(await slotRow(t)).toMatchObject({ event_id: y, ...untouched });
      expect(await placedIn(ep)).toEqual([]);
    });

    test("a confirmed Place leaves the slot's edited intention as it was", async () => {
      const { show, arcId } = await seedShow();
      const y = await addEvent(show, 'Pencilled Y');
      const ep = await addEpisode(show);
      const t = await slotId(arcId, 4);
      await slots.pencilEvent(sequelize, show, t, y);
      await run("UPDATE season_slots SET story_purpose = 'Her own words', intention_source = 'edited' WHERE id = :t", { t });

      expect((await place(show, t, ep, [{ slot_id: t, event_id: y }])).ok).toBe(true);

      const [row] = await rows('SELECT story_purpose, intention_source FROM season_slots WHERE id = :t', { t });
      expect(row).toEqual({ story_purpose: 'Her own words', intention_source: 'edited' });
    });
  });

  // ── The route ───────────────────────────────────────────────────────────
  describe('PUT /world/:showId/season/slots/:slotId/episode', () => {
    const put = (show, slot, body) => request(app).put(`/api/v1/world/${show}/season/slots/${slot}/episode`)
      .set('Authorization', `Bearer ${token}`).send(body);

    test('409 with the pencils to confirm; a boolean is refused; confirm_pencils by name places it', async () => {
      const { show, arcId } = await seedShow();
      const y = await addEvent(show, 'Pencilled Y');
      const ep = await addEpisode(show, { title: 'Route episode' });
      const t = await slotId(arcId, 4);
      await slots.pencilEvent(sequelize, show, t, y);

      const asked = await put(show, t, { episode_id: ep });
      expect(asked.status).toBe(409);
      expect(asked.body).toMatchObject({
        code: 'SEASON_PLACE_NEEDS_CONFIRMATION', slot_number: 4, episode: { id: ep, title: 'Route episode' },
        affected_pencils: [{ slot_id: t, slot_number: 4, event: { id: y, name: 'Pencilled Y' }, change: 'replaced' }],
      });
      expect(asked.body.error).toContain('Pencilled Y');

      const flag = await put(show, t, { episode_id: ep, confirm_pencils: true, confirm: true, force: true });
      expect(flag.status).toBe(400);
      expect(flag.body.code).toBe('SEASON_PLACE_INVALID');
      expect(await slotRow(t)).toMatchObject({ event_id: y, ...untouched });

      const stale = await put(show, t, { episode_id: ep, confirm_pencils: [{ slot_id: t, event_id: uuid() }] });
      expect(stale.status).toBe(409);
      expect(stale.body.code).toBe('SEASON_SLOT_CHANGED');
      expect(await slotRow(t)).toMatchObject({ event_id: y, ...untouched });

      const done = await put(show, t, { episode_id: ep, confirm_pencils: asked.body.affected_pencils.map((p) => ({ slot_id: p.slot_id, event_id: p.event.id })) });
      expect(done.status).toBe(200);
      expect(done.body).toMatchObject({ success: true, slot_number: 4, replaced_event_id: y });
      expect((await slotRow(t)).episode_id).toBe(ep);
    });
  });

  // ── The season setup's Save goes through the same rule ──────────────────
  describe('the season setup Save (applyPlacement)', () => {
    test("an episode into a slot that holds its own event: refused unless the slot's event was reviewed", async () => {
      const { show, arcId } = await seedShow();
      const own = await addEvent(show, 'Own event');
      const ep = await addEpisode(show, { eventId: own });
      const t = await slotId(arcId, 7);
      await slots.pencilEvent(sequelize, show, t, own);

      const refused = await outcome(() => setup.applyPlacement(sequelize, show, [{ slot_id: t, episode_id: ep }]));
      expect(refused).toMatchObject({ ok: false, status: 409, code: 'SEASON_PLACE_NEEDS_CONFIRMATION' });
      expect(refused.error.message).toContain('place it from the Roadmap');
      expect(await slotRow(t)).toMatchObject({ event_id: own, ...untouched });

      const saved = await outcome(() => setup.applyPlacement(sequelize, show, [{ slot_id: t, episode_id: ep, expected_event_id: own }]));
      expect(saved).toMatchObject({ ok: true, value: { placed: 1, episodes: 1 } });
      expect(await slotRow(t)).toMatchObject({ episode_id: ep, event_id: own });
    });

    test("an episode whose event is pencilled elsewhere: the whole Save is refused unless that slot is named", async () => {
      const { show, arcId } = await seedShow();
      const own = await addEvent(show, 'Own event');
      const ep = await addEpisode(show, { eventId: own });
      const other = await addEpisode(show);
      const t = await slotId(arcId, 2);
      const t2 = await slotId(arcId, 3);
      const k = await slotId(arcId, 16);
      await slots.pencilEvent(sequelize, show, k, own);

      const refused = await outcome(() => setup.applyPlacement(sequelize, show, [{ slot_id: t2, episode_id: other }, { slot_id: t, episode_id: ep }]));
      expect(refused).toMatchObject({ ok: false, status: 409, code: 'SEASON_PLACE_NEEDS_CONFIRMATION' });
      expect(await slotRow(k)).toMatchObject({ event_id: own, ...untouched });
      expect(await slotRow(t2)).toMatchObject({ event_id: null, ...untouched }); // the earlier item is rolled back
      expect(await placedIn(other)).toEqual([]);

      const saved = await outcome(() => setup.applyPlacement(sequelize, show,
        [{ slot_id: t, episode_id: ep, confirm_pencils: [{ slot_id: k, event_id: own }] }]));
      expect(saved).toMatchObject({ ok: true, value: { placed: 1, episodes: 1 } });
      expect(await slotRow(k)).toMatchObject({ event_id: null, ...untouched });
      expect(await slotRow(t)).toMatchObject({ episode_id: ep, event_id: own });
    });
  });
});
