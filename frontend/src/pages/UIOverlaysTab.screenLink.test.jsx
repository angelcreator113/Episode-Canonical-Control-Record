/**
 * UIOverlaysTab — a link can open the Phone Hub at one screen (#2867):
 * ?screen=<id> beside ?tab=overlays-tab opens that screen's editor in Build,
 * built or not; an id the phone doesn't have says so and falls back to the
 * home screen. The Episode tab's "To build" rows link here.
 */
import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, cleanup, waitFor, screen } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
vi.mock('../components/ScreenContentRenderer', () => ({ default: () => null }));
vi.mock('../components/phone/PhoneMapView', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, default: () => null };
});
vi.mock('../components/phone-editor/MissionEditor', () => ({ default: () => null }));
vi.mock('../components/ContentZoneEditor', () => ({ default: () => null }));

import api from '../services/api';
import UIOverlaysTab from './UIOverlaysTab';

const SHOW = 's-1';
const screenOf = (over) => ({ category: 'phone', generated: true, show_id: SHOW, screen_links: [], custom: true, ...over });
const HOME = screenOf({ id: 'home', name: 'Homepage', is_home: true, url: 'https://x/home.png', asset_id: 'a-home' });
const MAIL = screenOf({ id: 'mail', name: 'mail inbox', url: 'https://x/mail.png', asset_id: 'a-mail' });
const CAMERA = screenOf({ id: 'camera', name: 'Camera', generated: false, url: null });

function at(search) {
  window.history.replaceState(null, '', `/shows/${SHOW}/world${search}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `/api/v1/ui-overlays/${SHOW}`) return { data: { success: true, data: [HOME, MAIL, CAMERA] } };
    return { data: { success: true, data: [], missions: [] } };
  });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); at(''); });

const modal = () => document.querySelector('.editor-modal');
const caption = () => document.querySelector('[data-testid="phone-device-caption"] .ph-device-name');

describe('UIOverlaysTab — ?screen= opens the Hub at one screen (#2867)', () => {
  test('a screen not built yet opens in its editor', async () => {
    at('?tab=overlays-tab&screen=camera');
    render(<UIOverlaysTab showId={SHOW} />);
    await waitFor(() => expect(modal()).toBeTruthy());
    expect(modal().textContent).toContain('Camera');
  });

  test('a built screen opens in its editor too', async () => {
    at('?tab=overlays-tab&screen=mail');
    render(<UIOverlaysTab showId={SHOW} />);
    await waitFor(() => expect(modal()).toBeTruthy());
    expect(modal().textContent).toContain('mail inbox');
  });

  test('an unknown id says so and falls back to the home screen, no editor', async () => {
    at('?tab=overlays-tab&screen=nope');
    render(<UIOverlaysTab showId={SHOW} />);
    expect(await screen.findByText('No screen "nope" on this phone. Showing the home screen.')).toBeTruthy();
    await waitFor(() => expect(caption()?.textContent).toBe('Homepage'));
    expect(modal()).toBeNull();
  });

  test('with no screen in the link the Hub opens as before, on the home screen', async () => {
    at('?tab=overlays-tab');
    render(<UIOverlaysTab showId={SHOW} />);
    await waitFor(() => expect(caption()?.textContent).toBe('Homepage'));
    expect(modal()).toBeNull();
  });
});
