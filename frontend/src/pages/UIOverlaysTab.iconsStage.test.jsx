/**
 * The Icons stage (Evoni's mockup, 2026-10-08): the next icon to place with
 * "Place it", cards that say where each icon is, and an icon dragged onto
 * an empty spot on the phone placed there.
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
vi.mock('../components/phone-editor/AIAssistantPanel', () => ({ default: () => null }));
vi.mock('../components/phone-editor/AIProposalReview', () => ({ default: () => null }));
vi.mock('../components/phone-editor/MissionEditor', () => ({ default: () => null }));
vi.mock('../components/ContentZoneEditor', () => ({ default: () => null }));

import api from '../services/api';
import UIOverlaysTab from './UIOverlaysTab';

// jsdom has no PointerEvent; a MouseEvent-based stand-in keeps coordinates.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type, init = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; }
  }
  window.PointerEvent = PointerEventPolyfill;
}

// jsdom has no DragEvent, so a drop would carry no coordinates.
if (typeof window.DragEvent === 'undefined') {
  window.DragEvent = class DragEvent extends MouseEvent {
    constructor(type, init = {}) { super(type, init); this.dataTransfer = init.dataTransfer; }
  };
}

const SHOW = 's-1';
const z = (id, x, y, extra = {}) => ({ id, x, y, w: 12, h: 9, ...extra });
const HOME = { id: 'home', name: 'Homepage', category: 'phone', generated: true, is_home: true, url: 'https://x/home.png', asset_id: 'a-home', show_id: SHOW,
  screen_links: [z('z-cam', 8, 14, { target: 'camera', icon_overlay_id: 'ico_cam' })] };
const CAMERA = { id: 'camera', name: 'Camera', category: 'phone', generated: true, url: 'https://x/cam.png', asset_id: 'a-cam', show_id: SHOW, screen_links: [z('z-back', 4, 5, { target: 'home' })] };
const ICO_CAM = { id: 'ico_cam', name: 'Camera icon', category: 'phone_icon', generated: true, url: 'https://x/i-cam.png', asset_id: 'ai-cam' };
const ICO_JEWEL = { id: 'ico_jewel', name: 'Jewelry icon', category: 'phone_icon', generated: true, url: 'https://x/i-jewel.png', asset_id: 'ai-jewel', opens_screen: 'camera' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `/api/v1/ui-overlays/${SHOW}`) return { data: { success: true, data: [HOME, CAMERA, ICO_CAM, ICO_JEWEL] } };
    return { data: { success: true, data: [], missions: [] } };
  });
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function openIcons() {
  render(<UIOverlaysTab showId={SHOW} />);
  await waitFor(() => expect(document.querySelector('.phone-hub-screen-grid')).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: /^Icons/ }));
  await waitFor(() => expect(document.querySelector('.phone-hub-icon-grid')).toBeTruthy());
}
const writes = () => vi.mocked(api.put).mock.calls.filter(([url]) => String(url).includes('/screen-links/'));
const dropOnPhone = (iconId, x, y) => {
  const target = document.querySelector('.phone-hub-drop');
  fireEvent.drop(target, { clientX: x, clientY: y, dataTransfer: { types: ['application/x-lala-icon'], getData: () => iconId } });
};

describe("The Icons stage (Evoni's mockup)", () => {
  test('cards say where each icon is; the unplaced one is marked', async () => {
    await openIcons();
    expect(within(screen.getByTestId('icon-card-ico_cam')).getByText('on Homepage')).toBeTruthy();
    const jewel = screen.getByTestId('icon-card-ico_jewel');
    expect(within(jewel).getByText('Unplaced')).toBeTruthy();
    expect(jewel.className).toContain('is-unplaced');
  });

  test('"Place it" puts the next unplaced icon in the first free spot on the home screen', async () => {
    await openIcons();
    const next = screen.getByTestId('icon-next');
    // Screens and links are done here, so icons are the setup's last step.
    expect(next.textContent).toContain('Last setup step: place the Jewelry icon.');
    fireEvent.click(within(next).getByRole('button', { name: 'Place it' }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    const [url, body] = writes()[0];
    expect(url).toBe(`/api/v1/ui-overlays/${SHOW}/screen-links/a-home`);
    // Slot 0 (8, 14) holds Camera; the next slot along is (29, 14).
    expect(body.screen_links[1]).toMatchObject({ x: 29, y: 14, w: 12, h: 9, icon_overlay_id: 'ico_jewel', label: 'Jewelry', target: 'camera' });
    await waitFor(() => expect(screen.queryByTestId('icon-next')).toBeNull());
  });

  test('an icon dropped on an empty spot is placed there, snapped to the grid', async () => {
    await openIcons();
    dropOnPhone('ico_jewel', 56, 33);
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0][1].screen_links[1]).toMatchObject({ x: 50, y: 28, icon_overlay_id: 'ico_jewel' });
  });

  test('a drop on a taken spot is refused, and says so', async () => {
    await openIcons();
    dropOnPhone('ico_jewel', 14, 18);
    expect(await screen.findByText('That spot is taken. Drop it on an empty spot.')).toBeTruthy();
    expect(writes()).toHaveLength(0);
  });
});
