/**
 * A link to a section lands on it (Evoni, 2026-10-07): Money's "Open terms
 * in the event" goes to #epp-sec-deal, and the page used to stay at the top.
 */
import { vi, test, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import EventPackagePage from './EventPackagePage';

const EVENT = { id: 'ev-1', show_id: 'show-1', name: 'Studio Session', event_type: 'invite', prestige: 4, updated_at: '2026-10-06T10:00:00.000Z', canon_consequences: { automation: {} } };

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockImplementation(async (url) => (url === '/api/v1/world/show-1/events/ev-1'
    ? { data: { success: true, event: EVENT, sourceProfile: null, startedFromProfile: null, sceneSet: null, venueLocation: null, invitationAsset: null } }
    : { data: { success: true, deliverables: [], locked: false } }));
});

test('#epp-sec-deal scrolls to the Deal section once the page has loaded', async () => {
  const scrolled = [];
  const had = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function scrollIntoView() { scrolled.push(this.id); }; // jsdom has none
  render(
    <MemoryRouter initialEntries={['/shows/show-1/events/ev-1#epp-sec-deal']}>
      <Routes><Route path="/shows/:showId/events/:eventId" element={<EventPackagePage />} /></Routes>
    </MemoryRouter>,
  );
  await screen.findByTestId('deal-section');
  await waitFor(() => expect(scrolled).toContain('epp-sec-deal'));
  Element.prototype.scrollIntoView = had;
});
