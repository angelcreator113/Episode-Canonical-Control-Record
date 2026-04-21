'use strict';

/**
 * Financial Feed Service
 *
 * Bridges the coin economy into the social timeline. When Lala's finances
 * do something narrative-worthy (crosses a milestone, drops a lot in one
 * episode), this module turns the transaction event into a FeedPost so the
 * feed tab actually reacts.
 *
 * Design notes:
 *   - Lala posts from her own profile (or a synthetic "Lala" fallback when
 *     no profile is configured) so the mini-reactions feel first-person.
 *   - Copy is templated with variety — three options per event type picked
 *     at random, so repeat milestones don't read identically.
 *   - Non-blocking: every write is try/catch + console.warn on failure.
 *     Nothing in the finance path should 500 because the feed table is
 *     unavailable on a legacy env.
 */

const { v4: uuidv4 } = require('uuid');

// ── Copy templates ─────────────────────────────────────────────────────────

const MILESTONE_POSTS = [
  "{label} unlocked. I've been saving + slaying for this.",
  "Hit {label} today — closet's officially paying its own rent.",
  "{label}. This one's going in the diary.",
];

const BIG_SPEND_POSTS = [
  "New era, new receipts. Dropped {amount} coins on the fit — worth it.",
  "That outfit was {amount} coins of pure confidence. No notes.",
  "{amount} coins later and I'm not even sorry. {item_name} called me first.",
];

const OVERSPEND_POSTS = [
  "{amount} coins deep and the fridge is empty. Priorities are priorities.",
  "Balance check is scary. But the pictures? Immaculate.",
  "The outfit cost more than the rent. The rent'll wait.",
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function fillTemplate(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

// ── Lala profile resolver ──────────────────────────────────────────────────

/**
 * Find Lala's social profile on the show, or return a synthetic fallback.
 * The fallback keeps the post renderable even on shows that haven't set up
 * social profiles yet — it just won't link to a real account.
 */
async function resolveLalaProfile(sequelize, showId) {
  try {
    const [rows] = await sequelize.query(
      `SELECT id, handle, display_name, creator_name
       FROM social_profiles
       WHERE show_id = :showId AND LOWER(creator_name) LIKE '%lala%'
       LIMIT 1`,
      { replacements: { showId } }
    );
    if (rows?.[0]) return rows[0];
  } catch { /* table might not exist on legacy env */ }
  return { id: null, handle: 'lala', display_name: 'Lala', creator_name: 'Lala' };
}

// ── Writers ────────────────────────────────────────────────────────────────

async function writeFeedPost(sequelize, showId, post) {
  try {
    await sequelize.query(
      `INSERT INTO feed_posts (
        id, show_id, episode_id, event_id, social_profile_id, poster_handle,
        poster_display_name, poster_creator_name, post_type, content_text,
        narrative_function, emotional_impact, ai_generated, posted_at,
        timeline_position, created_at, updated_at
      ) VALUES (
        :id, :showId, :episodeId, :eventId, :profileId, :handle,
        :displayName, :creatorName, :postType, :contentText,
        :narrativeFunction, :emotionalImpact, true, NOW(),
        :timelinePosition, NOW(), NOW()
      )`,
      { replacements: {
        id: uuidv4(),
        showId,
        episodeId: post.episode_id || null,
        eventId: post.event_id || null,
        profileId: post.profile_id || null,
        handle: post.handle,
        displayName: post.display_name || null,
        creatorName: post.creator_name || null,
        postType: post.post_type || 'post',
        contentText: post.content_text,
        narrativeFunction: post.narrative_function || null,
        emotionalImpact: post.emotional_impact || null,
        timelinePosition: post.timeline_position || 'after_episode',
      }}
    );
    return { success: true };
  } catch (err) {
    console.warn('[financialFeed] post write failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Post one feed entry per newly-triggered milestone. Called from
 * checkMilestones after the payout transaction is written. `triggered` is
 * the array returned by checkMilestones: `[{ goal, payout_tx }]`.
 */
async function postMilestoneReached(sequelize, showId, triggered, { episodeId } = {}) {
  if (!Array.isArray(triggered) || triggered.length === 0) return { posted: 0 };
  const profile = await resolveLalaProfile(sequelize, showId);
  let posted = 0;
  for (const { goal } of triggered) {
    const text = fillTemplate(pick(MILESTONE_POSTS), { label: goal.label, reward: goal.reward_coins });
    const res = await writeFeedPost(sequelize, showId, {
      episode_id: episodeId,
      profile_id: profile.id,
      handle: profile.handle,
      display_name: profile.display_name,
      creator_name: profile.creator_name,
      post_type: 'post',
      content_text: text,
      narrative_function: 'flex',
      emotional_impact: 'confidence_boost',
      timeline_position: episodeId ? 'after_episode' : null,
    });
    if (res.success) posted++;
  }
  return { posted };
}

/**
 * Post a "big spend" entry when Lala dropped more than `thresholdCoins` in
 * an episode's outfit + event costs combined. Distinguishes "flex" spending
 * (she can afford it) from "overspend" (balance went below 25% of next goal).
 * `summary` is the finalize-financials summary object; `balanceAfter` is the
 * ending balance so we can tell which bucket we're in.
 */
async function postBigSpend(sequelize, showId, summary, balanceAfter, opts = {}) {
  const { episodeId, eventId, thresholdCoins = 2000, nextGoalThreshold = null, itemName = null } = opts;
  const totalSpend = (summary?.wardrobe_cost || 0) + (summary?.event_cost || 0);
  if (totalSpend < thresholdCoins) return { posted: 0 };
  const overspent = nextGoalThreshold && balanceAfter < nextGoalThreshold * 0.25;
  const template = overspent ? pick(OVERSPEND_POSTS) : pick(BIG_SPEND_POSTS);
  const text = fillTemplate(template, { amount: totalSpend.toLocaleString(), item_name: itemName || 'The fit' });
  const profile = await resolveLalaProfile(sequelize, showId);
  const res = await writeFeedPost(sequelize, showId, {
    episode_id: episodeId,
    event_id: eventId,
    profile_id: profile.id,
    handle: profile.handle,
    display_name: profile.display_name,
    creator_name: profile.creator_name,
    post_type: 'post',
    content_text: text,
    narrative_function: overspent ? 'bts' : 'flex',
    emotional_impact: overspent ? 'anxiety' : 'confidence_boost',
    timeline_position: 'after_episode',
  });
  return { posted: res.success ? 1 : 0, overspent };
}

module.exports = {
  postMilestoneReached,
  postBigSpend,
  resolveLalaProfile,
};
