'use strict';

/**
 * The Place lock (Evoni's ruling L13, 2026-10-02; docs/EVENT_EPISODE_FLOW.md
 * §8(hh)): "an event's Place section (scene set choice, venue look,
 * Generate this look) stays editable while its episode is a draft, even
 * after Start Episode; only the terms lock at Start Episode. It locks when
 * the episode is accepted."
 *
 * Which episode (Foundation A; Evoni, 2026-11-23: "an event is locked when
 * ANY canonically linked live episode is accepted. Include primary,
 * non-primary and two-part-special relationships."): every live episode the
 * event is linked to (eventEpisodeLink.linkedLiveEpisodes: the episode it is
 * stamped on, and every live episode with a live brief naming it). One of
 * them accepted: locked. No live linked episode: not locked.
 *
 * Until then the rule asked one episode only (the newest live brief's, else
 * the stamped one). That episode is always one of the linked ones, so this
 * rule locks wherever that one did, and in three more states:
 *   - a two-part special with one part accepted and the other not;
 *   - an event stamped on an accepted episode while a draft's brief names it;
 *   - an event whose newest brief is a draft's while an older brief's
 *     episode is accepted.
 *
 * isPlaceLocked is a read. Without the locks below it says what was true
 * when it ran: an acceptance can commit a moment later.
 *
 * finalizePlaceWrite is how a write that must not land on a locked Place is
 * committed (after paid generation, for one). No route calls it yet.
 */

const PLACE_LOCKED_CODE = 'PLACE_LOCKED';
const PLACE_LOCKED_MESSAGE = "This event's episode is accepted: its Place is locked";

async function isPlaceLocked(sequelize, eventId, { transaction } = {}) {
  const { linkedLiveEpisodes } = require('./eventEpisodeLink');
  const episodes = await linkedLiveEpisodes(sequelize, eventId, { transaction });
  return episodes.some((e) => e.evaluation_status === 'accepted');
}

// What finalizePlaceWrite resolves: `outcome` is one of these, and `code` is
// the same word (the Place lock's and the deleted event's are the codes the
// routes already answer with).
const PLACE_FINALIZE_OUTCOMES = Object.freeze({
  OK: 'OK',
  PLACE_LOCKED: PLACE_LOCKED_CODE,
  STALE_SOURCE_SET: 'STALE_SOURCE_SET',
  EVENT_DELETED: 'EVENT_DELETED',
  RETRY_EXHAUSTED: 'PLACE_FINALIZE_RETRY_EXHAUSTED',
});
const PLACE_FINALIZE_MAX_ATTEMPTS = 3;
const STALE_SOURCE_SET_MESSAGE = "This event's scene set changed while this was being made. Nothing was saved over the newer choice.";
const RETRY_EXHAUSTED_MESSAGE = 'This could not be saved: the event or its episode was busy on every try. Nothing was saved.';

const sameSet = (a, b) => String(a ?? '') === String(b ?? '');
const TIMEOUT_RE = /^\d{1,6}(ms|s)$/;

async function rollBack(transaction) {
  if (!transaction || transaction.finished) return;
  try {
    await transaction.rollback();
  } catch (err) {
    console.error('[placeLock] the finalization could not be rolled back:', err.message);
  }
}

/**
 * One attempt, in one transaction. Resolves { result } (final) or
 * { retry: reason }; a non-retryable error is thrown after the rollback.
 */
async function attemptPlaceFinalize(sequelize, eventId, { sourceSetId, work, lockTimeout }) {
  const { linkedLiveEpisodes, lockLiveEvent, EVENT_DELETED_CODE } = require('./eventEpisodeLink');
  const { lockEpisodes, holdsEpisode, asRetryable, RetryableConflictError } = require('./episodeLocks');
  const O = PLACE_FINALIZE_OUTCOMES;
  const transaction = await sequelize.transaction();
  try {
    // a. The linked episodes, read without a lock.
    const before = (await linkedLiveEpisodes(sequelize, eventId, { transaction })).map((e) => String(e.id));
    // b. Episodes first, in id order (inside lockEpisodes), FOR SHARE: an
    //    acceptance (FOR UPDATE, or a bare UPDATE) takes turns with this,
    //    while an event-first writer's foreign-key check (FOR KEY SHARE on
    //    the episode) does not wait on it.
    await lockEpisodes(sequelize, before, { transaction, mode: 'share' });
    // c. lockEpisodes sets no timeout when there is nothing to lock: the
    //    wait for the event row below must be bounded too.
    await sequelize.query(`SET LOCAL lock_timeout = '${lockTimeout}'`, { transaction });
    // d. Then the event row.
    let event;
    try {
      event = await lockLiveEvent(sequelize, eventId, { transaction });
    } catch (err) {
      if (err?.code !== EVENT_DELETED_CODE) throw err;
      await rollBack(transaction);
      return { result: { outcome: O.EVENT_DELETED, code: O.EVENT_DELETED, message: err.message } };
    }
    // e. A link that appeared since (a): its episode is not held, and
    //    locking it now would be event-first. Start again.
    const after = await linkedLiveEpisodes(sequelize, eventId, { transaction });
    if (after.some((e) => !holdsEpisode(transaction, e.id, { mode: 'any' }))) {
      await rollBack(transaction);
      return { retry: 'EVENT_LINK_CHANGED' };
    }
    // f. The strict rule, under the locks.
    if (await isPlaceLocked(sequelize, eventId, { transaction })) {
      await rollBack(transaction);
      return { result: { outcome: O.PLACE_LOCKED, code: PLACE_LOCKED_CODE, message: PLACE_LOCKED_MESSAGE } };
    }
    // g. The set the work was made for is still the event's.
    const [[row]] = await sequelize.query(
      'SELECT scene_set_id FROM world_events WHERE id = :eventId', { replacements: { eventId }, transaction });
    const sceneSetId = row?.scene_set_id ?? null;
    if (sourceSetId !== undefined && !sameSet(sourceSetId, sceneSetId)) {
      await rollBack(transaction);
      return {
        result: {
          outcome: O.STALE_SOURCE_SET, code: O.STALE_SOURCE_SET, message: STALE_SOURCE_SET_MESSAGE,
          source_set_id: sourceSetId ?? null, scene_set_id: sceneSetId,
        },
      };
    }
    // h. The caller's writes, and the commit.
    const value = await work({ transaction, event: { ...event, scene_set_id: sceneSetId } });
    await transaction.commit();
    return { result: { outcome: O.OK, code: O.OK, value } };
  } catch (err) {
    await rollBack(transaction);
    const retryable = asRetryable(err);
    if (retryable instanceof RetryableConflictError) {
      return { retry: err?.original?.code || err?.parent?.code || retryable.code || 'RETRY' };
    }
    throw err;
  }
}

