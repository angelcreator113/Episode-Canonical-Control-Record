/**
 * The Event Package's sections 1 to 4 (Evoni's redesign, part 2): numbered,
 * The Event with its invitation beside it, People with the organizer beside
 * the featured attendees (amber with none, saying what that means), and
 * Lala's Look with the dress code and styling brief beside the outfit.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import EventPackagePage from './EventPackagePage';

let EVENT;
const BASE = {
  id: 'ev-1', show_id: 'show-1', name: 'Velour Awards Night', event_type: 'invite', prestige: 6, category: 'arts_entertainment', format: 'gala',
  event_date: '2026-11-09', host_brand: 'Velour', venue_location_id: 'loc-1', invitation_asset_id: 'asset-inv-1', dress_code: 'Black tie',
  updated_at: '2026-09-25T10:00:00.000Z',
  canon_consequences: { automation: {
    guest_profiles: [{ id: 'g1', handle: 'thriftveil' }, { id: 'g2', handle: 'showroom.lux' }],
    styling_brief: { formality: 'Formal', style_direction: 'Old Hollywood', footwear_requirements: 'Heels you can stand in' },
  } },
};

const renderPage = () => render(
  <MemoryRouter initialEntries={['/shows/show-1/events/ev-1']}>
    <Routes><Route path="/shows/:showId/events/:eventId" element={<EventPackagePage />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  EVENT = BASE;
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/world/show-1/events/ev-1') {
      return { data: { success: true, event: EVENT, sourceProfile: null, startedFromProfile: null, sceneSet: null, venueLocation: null, invitationAsset: null, usedInEpisode: null } };
    }
    return { data: { success: true, deliverables: [], locked: false } };
  });
});

describe('Event Package sections 1 to 4', () => {
  test('numbered; the invitation sits inside The Event, under its own anchor', async () => {
    renderPage();
    const event = await screen.findByRole('heading', { name: /^1\. The Event/ });
    const section = event.closest('section');
    expect(section.id).toBe('epp-sec-identity');
    expect(within(section).getByText('Invitation')).toBeTruthy();
    expect(section.querySelector('#epp-sec-invitation')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '2. People' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '3. Place' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: "4. Lala's Look" })).toBeTruthy();
  });

  test('with no featured attendees the panel is amber and says what that means', async () => {
    renderPage();
    const panel = await screen.findByTestId('featured-panel');
    expect(panel.className).toContain('none');
    expect(panel.textContent).toContain('No featured attendees yet · 2 invited');
    expect(screen.getByTestId('featured-consequence').textContent).toContain('The script will draw on the full guest list.');
  });

  test("Lala's Look: the dress code and brief beside the empty outfit card, its button choosing an outfit", async () => {
    renderPage();
    const brief = await screen.findByTestId('look-brief');
    expect([...brief.querySelectorAll('dt')].map((d) => d.textContent)).toEqual(['Dress code', 'Formality', 'Style direction', 'Footwear']);
    expect(brief.textContent).toContain('Old Hollywood');
    const card = screen.getByTestId('outfit-card');
    expect(card.textContent).toContain('No outfit yet');
    expect(card.textContent).toContain('the coin cost is charged at Finalize');
    expect(within(card).getByTestId('style-choose-outfit').textContent).toContain('Choose outfit');
    expect(screen.getByTestId('style-outfit-summary').textContent).toBe('Not chosen');
  });

  test('a chosen outfit lists its pieces; with no brief only the dress code shows', async () => {
    EVENT = { ...BASE, outfit_pieces: [{ id: 'w1', name: 'Velvet Gown' }, { id: 'w2', name: 'Satin Pumps' }], canon_consequences: { automation: {} } };
    renderPage();
    const card = await screen.findByTestId('outfit-card');
    expect(card.textContent).toContain('Velvet Gown');
    expect(within(card).getByTestId('style-choose-outfit').textContent).toContain('Change outfit');
    expect(screen.getByTestId('style-outfit-summary').textContent).toBe('2 pieces chosen');
    expect([...screen.getByTestId('look-brief').querySelectorAll('dt')].map((d) => d.textContent)).toEqual(['Dress code']);
  });
});

describe('Event Package part 3', () => {
  test('5. Deal & Money holds the money tiles, the Terms and the money preview; 6. Story Stakes follows', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/world/show-1/events/ev-1') {
        return { data: { success: true, event: EVENT, sourceProfile: null, startedFromProfile: null, sceneSet: null, venueLocation: null, invitationAsset: null, usedInEpisode: null } };
      }
      if (url === '/api/v1/world/show-1/events/ev-1/money-preview') {
        return { data: { success: true, data: { balance: 1900, lines: [{ key: 'fee', label: 'Appearance fee', signed: 300 }], projection: { projected_balance: 2200, conditional: [] } } } };
      }
      return { data: { success: true, deliverables: [], locked: false } };
    });
    renderPage();
    const deal = await screen.findByTestId('deal-section');
    expect(within(deal).getByRole('heading', { name: /^5\. Deal & Money/ })).toBeTruthy();
    expect(within(deal).getByTestId('terms-section')).toBeTruthy();
    expect((await within(deal).findByTestId('deal-earns')).textContent).toContain('300 coins');
    expect(within(deal).getByTestId('deal-bonus').textContent).toContain('None');
    expect(within(deal).getByTestId('money-preview')).toBeTruthy();
    const stakes = screen.getByTestId('stakes-section');
    expect(within(stakes).getByRole('heading', { name: '6. Story Stakes' })).toBeTruthy();
    expect(within(stakes).queryByTestId('money-preview')).toBeNull();
  });
  test('the Full Guest List shows ten; Show more opens the rest, Show less folds them', async () => {
    const guests = Array.from({ length: 13 }, (_, i) => ({ profile_id: `p${i}`, handle: `guest${i + 1}` }));
    EVENT = { ...BASE, canon_consequences: { automation: { guest_profiles: guests } } };
    renderPage();
    fireEvent.click(await screen.findByText('Show Full Guest List (13)'));
    const list = document.getElementById('epp-guest-list');
    expect(list.querySelectorAll('li')).toHaveLength(10);
    const more = screen.getByTestId('guest-list-more');
    expect(more.textContent).toContain('Show 3 more guests');
    fireEvent.click(more);
    expect(list.querySelectorAll('li')).toHaveLength(13);
    expect(list.textContent).toContain('guest13');
    fireEvent.click(more);
    expect(list.querySelectorAll('li')).toHaveLength(10);
  });
});
