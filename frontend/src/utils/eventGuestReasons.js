/**
 * Why a recommended guest (EventGuestRecommendations; Evoni, 2026-10-23: "a
 * reason on each guest suggestion"): short facts from what the Feed records,
 * shown under the role's own why (recommendGuests' reason). Only what the
 * data says; nothing is guessed, and a guest with none of these shows none.
 *
 *   - her relationship to the organizer, from the event's guest list (the
 *     server's profile relationships, eventAutomationService): collab,
 *     bestie, mentor, family, management. A rivalry or a romantic history
 *     is already the role's reason, so it is not said twice.
 *   - "Same district as the organizer": her city (the DREAM district) is
 *     the organizer's, when the organizer's profile is read.
 *   - "Lala follows her": Lala (character_key 'lala') is among her followers.
 *   - "High Pulse following": follower_tier macro or mega.
 *   - "Rising on The Pulse" / "Having a viral moment": current_trajectory.
 *
 * Not supported (no field for it): who she follows (e.g. the host brand),
 * collaborations outside the profile relationships, the venue's district.
 * The venue itself is already in the role's reason ("often at this venue").
 *
 * At most MAX_REASONS, in the order above. Pure.
 */

export const MAX_REASONS = 3;

const ORGANIZER_TIES = {
  collab: 'Collaborated with the organizer',
  bestie: 'Close friend of the organizer',
  mentor: 'Mentor tie with the organizer',
  family: 'Family of the organizer',
  management: 'Works with the organizer (management)',
};

const TRAJECTORY = { rising: 'Rising on The Pulse', viral_moment: 'Having a viral moment' };
const HIGH_TIERS = new Set(['macro', 'mega']);

export function guestReasons({ profile = null, guest = null, organizer = null } = {}) {
  const out = [];
  const tie = guest?.relationship && ORGANIZER_TIES[guest.relationship];
  if (tie) out.push(tie);
  if (profile?.city && organizer?.city && String(profile.city) === String(organizer.city)) {
    out.push('Same district as the organizer');
  }
  const followers = Array.isArray(profile?.followers) ? profile.followers : [];
  if (followers.some((f) => f?.character_key === 'lala')) out.push('Lala follows her');
  if (HIGH_TIERS.has(profile?.follower_tier)) out.push('High Pulse following');
  if (TRAJECTORY[profile?.current_trajectory]) out.push(TRAJECTORY[profile.current_trajectory]);
  return out.slice(0, MAX_REASONS);
}
