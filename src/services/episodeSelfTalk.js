'use strict';

/**
 * Her self-talk at Beat 13 (Evoni, 2026-10-25: "Yes build the goals and
 * stress script work"): how Lala talks to herself in the Recap Panel, Hard
 * on herself, Honest or Kind, chosen on the Script tab.
 *
 * Kept on the episode's brief as event_metadata.self_talk = { tone, at, by }
 * (no migration: event_metadata is an existing JSONB column, and the Script
 * tab's cover marks live beside it). Only that key is written, with the row
 * locked. The writers read it (episodeScriptWriterService.loadScriptContext)
 * so Beat 13 is written in that tone, and Complete reads it for the stress
 * change (evaluationFormula.selfTalkStressDelta). No choice saved is null:
 * the writers use Honest, and Complete changes nothing.
 */

const { selfTalkTone } = require('../utils/evaluationFormula');

function parseMeta(meta) {
  if (typeof meta !== 'string') return meta && typeof meta === 'object' ? meta : {};
  try { return JSON.parse(meta) || {}; } catch (err) {
    console.error('[SelfTalk] event_metadata unreadable:', err.message);
    return {};
  }
}

/** The saved tone in a brief's event_metadata, or null. */
function toneOf(eventMetadata) {
  return selfTalkTone(parseMeta(eventMetadata)?.self_talk?.tone);
}

/** The episode's saved tone ('hard' | 'honest' | 'kind'), or null with none. */
async function readSelfTalk(sequelize, episodeId, { transaction } = {}) {
  const [brief] = await sequelize.query(
    'SELECT event_metadata FROM episode_briefs WHERE episode_id = :episodeId AND deleted_at IS NULL LIMIT 1',
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT, ...(transaction ? { transaction } : {}) });
  return brief ? toneOf(brief.event_metadata) : null;
}

/**
 * Save (or, with tone null, take back) the episode's choice. Returns the
 * saved { tone, at, by } or null when taken back; undefined when the episode
 * has no brief.
 */
async function saveSelfTalk(sequelize, episodeId, tone, by = null) {
  return sequelize.transaction(async (transaction) => {
    const [brief] = await sequelize.query(
      'SELECT id FROM episode_briefs WHERE episode_id = :episodeId AND deleted_at IS NULL LIMIT 1 FOR UPDATE',
      { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT, transaction });
    if (!brief) return undefined;
    if (tone === null) {
      await sequelize.query(
        `UPDATE episode_briefs SET event_metadata = COALESCE(event_metadata, '{}'::jsonb) - 'self_talk', updated_at = NOW() WHERE id = :id`,
        { replacements: { id: brief.id }, transaction });
      return null;
    }
    const value = { tone, at: new Date().toISOString(), by };
    await sequelize.query(
      `UPDATE episode_briefs
          SET event_metadata = jsonb_set(COALESCE(event_metadata, '{}'::jsonb), '{self_talk}', CAST(:value AS jsonb)), updated_at = NOW()
        WHERE id = :id`,
      { replacements: { value: JSON.stringify(value), id: brief.id }, transaction });
    return value;
  });
}

module.exports = { toneOf, readSelfTalk, saveSelfTalk };
