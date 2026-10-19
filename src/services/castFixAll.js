'use strict';

/**
 * Fix what can be fixed (Evoni, 2026-10-18: "how can we fix these
 * automatically"; rulings: text rewrites wait for one "Apply all" click from
 * her, and voices stay with her). On Facts & checks, one run takes every
 * character in the registries asked for through the tools their own page
 * already has, in this order:
 *
 *   1. feed person  linked only when exactly one live LalaVerse feed profile
 *                   has their name (or their key as its handle) and no other
 *                   character holds it
 *   2. followers    the estimate read from their profile saved as the count
 *                   (a ledger row; needs their registry's show). No AI.
 *   3. facts        occupation, income, what they own: services/factsSuggest,
 *                   saved only into facts still missing (never over a set fact
 *                   or one marked not decided yet). One AI call.
 *   4. type         services/characterTypology.suggestTypology, saved. One AI call.
 *   5. findings     every finding with one right wording fixed (the check's
 *                   own fix); the rest go to services/checkAutofix, whose
 *                   rewrites ("fix") and keep-as-written verdicts ("fine")
 *                   come back queued, not applied. At most one AI call.
 *   6. voice        built once they post (active or alive) and their facts
 *                   are set; it waits for her approval like any built voice.
 *
 *   fixAll(db, registryIds, { by }) → { characters: [{ id, name, changes,
 *     queued, left }], summary, stopped }
 *   applyQueued(db, items) → [{ ...item, ok, error?, change? }]
 *     a "fix" item swaps its sentence (characterConsistency.applyFix
 *     replace); a "fine" item marks the finding intentional with its why.
 *     An item whose sentence has changed since is skipped.
 *   undoChange(db, change, { by }) → { ok: true }
 *
 * Every automatic change comes back as a change record holding what it was
 * before and after; Undo takes that record and restores the before value,
 * refusing (409) when the value is no longer what this run left there. No
 * table holds the records: the page keeps them for the run.
 *
 * The AI budget (services/aiCostTracker) refusing a call stops the run where
 * it is: what was done stays, and `stopped` says why. Dr. Sinclair (a
 * confidential professional) is never touched.
 */

const crypto = require('crypto');
const { isCounselor } = require('./characterTalk');

const FACT_FIELDS = ['occupation', 'income', 'major_possessions'];
const REASON = 'Fix what can be fixed, from what is written about them.';

class FixAllError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const json = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
// Key order aside (JSONB stores keys in its own order).
const canonical = (v) => (Array.isArray(v) ? v.map(canonical)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])])) : v);
const same = (a, b) => JSON.stringify(canonical(json(a) ?? null)) === JSON.stringify(canonical(json(b) ?? null));
const changeId = () => crypto.randomUUID();
const nameOf = (c) => c.selected_name || c.display_name || 'This character';

/** The AI budget refused (not a per-show request cap, which only stops that step). */
const isBudgetStop = (err) => err?.code === 'AI_BUDGET_EXCEEDED' || (err?.status === 429 && err?.code !== 'PULSE_REQUESTS_USED');

// ── A finding's field: read and write the value at its path ─────────────────
// The fields a change may write: what the check reads (characterConsistency
// leavesOf), never ids, keys or machinery.
const LOCKED = new Set(['id', 'registry_id', 'feed_profile_id', 'character_key', 'canon_facts', 'typology', 'handle',
  'follower_count_approx', 'follower_tier', 'current_state', 'status', 'feed_layer', 'platform']);

function recordFor(found, field) {
  const [source, top, ...rest] = String(field || '').split('.');
  if (!['character', 'feed'].includes(source) || !top || LOCKED.has(top) || top.endsWith('_id') || top.endsWith('_at')) {
    throw new FixAllError(400, 'That field cannot be changed here.');
  }
  const record = source === 'feed' ? found.feedProfile : found.character;
  if (!record) throw new FixAllError(409, 'They have no feed profile.');
  if (!(top in (record.constructor?.rawAttributes || {}))) throw new FixAllError(400, 'That field cannot be changed here.');
  return { record, top, rest };
}
const valueAt = (root, parts) => parts.reduce((v, k) => (v === null || v === undefined ? undefined : v[k]), root);

