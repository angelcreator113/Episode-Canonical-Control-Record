'use strict';

/**
 * Camera Roll rollback containment (#3714, Tier 1): the accepted rev 2.1
 * design (Evoni, 2026-11-07), made operational. Maintenance only: nothing in
 * src/, the Deploy workflow or application start-up loads it. The command
 * line is scripts/maintenance/camera-roll-containment.js; the procedure is
 * docs/runbooks/deploy-workflow.md, "Rolling back past the Camera Roll
 * make-safety release".
 *
 * Why: code from before #3739 makes the paid image request before writing
 * anything and does not know the 'making' / 'uncertain' states, so after a
 * code rollback it could pay again for a photo that may already be paid for.
 * Every way that code reads a camera-roll photo skips rows with deleted_at set
 * (the model is paranoid; raw queries filter deleted_at IS NULL). Containment
 * soft-deletes exactly the at-risk photos, records each one, and can restore
 * them exactly.
 *
 *   status(sequelize)                         read-only
 *   contain(sequelize, { opId, by, approvalRef, dryRun })
 *   restore(sequelize, { opId, by, dryRun })
 *
 * Safeguards (the rev 2.1 requirements):
 *   1. The deletion guard is installed and verified before any photo is
 *      hidden, in the same transaction; a crash rolls all of it back.
 *   2. Guard installation, logging and hiding are one atomic transaction.
 *   3. The guard stays while any photo, from any operation, is contained.
 *   4. status() reports unsafe when photos are contained and a guard is
 *      missing or disabled; the runbook treats that as a hard stop.
 *   5. While a photo is contained, its character, event, episode and post
 *      cannot be deleted (soft or hard): one trigger function on each of
 *      registry_characters, world_events, episodes and feed_posts.
 *   6. Restore is per photo: a photo whose character or a parent it names is
 *      gone stays contained and is reported; the others are restored.
 *   7. Privileged SQL (superuser, session_replication_role = replica,
 *      DISABLE TRIGGER, DROP TRIGGER) is outside this protection.
 *   8. Production permissions are checked by status() (privileges block)
 *      before any production use.
 *
 * The marker lives in make_resolution.containment, only on rows whose
 * deleted_at is set; pre-#3739 code does not declare make_resolution and so
 * can never write it. Restore revives a row only while its deleted_at is still
 * that operation's exact fence time, under a row lock, so a legitimately
 * deleted photo, or one deleted again by anyone, is never revived.
 *
 * Writes go to data_correction_log (append-only; one row per photo; undo is
 * the only allowed change), which the application role cannot use: run this
 * with the migration login.
 */

const AT_RISK = `m.deleted_at IS NULL AND (
    m.status IN ('making', 'uncertain')
    OR (m.status = 'dropped' AND m.make_resolution ? 'abandoned')
    OR (m.make_attempted_at IS NOT NULL AND m.status <> 'made'))`;

const GUARD_FN = 'public.camera_roll_containment_event_guard';
const GUARD_TRIGGER = 'camera_roll_containment_event_guard';

// Every parent a photo names, in the fixed order every lock is taken in.
// column: the camera_roll_moments column that points at the parent.
const PARENTS = [
  { table: 'episodes', column: 'episode_id', gone: 'episode_gone' },
  { table: 'feed_posts', column: 'post_id', gone: 'post_gone' },
  { table: 'registry_characters', column: 'character_id', gone: 'character_gone' },
  { table: 'world_events', column: 'event_id', gone: 'event_gone' },
];

const OP_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{2,99}$/;

class DryRunRollback extends Error {
  constructor(result) { super('dry run: rolled back'); this.result = result; }
}

