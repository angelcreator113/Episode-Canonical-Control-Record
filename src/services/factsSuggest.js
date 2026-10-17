'use strict';

/**
 * Suggest facts from their profile (Evoni, 2026-10-17: "why aren't these
 * filled out when I auto generate profiles? Income / Occupation / Major
 * possessions / Can afford"). The generators write a character's work and
 * money as prose; nothing filled the facts. One Sonnet call reads what is
 * true about them (never the mask: what they post or claim) and proposes
 * the missing facts, with why. Nothing is saved: the fact sheet opens with
 * the proposal for Evoni to save as it is or change (approve or adjust).
 *
 *   suggestFacts(db, { character, feedProfile }) → { proposal, fills, why }
 *     proposal: { occupation?, income?: { amount, cadence, source },
 *                 major_possessions? }, only for facts that are missing:
 *     a decided fact, or one marked "not decided yet", is never proposed.
 *     A FactsError 409 when nothing is missing or nothing is written.
 */

const { FactsError, factsOf, nextCanonFacts, factsPromptBlock } = require('./characterFacts');

const MODELS = ['claude-sonnet-4-6'];
const SUGGESTABLE = ['occupation', 'income', 'major_possessions'];

// What is true about them (narrator text), not the mask.
const CHARACTER_FIELDS = [
  'description', 'prose_overview', 'career_status', 'living_context', 'truth_persona', 'core_desire',
  'want_architecture', 'living_state', 'deep_profile', 'writer_notes',
];
const PROFILE_FIELDS = [
  'vibe_sentence', 'real_signal', 'private_reality', 'lifestyle_reality', 'lifestyle_gap', 'revenue_streams',
  'monthly_earnings_range', 'income_breakdown', 'influencer_tier_detail', 'follower_tier',
];

let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const present = (v) => v !== null && v !== undefined && v !== '' && !(typeof v === 'object' && !Object.keys(v).length);
const clip = (v, n) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

function missingOf(facts) {
  const undecided = new Set(facts.undecided || []);
  return SUGGESTABLE.filter((k) => !undecided.has(k) && (
    k === 'income' ? facts.income?.amount == null
      : k === 'major_possessions' ? !(facts.major_possessions || []).length
        : !facts[k]));
}

async function suggestFacts(db, { character, feedProfile = null }) {
  const facts = await factsOf(db, { character, feedProfile });
  const missing = missingOf(facts);
  if (!missing.length) throw new FactsError(409, 'Their occupation, income and possessions are all set or marked not decided yet.');

  const c = character.toJSON ? character.toJSON() : character;
  const known = {};
  for (const f of CHARACTER_FIELDS) if (present(c[f])) known[f] = clip(c[f], 1500);
  const fp = feedProfile ? (feedProfile.toJSON ? feedProfile.toJSON() : feedProfile) : {};
  for (const f of PROFILE_FIELDS) if (present(fp[f])) known[f] = clip(fp[f], 600);
  if (!Object.keys(known).length) throw new FactsError(409, 'There is nothing written about them yet to read their facts from.');

  const asks = {
    occupation: '"occupation": what they do for a living, a few words (e.g. "Slow-fashion creator and vintage reseller")',
    income: '"income": { "amount": a whole number of dollars, "cadence": "per_year" or "per_month", "source": where the money comes from, a few words }',
    major_possessions: '"major_possessions": up to 5 things they own that matter to who they are (a home, a car, a studio, a collection), each a few words',
  };
  const prompt = `Read this character and propose their hard facts. Use only what is TRUE about them below; what they post or claim about themselves can be a lie and is not here.

Character: ${c.selected_name || c.display_name || 'this character'}
${JSON.stringify(known, null, 2)}

${factsPromptBlock(facts)}
The facts above are decided: everything you propose must agree with them (their follower count bounds what a creator earns; what they own must be affordable on the income you give).

Propose only these, missing now:
${missing.map((k) => `- ${asks[k]}`).join('\n')}

Answer with JSON only:
{${missing.map((k) => `"${k}": ...`).join(', ')}, "why": "two sentences: where in their writing each fact comes from"}`;

  let message;
  for (const model of MODELS) {
    try {
      message = await getClient().messages.create({ model, max_tokens: 600, messages: [{ role: 'user', content: prompt }] });
      break;
    } catch (modelErr) {
      console.warn(`[factsSuggest] suggesting with ${model} failed:`, modelErr.message);
      if (model === MODELS[MODELS.length - 1]) throw modelErr;
    }
  }
  const raw = (message?.content?.[0]?.text || '').trim();
  let parsed;
  try {
    parsed = JSON.parse((raw.match(/\{[\s\S]*\}/) || [raw])[0]);
  } catch (err) {
    console.error('[factsSuggest] the suggestion could not be read:', err.message);
    throw new FactsError(502, 'The suggestion came back in a form that could not be read. Try again.');
  }
  const body = {};
  for (const k of missing) if (parsed[k] !== undefined && parsed[k] !== null) body[k] = parsed[k];
  let clean;
  try {
    clean = nextCanonFacts({}, body);
  } catch (err) {
    console.error('[factsSuggest] the suggestion did not fit the facts:', err.message);
    throw new FactsError(502, 'The suggestion did not fit the facts. Try again.');
  }
  const proposal = {};
  for (const k of missing) {
    if (k === 'income' && clean.income?.amount != null) proposal.income = clean.income;
    else if (k === 'major_possessions' && clean.major_possessions?.length) proposal.major_possessions = clean.major_possessions.slice(0, 5);
    else if (k === 'occupation' && clean.occupation) proposal.occupation = clean.occupation;
  }
  if (!Object.keys(proposal).length) throw new FactsError(502, 'The suggestion had none of the missing facts. Try again.');
  return { proposal, fills: Object.keys(proposal), why: typeof parsed.why === 'string' ? parsed.why.trim().slice(0, 600) : null };
}

module.exports = { suggestFacts, missingOf, SUGGESTABLE };
