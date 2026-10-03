/**
 * Recommended featured attendees (Evoni, 2026-10-03, episode creation
 * step 5): "characters are story ingredients, not event metadata." The
 * Event Package proposes the few people the story should use, each with a
 * story role and why, instead of only asking who is attending.
 *
 * Deterministic, no AI. A candidate is an invited guest (the event's
 * guest_profiles, which carry their relationship to the organizer) or one
 * of the Feed's most relevant LalaVerse creators. Each is scored from what
 * the Feed already records:
 *   - lala_relationship: how she and Lala know each other (LALA_WEIGHT)
 *   - a relationship to the organizer (+10; rivalries +5 more)
 *   - the venue: she lives or often goes there (+10)
 *   - already invited (+8)
 *   - lala_relevance_score / 10
 * and given the first role whose rule fits (roleFor). Picks are greedy and
 * a role already given costs ROLE_REPEAT_COST, so the recommendations mix
 * roles when the scores are close. JustAWoman's own records, the organizer
 * and anyone already featured are never recommended.
 *
 * Returns [{ profile_id, handle, display_name, role, reason, invited, score }].
 * Pure; no I/O.
 */

export const LALA_WEIGHT = { direct: 30, competitive: 25, aware: 15, one_sided: 12, mutual_unaware: 5 };
export const ROLE_REPEAT_COST = 12;
const RIVALRY = new Set(['rival', 'feud', 'shade', 'copycat']);
const HISTORY = new Set(['ex', 'situationship', 'couple', 'baby_daddy', 'baby_mama']);

export function roleFor({ lalaRelationship, hostRelationship, careerPressure }) {
  if (lalaRelationship === 'competitive') return { role: 'tension', reason: 'Competes with Lala' };
  if (RIVALRY.has(hostRelationship)) return { role: 'rival', reason: 'Has a rivalry with the organizer' };
  if (lalaRelationship === 'direct') return { role: 'friend', reason: 'Knows Lala' };
  if (HISTORY.has(hostRelationship)) return { role: 'wildcard', reason: 'Has history with the organizer' };
  if (hostRelationship === 'mentor' || careerPressure === 'ahead') return { role: 'mentor', reason: 'Ahead of Lala in her career' };
  if (lalaRelationship === 'aware' || lalaRelationship === 'one_sided') return { role: 'opportunity', reason: 'Knows of Lala: a connection worth making' };
  if (lalaRelationship === 'mutual_unaware') return { role: 'wildcard', reason: "She and Lala don't know each other yet" };
  return { role: 'opportunity', reason: hostRelationship ? "In the organizer's circle" : 'Relevant to Lala on the Feed' };
}

const idOf = (v) => (v === null || v === undefined ? null : String(v));

export function recommendGuests({ guests = [], profiles = [], organizerProfileId = null, venueLocationId = null, count = 3 } = {}) {
  const byId = new Map();
  for (const p of profiles || []) if (p && p.id != null) byId.set(idOf(p.id), p);
  const featured = new Set((guests || []).filter((g) => g && g.featured).map((g) => idOf(g.profile_id)));
  const invited = new Map((guests || []).filter((g) => g && g.profile_id != null).map((g) => [idOf(g.profile_id), g]));
  const ids = new Set([...invited.keys(), ...byId.keys()]);
  const organizer = idOf(organizerProfileId);
  const venue = idOf(venueLocationId);

  const candidates = [];
  for (const id of ids) {
    if (!id || id === organizer || featured.has(id)) continue;
    const profile = byId.get(id) || {};
    const guest = invited.get(id) || null;
    if (profile.is_justawoman_record || profile.lala_relationship === 'justawoman') continue;
    const hostRelationship = guest && guest.relationship && guest.relationship !== 'network' ? guest.relationship : null;
    const lalaRelationship = profile.lala_relationship || null;
    const atVenue = !!venue && (idOf(profile.home_location_id) === venue
      || (Array.isArray(profile.frequent_venues) && profile.frequent_venues.map(idOf).includes(venue)));
    const score = (LALA_WEIGHT[lalaRelationship] || 0)
      + (hostRelationship ? 10 + (RIVALRY.has(hostRelationship) ? 5 : 0) : 0)
      + (atVenue ? 10 : 0)
      + (guest ? 8 : 0)
      + (Number(profile.lala_relevance_score) || 0) / 10;
    const { role, reason } = roleFor({ lalaRelationship, hostRelationship, careerPressure: profile.career_pressure });
    candidates.push({
      profile_id: guest ? guest.profile_id : profile.id,
      handle: profile.handle || guest?.handle || null,
      display_name: profile.display_name || guest?.display_name || profile.handle || guest?.handle || 'Guest',
      role,
      reason: atVenue ? `${reason}; often at this venue` : reason,
      invited: !!guest,
      score,
    });
  }

  const picks = [];
  const usedRoles = new Set();
  const pool = candidates.sort((a, b) => (b.score - a.score) || String(a.display_name).localeCompare(String(b.display_name)));
  while (picks.length < count && pool.length) {
    let best = 0;
    let bestScore = -Infinity;
    pool.forEach((c, i) => {
      const s = c.score - (usedRoles.has(c.role) ? ROLE_REPEAT_COST : 0);
      if (s > bestScore) { bestScore = s; best = i; }
    });
    const [pick] = pool.splice(best, 1);
    usedRoles.add(pick.role);
    picks.push(pick);
  }
  return picks;
}