// One function for every parent table; TG_TABLE_NAME picks the photo column.
// Refuses a parent's deletion (soft or hard) while a contained photo names it.
async function installGuard(q) {
  await q(`CREATE OR REPLACE FUNCTION ${GUARD_FN}() RETURNS trigger LANGUAGE plpgsql
    SET search_path = pg_catalog, pg_temp AS $fn$
    DECLARE col text;
    BEGIN
      col := CASE TG_TABLE_NAME
        WHEN 'world_events' THEN 'event_id'
        WHEN 'registry_characters' THEN 'character_id'
        WHEN 'episodes' THEN 'episode_id'
        WHEN 'feed_posts' THEN 'post_id'
      END;
      IF col IS NULL THEN
        RAISE EXCEPTION 'camera-roll containment guard is not meant for table %', TG_TABLE_NAME;
      END IF;
      IF (TG_OP = 'DELETE' OR (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)) THEN
        PERFORM 1 FROM public.camera_roll_moments m
          WHERE m.make_resolution ? 'containment'
            AND (CASE col WHEN 'event_id' THEN m.event_id WHEN 'character_id' THEN m.character_id
                          WHEN 'episode_id' THEN m.episode_id ELSE m.post_id END) = OLD.id
          LIMIT 1;
        IF FOUND THEN
          RAISE EXCEPTION '% % is used by a camera-roll photo under rollback containment; restore it first', TG_TABLE_NAME, OLD.id
            USING ERRCODE = '23503';
        END IF;
      END IF;
      IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
      RETURN NEW;
    END $fn$`);
  for (const { table } of PARENTS) {
    await q(`DROP TRIGGER IF EXISTS ${GUARD_TRIGGER} ON public.${table}`);
    await q(`CREATE TRIGGER ${GUARD_TRIGGER} BEFORE UPDATE OF deleted_at OR DELETE ON public.${table}
             FOR EACH ROW EXECUTE FUNCTION ${GUARD_FN}()`);
  }
}

// Tables whose guard trigger is present and enabled.
async function guardedTables(q) {
  const rows = await q(`SELECT c.relname AS t FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE tg.tgname = '${GUARD_TRIGGER}' AND n.nspname = 'public' AND tg.tgenabled <> 'D'`);
  return rows.map((r) => r.t).sort();
}

async function guardComplete(q) {
  const have = await guardedTables(q);
  return PARENTS.every(({ table }) => have.includes(table));
}

// Blocks every parent deletion for the rest of the transaction. Same order
// everywhere, so contain and restore cannot deadlock each other.
async function lockParents(q) {
  for (const { table } of PARENTS) await q(`LOCK TABLE public.${table} IN SHARE ROW EXCLUSIVE MODE`);
}

async function goneParents(q, ids) {
  if (!ids.length) return [];
  const rows = await q(`SELECT m.id,
      (rc.id IS NULL OR rc.deleted_at IS NOT NULL) AS character_gone,
      (m.event_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM world_events e WHERE e.id = m.event_id AND e.deleted_at IS NULL)) AS event_gone,
      (m.episode_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM episodes ep WHERE ep.id = m.episode_id AND ep.deleted_at IS NULL)) AS episode_gone,
      (m.post_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM feed_posts p WHERE p.id = m.post_id AND p.deleted_at IS NULL)) AS post_gone
    FROM camera_roll_moments m LEFT JOIN registry_characters rc ON rc.id = m.character_id
    WHERE m.id IN (:ids) ORDER BY m.id`, { ids });
  return rows.map((r) => ({ id: r.id, missing: PARENTS.map((p) => p.gone).filter((k) => r[k]) }))
    .filter((r) => r.missing.length);
}

// The privileges a write operation needs, for the current login (read-only).
async function privileges(q) {
  const checks = [
    ['camera_roll_moments', 'SELECT'], ['camera_roll_moments', 'UPDATE'],
    ['data_correction_log', 'SELECT'], ['data_correction_log', 'INSERT'], ['data_correction_log', 'UPDATE'],
    ['character_registries', 'SELECT'],
    ...PARENTS.flatMap(({ table }) => [[table, 'SELECT'], [table, 'UPDATE'], [table, 'TRIGGER']]),
  ];
  const out = {};
  for (const [table, priv] of checks) {
    const [{ ok }] = await q(`SELECT has_table_privilege('public.${table}', '${priv}') AS ok`);
    out[`${table}.${priv}`] = ok;
  }
  // DROP TRIGGER (contain re-installs, restore removes) needs the table's
  // owner role, not only the TRIGGER privilege.
  for (const { table } of PARENTS) {
    const [{ ok }] = await q(`SELECT pg_has_role(c.relowner, 'MEMBER') AS ok FROM pg_class c WHERE c.oid = 'public.${table}'::regclass`);
    out[`${table}.OWNER`] = ok;
  }
  const [{ ok: createFn }] = await q("SELECT has_schema_privilege('public', 'CREATE') AS ok");
  out['schema public.CREATE'] = createFn;
  return out;
}

