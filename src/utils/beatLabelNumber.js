'use strict';

/**
 * The canonical beat a `## BEAT:` header names when it has no number (Script
 * tab audit, 2026-10-15). The script skeleton, the episodes route's skeleton
 * and the Script Editor write headers by name (`## BEAT: OPENING_RITUAL`,
 * `## BEAT: INTERRUPTION #2`); numbered by place, the ninth of them
 * (CLIFFHANGER) read as beat 9 and TRANSFORMATION as beat 6, so a lock or a
 * regenerate landed on the wrong canonical beat. A name maps to its
 * canonical number here; frontend/src/lib/beatLabelNumber.js keeps the same
 * table for the Script tab, so a lock means the same beat on both sides.
 *
 * Pure; no I/O.
 */

// Keys are the label reduced to A-Z and 0-9 (see keyOf).
const LABEL_NUMBERS = {
  // Canonical names (src/constants/canonicalBeats.js).
  OPENINGRITUAL: 1,
  LOGINSEQUENCE: 2,
  WELCOME: 3,
  INTERRUPTIONPULSE1: 4,
  REVEAL: 5,
  STRATEGICREACTION: 6,
  INTERRUPTIONPULSE2: 7,
  TRANSFORMATIONLOOP: 8,
  REMINDERDEADLINE: 9,
  EVENTTRAVEL: 10,
  THEEVENT: 11,
  // Beat 11's name before Evoni's ruling of 2026-10-19 ("The Event"); saved
  // scripts keep it.
  EVENTOUTCOME: 11,
  FASHIONCHALLENGE: 12,
  THEFASHIONCHALLENGE: 12,
  // Beat 12's name before Evoni's ruling of 2026-10-18; saved scripts keep it.
  DELIVERABLECREATION: 12,
  RECAPPANEL: 13,
  CLIFFHANGER: 14,
  // The skeleton's and the Script Editor's names. CREATOR_WELCOME opens the
  // login window, so it is the login beat; STAKES_INTENTION is Lala's voice
  // command, the strategic reaction; PAYOFF_CTA is the recap.
  CREATORWELCOME: 2,
  INTERRUPTION1: 4,
  INTERRUPTION: 4,
  REVEAL1: 5,
  STAKESINTENTION: 6,
  INTERRUPTION2: 7,
  TRANSFORMATION: 8,
  PAYOFFCTA: 13,
};

const keyOf = (label) => String(label || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** The canonical number (1-14) a header label names, or null. */
function beatNumberForLabel(label) {
  const text = String(label || '').trim();
  const numbered = Number((text.match(/^(\d{1,2})\b/) || [])[1]);
  if (numbered >= 1 && numbered <= 14) return numbered;
  return LABEL_NUMBERS[keyOf(text)] || null;
}

// Script tab re-audit (2026-10-15): a pasted script can have Windows line
// ends, or headers in Markdown dress (`**## BEAT: 3**`, `### BEAT: 3`). The
// tab read them one way and the server another (or not at all), so a lock
// was not kept and the coverage check found no beats. Both sides read the
// script through this first; frontend/src/lib/beatLabelNumber.js has the
// same rule.
// Re-audit 2 (2026-10-15): a byte-order mark, Unicode line breaks and odd
// spaces in a header (no-break, tab-like) read one way on each side, so they
// are written plainly too.
const HEADER_VARIANT = /^[^\S\n]*(\*\*|__)?[^\S\n]*(#{2,3})[^\S\n]*BEAT[^\S\n]*:[^\S\n]*(.*?)[^\S\n]*(?:\*\*|__)?[^\S\n]*$/gim;
const ODD_SPACE = /[^\S\n \t]/;
// `## Beat 5: Name` (the number before the colon) is a header too, written
// `## BEAT: 5 · Name` (Script page audit, 2026-10-19: it was not read as a
// header, so the whole script was cut into 14 by place and every beat
// passed). A separator or the line's end must follow the number.
const HEADER_NUMBER_FIRST = /^[^\S\n]*(?:\*\*|__)?[^\S\n]*#{2,3}[^\S\n]*BEAT[^\S\n]+(\d{1,3})[^\S\n]*(?:(?:[:.\u00B7|\u2014\u2013-])[^\S\n]*(.*?))?[^\S\n]*(?:\*\*|__)?[^\S\n]*$/gim;
function normalizeBeatHeaders(text) {
  return String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n?|[\u2028\u2029\u0085]/g, '\n')
    .replace(HEADER_VARIANT, (line, bold, hashes, label) => (bold || hashes.length === 3 || ODD_SPACE.test(line) ? `## BEAT: ${label}` : line))
    .replace(HEADER_NUMBER_FIRST, (line, n, name) => `## BEAT: ${n}${name && name.trim() ? ` · ${name.trim()}` : ''}`);
}

// The number a header gives its beat: its own leading number, of any size
// (`## BEAT: 15 · Extra` is beat 15, so a move can't make it a locked 14),
// or the canonical beat its name names; null when it names neither, and the
// beat is numbered by its place (re-audit 2, 2026-10-15).
function headerNumber(label) {
  // `## BEAT: Beat 4 · Pulse` names beat 4 (Script page audit, 2026-10-19:
  // it was numbered by its place).
  const text = String(label || '').trim().replace(/^beat\b[\s#:.-]*(?=\d)/i, '');
  const n = Number((text.match(/^(\d{1,3})\b/) || [])[1]);
  return n >= 1 ? n : beatNumberForLabel(text);
}

module.exports = { beatNumberForLabel, headerNumber, normalizeBeatHeaders, LABEL_NUMBERS };
