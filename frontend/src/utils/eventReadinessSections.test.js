/**
 * eventReadinessSections — readiness by Event Package section (Task #1775).
 */
import { describe, test, expect } from 'vitest';
import {
  computeEventPackageReadiness, computeEventState, describeMissing,
  EVENT_PACKAGE_SECTIONS, SECTION_GATES, EVENT_QUEUE_STATES,
} from './eventReadinessSections';
import { resolveEventBasics, AUTO_DATE_KEY } from './eventBasics';
import { resolveEventVenueAndDate, resolveEventOrganizer } from './eventReadiness';

// A fully built event: every section complete.
const full = () => ({
  id: 'ev-1',
  name: 'Velvet Hour',
  category: 'social',
  format: 'gala',
  event_date: '2026-11-07',
  event_time: '20:00',
  source_profile_id: 7,
  canon_consequences: { automation: { guest_profiles: [{ profile_id: 1, featured: true }, { profile_id: 2 }] } },
  venue_location_id: 'loc-1',
  venue_name: 'Club Noir',
  scene_set_id: 'ss-1',
  invitation_asset_id: 'inv-1',
  outfit_pieces: [{ id: 'p1' }],
  narrative_stakes: 'Her first seat at the table.',
  prestige: 5, strictness: 5, cost_coins: 100, deadline_type: 'medium', career_tier: 1,
});

const section = (r, key) => r.sections.find((s) => s.key === key);
const missingKeys = (r, key) => section(r, key).missing.map((m) => m.key);
const incompleteKeys = (r) => r.sections.filter((s) => !s.complete).map((s) => s.key);

