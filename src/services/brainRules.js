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

// ─── Every Feed and event generator (2026-10-06) ─────────────────────────
// The episode script writer was the only generator that read the Show
// Bible through selectInjectedRules; Feed posts, profiles, comments,
// redrafts, the Feed-to-event pipeline, event concepts, seasonal events
// and the event generator either read nothing or (the event generator) ten
// rules cut to 200 characters with no show scope. loadBrainContext gives
// each of them the same rules, in the same order, as one prompt block, and
// recordRuleUse counts the use, so the Bible's "Times the AI used them" is
// true for every generator. A Bible that cannot be read is logged and the
// generation goes on without it (a context loader returns null).

const GENERATOR_LIMIT = 25;
const RULE_CHARS = 600;
const BLOCK_HEADING = 'SHOW BIBLE: ALWAYS TRUE (canon; every line you write must agree with these rules, and none may contradict them)';

/** A rule's text for a prompt: a JSON entry's summary, else its text, cut to RULE_CHARS. */
function ruleText(rule) {
  let text = rule?.content;
  if (text && typeof text === 'object') text = text.summary || JSON.stringify(text);
  else if (typeof text === 'string' && text.trim().startsWith('{')) {
    try { const parsed = JSON.parse(text); text = parsed?.summary || text; }
    catch (parseErr) { console.warn('[brainRules] rule', rule?.id, 'content looks like JSON but is not:', parseErr.message); }
  }
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  return clean.length > RULE_CHARS ? `${clean.slice(0, RULE_CHARS - 1)}…` : clean;
}

/** The rules as one prompt block, or null with none. */
function rulesPromptBlock(rules, { heading = BLOCK_HEADING } = {}) {
  if (!rules?.length) return null;
  const lines = rules.map((r) => {
    const text = ruleText(r);
    return `- [${String(r.severity || 'important').toUpperCase()}] ${r.title}${text ? `: ${text}` : ''}`;
  });
  return `\n${heading}\n${lines.join('\n')}\n`;
}

/**
 * The Show Bible for one generation: { block, ids, record }. block is the
 * prompt text (null when the Bible has no always-inject rule or cannot be
 * read); ids the rules it carries, for recordRuleUse; record what
 * brainRulesRecord keeps. Never throws.
 */
async function loadBrainContext(models, { showId = null, limit = GENERATOR_LIMIT, label = 'generator' } = {}) {
  try {
    const selection = await selectInjectedRules(models?.FranchiseKnowledge, { showId, limit });
    return { block: rulesPromptBlock(selection.rules), ids: selection.used.map((r) => r.id), record: brainRulesRecord(selection) };
  } catch (err) {
    console.error(`[${label}] could not read the Show Bible; generating without it:`, err?.message);
    return { block: null, ids: [], record: null };
  }
}

/** Count one use of each rule (injection_count, last_injected_at). Never throws. */
async function recordRuleUse(sequelize, ids, label = 'generator') {
  if (!sequelize || !ids?.length) return;
  try {
    await sequelize.query(
      `UPDATE franchise_knowledge
          SET injection_count = COALESCE(injection_count, 0) + 1, last_injected_at = NOW(), updated_at = NOW()
        WHERE id IN (:ids)`,
      { replacements: { ids } }
    );
  } catch (err) {
    console.error(`[${label}] could not count the Show Bible rules it used:`, err?.message);
  }
}

module.exports = {
  selectInjectedRules, brainRulesRecord, orderRules, DEFAULT_LIMIT, SEVERITY_RANK,
  GENERATOR_LIMIT, RULE_CHARS, ruleText, rulesPromptBlock, loadBrainContext, recordRuleUse,
};
