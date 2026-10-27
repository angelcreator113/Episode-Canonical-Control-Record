'use strict';

/**
 * Script version history (Script tab audit, 2026-10-15: "there's no undo,
 * and Regenerate replaces the whole script"). Each writer that replaces an
 * episode's script keeps the script it replaces first: a save, a lock that
 * saves, a restore, and every writer that drafts or regenerates the script.
 * Every script writer keeps it through services/scriptSave.js, strictly (A1c
 * R1, ruling N2): a failure to keep it fails the save. Called without
 * `strict`, a failure is logged and the caller goes on.
 *
 * Sources: 'save' (Save on the Script tab), 'lock' (a lock that saves),
 * 'restore' (a save of a version put back from History: the script it
 * replaced), and 'generate' (Regenerate, the Script Writer, the skeleton
 * writers, an event injected into the script).
 *
 * Kept per episode (History audit, 2026-10-24: many Saves pushed the script
 * from before a Regenerate out of the list), by family: the newest KEEP of
 * save, lock and restore, and separately the newest KEEP_GENERATED of
 * 'generate'. A list shows at most KEEP + KEEP_GENERATED.
 */

const KEEP = 50;
const KEEP_GENERATED = 10;
const SOURCES = new Set(['save', 'lock', 'restore', 'generate']);
const GENERATED = ['generate'];

/**
 * Retention reference providers (design R4.5). Each names the versions of an
 * episode that a stored record still needs; prune() never deletes them, past
 * the limits or not. A provider returns ids (strings) and must read only its
 * own tables. Once no record needs a version, the limits apply to it again.
 *   voice-studio approvals: the version an approval in force, or one of its
 *     re-confirmations, was pinned to (services/voiceStudioService.js).
 */
const REFERENCE_PROVIDERS = [
  { name: 'voice-studio approvals', ids: (sequelize, episodeId, t) => require('./voiceStudioService').referencedScriptVersionIds(sequelize, episodeId, t) },
];

/** The ids of the episode's versions some stored record needs (every provider's). */
async function referencedVersionIds(sequelize, episodeId, transaction = null) {
  const ids = new Set();
  for (const provider of REFERENCE_PROVIDERS) {
    for (const id of await provider.ids(sequelize, episodeId, transaction)) ids.add(String(id));
  }
  return ids;
}

/** Drops an episode's versions past the newest `keep` of the given sources, except those a record needs. */
async function prune(EpisodeScriptVersion, episodeId, sources, keep, transaction) {
  const { Op } = require('sequelize');
  const where = { episode_id: episodeId, source: sources.include ? { [Op.in]: sources.include } : { [Op.notIn]: sources.exclude } };
  const older = await EpisodeScriptVersion.findAll({
    where, order: [['created_at', 'DESC'], ['id', 'DESC']], offset: keep, attributes: ['id'], transaction,
  });
  if (!older.length) return;
  const { sequelize } = EpisodeScriptVersion;
  let needed;
  try {
    // In a savepoint: a provider that fails leaves the save's transaction usable.
    needed = transaction
      ? await sequelize.transaction({ transaction }, (sp) => referencedVersionIds(sequelize, episodeId, sp))
      : await referencedVersionIds(sequelize, episodeId, null);
  } catch (err) {
    // Not knowing what is needed, nothing is dropped this time; the save goes on.
    console.error('[ScriptVersions] references not read; no version pruned:', err.message);
    return;
  }
  const drop = older.map((o) => o.id).filter((id) => !needed.has(String(id)));
  if (drop.length) await EpisodeScriptVersion.destroy({ where: { id: drop }, force: true, transaction });
}

/**
 * The id of the episode's newest kept version, or null when it has none: what
 * a record pins to know the script has not been saved since (every save that
 * changes the text keeps the text it replaces, so the newest id moves on).
 * Ordered as snapshotScript finds the last version, with the id breaking ties.
 */
async function newestVersionId(sequelize, episodeId, transaction = null) {
  const [found] = await sequelize.query(`SELECT id FROM episode_script_versions
    WHERE episode_id = :episodeId AND deleted_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 1`, { replacements: { episodeId }, transaction });
  return found[0] ? String(found[0].id) : null;
}

/**
 * Keeps the episode's current script before a writer replaces it. Returns
 * the row, or null. With `transaction`, the version is written inside it,
 * in a savepoint, so a failure to keep it never aborts the writer's update.
 *
 * `strict` (A1c R1, Evoni, 2026-10-27, ruling N2: text and its history save
 * atomically): a failure to keep the version is thrown, so the writer's
 * whole transaction rolls back and nothing is saved. Every script writer
 * calls this through services/scriptSave.js with strict set.
 *
 * Retention contract (design R4.5): only prune() deletes version rows, and
 * it keeps every version a reference provider names (REFERENCE_PROVIDERS).
 * A feature that adds a durable reference (a column, an id in JSON, an
 * external asset record mirrored here) adds its provider, in the same PR
 * (tests/unit/guards/scriptWriteGuard.test.js holds the allowlist).
 */
