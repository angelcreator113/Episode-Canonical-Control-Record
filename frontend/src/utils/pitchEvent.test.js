/**
 * buildEventFromPitch — the create body for Build this episode (episode
 * creation step 6): organizer, venue and taxonomy to their columns,
 * featured people with roles, and every drafted field marked as drafted.
 */
import { describe, test, expect } from 'vitest';
import { buildEventFromPitch } from './pitchEvent';

const PITCH = {
  title: 'Champagne Before Noon', kind: 'career', category: 'brunch_dining', format: 'brunch',
  organizer: { kind: 'brand', name: 'Ori Beauty' },
  featured: [{ profile_id: 11, handle: 'maya', display_name: 'Maya Chen', role: 'opportunity' }],
  venue: { id: 'loc-1', name: 'The Honey Table' },
  premise: 'Ori Beauty hosts an intimate creator brunch.',
  opportunity: 'A first real relationship with Ori Beauty.', pressure: 'Brunch chic on 425 coins.', wildcard: 'Tasha is there.',
};

describe('buildEventFromPitch', () => {
  test('a brand pitch: host_brand, venue, taxonomy, featured guests, drafted marks', () => {
    expect(buildEventFromPitch(PITCH)).toEqual({
      name: 'Champagne Before Noon',
      description: 'Ori Beauty hosts an intimate creator brunch.',
      category: 'brunch_dining', format: 'brunch',
      narrative_stakes: 'A first real relationship with Ori Beauty.',
      fail_consequence: 'Brunch chic on 425 coins.',
      host_brand: 'Ori Beauty',
      venue_location_id: 'loc-1',
      canon_consequences: { automation: {
        guest_profiles: [{ profile_id: 11, handle: 'maya', display_name: 'Maya Chen', featured: true, story_role: 'opportunity' }],
        pitch: { kind: 'career', wildcard: 'Tasha is there.' },
        auto_drafted: {
          name: 'ai_draft', description: 'ai_draft', category: 'ai_draft', format: 'ai_draft',
          narrative_stakes: 'ai_draft', fail_consequence: 'ai_draft',
        },
        drafted_values: {
          name: 'Champagne Before Noon', description: 'Ori Beauty hosts an intimate creator brunch.',
          category: 'brunch_dining', format: 'brunch',
          narrative_stakes: 'A first real relationship with Ori Beauty.', fail_consequence: 'Brunch chic on 425 coins.',
        },
      } },
    });
  });

  test('a creator pitch links the creator; missing parts are left out, never filled in', () => {
    const body = buildEventFromPitch({ title: 'Garden Hours', organizer: { kind: 'creator', profile_id: 12, name: 'Dana' }, premise: 'Dana hosts.', featured: [] });
    expect(body).toMatchObject({ name: 'Garden Hours', source_profile_id: 12 });
    expect(body).not.toHaveProperty('host_brand');
    expect(body).not.toHaveProperty('venue_location_id');
    expect(body).not.toHaveProperty('category');
    expect(Object.keys(body.canon_consequences.automation.auto_drafted)).toEqual(['name', 'description']);
  });

  test('no title or organizer, no body', () => {
    expect(buildEventFromPitch({ title: 'x' })).toBeNull();
    expect(buildEventFromPitch(null)).toBeNull();
  });
});