function readField(found, field) {
  const { record, top, rest } = recordFor(found, field);
  return rest.length ? valueAt(record[top], rest) : record[top];
}

async function writeField(found, field, value) {
  const { record, top, rest } = recordFor(found, field);
  if (!rest.length) return record.update({ [top]: value });
  const root = json(record[top]);
  const parent = valueAt(root, rest.slice(0, -1));
  if (parent === null || typeof parent !== 'object') throw new FixAllError(409, 'That text has moved. Check again.');
  parent[rest[rest.length - 1]] = value;
  return record.update({ [top]: root });
}

async function loadFound(db, characterId) {
  const character = await db.RegistryCharacter.findByPk(characterId);
  if (!character) throw new FixAllError(404, 'Character not found');
  const feedProfile = character.feed_profile_id ? await db.SocialProfile.findByPk(character.feed_profile_id) : null;
  return { character, feedProfile };
}

// ── 1. The feed person ──────────────────────────────────────────────────────
async function matchFeedProfile(db, character) {
  const names = [...new Set([character.display_name, character.selected_name].filter(Boolean).map((n) => String(n).trim().toLowerCase()))];
  const key = character.character_key ? String(character.character_key).trim().toLowerCase() : null;
  const [rows] = await db.sequelize.query(
    `SELECT id, handle, display_name FROM social_profiles
      WHERE deleted_at IS NULL AND feed_layer = 'lalaverse'
        AND (LOWER(TRIM(display_name)) IN (:names) OR LOWER(LTRIM(handle, '@')) = :key)`,
    { replacements: { names: names.length ? names : [''], key: key || '' } });
  if (rows.length === 0) return { left: 'Match them to a feed person: no LalaVerse feed profile has their name.' };
  if (rows.length > 1) {
    return { left: `Match them to a feed person: ${rows.length} feed profiles fit (${rows.map((r) => `@${String(r.handle).replace(/^@+/, '')}`).join(', ')}), so you choose.` };
  }
  const profile = rows[0];
  const holder = await db.RegistryCharacter.findOne({ where: { feed_profile_id: profile.id }, attributes: ['id', 'display_name'] });
  if (holder && holder.id !== character.id) {
    return { left: `Match them to a feed person: @${String(profile.handle).replace(/^@+/, '')} is already ${holder.display_name}'s.` };
  }
  const before = { feed_profile_id: character.feed_profile_id ?? null, social_presence: character.social_presence ?? null };
  await character.update({ feed_profile_id: profile.id, social_presence: true });
  return {
    change: {
      kind: 'feed_profile', label: `Matched to @${String(profile.handle).replace(/^@+/, '')}`,
      before, after: { feed_profile_id: profile.id, social_presence: true },
    },
  };
}

// ── 2. Followers: the estimate confirmed ────────────────────────────────────
const FEED_COUNT_FIELDS = ['follower_count_approx', 'follower_tier', 'full_profile', 'platform_presences'];

async function confirmFollowers(db, found, facts, by) {
  if (!facts.followers?.show_id) return { left: "Confirm followers: their registry has no show yet, so there is no count to keep. Choose their registry's show." };
  const { setFacts } = require('./characterFacts');
  const feedBefore = {};
  for (const f of FEED_COUNT_FIELDS) feedBefore[f] = json(found.feedProfile[f]);
  await setFacts(db, { ...found, showId: facts.followers.show_id, body: { followers: { count: facts.followers.count, reason: REASON } }, by });
  const [[row]] = await db.sequelize.query(
    `SELECT id FROM pulse_followers WHERE show_id = :show AND social_profile_id = :pid AND status = 'accepted' AND deleted_at IS NULL
      ORDER BY created_at DESC LIMIT 1`, { replacements: { show: facts.followers.show_id, pid: found.feedProfile.id } });
  await found.feedProfile.reload();
  const feedAfter = {};
  for (const f of FEED_COUNT_FIELDS) feedAfter[f] = json(found.feedProfile[f]);
  return {
    change: {
      kind: 'followers', label: `Followers confirmed at ${facts.followers.label}`,
      ledger_id: row?.id || null, show_id: facts.followers.show_id, count: facts.followers.count,
      before: feedBefore, after: feedAfter,
    },
  };
}

