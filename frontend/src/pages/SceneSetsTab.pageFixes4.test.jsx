/**
 * Scene Sets fourth audit (2026-10-15), page findings:
 *  - a second Replace during a base upload started a second upload;
 *  - the linked set was scrolled back into view on every list refresh;
 *  - Escape in the description editor closed the whole workspace;
 *  - the lightbox opened on the last angle viewed, not the picture clicked.
 */
import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import apiClient from '../services/api';
import SceneSetsTab from './SceneSetsTab';

const ANGLES = [
  { id: 'a-wide', angle_label: 'WIDE', angle_name: 'Wide', generation_status: 'complete', still_image_url: 'https://x/wide.jpg', sort_order: 0 },
  { id: 'a-vanity', angle_label: 'VANITY', angle_name: 'Vanity', generation_status: 'complete', still_image_url: 'https://x/vanity.jpg', sort_order: 1 },
];
let sets;
const card = (id) => document.querySelector(`[data-scene-set-id="${id}"]`);
const renderAt = (search = '?tab=scene-sets') => render(<MemoryRouter initialEntries={[`/shows/show-1/world${search}`]}><SceneSetsTab /></MemoryRouter>);
const listCalls = () => vi.mocked(apiClient.get).mock.calls.filter(([u]) => /\/scene-sets(\?|$)/.test(u)).length;

describe('Scene Sets page fixes (fourth audit)', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn.mockReset());
    sets = [
      { id: 'set-1', name: 'Bedroom', scene_type: 'HOME_BASE', generation_status: 'complete', base_still_url: 'https://x/base.jpg', base_approved: false, angles: ANGLES },
      { id: 'set-2', name: 'Hall', scene_type: 'EVENT_LOCATION', generation_status: 'complete', base_still_url: 'https://x/hall.jpg', angles: [] },
    ];
    vi.mocked(apiClient.get).mockImplementation(async (url) => (
      // A new list each read, as from the server.
      url.includes('/scene-sets') ? { data: { success: true, data: sets.map((x) => ({ ...x })) } } : { data: { success: true, data: [] } }
    ));
    vi.mocked(apiClient.put).mockResolvedValue({ data: { success: true } });
  });
  afterEach(() => vi.useRealTimers());

  test('a second Replace during an upload does not start a second upload', async () => {
    let finish;
    vi.mocked(apiClient.post).mockImplementation((url) => (url.endsWith('/upload-base')
      ? new Promise((resolve) => { finish = () => resolve({ data: { success: true } }); })
      : Promise.resolve({ data: { success: true } })));
    renderAt();
    await waitFor(() => expect(card('set-1')).toBeTruthy());
    const input = card('set-1').querySelector('input[type="file"][multiple]');
    const file = new File(['jpg'], 'b.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(vi.mocked(apiClient.post).mock.calls.filter(([u]) => u.endsWith('/upload-base')).length).toBe(1));
    finish();
    await new Promise((r) => setTimeout(r, 20));
    expect(vi.mocked(apiClient.post).mock.calls.filter(([u]) => u.endsWith('/upload-base')).length).toBe(1);
  });

  test('the linked set is scrolled to once, not again on each refresh', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // A set generating now keeps the 5s list poll running.
    sets[0] = { ...sets[0], generation_status: 'generating', updated_at: new Date().toISOString() };
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    renderAt('?tab=scene-sets&set=set-2');
    await waitFor(() => expect(card('set-2')).toBeTruthy());
    await waitFor(() => expect(scroll).toHaveBeenCalled());
    const after = scroll.mock.calls.length;
    const reads = listCalls();
    await vi.advanceTimersByTimeAsync(5500);
    await waitFor(() => expect(listCalls()).toBeGreaterThan(reads));
    expect(scroll.mock.calls.length).toBe(after);
  });

  test('Escape in the description editor cancels the edit; the workspace stays open', async () => {
    renderAt();
    fireEvent.click(await screen.findByTestId('scene-set-open-set-2'));
    fireEvent.click(await screen.findByRole('button', { name: /Details & Usage/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Add Description/ }));
    const textarea = await screen.findByTestId('scene-set-desc-textarea-set-2');
    fireEvent.change(textarea, { target: { value: 'A glass hall.' } });
    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(screen.queryByTestId('scene-set-desc-textarea-set-2')).toBeNull();
    expect(document.querySelector('.scene-sets-modal-tabs')).toBeTruthy();
  });

  test('the lightbox opens on the picture clicked, not the angle viewed before', async () => {
    renderAt();
    fireEvent.click(await screen.findByTestId('scene-set-open-set-1'));
    // View an angle first.
    const vanity = await waitFor(() => {
      const img = document.querySelector('img[alt="VANITY"]');
      if (!img) throw new Error('no angle yet');
      return img;
    });
    fireEvent.click(vanity);
    await waitFor(() => expect(document.querySelector('.scene-sets-lightbox-label')?.textContent).toBe('VANITY'));
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(document.querySelector('.scene-sets-lightbox-label')).toBeNull());
    // Then the main background.
    fireEvent.click(document.querySelector('img[title="View full size"]'));
    await waitFor(() => expect(document.querySelector('.scene-sets-lightbox-label')?.textContent).toBe('BASE'));
  });
});
