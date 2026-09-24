/**
 * eventOrganizer — the Event Package's organizer display and the exact
 * PUT bodies Change Organizer sends (Task #1761).
 */
import { describe, test, expect } from 'vitest';
import { createRequire } from 'module';
import {
  describeEventOrganizer, buildCreatorOrganizerUpdate, buildBrandOrganizerUpdate,
  filterBrands, brandIsListed, BRAND_NAME_MAX,
} from './eventOrganizer';
import { resolveEventOrganizer } from './eventReadiness';
import { computeEventState } from './eventReadinessSections';

// The server's own merge for PUT canon_consequences (PR #1749), so each
// scenario below replays what the route actually stores.
const { mergeCanonConsequences } = createRequire(import.meta.url)('../../../src/utils/canonConsequencesMerge.js');

// Mirrors the PUT: top-level keys sent replace, '' / null clear,
// canon_consequences merges two levels deep.
function applyPut(row, body) {
  const next = { ...row };
  for (const [key, value] of Object.entries(body)) {
    if (key === 'canon_consequences') next.canon_consequences = mergeCanonConsequences(row.canon_consequences, value);
    else next[key] = value === '' ? null : value;
  }
  return next;
}

const ALLOWED = new Set(['source_profile_id', 'host', 'host_brand', 'canon_consequences']);

const creatorP = { id: 42, handle: 'maya.styles', display_name: 'Maya Styles', registry_character_id: 'rc-42' };
const creatorQ = { id: 7, handle: 'jules', display_name: 'Jules Arden', registry_character_id: null };

// A from-profile event: the route writes the creator in both homes and the
// creator's first brand partnership into host_brand (worldEvents.js).
const fromProfileEvent = () => ({
  id: 'e1', name: "Maya Styles's Soirée", host: 'Maya Styles', host_brand: 'Velour',
  source_profile_id: 42,
  canon_consequences: {
    invitation_text: { body: 'keep me' },
    automation: {
      host_profile_id: 42, host_handle: 'maya.styles', host_display_name: 'Maya Styles',
      host_registry_character_id: 'rc-42', host_brand: 'Velour',
      guest_profiles: [{ profile_id: 9, featured: true }],
    },
  },
});

describe('describeEventOrganizer', () => {
  test('no organizer', () => {
    const d = describeEventOrganizer({ canon_consequences: null }, null);
    expect(d).toMatchObject({ kind: null, name: null, hasOrganizer: false, alsoLinkedCreator: null });
  });

  test('creator organizer names the linked profile, not a stale automation copy', () => {
    const ev = { source_profile_id: 7, host: 'Jules Arden', canon_consequences: { automation: { host_profile_id: 42, host_display_name: 'Maya Styles' } } };
    // resolveEventOrganizer (unchanged) prefers the automation copy...
    expect(resolveEventOrganizer(ev).creatorName).toBe('Maya Styles');
    // ...the Package shows the linked profile the GET returned.
    const d = describeEventOrganizer(ev, creatorQ);
    expect(d).toMatchObject({ kind: 'creator', name: 'Jules Arden', handle: 'jules' });
  });

  test('both set: the brand is the organizer and the creator is shown as also linked', () => {
    const d = describeEventOrganizer(fromProfileEvent(), creatorP);
    expect(d).toMatchObject({ kind: 'brand', name: 'Velour', alsoLinkedCreator: 'Maya Styles', handle: null });
  });

  test('brand only from the automation copy still counts', () => {
    const d = describeEventOrganizer({ canon_consequences: { automation: { host_brand: 'Maison Belle' } } }, null);
    expect(d).toMatchObject({ kind: 'brand', name: 'Maison Belle' });
  });
});

describe('buildCreatorOrganizerUpdate', () => {
  test('on a from-profile event with a sponsor brand: clears the brand in both homes', () => {
    const ev = fromProfileEvent();
    const u = buildCreatorOrganizerUpdate(ev, creatorP);
    expect(u.body).toEqual({ host_brand: null, canon_consequences: { automation: { host_brand: null } } });
    expect(u.clears).toEqual([{ kind: 'brand', value: 'Velour' }]);
    const stored = applyPut(ev, u.body);
    expect(resolveEventOrganizer(stored)).toMatchObject({ organizerKind: 'creator', hasBrand: false });
    expect(stored.canon_consequences.automation).not.toHaveProperty('host_brand');
    // Nothing else in canon_consequences moves.
    expect(stored.canon_consequences.invitation_text).toEqual({ body: 'keep me' });
    expect(stored.canon_consequences.automation.guest_profiles).toEqual([{ profile_id: 9, featured: true }]);
  });

  test('switching creators moves both homes to the new creator', () => {
    const ev = { ...fromProfileEvent(), host_brand: null };
    delete ev.canon_consequences.automation.host_brand;
    const u = buildCreatorOrganizerUpdate(ev, creatorQ);
    expect(u.body).toEqual({
      source_profile_id: 7,
      host: 'Jules Arden',
      canon_consequences: {
        automation: {
          host_profile_id: 7, host_handle: 'jules', host_display_name: 'Jules Arden',
          host_registry_character_id: null,
        },
      },
    });
    expect(u.clears).toEqual([]);
    const stored = applyPut(ev, u.body);
    expect(describeEventOrganizer(stored, creatorQ)).toMatchObject({ kind: 'creator', name: 'Jules Arden' });
    expect(resolveEventOrganizer(stored).creatorName).toBe('Jules Arden');
  });

  test('a plain event: only source_profile_id and host, no automation home created', () => {
    const ev = { host: null, host_brand: null, source_profile_id: null, canon_consequences: { automation: { venue_name: 'X' } } };
    const u = buildCreatorOrganizerUpdate(ev, creatorP);
    expect(u.body).toEqual({ source_profile_id: 42, host: 'Maya Styles' });
    expect(computeEventState(applyPut(ev, u.body))).not.toBe('needs_organizer');
  });

  test('choosing the current creator again sends nothing', () => {
    const ev = { host: 'Maya Styles', host_brand: null, source_profile_id: 42, canon_consequences: {} };
    expect(buildCreatorOrganizerUpdate(ev, creatorP)).toMatchObject({ body: {}, unchanged: true });
  });
});