// ── 3. Occupation, income, what they own ────────────────────────────────────
async function fillFacts(db, found, by) {
  const { suggestFacts } = require('./factsSuggest');
  const { setFacts, factsOf, FactsError } = require('./characterFacts');
  let suggested;
  try {
    suggested = await suggestFacts(db, found);
  } catch (err) {
    if (err instanceof FactsError) return { left: `Set their facts: ${err.message}` };
    throw err;
  }
  // Only into facts still missing now (nothing set while the call ran is overwritten).
  const now = await factsOf(db, found);
  const undecided = new Set(now.undecided);
  const isMissing = (k) => !undecided.has(k) && (k === 'income' ? now.income?.amount == null
    : k === 'major_possessions' ? !(now.major_possessions || []).length : !now[k]);
  const body = {};
  const before = {};
  for (const k of FACT_FIELDS) {
    if (suggested.proposal[k] === undefined || !isMissing(k)) continue;
    body[k] = suggested.proposal[k];
    before[k] = json((found.character.canon_facts || {})[k] ?? null);
  }
  if (!Object.keys(body).length) return { left: 'Set their facts: nothing missing was proposed.' };
  await setFacts(db, { ...found, body: { ...body, reason: suggested.why ? `${REASON} ${suggested.why}`.slice(0, 500) : REASON }, by });
  await found.character.reload();
  const after = {};
  for (const k of Object.keys(body)) after[k] = json(found.character.canon_facts[k]);
  const words = { occupation: 'work', income: 'income', major_possessions: 'what they own' };
  return { change: { kind: 'facts', label: `Set their ${Object.keys(body).map((k) => words[k]).join(', ')}`, why: suggested.why, before, after } };
}

// ── 4. Their type ───────────────────────────────────────────────────────────
async function setType(db, character, by) {
  const { suggestTypology, normalizeTypology, typologyLabel, TypologyError } = require('./characterTypology');
  const { factsForCharacter, factsPromptBlock } = require('./characterFacts');
  let suggestion;
  try {
    suggestion = await suggestTypology(character, { factsBlock: factsPromptBlock(await factsForCharacter(db, character)) });
  } catch (err) {
    if (err instanceof TypologyError) return { left: `Their type: ${err.message}` };
    throw err;
  }
  const next = normalizeTypology(suggestion, { by });
  await character.update({ typology: next });
  return { change: { kind: 'typology', label: `Type set: ${typologyLabel(next)}`, why: next.why, before: null, after: json(next) } };
}

// ── 5. Findings ─────────────────────────────────────────────────────────────
async function fixFindings(db, found) {
  const { checkCharacter, applyFix, FixError } = require('./characterConsistency');
  const flagLog = require('./flagLog');
  const changes = [];
  const left = [];
  const check = await checkCharacter(db, found);
  for (const flag of check.flags.filter((f) => f.fix !== null)) {
    let before;
    try {
      before = json(readField(found, flag.field));
      await applyFix(db, found, flag.id, {});
      await flagLog.markFixed(db, found.character.id, flag.id);
    } catch (err) {
      if (err instanceof FixError || err instanceof FixAllError) { left.push(`A finding in ${flag.field_label}: ${err.message}`); continue; }
      throw err;
    }
    changes.push({
      kind: 'text', label: `${flag.field_label}: "${flag.found}" → "${flag.fix}"`,
      field: flag.field, before, after: json(readField(found, flag.field)),
    });
  }
  const { suggestFixes, AutofixError } = require('./checkAutofix');
  let queued = [];
  try {
    const labels = new Map(check.flags.map((f) => [f.id, f.field_label]));
    queued = (await suggestFixes(db, found)).map((s) => ({ ...s, character_id: found.character.id, field_label: labels.get(s.flag_id) || null }));
  } catch (err) {
    if (!(err instanceof AutofixError)) throw err;
    left.push(`The other findings: ${err.message}`);
  }
  const after = await checkCharacter(db, found);
  await flagLog.logCheck(db, found.character, after);
  const unanswered = after.flags.length - queued.length;
  if (unanswered > 0) left.push(`${unanswered} finding${unanswered === 1 ? '' : 's'} with no suggestion: open their page to fix ${unanswered === 1 ? 'it' : 'them'}.`);
  return { changes, queued, left };
}

