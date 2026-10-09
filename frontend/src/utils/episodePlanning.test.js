/**
 * episodePlanning — what an episode inherited from its event, and the next
 * decision (Evoni, 2026-10-03, episode creation step 2).
 */
import { describe, test, expect } from 'vitest';
import { episodePlanning } from './episodePlanning';

const EVENT = {
  id: 'ev-1',
  name: 'Velour Awards Night',
  host_brand: 'Velour',
  venue_location_id: 'loc-1',
  venue_name: 'Club Noir',
  scene_set_id: 'set-1',
  outfit_pieces: [{ id: 'p1' }, { id: 'p2' }],
  narrative_stakes: 'Her first red carpet',
  canon_consequences: { automation: { guest_profiles: [
    { profile_id: 1, display_name: 'Maya Chen', featured: true },
    { profile_id: 2, display_name: 'Dana', featured: true },
    { profile_id: 3, display_name: 'Tasha' },
  ] } },
};

const byKey = (p) => Object.fromEntries(p.items.map((i) => [i.key, i]));

describe('episodePlanning', () => {
  test('a fully planned episode: five items done, next is Generate Script', () => {
    const p = episodePlanning({ episode: { script_content: '' }, event: EVENT, sceneSet: { name: 'Club Noir · Main Room' } });
    expect(p.done).toBe(5);
    expect(p.total).toBe(5);
    const items = byKey(p);
    expect(items.event.detail).toBe('Velour Awards Night · organized by Velour');
    expect(items.cast.detail).toBe('2 featured: Maya Chen, Dana');
    expect(items.location.detail).toBe('Club Noir · Club Noir · Main Room');
    expect(items.look.detail).toBe('2 pieces chosen');
    expect(items.stakes.detail).toBe('Her first red carpet');
    expect(p.next).toEqual({ key: 'script', label: 'Generate Script', tab: 'scripts' });
  });

  test('with a script, next is the production checklist', () => {
    const p = episodePlanning({ episode: { script_content: 'Me: hi\nLala: hi' }, event: EVENT });
    expect(p.hasScript).toBe(true);
    expect(p.next.tab).toBe('checklist');
  });

  test('gaps say what is missing and where to finish them', () => {
    const p = episodePlanning({
      episode: {},
      event: { ...EVENT, scene_set_id: null, outfit_pieces: [], narrative_stakes: null, canon_consequences: { automation: { guest_profiles: [{ profile_id: 3 }] } } },
    });
    const items = byKey(p);
    expect(p.done).toBe(2); // Event, and Location: the venue counts without its scene set
    expect(items.cast).toMatchObject({ done: false, detail: '1 invited, none featured; the script draws on the full guest list' });
    // A venue fills Location (Evoni, 2026-10-06); the scene set is still asked for.
    expect(items.location).toMatchObject({ done: true, detail: 'Club Noir · no scene set yet', fix: 'package' });
    expect(items.look).toMatchObject({ done: false, fix: 'wardrobe' });
    expect(items.stakes).toMatchObject({ done: false, fix: null });
  });

  test('fail_consequence alone counts as stakes; an outfit set alone counts as a look', () => {
    const p = byKey(episodePlanning({ episode: {}, event: { ...EVENT, narrative_stakes: '', fail_consequence: 'Velour never calls', outfit_pieces: null, outfit_set_id: 'os-1' } }));
    expect(p.stakes).toMatchObject({ done: true, detail: 'Velour never calls' });
    expect(p.look).toMatchObject({ done: true, detail: 'Outfit set chosen' });
  });

  test('an episode with no source event has no planning view', () => {
    expect(episodePlanning({ episode: {}, event: null })).toBeNull();
  });

  // Evoni, 2026-10-06: an episode from an event with a venue showed "No
  // venue" when the venue had no linked World Location.
  test('the event\'s venue (name and address) fills Location, with or without a linked location', () => {
    const typed = { ...EVENT, venue_location_id: null, venue_name: 'The Glasshouse', venue_address: '12 Bloom St, Midtown', scene_set_id: null };
    const p = episodePlanning({ episode: {}, event: typed });
    expect(byKey(p).location).toMatchObject({ done: true, detail: 'The Glasshouse, 12 Bloom St, Midtown · no scene set yet', fix: 'package' });
    expect(p.done).toBe(5);

    const linked = episodePlanning({
      episode: {}, event: { ...EVENT, venue_address: '1 Noir Ave' },
      venueLocation: { id: 'loc-1', name: 'Club Noir' }, sceneSet: { name: 'Main Room' },
    });
    expect(byKey(linked).location).toMatchObject({ done: true, detail: 'Club Noir, 1 Noir Ave · Main Room', fix: null });

    const none = episodePlanning({ episode: {}, event: { ...EVENT, venue_location_id: null, venue_name: '  ', scene_set_id: null } });
    expect(byKey(none).location).toMatchObject({ done: false, detail: 'No venue', fix: null });
    expect(none.done).toBe(4);
  });

  // Wiring map claim d (2026-10-07): a calendar-spawned event keeps its venue
  // only in the automation copy; the Event Package's Place showed it
  // (resolveEventVenueAndDate) while Planning said "No venue".
  test("a venue that lives only in the automation copy fills Location, as on the Place", () => {
    const spawned = {
      ...EVENT, venue_location_id: null, venue_name: null, venue_address: null, scene_set_id: null,
      canon_consequences: { ...EVENT.canon_consequences, automation: { ...(EVENT.canon_consequences?.automation || {}), venue_location_id: 'loc-9', venue_name: "STUDIO BY SABLE's Studio", venue_address: '4 Avenue Row' } },
    };
    expect(byKey(episodePlanning({ episode: {}, event: spawned })).location)
      .toMatchObject({ done: true, detail: "STUDIO BY SABLE's Studio, 4 Avenue Row · no scene set yet", fix: 'package' });
    // The id alone (no name in either home) still counts as a venue.
    const idOnly = { ...spawned, canon_consequences: { automation: { venue_location_id: 'loc-9' } } };
    expect(byKey(episodePlanning({ episode: {}, event: idOnly })).location).toMatchObject({ done: true });
  });

  test('given the locked outfit, Look is it; planned but not locked is still open', () => {
    const locked = byKey(episodePlanning({ episode: {}, event: EVENT, outfit: [{ name: 'Dress' }, { name: 'Heels' }, { name: 'Bag' }, { name: 'Hoops' }] })).look;
    expect(locked).toEqual({ key: 'look', label: 'Look', done: true, detail: '4 pieces locked: Dress, Heels, Bag +1', fix: null });
    const planned = byKey(episodePlanning({ episode: {}, event: EVENT, outfit: [] })).look;
    expect(planned).toMatchObject({ done: false, fix: 'wardrobe', detail: 'Planned in the event, not locked on the Wardrobe tab yet; Beat 8 needs it' });
    const none = byKey(episodePlanning({ episode: {}, event: { ...EVENT, outfit_pieces: [] }, outfit: [] })).look;
    expect(none).toMatchObject({ done: false, detail: 'Not chosen yet; Beat 8 needs it' });
  });
});
