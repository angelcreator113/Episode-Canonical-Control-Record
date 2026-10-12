/**
 * Producer Mode › Wardrobe › a piece's editor › "Real world" (Task #3019):
 * the section shows the piece's real-world fields, Save sends only the ones
 * changed (and leaves the in-world brand and price as they were), and the
 * server's refusal is shown in plain words.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import WorldAdmin from './WorldAdmin';

const DRESS = {
  id: 'w1', name: 'Lilac Slip Dress', brand: 'Maison Belle', clothing_category: 'dress', is_owned: true, price: 420,
  real_brand: 'Reformation', real_price_paid: '128.00', real_product_url: 'https://www.example.com/dress', real_source: 'manual',
};

const renderIt = () => render(
  <MemoryRouter initialEntries={['/shows/show-1/world?tab=wardrobe-items']}>
    <Routes><Route path="/shows/:id/world" element={<WorldAdmin />} /></Routes>
  </MemoryRouter>,
);

const openDress = async () => {
  renderIt();
  fireEvent.click(await screen.findByTestId('wardrobe-card-w1'));
  return screen.findByTestId('wardrobe-real-world');
};
const field = (section, name) => section.querySelector(`input[name="${name}"]`);

describe('the piece editor\'s Real world section', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/shows/show-1') return { data: { success: true, data: { id: 'show-1', name: 'Show', metadata: {} } } };
      if (url.startsWith('/api/v1/wardrobe?show_id=show-1')) return { data: { data: [DRESS], pagination: { total: 1 } } };
      return { data: {} };
    });
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    vi.mocked(api.put).mockResolvedValue({ data: { success: true, data: { id: 'w1' } } });
  });

  test("it shows the piece's real-world values and says they stay out of the story", async () => {
    const section = await openDress();
    expect(within(section).getByText(/real world \(3\)/)).toBeTruthy();
    expect(within(section).getByText(/Never shown in the story/)).toBeTruthy();
    expect(field(section, 'real_brand').value).toBe('Reformation');
    expect(field(section, 'real_price_paid').value).toBe('128.00');
    expect(field(section, 'affiliate_url').value).toBe('');
    expect(within(section).getByText('Source: manual')).toBeTruthy();
  });

  test('Save sends only the changed real fields and leaves the in-world brand and price alone', async () => {
    const section = await openDress();
    fireEvent.change(field(section, 'affiliate_url'), { target: { value: 'https://shop.example/dress?ref=lala' } });
    fireEvent.change(field(section, 'real_brand'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    const [url, payload] = vi.mocked(api.put).mock.calls[0];
    expect(url).toBe('/api/v1/wardrobe/w1');
    expect(payload.affiliate_url).toBe('https://shop.example/dress?ref=lala');
    expect(payload.real_brand).toBeNull();
    expect(Object.keys(payload).filter((k) => k.startsWith('real_') || k === 'affiliate_url').sort())
      .toEqual(['affiliate_url', 'real_brand']);
    expect(payload.vendor).toBe('Maison Belle');
    expect(payload.price).toBe(420);
  });

  test('saving without touching the section sends no real field', async () => {
    await openDress();
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(api.put).mock.calls[0][1];
    expect(Object.keys(payload).filter((k) => k.startsWith('real_') || k === 'affiliate_url')).toEqual([]);
  });

  test("a refused price shows the server's reason in plain words", async () => {
    vi.mocked(api.put).mockRejectedValue({ response: { status: 400, data: {
      error: 'Invalid real-world fields', details: ['real_price_paid must be a number of zero or more'],
    } } });
    const section = await openDress();
    fireEvent.change(field(section, 'real_price_paid'), { target: { value: '-5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(await screen.findByText(/Real world: Price paid must be a number of zero or more\./)).toBeTruthy();
  });
});
