'use strict';

/**
 * Whether beat 14 delivers the opportunity attached to it (Evoni,
 * 2026-10-19: the invitation comes from someone at the event as ONE private
 * message or notification, `[UI:DM <sender>: …]` or `[UI:NOTIFY <sender>: …]`,
 * naming it; Script page audit, 2026-10-19: a mention in another beat, or in
 * a line that is not a message, does not count). Pure; no I/O.
 *
 * frontend/src/lib/beat14Invitation.js is the same code for the Script
 * tab: what lies between BEGIN SHARED and END SHARED is the same word for
 * word (a parity test in frontend/src/lib/beat14Invitation.test.js keeps it
 * so, as for utils/scriptShowRules).
 */

// BEGIN SHARED
const BEAT = 14;
const HELD = 'held';

const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'her', 'his', 'their', 'your', 'about', 'post', 'piece', 'content', 'make', 'made', 'lala', 'episode', 'event']);
const words = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
// A trailing plural "s" is let go on both sides ("VIPs" names "VIP"); short
// words keep theirs ("bus", "gas").
const stem = (w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);
const keyWords = (s) => [...new Set(words(s).filter((w) => w.length >= 4 && !STOP.has(w)))];

/**
 * Whether the text names the opportunity: its whole name as a phrase, or its
 * key words (all of one or two, three quarters of more, the must-cover rule).
 * A short name with no key word ("VIP", "The Met") is matched as a phrase.
 */
function namesIt(text, name) {
  const phrase = words(name).map(stem);
  if (!phrase.length) return false;
  const have = words(text).map(stem);
  for (let i = 0; i + phrase.length <= have.length; i += 1) {
    if (phrase.every((w, j) => have[i + j] === w)) return true;
  }
  const keys = keyWords(name).map(stem);
  if (!keys.length) return false;
  const need = keys.length <= 2 ? keys.length : Math.ceil(keys.length * 0.75);
  const set = new Set(have);
  return keys.filter((k) => set.has(k)).length >= need;
}

const MESSAGE = /\[UI:\s*(DM|NOTIFY)\b([^\]]*)\]/gi;

/** The first line that is a DM or notification naming the opportunity, else null. */
function invitationLine(lines = [], name) {
  if (!String(name || '').trim()) return null;
  for (const line of lines || []) {
    for (const m of String(line || '').matchAll(MESSAGE)) {
      if (namesIt(m[2], name)) return line;
    }
  }
  return null;
}

/** Whether the beat numbered 14 has that line. `beats`: [{ number, lines }]. */
function beat14Delivers(beats = [], name) {
  const b = (beats || []).find((x) => x?.number === BEAT);
  return !!b && invitationLine(b.lines || [], name) !== null;
}

/**
 * How beat 14 plays its opportunity: 'invitation' (it arrives), 'withheld'
 * (it does not come), or null with nothing attached. Before completion it is
 * held and follows the brief's designed intent; once the episode is
 * completed its status says what happened (Script page audit, 2026-10-19):
 * expired is the episode that did not land, any other status was offered.
 */
function beat14Outcome(opp, designedIntent = null) {
  if (!opp) return null;
  if (opp.status === 'expired') return 'withheld';
  if (opp.status && opp.status !== HELD) return 'invitation';
  return designedIntent === 'fail' ? 'withheld' : 'invitation';
}

// END SHARED

module.exports = { namesIt, invitationLine, beat14Delivers, beat14Outcome, BEAT };