// ── 6. Their voice ──────────────────────────────────────────────────────────
async function buildVoiceFor(db, found) {
  const { buildVoice, VoiceError, POSTING_STAGES } = require('./pulseVoices');
  if (await db.PulseVoice.findOne({ where: { registry_character_id: found.character.id } })) return {};
  if (!POSTING_STAGES.includes(found.character.depth_level)) return { left: 'Their voice: make them Active first.' };
  try {
    const voice = await buildVoice(db, found.character.id);
    return { change: { kind: 'voice', label: 'Voice built: waiting for your approval', voice_id: voice.id, before: null, after: { voice_id: voice.id } } };
  } catch (err) {
    if (err instanceof VoiceError || err?.code === 'PULSE_REQUESTS_USED') return { left: `Their voice: ${err.message}` };
    throw err;
  }
}

/** One character through the six steps. Throws only on a budget stop or a fault. */
async function fixOne(db, character, by, out) {
  const { factsOf } = require('./characterFacts');
  const { factStates } = require('./castConsistency');
  const add = (r) => {
    if (r.change) out.changes.push({ id: changeId(), character_id: character.id, ...r.change });
    if (r.left) out.left.push(r.left);
  };

  if (!character.feed_profile_id) {
    add(await matchFeedProfile(db, character));
    if (!character.feed_profile_id) return;
  }
  const found = await loadFound(db, character.id);

  let facts = await factsOf(db, found);
  if (facts.followers?.source === 'estimate' && !facts.undecided.includes('followers')) add(await confirmFollowers(db, found, facts, by));

  facts = await factsOf(db, found);
  const states = factStates(facts);
  if (FACT_FIELDS.some((k) => states[k] === 'missing')) add(await fillFacts(db, found, by));

  if (!require('./characterTypology').typologyLabel(found.character.typology)) add(await setType(db, found.character, by));

  const findings = await fixFindings(db, found);
  for (const c of findings.changes) out.changes.push({ id: changeId(), character_id: character.id, ...c });
  out.queued.push(...findings.queued);
  out.left.push(...findings.left);

  const statesNow = factStates(await factsOf(db, found));
  const stillMissing = ['followers', ...FACT_FIELDS].filter((k) => statesNow[k] === 'missing' || statesNow[k] === 'estimate');
  if (stillMissing.length) {
    if (!(await db.PulseVoice.findOne({ where: { registry_character_id: character.id } }))) out.left.push('Their voice: built once their facts are set.');
  } else {
    add(await buildVoiceFor(db, found));
  }
}

async function fixAll(db, registryIds, { by = null } = {}) {
  const characters = await db.RegistryCharacter.findAll({ where: { registry_id: registryIds }, order: [['display_name', 'ASC']] });
  const rows = [];
  let stopped = null;
  for (const character of characters) {
    if (isCounselor(character)) continue;
    const out = { id: character.id, name: nameOf(character), changes: [], queued: [], left: [] };
    rows.push(out);
    if (stopped) { out.left.push('Not reached: the run stopped.'); continue; }
    try {
      await fixOne(db, character, by, out);
    } catch (err) {
      if (isBudgetStop(err)) {
        console.error(`[castFixAll] the AI budget stopped the run at ${character.id}:`, err.message);
        stopped = err.message;
        out.left.push(`Stopped here: ${err.message}`);
      } else {
        console.error(`[castFixAll] ${character.id} could not be finished:`, err);
        out.left.push(`Something went wrong here (${err.message}); what was done before it stays.`);
      }
    }
  }
  return {
    characters: rows,
    stopped,
    summary: {
      characters: rows.length,
      changes: rows.reduce((n, r) => n + r.changes.length, 0),
      queued: rows.reduce((n, r) => n + r.queued.length, 0),
      left: rows.filter((r) => r.left.length).length,
    },
  };
}

