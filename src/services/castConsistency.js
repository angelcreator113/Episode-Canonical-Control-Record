'use strict';

/**
 * The cast rollout (Character Consistency Engine, the spec's #16: prove it
 * on Maren, then roll it across the cast; Evoni, 2026-10-17: "start the
 * cast rollout"). One row per live character in the registries asked for,
 * so the cast can be worked through the way Maren was:
 *
 *   castOverview(db, registryIds) → { characters: [row], summary }
 *     row: { id, name, registry_id, depth_level, handle,
 *            facts: { handle, followers, account_status, income, occupation,
 *                     major_possessions } each 'set' | 'estimate' (followers
 *                     read from the profile's text, not set on the fact
 *                     sheet) | 'undecided' | 'missing',
 *            findings, intentional (the flag-only check's counts; null with
 *            no feed profile), voice: 'none' | 'built' | 'approved',
 *            typology (its label or null), has_show, todo: [steps], ready }
 *     todo lists what is left, the next step first: match to a feed
 *     person, choose the registry's show, fix the findings, set the
 *     missing facts, make them Active, build their voice. Empty when ready.
 *     Rows needing the most come first; ready ones last.
 *
 * Reads only; no AI call. Each character's check runs as on their page
 * (services/characterConsistency), so a big cast takes a moment.
 */

const { FACT_KEYS } = require('./characterFacts');

const FACT_LABELS = {
  handle: 'handle', followers: 'followers', account_status: 'account status',
  income: 'income', occupation: 'occupation', major_possessions: 'what they own',
  home_price_range: 'home price range',
};
// Facts a character is ready without: the home price range is only read
// when their home is described (2026-10-17).
const OPTIONAL_FACTS = new Set(['home_price_range']);

function factStates(facts) {
  const undecided = new Set(facts.undecided || []);
  const has = {
    handle: Boolean(facts.handle),
    followers: facts.followers ? (facts.followers.source === 'ledger' ? 'set' : 'estimate') : false,
    account_status: Boolean(facts.account_status),
    income: facts.income?.amount != null,
    occupation: Boolean(facts.occupation),
    major_possessions: (facts.major_possessions || []).length > 0,
    home_price_range: Boolean(facts.home_price_range),
  };
  const out = {};
  for (const k of FACT_KEYS) {
    if (undecided.has(k)) out[k] = 'undecided';
    else if (has[k] === 'estimate') out[k] = 'estimate';
    else out[k] = has[k] ? 'set' : 'missing';
  }
  return out;
}

async function overviewOf(db, character) {
  const { factsOf, showIdFor } = require('./characterFacts');
  const { POSTING_STAGES } = require('./pulseVoices');
  const feedProfile = character.feed_profile_id && db.SocialProfile ? await db.SocialProfile.findByPk(character.feed_profile_id) : null;
  const showId = await showIdFor(db, character, feedProfile);
  const facts = await factsOf(db, { character, feedProfile, showId });
  const states = factStates(facts);
  let findings = null;
  let intentional = null;
  try {
    const check = await require('./characterConsistency').checkCharacter(db, { character, feedProfile });
    await require('./flagLog').logCheck(db, character, check);
    findings = check.flags.length;
    intentional = check.intentional.length;
  } catch (err) {
    console.error(`[CastConsistency] check failed for ${character.id}:`, err.message);
  }
  const voiceRow = await db.PulseVoice.findOne({ where: { registry_character_id: character.id } });
  const voice = !voiceRow ? 'none' : voiceRow.approved_at ? 'approved' : 'built';
  const { typologyLabel } = require('./characterTypology');

  const todo = [];
  if (!feedProfile) todo.push('Match them to a feed person');
  else {
    if (!showId) todo.push("Choose their registry's show");
    if (findings) todo.push(`Fix ${findings} finding${findings === 1 ? '' : 's'}`);
    const missing = FACT_KEYS.filter((k) => !OPTIONAL_FACTS.has(k) && (states[k] === 'missing' || states[k] === 'estimate'));
    if (missing.length) todo.push(`Set their facts: ${missing.map((k) => (states[k] === 'estimate' ? `confirm ${FACT_LABELS[k]}` : FACT_LABELS[k])).join(', ')}`);
    if (voice === 'none') todo.push(POSTING_STAGES.includes(character.depth_level) ? 'Build their voice' : 'Make Active, then build their voice');
  }
  return {
    id: character.id,
    name: character.selected_name || character.display_name,
    registry_id: character.registry_id,
    depth_level: character.depth_level || null,
    handle: facts.handle,
    facts: states,
    findings,
    intentional,
    voice,
    typology: typologyLabel(character.typology) || null,
    has_show: Boolean(showId),
    todo,
    ready: todo.length === 0,
  };
}

async function castOverview(db, registryIds) {
  const characters = await db.RegistryCharacter.findAll({ where: { registry_id: registryIds }, order: [['display_name', 'ASC']] });
  const rows = [];
  for (const c of characters) rows.push(await overviewOf(db, c));
  const weight = (r) => (r.ready ? -1 : r.todo.length * 100 + (r.findings || 0));
  rows.sort((a, b) => weight(b) - weight(a) || String(a.name).localeCompare(String(b.name)));
  return {
    characters: rows,
    summary: {
      characters: rows.length,
      ready: rows.filter((r) => r.ready).length,
      with_findings: rows.filter((r) => r.findings).length,
      without_voice: rows.filter((r) => r.voice === 'none').length,
    },
  };
}

module.exports = { castOverview, factStates, FACT_LABELS };
