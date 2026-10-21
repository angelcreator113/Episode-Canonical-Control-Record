'use strict';

/**
 * AI help in the Thumbnail Studio (Evoni, 2026-10-21), both within the
 * daily budgets:
 *   - titleIdeas: five short titles for the thumbnail, each with a hook
 *     of a few words, from the episode's words (its title, the show, the
 *     checklist and the outfit's pieces). One Haiku call; aiCostTracker logs
 *     it and refuses it past AI_DAILY_BUDGET_USD (a 429 with its reason).
 *   - cutOut: a picture's background removed (remove.bg, else Runway: the
 *     poses' own step, episodePoseMedia.removeBackground, counted against
 *     AI_DAILY_IMAGE_BUDGET_USD), its edges cleaned, kept as one of the
 *     episode's Studio uploads.
 */

const Anthropic = require('@anthropic-ai/sdk');
const yt = require('./youtubeThumbnailService');
const { removeBackground, cleanEdges } = require('./episodePoseMedia');
const { isBudgetError } = require('./imageCostService');

// A side call: the repo's Haiku (CLAUDE.md, AI conventions).
const MODELS = ['claude-haiku-4-5-20251001'];
const IDEAS = 5;
const TITLE_MAX = 48;
const HOOK_MAX = 16;

let client = null;
const getClient = () => {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
};

// Both budgets refuse with the same code (aiCostTracker for Claude, imageCostService for pictures).
const budgetError = (err) => isBudgetError(err);

/** What the ideas are written from: the episode's own words. */
function ideaContext(src) {
  const pieces = (src.suggest?.pieces || []).map((p) => p.label).filter(Boolean);
  const checklist = (src.suggest?.checklist || []).map((c) => c.text).filter(Boolean);
  return [
    `Show: ${src.show?.name || 'Styling Adventures with Lala'}`,
    `Episode ${src.episode?.episode_number ?? ''}: ${src.episode?.title || ''}`.trim(),
    src.suggest?.edition ? `Edition: ${src.suggest.edition}` : null,
    checklist.length ? `Checklist: ${checklist.join(', ')}` : null,
    pieces.length ? `Outfit pieces: ${pieces.join(', ')}` : null,
  ].filter(Boolean).join('\n');
}

function ideaPrompt(context) {
  return `You write YouTube thumbnail text for a fashion styling show hosted by Lala.

${context}

Write ${IDEAS} different ideas for the words on this episode's thumbnail. Each has:
- "title": the big words, at most ${TITLE_MAX} characters, readable at phone size, curiosity without clickbait lies;
- "hook": a tiny sticker phrase, at most ${HOOK_MAX} characters (like "NEW", "WORTH IT?", "$29 FIND").
Use the episode's real pieces and theme. No emoji, no hashtags.

Return ONLY JSON: {"ideas": [{"title": "...", "hook": "..."}]}`;
}

/** The ideas from Claude's text: { title, hook }, trimmed to size, at most five, no repeats. */
function readIdeas(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return [];
  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch (err) {
    console.error('[ThumbnailAI] the ideas were not JSON:', err.message);
    return [];
  }
  const seen = new Set();
  return (Array.isArray(parsed?.ideas) ? parsed.ideas : [])
    .map((i) => ({ title: String(i?.title || '').trim().slice(0, TITLE_MAX), hook: String(i?.hook || '').trim().slice(0, HOOK_MAX) }))
    .filter((i) => i.title && !seen.has(i.title.toLowerCase()) && seen.add(i.title.toLowerCase()))
    .slice(0, IDEAS);
}

/** Five title ideas for an episode's thumbnail. Two tries; a budget refusal is not retried. */
async function titleIdeas(sequelize, episodeId) {
  if (!process.env.ANTHROPIC_API_KEY) throw new yt.ThumbnailError(503, 'AI help is not set up on the server (ANTHROPIC_API_KEY).');
  const src = await yt.sources(sequelize, episodeId);
  const prompt = ideaPrompt(ideaContext(src));
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await getClient().messages.create({
        model: MODELS[0],
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = (response.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      const ideas = readIdeas(text);
      if (ideas.length) return ideas;
      lastErr = new Error('no ideas in the answer');
    } catch (err) {
      if (budgetError(err)) throw new yt.ThumbnailError(429, `Today's AI budget is used up: ${err.message}`);
      console.error(`[ThumbnailAI] title ideas, try ${attempt + 1}:`, err.message);
      lastErr = err;
    }
  }
  throw new yt.ThumbnailError(502, `No title ideas this time (${lastErr?.message || 'no answer'}). Try again.`);
}

/** A picture with its background removed, kept as one of the episode's uploads: { url, label }. */
async function cutOut(episodeId, url, name = 'Picture') {
  if (!yt.allowedImageUrl(url)) throw new yt.ThumbnailError(400, 'That picture is not one of ours.');
  const buffer = await yt.fetchImage(url);
  let cut;
  try {
    cut = await removeBackground(buffer, { type: 'auto' });
  } catch (err) {
    if (budgetError(err)) throw new yt.ThumbnailError(429, `Today's image budget is used up: ${err.message}`);
    if (/not set up/i.test(err.message)) throw new yt.ThumbnailError(503, err.message);
    console.error('[ThumbnailAI] background removal failed:', err.message);
    throw new yt.ThumbnailError(502, 'The background could not be removed this time. Try again.');
  }
  const clean = await cleanEdges(cut.buffer);
  const kept = await yt.uploadPicture(episodeId, clean.buffer, `${String(name || 'Picture').slice(0, 40)} cut out`);
  return { ...kept, provider: cut.provider };
}

module.exports = { titleIdeas, cutOut, readIdeas, ideaContext, IDEAS, TITLE_MAX, HOOK_MAX };
