'use strict';

/**
 * Deliverables on The Pulse (Evoni, 2026-10-18: "brand deals ... are
 * currently pointing at Instagram, TikTok, and all those, when now we only
 * have things that Lalaverse has"; "merge tiktok into pulse video"; "yes it
 * can name private accounts"). src/utils/deliverableFormats.js holds the
 * new list; this renames what is already stored. Fees are not touched, so a
 * deal already agreed pays what it agreed.
 *
 * 1. event_deliverables:
 *      instagram_reel, tiktok_video → pulse_video
 *      instagram_post               → pulse_post
 *      instagram_stories            → pulse_stories
 *    A description that is the old label ("Instagram Stories (×3)", "Link in
 *    bio (7 days)", a drafted row's) takes the new one ("Pulse stories
 *    (×3)", "Profile link (7 days)"). The platform becomes the account:
 *    instagram, tiktok and youtube are The Pulse ('pulse'); a typed row with
 *    none (other than UGC) is put on The Pulse too.
 * 2. The drafted copies in world_events.canon_consequences.automation
 *    .drafted_values.deliverables are rewritten the same way, so a row that
 *    read "Auto-drafted" still does.
 * 3. deal_rate_anchors, every version: reel → pulse_video, stories_3 →
 *    pulse_stories_3, instagram_post → pulse_post; tiktok_video's rows are
 *    soft-deleted (a Pulse video is priced at the Reel's anchor).
 * 4. episode_todo_lists.tasks and .social_tasks, and the event's own copy
 *    (world_events.canon_consequences.automation.social_tasks): a task on
 *    instagram, tiktok or youtube is on 'pulse'.
 *
 * down: the type, label and anchor renames are undone (pulse_video becomes
 * instagram_reel; which ones were TikTok videos is not kept), accounts
 * become instagram, the tiktok_video anchors are restored. Tasks keep
 * 'pulse'.
 *
 * Guarded: each step is skipped when its table is absent.
 */

const TYPE_MAP = {
  instagram_reel: 'pulse_video',
  tiktok_video: 'pulse_video',
  instagram_post: 'pulse_post',
  instagram_stories: 'pulse_stories',
};
// Each type's old label → its new one (a description is relabelled when it
// is the old label, alone or with its "(×N)" / "(N days)").
const LABELS = {
  instagram_reel: ['Instagram Reel', 'Pulse video'],
  tiktok_video: ['TikTok video', 'Pulse video'],
  instagram_post: ['Instagram post', 'Pulse post'],
  instagram_stories: ['Instagram Stories', 'Pulse stories'],
  carousel_post: ['Carousel post', 'Pulse carousel'],
  go_live: ['Go Live', 'Pulse live'],
  link_in_bio: ['Link in bio', 'Profile link'],
};
const ANCHOR_MAP = { reel: 'pulse_video', stories_3: 'pulse_stories_3', instagram_post: 'pulse_post' };
const REAL_APPS = ['instagram', 'tiktok', 'youtube'];
const NO_ACCOUNT = ['ugc'];

const tableExists = async (sequelize, table, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${table}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

function parseJson(value, where) {
  if (value == null) return null;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error(`[migration 20261018130000] ${where} JSON parse failed; row left as it is:`, err.message);
    return null;
  }
}

function relabel(description, from, to) {
  if (typeof description !== 'string') return description;
  if (description === from) return to;
  if (description.startsWith(`${from} (`) && description.endsWith(')')) return `${to}${description.slice(from.length)}`;
  return description;
}

/** The up rewrite of one row or record ({ type, platform, description }); returns the new fields, or null. */
function upFields({ type, platform, description }) {
  const newType = TYPE_MAP[type] || type;
  const known = Boolean(LABELS[type]) || ['grwm_video', 'try_on_haul', 'ugc', 'other', 'pulse_video', 'pulse_post', 'pulse_stories'].includes(type);
  if (!known) return null;
  let newPlatform = platform;
  if (REAL_APPS.includes(platform)) newPlatform = 'pulse';
  else if (platform == null && !NO_ACCOUNT.includes(newType)) newPlatform = 'pulse';
  const newDescription = LABELS[type] ? relabel(description, LABELS[type][0], LABELS[type][1]) : description;
  if (newType === type && newPlatform === platform && newDescription === description) return null;
  return { type: newType, platform: newPlatform, description: newDescription };
}

/** The down rewrite: back to the D15 keys and labels, accounts as instagram. */
function downFields({ type, platform, description }) {
  const back = { pulse_video: 'instagram_reel', pulse_post: 'instagram_post', pulse_stories: 'instagram_stories' };
  const oldType = back[type] || type;
  const labels = LABELS[oldType];
  if (!labels && !['grwm_video', 'try_on_haul', 'other'].includes(type)) return null;
  const oldPlatform = ['pulse', 'pulse_private', 'playroom'].includes(platform) ? 'instagram' : platform;
  const oldDescription = labels ? relabel(description, labels[1], labels[0]) : description;
  if (oldType === type && oldPlatform === platform && oldDescription === description) return null;
  return { type: oldType, platform: oldPlatform, description: oldDescription };
}

async function rewriteRows(sequelize, transaction, fieldsFor) {
  if (!(await tableExists(sequelize, 'event_deliverables', transaction))) return 0;
  const [rows] = await sequelize.query(
    'SELECT id, deliverable_type, platform, description FROM event_deliverables WHERE deliverable_type IS NOT NULL',
    { transaction });
  let changed = 0;
  for (const row of rows) {
    const next = fieldsFor({ type: row.deliverable_type, platform: row.platform, description: row.description });
    if (!next) continue;
    await sequelize.query(
      'UPDATE event_deliverables SET deliverable_type = :type, platform = :platform, description = :description WHERE id = :id',
      { replacements: { ...next, id: row.id }, transaction });
    changed += 1;
  }
  return changed;
}

