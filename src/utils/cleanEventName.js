'use strict';

/**
 * cleanEventName — the one quotation-mark cleanup for AI-written event names,
 * shared by the creation draft (eventConceptDraftService.parseName, Task
 * #2135) and the suggest-names handler (POST /world/:showId/events/:eventId/
 * suggest-names, src/routes/worldEvents.js). Task #2139.
 *
 * Double quotes, straight and curly, are stripped anywhere; single quotes
 * only when they wrap the whole name, so an apostrophe (' or ’) inside it is
 * kept: "Maya's Golden Hour" stays as written, "'Golden Hour'" becomes
 * Golden Hour, and a lone quote at one end ("Golden Hour'") is left alone.
 * Runs of whitespace collapse to one space and the result is trimmed.
 *
 * Length rules stay with each caller. Pure; no I/O.
 */

const DOUBLE_QUOTES = /["“”]/g;
const WRAPPING_SINGLE_QUOTES = /^['‘’]\s*(.*?)\s*['‘’]$/;

function cleanEventName(raw) {
  if (typeof raw !== 'string') return '';
  const name = raw.replace(DOUBLE_QUOTES, '').replace(/\s+/g, ' ').trim();
  const wrapped = name.match(WRAPPING_SINGLE_QUOTES);
  return wrapped ? wrapped[1] : name;
}

module.exports = { cleanEventName };