describe('sections', () => {
  test('a complete event has every section complete, in Package order', () => {
    const r = computeEventPackageReadiness(full());
    expect(r.sections.map((s) => s.key)).toEqual(['organizer', 'identity', 'people', 'place', 'invitation', 'look', 'stakes']);
    expect(incompleteKeys(r)).toEqual([]);
    expect(r.gatesMet).toBe(true);
    expect(r.allComplete).toBe(true);
    expect(r.blocking).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  test('an empty event lists every item as missing', () => {
    const r = computeEventPackageReadiness({});
    expect(missingKeys(r, 'organizer')).toEqual(['organizer']);
    expect(missingKeys(r, 'identity')).toEqual(['name', 'category', 'format', 'date', 'time']);
    expect(missingKeys(r, 'people')).toEqual(['featured']);
    expect(missingKeys(r, 'place')).toEqual(['venue', 'scene_set']);
    expect(missingKeys(r, 'invitation')).toEqual(['invitation']);
    expect(missingKeys(r, 'look')).toEqual(['outfit']);
    expect(missingKeys(r, 'stakes')).toEqual(['story_stakes']);
    expect(r.gatesMet).toBe(false);
  });

  // One field removed at a time: exactly that section goes incomplete.
  const removals = [
    ['organizer', (e) => { delete e.source_profile_id; }, ['organizer']],
    ['identity', (e) => { e.category = null; }, ['category']],
    ['identity', (e) => { e.format = ''; e.event_time = null; }, ['format', 'time']],
    ['identity', (e) => { e.event_date = null; }, ['date']],
    ['people', (e) => { e.canon_consequences.automation.guest_profiles = [{ profile_id: 2 }]; }, ['featured']],
    ['place', (e) => { e.venue_location_id = null; e.venue_name = null; }, ['venue']],
    ['place', (e) => { e.scene_set_id = null; }, ['scene_set']],
    ['invitation', (e) => { e.invitation_asset_id = null; }, ['invitation']],
    ['look', (e) => { e.outfit_pieces = []; }, ['outfit']],
    ['stakes', (e) => { e.narrative_stakes = '  '; }, ['story_stakes']],
  ];
  test.each(removals)('missing %s shows only that section', (key, mutate, items) => {
    const ev = full();
    mutate(ev);
    const r = computeEventPackageReadiness(ev);
    expect(incompleteKeys(r)).toEqual([key]);
    expect(missingKeys(r, key)).toEqual(items);
  });

  test('outfit counts from outfit_set_id as well as pieces', () => {
    const ev = { ...full(), outfit_pieces: null, outfit_set_id: 'set-1' };
    expect(section(computeEventPackageReadiness(ev), 'look').complete).toBe(true);
  });

  test('venue counts from its saved automation copy (resolveEventVenueAndDate)', () => {
    const ev = full();
    ev.venue_location_id = null; ev.venue_name = null;
    ev.canon_consequences.automation.venue_name = 'Club Noir';
    expect(resolveEventVenueAndDate(ev).hasVenue).toBe(true);
    expect(section(computeEventPackageReadiness(ev), 'place').complete).toBe(true);
  });

  test('a brand organizer satisfies the organizer section', () => {
    const ev = { ...full(), source_profile_id: null, host_brand: 'Maison Belle' };
    expect(section(computeEventPackageReadiness(ev), 'organizer').complete).toBe(true);
  });

  test('people: invited guests with none featured do not count, and the note says so', () => {
    const ev = full();
    ev.canon_consequences.automation.guest_profiles = [{ profile_id: 1 }, { profile_id: 2 }, { profile_id: 3 }];
    const [featured] = section(computeEventPackageReadiness(ev), 'people').items;
    expect(featured.satisfied).toBe(false);
    expect(featured.note).toBe('3 invited, none featured');
  });

  test('stakes: stored numbers alone never satisfy the section', () => {
    const ev = { ...full(), narrative_stakes: null, fail_consequence: null, prestige: 9, strictness: 8, cost_coins: 400, deadline_type: 'urgent', career_tier: 4 };
    const s = section(computeEventPackageReadiness(ev), 'stakes');
    expect(s.complete).toBe(false);
    expect(s.missing.map((m) => m.key)).toEqual(['story_stakes']);
  });

  test('stakes: a fail consequence alone counts, reported as stored not set', () => {
    const ev = { ...full(), narrative_stakes: null, fail_consequence: 'She loses the brand.' };
    const s = section(computeEventPackageReadiness(ev), 'stakes');
    expect(s.complete).toBe(true);
    expect(s.items[0].state).toBe('stored');
  });
});

describe('suggestions never satisfy; accepted values do', () => {
  test('a suggested time leaves Event identity incomplete', () => {
    const ev = { ...full(), event_time: null };
    expect(resolveEventBasics(ev).time.state).toBe('suggested');
    const r = computeEventPackageReadiness(ev);
    const time = section(r, 'identity').missing.find((m) => m.key === 'time');
    expect(time).toMatchObject({ satisfied: false, state: 'suggested', note: 'Suggestion not accepted' });
  });

  test('accepting the suggestion (saving its value) satisfies it', () => {
    const ev = { ...full(), event_time: null };
    const suggestion = resolveEventBasics(ev).time.suggestion.value;
    const r = computeEventPackageReadiness({ ...ev, event_time: suggestion });
    expect(section(r, 'identity').complete).toBe(true);
  });

  test('no Basics field is satisfied in any state but set', () => {
    // Every format produces a time suggestion; none of them satisfies.
    for (const format of ['cocktail_party', 'garden_soiree', 'gallery_opening', 'gala', 'brunch', 'concert', 'brand_launch', 'premiere']) {
      const ev = { ...full(), format, event_time: null };
      const items = section(computeEventPackageReadiness(ev), 'identity').items;
      const basics = resolveEventBasics(ev);
      for (const it of items.filter((i) => i.key === 'date' || i.key === 'time')) {
        expect(it.satisfied).toBe(basics[it.key].state === 'set');
      }
    }
  });

  test('the auto-scheduled date counts as set (Task #1756)', () => {
    const ev = full();
    ev.canon_consequences.automation[AUTO_DATE_KEY] = ev.event_date;
    expect(resolveEventBasics(ev).date.autoScheduled).toBe(true);
    const date = section(computeEventPackageReadiness(ev), 'identity').items.find((i) => i.key === 'date');
    expect(date).toMatchObject({ satisfied: true, state: 'set', note: 'Auto-scheduled' });
  });
});

describe('gates', () => {
  test("gates are today's: place, invitation, look; everything else warns", () => {
    expect(Object.entries(SECTION_GATES).filter(([, g]) => g).map(([k]) => k).sort())
      .toEqual(['invitation', 'look', 'place']);
    for (const s of EVENT_PACKAGE_SECTIONS) expect(Object.keys(SECTION_GATES)).toContain(s.key);
  });

  test('warning sections never block Start Episode', () => {
    const ev = { ...full(), source_profile_id: null, category: null, narrative_stakes: null, canon_consequences: {} };
    const r = computeEventPackageReadiness(ev);
    expect(r.gatesMet).toBe(true);
    expect(r.allComplete).toBe(false);
    expect(r.warnings.map((s) => s.key)).toEqual(['organizer', 'identity', 'people', 'stakes']);
  });

  test('a gate section incomplete blocks', () => {
    const r = computeEventPackageReadiness({ ...full(), scene_set_id: null });
    expect(r.gatesMet).toBe(false);
    expect(r.blocking.map((s) => s.key)).toEqual(['place']);
    expect(describeMissing(r.blocking)).toEqual(['Place: scene set']);
  });

  test('changing the gate set is a one-key change (options.gates stands in for an edit)', () => {
    const ev = { ...full(), source_profile_id: null };
    expect(computeEventPackageReadiness(ev).gatesMet).toBe(true);
    const r = computeEventPackageReadiness(ev, { gates: { ...SECTION_GATES, organizer: true } });
    expect(r.gatesMet).toBe(false);
    expect(describeMissing(r.blocking)).toEqual(['Organizer']);
  });
});

// The pre-#1775 functions, verbatim in behaviour, as the oracle for
// "the queue's states did not move".
function legacyReadiness(ev) {
  const hasOutfit = !!ev.outfit_set_id || (Array.isArray(ev.outfit_pieces) && ev.outfit_pieces.length > 0);
  const hasVenue = resolveEventVenueAndDate(ev).hasVenue;
  return hasOutfit && hasVenue && !!ev.scene_set_id && !!ev.invitation_asset_id;
}
function legacyState(ev) {
  if (ev.status === 'declined' || ev.status === 'archived') return 'archived';
  if (ev.used_in_episode_id || ev.status === 'used' || ev.status === 'filmed') return 'used';
  if (!resolveEventOrganizer(ev).hasOrganizer) return 'needs_organizer';
  return legacyReadiness(ev) ? 'ready' : 'needs_setup';
}

describe('queue states', () => {
  const statuses = [undefined, 'draft', 'ready', 'used', 'filmed', 'declined', 'archived'];
  const fixtures = [];
  for (let mask = 0; mask < 64; mask += 1) {
    for (const status of statuses) {
      const ev = { name: 'E', status };
      if (mask & 1) ev.source_profile_id = 1;
      if (mask & 2) ev.outfit_pieces = [{ id: 'p' }];
      if (mask & 4) ev.venue_name = 'V';
      if (mask & 8) ev.scene_set_id = 's';
      if (mask & 16) ev.invitation_asset_id = 'i';
      if (mask & 32) ev.used_in_episode_id = 'ep';
      fixtures.push(ev);
    }
  }

  test(`computeEventState matches the pre-#1775 logic on ${fixtures.length} fixtures`, () => {
    for (const ev of fixtures) expect(computeEventState(ev)).toBe(legacyState(ev));
  });

  test('warning sections never change the queue state', () => {
    const ev = { ...full(), category: null, narrative_stakes: null, event_time: null, canon_consequences: {} };
    expect(computeEventState(ev)).toBe('ready');
  });

  test('a precomputed readiness can be passed in', () => {
    const ev = { ...full(), scene_set_id: null };
    const r = computeEventPackageReadiness(ev);
    expect(computeEventState(ev, r)).toBe('needs_setup');
  });

  test('the five queue states are unchanged', () => {
    expect(Object.keys(EVENT_QUEUE_STATES)).toEqual(['needs_organizer', 'needs_setup', 'ready', 'used', 'archived']);
  });
});

describe('adding a section needs no redesign', () => {
  // A stand-in for Lala's deliverables (Task #1773). Reads a made-up
  // field on purpose: nothing real stores deliverables yet.
  const stub = {
    key: 'deliverables',
    label: "Lala's deliverables",
    items: ({ event }) => [{ key: 'posts', label: 'Posts', satisfied: !!event.__stub_posts, state: event.__stub_posts ? 'set' : 'missing', note: null }],
  };

  test('as a warning by default (no gate key)', () => {
    const r = computeEventPackageReadiness(full(), { sections: [...EVENT_PACKAGE_SECTIONS, stub] });
    expect(r.sections.map((s) => s.key)).toContain('deliverables');
    expect(section(r, 'deliverables')).toMatchObject({ gate: false, complete: false });
    expect(r.gatesMet).toBe(true);
    expect(r.warnings.map((s) => s.key)).toEqual(['deliverables']);
  });

  test('or as a gate with one key', () => {
    const r = computeEventPackageReadiness(full(), {
      sections: [...EVENT_PACKAGE_SECTIONS, stub],
      gates: { ...SECTION_GATES, deliverables: true },
    });
    expect(r.gatesMet).toBe(false);
    expect(describeMissing(r.blocking)).toEqual(["Lala's deliverables: posts"]);
    const ok = computeEventPackageReadiness({ ...full(), __stub_posts: true }, {
      sections: [...EVENT_PACKAGE_SECTIONS, stub],
      gates: { ...SECTION_GATES, deliverables: true },
    });
    expect(ok.gatesMet).toBe(true);
  });
});