async function rewriteDraftedRecords(sequelize, transaction, fieldsFor) {
  if (!(await tableExists(sequelize, 'world_events', transaction))) return 0;
  const [events] = await sequelize.query(
    `SELECT id, canon_consequences FROM world_events
      WHERE canon_consequences::text LIKE '%drafted_values%' AND canon_consequences::text LIKE '%deliverables%'`,
    { transaction });
  let changed = 0;
  for (const ev of events) {
    const cc = parseJson(ev.canon_consequences, `world_events ${ev.id}`);
    const records = cc?.automation?.drafted_values?.deliverables;
    if (!records || typeof records !== 'object') continue;
    let touched = false;
    for (const record of Object.values(records)) {
      if (!record || typeof record !== 'object') continue;
      const next = fieldsFor({ type: record.type, platform: record.platform ?? null, description: record.description });
      if (!next) continue;
      record.type = next.type;
      // A record written before D15 had no platform; it compares only what it has.
      if (record.platform !== undefined || next.platform !== null) record.platform = next.platform;
      if (record.description !== undefined) record.description = next.description;
      touched = true;
    }
    if (!touched) continue;
    await sequelize.query('UPDATE world_events SET canon_consequences = :cc WHERE id = :id',
      { replacements: { cc: JSON.stringify(cc), id: ev.id }, transaction });
    changed += 1;
  }
  return changed;
}

async function rewriteTasks(sequelize, transaction) {
  if (!(await tableExists(sequelize, 'episode_todo_lists', transaction))) return 0;
  const [cols] = await sequelize.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'episode_todo_lists' AND column_name IN ('tasks', 'social_tasks')`,
    { transaction });
  let changed = 0;
  for (const { column_name: col } of cols) {
    const [rows] = await sequelize.query(
      `SELECT id, ${col} AS list FROM episode_todo_lists
        WHERE ${col}::text ~ '"platform": ?"(instagram|tiktok|youtube)"'`,
      { transaction });
    for (const row of rows) {
      const list = parseJson(row.list, `episode_todo_lists ${row.id}.${col}`);
      if (!Array.isArray(list)) continue;
      let touched = false;
      for (const task of list) {
        if (task && typeof task === 'object' && REAL_APPS.includes(task.platform)) {
          task.platform = 'pulse';
          touched = true;
        }
      }
      if (!touched) continue;
      await sequelize.query(`UPDATE episode_todo_lists SET ${col} = :list WHERE id = :id`,
        { replacements: { list: JSON.stringify(list), id: row.id }, transaction });
      changed += 1;
    }
  }
  return changed;
}

/** The event's own copy of its tasks (canon_consequences.automation.social_tasks). */
async function rewriteEventTasks(sequelize, transaction) {
  if (!(await tableExists(sequelize, 'world_events', transaction))) return 0;
  const [events] = await sequelize.query(
    `SELECT id, canon_consequences FROM world_events
      WHERE canon_consequences::text LIKE '%social_tasks%'
        AND canon_consequences::text ~ '"platform": ?"(instagram|tiktok|youtube)"'`,
    { transaction });
  let changed = 0;
  for (const ev of events) {
    const cc = parseJson(ev.canon_consequences, `world_events ${ev.id}`);
    const list = cc?.automation?.social_tasks;
    if (!Array.isArray(list)) continue;
    let touched = false;
    for (const task of list) {
      if (task && typeof task === 'object' && REAL_APPS.includes(task.platform)) {
        task.platform = 'pulse';
        touched = true;
      }
    }
    if (!touched) continue;
    await sequelize.query('UPDATE world_events SET canon_consequences = :cc WHERE id = :id',
      { replacements: { cc: JSON.stringify(cc), id: ev.id }, transaction });
    changed += 1;
  }
  return changed;
}

module.exports = {
  TYPE_MAP,
  ANCHOR_MAP,

  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, transaction });
      const rows = await rewriteRows(sequelize, transaction, upFields);
      console.log(`[migration 20261018130000] event_deliverables on The Pulse: ${rows} row(s)`);
      const events = await rewriteDraftedRecords(sequelize, transaction, upFields);
      console.log(`[migration 20261018130000] drafted deliverable records rewritten on ${events} event(s)`);
      if (await tableExists(sequelize, 'deal_rate_anchors', transaction)) {
        for (const [from, to] of Object.entries(ANCHOR_MAP)) {
          await q('UPDATE deal_rate_anchors SET component = :to, updated_at = NOW() WHERE component = :from', { from, to });
        }
        await q(`UPDATE deal_rate_anchors SET deleted_at = NOW(), updated_at = NOW()
                  WHERE component = 'tiktok_video' AND deleted_at IS NULL`);
      }
      const lists = await rewriteTasks(sequelize, transaction);
      const eventTasks = await rewriteEventTasks(sequelize, transaction);
      console.log(`[migration 20261018130000] task lists on The Pulse: ${lists}; events' own task copies: ${eventTasks}`);
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, transaction });
      if (await tableExists(sequelize, 'deal_rate_anchors', transaction)) {
        await q(`UPDATE deal_rate_anchors SET deleted_at = NULL, updated_at = NOW()
                  WHERE component = 'tiktok_video' AND deleted_at IS NOT NULL`);
        for (const [from, to] of Object.entries(ANCHOR_MAP)) {
          await q('UPDATE deal_rate_anchors SET component = :from, updated_at = NOW() WHERE component = :to', { from, to });
        }
      }
      await rewriteDraftedRecords(sequelize, transaction, downFields);
      await rewriteRows(sequelize, transaction, downFields);
    });
  },
};