const queryFor = (sequelize, transaction) => (sql, replacements = {}) => sequelize.query(sql, {
  replacements, transaction, type: sequelize.QueryTypes.SELECT,
});

// What is contained right now, whether the guard is complete, and whether the
// current login could run a write (read-only).
async function status(sequelize) {
  return sequelize.transaction(async (transaction) => {
    const q = queryFor(sequelize, transaction);
    await q('SET TRANSACTION READ ONLY');
    const [{ n }] = await q("SELECT count(*)::int AS n FROM camera_roll_moments WHERE make_resolution ? 'containment'");
    const [{ atRisk }] = await q(`SELECT count(*)::int AS "atRisk" FROM camera_roll_moments m WHERE ${AT_RISK}`);
    const guarded = await guardedTables(q);
    const complete = PARENTS.every(({ table }) => guarded.includes(table));
    const ops = await q(`SELECT make_resolution->'containment'->>'id' AS id, count(*)::int AS n
      FROM camera_roll_moments WHERE make_resolution ? 'containment' GROUP BY 1 ORDER BY 1`);
    return {
      contained: n, atRisk, operations: ops, guardedTables: guarded, guardComplete: complete,
      unsafe: n > 0 && !complete, privileges: await privileges(q),
    };
  });
}

async function contain(sequelize, { opId, by, approvalRef, dryRun = true }) {
  if (!OP_ID.test(String(opId || ''))) throw new Error('opId must match the correction_key format');
  if (!dryRun && !(String(by || '').trim() && String(approvalRef || '').trim())) {
    throw new Error('a write needs both by and approvalRef');
  }
  return sequelize.transaction(async (transaction) => {
    const q = queryFor(sequelize, transaction);
    // 1. Block parent deletion for the whole transaction, then install the
    //    guard and check it is complete BEFORE any photo is hidden. A deletion
    //    that started earlier finishes first (we wait for its lock); any later
    //    one waits for this commit and then meets the trigger. A crash rolls
    //    all of it back.
    await lockParents(q);
    if (!dryRun) {
      await installGuard(q);
      if (!(await guardComplete(q))) throw new Error('the deletion guard is not complete; nothing was hidden');
    }
    const rows = await q(`
      SELECT m.id, m.status, cr.show_id
        FROM camera_roll_moments m
        JOIN registry_characters rc ON rc.id = m.character_id
        JOIN character_registries cr ON cr.id = rc.registry_id
       WHERE ${AT_RISK}
       ORDER BY m.id
       FOR UPDATE OF m`);
    const [{ unjoinable }] = await q(`SELECT count(*)::int AS unjoinable FROM camera_roll_moments m
      WHERE ${AT_RISK} AND NOT EXISTS (SELECT 1 FROM registry_characters rc JOIN character_registries cr ON cr.id = rc.registry_id WHERE rc.id = m.character_id)`);
    if (unjoinable) throw new Error(`refusing: ${unjoinable} at-risk photo(s) have no character registry to log under; nothing was hidden`);
    const noShow = rows.filter((r) => !r.show_id);
    if (noShow.length) throw new Error(`refusing: ${noShow.length} at-risk photo(s) have no show to log under: ${noShow.map((r) => r.id).join(', ')}`);
    const parentsGone = await goneParents(q, rows.map((r) => r.id));
    if (dryRun || !rows.length) {
      return { opId, dryRun, fenced: rows.map((r) => ({ id: r.id, status: r.status })), parentsAlreadyGone: parentsGone };
    }
    const [{ fence_at: fenceAt }] = await q('SELECT clock_timestamp() AS fence_at');
    for (const r of rows) {
      await q(`INSERT INTO data_correction_log (correction_key, show_id, record_table, record_id, field, before_value, after_value, approved_by, approval_ref)
               VALUES (:opId, :show, 'camera_roll_moments', :id, 'deleted_at', 'null'::jsonb, to_jsonb(CAST(:fenceAt AS timestamptz)), :by, :ref)
               ON CONFLICT DO NOTHING RETURNING id`,
      { opId, show: r.show_id, id: r.id, fenceAt, by, ref: approvalRef });
    }
    const updated = await q(`
      UPDATE camera_roll_moments
         SET deleted_at = CAST(:fenceAt AS timestamptz),
             make_resolution = jsonb_set(COALESCE(make_resolution, '{}'::jsonb), '{containment}',
               jsonb_build_object('id', CAST(:opId AS TEXT), 'at', CAST(:fenceAt AS TEXT), 'by', CAST(:by AS TEXT), 'prior_deleted_at', NULL))
       WHERE id IN (:ids) AND deleted_at IS NULL
       RETURNING id, status`, { fenceAt, opId, by, ids: rows.map((r) => r.id) });
    return { opId, dryRun, fenceAt, fenced: updated, parentsAlreadyGone: parentsGone };
  });
}

