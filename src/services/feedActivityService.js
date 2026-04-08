'use strict';

/**
 * Feed Activity Service
 *
 * Generates post-event social media activity from attendee profiles.
 * After an event episode, each attendee generates 1-2 posts about
 * the event based on their archetype and relationship to the host.
 *
 * Post types:
 * - Host: thank guests, highlight brand, share recap
 * - Attendee (friend): tag host, share photos, "what a night"
 * - Attendee (rival): subtle shade, "also was there", flex
 * - Non-attendee: FOMO, "wish I was there", commentary
 * - Lala: her version of the night (user controls this)
 */

const POST_TEMPLATES = {
  host: [
    { template: 'Thank you to everyone who made {event} unforgettable ✨', platform: 'instagram', type: 'caption' },
    { template: 'Last night was everything. {event} exceeded every expectation 💫', platform: 'instagram', type: 'caption' },
    { template: '{event} recap incoming... but first, grateful for this community 🤍', platform: 'tiktok', type: 'caption' },
  ],
  friend: [
    { template: 'THE BEST NIGHT. @{host} knows how to do it. {event} was everything 🔥', platform: 'instagram', type: 'caption' },
    { template: 'Still processing last night at {event}. The energy was unmatched.', platform: 'tiktok', type: 'caption' },
    { template: 'POV: you\'re at {event} and @{host} just surprised everyone 😭✨', platform: 'tiktok', type: 'caption' },
  ],
  industry: [
    { template: 'Great connections at {event} last night. This industry keeps evolving.', platform: 'instagram', type: 'caption' },
    { template: '{event} — the conversations that happen after the cameras stop are the real ones.', platform: 'twitter', type: 'caption' },
  ],
  rival: [
    { template: 'Interesting night at {event}. Some people really showed who they are. 🫣', platform: 'instagram', type: 'caption' },
    { template: 'Was at {event}. The food was good at least. 💅', platform: 'twitter', type: 'caption' },
  ],
  fomo: [
    { template: 'Everyone at {event} and I\'m watching from stories... next time. 😩', platform: 'instagram', type: 'story' },
    { template: 'Not me refreshing everyone\'s stories from {event} at 2am 🫠', platform: 'twitter', type: 'caption' },
  ],
};

/**
 * Generate post-event feed activity for all participants.
 *
 * @param {object} event — WorldEvent with canon_consequences.automation
 * @param {object} models — Sequelize models
 * @returns {Array} Generated posts
 */
async function generatePostEventActivity(event, models) {
  const automation = event.canon_consequences?.automation;
  if (!automation) return [];

  const posts = [];
  const eventName = event.name;
  const hostHandle = automation.host_handle || 'the host';

  // Host posts (1-2)
  if (automation.host_profile_id) {
    const hostTemplates = POST_TEMPLATES.host;
    const tpl = hostTemplates[Math.floor(Math.random() * hostTemplates.length)];
    posts.push({
      profile_id: automation.host_profile_id,
      handle: automation.host_handle,
      role: 'host',
      content: tpl.template.replace('{event}', eventName).replace('{host}', hostHandle),
      platform: tpl.platform,
      type: tpl.type,
      event_id: event.id,
      generated_at: new Date().toISOString(),
    });
  }

  // Guest posts (1 each)
  const guests = automation.guest_profiles || [];
  for (const guest of guests) {
    const relationship = guest.relationship || 'industry';
    const templates = POST_TEMPLATES[relationship] || POST_TEMPLATES.industry;
    const tpl = templates[Math.floor(Math.random() * templates.length)];
    posts.push({
      profile_id: guest.profile_id,
      handle: guest.handle,
      role: relationship,
      content: tpl.template.replace('{event}', eventName).replace('{host}', hostHandle),
      platform: tpl.platform,
      type: tpl.type,
      event_id: event.id,
      generated_at: new Date().toISOString(),
    });
  }

  // Store posts in event's canon_consequences for retrieval
  try {
    const existingConsequences = event.canon_consequences || {};
    existingConsequences.feed_activity = posts;

    if (models.WorldEvent) {
      await models.WorldEvent.update(
        { canon_consequences: existingConsequences },
        { where: { id: event.id } }
      );
    } else {
      await models.sequelize.query(
        'UPDATE world_events SET canon_consequences = :cc, updated_at = NOW() WHERE id = :id',
        { replacements: { cc: JSON.stringify(existingConsequences), id: event.id } }
      );
    }
  } catch (err) {
    console.warn('[FeedActivity] Failed to store posts:', err.message);
  }

  console.log(`[FeedActivity] Generated ${posts.length} posts for "${eventName}"`);
  return posts;
}

module.exports = { generatePostEventActivity, POST_TEMPLATES };
