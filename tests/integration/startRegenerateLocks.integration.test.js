/**
 * A1.1 completion (Evoni, 2026-11-06): Start Episode's regenerate locks the
 * episode it replaces before the event (episode-first), like the special
 * swap, the move to the next season and a terms reopen. On the test
 * database, with the real Start (generateEpisodeFromEvent) held part way:
 *   - a regenerate and a swap of the same special never deadlock;
 *   - a regenerate and a move to the next season never deadlock;
 *   - two regenerates of the same episode: one replaces it, the other is
 *     refused, and only one new episode exists;
 *   - an episode deleted while its regenerate waited is not replaced: 409
 *     START_TARGET_CHANGED, nothing created;
 *   - a failure inside the transaction leaves the old episode live and
 *     linked, and no new episode;
 *   - a plain regenerate of a special's episode still moves the special to
 *     the new episode, and a first Start is unchanged.
 */
jest.unmock('uuid');

const { Sequelize } = require('sequelize');
const crypto = require('crypto');
const models = require('../../src/models');
const slotsMigration = require('../../src/migrations/20261001230000-create-season-slots');
const specialsMigration = require('../../src/migrations/20261026150000-create-season-specials');
const { seedArc } = require('../../src/services/arcProgressionService');
const slots = require('../../src/services/seasonSlotService');
const full = require('../../src/services/seasonFullSpecials');
const spending = require('../../src/services/episodeSpendingService');
const { generateEpisodeFromEvent } = require('../../src/services/episodeGeneratorService');
const { isLockConflict } = require('../../src/utils/episodeLocks');

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

/** Holds the real Start at Episode.create (inside its transaction, after its locks) until open(). */
function holdStart() {
  let open;
  let reached;
  const gate = new Promise((resolve) => { open = resolve; });
  const atGate = new Promise((resolve) => { reached = resolve; });
  const real = models.Episode.create.bind(models.Episode);
  jest.spyOn(models.Episode, 'create').mockImplementationOnce(async (...args) => { reached(); await gate; return real(...args); });
  return { open: () => open(), reached: atGate };
}

const lockCode = (err) => (err && isLockConflict(err) ? (err.original?.code || err.parent?.code || err.code) : null);

