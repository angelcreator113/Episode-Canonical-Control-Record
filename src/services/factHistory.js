'use strict';

/**
 * Fact history (Character Consistency Engine, the spec's Future Enhancement
 * #1: "keep a changelog of when and why a fact changed (e.g. follower_count
 * 1M → 2M as a story event). Pulse growth IS the story, so this turns the
 * facts block into a mineable timeline"; Evoni, 2026-10-17).
 *
 *   recordFactChanges(db, { character, showId, before, after, reason, by })
 *     after a save on the fact sheet (characterFacts.setFacts): one
 *     character_fact_changes row per fact that changed (handle, account
 *     status, income, occupation, what they own, not decided yet), at the
 *     story moment of the show's present. Followers are left to their own
 *     ledger. Never throws: the save already happened; a failure is logged.
 *   factHistory(db, { character, feedProfile }) → [entry], newest first:
 *     { at, story_order, story_label, fact, label, from, to, reason, by,
 *       source: 'fact_sheet' | 'followers' }, the fact sheet's changes and
 *     the follower ledger's accepted changes (an episode's result, a post's
 *     numbers, an event, a change on the fact sheet) together.
 */

const LABELS = {
  handle: 'Handle', account_status: 'Account status', income: 'Income', occupation: 'Occupation',
  major_possessions: 'What they own', undecided: 'Not decided yet', followers: 'Followers',
};
const TRACKED = ['handle', 'account_status', 'income', 'occupation', 'major_possessions', 'undecided'];
const MAX_ENTRIES = 200;

/** A fact as a plain value to compare and store: null when unset. */
function valueOf(facts, key) {
  if (!facts) return null;
  if (key === 'income') {
    const i = facts.income;
    return i && i.amount != null ? { amount: i.amount, cadence: i.cadence || null, source: i.source || null } : null;
  }
  if (key === 'major_possessions') return (facts.major_possessions || []).length ? [...facts.major_possessions] : null;
  if (key === 'undecided') return (facts.undecided || []).length ? [...facts.undecided].sort() : null;
  return facts[key] || null;
}

/** The facts that changed between two facts objects: [{ key, from, to }]. */
function factDiff(before, after) {
  const out = [];
  for (const key of TRACKED) {
    const from = valueOf(before, key);
    const to = valueOf(after, key);
    if (JSON.stringify(from) !== JSON.stringify(to)) out.push({ key, from, to });
  }
  return out;
}

/** A stored value in words, for the history. */
function words(key, v) {
  if (v === null || v === undefined) return null;
  if (key === 'income') return `${Number(v.amount).toLocaleString('en-US')} ${v.cadence === 'per_month' ? 'a month' : 'a year'}${v.source ? ` from ${v.source}` : ''}`;
  if (key === 'account_status') return String(v).replace(/_/g, ' ');
  if (key === 'undecided') return v.map((k) => (LABELS[k] || k).toLowerCase()).join(', ');
  if (Array.isArray(v)) return v.join('; ');
  return String(v);
}

async function recordFactChanges(db, { character, showId = null, before, after, reason = null, by = null }) {
  try {
    const changes = factDiff(before, after);
    if (!changes.length) return [];
    let storyOrder = null;
    if (showId) storyOrder = await require('./storyClock').presentOrder(db, showId);
    for (const ch of changes) {
      await db.sequelize.query(
        `INSERT INTO character_fact_changes (registry_character_id, show_id, fact_key, before_value, after_value, reason, story_order, changed_by, source)
         VALUES (:cid, :show, :key, CAST(:from AS jsonb), CAST(:to AS jsonb), :reason, :order, :by, 'fact_sheet')`,
        { replacements: {
          cid: character.id, show: showId, key: ch.key, from: JSON.stringify(ch.from), to: JSON.stringify(ch.to),
          reason: reason ? String(reason).slice(0, 500) : null, order: Number.isInteger(storyOrder) ? storyOrder : null, by,
        } });
    }
    return changes;
  } catch (err) {
    console.error(`[factHistory] the fact changes of ${character?.id} could not be recorded:`, err.message);
    return [];
  }
}

async function factHistory(db, { character, feedProfile = null }) {
  const { label: storyLabel } = require('./storyClock');
  const [factRows] = await db.sequelize.query(
    `SELECT fact_key, before_value, after_value, reason, story_order, changed_by, created_at FROM character_fact_changes
      WHERE registry_character_id = :cid AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ${MAX_ENTRIES}`,
    { replacements: { cid: character.id } });
  const entries = factRows.map((r) => ({
    at: new Date(r.created_at).toISOString(),
    story_order: r.story_order,
    story_label: storyLabel(r.story_order),
    fact: r.fact_key,
    label: LABELS[r.fact_key] || r.fact_key,
    from: words(r.fact_key, r.before_value),
    to: words(r.fact_key, r.after_value),
    reason: r.reason || null,
    by: r.changed_by || null,
    source: 'fact_sheet',
  }));
  if (feedProfile?.id) {
    const { formatCount } = require('./characterFacts');
    const [ledger] = await db.sequelize.query(
      `SELECT change, count_after, cause, reason, story_order, decided_by, COALESCE(decided_at, created_at) AS at FROM pulse_followers
        WHERE social_profile_id = :pid AND status = 'accepted' AND deleted_at IS NULL
        ORDER BY COALESCE(decided_at, created_at) DESC LIMIT ${MAX_ENTRIES}`,
      { replacements: { pid: feedProfile.id } });
    for (const r of ledger) {
      const after = Number(r.count_after);
      const before = after - Number(r.change);
      entries.push({
        at: new Date(r.at).toISOString(),
        story_order: r.story_order,
        story_label: storyLabel(r.story_order),
        fact: 'followers',
        label: LABELS.followers,
        from: r.cause === 'start' ? null : formatCount(before),
        to: formatCount(after),
        reason: r.reason || null,
        by: r.decided_by || null,
        source: 'followers',
      });
    }
  }
  entries.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return entries.slice(0, MAX_ENTRIES);
}

module.exports = { recordFactChanges, factHistory, factDiff, valueOf, LABELS };
