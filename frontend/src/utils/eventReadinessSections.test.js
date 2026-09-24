/**
 * eventReadinessSections — readiness by Event Package section and item
 * (Task #1775), with Evoni's Start Episode gates of 2026-09-24.
 */
import { describe, test, expect } from 'vitest';
import {
  computeEventPackageReadiness, computeEventState, describeMissing, moneyItem,
  EVENT_PACKAGE_SECTIONS, READINESS_ITEMS, EVENT_QUEUE_STATES,
} from './eventReadinessSections';
import { resolveEventBasics, AUTO_DATE_KEY } from './eventBasics';
import { resolveEventVenueAndDate, resolveEventOrganizer } from './eventReadiness';
import { resolveEventStakes } from './eventStakes';

// A fully built event: every item satisfied.
const full = () => ({
  id: 'ev-1',
  name: 'Velvet Hour',
  category: 'social',
  format: 'gala',
  event_date: '2026-11-07',
  event_time: '20:00',
  dress_code: 'black tie formal',
  source_profile_id: 7,
  canon_consequences: { automation: { guest_profiles: [{ profile_id: 1, featured: true }, { profile_id: 2 }] } },
  venue_location_id: 'loc-1',
  venue_name: 'Club Noir',
  scene_set_id: 'ss-1',
  invitation_asset_id: 'inv-1',
  outfit_pieces: [{ id: 'p1' }],
  narrative_stakes: 'Her first seat at the table.',
  prestige: 5, strictness: 5, cost_coins: 300, deadline_type: 'medium', career_tier: 1, is_paid: false,
});

const section = (r, key) => r.sections.find((s) => s.key === key);
const missingKeys = (r, key) => section(r, key).missing.map((m) => m.key);
const itemOf = (r, sec, key) => section(r, sec).items.find((i) => i.key === key);

describe('the gate declaration (Evoni, 2026-09-24)', () => {
  test('gates: organizer, name, category, format, date, venue, invitation', () => {
    expect(Object.entries(READINESS_ITEMS).filter(([, r]) => r.gate).map(([k]) => k).sort()).toEqual([
      'identity.category', 'identity.date', 'identity.format', 'identity.name',
      'invitation.invitation', 'organizer.organizer', 'place.venue',
    ]);
  });

  test('warnings: time, featured, scene set, outfit, dress code, story stakes, money — each with a consequence', () => {
    const warns = Object.entries(READINESS_ITEMS).filter(([, r]) => !r.gate);
    expect(warns.map(([k]) => k).sort()).toEqual([
      'identity.time', 'look.dress_code', 'look.outfit', 'people.featured',
      'place.scene_set', 'stakes.money', 'stakes.story_stakes',
    ]);
    for (const [, r] of warns) expect(r.consequence).toMatch(/\S/);
    expect(READINESS_ITEMS['place.scene_set'].consequence).toBe('Production will need a scene set before this event can be drawn.');
    expect(READINESS_ITEMS['identity.time'].consequence).toBe('The episode has no set time.');
    expect(READINESS_ITEMS['people.featured'].consequence).toBe('The script will draw on the full guest list.');
    expect(READINESS_ITEMS['look.outfit'].consequence).toMatch(/^Beat 8 needs an outfit/);
  });

  test('every item the sections produce has a declaration', () => {
    const r = computeEventPackageReadiness({});
    for (const s of r.sections) for (const i of s.items) expect(READINESS_ITEMS).toHaveProperty([`${s.key}.${i.key}`]);
  });
});