(shouldSkip ? describe.skip : describe)('A1.1: Start regeneration locks the replaced episode first', () => {
  const shows = [];

  /** A season with a bonus special whose episode R started from event E. */
  async function specialWithEpisode({ nextSeason = false } = {}) {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST('{"starting_balance": 1000}' AS jsonb), NOW(), NOW())`,
      { show, name: `Regen locks ${show.slice(0, 8)}`, slug: `regen-locks-${show.slice(0, 8)}` });
    const { arc_id: arcId } = await seedArc(show, models);
    let arc2 = null;
    if (nextSeason) {
      arc2 = uuid();
      await run(`INSERT INTO show_arcs (id, show_id, arc_number, title, season_number, episode_start, episode_end, phases, current_phase, status, created_at, updated_at)
                 VALUES (:arc2, :show, 2, 'Season 2', 2, 1, 24, '[]'::jsonb, 1, 'planned', NOW(), NOW())`, { arc2, show });
      await slots.ensureSeasonSlots(sequelize, { id: arc2, show_id: show, season_number: 2, phases: [] });
    }
    const episodeId = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:episodeId, :show, 'Original special', 1, 'draft', NOW(), NOW())`, { episodeId, show });
    const eventId = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, strictness, cost_coins, used_in_episode_id, times_used, canon_consequences, created_at, updated_at)
               VALUES (:eventId, :show, 'Premiere', 'invite', 'used', 5, 5, 0, :episodeId, 1, '{}'::jsonb, NOW(), NOW())`, { eventId, show, episodeId });
    const specialId = uuid();
    await run(`INSERT INTO season_specials (id, show_id, arc_id, kind, event_id, episode_id, after_slot_number, locked_at, created_at, updated_at)
               VALUES (:specialId, :show, :arcId, 'bonus', :eventId, :episodeId, 4, NOW(), NOW(), NOW())`, { specialId, show, arcId, eventId, episodeId });
    return { show, arcId, arc2, episodeId, eventId, specialId };
  }
  const eventRow = async (eventId) => (await rows('SELECT * FROM world_events WHERE id = :eventId', { eventId }))[0];
  const regenerate = async (f) => generateEpisodeFromEvent(await eventRow(f.eventId), models, { showId: f.show, wardrobeItems: [], replacingEpisodeId: f.episodeId });
  const liveEpisodes = async (show) => rows('SELECT id FROM episodes WHERE show_id = :show AND deleted_at IS NULL ORDER BY created_at', { show });
  const episodeState = async (id) => (await rows('SELECT deleted_at IS NOT NULL AS deleted FROM episodes WHERE id = :id', { id }))[0];
  const slotId = async (arcId, n) => (await rows('SELECT id FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0].id;

  beforeAll(async () => {
    await slotsMigration.up(sequelize.getQueryInterface(), Sequelize);
    if (!(await rows("SELECT to_regclass('public.season_specials') AS t"))[0].t) {
      await specialsMigration.up(sequelize.getQueryInterface(), Sequelize);
    }
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await wait(500); // Start's after-commit work
    for (const show of shows) {
      const eps = '(SELECT id FROM episodes WHERE show_id = :show)';
      for (const t of ['episode_briefs', 'scene_plans', 'episode_todo_lists', 'episode_spending_lines', 'episode_wardrobe', 'feed_posts']) {
        await run(`DELETE FROM ${t} WHERE episode_id IN ${eps}`, { show }).catch(() => {});
      }
      for (const t of ['season_specials', 'season_slots', 'financial_transactions', 'character_state_history', 'character_state', 'show_arcs']) {
        await run(`DELETE FROM ${t} WHERE show_id = :show`, { show }).catch(() => {});
      }
      await run('UPDATE world_events SET used_in_episode_id = NULL WHERE show_id = :show', { show }).catch(() => {});
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show }).catch(() => {});
      await run('DELETE FROM world_events WHERE show_id = :show', { show }).catch(() => {});
      await run('DELETE FROM shows WHERE id = :show', { show }).catch(() => {});
    }
    await sequelize.close();
  });

  test('a regenerate and a swap of the same special never deadlock', async () => {
    const f = await specialWithEpisode();
    const hold = holdStart();
    const start = track(regenerate(f));
    await hold.reached; // Start holds its locks now
    const swap = track(full.swapIntoSlot(sequelize, f.show, f.eventId, await slotId(f.arcId, 7)));
    await wait(500);
    hold.open();
    await start.promise.catch(() => {});
    await swap.promise.catch(() => {});
    expect(lockCode(start.error)).toBeNull();
    expect(lockCode(swap.error)).toBeNull();
    expect(start.error).toBeUndefined();
    expect(await episodeState(f.episodeId)).toEqual({ deleted: true });
  });

  test('a regenerate and a move to the next season never deadlock', async () => {
    const f = await specialWithEpisode({ nextSeason: true });
    const hold = holdStart();
    const start = track(regenerate(f));
    await hold.reached;
    const move = track(full.moveToNextSeason(sequelize, f.show, f.eventId));
    await wait(500);
    hold.open();
    await start.promise.catch(() => {});
    await move.promise.catch(() => {});
    expect(lockCode(start.error)).toBeNull();
    expect(lockCode(move.error)).toBeNull();
    expect(start.error).toBeUndefined();
  });

  test('two regenerates of the same episode: one replaces it, the other is refused, one new episode', async () => {
    const f = await specialWithEpisode();
    const results = await Promise.allSettled([regenerate(f), regenerate(f)]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const refused = results.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(refused).toHaveLength(1);
    expect(lockCode(refused[0].reason)).toBeNull();
    expect(refused[0].reason.status || refused[0].reason.statusCode).toBe(409);
    const live = await liveEpisodes(f.show);
    expect(live.map((e) => e.id)).toEqual([ok[0].value.episode.id]);
    expect((await eventRow(f.eventId)).used_in_episode_id).toBe(ok[0].value.episode.id);
  });

  test('an episode deleted while its regenerate waited is not replaced: 409 START_TARGET_CHANGED, nothing created', async () => {
    const f = await specialWithEpisode();
    const t1 = await sequelize.transaction();
    await sequelize.query('SELECT id FROM episodes WHERE id = :id FOR UPDATE', { replacements: { id: f.episodeId }, transaction: t1 });
    const start = track(regenerate(f));
    await wait(600);
    expect(start.settled).toBe(false); // waiting on the replaced episode
    await sequelize.query('UPDATE episodes SET deleted_at = NOW() WHERE id = :id', { replacements: { id: f.episodeId }, transaction: t1 });
    await t1.commit();
    await expect(start.promise).rejects.toMatchObject({ status: 409, code: 'START_TARGET_CHANGED' });
    expect(await liveEpisodes(f.show)).toEqual([]);
    expect((await eventRow(f.eventId)).used_in_episode_id).toBe(f.episodeId);
  });

  test('a failure inside the regenerate leaves the old episode live and linked, and no new episode', async () => {
    const f = await specialWithEpisode();
    jest.spyOn(spending, 'draftEpisodeSpending').mockRejectedValueOnce(new Error('injected spending failure'));
    await expect(regenerate(f)).rejects.toThrow('injected spending failure');
    expect(await episodeState(f.episodeId)).toEqual({ deleted: false });
    expect((await eventRow(f.eventId)).used_in_episode_id).toBe(f.episodeId);
    expect((await liveEpisodes(f.show)).map((e) => e.id)).toEqual([f.episodeId]);
    expect((await rows('SELECT episode_id FROM season_specials WHERE id = :id', { id: f.specialId }))[0].episode_id).toBe(f.episodeId);
  });

  test('a plain regenerate of a special\'s episode moves the special to the new episode; a first Start is unchanged', async () => {
    const f = await specialWithEpisode();
    const result = await regenerate(f);
    const newId = result.episode.id;
    expect(await episodeState(f.episodeId)).toEqual({ deleted: true });
    expect((await eventRow(f.eventId)).used_in_episode_id).toBe(newId);
    expect((await rows('SELECT episode_id FROM season_specials WHERE id = :id', { id: f.specialId }))[0].episode_id).toBe(newId);
    expect((await rows("SELECT season_context->'special'->>'label' AS label FROM episodes WHERE id = :id", { id: newId }))[0].label).toMatch(/Special/);

    // A first Start: an event never used starts its episode, which takes slot 1.
    const fresh = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, strictness, cost_coins, canon_consequences, created_at, updated_at)
               VALUES (:fresh, :show, 'First night', 'invite', 'draft', 5, 5, 0, '{}'::jsonb, NOW(), NOW())`, { fresh, show: f.show });
    const first = await generateEpisodeFromEvent(await eventRow(fresh), models, { showId: f.show, wardrobeItems: [] });
    expect((await eventRow(fresh)).used_in_episode_id).toBe(first.episode.id);
    expect((await rows('SELECT episode_id FROM season_slots WHERE id = :id', { id: await slotId(f.arcId, 1) }))[0].episode_id).toBe(first.episode.id);
  });
});
