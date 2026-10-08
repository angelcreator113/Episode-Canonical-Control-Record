/**
 * Connect in three columns (Evoni's mockup, 2026-10-08): the screen list
 * grouped Needs you · Dead ends · Ready, "things to check" naming zones
 * that open the same screen, and the dead-ends banner's "Add back buttons".
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

const SHOW = 's-1';
const z = (id, target, label, extra = {}) => ({ id, x: 10, y: 20, w: 12, h: 9, target, label, ...extra });
const scr = (id, name, links = [], extra = {}) => ({ id, name, category: 'phone', generated: true, url: `https://x/${id}.png`, asset_id: `a-${id}`, show_id: SHOW, screen_links: links, ...extra });
const HOME = scr('home', 'Homepage', [z('z1', 'closet', 'wallet'), z('z2', 'closet', 'closet'), z('z3', 'camera', 'camera')], { is_home: true });
const CLOSET = scr('closet', 'Closet', [z('z4', 'home', 'Back')]);
const CAMERA = scr('camera', 'Camera');
const HAIR = scr('hair', 'Hair Page');

function mockApi(items) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `/api/v1/ui-overlays/${SHOW}`) return { data: { success: true, data: items } };
    return { data: { success: true, data: [], missions: [] } };
  });
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function openConnect(items) {
  mockApi(items);
  render(<UIOverlaysTab showId={SHOW} />);
  await waitFor(() => expect(document.querySelector('.phone-hub-screen-grid')).toBeTruthy());
  fireEvent.click(within(document.querySelector('.phone-hub-stage-row')).getByRole('button', { name: 'Connect' }));
  await waitFor(() => expect(document.querySelector('.connect-screens')).toBeTruthy());
}
const group = (key) => Array.from(screen.getByTestId(`connect-group-${key}`).querySelectorAll('.connect-screens__item')).map(b => b.textContent);

describe("Connect in three columns (Evoni's mockup)", () => {
  test('the screens are grouped: needs you, dead ends, ready', async () => {
    await openConnect([HOME, CLOSET, CAMERA, HAIR]);
    expect(group('needs')).toEqual(['Hair PageNothing links here']);
    expect(group('dead')).toEqual(['CameraNo way back']);
    expect(group('ready')).toEqual(['HomepageHome · 3 zones', 'Closet1 zone']);
  });

  test('a screen in the list opens it in the editor', async () => {
    await openConnect([HOME, CLOSET, CAMERA, HAIR]);
    fireEvent.click(within(document.querySelector('.connect-screens')).getByText('Closet').closest('button'));
    await waitFor(() => expect(document.querySelector('.connect-screens__item.is-active .connect-screens__name').textContent).toBe('Closet'));
    expect(document.querySelector('.zones-tab__sidebar-screen').textContent).toBe('Closet');
  });

  test('things to check names two zones that open the same screen', async () => {
    await openConnect([HOME, CLOSET, CAMERA, HAIR]);
    const checks = screen.getByTestId('zones-checks');
    expect(within(checks).getByText('wallet and closet both open Closet. Is that on purpose?')).toBeTruthy();
  });

  test('"Add back buttons" gives each dead end a Back zone to the home screen, after asking', async () => {
    await openConnect([HOME, CLOSET, CAMERA, HAIR]);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const banner = screen.getByTestId('zones-dead-ends');
    expect(banner.textContent).toContain('1 screen is a dead end.');
    fireEvent.click(within(banner).getByRole('button', { name: 'Add back buttons to it' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(api.put).not.toHaveBeenCalled();
    fireEvent.click(within(banner).getByRole('button', { name: 'Add back buttons to it' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    const [url, body] = vi.mocked(api.put).mock.calls[0];
    expect(url).toBe(`/api/v1/ui-overlays/${SHOW}/screen-links/a-camera`);
    expect(body.screen_links).toEqual([expect.objectContaining({ label: 'Back', target: 'home', x: 4, y: 5 })]);
    await waitFor(() => expect(screen.queryByTestId('zones-dead-ends')).toBeNull());
  });
});
