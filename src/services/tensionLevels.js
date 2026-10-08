'use strict';

/**
 * Which relationship tension states count as "high": the ones the tension
 * scanner turns into story pairs and the context summary counts
 * (src/routes/worldStudio.js). Matched case-insensitively. Each caller kept
 * its own list, and both lacked lowercase 'unresolved', so a relationship
 * stored that way was never surfaced (wiring map,
 * docs/reads/2026-10-06-lalaverse-wiring-map.md §4, fix-list item 5).
 *
 * Since 2026-10-08 the scanner reads character_relationships, the table
 * the Relationships page edits (Evoni's ruling, fix-list item 23). Its
 * states are calm, simmering, volatile, fractured and healing; simmering,
 * volatile and fractured are high, as /world/tension-check already treats
 * them. unresolved, high and explosive are World Studio's older words.
 */
const HIGH_TENSION_STATES = ['simmering', 'volatile', 'fractured', 'unresolved', 'high', 'explosive'];

function isHighTension(state) {
  return typeof state === 'string' && HIGH_TENSION_STATES.includes(state.trim().toLowerCase());
}

module.exports = { HIGH_TENSION_STATES, isHighTension };
