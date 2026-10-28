'use strict';

/**
 * The one way an episode's script is written (architecture A1c R1, Evoni,
 * 2026-10-27; docs/reads/2026-10-27-a1c-r1-spec.md). Every writer (the
 * Script tab's Save and Approve, Restore, the generators, event inject)
 * calls saveEpisodeScript, which in one transaction:
 *   1. locks the episode row (SELECT ... FOR UPDATE) and reads it whole,
 *      script_line_keys included;
 *   2. refuses a row that has line identities (LINE_IDENTITY_ACTIVE): R1
 *      and R2 never change identity data, and none exists yet;
 *   3. checks the client's script revision (utils/scriptRevision.js), or the
 *      revision a server writer took when it started;
 *   4. checks the overwrite guard, under the lock, when the writer has one;
 *   5. builds the text to save with the writer's own rule (`compose`, given
 *      the locked row: locked beats kept as each writer keeps them today);
 *   6. tells a genuine restore (the server's own copy of the version) from
 *      an edited one (an ordinary save);
 *   7. keeps the replaced script as a version, strictly: a failure rolls the
 *      whole save back (ruling N2);
 *   8. writes script_content (and the locks, for Approve) in one update.
 *      script_line_keys is never written (IDENTITY_WRITES is off in R1);
 *   9. when the text changed, adds one to episodes.script_seq, the script's
 *      save number (decisions 1 and 2, 2026-10-27): under the row lock, so
 *      it only goes up and no two saves share one. A lock-only save leaves it.
 * After the commit it logs the identity plan as counts only
 * (services/identityPlanLog.js). A refusal throws ScriptSaveError, which
 * sendScriptSaveError turns into its HTTP answer.
 */

const { scriptRevision, isRevision } = require('../utils/scriptRevision');
const { scriptOverwriteBlocked, scriptOverwriteRefusalBody } = require('../utils/scriptOverwriteGuard');

// A1c R1: line identities are computed for the log only, never stored. R3
// turns this on for every writer at once (design R4.4).
const IDENTITY_WRITES = false;

class ScriptSaveError extends Error {
  constructor(status, body) {
    super(body?.error || body?.code || 'script save refused');
    this.name = 'ScriptSaveError';
    this.status = status;
    this.body = body;
  }
}

/** Throws the refusal `code` with an actionable message and extra fields. */
function refuse(status, code, message, extra = {}) {
  throw new ScriptSaveError(status, { success: false, code, error: message, ...extra });
}

const MESSAGES = {
  revisionRequired: 'This page is out of date. Reload to see the current script: your unsaved text is kept in this browser, and the page offers it back. If this browser doesn\'t keep drafts, copy your text first.',
  changed: 'This script changed since you opened it. Nothing was saved. Load the newer script (your text is kept as a draft) or compare the two.',
  changedDuringWrite: 'The script changed while this one was being written, so it was not saved over the newer script. The new draft is shown, unsaved.',
  identityActive: 'Line identities are active for this episode, and this version of the app can\'t change its script safely. Nothing was saved.',
};

const keysOf = (row) => (row?.get ? row.get('script_line_keys') : row?.script_line_keys) ?? null;

/** The revision of a loaded episode row (or a plain object with the same fields). */
function revisionOf(row) {
  return scriptRevision(row?.script_content, keysOf(row));
}

/** The episode's script revision as stored now, or null when there is no episode. */
async function readScriptRevision(models, episodeId, { transaction = null } = {}) {
  const row = await models.Episode.unscoped().findByPk(episodeId, {
    attributes: ['id', 'script_content', 'script_line_keys'], transaction,
  });
  return row ? revisionOf(row) : null;
}

/**
 * Adds one to the episode's script save number and returns it as a decimal
 * string: it is a BIGINT, past what a JavaScript number holds exactly, so it
 * is never turned into one (compare it as text). Called only by the save,
 * inside its transaction, on the row it holds FOR UPDATE.
 */
async function nextScriptSeq(sequelize, episodeId, t) {
  const [found] = await sequelize.query('UPDATE episodes SET script_seq = script_seq + 1 WHERE id = :episodeId RETURNING script_seq::text AS script_seq',
    { replacements: { episodeId }, transaction: t });
  const seq = found[0] ? found[0].script_seq : null;
  if (typeof seq !== 'string' || !/^[0-9]+$/.test(seq)) throw new Error('saveEpisodeScript: the script save number was not advanced');
  return seq;
}

/** The text a version restores to, by the same rule the Script tab uses to put it on the page. */
function restoredText(row, versionText) {
  const { keepLockedBeats, scriptKeepingLocks } = require('../utils/scriptBeatLocks');
  const onPage = keepLockedBeats(versionText, row.script_content, row.script_locked_beats).script;
  return scriptKeepingLocks(row, onPage, { keepExtras: true }).script;
}