async function snapshotScript(models, episode, { source = 'save', userId = null, next = null, transaction = null, strict = false } = {}) {
  const { EpisodeScriptVersion } = models || {};
  const text = typeof episode?.script_content === 'string' ? episode.script_content : '';
  if (!EpisodeScriptVersion || !episode?.id || !text.trim()) return null;
  // Nothing is replaced when the next script is the same text.
  if (typeof next === 'string' && next === text) return null;
  const keep = async (t) => {
    const last = await EpisodeScriptVersion.findOne({
      where: { episode_id: episode.id }, order: [['created_at', 'DESC']], attributes: ['id', 'script_content'], transaction: t,
    });
    if (last && last.script_content === text) return last;
    const kind = SOURCES.has(source) ? source : 'save';
    const row = await EpisodeScriptVersion.create({
      episode_id: episode.id,
      script_content: text,
      script_locked_beats: Array.isArray(episode.script_locked_beats) ? episode.script_locked_beats : [],
      source: kind,
      created_by: userId ? String(userId).slice(0, 255) : null,
    }, { transaction: t });
    if (GENERATED.includes(kind)) await prune(EpisodeScriptVersion, episode.id, { include: GENERATED }, KEEP_GENERATED, t);
    else await prune(EpisodeScriptVersion, episode.id, { exclude: GENERATED }, KEEP, t);
    return row;
  };
  // Strict: inside the writer's transaction, so a failure rolls it all back.
  if (strict) return keep(transaction);
  try {
    if (!transaction) return await keep(null);
    // A savepoint: a failed insert rolls back to here, not the writer's update.
    return await EpisodeScriptVersion.sequelize.transaction({ transaction }, (sp) => keep(sp));
  } catch (err) {
    console.error('[ScriptVersions] could not keep the replaced script (the save goes on):', err.message);
    return null;
  }
}

// The list's first words and beat count, read in the database so a list
// never loads 60 whole scripts (History audit H10, 2026-10-24). They match
// what summary() reads from the text: the preview is the first line that,
// trimmed, is not empty, a [tag] or a `## BEAT:` header; beats counts the
// lines that open `## BEAT:` (any case); length counts UTF-16 units, as
// JavaScript's String length does (a character past U+FFFF counts two).
const PREVIEW_SQL = String.raw`left(substring("EpisodeScriptVersion"."script_content" from '(?in)^[[:space:]]*((?!##[ \t\r\f\v]*BEAT:)[^[:space:][][^\n]*)$'), 400)`;
const BEATS_SQL = String.raw`(SELECT count(*)::int FROM regexp_matches("EpisodeScriptVersion"."script_content", '(?:^|[\r\u2028\u2029])[ \t]*##[[:space:]]*BEAT:', 'gin'))`;
const LENGTH_SQL = String.raw`(char_length("EpisodeScriptVersion"."script_content") + (SELECT count(*)::int FROM regexp_matches("EpisodeScriptVersion"."script_content", '[\U00010000-\U0010FFFF]', 'g')))`;

// A version as the list shows it: when, what replaced it, and its first words.
// `restore` is true when the version is the script a restore from History
// replaced (source 'restore').
const summary = (v) => {
  const text = String(v.script_content || '');
  const firstLine = text.split('\n').map((l) => l.trim()).find((l) => l && !/^\[/.test(l) && !/^##\s*BEAT:/i.test(l)) || '';
  return {
    id: v.id,
    created_at: v.get ? v.get('createdAt') : (v.createdAt ?? v.created_at),
    source: v.source,
    created_by: v.created_by,
    restore: v.source === 'restore',
    beats: (text.match(/^[ \t]*##\s*BEAT:/gim) || []).length,
    length: text.length,
    preview: firstLine.slice(0, 120),
  };
};

/** The episode's kept versions, newest first, without their text. */
async function listVersions(models, episodeId) {
  const { sequelize } = models.EpisodeScriptVersion;
  const rows = await models.EpisodeScriptVersion.findAll({
    where: { episode_id: episodeId }, order: [['created_at', 'DESC']], limit: KEEP + KEEP_GENERATED,
    attributes: ['id', 'source', 'created_by', 'createdAt',
      [sequelize.literal(PREVIEW_SQL), 'preview_line'],
      [sequelize.literal(BEATS_SQL), 'beat_count'],
      [sequelize.literal(LENGTH_SQL), 'text_length']],
  });
  return rows.map((v) => ({
    id: v.id,
    created_at: v.get('createdAt'),
    source: v.source,
    created_by: v.created_by,
    restore: v.source === 'restore',
    beats: Number(v.get('beat_count')) || 0,
    length: Number(v.get('text_length')) || 0,
    preview: String(v.get('preview_line') || '').trim().slice(0, 120),
  }));
}

/** One kept version with its text, or null. */
async function getVersion(models, episodeId, versionId) {
  const v = await models.EpisodeScriptVersion.findOne({ where: { id: versionId, episode_id: episodeId } });
  return v ? { ...summary(v), script_content: v.script_content, script_locked_beats: v.script_locked_beats || [] } : null;
}

/** True when `versionId` is a kept version of the episode. */
async function isEpisodeVersion(models, episodeId, versionId, transaction = null) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(versionId || ''))) return false;
  const v = await models.EpisodeScriptVersion.findOne({ where: { id: versionId, episode_id: episodeId }, attributes: ['id'], transaction });
  return Boolean(v);
}

module.exports = {
  snapshotScript, listVersions, getVersion, isEpisodeVersion, summary, newestVersionId, referencedVersionIds,
  REFERENCE_PROVIDERS, KEEP, KEEP_GENERATED, SOURCES,
};
