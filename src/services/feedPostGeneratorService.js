'use strict';

/**
 * Feed moments: persistFeedMoments saves an episode's generated feed moments
 * (feedMomentsService) as FeedMoment rows, one per beat.
 *
 * The whole-episode post generator that lived here (generateEpisodeFeedPosts,
 * POST /feed-posts/:episodeId/generate) is retired (Evoni, 2026-10-17:
 * "retire the old episode feed button"). It wrote a batch of posts outside
 * The Pulse's drafter: no Review gate, no content types, and a poster matched
 * only after the fact. An episode's posts are drafted from its event in
 * Admin › The Pulse › Engine (services/pulseEventPosting), through the drafter
 * and the gate.
 */

/**
 * Persist feed moments to database after generation.
 * Bridges feedMomentsService (generates) → FeedMoment model (persists).
 */
async function persistFeedMoments(episodeId, showId, eventId, moments, models) {
  const { FeedMoment } = models;
  if (!FeedMoment) {
    console.warn('[FeedPosts] FeedMoment model not available — skipping persistence');
    return [];
  }

  const saved = [];
  const beatNumbers = Object.keys(moments).map(Number).sort((a, b) => a - b);

  for (let idx = 0; idx < beatNumbers.length; idx++) {
    const beatNum = beatNumbers[idx];
    const m = moments[beatNum];
    if (!m) continue;

    try {
      const record = await FeedMoment.create({
        show_id: showId,
        episode_id: episodeId,
        event_id: eventId || null,
        beat_number: beatNum,
        beat_context: m.beat_context || null,
        trigger_handle: m.trigger_profile || null,
        trigger_action: m.trigger_action || null,
        phone_screen_type: m.on_screen?.type || null,
        screen_content: m.on_screen?.content || null,
        screen_image_desc: m.on_screen?.image_desc || null,
        asset_type: m.on_screen?.asset_type || null,
        asset_role: m.on_screen?.asset_role || null,
        justawoman_line: m.script_lines?.justawoman_line || null,
        justawoman_action: m.script_lines?.justawoman_action || null,
        lala_line: m.script_lines?.lala_line || null,
        lala_internal: m.script_lines?.lala_internal || null,
        direction: m.script_lines?.direction || null,
        financial_context: m.financial || null,
        behavior_change: m.script_lines?.direction || null,
        sort_order: idx,
      });
      saved.push(record);
    } catch (err) {
      console.warn(`[FeedPosts] Failed to persist moment for beat ${beatNum}:`, err.message);
    }
  }

  console.log(`[FeedPosts] Persisted ${saved.length} feed moments for episode ${episodeId}`);
  return saved;
}

module.exports = { persistFeedMoments };
