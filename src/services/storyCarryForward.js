'use strict';

/**
 * Episode 1 feeds Episode 2 (Evoni, 2026-10-23: approved plan "from a
 * finished script to the story to the next episode", PR 4). What an episode's
 * saved "What changed" card holds goes forward:
 *   - the writers of the next episode (the script writers through
 *     episodeScriptWriterService loadScriptContext, the slot drafter in
 *     seasonIntentionService, the season proposals in seasonArcProposals and
 *     the episode brief in episodeGeneratorService) read the last approved
 *     record: what happened, the relationships that moved, what is left open,
 *     and what Lala still owes people;
 *   - Start Episode adds the show's open follow-ups to the new episode's
 *     to-do list as goals (task_source 'goal', with follow_up_id), so they
 *     show in its to-do list, its Script tab "must cover" list and its What
 *     changed card. Ticking one there marks the follow-up done in that
 *     episode; one left open carries on to the episode after.
 *
 *   lastRecord(sequelize, showId, { before })          the latest approved record of an episode numbered below `before`
 *   openFollowUps(sequelize, showId, { before })        the show's open follow-ups, oldest first
 *   carryBlock({ record, followUps })                   both as prompt text; '' with neither
 *   carryForEpisode(sequelize, episodeId)               the block for an episode's writers
 *   carryForShow(sequelize, showId, { before })         the block before an episode number (or the latest)
 *   carriedGoalTasks(sequelize, showId, { before })     the open follow-ups as to-do goal tasks (at most MAX_CARRIED)
 *   settleFollowUps(sequelize, tasks, { episodeId, transaction })  follow-ups of completed tasks done here; reopened when unticked
 *
 * Raw SQL (episode_story_records, show_follow_ups); every read returns
 * empty before the migrations have run, so nothing that calls it breaks.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Start Episode carries at most this many follow-ups, the oldest first, so
// the to-do list is not taken over by what is owed.
const MAX_CARRIED = 3;
const MAX = { what: 1200, items: 8, field: 240 };

const parse = (v, fallback) => {
  if (v === null || v === undefined) return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch (err) {
    console.error('[storyCarryForward] unreadable JSON:', err.message);
    return fallback;
  }
};
const cut = (v, n) => {
  const s = String(v || '').trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};
const kept = (items) => (Array.isArray(items) ? items : []).filter((x) => x && x.keep !== false);
const words = (s) => String(s || '').replace(/_/g, ' ');

/** The latest approved record of an episode numbered below `before` (all episodes when before is null); null with none. */
async function lastRecord(sequelize, showId, { before = null } = {}) {
  if (!UUID_RE.test(String(showId || ''))) return null;
  try {
    const [[row]] = await sequelize.query(
      `SELECT r.what_happened, r.relationships, r.threads, e.episode_number, e.title
         FROM episode_story_records r JOIN episodes e ON e.id = r.episode_id AND e.deleted_at IS NULL
        WHERE e.show_id = :showId AND r.deleted_at IS NULL AND r.status = 'approved'
          ${before != null ? 'AND e.episode_number < :before' : ''}
        ORDER BY e.episode_number DESC NULLS LAST, r.approved_at DESC LIMIT 1`,
      { replacements: { showId, before } });
    if (!row) return null;
    return {
      episode_number: row.episode_number, title: row.title || '', what_happened: row.what_happened || '',
      relationships: kept(parse(row.relationships, [])), threads: kept(parse(row.threads, [])),
    };
  } catch (err) {
    console.error('[storyCarryForward] the last record could not be read:', err.message);
    return null;
  }
}

/** The show's open follow-ups from episodes numbered below `before`, oldest first. */
async function openFollowUps(sequelize, showId, { before = null } = {}) {
  if (!UUID_RE.test(String(showId || ''))) return [];
  try {
    const [rows] = await sequelize.query(
      `SELECT f.id, f.text, f.due_hint, f.profile_id, f.registry_character_id, f.from_episode_id, e.episode_number
         FROM show_follow_ups f LEFT JOIN episodes e ON e.id = f.from_episode_id
        WHERE f.show_id = :showId AND f.status = 'open' AND f.deleted_at IS NULL
          ${before != null ? 'AND (e.episode_number IS NULL OR e.episode_number < :before)' : ''}
        ORDER BY f.created_at`, { replacements: { showId, before } });
    return rows;
  } catch (err) {
    console.error('[storyCarryForward] open follow-ups could not be read:', err.message);
    return [];
  }
}

