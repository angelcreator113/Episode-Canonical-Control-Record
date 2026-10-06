'use strict';

/**
 * Reaction drafting (the Feed project, step 4, 2026-10-04;
 * docs/FEED_POSTS.md rule 6). When a character posts, the characters
 * connected to them react: this drafts their comments, in their own
 * voices, as feed_comments rows with status 'draft' for Evoni to approve,
 * edit or delete. Nothing goes live on its own.
 *
 * Who reacts: the poster's connections in social_profile_relationships
 * (either direction), then the profiles most relevant to Lala, up to
 * `limit`; the caller may pick the reactors instead (reactor_ids).
 * The AI call is one Claude message (claude-sonnet-4-6, two attempts),
 * logged and budget-gated by aiCostTracker's client patch.
 */

const { Op } = require('sequelize');
const { loadBrainContext, recordRuleUse } = require('./brainRules');

const MODELS = ['claude-sonnet-4-6'];
const DEFAULT_LIMIT = 4;
const VOICE_ATTRIBUTES = ['id', 'handle', 'display_name', 'creator_name', 'platform', 'archetype', 'posting_voice', 'content_persona', 'follow_emotion', 'career_pressure', 'lala_relevance_score'];
const COMMENT_LOCKED = 'A live comment cannot be edited, only deleted (2009 rule). Edit it while it is a draft.';

class DraftError extends Error {
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

/** The characters who would react to this post, with why. */
async function pickReactors(models, post, { limit = DEFAULT_LIMIT } = {}) {
  const { SocialProfile, SocialProfileRelationship } = models;
  if (!SocialProfile) return [];
  const live = { status: { [Op.in]: ['generated', 'finalized', 'crossed'] } };
  const picked = [];
  const seen = new Set(post.social_profile_id ? [post.social_profile_id] : []);

  if (post.social_profile_id && SocialProfileRelationship) {
    const rels = await SocialProfileRelationship.findAll({
      where: { [Op.or]: [{ source_profile_id: post.social_profile_id }, { target_profile_id: post.social_profile_id }] },
      attributes: ['source_profile_id', 'target_profile_id', 'relationship_type', 'drama_level'],
      order: [['drama_level', 'DESC']],
    });
    const byId = new Map();
    for (const r of rels) {
      const other = r.source_profile_id === post.social_profile_id ? r.target_profile_id : r.source_profile_id;
      if (!seen.has(other) && !byId.has(other)) byId.set(other, r.relationship_type);
    }
    if (byId.size > 0) {
      const profiles = await SocialProfile.findAll({ where: { id: { [Op.in]: [...byId.keys()] }, ...live }, attributes: VOICE_ATTRIBUTES });
      for (const p of profiles) {
        if (picked.length >= limit) break;
        picked.push({ profile: p, relationship: byId.get(p.id) });
        seen.add(p.id);
      }
    }
  }

  if (picked.length < limit) {
    const more = await SocialProfile.findAll({
      where: { ...live, ...(seen.size ? { id: { [Op.notIn]: [...seen] } } : {}) },
      attributes: VOICE_ATTRIBUTES,
      order: [['lala_relevance_score', 'DESC'], ['id', 'ASC']],
      limit: limit - picked.length,
    });
    for (const p of more) picked.push({ profile: p, relationship: null });
  }
  return picked;
}

function buildPrompt(post, reactors, brainBlock = null) {
  const voices = reactors.map(({ profile: p, relationship }, i) => {
    const bits = [
      `${i + 1}. @${p.handle}${p.display_name ? ` (${p.display_name})` : ''}${p.archetype ? `, ${p.archetype.replace(/_/g, ' ')}` : ''}`,
      relationship ? `   relationship to the poster: ${relationship.replace(/_/g, ' ')}` : null,
      p.posting_voice ? `   voice: ${String(p.posting_voice).slice(0, 300)}` : null,
      p.content_persona ? `   persona: ${String(p.content_persona).slice(0, 200)}` : null,
      p.career_pressure ? `   career pressure: ${p.career_pressure}` : null,
    ].filter(Boolean);
    return bits.join('\n');
  }).join('\n');
  return `A character in the LalaVerse (a 2009-style social feed) just posted. Write one comment from each of the characters below, in that character's own voice, reacting to the post as that character would given their relationship to the poster. Short, in-character, no hashtags unless the voice uses them, no emoji walls. One comment per character, in the order given.

THE POST
@${post.poster_handle}${post.poster_display_name ? ` (${post.poster_display_name})` : ''} on ${post.poster_platform || 'the feed'}:
"${(post.content_text || '').slice(0, 800)}"
${post.narrative_function ? `What the post does: ${post.narrative_function.replace(/_/g, ' ')}` : ''}

THE CHARACTERS WHO REACT
${voices}

${brainBlock || ''}
Return ONLY a JSON array, one object per character in order: [{ "handle": "...", "text": "..." }]`;
}

async function draftReactions(models, postId, { reactorIds = null, limit = DEFAULT_LIMIT } = {}) {
  const { FeedPost, FeedComment, SocialProfile } = models;
  if (!FeedPost || !FeedComment) throw new DraftError(500, 'Feed models not available');
  const post = await FeedPost.findOne({ where: { id: postId, deleted_at: null } });
  if (!post) throw new DraftError(404, 'Post not found');
  if (!process.env.ANTHROPIC_API_KEY) throw new DraftError(503, 'ANTHROPIC_API_KEY not configured');

  let reactors;
  if (Array.isArray(reactorIds) && reactorIds.length > 0) {
    const profiles = await SocialProfile.findAll({ where: { id: { [Op.in]: reactorIds } }, attributes: VOICE_ATTRIBUTES });
    reactors = reactorIds.map((id) => profiles.find((p) => String(p.id) === String(id))).filter(Boolean).map((profile) => ({ profile, relationship: null }));
  } else {
    reactors = await pickReactors(models, post, { limit });
  }
  if (reactors.length === 0) throw new DraftError(409, 'No characters to react: generate social profiles first');

  // The comments are canon too: the Show Bible's always-true rules (2026-10-06).
  const brain = await loadBrainContext(models, { showId: post.show_id || null, limit: 15, label: 'FeedComments' });
  const prompt = buildPrompt(post, reactors, brain.block);
  let message;
  for (const model of MODELS) {
    try {
      message = await getClient().messages.create({ model, max_tokens: 1200, messages: [{ role: 'user', content: prompt }] });
      break;
    } catch (modelErr) {
      console.warn(`[FeedComments] drafting with ${model} failed:`, modelErr.message);
      if (model === MODELS[MODELS.length - 1]) throw modelErr;
    }
  }
  await recordRuleUse(models.sequelize, brain.ids, 'FeedComments');
  const raw = (message?.content?.[0]?.text || '').trim();
  let drafts;
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    drafts = JSON.parse(match ? match[0] : raw);
  } catch (parseErr) {
    console.error('[FeedComments] could not read the drafted reactions:', parseErr.message);
    throw new DraftError(502, 'The drafter answered in a form the feed could not read. Try again.');
  }
  if (!Array.isArray(drafts)) throw new DraftError(502, 'The drafter answered in a form the feed could not read. Try again.');

