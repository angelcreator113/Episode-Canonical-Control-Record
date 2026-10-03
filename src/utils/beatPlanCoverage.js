'use strict';

/**
 * Beat plan coverage (audit finding GATE-01, 2026-10-03): does an episode's
 * beat plan cover the 14 canonical beats, each exactly once? "Scene plan
 * generated (14 beats)" passed with one row, and script-context's
 * every(locked) was true for an empty plan. Every readiness surface now
 * reads this one result instead of counting rows its own way.
 *
 * planRows: the episode's scene_plans rows (anything with beat_number).
 * Returns { complete, expected, present, missing, duplicates, unknown,
 * text }: missing and duplicates are canonical beat numbers, unknown counts
 * rows whose beat_number is not a canonical beat, and text says it in one
 * line ("11 of 14 beats · missing beats 3, 7 and 12").
 *
 * Pure; no I/O.
 */

const { CANONICAL_BEATS } = require('../constants/canonicalBeats');

const CANONICAL_NUMBERS = CANONICAL_BEATS.map((b) => b.number);

const listNumbers = (ns) => (ns.length < 2 ? String(ns[0]) : `${ns.slice(0, -1).join(', ')} and ${ns[ns.length - 1]}`);

function beatPlanCoverage(planRows) {
  const rows = Array.isArray(planRows) ? planRows : [];
  const counts = new Map();
  let unknown = 0;
  for (const row of rows) {
    const n = Number(row && row.beat_number);
    if (!Number.isInteger(n) || !CANONICAL_NUMBERS.includes(n)) { unknown += 1; continue; }
    counts.set(n, (counts.get(n) || 0) + 1);
  }
  const missing = CANONICAL_NUMBERS.filter((n) => !counts.has(n));
  const duplicates = CANONICAL_NUMBERS.filter((n) => counts.get(n) > 1);
  const complete = missing.length === 0 && duplicates.length === 0 && unknown === 0;

  const problems = [];
  if (missing.length) problems.push(`missing ${missing.length === 1 ? 'beat' : 'beats'} ${listNumbers(missing)}`);
  if (duplicates.length) {
    problems.push(`${duplicates.length === 1 ? 'beat' : 'beats'} ${listNumbers(duplicates)} ${duplicates.length === 1 ? 'appears' : 'appear'} more than once`);
  }
  if (unknown) problems.push(`${unknown} ${unknown === 1 ? 'row has' : 'rows have'} no canonical beat number`);
  const expected = CANONICAL_NUMBERS.length;
  const text = complete
    ? `${expected} of ${expected} beats`
    : `${counts.size} of ${expected} beats · ${problems.join(' · ')}`;

  return { complete, expected, present: counts.size, missing, duplicates, unknown, text };
}

module.exports = { beatPlanCoverage, CANONICAL_NUMBERS };