// ── One character's findings, fixed in one click ────────────────────────────
/**
 * Fix their profile (Evoni, 2026-10-19: "when i click Check their profile
 * against these facts it tell me to fix but i want it to automatically fix
 * it for me inside character profiles"): every finding on one character,
 * fixed at once from their page — the one-right-wording fixes, then the
 * suggested rewrites applied and the "fine as written" ones kept as
 * intentional, without a separate Apply all. Each change comes back with
 * what Undo needs (POST /api/v1/cast/consistency/undo). What could not be
 * fixed is left, with why. One AI call (the suggestions).
 */
async function fixCharacter(db, characterId) {
  const found = await loadFound(db, characterId);
  if (isCounselor(found.character)) throw new FixAllError(403, 'That character is not changed here.');
  const findings = await fixFindings(db, found);
  const changes = findings.changes.map((c) => ({ id: changeId(), character_id: found.character.id, ...c }));
  const left = [...findings.left];
  if (findings.queued.length) {
    for (const r of await applyQueued(db, findings.queued)) {
      if (r.ok) changes.push(r.change);
      else left.push(`A finding could not be fixed: ${r.error}`);
    }
  }
  const { checkCharacter } = require('./characterConsistency');
  const check = await checkCharacter(db, await loadFound(db, found.character.id));
  await require('./flagLog').logCheck(db, found.character, check);
  return { changes, left, check };
}

// ── Apply all (her one click) ────────────────────────────────────────────────
async function applyQueued(db, items) {
  if (!Array.isArray(items) || !items.length || items.length > 200) throw new FixAllError(400, 'items must be a list of 1 to 200 suggestions.');
  const { applyFix, withIntentional, FixError } = require('./characterConsistency');
  const flagLog = require('./flagLog');
  const results = [];
  for (const item of items) {
    const base = { character_id: item?.character_id, flag_id: item?.flag_id, verdict: item?.verdict };
    try {
      if (!/^[0-9a-f-]{36}$/i.test(String(item?.character_id)) || !/^[0-9a-f]{12}$/.test(String(item?.flag_id))) throw new FixAllError(400, 'Each item needs its character and finding.');
      const found = await loadFound(db, item.character_id);
      if (isCounselor(found.character)) throw new FixAllError(403, 'That character is not changed here.');
      if (item.verdict === 'fine') {
        const next = withIntentional(found.character.canon_facts, item.flag_id, { note: item.why || 'Reads fine as written (Fix what can be fixed).' });
        await found.character.update({ canon_facts: next });
        await flagLog.markIntentional(db, found.character.id, item.flag_id, true);
        results.push({ ...base, ok: true, change: { id: changeId(), character_id: found.character.id, kind: 'intentional', flag_id: item.flag_id, label: 'Kept as written' } });
        continue;
      }
      if (item.verdict !== 'fix') throw new FixAllError(400, 'verdict is fix or fine.');
      const { checkCharacter } = require('./characterConsistency');
      const flag = (await checkCharacter(db, found)).flags.find((f) => f.id === item.flag_id);
      if (!flag) throw new FixAllError(409, 'That finding is no longer there.');
      const before = json(readField(found, flag.field));
      await applyFix(db, found, item.flag_id, { replace: { before: item.before, after: item.after } });
      await flagLog.markFixed(db, found.character.id, item.flag_id);
      results.push({
        ...base, ok: true,
        change: { id: changeId(), character_id: found.character.id, kind: 'text', label: `${flag.field_label}: rewritten`, field: flag.field, before, after: json(readField(found, flag.field)) },
      });
    } catch (err) {
      if (err instanceof FixError || err instanceof FixAllError) { results.push({ ...base, ok: false, error: err.message }); continue; }
      console.error('[castFixAll] a queued suggestion could not be applied:', err);
      results.push({ ...base, ok: false, error: err.message });
    }
  }
  return results;
}

