/**
 * Scene Sets re-audit (2026-10-15), the page:
 *  - a delete whose usage check failed went on and orphaned the set's uses;
 *  - an angle with no image could not be deleted;
 *  - Suggest More did not show the new angles;
 *  - an angle generation's real reason was replaced by a generic line;
 *  - the workspace was no dialog: no name, no Escape.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import apiClient from '../services/api';
import SceneSetsTab from './SceneSetsTab';

const PENDING = { id: 'ang-1', angle_label: 'BAR', angle_name: 'Bar', generation_status: 'pending', still_image_url: null };
const sets = () => [
  { id: 'set-1', name: 'Atelier', scene_type: 'HOME_BASE', angles: [PENDING], generation_status: 'complete', base_still_url: 'https://x/atelier.jpg', base_approved: false },
];
const renderTab = () => render(<MemoryRouter initialEntries={['/shows/show-1/world?tab=scene-sets']}><SceneSetsTab /></MemoryRouter>);
const card = (id) => document.querySelector(`[data-scene-set-id="${id}"]`);
const setsLoads = () => vi.mocked(apiClient.get).mock.calls.filter(([url]) => /\/scene-sets(\?|$)/.test(url)).length;

describe('SceneSetsTab (re-audit)', () => {
  let usesFail;
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn.mockReset());
    usesFail = false;
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (url.endsWith('/uses')) {
        if (usesFail) throw Object.assign(new Error('Network Error'), {});
        return { data: { success: true, data: { total: 0 } } };
      }
      if (url.includes('/generation-check')) return { data: { ready: true } };
      return url.includes('/scene-sets') ? { data: { success: true, data: sets() } } : { data: { success: true, data: [] } };
    });
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: {} } });
    vi.mocked(apiClient.delete).mockResolvedValue({ data: { success: true } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('a delete whose usage check failed is stopped, and says so', async () => {
    usesFail = true;
    renderTab();
    await waitFor(() => expect(card('set-1')).toBeTruthy());
    // The card's Delete is in its "More options" menu.
    fireEvent.click(card('set-1').querySelector('[title="More options"]'));
    fireEvent.click(document.querySelector('.scene-sets-kebab-danger'));
    await waitFor(() => expect(screen.getByText(/Could not check where "Atelier" is used, so it was not deleted/)).toBeTruthy());
    expect(apiClient.delete).not.toHaveBeenCalled();
  });

  test('an angle with no image can be deleted from its row', async () => {
    renderTab();
    await waitFor(() => expect(card('set-1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('scene-set-open-set-1'));
    fireEvent.click(screen.getByTestId('angle-delete-ang-1'));
    await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/scene-sets/set-1/angles/ang-1'));
  });

  test('Suggest More shows the new angles (the sets are read again)', async () => {
    vi.mocked(apiClient.post).mockImplementation(async (url) => (url.endsWith('/suggest-angles-from-image')
      ? { data: { success: true, angles_created: 2 } } : { data: { success: true, data: {} } }));
    renderTab();
    await waitFor(() => expect(card('set-1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('scene-set-open-set-1'));
    const before = setsLoads();
    fireEvent.click(screen.getByRole('button', { name: /Suggest More/ }));
    await waitFor(() => expect(setsLoads()).toBeGreaterThan(before));
  });

  test('the workspace is a dialog named by its set, and Escape closes it', async () => {
    renderTab();
    await waitFor(() => expect(card('set-1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('scene-set-open-set-1'));
    const dialog = screen.getByRole('dialog', { name: /Atelier/ });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Atelier/ })).toBeNull());
  });

  // Third re-audit (2026-10-15): regressions in the fixes above.
  test('Escape with another window open over the workspace leaves the workspace open', async () => {
    renderTab();
    await waitFor(() => expect(card('set-1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('scene-set-open-set-1'));
    const dialog = screen.getByRole('dialog', { name: /Atelier/ });
    const lightbox = document.createElement('div');
    lightbox.className = 'scene-sets-lightbox-overlay';
    document.body.appendChild(lightbox);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: /Atelier/ })).toBeTruthy();
    lightbox.remove();
  });

  test('a refused "Save & regenerate" keeps the description editor and its text', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (url.endsWith('/uses')) return { data: { success: true, data: { total: 0 } } };
      return url.includes('/scene-sets')
        ? { data: { success: true, data: sets().map((x) => ({ ...x, canonical_description: 'A sunlit atelier.' })) } }
        : { data: { success: true, data: [] } };
    });
    vi.mocked(apiClient.post).mockImplementation(async (url) => {
      if (url.endsWith('/brief')) {
        return { data: { success: true, data: { target: { kind: 'base' }, brief: { version: 1, lines: [], rules: [], missing: [], overrides: {} }, prompt: 'p', estimate: null } } };
      }
      if (url.endsWith('/cascade-regenerate')) throw Object.assign(new Error('429'), { response: { status: 429, data: { error: 'Too many AI requests' } } });
      return { data: { success: true, data: {} } };
    });
    renderTab();
    await waitFor(() => expect(card('set-1')).toBeTruthy());
    fireEvent.click(screen.getByTestId('scene-set-open-set-1'));
    fireEvent.click(screen.getByRole('button', { name: /Details & Usage/ }));
    fireEvent.click(screen.getByRole('button', { name: /Edit Description/ }));
    fireEvent.change(document.querySelector('.scene-sets-desc-textarea'), { target: { value: 'A moonlit atelier.' } });
    fireEvent.click(screen.getByTestId('scene-set-desc-cascade-set-1'));
    fireEvent.click(await screen.findByTestId('sbc-confirm'));
    await waitFor(() => expect(screen.getByText('Too many AI requests')).toBeTruthy());
    expect(document.querySelector('.scene-sets-desc-textarea').value).toBe('A moonlit atelier.');
  });
});
