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

  test('its way back is the LalaVerse hub\'s Brands tab (Evoni, 2026-10-19)', async () => {
    renderAt();
    await screen.findByRole('heading', { name: 'Velour Atelier' });
    expect(screen.getByRole('link', { name: '← LalaVerse › Brands' }).getAttribute('href')).toBe('/universe?tab=brands');
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
    expect(screen.getByRole('link', { name: '← LalaVerse › Brands' }).getAttribute('href')).toBe('/universe?tab=brands');
  });
});