describe('buildBrandOrganizerUpdate', () => {
  test('over a creator: unlinks the creator in both homes and the host mirror', () => {
    const ev = { ...fromProfileEvent(), host_brand: null };
    delete ev.canon_consequences.automation.host_brand;
    const u = buildBrandOrganizerUpdate(ev, 'Maison Belle', creatorP);
    expect(u.body).toEqual({
      host_brand: 'Maison Belle',
      host: null,
      source_profile_id: null,
      canon_consequences: {
        automation: { host_profile_id: null, host_handle: null, host_display_name: null, host_registry_character_id: null },
      },
    });
    expect(u.clears).toEqual([{ kind: 'creator', value: 'Maya Styles' }]);
    const stored = applyPut(ev, u.body);
    expect(resolveEventOrganizer(stored)).toMatchObject({ organizerKind: 'brand', brandName: 'Maison Belle', hasCreator: false });
    expect(describeEventOrganizer(stored, null).alsoLinkedCreator).toBeNull();
    expect(stored.canon_consequences.automation.guest_profiles).toHaveLength(1);
    expect(computeEventState(stored)).not.toBe('needs_organizer');
  });

  test('keeps a typed host that is not the creator', () => {
    const ev = { host: 'Velour Events', host_brand: null, source_profile_id: 42, canon_consequences: null };
    const u = buildBrandOrganizerUpdate(ev, 'Velour', creatorP);
    expect(u.body).toEqual({ host_brand: 'Velour', source_profile_id: null });
  });

  test('replacing a brand updates an existing automation copy, never creates one', () => {
    const withCopy = { host_brand: 'Velour', canon_consequences: { automation: { host_brand: 'Velour' } } };
    expect(buildBrandOrganizerUpdate(withCopy, 'Maison Belle', null).body).toEqual({
      host_brand: 'Maison Belle', canon_consequences: { automation: { host_brand: 'Maison Belle' } },
    });
    const noCopy = { host_brand: 'Velour', canon_consequences: { automation: {} } };
    expect(buildBrandOrganizerUpdate(noCopy, 'Maison Belle', null).body).toEqual({ host_brand: 'Maison Belle' });
  });

  test('a brand only in the automation copy gets written to the column', () => {
    const ev = { host_brand: null, canon_consequences: { automation: { host_brand: 'Velour' } } };
    expect(buildBrandOrganizerUpdate(ev, 'Velour', null)).toMatchObject({ body: { host_brand: 'Velour' }, clears: [] });
  });

  test('empty name is refused; long names are cut to the column size', () => {
    expect(buildBrandOrganizerUpdate({}, '   ', null)).toBeNull();
    const long = 'x'.repeat(BRAND_NAME_MAX + 50);
    expect(buildBrandOrganizerUpdate({}, long, null).body.host_brand).toHaveLength(BRAND_NAME_MAX);
  });

  test('choosing the current brand again sends nothing', () => {
    const ev = { host_brand: 'Velour', canon_consequences: { automation: { host_brand: 'Velour' } } };
    expect(buildBrandOrganizerUpdate(ev, 'Velour', null)).toMatchObject({ body: {}, unchanged: true });
  });
});

describe('every body only uses PUT allowlisted fields', () => {
  test('creator and brand bodies', () => {
    const bodies = [
      buildCreatorOrganizerUpdate(fromProfileEvent(), creatorQ).body,
      buildBrandOrganizerUpdate(fromProfileEvent(), 'Maison Belle', creatorP).body,
    ];
    for (const b of bodies) for (const k of Object.keys(b)) expect(ALLOWED.has(k)).toBe(true);
  });
});

describe('brand list helpers', () => {
  const brands = [
    { id: 'b1', name: 'Maison Belle', category: 'fashion' },
    { id: 'b2', name: 'Luxe Cosmetics', category: 'beauty' },
    { id: 'b3', name: null },
  ];
  test('filterBrands matches name or category, drops unnamed rows', () => {
    expect(filterBrands(brands, '').map((b) => b.id)).toEqual(['b1', 'b2']);
    expect(filterBrands(brands, 'beau').map((b) => b.id)).toEqual(['b2']);
    expect(filterBrands(brands, 'maison').map((b) => b.id)).toEqual(['b1']);
    expect(filterBrands(null, 'x')).toEqual([]);
  });
  test('brandIsListed is an exact name match', () => {
    expect(brandIsListed(brands, 'Maison Belle')).toBe(true);
    expect(brandIsListed(brands, 'maison belle')).toBe(false);
    expect(brandIsListed(brands, 'Velour')).toBe(false);
  });
});
