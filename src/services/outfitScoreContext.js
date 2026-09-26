'use strict';

/**
 * outfitScoreContext — what the canonical outfit scorer is given besides the
 * pieces (Task #1943).
 *
 * getOutfitScore (src/routes/wardrobe.js) runs wardrobeIntelligenceService's
 * scoreOutfitForEvent with three inputs other than the outfit: the event, the
 * character state and the wardrobe arc stage. Episode completion
 * (episodeCompletionService.completeEpisode) and the styling game's score
 * (GET and POST /api/v1/wardrobe/outfit-score/:episodeId) both build them
 * here, so the number the game shows and the number that decides the tier
 * are computed from the same inputs.
 *
 * Nothing in this module writes. Completion seeds a missing character_state
 * row with DEFAULT_LALA_STATE; the display path scores with the same values
 * without writing them.
 */

// The event completion scores against: the episode's highest-prestige event.
const EPISODE_EVENT_SQL =
  'SELECT * FROM world_events WHERE used_in_episode_id = :episodeId ORDER BY prestige DESC NULLS LAST LIMIT 1';

// Lala's state, canonical character_key 'lala' (F-Sec-3 decision; Task #1816).
const LALA_STATE_SQL =
  "SELECT * FROM character_state WHERE show_id = :showId AND character_key = 'lala' LIMIT 1";

// The values completion seeds when a show has no character_state row yet.
const DEFAULT_LALA_STATE = Object.freeze({ coins: 500, reputation: 1, brand_trust: 1, influence: 1, stress: 0 });

/** The event fields the scorer is given — the same seven for every caller. */
function eventScoreContext(event) {
  if (!event) return {};
  return {
    dress_code: event.dress_code,
    prestige: event.prestige,
    strictness: event.strictness,
    event_type: event.event_type,
    host_brand: event.host_brand,
    dress_code_keywords: event.dress_code_keywords,
    season: event.season,
  };
}

/**
 * The wardrobe arc stage for a show, or null. Fails open: a missing arc only
 * means the authenticity signal does not fire.
 */
async function loadArcStage(showId, models) {
  if (!showId || !models) return null;
  try {
    const { getWardrobeGrowthArc } = require('./wardrobeIntelligenceService');
    const arc = await getWardrobeGrowthArc(showId, models);
    return arc?.arc_stage || null;
  } catch (err) {
    console.error('[outfitScoreContext] wardrobe arc unavailable; authenticity signal skipped:', err?.message);
    return null;
  }
}

/**
 * The inputs besides the pieces, as completion passes them:
 * { eventContext, characterState, arcStage }.
 */
async function buildOutfitScoreContext({ models, showId, event, characterState }) {
  return {
    eventContext: eventScoreContext(event),
    characterState: characterState || null,
    arcStage: await loadArcStage(showId, models),
  };
}

/**
 * Read-only: the event to score a display against. An explicit eventId is
 * looked up within the show (or show-less events); without one, the event
 * completion uses (EPISODE_EVENT_SQL). Returns the row or null.
 */
async function loadScoringEvent(sequelize, { episodeId, showId, eventId = null }) {
  if (eventId) {
    const [rows] = await sequelize.query(
      `SELECT * FROM world_events
       WHERE id = :eventId AND (show_id = :showId OR show_id IS NULL)
       LIMIT 1`,
      { replacements: { eventId, showId: showId || null } }
    );
    return rows?.[0] || null;
  }
  const [rows] = await sequelize.query(EPISODE_EVENT_SQL, { replacements: { episodeId } });
  return rows?.[0] || null;
}

/**
 * Read-only: Lala's state for the display path — the row completion would
 * read, or the values completion would seed when there is none.
 */
async function loadDisplayCharacterState(sequelize, showId) {
  if (!showId) return { ...DEFAULT_LALA_STATE };
  const [rows] = await sequelize.query(LALA_STATE_SQL, { replacements: { showId } });
  return rows?.[0] || { ...DEFAULT_LALA_STATE };
}

module.exports = {
  EPISODE_EVENT_SQL,
  LALA_STATE_SQL,
  DEFAULT_LALA_STATE,
  eventScoreContext,
  loadArcStage,
  buildOutfitScoreContext,
  loadScoringEvent,
  loadDisplayCharacterState,
};
