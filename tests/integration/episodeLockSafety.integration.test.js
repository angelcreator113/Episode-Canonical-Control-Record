/**
 * A1.1: transaction and locking safety for the Start snapshot (Evoni,
 * 2026-11-06). On the test database:
 *   - lock_timeout is SET LOCAL: it ends with the transaction;
 *   - an intention save, its snapshot and the brief are one transaction: a
 *     snapshot that fails leaves the slot as it was (save and draft);
 *   - draftIntention asks the model before any transaction opens;
 *   - a raw clip's attachment and a snapshot write take turns on the
 *     episode, in either order; two uploads to one episode never wait;
 *   - a retried clip with the same id is the same row; another upload's id
 *     is refused;
 *   - the special swap locks its episode before its event, so a transaction
 *     that locks the episode, then the event (as a terms reopen does) never
 *     deadlocks with it;
 *   - Start's slot assignment rolls back whole, and placing the episode
 *     clears the failed setup step;
 *   - the writers need the caller's transaction and never open their own.
 */
jest.unmock('uuid');

const { Sequelize } = require('sequelize');
const crypto = require('crypto');
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
const { lockEpisodes, LOCK_TIMEOUT, isLockConflict } = require('../../src/utils/episodeLocks');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A promise and whether it has settled, so a test can see that it is still waiting. */
function track(promise) {
  const t = { settled: false, value: undefined, error: undefined };
  t.promise = promise.then((v) => { t.settled = true; t.value = v; return v; }, (e) => { t.settled = true; t.error = e; throw e; });
  t.promise.catch(() => {});
  return t;
}

/** A gate a test opens: work that awaits gate.wait() stops there until gate.open(). */
function gate() {
  let open;
  const promise = new Promise((resolve) => { open = resolve; });
  return { wait: () => promise, open: () => open() };
}

const DRAFT = { story_purpose: 'Lala is tested by her first paid invite', career_focus: 'reputation', desired_pressure: 'Medium', outcome_range: { min: 'safe', max: 'pass' } };
function fakeClient(json, onAsk = () => {}) {
  const create = jest.fn(async () => { onAsk(); return { content: [{ text: `Here it is:\n${JSON.stringify(json)}` }] }; });
  return { client: { messages: { create } }, create };
}

