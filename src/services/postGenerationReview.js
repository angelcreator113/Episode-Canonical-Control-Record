'use strict';

/**
 * The post-generation review (Evoni's ruling, 2026-10-08: keep it and wire
 * it up). After Evaluate sets a story's final text (story.text, the
 * synthesised version the write-back puts in the manuscript), a Haiku pass
 * reads that text against the franchise's critical laws and saves a
 * post_generation_reviews row naming the story. A review that fails waits
 * on the Story Dashboard until the author acknowledges it.
 *
 * Nothing ran it before: no page sent POST /reviews/post-generation a story
 * (the episode review page sent a scene_id the route never read), the route
 * reviewed evaluation_result.approved_version or story_a rather than the
 * final text, and story_id was an INTEGER that could not hold a story's
 * UUID (migration 20261008210000).
 *
 * The call goes through the Anthropic SDK, which aiCostTracker patches, so
 * it is logged to ai_usage_logs and held to the daily budget like every
 * other call.
 */

const Anthropic = require('@anthropic-ai/sdk');
const { Op } = require('sequelize');
const { selectRules } = require('./brainRules');

const REVIEW_MODEL = 'claude-haiku-4-5-20251001';
const SYSTEM = 'You are the Post-Generation Review agent. You read finished scenes for franchise violations. Be specific — quote lines, name laws. Respond ONLY in valid JSON.';

let client = null;
const anthropic = () => {
  if (!client) client = new Anthropic();
  return client;
};

function reviewPrompt(story, text, laws) {
  return `You are the Post-Generation Review agent for Prime Studios. Read this approved scene and check it against the franchise laws. Your job is to catch what slipped through — subtle drift, tone violations, character contradictions that feel almost right but aren't.

APPROVED SCENE:
${text}

CHARACTERS IN SCENE: ${(story.characters_in_scene || []).join(', ')}
SCENE TYPE: ${story.scene_type || 'not specified'}
TONE: ${story.tone_dial || 'not specified'}

FRANCHISE LAWS TO CHECK AGAINST:
${laws.map(l => `[${l.title}]\n${l.content}`).join('\n\n')}

Read carefully. Look for:
1. JustAWoman written as smaller than she is — even slightly passive, even mildly uncertain about her own worth
2. Any moment that nudges toward Lala having awareness of her origin
3. David framed as obstacle even briefly — even one sentence of "he doesn't understand her"
4. Anything that reads like a coaching realization landing in Book 1
5. Character voice drift — someone speaking in a register that doesn't match their registry entry
6. Anything that gives a character knowledge the reader should hold alone

Be specific. Quote the exact line if you find a violation. Vague warnings help nobody.

Respond ONLY in valid JSON:
{
  "violations": [
    {
      "severity": "critical" | "important",
      "law_violated": "which franchise law",
      "offending_line": "the exact line or passage",
      "why_it_violates": "specific explanation",
      "suggested_rewrite": "how to fix this specific line"
    }
  ],
  "warnings": [
    {
      "type": "voice_drift" | "tone_creep" | "arc_risk" | "subtle_framing",
      "note": "what to watch",
      "line_reference": "the line or passage"
    }
  ],
  "passed": true or false,
  "overall_assessment": "one sentence on the franchise health of this scene",
  "strongest_moment": "the line or passage that best embodies the franchise"
}`;
}

/** The reply's JSON, or null when there is none to read. */
function readReply(response) {
  const text = response?.content?.[0]?.text;
  if (!text) {
    console.error('[post-gen-review] the review came back empty');
    return null;
  }
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch (err) {
    console.error('[post-gen-review] the review is not JSON:', err.message);
    return null;
  }
}

/**
 * Review a story's final text and save the review. Returns { review, reply },
 * or { error }: 'not_found', 'no_text' (Evaluate has not set it), or
 * 'unreadable' (the reply could not be read; nothing is saved, since an
 * unread review is not a pass). The story's older reviews are superseded
 * (soft-deleted): they read text the story no longer has.
 */
async function reviewStory(db, storyId) {
  const story = await db.StorytellerStory.findByPk(storyId);
  if (!story) return { error: 'not_found' };
  const text = story.text || '';
  if (!text.trim()) return { error: 'no_text' };

  // Every active critical entry of the franchise tier, in the shared order
  // (services/brainRules): a story is the book's, never a show's own canon.
  const laws = await selectRules(db.FranchiseKnowledge, { franchiseOnly: true, where: { severity: 'critical' } });
  const response = await anthropic().messages.create({
    model: REVIEW_MODEL,
    max_tokens: 1500,
    system: SYSTEM,
    messages: [{ role: 'user', content: reviewPrompt(story, text, laws) }],
  });
  const reply = readReply(response);
  if (!reply) return { error: 'unreadable' };

  const review = await db.PostGenerationReview.create({
    story_id: story.id,
    approved_version_reviewed: text,
    violations: Array.isArray(reply.violations) ? reply.violations : [],
    warnings: Array.isArray(reply.warnings) ? reply.warnings : [],
    passed: reply.passed !== false,
    knowledge_entries_checked: laws.length,
    review_note: reply.overall_assessment || null,
  });
  await db.PostGenerationReview.destroy({ where: { story_id: story.id, id: { [Op.lt]: review.id } } });
  return { review, reply };
}

/**
 * Review a story after Evaluate without holding up its reply. Resolves when
 * the review is done; a review that could not run is logged, never thrown.
 */
function reviewInBackground(db, storyId) {
  return new Promise((resolve) => setImmediate(resolve))
    .then(() => reviewStory(db, storyId))
    .then((result) => {
      if (result.error) console.error(`[post-gen-review] story ${storyId} was not reviewed: ${result.error}`);
      return result;
    })
    .catch((err) => {
      console.error(`[post-gen-review] story ${storyId}: the review failed:`, err?.message);
      return { error: 'failed' };
    });
}

module.exports = { reviewStory, reviewInBackground, REVIEW_MODEL };
