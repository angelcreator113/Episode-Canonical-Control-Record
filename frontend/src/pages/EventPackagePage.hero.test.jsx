/**
 * The Event Package's header, readiness strip and "On this page" menu, in
 * the Producer Mode style (Evoni's redesign, 2026-10-05): the name with
 * five tiles under it, readiness at the top with a tile per section that
 * jumps to it, and a menu whose dots mark the sections that need attention.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import EventPackagePage from './EventPackagePage';

const EVENT = {
  id: 'ev-1', show_id: 'show-1', name: 'Velour Awards Night', event_type: 'invite', prestige: 6, strictness: 5,
  deadline_type: 'medium', dress_code_keywords: [], category: 'arts_entertainment', format: 'gala',
  event_date: '2026-11-09', event_time: '19:00', host_brand: 'Velour', venue_location_id: 'loc-1', venue_name: 'The Velour',
  invitation_asset_id: 'asset-inv-1', is_paid: true, payment_amount: 300, deal_type: 'paid_appearance',
  updated_at: '2026-09-25T10:00:00.000Z', canon_consequences: { automation: {} },
};

const renderPage = () => render(
  <MemoryRouter initialEntries={['/shows/show-1/events/ev-1']}>
    <Routes><Route path="/shows/:showId/events/:eventId" element={<EventPackagePage />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/world/show-1/events/ev-1') {
      return { data: { success: true, event: EVENT, sourceProfile: null, startedFromProfile: null, sceneSet: null, venueLocation: null, invitationAsset: null, usedInEpisode: null } };
    }
    return { data: { success: true, deliverables: [], locked: false } };
  });
});

describe('Event Package header', () => {
  test('the name with its five tiles: when, where, organizer, deal, challenge', async () => {
    renderPage();
    const hero = await screen.findByTestId('package-hero');
    expect(within(hero).getByRole('heading', { name: 'Velour Awards Night' })).toBeTruthy();
    expect(screen.getByTestId('hero-when').textContent).toBe('WhenMon, Nov 97:00 PM');
    expect(screen.getByTestId('hero-where').textContent).toContain('The Velour');
    expect(screen.getByTestId('hero-organizer').textContent).toContain('Velour');
    expect(screen.getByTestId('hero-deal').textContent).toContain('Earns 300 coins');
    expect(screen.getByTestId('hero-challenge').textContent).toMatch(/Challenge(Easy|Medium|Hard|Extreme)projected/);
  });

  test('readiness sits at the top, a tile per section that links to it; the menu dots the sections that need attention', async () => {
    renderPage();
    const strip = await screen.findByTestId('readiness-strip');
    expect(strip.textContent).toMatch(/Readiness/);
    expect(within(strip).getByTestId('package-next')).toBeTruthy(); // Continue lives in the strip
    const place = within(strip).getByTestId('strip-place');
    expect(place.getAttribute('href')).toBe('#epp-sec-place');
    expect(within(strip).getByTestId('strip-organizer').getAttribute('href')).toBe('#epp-sec-people');
    const look = within(strip).getByTestId('strip-look');
    expect(look.getAttribute('data-state')).not.toBe('complete'); // no outfit yet

    const toc = screen.getByTestId('package-toc');
    expect([...toc.querySelectorAll('a')].map((a) => a.textContent)).toEqual(['Basics', 'People', 'Place', 'Invitation', 'Style', 'Stakes & Money', 'Review']);
    expect(within(toc).getByTestId('toc-look').className).toMatch(/state-(warning|blocking)/);
    expect(within(toc).getByTestId('toc-review').className).toBe('state-none');
    expect(document.getElementById('epp-sec-review')).toBeTruthy();
  });
});
