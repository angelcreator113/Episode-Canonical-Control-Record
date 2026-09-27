/**
 * UIOverlaysTab — one Connect editor, with no Tap / Icon toggle (Task #2021,
 * part 2 of 2; doctrine rule 18).
 *
 * The workspace has one zone editor and one "Zones" list. What only ICON mode
 * offered stays reachable: Pin to all screens (per row) and Delete Selected.
 * The screen editor's link into the workspace opens Content when the screen
 * has content zones.
 */

import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within, act } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
vi.mock('../components/ScreenContentRenderer', () => ({ default: () => null }));
vi.mock('../components/phone/PhoneMapView', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, default: () => null };
});
vi.mock('../components/phone-editor/MissionEditor', () => ({ default: () => null }));
vi.mock('../components/ContentZoneEditor', () => ({ default: () => <div data-testid="view-content" /> }));

import api from '../services/api';
import UIOverlaysTab from './UIOverlaysTab';

if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type, init = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; }
  }
  window.PointerEvent = PointerEventPolyfill;
}

const SHOW = 's-1';
const zone = (id, x, y, over = {}) => ({ id, x, y, w: 12, h: 9, target: 'calls', label: id, icon_url: null, icon_urls: [], ...over });
const CALLS = { id: 'calls', name: 'calls list', category: 'phone', generated: true, url: 'https://x/calls.png', asset_id: 'a-calls', show_id: SHOW, screen_links: [], custom_id: 't-calls' };
const homeWith = (zones, over = {}) => ({ id: 'home', name: 'Homepage', category: 'phone', generated: true, is_home: true, url: 'https://x/home.png', asset_id: 'a-home', show_id: SHOW, screen_links: zones, custom_id: 't-home', ...over });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function renderPage(home) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `/api/v1/ui-overlays/${SHOW}`) return { data: { success: true, data: [home, CALLS] } };
    return { data: { success: true, data: [], missions: [] } };
  });
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
  render(<UIOverlaysTab showId={SHOW} />);
  await waitFor(() => expect(document.querySelector('.phone-hub-screen-grid')).toBeTruthy());
}
async function openConnect(zones) {
  await renderPage(homeWith(zones));
  fireEvent.click(within(document.querySelector('.phone-hub-stage-row')).getByRole('button', { name: 'Connect' }));
  await waitFor(() => expect(document.querySelector('.zones-tab__canvas [style*="crosshair"]')).toBeTruthy());
  return document.querySelector('.zones-tab__canvas [style*="crosshair"]');
}
const saved = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(vi.mocked(api.put)).toHaveBeenCalled());
  return vi.mocked(api.put).mock.calls.at(-1)[1].screen_links;
};

describe('UIOverlaysTab — one Connect editor (Task #2021)', () => {
  test('there is no Tap / Icon toggle, and one "Zones" list', async () => {
    await openConnect([zone('a', 10, 10), zone('b', 40, 10)]);
    expect(screen.queryByRole('tab', { name: 'Tap' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Icon' })).toBeNull();
    expect(document.querySelector('.zones-subtabs')).toBeNull();
    expect(screen.getByText('Zones (2)')).toBeTruthy();
    expect(screen.queryByText(/Tap Zones/)).toBeNull();
  });

  test('a zone can be pinned to all screens from its row', async () => {
    await openConnect([zone('a', 10, 10)]);
    const row = screen.getByDisplayValue('a').closest('.zones-tap-row');
    fireEvent.click(within(row).getByRole('button', { name: 'Show advanced' }));
    fireEvent.click(within(row).getByLabelText('Pin to all screens'));
    expect((await saved())[0]).toMatchObject({ id: 'a', persistent: true });
  });

  test('Delete Selected removes the selected zones in one step', async () => {
    const canvas = await openConnect([zone('a', 10, 10), zone('b', 40, 10), zone('c', 70, 10)]);
    const tools = document.querySelector('.zones-tap-tools');
    expect(within(tools).queryByRole('button', { name: /Selected/ })).toBeNull();
    fireEvent.click(within(tools).getByRole('button', { name: 'Multi Select' }));
    for (const [id, at] of [['a', [15, 14]], ['c', [75, 14]]]) {
      fireEvent.pointerDown(document.querySelector(`[data-zone-id="${id}"]`), { pointerId: 1, clientX: at[0], clientY: at[1] });
      fireEvent.pointerUp(canvas, { pointerId: 1, clientX: at[0], clientY: at[1] });
      fireEvent.click(canvas);
      await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    }
    fireEvent.click(within(tools).getByRole('button', { name: 'Delete 2 Selected' }));
    expect(screen.getByText('Zones (1)')).toBeTruthy();
    expect((await saved()).map(z => z.id)).toEqual(['b']);
  });

  test('the screen editor\'s workspace link opens Content for a screen with content zones, Connect otherwise', async () => {
    const openEditorLink = async () => {
      const card = within(document.querySelector('.phone-hub-screen-grid')).getByText('Homepage').closest('.screen-card');
      fireEvent.click(within(card).getByRole('button', { name: 'Screen options' }));
      fireEvent.click(within(card).getByText('Edit'));
      fireEvent.click(await screen.findByTitle('Open the Zones tab for this screen'));
    };
    await renderPage(homeWith([zone('a', 10, 10)], { content_zones: [{ id: 'cz1', x: 0, y: 50, w: 100, h: 40, content_type: 'dm_thread' }] }));
    await openEditorLink();
    expect(await screen.findByTestId('view-content')).toBeTruthy();
    cleanup();
    await renderPage(homeWith([zone('a', 10, 10)]));
    await openEditorLink();
    await waitFor(() => expect(document.querySelector('.zones-tab__canvas')).toBeTruthy());
    expect(screen.queryByTestId('view-content')).toBeNull();
  });
});
