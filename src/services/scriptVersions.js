'use strict';

/**
 * Script version history (Script tab audit, 2026-10-15: "there's no undo,
 * and Regenerate replaces the whole script"). Each writer that replaces an
 * episode's script keeps the script it replaces first: a save, a lock that
 * saves, and Regenerate. The newest KEEP per episode stay. Keeping a version
 * never stops the save: a failure is logged and the save goes on.
 */

const KEEP = 50;
const SOURCES = new Set(['save', 'lock', 'generate']);

/** Keeps the episode's current script before a writer replaces it. Returns the row, or null. */
async function snapshotScript(models, episode, { source = 'save', userId = null, next = null } = {}) {
  try {
    const { EpisodeScriptVersion } = models || {};
    const text = typeof episode?.script_content === 'string' ? episode.script_content : '';
    if (!EpisodeScriptVersion || !episode?.id || !text.trim()) return null;
    // Nothing is replaced when the next script is the same text.
    if (typeof next === 'string' && next === text) return null;
    const last = await EpisodeScriptVersion.findOne({ where: { episode_id: episode.id }, order: [['created_at', 'DESC']] });
    if (last && last.script_content === text) return last;
    const row = await EpisodeScriptVersion.create({
      episode_id: episode.id,
      script_content: text,
      script_locked_beats: Array.isArray(episode.script_locked_beats) ? episode.script_locked_beats : [],
      source: SOURCES.has(source) ? source : 'save',
      created_by: userId ? String(userId).slice(0, 255) : null,
    });
    const older = await EpisodeScriptVersion.findAll({
      where: { episode_id: episode.id }, order: [['created_at', 'DESC']], offset: KEEP, attributes: ['id'],
    });
    if (older.length) await EpisodeScriptVersion.destroy({ where: { id: older.map((o) => o.id) }, force: true });
    return row;
  } catch (err) {
    console.error('[ScriptVersions] could not keep the replaced script (the save goes on):', err.message);
    return null;
  }
}

// A version as the list shows it: when, what replaced it, and its first words.
const summary = (v) => {
  const text = String(v.script_content || '');
  const firstLine = text.split('\n').map((l) => l.trim()).find((l) => l && !/^\[/.test(l) && !/^##\s*BEAT:/i.test(l)) || '';
  return {
    id: v.id,
    created_at: v.created_at,
    source: v.source,
    created_by: v.created_by,
    beats: (text.match(/^[ \t]*##\s*BEAT:/gim) || []).length,
    length: text.length,
    preview: firstLine.slice(0, 120),
  };
};

/** The episode's kept versions, newest first, without their text. */
async function listVersions(models, episodeId) {
  const rows = await models.EpisodeScriptVersion.findAll({
    where: { episode_id: episodeId }, order: [['created_at', 'DESC']], limit: KEEP,
  });
  return rows.map(summary);
}

/** One kept version with its text, or null. */
async function getVersion(models, episodeId, versionId) {
  const v = await models.EpisodeScriptVersion.findOne({ where: { id: versionId, episode_id: episodeId } });
  return v ? { ...summary(v), script_content: v.script_content, script_locked_beats: v.script_locked_beats || [] } : null;
}

module.exports = { snapshotScript, listVersions, getVersion, KEEP };
