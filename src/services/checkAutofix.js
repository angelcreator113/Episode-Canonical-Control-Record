'use strict';

/**
 * Suggested fixes for the consistency check (Evoni, 2026-10-17: "i want to
 * be able to auto fix the text issues"). The check (services/
 * characterConsistency) gives a one-click fix only where there is a single
 * right wording (a follower count, a handle, a name). For the rest (an
 * account status, a luxury they can't afford), one Sonnet call reads each
 * finding's sentence against their facts and proposes either:
 *   fix   the sentence rewritten to agree with the facts, changing as
 *         little as it can and keeping the writing's voice; or
 *   fine  it does not really disagree (it is about someone else, a mood,
 *         a figure of speech), with why, so Evoni can mark it intentional.
 * Nothing is saved: a rewrite is applied through applyFix's `replace`
 * (POST /cast/characters/:id/check/fix { flag_id, before, after }).
 *
 *   suggestFixes(db, { character, feedProfile }) → [{ flag_id, verdict,
 *     before, after, why }]   before is the sentence as it stands
 */

const { checkCharacter, sentenceAt } = require('./characterConsistency');
const { factsOf, factsPromptBlock } = require('./characterFacts');

const MODELS = ['claude-sonnet-4-6'];
const MAX_FLAGS = 20;

class AutofixError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

/** The sentence of the flag's field that holds what was found, or null. */
function sentenceOf(flag) {
  if (!flag.editable || typeof flag.text !== 'string') return null;
  const i = flag.text.indexOf(flag.found);
  if (i < 0) return null;
  const { sentence } = sentenceAt(flag.text, i);
  return sentence.trim() ? sentence.trim() : null;
}

async function suggestFixes(db, { character, feedProfile = null }) {
  const check = await checkCharacter(db, { character, feedProfile });
  const open = check.flags
    .filter((f) => f.fix == null)
    .map((f) => ({ flag: f, sentence: sentenceOf(f) }))
    .filter((x) => x.sentence)
    .slice(0, MAX_FLAGS);
  if (!open.length) return [];

  const facts = await factsOf(db, { character, feedProfile });
  const name = character.selected_name || character.display_name || 'this character';
  const prompt = `A consistency check found places in ${name}'s profile that may disagree with their facts. For each sentence, decide:
- "fix": it really does say something about ${name} that the facts contradict. Rewrite only that sentence so it agrees with the facts: change as few words as you can, keep its voice, tense and detail, and keep anything it says about other people.
- "fine": it does not really disagree, because it is about someone or something else, a mood or a figure of speech, or the past before the facts became true. Say why in one line.

${factsPromptBlock(facts)}

${open.map((x, i) => `${i + 1}. In "${x.flag.field_label}" (flagged "${x.flag.found}"; the facts say ${x.flag.expected}):\n   ${x.sentence}`).join('\n')}

Answer with JSON only, one entry per sentence, numbered as above:
{"items": [{"n": 1, "verdict": "fix" | "fine", "sentence": "the rewritten sentence (fix only)", "why": "one line"}]}`;

  let message;
  for (const model of MODELS) {
    try {
      message = await getClient().messages.create({ model, max_tokens: 250 * open.length + 300, messages: [{ role: 'user', content: prompt }] });
      break;
    } catch (modelErr) {
      console.warn(`[checkAutofix] suggesting with ${model} failed:`, modelErr.message);
      if (model === MODELS[MODELS.length - 1]) throw modelErr;
    }
  }
  const raw = (message?.content?.[0]?.text || '').trim();
  let items;
  try {
    items = JSON.parse((raw.match(/\{[\s\S]*\}/) || [raw])[0]).items;
  } catch (parseErr) {
    console.error('[checkAutofix] the suggestions could not be read:', parseErr.message);
    throw new AutofixError(502, 'The suggestions came back in a form that could not be read. Try again.');
  }
  const byN = new Map((Array.isArray(items) ? items : []).filter((it) => Number.isInteger(it?.n)).map((it) => [it.n, it]));
  return open.map((x, i) => {
    const it = byN.get(i + 1);
    if (!it) return null;
    const why = typeof it.why === 'string' ? it.why.trim().slice(0, 300) : '';
    if (it.verdict === 'fine') return { flag_id: x.flag.id, verdict: 'fine', before: x.sentence, after: null, why };
    const after = typeof it.sentence === 'string' ? it.sentence.replace(/\s+/g, ' ').trim().slice(0, 2000) : '';
    if (it.verdict !== 'fix' || !after || after === x.sentence) return null;
    return { flag_id: x.flag.id, verdict: 'fix', before: x.sentence, after, why };
  }).filter(Boolean);
}

module.exports = { MODELS, AutofixError, suggestFixes, sentenceOf };