/**
 * Commits a write to an event's Place only while the Place is not locked,
 * serialised with acceptance (Foundation A; Evoni, 2026-11-23). It knows
 * nothing about generation: it calls no provider and no storage, and it is
 * given only the short database work to commit.
 *
 * Each attempt is one transaction: (a) read the linked live episodes;
 * (b) lock them FOR SHARE in id order; (c) bound the lock wait; (d) lock the
 * event row FOR UPDATE; (e) read the links again, and start over when one is
 * not held; (f) the strict Place lock; (g) when `sourceSetId` is given, the
 * event's scene_set_id must still be it; (h) `work`, then commit.
 *
 *   sourceSetId  the event's scene set when the work began. `undefined`
 *                skips the check; `null` is a real value ("the event had no
 *                set"), and a set chosen since is then stale.
 *   work         async ({ transaction, event }) => value. `event` is the
 *                locked row: { id, used_in_episode_id, deleted_at,
 *                scene_set_id }. EVERY statement in `work` must be given
 *                this transaction (the app has no CLS: a statement without
 *                it runs on another connection, outside the locks, and may
 *                wait on this very transaction). `work` may run more than
 *                once (once per attempt), so it does rollback-safe database
 *                work only: no paid generation, no storage write, no
 *                notification and no other irreversible side effect inside
 *                it (Evoni, 2026-11-23). Nothing slow either: the locks are
 *                held while it runs.
 *   maxAttempts  attempts in all (3). A lock conflict (Postgres 40P01 or
 *                55P03, or a RetryableConflictError) and a link that
 *                changed are tried again, every check repeated; `work` is
 *                called at most once per attempt, and an attempt that did
 *                not commit wrote nothing.
 *   lockTimeout  a test seam: the wait for the event row. It defaults to
 *                episodeLocks.LOCK_TIMEOUT, and no caller should pass it.
 *
 * Resolves { outcome, code, attempts, ... }:
 *   OK                              + value (what `work` returned); committed
 *   PLACE_LOCKED                    + message; `work` was not called
 *   STALE_SOURCE_SET                + message, source_set_id, scene_set_id
 *   EVENT_DELETED                   + message; the event is gone
 *   PLACE_FINALIZE_RETRY_EXHAUSTED  + message, last_conflict; nothing saved
 * The three refusals stop at once. Any other error is thrown after its
 * rollback, with no retry. The caller decides what to answer; nothing here
 * is an HTTP response.
 *
 * It serialises only with writers that lock the episode row or the event
 * row. Run it on its own connection: never inside another transaction.
 */
async function finalizePlaceWrite(sequelize, eventId, { sourceSetId, work, maxAttempts = PLACE_FINALIZE_MAX_ATTEMPTS, lockTimeout } = {}) {
  if (!eventId) throw new Error('finalizePlaceWrite needs an event id');
  if (typeof work !== 'function') throw new Error('finalizePlaceWrite needs work({ transaction, event })');
  const { LOCK_TIMEOUT } = require('./episodeLocks');
  const timeout = lockTimeout === undefined ? LOCK_TIMEOUT : lockTimeout;
  if (!TIMEOUT_RE.test(String(timeout))) throw new Error('finalizePlaceWrite: lockTimeout must look like "10s" or "500ms"');
  const limit = Number.isInteger(maxAttempts) && maxAttempts > 0 ? maxAttempts : PLACE_FINALIZE_MAX_ATTEMPTS;
  let lastConflict = null;
  for (let attempts = 1; attempts <= limit; attempts += 1) {
    const { result, retry } = await attemptPlaceFinalize(sequelize, eventId, { sourceSetId, work, lockTimeout: timeout });
    if (result) return { ...result, attempts };
    lastConflict = retry;
  }
  const O = PLACE_FINALIZE_OUTCOMES;
  return { outcome: O.RETRY_EXHAUSTED, code: O.RETRY_EXHAUSTED, message: RETRY_EXHAUSTED_MESSAGE, attempts: limit, last_conflict: lastConflict };
}

module.exports = {
  PLACE_LOCKED_CODE,
  PLACE_LOCKED_MESSAGE,
  isPlaceLocked,
  PLACE_FINALIZE_OUTCOMES,
  PLACE_FINALIZE_MAX_ATTEMPTS,
  finalizePlaceWrite,
};
