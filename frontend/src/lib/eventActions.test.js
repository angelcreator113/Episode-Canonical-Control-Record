/**
 * lib/eventFlow: beat 14's preview line, the episode's status line, what
 * Start Episode copies, and the follow-up's create body.
 */
import { describe, test, expect } from 'vitest';
import { beat14Line, episodeStatus, startCopies, followUpBody, fieldValueText } from './eventActions';

const opp = (over = {}) => ({ id: 'o1', name: 'Maison Velour SS27 campaign', status: 'offered', ...over });

describe('beat14Line', () => {
  test('the best fit, from the host, with what to do before the episode exists', () => {
    const line = beat14Line({ host: { name: 'Ama' }, people: 2, best: { ...opp(), fit: { best: true, reasons: [{ text: 'Same brand as the host' }] } }, others: 0 });
    expect(line).toEqual({ tone: 'fit', lead: "This event's host can offer:", name: 'Maison Velour SS27 campaign', tag: 'best fit', note: 'Attach it on beat 14 once the episode exists.' });
  });
  test('a fit that is not the best says its reason; others are counted; with an episode, the Script tab', () => {
    const line = beat14Line({ host: null, people: 1, best: { ...opp(), fit: { best: false, reasons: [{ text: 'Campaign suits a gala' }] } }, others: 2 }, { hasEpisode: true });
    expect(line.lead).toBe('Someone at this event can offer:');
    expect(line.tag).toBe('campaign suits a gala');
    expect(line.note).toBe("2 other open opportunities also fit. Attach it on the episode's Script tab, beat 14.");
  });
  test('attached, drafted, nobody, nothing', () => {
    expect(beat14Line({ people: 1, attached: opp({ status: 'held' }) })).toMatchObject({ tone: 'set', name: 'Maison Velour SS27 campaign', tag: 'held until the episode is completed' });
    expect(beat14Line({ host: { name: 'Ama' }, people: 1, best: null, draft: { name: 'Ama brand deal', from: 'Ama' } })).toMatchObject({ tone: 'draft', name: 'Ama brand deal' });
    expect(beat14Line({ people: 0 })).toMatchObject({ tone: 'empty', name: null });
    expect(beat14Line({ people: 2, best: null, draft: null }).note).toBe('No open opportunity fits this event yet.');
    expect(beat14Line(null)).toBeNull();
  });
});

describe('episodeStatus', () => {
  test('"In the edit · needs thumbnail · releases Sun, Nov 1 · 10:00 AM"', () => {
    const ep = { status: 'in_review', thumbnail_url: null, title: 'T', title_approved_at: '2026-10-01', title_approved_value: 'T', distribution_metadata: { youtube: { title: 'x' } } };
    const posts = [{ status: 'live' }];
    const row = { date: '2026-11-01', time: '10:00', source: 'schedule' };
    expect(episodeStatus(ep, posts, row).line).toBe('In the edit · needs thumbnail · releases Sun, Nov 1 · 10:00 AM');
  });
  test('everything it needs; no date; a preview date; released', () => {
    const ready = { status: 'in_build', thumbnail_url: 'x', title: 'T', title_approved_at: 'x', title_approved_value: 'T', distribution_metadata: { youtube: { title: 'x' } } };
    expect(episodeStatus(ready, [{ status: 'draft' }], null).line).toBe('In production · has what it needs · no release date yet');
    expect(episodeStatus({ status: 'draft' }, null, { date: '2026-11-08', source: 'preview' }).line).toBe('In planning · needs thumbnail, title & copy · would release Sun, Nov 8');
    expect(episodeStatus({ status: 'published', air_date: '2026-10-25' }, [], null).line).toBe('Released · released Sun, Oct 25');
  });
});

describe('startCopies', () => {
  const event = {
    deal_type: 'brand_partnership', outfit_pieces: [{ id: 1 }, { id: 2 }], scene_set_id: 's1', invitation_asset_id: 'a1',
    canon_consequences: { pinned_goal_ids: ['g1', 'g2'], automation: { guest_profiles: [{ id: 1, featured: true }, { id: 2 }, { id: 3 }] } },
  };
  test('"Starting this copies: 2 goals, 3 guests, the deal, the look, the venue …"', () => {
    const seeds = { deliverables: { data: { deliverables: [{ id: 'd1' }] } }, costs: { data: { costs: [{ id: 'c1' }, { id: 'c2' }] } } };
    const got = startCopies(event, { seeds, invitationAsset: { approval_status: 'approved' }, venueDate: { venueLocationId: 'loc' }, seasonContext: { in_slot: true, label: 'S1 · E3' } });
    expect(got.items.map((i) => i.key)).toEqual(['goals', 'guests', 'deal', 'look', 'venue', 'invitation', 'costs', 'slot']);
    expect(got.sentence).toBe('Starting this copies: 2 goals, 3 guests (1 featured), the deal and its 1 deliverable, the look (2 pieces), the venue and its set, the approved invitation, 2 cost lines, its season slot (S1 · E3).');
  });
  test('only what the event has; a failed part is left out', () => {
    expect(startCopies({ canon_consequences: {} }).items).toEqual([]);
    expect(startCopies({ canon_consequences: {} }).sentence).toBeNull();
    expect(startCopies({ deal_type: 'gifted', canon_consequences: {} }, { seeds: { deliverables: { error: 'x' } } }).items).toEqual([{ key: 'deal', text: 'the deal' }]);
  });
});

describe('followUpBody', () => {
  test('the same host, brand, organizer, venue type and deal; the chain; no guests, dates or look', () => {
    const event = {
      id: 'ev-1', name: 'Velour Night', event_type: 'invite', host: null, host_brand: 'Maison Velour', source_profile_id: 5,
      deal_type: 'brand_partnership', event_date: '2026-11-01', outfit_pieces: [{ id: 1 }], chain_position: 2,
      canon_consequences: { automation: { guest_profiles: [{ id: 1 }] } },
    };
    const { body, dealType } = followUpBody(event, { organizer: { name: 'Maison Velour' }, venueLocation: { venue_type: 'rooftop_bar' } });
    expect(body).toEqual({
      name: 'Maison Velour — follow-up', event_type: 'invite', host: null, host_brand: 'Maison Velour', source_profile_id: 5,
      location_hint: 'Rooftop bar', parent_event_id: 'ev-1', chain_position: 3, chain_reason: 'Follow-up to Velour Night',
    });
    expect(dealType).toBe('brand_partnership');
  });
  test('named after the event when it has no organizer; no venue type, no hint', () => {
    expect(followUpBody({ id: 'e', name: 'Brunch' }).body).toMatchObject({ name: 'Brunch — follow-up', location_hint: null, chain_position: null });
  });
});

describe('fieldValueText', () => {
  test('lists, deals, prestige and fees in words', () => {
    expect(fieldValueText('deal_type', 'brand_partnership')).toBe('Brand partnership');
    expect(fieldValueText('prestige', 8)).toBe('Prestige 8');
    expect(fieldValueText('appearance_fee', 1500)).toBe('1,500 coins');
    expect(fieldValueText('dress_code', 'Black tie')).toBe('Black tie');
  });
});
