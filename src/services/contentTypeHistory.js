'use strict';

/**
 * A content type that changes over time (Evoni's idea 2, 2026-10-18: "yes
 * start idea 2"): a creator who rebrands ("The Relatable Friend → The
 * Luxury Icon") does it at a moment in the story, for a reason. The change
 * is a fact history entry (character_fact_changes, fact_key
 * 'content_type'; services/factHistory) at the story moment of the show's
 * present, so it shows on their history and the Pulse can tell what they
 * were known for at any moment.
 *
 *   recordContentTypeChange(db, { character, from, to, reason, by, rebrand })
 *     one entry when the type really changed; the show is the character's
 *     registry's. A rebrand (rebrand: true, from one type to another) is
 *     placed at the show's present story moment. A correction, or a first
 *     type for someone who had none, is filling in who they always were: it
 *     has no moment and does not change what they were known for earlier. Never throws (the
 *     change is already saved; a failed record is logged). Returns true
 *     when recorded.
 *   contentTypeAt(db, { profileId, storyOrder })  the type the feed
 *     profile had at that story moment: the one before the first change
 *     placed after it, else their current one. null when they have none.
 *     A post's lane and its content mix are judged by it.
 */

const FACT_KEY = 'content_type';

async function showOf(db, character) {
  const registryId = character?.registry_id;
  if (!registryId) return null;
  const [[row]] = await db.sequelize.query('SELECT show_id FROM character_registries WHERE id = :id', { replacements: { id: registryId } });
  return row?.show_id || null;
}

async function recordContentTypeChange(db, { character, from = null, to = null, reason = null, by = null, rebrand = false }) {
  if (!character?.id || (from || null) === (to || null)) return false;
  try {
    const showId = await showOf(db, character);
    const storyOrder = showId && rebrand && from ? await require('./storyClock').presentOrder(db, showId) : null;
    await db.sequelize.query(
      `INSERT INTO character_fact_changes (registry_character_id, show_id, fact_key, before_value, after_value, reason, story_order, changed_by, source)
       VALUES (:cid, :show, :key, CAST(:from AS jsonb), CAST(:to AS jsonb), :reason, :order, :by, 'fact_sheet')`,
      { replacements: {
        cid: character.id, show: showId, key: FACT_KEY, from: JSON.stringify(from || null), to: JSON.stringify(to || null),
        reason: typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 500) : null,
        order: Number.isInteger(storyOrder) ? storyOrder : null, by: by || null,
      } });
    return true;
  } catch (err) {
    console.error(`[contentTypeHistory] the content type change of ${character.id} could not be recorded:`, err.message);
    return false;
  }
}

async function contentTypeAt(db, { profileId, storyOrder = null }) {
  const [[profile]] = await db.sequelize.query('SELECT society_archetype FROM social_profiles WHERE id = :id', { replacements: { id: profileId } });
  const current = profile?.society_archetype || null;
  if (!Number.isInteger(storyOrder)) return current;
  try {
    const [[later]] = await db.sequelize.query(
      `SELECT c.before_value FROM character_fact_changes c
         JOIN registry_characters rc ON rc.id = c.registry_character_id
        WHERE rc.feed_profile_id = :pid AND c.fact_key = :key AND c.deleted_at IS NULL
          AND c.story_order IS NOT NULL AND c.story_order > :at
        ORDER BY c.story_order ASC, c.created_at ASC LIMIT 1`,
      { replacements: { pid: profileId, key: FACT_KEY, at: storyOrder } });
    if (!later) return current;
    const before = later.before_value;
    return typeof before === 'string' && before ? before : null;
  } catch (err) {
    console.error('[contentTypeHistory] the content type at that moment could not be read; using their current one:', err.message);
    return current;
  }
}

module.exports = { recordContentTypeChange, contentTypeAt, FACT_KEY };
