/**
 * A brand's or company's profile (pages/BrandProfilePage; Evoni,
 * 2026-10-18): the tabs its kind has, identity in its three layers, people
 * with their authority in words, and Evoni's edits.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
const auth = { user: { groups: ['admin'] } };
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));

import api from '../services/api';
import BrandProfilePage from './BrandProfilePage';

const velour = () => ({
  success: true,
  company: { id: 'b-1', slug: 'velour_atelier', name: 'Velour Atelier', kind: 'brand', kind_label: 'Fashion brand', category: 'fashion', defining_principle: 'Nothing extraneous' },
  sections: [
    { key: 'identity', label: 'Identity' }, { key: 'people', label: 'People' }, { key: 'pulse', label: 'On The Pulse' },
    { key: 'business', label: 'Business' }, { key: 'wardrobe', label: 'Wardrobe' }, { key: 'press', label: 'Press & events' },
    { key: 'relationships', label: 'Relationships' },
  ],
  identity: {
    history: [{ key: 'founder', label: 'Founder', value: 'A designer told her taste was too specific.' }],
    beliefs: [{ key: 'defining_principle', label: 'Defining principle', value: 'Nothing extraneous' }, { key: 'earns_trust', label: 'Earns its trust', value: ['Preparation', 'Punctuality'] }],
    tone: [{ key: 'direction', label: 'Its tone', value: 'Restrained, architectural' }],
  },
  people: { founder: 'A designer', people: [{ character_id: 'c-1', key: 'vivienne_laurent', name: 'Vivienne Laurent', status: 'draft', title: 'Creative Director', core_belief: 'Restraint is confidence.', authority: { label: 'High creative authority', creative: 'approve', negotiate: 'within_approved', spend: 'delegated', finalize: 'none' } }] },
  pulse: { account: { id: 9, handle: 'velouratelier' }, from: 'account', posts: [{ id: 'p-1', handle: 'velouratelier', text: 'Ivory, cut close.', status: 'live', at: '2026-10-18T10:00:00Z' }], replies: [] },
  business: [{ id: 'o-1', name: 'Velour cover', show: 'Styling Adventures', status: 'booked', amount: 1200, linked: true, dates: [{ kind: 'Shoot', date: '2026-10-20' }] }],
  wardrobe: [{ id: 'w-1', name: 'Ivory slip dress', image: 'https://img/w.png', event: 'The Gala' }],
  press: { coverage: [], posts: [], events: [{ id: 'e-1', name: 'Velour gala', status: 'draft', venue: 'The Glass Room' }] },
  relationships: [{ slug: 'carte_blanche', name: 'Carte Blanche', kind: 'rivals', note: 'Two answers.', linked: true }],
});

const renderAt = (path = '/brands/velour_atelier') => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/brands/:slug" element={<BrandProfilePage />} /></Routes>
  </MemoryRouter>,
);

describe('BrandProfilePage', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    auth.user = { groups: ['admin'] };
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (/posting-schedule/.test(url)) return { data: { success: true, schedule: null, suggestion: null } };
      return { data: velour() };
    });
  });

  test('a brand: its header, its seven tabs, and identity in three layers', async () => {
    renderAt();
    expect(await screen.findByRole('heading', { name: 'Velour Atelier' })).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/api/v1/companies/velour_atelier');
    expect(screen.getAllByRole('tab').map((t) => t.textContent.trim())).toEqual(['Identity', 'People', 'On The Pulse', 'Business', 'Wardrobe', 'Press & events', 'Relationships']);
    const identity = screen.getByTestId('bp-identity');
    for (const title of ['Its history', 'What it believes', 'Its tone']) expect(within(identity).getByRole('heading', { name: title })).toBeTruthy();
    expect(identity.textContent).toContain('Established canon. Only you change it');
    expect(identity.textContent).toContain('Punctuality');
    expect(screen.getByText('@velouratelier on The Pulse')).toBeTruthy();
  });

  test('people: their title and their authority in words, linked to their character', async () => {
    renderAt('/brands/velour_atelier?tab=people');
    const people = await screen.findByTestId('bp-people');
    expect(within(people).getByRole('link', { name: 'Vivienne Laurent' }).getAttribute('href')).toBe('/character/c-1');
    expect(people.textContent).toContain('waiting for you to accept');
    expect(people.textContent).toContain('Within an approved budget');
    expect(people.textContent).toContain('Within delegated limits');
    expect(people.textContent).toMatch(/Finalizes\s*No/);
  });

  test('business, wardrobe, press and relationships each read from the profile', async () => {
    renderAt('/brands/velour_atelier?tab=business');
    expect((await screen.findByTestId('bp-business')).textContent).toContain('Velour cover');
    fireEvent.click(screen.getByRole('tab', { name: /Wardrobe/ }));
    expect(screen.getByAltText('Ivory slip dress').getAttribute('loading')).toBe('lazy');
    fireEvent.click(screen.getByRole('tab', { name: /Press & events/ }));
    expect(screen.getByTestId('bp-press').textContent).toContain('Velour gala');
    fireEvent.click(screen.getByRole('tab', { name: /Relationships/ }));
    expect(within(screen.getByTestId('bp-relationships')).getByRole('link', { name: 'Carte Blanche' }).getAttribute('href')).toBe('/brands/carte_blanche');
  });

  test('Evoni edits its identity; the saved profile replaces the page', async () => {
    const saved = velour();
    saved.identity.history = [{ key: 'founder', label: 'Founder', value: 'Her own words.' }];
    vi.mocked(api.put).mockResolvedValueOnce({ data: saved });
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: /Edit/ }));
    const form = screen.getByTestId('bp-identity-edit');
    fireEvent.change(within(form).getByLabelText('Founder'), { target: { value: 'Her own words.' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/companies/velour_atelier', expect.objectContaining({ founder: 'Her own words.', name: 'Velour Atelier', kind: 'brand', earns_trust: 'Preparation\nPunctuality' })));
    expect((await screen.findByTestId('bp-identity')).textContent).toContain('Her own words.');
  });

  test('someone who is not ADMIN reads it but cannot edit it', async () => {
    auth.user = { groups: ['viewer'] };
    renderAt();
    await screen.findByTestId('bp-identity');
    expect(screen.queryByRole('button', { name: /Edit/ })).toBeNull();
  });

  // Evoni, 2026-10-19: its library pictures, and each deal's deliverable progress.
  const withPictures = () => ({ ...velour(), sections: [...velour().sections.slice(0, 4), { key: 'pictures', label: 'Pictures' }, ...velour().sections.slice(4)] });
  test('Pictures reads its library pictures; an ADMIN sees which are drafts or studio only', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/media') {
        return { data: { success: true, items: [
          { id: 'm-1', url: 'https://img/look.png', caption: 'Velour lookbook', status: 'approved', visibility: 'internal' },
          { id: 'm-2', url: 'https://img/priv.png', caption: 'Fitting room', status: 'draft', visibility: 'private' },
        ] } };
      }
      return { data: withPictures() };
    });
    renderAt('/brands/velour_atelier?tab=pictures');
    const pics = await screen.findAllByTestId('bp-picture');
    expect(api.get).toHaveBeenCalledWith('/api/v1/media', { params: { entity_type: 'brand', entity_id: 'b-1' } });
    expect(pics.map((p) => p.querySelector('img').getAttribute('alt'))).toEqual(['Velour lookbook', 'Fitting room']);
    expect(pics[0].textContent).toBe('Velour lookbook');
    expect(pics[1].textContent).toContain('draft · Studio only');
  });

  test('Pictures with none tagged says so', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => (url === '/api/v1/media' ? { data: { success: true, items: [] } } : { data: withPictures() }));
    renderAt('/brands/velour_atelier?tab=pictures');
    expect((await screen.findByTestId('bp-pictures')).textContent).toContain('No library pictures are tagged with Velour Atelier yet.');
  });

  test('Business: a deal with an event shows its deliverables\' progress; one without shows none', async () => {
    const withEvent = { ...velour().business[0], id: 'o-2', name: 'Velour stories', event_id: 'e-9' };
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/deliverable-progress/opportunities/o-2') {
        return { data: { success: true, opportunity_id: 'o-2', event_id: 'e-9', countable: 1, done: 0, all_done: false,
          deliverables: [{ id: 'd-1', countable: true, done: false, line: 'Pulse stories: 2 of 3', posts: [] }] } };
      }
      return { data: { ...velour(), business: [...velour().business, withEvent] } };
    });
    renderAt('/brands/velour_atelier?tab=business');
    const business = await screen.findByTestId('bp-business');
    expect((await within(business).findByTestId('dp-compact')).textContent).toBe('Pulse stories: 2 of 3');
    expect(within(business).getAllByTestId('dp-compact')).toHaveLength(1);
    expect(api.get).not.toHaveBeenCalledWith('/api/v1/deliverable-progress/opportunities/o-1');
  });

  test('a venue shows only its own tabs', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { ...velour(), company: { ...velour().company, kind: 'venue', kind_label: 'Venue' }, sections: [{ key: 'identity', label: 'Identity' }, { key: 'business', label: 'Business' }, { key: 'press', label: 'Events held here' }], people: null, pulse: null, wardrobe: null, relationships: null } });
    renderAt('/brands/glass_room');
    await screen.findByTestId('bp-identity');
    expect(screen.getAllByRole('tab').map((t) => t.textContent.trim())).toEqual(['Identity', 'Business', 'Events held here']);
  });

  test('an unknown company says so', async () => {
    vi.mocked(api.get).mockRejectedValueOnce({ response: { status: 404, data: { error: 'Company not found.' } } });
    renderAt('/brands/nobody');
    expect((await screen.findByRole('alert')).textContent).toBe('There is no company here.');
  });
});
