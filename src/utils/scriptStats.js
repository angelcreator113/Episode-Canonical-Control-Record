'use strict';

// Lala's stats in the script, one reader for every check (Script page
// re-audit, 2026-10-19): the server's copy of frontend/src/lib/scriptStats.js
// (the code between BEGIN SHARED and END SHARED is the same word for word;
// frontend/src/lib/scriptReaudit.test.js checks it). utils/scriptRuleChecks
// and utils/scriptMoney read coin lines through it, as the Script tab does.

// BEGIN SHARED
const STAT_TAG = /^\s*\[\s*STAT\s*:\s*(.*?)\s*\]\s*$/i;
// A stat's name (one or two words; `brand-trust` is brand_trust, Script
// page re-audit, 2026-10-19), an optional colon, a sign (a hyphen, a
// Unicode minus, an en or em dash, or a plus), the number (`1,200`,
// `12.50`). A name ends in a letter, so `coins-50` is coins, -50.
const STAT_ENTRY = /([a-z](?:[a-z_-]*[a-z_])?(?:[ \t]+[a-z](?:[a-z_-]*[a-z_])?)?)\s*:?\s*([+\-−–—]?)\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)/gi;

/** A [STAT:] tag's entries as [{ stat, value }], else null when the line is no stat tag. */
function statEntries(line) {
  const m = String(line ?? '').match(STAT_TAG);
  if (!m) return null;
  return [...m[1].matchAll(STAT_ENTRY)].map((e) => {
    const n = Number(e[3].replace(/,/g, ''));
    return { stat: e[1].toLowerCase().replace(/[\s-]+/g, '_'), value: e[2] && e[2] !== '+' ? -n : n };
  });
}

/** The coins a line changes (signed), else null: only a stat named coins (`Lala coins` is not). */
function coinChange(line) {
  const c = (statEntries(line) || []).find((e) => e.stat === 'coins');
  return c ? c.value : null;
}

/** Whether the line is a coin line. */
const isCoinLine = (line) => coinChange(line) !== null;
// END SHARED

module.exports = { STAT_TAG, statEntries, coinChange, isCoinLine };