(shouldSkip ? describe.skip : describe)('A1.1 episode-first locking (Start snapshot integrity)', () => {
  const shows = [];

  async function seedShow() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST('{"starting_balance": 1000}' AS jsonb), NOW(), NOW())`,
      { show, name: `Locks ${show.slice(0, 8)}`, slug: `locks-${show.slice(0, 8)}` });
    const { arc_id: arcId } = await seedArc(show, models);
    return { show, arcId };
  }
  async function addEpisode(show, n = 1) {
    const id = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:id, :show, :title, :n, 'draft', NOW(), NOW())`, { id, show, title: `Locks episode ${n}`, n });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, status, created_at, updated_at)
               VALUES (:bid, :id, :show, 'draft', NOW(), NOW())`, { bid: uuid(), id, show });
    return id;
  }
  const slotId = async (arcId, n) => (await rows('SELECT id FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0].id;
  const slotRow = async (id) => (await rows('SELECT story_purpose, story_purposes, intention_source, outcome_range, episode_id, locked_at FROM season_slots WHERE id = :id', { id }))[0];
  const episodeRow = async (id) => (await rows('SELECT season_context, setup_status FROM episodes WHERE id = :id', { id }))[0];
  const briefRow = async (id) => (await rows('SELECT designed_intent, allowed_outcomes, narrative_purpose, arc_number, position_in_arc FROM episode_briefs WHERE episode_id = :id', { id }))[0];

  /** A season with E1 started: an episode placed in slot 1 (its snapshot written). */
  async function startedSlot() {
    const { show, arcId } = await seedShow();
    const episodeId = await addEpisode(show);
    const sid = await slotId(arcId, 1);
    await slots.placeEpisode(sequelize, show, sid, episodeId);
    return { show, arcId, episodeId, sid };
  }
  const clipFor = (episodeId, show, over = {}) => ({
    id: uuid(), episode_id: episodeId, show_id: show, performer: 'lala', s3_key_raw: `episodes/${episodeId}/raw-clips/${uuid()}/original.mp4`, ...over,
  });

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
    for (const show of shows) {
      await run('DELETE FROM episode_raw_clips WHERE show_id = :show OR episode_id IN (SELECT id FROM episodes WHERE show_id = :show)', { show }).catch(() => {});
      for (const table of ['season_specials', 'season_slots', 'show_arcs']) {
        await run(`DELETE FROM ${table} WHERE show_id = :show`, { show }).catch(() => {});
      }
      await run('DELETE FROM episode_briefs WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)', { show }).catch(() => {});
      await run('UPDATE world_events SET used_in_episode_id = NULL WHERE show_id = :show', { show }).catch(() => {});
      await run('DELETE FROM episodes WHERE show_id = :show', { show }).catch(() => {});
      await run('DELETE FROM world_events WHERE show_id = :show', { show }).catch(() => {});
      await run('DELETE FROM shows WHERE id = :show', { show }).catch(() => {});
    }
    await sequelize.close();
  });

  test('lock_timeout is set for the transaction only: gone after commit and after rollback', async () => {
    const one = new Sequelize(process.env.DATABASE_URL, { logging: false, pool: { max: 1, min: 1 } });
    try {
      const { show } = await seedShow();
      const ep = await addEpisode(show);
      const setting = async (transaction) => (await one.query("SELECT current_setting('lock_timeout') AS v", { transaction }))[0][0].v;
      const before = await setting();
      await one.transaction(async (transaction) => {
        await lockEpisodes(one, [ep], { transaction });
        expect(await setting(transaction)).toBe(LOCK_TIMEOUT);
      });
      expect(await setting()).toBe(before);
      await expect(one.transaction(async (transaction) => {
        await lockEpisodes(one, [ep], { transaction });
        throw new Error('roll back');
      })).rejects.toThrow('roll back');
      expect(await setting()).toBe(before);
    } finally {
      await one.close();
    }
  });

  test('the writers need the caller\'s transaction, and open none of their own', async () => {
    const { episodeId, sid } = await startedSlot();
    await expect(slots.snapshotEpisode(sequelize, { slotId: sid, episodeId })).rejects.toThrow(/needs the caller's transaction/);
    await expect(specials.snapshotSpecialEpisode(sequelize, { specialId: uuid(), episodeId })).rejects.toThrow(/needs the caller's transaction/);
    await expect(specials.stampTwoPart(sequelize, { episodeId, slotNumber: 1, part: 1, otherSlotNumber: 2 })).rejects.toThrow(/needs the caller's transaction/);
    await expect(specials.unstampTwoPart(sequelize, { episodeId, slotNumber: 1 })).rejects.toThrow(/needs the caller's transaction/);

    await sequelize.transaction(async (transaction) => {
      const opened = jest.spyOn(sequelize, 'transaction');
      await slots.snapshotEpisode(sequelize, { slotId: sid, episodeId, transaction });
      await specials.stampTwoPart(sequelize, { episodeId, slotNumber: 1, part: 1, otherSlotNumber: 2, transaction });
      await specials.unstampTwoPart(sequelize, { episodeId, slotNumber: 1, transaction });
      expect(opened).not.toHaveBeenCalled();
    });
  });

  test('a snapshot that fails rolls the intention save back: slot, snapshot and brief as they were', async () => {
    const { show, episodeId, sid } = await startedSlot();
    const slotBefore = await slotRow(sid);
    const epBefore = await episodeRow(episodeId);
    const briefBefore = await briefRow(episodeId);
    jest.spyOn(slots, 'snapshotEpisode').mockRejectedValueOnce(new Error('snapshot failed'));
    await expect(intentions.saveIntention(sequelize, show, sid, { story_purpose: 'A new purpose that must not stick', outcome_range: { min: 'pass', max: 'slay' } }))
      .rejects.toThrow('snapshot failed');
    expect(await slotRow(sid)).toEqual(slotBefore);
    expect(await episodeRow(episodeId)).toEqual(epBefore);
    expect(await briefRow(episodeId)).toEqual(briefBefore);

    // The same save, with the snapshot working, writes all three together.
    await intentions.saveIntention(sequelize, show, sid, { story_purpose: 'A new purpose that sticks', outcome_range: { min: 'pass', max: 'slay' } });
    expect((await slotRow(sid)).story_purpose).toBe('A new purpose that sticks');
    expect((await episodeRow(episodeId)).season_context.story_purpose).toBe('A new purpose that sticks');
    expect(await briefRow(episodeId)).toMatchObject({ designed_intent: 'slay', allowed_outcomes: ['pass', 'slay'] });
  });

  test('draftIntention asks the model before any transaction opens; a failed snapshot rolls the draft back', async () => {
    const { show, episodeId, sid } = await startedSlot();
    const slotBefore = await slotRow(sid);
    const epBefore = await episodeRow(episodeId);
    const opened = jest.spyOn(sequelize, 'transaction');
    let openedWhenAsked = null;
    const { client } = fakeClient(DRAFT, () => { openedWhenAsked = opened.mock.calls.length; });
    jest.spyOn(slots, 'snapshotEpisode').mockRejectedValueOnce(new Error('snapshot failed'));
    await expect(intentions.draftIntention(sequelize, show, sid, { anthropic: client })).rejects.toThrow('snapshot failed');
    expect(openedWhenAsked).toBe(0);
    expect(opened).toHaveBeenCalledTimes(1);
    expect(await slotRow(sid)).toEqual(slotBefore);
    expect(await episodeRow(episodeId)).toEqual(epBefore);
  });

  test('a clip attached first: an intention save waits for it, then saves', async () => {
    const { show, episodeId, sid } = await startedSlot();
    const order = [];
    const t1 = await sequelize.transaction();
    await lockEpisodes(sequelize, [episodeId], { transaction: t1, mode: 'share' });
    const save = track(intentions.saveIntention(sequelize, show, sid, { story_purpose: 'Saved after the clip' }).then((v) => { order.push('save'); return v; }));
    await wait(600);
    expect(save.settled).toBe(false);
    order.push('clip committed');
    await t1.commit();
    await save.promise;
    expect(order).toEqual(['clip committed', 'save']);
    expect((await episodeRow(episodeId)).season_context.story_purpose).toBe('Saved after the clip');
  });

  test('a save first: a clip upload waits for the save to commit, then attaches', async () => {
    const { show, episodeId, sid } = await startedSlot();
    const order = [];
    const g = gate();
    const real = slots.snapshotEpisode;
    jest.spyOn(slots, 'snapshotEpisode').mockImplementationOnce(async (...args) => { await g.wait(); return real(...args); });
    const save = track(intentions.saveIntention(sequelize, show, sid, { story_purpose: 'Saved before the clip' }).then((v) => { order.push('save'); return v; }));
    await wait(300); // the save holds the episode now
    const clip = track(clips.createClip(sequelize, clipFor(episodeId, show)).then((v) => { order.push('clip'); return v; }));
    await wait(600);
    expect(clip.settled).toBe(false);
    g.open();
    await save.promise;
    await clip.promise;
    expect(order).toEqual(['save', 'clip']);
    expect((await rows('SELECT count(*)::int AS n FROM episode_raw_clips WHERE episode_id = :episodeId', { episodeId }))[0].n).toBe(1);
  });

  test('two uploads to one episode do not wait on each other', async () => {
    const { show } = await seedShow();
    const episodeId = await addEpisode(show);
    const t1 = await sequelize.transaction();
    try {
      await lockEpisodes(sequelize, [episodeId], { transaction: t1, mode: 'share' });
      const started = Date.now();
      const row = await clips.createClip(sequelize, clipFor(episodeId, show));
      expect(row.episode_id).toBe(episodeId);
      expect(Date.now() - started).toBeLessThan(2000);
    } finally {
      await t1.commit();
    }
  });

  test('a clip waits for a transaction holding its episode (completion, finalize, a reopen), then attaches', async () => {
    const { show } = await seedShow();
    const episodeId = await addEpisode(show);
    const t1 = await sequelize.transaction();
    await sequelize.query('SELECT id FROM episodes WHERE id = :episodeId FOR UPDATE', { replacements: { episodeId }, transaction: t1 });
    const clip = track(clips.createClip(sequelize, clipFor(episodeId, show)));
    await wait(800);
    expect(clip.settled).toBe(false);
    await t1.commit();
    const row = await clip.promise;
    expect(row.episode_id).toBe(episodeId);
  });

  test('a retried clip with the same id is the same row; another upload\'s id is refused; a removed one says so', async () => {
    const { show } = await seedShow();
    const episodeId = await addEpisode(show);
    const clip = clipFor(episodeId, show);
    const first = await clips.createClip(sequelize, clip);
    const again = await clips.createClip(sequelize, clip);
    expect(again.id).toBe(first.id);
    expect((await rows('SELECT count(*)::int AS n FROM episode_raw_clips WHERE id = :id', { id: clip.id }))[0].n).toBe(1);

    const other = { ...clip, s3_key_raw: `episodes/${episodeId}/raw-clips/${uuid()}/original.mp4` };
    await expect(clips.createClip(sequelize, other)).rejects.toMatchObject({ status: 409 });
    const otherEpisode = await addEpisode(show, 2);
    await expect(clips.createClip(sequelize, { ...clip, episode_id: otherEpisode })).rejects.toMatchObject({ status: 409 });
    expect((await rows('SELECT episode_id, s3_key_raw FROM episode_raw_clips WHERE id = :id', { id: clip.id }))[0])
      .toEqual({ episode_id: episodeId, s3_key_raw: clip.s3_key_raw });

    await run('UPDATE episode_raw_clips SET deleted_at = NOW() WHERE id = :id', { id: clip.id });
    await expect(clips.createClip(sequelize, clip)).rejects.toMatchObject({ status: 409 });
  });

  test('a special\'s swap and a transaction locking episode then event (a terms reopen) never deadlock', async () => {
    for (let i = 0; i < 5; i += 1) {
      const { show, arcId } = await seedShow();
      const episodeId = await addEpisode(show, 30 + i);
      const eventId = uuid();
      await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, strictness, cost_coins, used_in_episode_id, canon_consequences, created_at, updated_at)
                 VALUES (:eventId, :show, 'Premiere', 'invite', 'used', 5, 5, 0, :episodeId, '{}'::jsonb, NOW(), NOW())`, { eventId, show, episodeId });
      await run(`INSERT INTO season_specials (id, show_id, arc_id, kind, event_id, episode_id, after_slot_number, locked_at, created_at, updated_at)
                 VALUES (:id, :show, :arcId, 'bonus', :eventId, :episodeId, 4, NOW(), NOW(), NOW())`, { id: uuid(), show, arcId, eventId, episodeId });
      const target = await slotId(arcId, 7);

      // The "reopen": episode first, then (after the swap has begun) the event.
      const t1 = await sequelize.transaction();
      await sequelize.query('SELECT id FROM episodes WHERE id = :episodeId FOR UPDATE', { replacements: { episodeId }, transaction: t1 });
      const swap = track(full.swapIntoSlot(sequelize, show, eventId, target));
      await wait(400);
      let reopenErr = null;
      try {
        await sequelize.query('SELECT id FROM world_events WHERE id = :eventId FOR UPDATE', { replacements: { eventId }, transaction: t1 });
        await t1.commit();
      } catch (err) {
        reopenErr = err;
        await t1.rollback().catch(() => {});
      }
      let swapErr = null;
      await swap.promise.catch((err) => { swapErr = err; });
      expect(reopenErr && isLockConflict(reopenErr) ? reopenErr.original?.code : null).toBeNull();
      expect(swapErr && isLockConflict(swapErr) ? swapErr.original?.code : null).toBeNull();
      expect(swapErr).toBeNull();
      expect(await slotRow(target)).toMatchObject({ episode_id: episodeId });
      expect((await episodeRow(episodeId)).season_context.label).toBe('S1 · E7');
    }
  });

  test('a started special\'s move to the next season and a transaction locking episode then event (a terms reopen) never deadlock', async () => {
    for (let i = 0; i < 5; i += 1) {
      const { show, arcId } = await seedShow();
      const arc2 = uuid();
      await run(`INSERT INTO show_arcs (id, show_id, arc_number, title, season_number, episode_start, episode_end, phases, current_phase, status, created_at, updated_at)
                 VALUES (:arc2, :show, 2, 'Season 2', 2, 1, 24, '[]'::jsonb, 1, 'planned', NOW(), NOW())`, { arc2, show });
      await slots.ensureSeasonSlots(sequelize, { id: arc2, show_id: show, season_number: 2, phases: [] });
      const episodeId = await addEpisode(show, 40 + i);
      const eventId = uuid();
      await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, strictness, cost_coins, used_in_episode_id, canon_consequences, created_at, updated_at)
                 VALUES (:eventId, :show, 'Encore', 'invite', 'used', 5, 5, 0, :episodeId, '{}'::jsonb, NOW(), NOW())`, { eventId, show, episodeId });
      await run(`INSERT INTO season_specials (id, show_id, arc_id, kind, event_id, episode_id, after_slot_number, locked_at, created_at, updated_at)
                 VALUES (:id, :show, :arcId, 'bonus', :eventId, :episodeId, 4, NOW(), NOW(), NOW())`, { id: uuid(), show, arcId, eventId, episodeId });

      // The "reopen": episode first, then (after the move has begun) the event.
      const t1 = await sequelize.transaction();
      await sequelize.query('SELECT id FROM episodes WHERE id = :episodeId FOR UPDATE', { replacements: { episodeId }, transaction: t1 });
      const move = track(full.moveToNextSeason(sequelize, show, eventId));
      await wait(400);
      let reopenErr = null;
      try {
        await sequelize.query('SELECT id FROM world_events WHERE id = :eventId FOR UPDATE', { replacements: { eventId }, transaction: t1 });
        await t1.commit();
      } catch (err) {
        reopenErr = err;
        await t1.rollback().catch(() => {});
      }
      let moveErr = null;
      await move.promise.catch((err) => { moveErr = err; });
      expect(reopenErr && isLockConflict(reopenErr) ? reopenErr.original?.code : null).toBeNull();
      expect(moveErr && isLockConflict(moveErr) ? moveErr.original?.code : null).toBeNull();
      expect(moveErr).toBeNull();
      expect(move.value).toMatchObject({ season_number: 2, slot_number: 1, label: 'S2 · E1' });
      expect(await slotRow(await slotId(arc2, 1))).toMatchObject({ episode_id: episodeId });
      expect((await episodeRow(episodeId)).season_context.label).toBe('S2 · E1');
    }
  });

  test('a season edit and an intention save on the same started draft take turns: both land, no deadlock', async () => {
    const { show, episodeId, sid } = await startedSlot();
    const body = { title: 'Season edited', tagline: 'Edited',
      phases: [1, 2, 3].map((n) => ({ title: `Part ${n} edited`, tagline: `Tagline ${n}` })) };
    for (let i = 0; i < 5; i += 1) {
      const results = await Promise.allSettled([
        setup.updateSetup(sequelize, show, body),
        intentions.saveIntention(sequelize, show, sid, { story_purpose: `Round ${i}` }),
      ]);
      for (const r of results) {
        if (r.status === 'rejected') throw r.reason;
      }
    }
    const ctx = (await episodeRow(episodeId)).season_context;
    expect(ctx.story_purpose).toBe('Round 4');
    expect(ctx.phase.title).toBe('Part 1 edited');
  });

  test('Start\'s slot assignment rolls back whole; placing the episode clears its failed setup step', async () => {
    const { show, arcId } = await seedShow();
    const episodeId = await addEpisode(show);
    const sid = await slotId(arcId, 1);
    // The snapshot fails after the slot's UPDATE (its two-part read is the last step before the write).
    jest.spyOn(specials, 'twoPartContext').mockRejectedValueOnce(new Error('snapshot failed'));
    await expect(slots.assignOnStart(sequelize, { showId: show, eventId: null, episodeId })).rejects.toThrow('snapshot failed');
    expect(await slotRow(sid)).toMatchObject({ episode_id: null, locked_at: null });

    // What Start records when the assignment fails (episodeGeneratorService).
    await run(`UPDATE episodes SET setup_status = CAST(:s AS jsonb) WHERE id = :episodeId`, { episodeId, s: JSON.stringify({
      complete: false, steps: { scene_plan: { status: 'complete' }, season_slot: { status: 'failed', reason: 'the episode is in no season slot yet' } },
    }) });
    await slots.placeEpisode(sequelize, show, sid, episodeId);
    const { setup_status: status } = await episodeRow(episodeId);
    expect(status.complete).toBe(true);
    expect(status.steps.season_slot).toEqual({ status: 'complete', placed_from: 'roadmap' });
    expect(status.steps.scene_plan).toEqual({ status: 'complete' });
  });
});
