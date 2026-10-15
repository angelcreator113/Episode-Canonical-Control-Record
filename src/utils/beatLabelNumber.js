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
  EVENTOUTCOME: 11,
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
const HEADER_VARIANT = /^[ \t]*(\*\*|__)?[ \t]*(#{2,3})[ \t]*BEAT[ \t]*:[ \t]*(.*?)[ \t]*(?:\*\*|__)?[ \t]*$/gim;
function normalizeBeatHeaders(text) {
  return String(text ?? '').replace(/\r\n?/g, '\n')
    .replace(HEADER_VARIANT, (line, bold, hashes, label) => (bold || hashes.length === 3 ? `## BEAT: ${label}` : line));
}

module.exports = { beatNumberForLabel, normalizeBeatHeaders, LABEL_NUMBERS };