describe('items', () => {
  test('a complete event: everything satisfied, gates met, nothing to warn', () => {
    const r = computeEventPackageReadiness(full());
    expect(r.sections.map((s) => s.key)).toEqual(['organizer', 'identity', 'people', 'place', 'invitation', 'look', 'stakes']);
    expect(r.sections.every((s) => s.kind === 'complete')).toBe(true);
    expect(r.gatesMet).toBe(true);
    expect(r.allComplete).toBe(true);
  });

  test('an empty event lists every item as missing', () => {
    const r = computeEventPackageReadiness({});
    expect(missingKeys(r, 'organizer')).toEqual(['organizer']);
    expect(missingKeys(r, 'identity')).toEqual(['name', 'category', 'format', 'date', 'time']);
    expect(missingKeys(r, 'people')).toEqual(['featured']);
    expect(missingKeys(r, 'place')).toEqual(['venue', 'scene_set']);
    expect(missingKeys(r, 'invitation')).toEqual(['invitation']);
    expect(missingKeys(r, 'look')).toEqual(['outfit', 'dress_code']);
    expect(missingKeys(r, 'stakes')).toEqual(['story_stakes', 'money']);
    expect(r.gatesMet).toBe(false);
  });

  // One field removed at a time: that item alone is missing, and it
  // blocks or warns per the ruling.
  const cases = [
    ['organizer', 'organizer', true, (e) => { delete e.source_profile_id; }],
    ['identity', 'name', true, (e) => { e.name = ' '; }],
    ['identity', 'category', true, (e) => { e.category = null; }],
    ['identity', 'format', true, (e) => { e.format = ''; }],
    ['identity', 'date', true, (e) => { e.event_date = null; }],
    ['identity', 'time', false, (e) => { e.event_time = null; }],
    ['people', 'featured', false, (e) => { e.canon_consequences.automation.guest_profiles = [{ profile_id: 2 }]; }],
    ['place', 'venue', true, (e) => { e.venue_location_id = null; e.venue_name = null; }],
    ['place', 'scene_set', false, (e) => { e.scene_set_id = null; }],
    ['invitation', 'invitation', true, (e) => { e.invitation_asset_id = null; }],
    ['look', 'outfit', false, (e) => { e.outfit_pieces = []; }],
    ['look', 'dress_code', false, (e) => { e.dress_code = null; }],
    ['stakes', 'story_stakes', false, (e) => { e.narrative_stakes = '  '; }],
    ['stakes', 'money', false, (e) => { e.cost_coins = 100; }],
  ];
  test.each(cases)('%s.%s missing → gate=%s', (sec, key, gate, mutate) => {
    const ev = full();
    mutate(ev);
    const r = computeEventPackageReadiness(ev);
    const listed = (gate ? r.blockingItems : r.warningItems).map((i) => `${i.section}.${i.key}`);
    const other = (gate ? r.warningItems : r.blockingItems).map((i) => `${i.section}.${i.key}`);
    expect(listed).toEqual([`${sec}.${key}`]);
    expect(other).toEqual([]);
    expect(section(r, sec).kind).toBe(gate ? 'blocking' : 'warning');
    expect(r.gatesMet).toBe(!gate);
    expect(r.sections.filter((s) => s.key !== sec).every((s) => s.kind === 'complete')).toBe(true);
    const it = (gate ? r.blockingItems : r.warningItems)[0];
    expect(it.consequence).toBe(READINESS_ITEMS[`${sec}.${key}`].consequence);
  });

  test('a World Location link counts from its saved automation copy', () => {
    const ev = full();
    ev.venue_location_id = null; ev.venue_name = null;
    ev.canon_consequences.automation.venue_location_id = 'loc-1';
    expect(itemOf(computeEventPackageReadiness(ev), 'place', 'venue').satisfied).toBe(true);
  });

  test("Evoni's ruling: a venue name without a World Location link does not meet the gate", () => {
    const ev = { ...full(), venue_location_id: null, venue_name: 'Club Noir' };
    expect(resolveEventVenueAndDate(ev).hasVenue).toBe(true); // still displayed as a venue
    const r = computeEventPackageReadiness(ev);
    expect(itemOf(r, 'place', 'venue')).toMatchObject({
      satisfied: false, gate: true, note: 'Needs location link (saved name: Club Noir)',
    });
    expect(r.gatesMet).toBe(false);
    expect(computeEventState(ev)).toBe('needs_setup');
  });

  test('a name only in the automation copy also reads "Needs location link"', () => {
    const ev = full();
    ev.venue_location_id = null; ev.venue_name = null;
    ev.canon_consequences.automation.venue_name = 'Club Noir';
    expect(itemOf(computeEventPackageReadiness(ev), 'place', 'venue')).toMatchObject({
      satisfied: false, note: 'Needs location link (saved name: Club Noir)',
    });
  });

  test('outfit counts from outfit_set_id as well as pieces', () => {
    expect(itemOf(computeEventPackageReadiness({ ...full(), outfit_pieces: null, outfit_set_id: 's' }), 'look', 'outfit').satisfied).toBe(true);
  });

  test('a brand organizer satisfies the organizer gate', () => {
    const r = computeEventPackageReadiness({ ...full(), source_profile_id: null, host_brand: 'Maison Belle' });
    expect(r.gatesMet).toBe(true);
  });

  test('people: invited guests with none featured do not count, and the note says so', () => {
    const ev = full();
    ev.canon_consequences.automation.guest_profiles = [{ profile_id: 1 }, { profile_id: 2 }, { profile_id: 3 }];
    const f = itemOf(computeEventPackageReadiness(ev), 'people', 'featured');
    expect(f).toMatchObject({ satisfied: false, note: '3 invited, none featured' });
  });

  test('stakes: stored numbers alone never satisfy story stakes', () => {
    const ev = { ...full(), narrative_stakes: null, fail_consequence: null, prestige: 9, strictness: 8, deadline_type: 'urgent', career_tier: 4 };
    expect(itemOf(computeEventPackageReadiness(ev), 'stakes', 'story_stakes').satisfied).toBe(false);
  });

  test('stakes: a fail consequence alone counts, reported as stored not set', () => {
    const it = itemOf(computeEventPackageReadiness({ ...full(), narrative_stakes: null, fail_consequence: 'She loses the brand.' }), 'stakes', 'story_stakes');
    expect(it).toMatchObject({ satisfied: true, state: 'stored' });
  });
});