/**
 * Saves an episode's script. opts:
 *   writer:          'W1'..'W10', for the log;
 *   source:          'save' | 'lock' | 'restore' | 'generate' (the version source);
 *   compose(row, t): returns { script, kept?, moved?, lockedBeats? } for the
 *                    locked row; may throw a refusal (refuse());
 *   revision, requireRevision: a client writer's token, and whether it is
 *                    required (every client script write, D6/P2);
 *   expectRevision:  a server writer's revision taken when it started (N3);
 *   guard:           a request body for the overwrite guard, checked under the lock;
 *   skipIfScript:    leave an episode that already has a script as it is;
 *   restoredFrom:    the version a Save names (Restore);
 *   userId, transaction (the caller's, when it writes other rows with this).
 * Returns { episode, skipped, script_content, script_revision, script_seq
 *   (the new save number as a decimal string, or null when the text did
 *   not change),
 *   locked_beats_kept, locked_beats_moved, version_source, previous_content }.
 */
async function saveEpisodeScript(models, episodeId, opts = {}) {
  const {
    writer = 'unknown', source = 'save', compose, revision, requireRevision = false,
    expectRevision = null, guard = null, skipIfScript = false, restoredFrom = null,
    userId = null, transaction = null,
  } = opts;
  if (typeof compose !== 'function') throw new Error('saveEpisodeScript: compose is required');
  const { Episode } = models;

  const run = async (t) => {
    const row = await Episode.unscoped().findByPk(episodeId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!row) refuse(404, 'EPISODE_NOT_FOUND', 'Episode not found');
    if (keysOf(row) != null) refuse(409, 'LINE_IDENTITY_ACTIVE', MESSAGES.identityActive);

    const current = revisionOf(row);
    if (requireRevision) {
      if (!isRevision(revision)) refuse(409, 'SCRIPT_REVISION_REQUIRED', MESSAGES.revisionRequired, { current_revision: current });
      if (revision !== current) refuse(409, 'SCRIPT_CHANGED', MESSAGES.changed, { current_revision: current });
    }
    if (skipIfScript && String(row.script_content || '').trim()) {
      return { episode: row, skipped: true, script_content: row.script_content, script_revision: current };
    }
    if (guard && scriptOverwriteBlocked(row.script_content, guard)) {
      throw new ScriptSaveError(409, scriptOverwriteRefusalBody());
    }

    const previous = typeof row.script_content === 'string' ? row.script_content : '';
    const composed = await compose(row, t);
    if (!composed || typeof composed.script !== 'string') throw new Error('saveEpisodeScript: compose returned no script');
    if (expectRevision && expectRevision !== current) {
      refuse(409, 'SCRIPT_CHANGED', MESSAGES.changedDuringWrite, { current_revision: current, draft: composed.script, saved: false });
    }

    let script = composed.script;
    let versionSource = source;
    if (restoredFrom != null) {
      // A genuine restore saves the server's own copy of the version. A
      // version edited after it was put back is an ordinary save of the
      // page's text (Evoni, 2026-10-27).
      versionSource = 'save';
      const { isEpisodeVersion } = require('./scriptVersions');
      if (await isEpisodeVersion(models, row.id, restoredFrom, t)) {
        const version = await models.EpisodeScriptVersion.findOne({ where: { id: restoredFrom, episode_id: row.id }, attributes: ['id', 'script_content'], transaction: t });
        const authoritative = version ? restoredText(row, version.script_content) : null;
        if (authoritative !== null && authoritative === script) { script = authoritative; versionSource = 'restore'; }
      }
    }

    const { snapshotScript } = require('./scriptVersions');
    await snapshotScript(models, row, { source: versionSource, userId, next: script, transaction: t, strict: true });
    // The text only when it changed: a lock alone leaves a NULL script NULL, as before.
    const update = {};
    if (script !== previous) update.script_content = script;
    if (Array.isArray(composed.lockedBeats)) update.script_locked_beats = composed.lockedBeats;
    if (Object.keys(update).length) await row.update(update, { transaction: t });
    const scriptSeq = update.script_content !== undefined ? await nextScriptSeq(Episode.sequelize, row.id, t) : null;
    return {
      episode: row,
      skipped: false,
      script_content: script,
      script_revision: scriptRevision(script, null),
      script_seq: scriptSeq,
      locked_beats_kept: composed.kept || [],
      locked_beats_moved: composed.moved || [],
      version_source: versionSource,
      previous_content: previous,
      extra: composed.extra,
    };
  };

  // After the commit, and never able to fail the save it describes.
  const logAfter = (result) => {
    if (!result || result.skipped) return;
    try {
      const { logIdentityPlan } = require('./identityPlanLog');
      logIdentityPlan({ episodeId, writer, source: result.version_source, state: 'unkeyed', prevText: result.previous_content, nextText: result.script_content });
    } catch (err) {
      console.error(`[line-identity-plan] not logged (the save stands): ${err?.name || 'Error'}`);
    }
  };

  if (transaction) {
    const result = await run(transaction);
    if (typeof transaction.afterCommit === 'function') transaction.afterCommit(() => logAfter(result));
    return result;
  }
  const result = await Episode.sequelize.transaction((t) => run(t));
  logAfter(result);
  return result;
}

/** Answers a ScriptSaveError; returns false for any other error. */
function sendScriptSaveError(res, err) {
  if (!(err instanceof ScriptSaveError)) return false;
  res.status(err.status).json(err.body);
  return true;
}

module.exports = {
  saveEpisodeScript, readScriptRevision, revisionOf, refuse, sendScriptSaveError, ScriptSaveError,
  IDENTITY_WRITES, MESSAGES,
};
