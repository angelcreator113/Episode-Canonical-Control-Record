/**
 * Scene Sets third audit (2026-10-15), the page:
 *  - Mood Variations showed "created" and never appeared;
 *  - a refused Add Angle closed the workspace and cleared the form;
 *  - toasts: under the lightbox, not announced, cut short by an older timer;
 *  - Enter pressed twice in the create form made two sets;
 *  - a failed Time of Day save kept the unsaved value on screen.
 */
import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import apiClient from '../services/api';
import SceneSetsTab from './SceneSetsTab';

const sets = () => [
  { id: 'set-1', name: 'Atelier', scene_type: 'HOME_BASE', angles: [], generation_status: 'complete', base_still_url: 'https://x/atelier.jpg', base_approved: false, time_of_day: 'morning' },
];
const renderTab = () => render(<MemoryRouter initialEntries={['/shows/show-1/world?tab=scene-sets']}><SceneSetsTab /></MemoryRouter>);
const card = (id) => document.querySelector(`[data-scene-set-id="${id}"]`);
const setsLoads = () => vi.mocked(apiClient.get).mock.calls.filter(([url]) => /\/scene-sets(\?|$)/.test(url)).length;
const openSet = async () => {
  renderTab();
  await waitFor(() => expect(card('set-1')).toBeTruthy());
  fireEvent.click(screen.getByTestId('scene-set-open-set-1'));
};

describe('SceneSetsTab (third audit)', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn.mockReset());
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (url.includes('/generation-check')) return { data: { ready: true } };
      return url.includes('/scene-sets') ? { data: { success: true, data: sets() } } : { data: { success: true, data: [] } };
    });
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: {} } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  test('a mood variation is shown once made: the sets are read again', async () => {
    vi.mocked(apiClient.post).mockImplementation(async (url) => (url.endsWith('/mood-variants')
      ? { data: { success: true, source: 'base', variants: { glam: 'https://x/glam.jpg' }, count: 1 } } : { data: { success: true, data: {} } }));
    await openSet();
    fireEvent.click(screen.getByRole('button', { name: /Details & Usage/ }));
    const before = setsLoads();
    fireEvent.click(screen.getByRole('button', { name: /Glam/ }));
    await waitFor(() => expect(setsLoads()).toBeGreaterThan(before));
  });

  test('a refused Add Angle keeps the form as typed, open', async () => {
    vi.mocked(apiClient.post).mockImplementation(async (url) => {
      if (url.endsWith('/angles')) throw Object.assign(new Error('400'), { response: { status: 400, data: { error: 'zone_angle_id must be a Front or Back zone' } } });
      return { data: { success: true, data: {} } };
    });
    await openSet();
    fireEvent.click(screen.getByRole('button', { name: /Add View/ }));
    fireEvent.change(screen.getByPlaceholderText('e.g. WIDE or custom'), { target: { value: 'BAR' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. Wide Morning'), { target: { value: 'The bar' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Angle/ }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('zone_angle_id must be a Front or Back zone'));
    expect(screen.getByPlaceholderText('e.g. Wide Morning').value).toBe('The bar');
  });

  test('a toast is announced, and a newer toast is not cut short by an older one\'s timer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.mocked(apiClient.post).mockImplementation(async (url) => (url.endsWith('/mood-variants')
        ? { data: { success: true, variants: { glam: 'u' }, count: 1 } }
        : { data: { success: true, data: {} } }));
      await openSet();
      fireEvent.click(screen.getByRole('button', { name: /Details & Usage/ }));
      fireEvent.click(screen.getByRole('button', { name: /Glam/ }));
      await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/Glam created/));
      await act(async () => { vi.advanceTimersByTime(3000); });
      vi.mocked(apiClient.post).mockRejectedValueOnce(Object.assign(new Error('x'), { response: { data: { error: 'No base image. Upload one first.' } } }));
      fireEvent.click(screen.getByRole('button', { name: /Cozy/ }));
      await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('No base image. Upload one first.'));
      // The first toast's 4s timer has passed; the error stays its own 4s.
      await act(async () => { vi.advanceTimersByTime(1500); });
      expect(screen.getByRole('alert')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  test('Enter pressed twice in the create form makes one set', async () => {
    let finish;
    vi.mocked(apiClient.post).mockImplementation((url) => (url.endsWith('/scene-sets')
      ? new Promise((r) => { finish = () => r({ data: { success: true, data: { id: 'set-2' } } }); })
      : Promise.resolve({ data: { success: true, data: {} } })));
    renderTab();
    await waitFor(() => expect(card('set-1')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /New Scene Set/ }));
    // The Type select has a name a screen reader reads.
    expect(screen.getByLabelText('Type').tagName).toBe('SELECT');
    const name = screen.getByPlaceholderText("e.g. Lala's Bedroom, The Gala Venue");
    fireEvent.change(name, { target: { value: 'Kitchen' } });
    fireEvent.keyDown(name, { key: 'Enter' });
    fireEvent.keyDown(name, { key: 'Enter' });
    expect(vi.mocked(apiClient.post).mock.calls.filter(([u]) => u.endsWith('/scene-sets'))).toHaveLength(1);
    await act(async () => { finish(); });
  });

  test('a Time of Day that did not save shows the saved value again', async () => {
    vi.mocked(apiClient.put).mockRejectedValue(Object.assign(new Error('x'), { response: { data: { error: 'Not saved' } } }));
    await openSet();
    fireEvent.click(screen.getByRole('button', { name: /Details & Usage/ }));
    const select = screen.getByDisplayValue('Morning');
    fireEvent.change(select, { target: { value: 'night' } });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Not saved'));
    expect(select.value).toBe('morning');
  });
});
