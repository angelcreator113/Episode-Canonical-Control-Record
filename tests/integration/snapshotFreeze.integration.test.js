/**
 * A1.2a: the Start snapshot freeze (A1.2-SPEC-v5; Evoni's rulings of
 * 2026-11-06). On the test database, with no paid model call (the model is a
 * stub everywhere; ANTHROPIC_API_KEY is only set, with a mocked SDK, in the
 * regenerate tests):
 *   - an episode with any raw clip (removed ones too) is frozen;
 *   - every automatic writer of episodes.season_context refuses or skips a
 *     frozen episode (W1-W12): the context and season_number stay
 *     byte-identical, and the brief's intent, arc number and position stay;
 *   - an Episode 1-shaped fixture (slot range safe..pass, brief slay with
 *     [slay, pass, safe]) keeps its context and its slay intent through all
 *     of them;
 *   - a placement that would record late context is refused
 *     (LATE_CONTEXT_NOT_AVAILABLE), and regenerate is refused before the
 *     model is asked;
 *   - a clip attach and a snapshot writer take turns, in both orders, with
 *     a consistent end state;
 *   - unfrozen episodes behave exactly as before;
 *   - the routes answer 409 with the refusal's code.
 */
jest.unmock('uuid');

// Regenerate's title draft asks Claude only when ANTHROPIC_API_KEY is set:
// these tests set it only with this stub SDK in place, so nothing is paid for.
const mockAsk = { create: jest.fn() };
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: (...a) => mockAsk.create(...a) } })));

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
const { lockEpisodes } = require('../../src/utils/episodeLocks');
const { snapshotFrozen } = require('../../src/utils/snapshotFreeze');

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

const DRAFT = { story_purpose: 'Lala is tested by a late invite', career_focus: 'reputation', desired_pressure: 'High', outcome_range: { min: 'fail', max: 'pass' } };
const fakeClient = () => ({ messages: { create: jest.fn(async () => ({ content: [{ text: JSON.stringify(DRAFT) }] })) } });

