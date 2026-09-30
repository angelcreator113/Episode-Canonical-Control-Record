'use strict';

/**
 * Episode viewer teaser (Task #2386; Evoni's P12, 2026-09-30):
 *
 *   "Each episode has a viewer teaser, separate from the event description
 *   (guest copy, rule 12): mystery-driven, never revealing the outcome, the
 *   hook in the first 150 characters. It's auto-drafted at Start Episode
 *   from the event's concept and description, labelled Auto-drafted, and
 *   editable. Distribution drafts platform copy from the teaser."
 *
 * P13: "The existing episode description remains the internal synopsis of
 * what happens."
 *
 * Pure helpers, shared by Start Episode (episodeGeneratorService), the
 * episode PUT (episodeController.updateEpisode) and distribution
 * (distributionService). No I/O.
 *
 * Server-side checks are deliberately light (INFERRED): "mystery-driven"
 * and "never revealing the outcome" are prompt rules, not something a
 * string check can verify. What is checked: it is a string, trimmed, runs
 * of whitespace collapsed, wrapping quotes stripped, non-empty (so the first
 * 150 characters hold something), capped at TEASER_MAX_CHARS on a word
 * boundary, and not a verbatim copy of the event description (P12: separate
 * from the event description). At Start Episode no evaluation exists yet, so
 * there is no tier or score the draft could leak.
 */

const TEASER_HOOK_CHARS = 150;
// INFERRED cap: long enough for a 2-3 sentence teaser, short enough to stay
// a teaser rather than a synopsis.
const TEASER_MAX_CHARS = 500;

const collapse = (s) => s.replace(/\s+/g, ' ').trim();

function capAtWord(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

/**
 * The drafted or entered teaser, normalized, or null when there is none.
 * `eventDescription` (optional): a teaser that only restates the event's
 * guest description is not a teaser, so it is dropped (null).
 */
function normalizeTeaser(raw, { eventDescription = null } = {}) {
  if (typeof raw !== 'string') return null;
  let text = collapse(raw);
  // Models sometimes wrap copy in quotes.
  const quoted = text.match(/^["“'](.*)["”']$/s);
  if (quoted) text = collapse(quoted[1]);
  if (!text) return null;
  text = capAtWord(text, TEASER_MAX_CHARS);
  if (typeof eventDescription === 'string' && collapse(eventDescription).toLowerCase() === text.toLowerCase()) {
    return null;
  }
  return text;
}

/** The first TEASER_HOOK_CHARS characters — where the hook must land. */
function teaserHook(teaser) {
  return typeof teaser === 'string' ? teaser.slice(0, TEASER_HOOK_CHARS) : '';
}

/**
 * Doctrine rule 14 state for the teaser: 'missing' when empty,
 * 'auto_drafted' while it equals the Start Episode draft, 'edited' once it
 * differs, 'set' when it was never drafted.
 */
function teaserStateOf(episode) {
  const teaser = typeof episode?.teaser === 'string' ? episode.teaser.trim() : '';
  const drafted = typeof episode?.teaser_drafted === 'string' ? episode.teaser_drafted.trim() : '';
  if (!teaser) return 'missing';
  if (!drafted) return 'set';
  return teaser === drafted ? 'auto_drafted' : 'edited';
}

// Prompt rules for the Start Episode Claude call (episodeGeneratorService).
// Exported so tests pin the wording the rulings ask for.
const TEASER_INSTRUCTION = 'Viewer teaser, guest-facing, 1-3 sentences (150-400 characters). Mystery-driven: raise the question this episode answers and do NOT answer it. The hook, the line that makes a viewer click, must land within the first 150 characters. Draw it from the EVENT CONCEPT and EVENT DESCRIPTION above. Never reveal the outcome: not how the night ends, not whether Lala succeeds or fails, no score, tier, result or consequence. Do not copy the event description. No hashtags.';

const SYNOPSIS_INSTRUCTION = 'Internal synopsis for the production team, never shown to viewers: 2-4 plain sentences on what happens in this episode (the event, the outfit, the stakes, how the beats play out). Factual, not marketing copy, no hashtags.';

module.exports = {
  TEASER_HOOK_CHARS,
  TEASER_MAX_CHARS,
  TEASER_INSTRUCTION,
  SYNOPSIS_INSTRUCTION,
  normalizeTeaser,
  teaserHook,
  teaserStateOf,
};
