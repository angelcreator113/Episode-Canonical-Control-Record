'use strict';

/**
 * Brain rules for a generation (review item 7, 2026-10-04;
 * docs/BRAIN_OWNERSHIP.md §4).
 *
 * "Always inject" never meant every marked rule reached a writer: the
 * episode script writer took the first 50 active always_inject rows in
 * whatever order Postgres returned them, with 104 marked, and nothing
 * recorded which 50. selectInjectedRules makes the choice deterministic
 * and visible:
 *
 *   eligible — active, always_inject, and in scope for the show
 *              (franchise entries, the show's own entries, and show
 *              entries not yet assigned to a show; every entry when no
 *              show is given)
 *   order    — severity first (critical, important, context), then id
 *              ascending, so the same Brain always gives the same set
 *   used     — the first `limit` of those; omitted — the rest, by name
 *
 * Returns { rules, used, omitted, eligible, limit }: rules are the full
 * rows for the prompt; used and omitted are { id, title, severity,
 * category } for the record and the screen.
 */

const { Op } = require('sequelize');

const SEVERITY_RANK = { critical: 0, important: 1, context: 2 };
const DEFAULT_LIMIT = 50;

const summary = (r) => ({ id: r.id, title: r.title, severity: r.severity, category: r.category });

function orderRules(rows) {
  return [...rows].sort((a, b) =>
    (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9) || a.id - b.id);
}

async function selectInjectedRules(FranchiseKnowledge, { showId = null, limit = DEFAULT_LIMIT } = {}) {
  const empty = { rules: [], used: [], omitted: [], eligible: 0, limit };
  if (!FranchiseKnowledge) return empty;
  const where = { status: 'active', always_inject: true };
  if (showId) where[Op.or] = [{ show_id: null }, { show_id: showId }];
  const rows = await FranchiseKnowledge.findAll({
    where,
    attributes: ['id', 'title', 'content', 'category', 'severity', 'scope', 'show_id'],
  }).then((list) => list.map((l) => (typeof l.toJSON === 'function' ? l.toJSON() : l)));
  const ordered = orderRules(rows);
  const rules = ordered.slice(0, limit);
  return {
    rules,
    used: rules.map(summary),
    omitted: ordered.slice(limit).map(summary),
    eligible: ordered.length,
    limit,
  };
}

/** What the record and the screen keep: no rule content. */
function brainRulesRecord({ used, omitted, eligible, limit }) {
  return { limit, eligible, used_count: used.length, omitted_count: omitted.length, used, omitted };
}

module.exports = { selectInjectedRules, brainRulesRecord, orderRules, DEFAULT_LIMIT, SEVERITY_RANK };
