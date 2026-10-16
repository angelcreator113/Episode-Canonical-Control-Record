'use strict';

/**
 * A character's deep profile comes in two shapes (Evoni, 2026-10-16: one
 * meaning per field):
 *   v2 (inner-life generation, characterGenerationService): short keys,
 *       one string per dimension — { class_money: "..." }
 *   older (deep-profile/generate, bulk-deep-profile): "_and_" keys, an object
 *       of notes per dimension — { class_and_money: { money_wound: "..." } }
 * Readers ask for a note here and get it from either shape: the older note
 * when it is there, else the v2 dimension's text.
 */
const ALIASES = Object.freeze({
  class_money: 'class_and_money', religion_meaning: 'religion_and_meaning', race_culture: 'race_and_culture',
  sexuality_desire: 'sexuality_and_desire', friendship_loyalty: 'friendship_and_loyalty',
  ambition_identity: 'ambition_and_identity', habits_rituals: 'habits_and_rituals',
  speech_silence: 'speech_and_silence', grief_loss: 'grief_and_loss', politics_justice: 'politics_and_justice',
});

const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** The dimension under its v2 key or its older "_and_" key. */
function dimension(dp, key) {
  if (!dp || typeof dp !== 'object') return null;
  return dp[key] ?? dp[ALIASES[key]] ?? null;
}

/** One note of a dimension (`note` names the older shape's field), or the v2 dimension's text. */
function deepNote(dp, key, note) {
  const d = dimension(dp, key);
  if (d && typeof d === 'object') return text(d[note]);
  return text(d);
}

module.exports = { ALIASES, dimension, deepNote };