describe('money', () => {
  const m = (over) => { const ev = { ...full(), ...over }; return moneyItem(resolveEventStakes(ev), ev); };
  test('a cost other than the default is satisfied, stored', () => expect(m({ cost_coins: 300 })).toMatchObject({ satisfied: true, state: 'stored', note: null }));
  test('the column default (100) warns: it may never have been chosen', () => expect(m({ cost_coins: 100 })).toMatchObject({ satisfied: false, state: 'stored', note: 'Cost matches the column default (100 coins)' }));
  test('free (0) is satisfied', () => expect(m({ cost_coins: 0 })).toMatchObject({ satisfied: true }));
  test('a paid appearance is satisfied even with cost 100', () => expect(m({ cost_coins: 100, is_paid: true, payment_amount: 400 })).toMatchObject({ satisfied: true }));
  test('no cost at all (not possible on a real row) warns as missing', () => expect(m({ cost_coins: null })).toMatchObject({ satisfied: false, state: 'missing', note: 'No cost stored' }));
});

describe('suggestions never satisfy; accepted values do', () => {
  test('a suggested time is a warning, not satisfied', () => {
    const ev = { ...full(), event_time: null };
    expect(resolveEventBasics(ev).time.state).toBe('suggested');
    const r = computeEventPackageReadiness(ev);
    expect(r.warningItems.find((i) => i.key === 'time')).toMatchObject({ satisfied: false, state: 'suggested', note: 'Suggestion not accepted' });
    expect(r.gatesMet).toBe(true);
  });

  test('a suggested dress code is a warning, not satisfied; accepting it satisfies', () => {
    const ev = { ...full(), dress_code: null };
    const b = resolveEventBasics(ev);
    expect(b.dressCode.state).toBe('suggested');
    expect(itemOf(computeEventPackageReadiness(ev), 'look', 'dress_code')).toMatchObject({ satisfied: false, state: 'suggested' });
    const accepted = computeEventPackageReadiness({ ...ev, dress_code: b.dressCode.suggestion.value });
    expect(itemOf(accepted, 'look', 'dress_code').satisfied).toBe(true);
  });

  test('accepting a time suggestion satisfies it', () => {
    const ev = { ...full(), event_time: null };
    const v = resolveEventBasics(ev).time.suggestion.value;
    expect(computeEventPackageReadiness({ ...ev, event_time: v }).allComplete).toBe(true);
  });

  test('no Basics item is satisfied in any state but set', () => {
    for (const format of ['cocktail_party', 'garden_soiree', 'gallery_opening', 'gala', 'brunch', 'concert', 'brand_launch', 'premiere']) {
      const ev = { ...full(), format, event_time: null, dress_code: null };
      const r = computeEventPackageReadiness(ev);
      const b = resolveEventBasics(ev);
      expect(itemOf(r, 'identity', 'time').satisfied).toBe(b.time.state === 'set');
      expect(itemOf(r, 'look', 'dress_code').satisfied).toBe(b.dressCode.state === 'set');
      expect(itemOf(r, 'identity', 'date').satisfied).toBe(b.date.state === 'set');
    }
  });

  test('the auto-scheduled date counts as set and meets the date gate (Task #1756)', () => {
    const ev = full();
    ev.canon_consequences.automation[AUTO_DATE_KEY] = ev.event_date;
    expect(resolveEventBasics(ev).date.autoScheduled).toBe(true);
    const r = computeEventPackageReadiness(ev);
    expect(itemOf(r, 'identity', 'date')).toMatchObject({ satisfied: true, state: 'set', note: 'Auto-scheduled', gate: true });
    expect(r.gatesMet).toBe(true);
  });
});

describe('describeMissing', () => {
  test('blocking and warning items are listed apart', () => {
    const r = computeEventPackageReadiness({ ...full(), venue_location_id: null, venue_name: null, scene_set_id: null, invitation_asset_id: null });
    expect(describeMissing(r.blocking)).toEqual(['Place: venue', 'Invitation']);
    expect(describeMissing(r.warnings, 'warning')).toEqual(['Place: scene set']);
    expect(describeMissing(r.sections, 'all')).toEqual(['Place: venue, scene set', 'Invitation']);
  });
});

