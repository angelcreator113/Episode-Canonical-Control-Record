'use strict';

/**
 * The flag log (Character Consistency Engine, the spec's Future Enhancement
 * #4: "log every flag, even resolved ones. Over time this becomes a map of
 * where the generator breaks most often, so improvement is targeted, not
 * guesswork"; Evoni, 2026-10-17). One consistency_flag_log row per
 * character, source and flag id, kept after the flag is resolved.
 *
 *   logCheck(db, character, result, { source })  after a check runs
 *     (services/characterConsistency checkCharacter: on the character page
 *     and across the cast): each flag it raised is open (seen once more);
 *     each one marked intentional is intentional; an open one it no longer
 *     raises is gone (the text changed). Never throws.
 *   markFixed(db, characterId, flagId)    Fix or Edit the text resolved it
 *   markIntentional(db, characterId, flagId, on)
 *   flagLogSummary(db, registryIds) → { totals, by_check, by_field,
 *     by_character }: how many flags each check and each field has raised,
 *     open and resolved, most first.
 */

const STATUSES = ['open', 'fixed', 'gone', 'intentional'];
const TOP = 10;

const upsertSql = (status) => `
  INSERT INTO consistency_flag_log (registry_character_id, registry_id, source, flag_id, check_key, field, field_label, found, expected, status, resolved_at)
  VALUES (:cid, :reg, :source, :fid, :check, :field, :label, :found, :expected, '${status}', ${status === 'open' ? 'NULL' : 'NOW()'})
  ON CONFLICT (registry_character_id, source, flag_id) DO UPDATE SET
    times_seen = consistency_flag_log.times_seen + 1,
    last_seen_at = NOW(),
    found = EXCLUDED.found,
    expected = EXCLUDED.expected,
    field_label = EXCLUDED.field_label,
    status = '${status}',
    resolved_at = ${status === 'open' ? 'NULL' : 'COALESCE(consistency_flag_log.resolved_at, NOW())'},
    deleted_at = NULL,
    updated_at = NOW()`;

const clip = (v, n) => (v === null || v === undefined ? null : String(v).slice(0, n));

async function logCheck(db, character, result, { source = 'check' } = {}) {
  try {
    const seen = [];
    const write = async (flag, status) => {
      seen.push(flag.id);
      await db.sequelize.query(upsertSql(status), { replacements: {
        cid: character.id, reg: character.registry_id || null, source, fid: flag.id, check: clip(flag.check, 40),
        field: clip(flag.field, 255), label: clip(flag.field_label, 255), found: clip(flag.found, 2000), expected: clip(flag.expected, 2000),
      } });
    };
    for (const f of result?.flags || []) await write(f, 'open');
    for (const f of result?.intentional || []) await write(f, 'intentional');
    await db.sequelize.query(
      `UPDATE consistency_flag_log SET status = 'gone', resolved_at = NOW(), updated_at = NOW()
        WHERE registry_character_id = :cid AND source = :source AND status = 'open' AND deleted_at IS NULL
          ${seen.length ? 'AND flag_id NOT IN (:seen)' : ''}`,
      { replacements: { cid: character.id, source, seen } });
  } catch (err) {
    console.error(`[flagLog] the check of ${character?.id} could not be logged:`, err.message);
  }
}

async function setStatus(db, characterId, flagId, status, { from = null } = {}) {
  try {
    await db.sequelize.query(
      `UPDATE consistency_flag_log SET status = :status, resolved_at = ${status === 'open' ? 'NULL' : 'NOW()'}, updated_at = NOW()
        WHERE registry_character_id = :cid AND flag_id = :fid AND source = 'check' ${from ? 'AND status = :from' : ''}`,
      { replacements: { cid: characterId, fid: String(flagId), status, from } });
  } catch (err) {
    console.error(`[flagLog] flag ${flagId} of ${characterId} could not be marked ${status}:`, err.message);
  }
}

const markFixed = (db, characterId, flagId) => setStatus(db, characterId, flagId, 'fixed', { from: 'open' });
const markIntentional = (db, characterId, flagId, on) => setStatus(db, characterId, flagId, on ? 'intentional' : 'open');

async function flagLogSummary(db, registryIds) {
  const counts = `COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE l.status = 'open')::int AS open,
    COUNT(*) FILTER (WHERE l.status IN ('fixed', 'gone'))::int AS resolved,
    COUNT(*) FILTER (WHERE l.status = 'intentional')::int AS intentional`;
  const where = 'l.registry_id IN (:ids) AND l.deleted_at IS NULL';
  const q = async (sql) => (await db.sequelize.query(sql, { replacements: { ids: registryIds } }))[0];
  const [totals] = await q(`SELECT ${counts} FROM consistency_flag_log l WHERE ${where}`);
  const byCheck = await q(`SELECT l.check_key, ${counts} FROM consistency_flag_log l WHERE ${where}
    GROUP BY l.check_key ORDER BY total DESC, l.check_key`);
  const byField = await q(`SELECT COALESCE(l.field_label, l.field, 'unknown') AS field, ${counts} FROM consistency_flag_log l WHERE ${where}
    GROUP BY 1 ORDER BY total DESC, 1 LIMIT ${TOP}`);
  const byCharacter = await q(`SELECT l.registry_character_id AS id, COALESCE(rc.selected_name, rc.display_name) AS name, ${counts}
      FROM consistency_flag_log l LEFT JOIN registry_characters rc ON rc.id = l.registry_character_id
     WHERE ${where} GROUP BY 1, 2 ORDER BY total DESC, 2 LIMIT ${TOP}`);
  return { totals, by_check: byCheck, by_field: byField, by_character: byCharacter };
}

module.exports = { logCheck, markFixed, markIntentional, flagLogSummary, STATUSES };
