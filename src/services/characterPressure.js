'use strict';

/**
 * Pressure test (Character Consistency Engine, the spec's Future Enhancement
 * #6: "a button that interrogates a character with hard questions ('you
 * can't afford this home on this income — explain'); the profile either
 * answers from its own data or fails"; Evoni, 2026-10-17: "yes start the
 * pressure test").
 *
 * One Sonnet call reads the whole character file (services/characterFile:
 * facts, type, inner life, mask, what is behind it, people, events, latest
 * posts) and asks the hard questions a fact-checker would: money against
 * what they own, their status against their posting, their type against
 * what they do, one section against another. It then answers each one
 * from the file alone, and says whether the file answers it, has a gap
 * (nothing written decides it) or contradicts itself. A gap between the
 * mask and what is behind it is the character lying, never a failure.
 * Nothing is saved or changed: it is a reading for Evoni.
 *
 *   pressureTest(db, { character, feedProfile }) →
 *     { questions: [{ question, about, verdict, answer, cites, fix }],
 *       summary: { answers, gaps, contradictions }, verdict }
 *     verdict: 'holds' (every answer from the file), 'gaps' or 'fails'
 *     (a contradiction). A PressureError 409 when too little is written to
 *     test, 502 when the answer cannot be read.
 */

const MODELS = ['claude-sonnet-4-6'];
const VERDICTS = ['answers', 'gap', 'contradiction'];
const ABOUT = ['money', 'status', 'possessions', 'type', 'relationships', 'events', 'posts', 'timeline', 'other'];
const MAX_QUESTIONS = 8;
// The file must say this much before a test means anything.
const MIN_FILE_CHARS = 400;

class PressureError extends Error {
  constructor(status, message) { super(message); this.status = status; this.name = 'PressureError'; }
}

let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const text = (v, n) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');

function buildPrompt(name, block) {
  return `You are a fact-checker pressure-testing a fictional character before they go on screen. The character must hold up "through and through": every hard question about them should be answerable from their own file.

${block}

Ask up to ${MAX_QUESTIONS} of the hardest questions a skeptical reader could ask about ${name}, the ones most likely to expose a hole. Cover what applies:
- money: can they afford what they own, wear and do on the income in their facts?
- status: does their account status fit how and when they post?
- type: does what they do and want follow from their typology seed?
- one section against another: does the inner life, the relationships, the events and the posts tell one story?
- what is not decided yet: does anything in the file quietly assume it?

Then answer each one using ONLY the file above. Quote or name the part you use. Rules:
- "answers": the file answers it consistently.
- "gap": nothing in the file decides it (it is not wrong, it is missing). A fact marked "not decided yet" is a gap only if something else in the file depends on it.
- "contradiction": two parts of the file disagree in a way the character's mask does not explain.
- THE MASK versus BEHIND THE MASK is the character lying on purpose: a difference there is never a contradiction. Only flag the mask if it contradicts a FACT the public can see (their handle, their follower count, their account status).
- For a gap or contradiction, say in one line what to write or change to fix it.

Answer with JSON only:
{"questions": [{"question": "the hard question", "about": one of ${JSON.stringify(ABOUT)}, "verdict": "answers" | "gap" | "contradiction", "answer": "the answer from the file, or what is missing or contradicts, two sentences at most", "cites": ["the file parts used, e.g. FACTS income, INNER LIFE want architecture"], "fix": "for a gap or contradiction: what to write or change; else null"}]}`;
}

function cleanQuestion(q) {
  if (!q || typeof q !== 'object') return null;
  const question = text(q.question, 300);
  const verdict = VERDICTS.includes(q.verdict) ? q.verdict : null;
  if (!question || !verdict) return null;
  return {
    question,
    about: ABOUT.includes(q.about) ? q.about : 'other',
    verdict,
    answer: text(q.answer, 600),
    cites: Array.isArray(q.cites) ? q.cites.map((c) => text(c, 80)).filter(Boolean).slice(0, 4) : [],
    fix: verdict === 'answers' ? null : (text(q.fix, 300) || null),
  };
}

async function pressureTest(db, { character, feedProfile } = {}) {
  if (!character) throw new PressureError(404, 'Character not found.');
  const { file, block } = await require('./characterFile').characterFilePrompt(db, { character, ...(feedProfile !== undefined ? { feedProfile } : {}) });
  if (block.length < MIN_FILE_CHARS) {
    throw new PressureError(409, 'There is too little written about them to test yet. Fill their facts and their inner life first.');
  }
  const name = file.character?.selected_name || file.character?.display_name || 'this character';

  let message;
  for (const model of MODELS) {
    try {
      message = await getClient().messages.create({ model, max_tokens: 2500, messages: [{ role: 'user', content: buildPrompt(name, block) }] });
      break;
    } catch (modelErr) {
      console.warn(`[characterPressure] testing with ${model} failed:`, modelErr.message);
      if (model === MODELS[MODELS.length - 1]) throw modelErr;
    }
  }
  const raw = (message?.content?.[0]?.text || '').trim();
  let parsed;
  try {
    parsed = JSON.parse((raw.match(/\{[\s\S]*\}/) || [raw])[0]);
  } catch (err) {
    console.error('[characterPressure] the test could not be read:', err.message);
    throw new PressureError(502, 'The test came back in a form that could not be read. Try again.');
  }
  const questions = (Array.isArray(parsed?.questions) ? parsed.questions : []).map(cleanQuestion).filter(Boolean).slice(0, MAX_QUESTIONS);
  if (!questions.length) throw new PressureError(502, 'The test came back with no questions. Try again.');
  const count = (v) => questions.filter((q) => q.verdict === v).length;
  const summary = { answers: count('answers'), gaps: count('gap'), contradictions: count('contradiction') };
  const verdict = summary.contradictions ? 'fails' : summary.gaps ? 'gaps' : 'holds';
  // Hardest first: contradictions, then gaps, then what holds.
  const rank = { contradiction: 0, gap: 1, answers: 2 };
  questions.sort((a, b) => rank[a.verdict] - rank[b.verdict]);
  return { questions, summary, verdict };
}

module.exports = { pressureTest, buildPrompt, cleanQuestion, PressureError, VERDICTS, MAX_QUESTIONS };
