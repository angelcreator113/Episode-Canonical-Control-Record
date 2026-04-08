'use strict';

/**
 * Character Sync Service
 *
 * Updates feed profiles and character registry after event episodes.
 * When an event is "used" in an episode:
 * - Host profile: hosted_events count, prestige shift
 * - Guest profiles: attended_events count
 * - Lala relationship updates based on event outcome
 */

/**
 * Sync character data after an event is used in an episode.
 *
 * @param {object} event — WorldEvent with canon_consequences.automation
 * @param {object} episode — Episode that used this event
 * @param {object} models — Sequelize models
 */
async function syncAfterEvent(event, episode, models) {
  const { SocialProfile } = models;
  if (!SocialProfile) return { updated: 0 };

  const automation = event.canon_consequences?.automation;
  if (!automation) return { updated: 0 };

  let updated = 0;

  // Update host profile
  if (automation.host_profile_id) {
    try {
      const host = await SocialProfile.findByPk(automation.host_profile_id);
      if (host) {
        const fullProfile = host.full_profile || {};
        const hostedEvents = fullProfile.hosted_events || [];
        hostedEvents.push({
          event_id: event.id,
          event_name: event.name,
          episode_id: episode.id,
          episode_number: episode.episode_number,
          date: new Date().toISOString(),
        });
        fullProfile.hosted_events = hostedEvents;

        // Prestige boost for hosting
        const currentScore = host.lala_relevance_score || 0;
        const boost = Math.min(1, (event.prestige || 5) / 10);

        await host.update({
          full_profile: fullProfile,
          lala_relevance_score: Math.min(10, currentScore + boost),
        });
        updated++;
        console.log(`[CharSync] Updated host ${host.handle}: +${boost} relevance`);
      }
    } catch (err) {
      console.warn(`[CharSync] Host update failed:`, err.message);
    }
  }

  // Update guest profiles
  const guests = automation.guest_profiles || [];
  for (const guest of guests) {
    if (!guest.profile_id) continue;
    try {
      const profile = await SocialProfile.findByPk(guest.profile_id);
      if (profile) {
        const fullProfile = profile.full_profile || {};
        const attendedEvents = fullProfile.attended_events || [];
        attendedEvents.push({
          event_id: event.id,
          event_name: event.name,
          episode_id: episode.id,
          date: new Date().toISOString(),
        });
        fullProfile.attended_events = attendedEvents;

        await profile.update({ full_profile: fullProfile });
        updated++;
      }
    } catch (err) {
      console.warn(`[CharSync] Guest ${guest.handle} update failed:`, err.message);
    }
  }

  return { updated, host_id: automation.host_profile_id, guests_updated: guests.length };
}

module.exports = { syncAfterEvent };