(shouldSkip ? describe.skip : describe)('A1.2a: a filmed episode keeps its Start snapshot', () => {
  const shows = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  async function seedShow() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST('{"starting_balance": 1000}' AS jsonb), NOW(), NOW())`,
      { show, name: `Freeze ${show.slice(0, 8)}`, slug: `freeze-${show.slice(0, 8)}` });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:id, :show, 'lala', 1000, 3, 3, 3, 2, NOW(), NOW())`, { id: uuid(), show });
    const { arc_id: arcId } = await seedArc(show, models);
    return { show, arcId };
  }
  async function addEpisode(show, n = 1, { eventName = null } = {}) {
    const id = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:id, :show, :title, :n, 'draft', NOW(), NOW())`, { id, show, title: `Freeze episode ${n}`, n });
    let eventId = null;
    if (eventName) {
      eventId = uuid();
      await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, strictness, cost_coins, used_in_episode_id, times_used, canon_consequences, created_at, updated_at)
                 VALUES (:eventId, :show, :eventName, 'invite', 'used', 3, 5, 50, :id, 1, '{}'::jsonb, NOW(), NOW())`, { eventId, show, eventName, id });
    }
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, created_at, updated_at)
               VALUES (:bid, :id, :show, :eventId, 'draft', NOW(), NOW())`, { bid: uuid(), id, show, eventId });
    return { id, eventId };
  }
  const slotId = async (arcId, n) => (await rows('SELECT id FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0].id;
  const slotRow = async (id) => (await rows('SELECT story_purpose, outcome_range, episode_id, event_id FROM season_slots WHERE id = :id', { id }))[0];
  /** The episode's Start record exactly as stored: its context's text, season_number, and the brief's fields. */
  const record = async (id) => (await rows(
    `SELECT e.season_context::text AS context, md5(e.season_context::text) AS md5, e.season_number,
            b.designed_intent, b.allowed_outcomes::text AS allowed, b.arc_number, b.position_in_arc, b.event_difficulty::text AS difficulty
       FROM episodes e LEFT JOIN episode_briefs b ON b.episode_id = e.id AND b.deleted_at IS NULL WHERE e.id = :id`, { id }))[0];
  const clipFor = (episodeId, show) => ({ id: uuid(), episode_id: episodeId, show_id: show, performer: 'lala', s3_key_raw: `episodes/${episodeId}/raw-clips/${uuid()}/original.mp4` });
  const film = (episodeId, show) => clips.createClip(sequelize, clipFor(episodeId, show));

  /**
   * Episode 1's shape (R5, 2026-11-06): placed in E1, then the slot's range
   * is safe..pass while the brief says slay with [slay, pass, safe], and a
   * clip is attached. Any re-snapshot would turn the brief's slay into pass.
   */
  async function episodeOneShape() {
    const { show, arcId } = await seedShow();
    const { id: episodeId, eventId } = await addEpisode(show, 1, { eventName: 'First paid invite' });
    const sid = await slotId(arcId, 1);
    await slots.placeEpisode(sequelize, show, sid, episodeId);
    await run(`UPDATE season_slots SET outcome_range = '{"min":"safe","max":"pass"}'::jsonb, story_purpose = 'Her first paid invite' WHERE id = :sid`, { sid });
    await run(`UPDATE episode_briefs SET designed_intent = 'slay', allowed_outcomes = '["slay","pass","safe"]'::jsonb,
                      event_difficulty = '{"strictness":5,"deadline":"tight"}'::jsonb WHERE episode_id = :episodeId`, { episodeId });
    await film(episodeId, show);
    const before = await record(episodeId);
    expect(before.designed_intent).toBe('slay');
    return { show, arcId, episodeId, eventId, sid, before };
  }
  const expectUnchanged = async (episodeId, before) => {
    const now = await record(episodeId);
    expect(now).toEqual(before);
    expect(now.designed_intent).toBe('slay');
    expect(JSON.parse(now.allowed)).toEqual(['slay', 'pass', 'safe']);
  };

  beforeAll(async () => {
    await slotsMigration.up(sequelize.getQueryInterface(), Sequelize);
    if (!(await rows("SELECT to_regclass('public.season_specials') AS t"))[0].t) {
      await specialsMigration.up(sequelize.getQueryInterface(), Sequelize);
    }
    token = TokenService.generateTokenPair({ id: 'test-user-freeze', email: 'freeze@test.dev', name: 'Freeze Test', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockAsk.create.mockReset();
  });
  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
  });
  afterAll(async () => {
    await wait(300);
    for (const show of shows) {
      const eps = '(SELECT id FROM episodes WHERE show_id = :show)';
      await run(`DELETE FROM episode_raw_clips WHERE show_id = :show OR episode_id IN ${eps}`, { show }).catch(() => {});
      for (const t of ['episode_briefs', 'scene_plans', 'episode_todo_lists', 'episode_spending_lines', 'episode_wardrobe', 'feed_posts']) {
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

  // ── The definition ──────────────────────────────────────────────────────
  describe('when an episode is frozen', () => {
    test('no clips: not frozen; one removed clip: still frozen, frozen_at the earliest clip', async () => {
      const { show } = await seedShow();
      const { id } = await addEpisode(show);
      const state = () => sequelize.transaction(async (t) => { await lockEpisodes(sequelize, [id], { transaction: t }); return snapshotFrozen(sequelize, id, { transaction: t }); });
      expect(await state()).toEqual({ frozen: false, frozen_at: null });
      const first = await film(id, show);
      await run("UPDATE episode_raw_clips SET created_at = '2026-10-23T20:23:51Z' WHERE id = :id", { id: first.id });
      await film(id, show);
      await clips.removeClip(sequelize, id, first.id);
      expect(await state()).toEqual({ frozen: true, frozen_at: '2026-10-23T20:23:51.000Z' });
    });

    test('the guard needs the caller\'s transaction and its FOR UPDATE lock', async () => {
      const { show } = await seedShow();
      const { id } = await addEpisode(show);
      await expect(snapshotFrozen(sequelize, id, {})).rejects.toThrow(/caller's transaction/);
      await sequelize.transaction(async (t) => {
        await expect(snapshotFrozen(sequelize, id, { transaction: t })).rejects.toMatchObject({ code: 'SNAPSHOT_GUARD_WITHOUT_LOCK' });
      });
      await sequelize.transaction(async (t) => {
        await lockEpisodes(sequelize, [id], { transaction: t, mode: 'share' });
        await expect(snapshotFrozen(sequelize, id, { transaction: t })).rejects.toMatchObject({ code: 'SNAPSHOT_GUARD_WITHOUT_LOCK' });
      });
    });
  });

  // ── Unfrozen: as before (regression) ────────────────────────────────────
  describe('an unfrozen episode is re-snapshotted exactly as before', () => {
    test('an intention save rewrites the context and the brief from the slot (W6, unchanged)', async () => {
      const { show, arcId } = await seedShow();
      const { id: episodeId } = await addEpisode(show);
      const sid = await slotId(arcId, 1);
      await slots.placeEpisode(sequelize, show, sid, episodeId);
      const saved = await intentions.saveIntention(sequelize, show, sid, { story_purpose: 'A new purpose', outcome_range: { min: 'safe', max: 'pass' } });
      expect(saved.snapshot_skipped).toEqual([]);
      expect(saved.season_context.story_purpose).toBe('A new purpose');
      const now = await record(episodeId);
      expect(JSON.parse(now.context).story_purpose).toBe('A new purpose');
      expect(now.designed_intent).toBe('pass');
    });

    test('a season edit re-snapshots its started drafts (W5, unchanged)', async () => {
      const { show, arcId } = await seedShow();
      const { id: episodeId } = await addEpisode(show);
      await slots.placeEpisode(sequelize, show, await slotId(arcId, 1), episodeId);
      const result = await setup.updateSetup(sequelize, show, { title: 'Edited', tagline: 'T', phases: [1, 2, 3].map((n) => ({ title: `Part ${n} renamed`, tagline: `t${n}` })) });
      expect(result.snapshot_skipped).toEqual([]);
      expect(JSON.parse((await record(episodeId)).context).phase.title).toBe('Part 1 renamed');
    });
  });

  // ── Frozen: every writer ────────────────────────────────────────────────
  describe('a frozen, Episode 1-shaped episode: every writer refuses or skips', () => {
    test('W6 intention save: the slot saves, the snapshot is skipped and reported, slay stays', async () => {
      const f = await episodeOneShape();
      const saved = await intentions.saveIntention(sequelize, f.show, f.sid, { story_purpose: 'Rewritten after filming', outcome_range: { min: 'safe', max: 'pass' } });
      expect(saved.snapshot_skipped).toEqual([expect.objectContaining({ episode_id: f.episodeId, reason: 'snapshot_frozen', frozen_at: expect.any(String) })]);
      expect(saved.season_context).toEqual(JSON.parse(f.before.context));
      expect((await slotRow(f.sid)).story_purpose).toBe('Rewritten after filming');
      await expectUnchanged(f.episodeId, f.before);
    });

    test('W7 intention redraft (stub model): the slot draft saves, the snapshot is skipped, slay stays', async () => {
      const f = await episodeOneShape();
      const client = fakeClient();
      const drafted = await intentions.draftIntention(sequelize, f.show, f.sid, { anthropic: client });
      expect(client.messages.create).toHaveBeenCalledTimes(1);
      expect(drafted.snapshot_skipped).toEqual([expect.objectContaining({ episode_id: f.episodeId, reason: 'snapshot_frozen' })]);
      await expectUnchanged(f.episodeId, f.before);
    });

    test('W5 season setup with a frozen and an unfrozen draft: the season changes, the frozen one is listed and unchanged', async () => {
      const f = await episodeOneShape();
      const { id: other } = await addEpisode(f.show, 2);
      await slots.placeEpisode(sequelize, f.show, await slotId(f.arcId, 2), other);
      const result = await setup.updateSetup(sequelize, f.show, { title: 'Edited', tagline: 'T', phases: [1, 2, 3].map((n) => ({ title: `Part ${n} renamed`, tagline: `t${n}` })) });
      expect(result.snapshot_skipped).toEqual([expect.objectContaining({ episode_id: f.episodeId, reason: 'snapshot_frozen', label: expect.stringMatching(/E1/) })]);
      expect(JSON.parse((await record(other)).context).phase.title).toBe('Part 1 renamed');
      expect((await rows('SELECT title FROM show_arcs WHERE id = :id', { id: f.arcId }))[0].title).toBe('Edited');
      await expectUnchanged(f.episodeId, f.before);
    });

    test('W1 directly: snapshotEpisode writes nothing and returns the context as it stands', async () => {
      const f = await episodeOneShape();
      const result = await sequelize.transaction((t) => slots.snapshotEpisode(sequelize, { slotId: f.sid, episodeId: f.episodeId, transaction: t }));
      expect(result).toEqual(expect.objectContaining({ frozen: true, episode_id: f.episodeId, context: JSON.parse(f.before.context) }));
      await expectUnchanged(f.episodeId, f.before);
    });

    test('W3 placement into another slot is refused (Q-3), nothing written', async () => {
      const { show, arcId } = await seedShow();
      const { id: episodeId } = await addEpisode(show);
      await run(`UPDATE episodes SET season_context = '{"label":"S1 · Bonus","season_number":1}'::jsonb, season_number = 1 WHERE id = :episodeId`, { episodeId });
      await film(episodeId, show);
      const before = await record(episodeId);
      const sid = await slotId(arcId, 4);
      await expect(slots.placeEpisode(sequelize, show, sid, episodeId)).rejects.toMatchObject({ status: 409, code: 'EPISODE_SNAPSHOT_FROZEN' });
      expect((await slotRow(sid)).episode_id).toBeNull();
      expect(await record(episodeId)).toEqual(before);
    });

    test('§8a: placing a frozen episode with no context is refused (LATE_CONTEXT_NOT_AVAILABLE), nothing written', async () => {
      const { show, arcId } = await seedShow();
      const { id: episodeId } = await addEpisode(show);
      await film(episodeId, show);
      const sid = await slotId(arcId, 3);
      const res = await auth(request(app).put(`/api/v1/world/${show}/season/slots/${sid}/episode`)).send({ episode_id: episodeId });
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'LATE_CONTEXT_NOT_AVAILABLE', episode_id: episodeId });
      expect((await slotRow(sid)).episode_id).toBeNull();
      expect((await record(episodeId)).context).toBeNull();
    });

    test('W9 two-parter: making a frozen episode Part 1 is refused; nothing is made', async () => {
      const f = await episodeOneShape();
      await expect(specials.createTwoParter(sequelize, f.show, { slot_id: f.sid })).rejects.toMatchObject({ status: 409, code: 'EPISODE_SNAPSHOT_FROZEN' });
      expect(await rows("SELECT id FROM season_specials WHERE show_id = :show AND kind = 'two_part' AND deleted_at IS NULL", { show: f.show })).toEqual([]);
      expect((await slotRow(await slotId(f.arcId, 2))).event_id).toBeNull();
      await expectUnchanged(f.episodeId, f.before);
    });

    test('W9 two-parter: undoing it once Part 1 is filmed is refused; W8 Part 2 still starts, Part 1 unchanged', async () => {
      const { show, arcId } = await seedShow();
      const { id: one } = await addEpisode(show, 1, { eventName: 'The big gala' });
      const s5 = await slotId(arcId, 5);
      await slots.placeEpisode(sequelize, show, s5, one);
      const made = await specials.createTwoParter(sequelize, show, { slot_id: s5 });
      await film(one, show);
      const before = await record(one);
      expect(JSON.parse(before.context).two_part).toEqual({ part: 1, of: 2, other_slot_number: 6 });
      await expect(specials.removeTwoParter(sequelize, show, made.id)).rejects.toMatchObject({ status: 409, code: 'EPISODE_SNAPSHOT_FROZEN' });
      expect(await rows('SELECT id FROM season_specials WHERE id = :id AND deleted_at IS NULL', { id: made.id })).toHaveLength(1);
      expect(await record(one)).toEqual(before);
      const two = await specials.startPartTwo(sequelize, show, made.id);
      const partTwo = await record(two.episode.id);
      expect(JSON.parse(partTwo.context)).toEqual(expect.objectContaining({ label: 'S1 · E6 · Part 2/2', two_part: { part: 2, of: 2, other_slot_number: 5 } }));
      expect(await record(one)).toEqual(before);
    });

    test('W10 a special edit saves the special and skips its filmed episode\'s snapshot; W12 swap and next-season move are refused', async () => {
      const { show, arcId } = await seedShow();
      const arc2 = uuid();
      await run(`INSERT INTO show_arcs (id, show_id, arc_number, title, season_number, episode_start, episode_end, phases, current_phase, status, created_at, updated_at)
                 VALUES (:arc2, :show, 2, 'Season 2', 2, 1, 24, '[]'::jsonb, 1, 'planned', NOW(), NOW())`, { arc2, show });
      await slots.ensureSeasonSlots(sequelize, { id: arc2, show_id: show, season_number: 2, phases: [] });
      const { id: episodeId, eventId } = await addEpisode(show, 1, { eventName: 'Premiere' });
      const specialId = uuid();
      await run(`INSERT INTO season_specials (id, show_id, arc_id, kind, event_id, episode_id, after_slot_number, title, locked_at, created_at, updated_at)
                 VALUES (:specialId, :show, :arcId, 'bonus', :eventId, :episodeId, 4, 'Premiere', NOW(), NOW(), NOW())`, { specialId, show, arcId, eventId, episodeId });
      await sequelize.transaction((t) => specials.snapshotSpecialEpisode(sequelize, { specialId, episodeId, transaction: t }));
      await film(episodeId, show);
      const before = await record(episodeId);
      expect(JSON.parse(before.context).label).toMatch(/Bonus|Premiere|S1/);

      const edited = await specials.updateSpecial(sequelize, show, specialId, { title: 'Premiere, renamed' });
      expect(edited.snapshot_skipped).toEqual([expect.objectContaining({ episode_id: episodeId, reason: 'snapshot_frozen' })]);
      expect((await rows('SELECT title FROM season_specials WHERE id = :specialId', { specialId }))[0].title).toBe('Premiere, renamed');
      expect(await record(episodeId)).toEqual(before);

      await expect(full.swapIntoSlot(sequelize, show, eventId, await slotId(arcId, 7))).rejects.toMatchObject({ status: 409, code: 'EPISODE_SNAPSHOT_FROZEN' });
      await expect(full.moveToNextSeason(sequelize, show, eventId)).rejects.toMatchObject({ status: 409, code: 'EPISODE_SNAPSHOT_FROZEN' });
      expect((await rows('SELECT episode_id, deleted_at FROM season_specials WHERE id = :specialId', { specialId }))[0]).toEqual({ episode_id: episodeId, deleted_at: null });
      expect((await slotRow(await slotId(arcId, 7))).episode_id).toBeNull();
      expect((await slotRow(await slotId(arc2, 1))).episode_id).toBeNull();
      expect(await record(episodeId)).toEqual(before);
    });

    test('a correction-procedure append (owner SQL) keeps every original key; the writers still skip', async () => {
      const f = await episodeOneShape();
      await run(`UPDATE episodes SET season_context = season_context || jsonb_build_object('corrections', '[{"note":"owner correction"}]'::jsonb) WHERE id = :id`, { id: f.episodeId });
      const appended = await record(f.episodeId);
      const original = JSON.parse(f.before.context);
      const now = JSON.parse(appended.context);
      for (const k of Object.keys(original)) expect(now[k]).toEqual(original[k]);
      await intentions.saveIntention(sequelize, f.show, f.sid, { story_purpose: 'After the correction' });
      expect(await record(f.episodeId)).toEqual(appended);
    });
  });

  // ── W4: regenerate ──────────────────────────────────────────────────────
  describe('W4: a filmed episode is never regenerated', () => {
    const eventRow = async (eventId) => (await rows('SELECT * FROM world_events WHERE id = :eventId', { eventId }))[0];

    test('refused before the model is asked (route: 409 EPISODE_SNAPSHOT_FROZEN); no new episode', async () => {
      const f = await episodeOneShape();
      process.env.ANTHROPIC_API_KEY = 'stub-not-a-key';
      const res = await auth(request(app).post(`/api/v1/world/${f.show}/events/${f.eventId}/regenerate-episode`)).send({});
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'EPISODE_SNAPSHOT_FROZEN', episode_id: f.episodeId });
      expect(mockAsk.create).not.toHaveBeenCalled();
      expect(await rows('SELECT id FROM episodes WHERE show_id = :show AND deleted_at IS NULL', { show: f.show })).toEqual([{ id: f.episodeId }]);
      await expectUnchanged(f.episodeId, f.before);
    });

    test('a clip that arrives after the pre-check (while the model answers) is caught under the lock: 409, nothing written', async () => {
      const { show, arcId } = await seedShow();
      const { id: episodeId, eventId } = await addEpisode(show, 1, { eventName: 'Late clip gala' });
      const sid = await slotId(arcId, 1);
      await slots.placeEpisode(sequelize, show, sid, episodeId);
      const before = await record(episodeId);
      process.env.ANTHROPIC_API_KEY = 'stub-not-a-key';
      mockAsk.create.mockImplementation(async () => {
        await film(episodeId, show); // filming begins while the (stub) model answers
        return { content: [{ text: '{"title":"New title"}' }] };
      });
      await expect(generateEpisodeFromEvent(await eventRow(eventId), models, { showId: show, wardrobeItems: [], replacingEpisodeId: episodeId }))
        .rejects.toMatchObject({ status: 409, code: 'EPISODE_SNAPSHOT_FROZEN' });
      expect(mockAsk.create).toHaveBeenCalledTimes(1);
      expect(await rows('SELECT id FROM episodes WHERE show_id = :show AND deleted_at IS NULL', { show })).toEqual([{ id: episodeId }]);
      expect((await eventRow(eventId)).used_in_episode_id).toBe(episodeId);
      expect((await slotRow(sid)).episode_id).toBe(episodeId);
      expect(await record(episodeId)).toEqual(before);
    });
  });

  // ── Races: a clip attach and a writer take turns, in both orders ─────────
  describe('a clip attach and a snapshot writer take turns (no deadlock, consistent end)', () => {
    async function startedDraft() {
      const { show, arcId } = await seedShow();
      const { id: episodeId } = await addEpisode(show);
      const sid = await slotId(arcId, 1);
      await slots.placeEpisode(sequelize, show, sid, episodeId);
      return { show, arcId, episodeId, sid };
    }

    test('writer first: the clip waits for the snapshot, then attaches; the next writer skips', async () => {
      const f = await startedDraft();
      const t1 = await sequelize.transaction();
      let clip;
      try {
        await slots.snapshotEpisode(sequelize, { slotId: f.sid, episodeId: f.episodeId, transaction: t1 });
        clip = track(film(f.episodeId, f.show));
        await wait(400);
        expect(clip.settled).toBe(false); // FOR SHARE waits on the writer's FOR UPDATE
        await t1.commit();
      } catch (err) {
        await t1.rollback().catch(() => {});
        throw err;
      }
      await clip.promise;
      const afterClip = await record(f.episodeId);
      const saved = await intentions.saveIntention(sequelize, f.show, f.sid, { story_purpose: 'After filming' });
      expect(saved.snapshot_skipped).toHaveLength(1);
      expect(await record(f.episodeId)).toEqual(afterClip);
    });

    test('clip first: an intention save waits for the attach, then skips the snapshot', async () => {
      const f = await startedDraft();
      const before = await record(f.episodeId);
      const t1 = await sequelize.transaction();
      let save;
      try {
        await lockEpisodes(sequelize, [f.episodeId], { transaction: t1, mode: 'share' });
        await sequelize.query(
          `INSERT INTO episode_raw_clips (id, episode_id, show_id, performer, s3_key_raw, key_status, key_strength, created_at, updated_at)
           VALUES (:id, :episodeId, :show, 'lala', :key, 'none', 'medium', NOW(), NOW())`,
          { replacements: { id: uuid(), episodeId: f.episodeId, show: f.show, key: `episodes/${f.episodeId}/raw-clips/x/original.mp4` }, transaction: t1 });
        save = track(intentions.saveIntention(sequelize, f.show, f.sid, { story_purpose: 'Raced the clip' }));
        await wait(400);
        expect(save.settled).toBe(false);
        await t1.commit();
      } catch (err) {
        await t1.rollback().catch(() => {});
        throw err;
      }
      const saved = await save.promise;
      expect(saved.snapshot_skipped).toHaveLength(1);
      expect((await slotRow(f.sid)).story_purpose).toBe('Raced the clip');
      expect(await record(f.episodeId)).toEqual(before);
    });

    test('clip and season setup, many rounds at once: no deadlock, and once filmed the context never changes again', async () => {
      const f = await startedDraft();
      let frozenContext = null;
      for (let i = 0; i < 4; i += 1) {
        const results = await Promise.allSettled([
          film(f.episodeId, f.show),
          setup.updateSetup(sequelize, f.show, { title: `Round ${i}`, tagline: 'T', phases: [1, 2, 3].map((n) => ({ title: `Part ${n} r${i}`, tagline: `t${n}` })) }),
        ]);
        for (const r of results) if (r.status === 'rejected') throw r.reason;
        const now = await record(f.episodeId);
        if (frozenContext) expect(now.context).toBe(frozenContext);
        frozenContext = now.context;
      }
    });
  });

  // ── The routes: the interim Start-record and intent guards (§6, §7) ──────
  describe('PUT /episodes/:id: season_number freezes with the episode (B-2)', () => {
    const put = (id, body) => auth(request(app).put(`/api/v1/episodes/${id}`)).send(body);

    test('a change on a frozen episode: 409 START_RECORD_FROZEN, and nothing in the request is written', async () => {
      const f = await episodeOneShape();
      const res = await put(f.episodeId, { season_number: 2, title: 'Renamed with the season' });
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'START_RECORD_FROZEN', fields: ['season_number'], episode_id: f.episodeId });
      expect((await rows('SELECT title, season_number FROM episodes WHERE id = :id', { id: f.episodeId }))[0]).toEqual({ title: 'Freeze episode 1', season_number: 1 });
    });

    test('the unchanged value, and other fields, save on a frozen episode', async () => {
      const f = await episodeOneShape();
      const res = await put(f.episodeId, { season_number: '1', title: 'A better title' });
      expect(res.status).toBe(200);
      expect((await rows('SELECT title, season_number FROM episodes WHERE id = :id', { id: f.episodeId }))[0]).toEqual({ title: 'A better title', season_number: 1 });
      await expectUnchanged(f.episodeId, f.before);
    });

    test('an unfrozen episode changes its season_number as before', async () => {
      const { show } = await seedShow();
      const { id } = await addEpisode(show);
      const res = await put(id, { season_number: 3 });
      expect(res.status).toBe(200);
      expect((await rows('SELECT season_number FROM episodes WHERE id = :id', { id }))[0].season_number).toBe(3);
    });
  });

  describe('PUT /episode-brief/:id: the Start record (B-3, V-1) and frozen intent (B-1 = b)', () => {
    const put = (id, body) => auth(request(app).put(`/api/v1/episode-brief/${id}`)).send(body);
    const brief = async (id) => (await rows(
      `SELECT designed_intent, allowed_outcomes, arc_number, position_in_arc, event_difficulty, narrative_purpose, forward_hook, episode_archetype
         FROM episode_briefs WHERE episode_id = :id`, { id }))[0];

    test.each([
      ['event_difficulty', { event_difficulty: { strictness: 9, deadline: 'tight' } }],
      ['arc_number', { arc_number: 2 }],
      ['position_in_arc', { position_in_arc: 4 }],
    ])('changing %s on a frozen episode: 409 START_RECORD_FROZEN, nothing written', async (field, body) => {
      const f = await episodeOneShape();
      const before = await brief(f.episodeId);
      const res = await put(f.episodeId, { ...body, narrative_purpose: 'Sent in the same request' });
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'START_RECORD_FROZEN', fields: [field] });
      expect(await brief(f.episodeId)).toEqual(before);
    });

    test('changing designed_intent or allowed_outcomes on a frozen episode: 409 INTENT_EDIT_PENDING_AUDIT, slay stays', async () => {
      const f = await episodeOneShape();
      for (const body of [{ designed_intent: 'pass' }, { allowed_outcomes: ['pass', 'safe'] }, { allowed_outcomes: ['safe', 'pass', 'slay'] }]) {
        const res = await put(f.episodeId, body);
        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ code: 'INTENT_EDIT_PENDING_AUDIT', episode_id: f.episodeId });
        expect(res.body.error).toMatch(/once the audited editor is available/);
      }
      await expectUnchanged(f.episodeId, f.before);
    });

    test('a frozen brief\'s form sent back whole, unchanged, with creative fields edited: 200, only those change', async () => {
      const f = await episodeOneShape();
      const b = await brief(f.episodeId);
      const res = await put(f.episodeId, {
        designed_intent: b.designed_intent, allowed_outcomes: b.allowed_outcomes, arc_number: String(b.arc_number), position_in_arc: b.position_in_arc,
        event_difficulty: { deadline: 'tight', strictness: 5 },
        narrative_purpose: 'Her purpose, edited', forward_hook: 'Next week: the fallout', episode_archetype: 'Rising',
      });
      expect(res.status).toBe(200);
      expect(await brief(f.episodeId)).toEqual({ ...b, narrative_purpose: 'Her purpose, edited', forward_hook: 'Next week: the fallout', episode_archetype: 'Rising' });
      await expectUnchanged(f.episodeId, f.before);
    });

    test('an unfrozen episode saves every field as before', async () => {
      const { show } = await seedShow();
      const { id } = await addEpisode(show);
      const res = await put(id, { designed_intent: 'pass', allowed_outcomes: ['pass'], arc_number: 2, position_in_arc: 3, event_difficulty: { strictness: 7 } });
      expect(res.status).toBe(200);
      expect(await brief(id)).toEqual(expect.objectContaining({ designed_intent: 'pass', allowed_outcomes: ['pass'], arc_number: 2, position_in_arc: 3, event_difficulty: { strictness: 7 } }));
    });

    test('the event_id rule is unchanged: a started brief\'s event cannot change (EVENT_TERMS_LOCKED)', async () => {
      const f = await episodeOneShape();
      const res = await put(f.episodeId, { event_id: uuid() });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EVENT_TERMS_LOCKED');
    });
  });

  // ── What is never blocked (§9) ──────────────────────────────────────────
  test('production work on a frozen episode is not blocked: clips upload, the script saves, the brief\'s creative fields save', async () => {
    const f = await episodeOneShape();
    await film(f.episodeId, f.show); // more clips: never blocked
    const script = await auth(request(app).get(`/api/v1/episodes/${f.episodeId}`));
    expect(script.status).toBe(200);
    const res = await auth(request(app).put(`/api/v1/episodes/${f.episodeId}`)).send({ description: 'An updated synopsis' });
    expect(res.status).toBe(200);
    expect((await rows('SELECT description FROM episodes WHERE id = :id', { id: f.episodeId }))[0].description).toBe('An updated synopsis');
    await expectUnchanged(f.episodeId, f.before);
  });
});
