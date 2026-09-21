/**
 * Canonical SAL 14-Beat Structure
 *
 * Single source of truth for the show-brain seeder's 14 beat names and order
 * (src/seeders/20260312800000-show-brain-franchise-laws.js, "Episode
 * Architecture — The 14-Beat Structure"). Names, order, and typical_location
 * copied verbatim from scenePlannerService's pre-existing BEAT_STRUCTURE,
 * which already matched the seeder's names/order exactly — this module
 * changes where that data lives, not what it says.
 *
 * Ruling: docs/EVENT_EPISODE_FLOW.md §8(a) / §7 decision 1 — Evoni,
 * 2026-09-21 (Task #1609): the seeder's names and order are canon.
 *
 * Does NOT include phase/emotional_intent (episodeGeneratorService's
 * BEAT_TEMPLATES fields) or phone-moment content (feedMomentsService's
 * BEAT_PHONE_MOMENTS) — those require a beat-by-beat content mapping, not a
 * positional one, and are proposed (not yet approved) in PR #<TBD>'s body
 * for a follow-up task once Evoni signs off.
 */

const CANONICAL_BEATS = [
  { number: 1, name: 'Opening Ritual', typical_location: 'HOME_BASE', description: 'Lala in her space — sets the emotional tone for the episode' },
  { number: 2, name: 'Login Sequence', typical_location: 'HOME_BASE', description: 'Checking phone/social — receives the episode catalyst' },
  { number: 3, name: 'Welcome', typical_location: 'HOME_BASE', description: 'Greeting the audience — introduces the episode question' },
  { number: 4, name: 'Interruption Pulse 1', typical_location: 'HOME_BASE', description: 'First disruption — text, call, memory — raises stakes' },
  { number: 5, name: 'Reveal', typical_location: 'CLOSET', description: 'The outfit/look reveal — wardrobe becomes part of the narrative' },
  { number: 6, name: 'Strategic Reaction', typical_location: 'HOME_BASE', description: 'Processing the reveal — doubt, confidence, or strategy shift' },
  { number: 7, name: 'Interruption Pulse 2', typical_location: 'TRANSITION', description: 'Second disruption — escalation, complication, or twist' },
  { number: 8, name: 'Transformation Loop', typical_location: 'CLOSET', description: 'Getting ready — the physical and mental transformation' },
  { number: 9, name: 'Reminder/Deadline', typical_location: 'TRANSITION', description: 'Time pressure — the event is approaching, urgency builds' },
  { number: 10, name: 'Event Travel', typical_location: 'TRANSITION', description: 'Moving to the event — anticipation, anxiety, or excitement' },
  { number: 11, name: 'Event Outcome', typical_location: 'EVENT_LOCATION', description: 'The main event — what happens when Lala arrives and performs' },
  { number: 12, name: 'Deliverable Creation', typical_location: 'EVENT_LOCATION', description: 'Creating the content/product — the work output of the episode' },
  { number: 13, name: 'Recap Panel', typical_location: 'HOME_BASE', description: 'Reflecting on what happened — audience engagement moment' },
  { number: 14, name: 'Cliffhanger', typical_location: 'HOME_BASE', description: 'Unresolved thread — drives viewer to next episode' },
];

module.exports = { CANONICAL_BEATS };
