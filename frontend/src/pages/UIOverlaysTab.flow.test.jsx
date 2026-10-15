/**
 * UIOverlaysTab — the page's flow (phone audit, 2026-10-15): a deleted screen
 * leaves the phone, Connect never opens blank, another show starts clean,
 * hidden screens are per show, and "no show" or a failed load is said.
 *
 * Real page and PhoneHub; the editors not under test are stubbed.
 */

import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
vi.mock('../components/ScreenContentRenderer', () => ({ default: () => null }));
vi.mock('../components/phone/PhoneMapView', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, default: () => null };
});
vi.mock('../components/ScreenLinkEditor', () => ({ default: (p) => <div data-testid="view-zones" data-screen={p.screen?.id || p.activeScreen?.id || ''} /> }));
vi.mock('../components/ContentZoneEditor', () => ({ default: () => <div data-testid="view-content" /> }));
vi.mock('../components/phone-editor/AIAssistantPanel', () => ({ default: () => null }));
vi.mock('../components/phone-editor/AIProposalReview', () => ({ default: () => null }));

import api from '../services/api';
import UIOverlaysTab from './UIOverlaysTab';

const S = (show, id, name, extra = {}) => ({
  id, name, category: 'phone', generated: true, url: `https://x/${show}-${id}.png`, asset_id: `a-${show}-${id}`,
  show_id: show, screen_links: [], custom: true, custom_id: `c-${show}-${id}`, ...extra,
});
const PHONES = {
  's-1': [S('s-1', 'home', 'Homepage', { is_home: true }), S('s-1', 'closet', 'Closet'), { ...S('s-1', 'notes', 'Notes'), generated: false, url: null, asset_id: null }],
  's-2': [S('s-2', 'home2', 'Other Home', { is_home: true }), S('s-2', 'feed', 'Feed')],
};

let shows;
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  shows = [{ id: 's-1', name: 'Show One' }, { id: 's-2', name: 'Show Two' }];
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/shows') return { data: { success: true, data: shows } };
    const m = /^\/api\/v1\/ui-overlays\/(s-\d)$/.exec(url);
    if (m) return { data: { success: true, data: PHONES[m[1]] } };
    return { data: { success: true, data: [], missions: [] } };
  });
  vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const device = () => within(document.querySelector('.phone-hub-device'));
const grid = () => within(document.querySelector('.phone-hub-screen-grid'));
const stage = (name) => fireEvent.click(within(document.querySelector('.phone-hub-stage-row')).getByRole('button', { name }));

async function renderShow(showId = 's-1') {
  render(<UIOverlaysTab showId={showId} />);
  await waitFor(() => expect(document.querySelector('.phone-hub-screen-grid')).toBeTruthy());
}

describe('UIOverlaysTab — flow (phone audit, 2026-10-15)', () => {
  test('deleting the screen on the phone moves the phone to the home screen', async () => {
    await renderShow();
    fireEvent.click(grid().getByText('Closet'));
    await waitFor(() => expect(device().getByAltText('Closet')).toBeTruthy());
    const card = grid().getByText('Closet').closest('.screen-card');
    fireEvent.click(within(card).getByLabelText('Screen options'));
    fireEvent.click(within(card).getByText('Delete'));
    await waitFor(() => expect(device().getByAltText('Homepage')).toBeTruthy());
    expect(device().queryByAltText('Closet')).toBeNull();
  });

  test('Connect on a screen with no image opens the home screen, not a blank stage', async () => {
    await renderShow();
    fireEvent.click(grid().getByText('Notes'));
    stage('Connect');
    expect(await screen.findByTestId('view-zones')).toBeTruthy();
  });

  test('a failed load says so with Try again, and Try again loads the phone', async () => {
    let fail = true;
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/ui-overlays/s-1') {
        if (fail) { const e = new Error('Network Error'); throw e; }
        return { data: { success: true, data: PHONES['s-1'] } };
      }
      return { data: { success: true, data: [], missions: [] } };
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<UIOverlaysTab showId="s-1" />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain("didn't load: Network Error");
    expect(document.querySelector('.phone-hub-screen-grid')).toBeNull();
    fail = false;
    fireEvent.click(within(alert).getByRole('button', { name: /Try again/ }));
    await waitFor(() => expect(document.querySelector('.phone-hub-screen-grid')).toBeTruthy());
  });

  test('with no shows it says so instead of loading for good', async () => {
    shows = [];
    render(<UIOverlaysTab />);
    expect(await screen.findByText(/There are no shows yet/)).toBeTruthy();
    expect(screen.queryByText('Loading phone screens...')).toBeNull();
  });

  test('another show starts clean, and hidden screens belong to their show', async () => {
    localStorage.setItem('primeStudios.activeShowId', 's-1');
    localStorage.setItem('phone_hub_hidden:s-2', JSON.stringify(['feed']));
    render(<UIOverlaysTab />);
    await waitFor(() => expect(document.querySelector('.phone-hub-screen-grid')).toBeTruthy());
    fireEvent.click(grid().getByText('Closet'));
    await waitFor(() => expect(device().getByAltText('Closet')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 's-2' } });
    await waitFor(() => expect(device().getByAltText('Other Home')).toBeTruthy());
    expect(device().queryByAltText('Closet')).toBeNull();
    // Feed is hidden on Show Two only.
    expect(grid().queryByText('Feed')).toBeNull();
    expect(localStorage.getItem('phone_hub_hidden:s-1')).toBeNull();
  });

  test('the old shared hidden list moves to the first show opened, once', async () => {
    localStorage.setItem('phone_hub_hidden', JSON.stringify(['closet']));
    await renderShow('s-1');
    expect(grid().queryByText('Closet')).toBeNull();
    expect(JSON.parse(localStorage.getItem('phone_hub_hidden:s-1'))).toEqual(['closet']);
    expect(localStorage.getItem('phone_hub_hidden')).toBeNull();
  });
});