/** The last record and the open follow-ups as the writers read them; '' with neither. */
function carryBlock({ record = null, followUps = [] } = {}) {
  const lines = [];
  if (record) {
    lines.push(`═══ LAST EPISODE'S STORY (Episode ${record.episode_number ?? '?'}${record.title ? `, "${record.title}"` : ''}; approved) ═══`);
    if (record.what_happened) lines.push(`What happened: ${cut(record.what_happened, MAX.what)}`);
    const rels = record.relationships.slice(0, MAX.items);
    if (rels.length) {
      lines.push('Relationships, where they stand now:');
      for (const r of rels) {
        const kind = r.is_romantic ? 'love interest' : words(r.type);
        const stage = r.stage_after ? `, now ${words(r.stage_after)}${r.stage_before ? ` (was ${words(r.stage_before)})` : ''}` : '';
        lines.push(`- ${r.a_name || '?'} and ${r.b_name || '?'}${kind ? `: ${kind}` : ''}${stage}${r.note ? `. ${cut(r.note, MAX.field)}` : ''}`);
      }
    }
    const open = record.threads.filter((t) => t.action !== 'close').slice(0, MAX.items);
    if (open.length) {
      lines.push('Left open:');
      for (const t of open) lines.push(`- ${cut(t.title, MAX.field)}${t.note ? `: ${cut(t.note, MAX.field)}` : ''}`);
    }
  }
  const owed = followUps.slice(0, MAX.items);
  if (owed.length) {
    lines.push(record ? 'What Lala still owes people:' : '═══ WHAT LALA STILL OWES PEOPLE ═══');
    for (const f of owed) lines.push(`- ${cut(f.text, MAX.field)}${f.due_hint ? ` (due: ${f.due_hint})` : ''}${f.episode_number ? ` (from episode ${f.episode_number})` : ''}`);
  }
  if (!lines.length) return '';
  lines.push('CONTINUITY DIRECTIVE: carry this on. Relationships continue from where they stand and are never reset; pick up at least one open thread or follow-up; never contradict what happened.');
  return `${lines.join('\n')}\n`;
}

/** The block for an episode's writers: the record before it and what is still owed; '' with none. */
async function carryForEpisode(sequelize, episodeId) {
  if (!UUID_RE.test(String(episodeId || ''))) return '';
  try {
    const [[episode]] = await sequelize.query(
      'SELECT show_id, episode_number FROM episodes WHERE id = :episodeId AND deleted_at IS NULL', { replacements: { episodeId } });
    if (!episode?.show_id) return '';
    const before = episode.episode_number ?? null;
    return carryBlock({
      record: await lastRecord(sequelize, episode.show_id, { before }),
      followUps: await openFollowUps(sequelize, episode.show_id, { before }),
    });
  } catch (err) {
    console.error('[storyCarryForward] the carry-forward could not be read:', err.message);
    return '';
  }
}

/** The block for a show, before an episode number (or from the latest record when null). */
async function carryForShow(sequelize, showId, { before = null } = {}) {
  return carryBlock({
    record: await lastRecord(sequelize, showId, { before }),
    followUps: await openFollowUps(sequelize, showId, { before }),
  });
}

/**
 * The open follow-ups as to-do goal tasks for a new episode. A goal, so the
 * to-do list, the Script tab and the What changed card read it as one;
 * follow_up_id says which follow-up it settles, profile_id who it is with.
 */
async function carriedGoalTasks(sequelize, showId, { before = null } = {}) {
  const rows = (await openFollowUps(sequelize, showId, { before })).slice(0, MAX_CARRIED);
  return rows.map((f) => ({
    slot: `follow_up_${f.id}`,
    label: cut(f.text, 160),
    description: [f.episode_number ? `Carried from episode ${f.episode_number}` : 'Carried from an earlier episode', f.due_hint ? `due: ${f.due_hint}` : null].filter(Boolean).join(' · '),
    platform: 'story',
    timing: 'during',
    required: false,
    completed: false,
    task_source: 'goal',
    follow_up_id: f.id,
    ...(f.profile_id != null ? { profile_id: Number(f.profile_id) } : {}),
  }));
}

/**
 * The follow-ups behind a list's carried tasks: a completed one is done in
 * this episode; one unticked again opens, if this episode had done it.
 */
async function settleFollowUps(sequelize, tasks, { episodeId, transaction = null } = {}) {
  const carried = (Array.isArray(tasks) ? tasks : []).filter((t) => t && UUID_RE.test(String(t.follow_up_id || '')));
  if (!carried.length || !UUID_RE.test(String(episodeId || ''))) return { done: [], reopened: [] };
  const done = carried.filter((t) => t.completed).map((t) => t.follow_up_id);
  const open = carried.filter((t) => !t.completed).map((t) => t.follow_up_id);
  const opts = (replacements) => ({ replacements, ...(transaction ? { transaction } : {}) });
  try {
    let doneRows = [];
    let openRows = [];
    if (done.length) {
      [doneRows] = await sequelize.query(
        `UPDATE show_follow_ups SET status = 'done', done_episode_id = :episodeId, updated_at = NOW()
          WHERE id IN (:ids) AND status = 'open' AND deleted_at IS NULL RETURNING id`, opts({ ids: done, episodeId }));
    }
    if (open.length) {
      [openRows] = await sequelize.query(
        `UPDATE show_follow_ups SET status = 'open', done_episode_id = NULL, updated_at = NOW()
          WHERE id IN (:ids) AND status = 'done' AND done_episode_id = :episodeId AND deleted_at IS NULL RETURNING id`, opts({ ids: open, episodeId }));
    }
    return { done: doneRows.map((r) => r.id), reopened: openRows.map((r) => r.id) };
  } catch (err) {
    // Inside a transaction the caller's own write fails with it; outside one
    // the tick stands and the follow-up stays as it was.
    console.error('[storyCarryForward] follow-ups could not be settled:', err.message);
    if (transaction) throw err;
    return { done: [], reopened: [] };
  }
}

module.exports = {
  MAX_CARRIED, lastRecord, openFollowUps, carryBlock, carryForEpisode, carryForShow, carriedGoalTasks, settleFollowUps,
};