// ── Undo ────────────────────────────────────────────────────────────────────
const CHANGED = 'It has changed since, so it was not undone.';

async function undoChange(db, change, { by = null } = {}) {
  if (!change || typeof change !== 'object' || !/^[0-9a-f-]{36}$/i.test(String(change.character_id))) throw new FixAllError(400, 'change must be a change from this run.');
  const found = await loadFound(db, change.character_id);
  if (isCounselor(found.character)) throw new FixAllError(403, 'That character is not changed here.');
  const { character, feedProfile } = found;
  switch (change.kind) {
    case 'feed_profile': {
      if (character.feed_profile_id !== change.after?.feed_profile_id) throw new FixAllError(409, CHANGED);
      await character.update({ feed_profile_id: change.before?.feed_profile_id ?? null, social_presence: change.before?.social_presence ?? null });
      return { ok: true };
    }
    case 'followers': {
      if (!feedProfile || !change.ledger_id) throw new FixAllError(409, CHANGED);
      const { countAt } = require('./pulseFollowers');
      const row = await db.PulseFollower.findByPk(change.ledger_id);
      if (!row || row.social_profile_id !== feedProfile.id || (await countAt(db, change.show_id, feedProfile.id)) !== change.count) throw new FixAllError(409, CHANGED);
      for (const f of FEED_COUNT_FIELDS) if (!same(feedProfile[f], change.after?.[f])) throw new FixAllError(409, CHANGED);
      await db.sequelize.transaction(async (transaction) => {
        await row.destroy({ transaction });
        const restore = {};
        for (const f of FEED_COUNT_FIELDS) restore[f] = change.before?.[f] ?? null;
        await feedProfile.update(restore, { transaction });
      });
      return { ok: true };
    }
    case 'facts': {
      const stored = character.canon_facts || {};
      const keys = Object.keys(change.after || {}).filter((k) => FACT_FIELDS.includes(k));
      if (!keys.length || keys.some((k) => !same(stored[k] ?? null, change.after[k]))) throw new FixAllError(409, CHANGED);
      const body = { reason: 'Undone: Fix what can be fixed.' };
      for (const k of keys) body[k] = change.before?.[k] ?? (k === 'major_possessions' ? [] : null);
      await require('./characterFacts').setFacts(db, { ...found, body, by });
      return { ok: true };
    }
    case 'typology': {
      if (!same(character.typology, change.after)) throw new FixAllError(409, CHANGED);
      await character.update({ typology: change.before ?? null });
      return { ok: true };
    }
    case 'text': {
      if (!same(readField(found, change.field), change.after)) throw new FixAllError(409, CHANGED);
      await writeField(found, change.field, change.before);
      return { ok: true };
    }
    case 'voice': {
      const voice = await db.PulseVoice.findOne({ where: { id: change.voice_id, registry_character_id: character.id } });
      if (!voice) throw new FixAllError(409, CHANGED);
      if (voice.approved_at) throw new FixAllError(409, 'You have approved this voice since, so it was not undone.');
      await voice.destroy();
      return { ok: true };
    }
    case 'intentional': {
      const { withIntentional } = require('./characterConsistency');
      if (!(character.canon_facts?.intentional || []).some((m) => m.id === change.flag_id)) throw new FixAllError(409, CHANGED);
      await character.update({ canon_facts: withIntentional(character.canon_facts, change.flag_id, { on: false }) });
      await require('./flagLog').markIntentional(db, character.id, change.flag_id, false);
      return { ok: true };
    }
    default:
      throw new FixAllError(400, 'That kind of change cannot be undone here.');
  }
}

module.exports = { fixAll, fixCharacter, applyQueued, undoChange, matchFeedProfile, FixAllError, isBudgetStop };