// The rule under Evoni's gates, written out independently of the module.
function expectedState(ev) {
  if (ev.status === 'declined' || ev.status === 'archived') return 'archived';
  if (ev.used_in_episode_id || ev.status === 'used' || ev.status === 'filmed') return 'used';
  if (!resolveEventOrganizer(ev).hasOrganizer) return 'needs_organizer';
  const gates = !!ev.name && !!ev.category && !!ev.format && !!ev.event_date
    && !!resolveEventVenueAndDate(ev).venueLocationId && !!ev.invitation_asset_id;
  return gates ? 'ready' : 'needs_setup';
}

describe('queue states', () => {
  const statuses = [undefined, 'draft', 'ready', 'used', 'filmed', 'declined', 'archived'];
  const fixtures = [];
  // bits: organizer, category, date, venue, invitation, scene set, outfit, used
  for (let mask = 0; mask < 256; mask += 1) {
    for (const status of statuses) {
      const ev = { name: 'E', format: 'gala', status };
      if (mask & 1) ev.source_profile_id = 1;
      if (mask & 2) ev.category = 'social';
      if (mask & 4) ev.event_date = '2026-11-07';
      if (mask & 8) ev.venue_location_id = 'loc';
      else if (status === 'draft') ev.venue_name = 'V'; // a name alone never meets the gate
      if (mask & 16) ev.invitation_asset_id = 'i';
      if (mask & 32) ev.scene_set_id = 's';
      if (mask & 64) ev.outfit_pieces = [{ id: 'p' }];
      if (mask & 128) ev.used_in_episode_id = 'ep';
      fixtures.push(ev);
    }
  }

  test(`computeEventState follows Evoni's gates on ${fixtures.length} fixtures`, () => {
    for (const ev of fixtures) expect(computeEventState(ev)).toBe(expectedState(ev));
  });

  test('CHANGE from the basis: missing only a scene set or an outfit is now Ready, not Needs Setup', () => {
    expect(computeEventState({ ...full(), scene_set_id: null })).toBe('ready');
    expect(computeEventState({ ...full(), outfit_pieces: [], outfit_set_id: null })).toBe('ready');
    expect(computeEventState({ ...full(), scene_set_id: null, outfit_pieces: [] })).toBe('ready');
  });

  test('CHANGE from the basis: missing a category or date is now Needs Setup', () => {
    expect(computeEventState({ ...full(), category: null })).toBe('needs_setup');
    expect(computeEventState({ ...full(), event_date: null })).toBe('needs_setup');
  });

  test('Needs Organizer comes before Needs Setup', () => {
    expect(computeEventState({ ...full(), source_profile_id: null, invitation_asset_id: null })).toBe('needs_organizer');
  });

  test('warning items never change the queue state', () => {
    const ev = { ...full(), event_time: null, dress_code: null, narrative_stakes: null, cost_coins: 100, scene_set_id: null, outfit_pieces: [], canon_consequences: {} };
    expect(computeEventState(ev)).toBe('ready');
  });

  test('a precomputed readiness can be passed in', () => {
    const ev = { ...full(), invitation_asset_id: null };
    expect(computeEventState(ev, computeEventPackageReadiness(ev))).toBe('needs_setup');
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
  const sections = [...EVENT_PACKAGE_SECTIONS, stub];

  test('as a warning when it has no declaration', () => {
    const r = computeEventPackageReadiness(full(), { sections });
    expect(section(r, 'deliverables')).toMatchObject({ kind: 'warning', complete: false });
    expect(r.gatesMet).toBe(true);
    expect(r.warningItems.map((i) => `${i.section}.${i.key}`)).toEqual(['deliverables.posts']);
  });

  test('or as a gate with one declaration line', () => {
    const items = { ...READINESS_ITEMS, 'deliverables.posts': { gate: true, consequence: 'No posts planned.' } };
    const r = computeEventPackageReadiness(full(), { sections, items });
    expect(r.gatesMet).toBe(false);
    expect(describeMissing(r.blocking)).toEqual(["Lala's deliverables: posts"]);
    expect(r.blockingItems[0].consequence).toBe('No posts planned.');
    expect(computeEventPackageReadiness({ ...full(), __stub_posts: true }, { sections, items }).gatesMet).toBe(true);
  });

  test('flipping an existing item is one line too', () => {
    const items = { ...READINESS_ITEMS, 'place.scene_set': { ...READINESS_ITEMS['place.scene_set'], gate: true } };
    expect(computeEventPackageReadiness({ ...full(), scene_set_id: null }, { items }).gatesMet).toBe(false);
  });
});