async function restore(sequelize, { opId, by, dryRun = true }) {
  if (!OP_ID.test(String(opId || ''))) throw new Error('opId must match the correction_key format');
  if (!dryRun && !String(by || '').trim()) throw new Error('a write needs by');
  try {
    return await sequelize.transaction(async (transaction) => {
      const q = queryFor(sequelize, transaction);
      // The same locks contain() takes first, before anything is read, so a
      // containment cannot commit between the count below and a guard drop.
      await lockParents(q);
      const marked = await q(`
        SELECT m.id, m.deleted_at, m.make_resolution->'containment'->>'at' AS fence_at
          FROM camera_roll_moments m
         WHERE m.make_resolution->'containment'->>'id' = :opId
         ORDER BY m.id
         FOR UPDATE OF m`, { opId });
      const atFence = (r) => r.deleted_at && new Date(r.deleted_at).getTime() === new Date(r.fence_at).getTime();
      const gone = await goneParents(q, marked.filter(atFence).map((r) => r.id));
      const goneById = new Map(gone.map((g) => [g.id, g.missing]));
      const restorable = marked.filter((r) => atFence(r) && !goneById.has(r.id));
      const blocked = gone;
      const deletedAgain = marked.filter((r) => !atFence(r)).map((r) => r.id);
      const restored = restorable.length ? await q(`
        UPDATE camera_roll_moments
           SET deleted_at = NULL, make_resolution = make_resolution - 'containment'
         WHERE id IN (:ids) AND deleted_at = CAST(:fence AS timestamptz)
           AND make_resolution->'containment'->>'id' = :opId
         RETURNING id, status`, { ids: restorable.map((r) => r.id), fence: restorable[0].fence_at, opId }) : [];
      if (restored.length) {
        await q(`UPDATE data_correction_log SET undone_at = NOW(), undone_by = :by
                  WHERE correction_key = :opId AND record_table = 'camera_roll_moments' AND record_id IN (:ids) AND undone_at IS NULL
                  RETURNING id`, { opId, by: by || null, ids: restored.map((r) => r.id) }); // the log's trigger records session_user
      }
      // The guard stays while any photo, from any operation, is still contained.
      const [{ n }] = await q("SELECT count(*)::int AS n FROM camera_roll_moments WHERE make_resolution ? 'containment'");
      let guardRemoved = false;
      if (n === 0) {
        for (const { table } of PARENTS) await q(`DROP TRIGGER IF EXISTS ${GUARD_TRIGGER} ON public.${table}`);
        await q(`DROP FUNCTION IF EXISTS ${GUARD_FN}()`);
        guardRemoved = true;
      }
      const result = { opId, dryRun, restored, blocked, deletedAgain, stillContained: n, guardRemoved };
      if (dryRun) throw new DryRunRollback(result);
      return result;
    });
  } catch (err) {
    if (err instanceof DryRunRollback) return err.result;
    throw err;
  }
}

module.exports = { contain, restore, status, AT_RISK, PARENTS, GUARD_TRIGGER, GUARD_FN, OP_ID };
