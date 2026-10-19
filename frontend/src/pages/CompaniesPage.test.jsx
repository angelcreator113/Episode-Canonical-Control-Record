/**
 * Brands and companies (pages/CompaniesPage; Evoni, 2026-10-18): the list
 * by kind, each opening its profile, and Evoni adding a company.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { readFileSync } from 'fs';
import { resolve } from 'path';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
const auth = { user: { groups: ['admin'] } };
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));

import api from '../services/api';
import CompaniesPage from './CompaniesPage';

const companies = [
  { id: 'b-1', slug: 'velour_atelier', name: 'Velour Atelier', kind: 'brand', kind_label: 'Fashion brand', defining_principle: 'Nothing extraneous', handle: 'velouratelier', deals: 2 },
  { id: 'b-2', slug: 'the_real_rate', name: 'The Real Rate', kind: 'outlet', kind_label: 'Magazine or press outlet', description: 'What the beauty economy actually pays.', handle: null, deals: 0 },
];

const renderPage = () => render(
  <MemoryRouter initialEntries={['/brands']}>
    <Routes>
      <Route path="/brands" element={<CompaniesPage />} />
      <Route path="/brands/:slug" element={<p>Profile page</p>} />
    </Routes>
  </MemoryRouter>,
);

describe('CompaniesPage', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    auth.user = { groups: ['admin'] };
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, companies } });
  });

  test('every company, each linked to its profile, with its kind', async () => {
    renderPage();
    const velour = await screen.findByTestId('co-velour_atelier');
    expect(within(velour).getByRole('link', { name: 'Velour Atelier' }).getAttribute('href')).toBe('/brands/velour_atelier');
    expect(velour.textContent).toContain('Fashion brand');
    expect(velour.textContent).toContain('@velouratelier');
    expect(velour.textContent).toContain('2 deals');
    expect(screen.getByTestId('co-the_real_rate').textContent).toContain('What the beauty economy actually pays.');
  });

  test('filtering by kind asks for that kind', async () => {
    renderPage();
    await screen.findByTestId('co-velour_atelier');
    fireEvent.click(screen.getByRole('button', { name: 'Press' }));
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/api/v1/companies?kind=outlet'));
  });

  test('Evoni adds a company and lands on its profile', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { success: true, company: { slug: 'glass_room' } } });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /New company/ }));
    const form = screen.getByTestId('co-new');
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'The Glass Room' } });
    fireEvent.change(within(form).getByLabelText('Kind'), { target: { value: 'venue' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add the company' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/companies', { name: 'The Glass Room', kind: 'venue', description: '' }));
    expect(await screen.findByText('Profile page')).toBeTruthy();
  });

  test('someone who is not ADMIN cannot add one', async () => {
    auth.user = { groups: ['viewer'] };
    renderPage();
    await screen.findByTestId('co-velour_atelier');
    expect(screen.queryByRole('button', { name: /New company/ })).toBeNull();
  });

  test('embedded in the LalaVerse hub it has no heading of its own (the hub banner is it)', async () => {
    render(<MemoryRouter><CompaniesPage embedded /></MemoryRouter>);
    await screen.findByTestId('co-velour_atelier');
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.getByTestId('companies').className).toContain('is-embedded');
  });

  test('/brands opens the LalaVerse hub\'s Brands tab; profiles keep their own page (Evoni, 2026-10-19)', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/App.jsx'), 'utf8');
    expect(app).toMatch(/<Route path="\/brands" element=\{<Navigate to="\/universe\?tab=brands" replace \/>\} \/>/);
    expect(app).toMatch(/<Route path="\/brands\/:slug" element=\{<BrandProfilePage \/>\} \/>/);
    expect(app).not.toMatch(/CompaniesPage/);
  });
});
