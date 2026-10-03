/**
 * Build this episode (episode creation step 6, Pitch Me): the create body
 * for POST /world/:showId/events from one pitch (episodePitchService's
 * parsed shape; every person, brand and place in it was checked against
 * the show's own records server-side).
 *
 * The organizer goes where §8(p) ruling 6 stores it (source_profile_id for
 * a creator, host_brand for a brand); the venue, category and format to
 * their columns; the featured people to automation.guest_profiles, featured
 * with their roles, in the shape Add from Feed writes. Everything the model
 * wrote is marked as drafted the way the creation draft marks it
 * (automation.auto_drafted, field → 'ai_draft', plus a copy in
 * drafted_values), so the Event Package shows it Auto-drafted until Evoni
 * changes it. Pure; no I/O.
 */
export function buildEventFromPitch(pitch) {
  if (!pitch || !pitch.title || !pitch.organizer) return null;
  const drafted = {
    name: pitch.title,
    description: pitch.premise || null,
    ...(pitch.category ? { category: pitch.category } : {}),
    ...(pitch.format ? { format: pitch.format } : {}),
    ...(pitch.opportunity ? { narrative_stakes: pitch.opportunity } : {}),
    ...(pitch.pressure ? { fail_consequence: pitch.pressure } : {}),
  };
  const draftedKeys = Object.keys(drafted).filter((k) => drafted[k]);
  return {
    ...drafted,
    ...(pitch.organizer.kind === 'creator' ? { source_profile_id: pitch.organizer.profile_id } : {}),
    ...(pitch.organizer.kind === 'brand' ? { host_brand: pitch.organizer.name } : {}),
    ...(pitch.venue?.id ? { venue_location_id: pitch.venue.id } : {}),
    canon_consequences: {
      automation: {
        guest_profiles: (pitch.featured || []).map((f) => ({
          profile_id: f.profile_id,
          handle: f.handle || null,
          display_name: f.display_name || f.handle || null,
          featured: true,
          story_role: f.role || null,
        })),
        pitch: { kind: pitch.kind || null, wildcard: pitch.wildcard || null },
        auto_drafted: Object.fromEntries(draftedKeys.map((k) => [k, 'ai_draft'])),
        drafted_values: Object.fromEntries(draftedKeys.map((k) => [k, drafted[k]])),
      },
    },
  };
}
