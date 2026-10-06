'use strict';

/**
 * Redraft a feed post in its poster's voice (Producer Mode → Lala's Feed,
 * Evoni, 2026-10-05: "Redraft in their voice"). A draft only: a live post
 * is locked (services/feedPostStatus.js). The poster's voice is their
 * social profile (posting_voice, content_persona, archetype), found by the
 * post's social_profile_id, else by its handle; without one the post's own
 * text sets the voice. Evoni can add a note ("shorter", "more nervous").
 * The new text replaces the draft's, and the old text comes back so the
 * page can undo it. The AI call is one Claude message (claude-sonnet-4-6,
 * two attempts), logged and budget-gated by aiCostTracker's client patch.
 */

const { isLive, LOCKED_MESSAGE } = require('./feedPostStatus');
const { DraftError, VOICE_ATTRIBUTES } = require('./feedCommentDrafter');
const { loadBrainContext, recordRuleUse } = require('./brainRules');

const MODELS = ['claude-sonnet-4-6'];
const NOTE_MAX = 300;
const TEXT_MAX = 2000;

let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

/** The poster's social profile: by the post's profile id, else by its handle. */
async function posterProfile(models, post) {
  const { SocialProfile } = models;
  if (!SocialProfile) return null;
  if (post.social_profile_id) {
    const byId = await SocialProfile.findOne({ where: { id: post.social_profile_id }, attributes: VOICE_ATTRIBUTES });
    if (byId) return byId;
  }
  const handle = String(post.poster_handle || '').replace(/^@/, '');
  if (!handle) return null;
  return SocialProfile.findOne({ where: { handle }, attributes: VOICE_ATTRIBUTES });
}

function buildPrompt(post, profile, note, brainBlock = null) {
  const who = post.poster_display_name || profile?.display_name || `@${String(post.poster_handle || 'lala').replace(/^@/, '')}`;
  const voice = profile ? [
    profile.archetype ? `archetype: ${profile.archetype}` : null,
    profile.posting_voice ? `voice: ${String(profile.posting_voice).slice(0, 400)}` : null,
    profile.content_persona ? `persona: ${String(profile.content_persona).slice(0, 300)}` : null,
  ].filter(Boolean).join('\n') : '';
  return `A character in the LalaVerse (a 2009-style social feed) has a draft post. Rewrite it in that character's own voice, keeping what the post is about and what it does in the story. One post, about the same length or shorter, no hashtags unless the voice uses them, no emoji walls. Answer with the post's text only.

Who is posting: ${who}${post.poster_platform ? ` (${post.poster_platform})` : ''}
${voice ? `Their voice:\n${voice}\n` : 'No profile is on file: take the voice from the draft itself.\n'}${post.narrative_function ? `What the post does: ${String(post.narrative_function).replace(/_/g, ' ')}\n` : ''}${note ? `Evoni's note for this redraft: ${note}\n` : ''}
${brainBlock ? `${brainBlock}\n` : ''}The draft:
${post.content_text || ''}`;
}

/** { post, previous_text } after rewriting the draft's text in its poster's voice. */
async function redraftPost(models, postId, { note = null } = {}) {
  const { FeedPost } = models;
  if (!FeedPost) throw new DraftError(500, 'Feed models not available');
  const post = await FeedPost.findOne({ where: { id: postId, deleted_at: null } });
  if (!post) throw new DraftError(404, 'Post not found');
  if (isLive(post)) throw new DraftError(409, LOCKED_MESSAGE);
  if (note != null && (typeof note !== 'string' || note.length > NOTE_MAX)) throw new DraftError(400, `note must be text of at most ${NOTE_MAX} characters`);
  if (!process.env.ANTHROPIC_API_KEY) throw new DraftError(503, 'ANTHROPIC_API_KEY not configured');

  const profile = await posterProfile(models, post);
  // A redraft stays canon: the Show Bible's always-true rules (2026-10-06).
  const brain = await loadBrainContext(models, { showId: post.show_id || null, limit: 15, label: 'FeedRedraft' });
  const prompt = buildPrompt(post, profile, note ? note.trim() : null, brain.block);
  let message;
  for (const model of MODELS) {
    try {
      message = await getClient().messages.create({ model, max_tokens: 700, messages: [{ role: 'user', content: prompt }] });
      break;
    } catch (modelErr) {
      console.warn(`[FeedRedraft] redrafting with ${model} failed:`, modelErr.message);
      if (model === MODELS[MODELS.length - 1]) throw modelErr;
    }
  }
  await recordRuleUse(models.sequelize, brain.ids, 'FeedRedraft');
  const text = (message?.content?.[0]?.text || '').trim().replace(/^["“](.*)["”]$/s, '$1').trim();
  if (!text) throw new DraftError(502, 'The redraft came back empty. Try again.');

  const previous = post.content_text;
  await post.update({ content_text: text.slice(0, TEXT_MAX), ai_generated: true });
  return { post, previous_text: previous, voice: profile ? (profile.handle || null) : null };
}

module.exports = { redraftPost, buildPrompt, posterProfile, MODELS, NOTE_MAX };