  const existing = await FeedComment.count({ where: { feed_post_id: post.id } });
  const saved = [];
  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i] || {};
    const text = typeof d.text === 'string' ? d.text.trim() : '';
    if (!text) continue;
    const handle = String(d.handle || reactors[i]?.profile?.handle || '').replace(/^@/, '');
    const reactor = reactors.find((r) => r.profile.handle === handle) || reactors[i];
    if (!reactor) continue;
    saved.push(await FeedComment.create({
      feed_post_id: post.id,
      show_id: post.show_id,
      social_profile_id: reactor.profile.id,
      handle: reactor.profile.handle,
      display_name: reactor.profile.display_name || null,
      text,
      status: 'draft',
      sort_order: existing + i,
      ai_generated: true,
      generation_model: MODELS[0],
      voice_note: reactor.relationship ? `${reactor.relationship.replace(/_/g, ' ')} of the poster` : 'relevant to Lala',
    }));
  }
  return { post, reactors, drafts: saved };
}

/** comments_count on the post is its live comments. */
async function recountComments(models, postId) {
  const { FeedPost, FeedComment } = models;
  const live = await FeedComment.count({ where: { feed_post_id: postId, status: 'live' } });
  await FeedPost.update({ comments_count: live }, { where: { id: postId } });
  return live;
}

module.exports = { pickReactors, draftReactions, recountComments, buildPrompt, DraftError, COMMENT_LOCKED, MODELS, VOICE_ATTRIBUTES };
