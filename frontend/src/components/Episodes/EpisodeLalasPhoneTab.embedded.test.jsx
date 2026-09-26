/**
 * EpisodeLalasPhoneTab — the embedded phone (Task #1994, C3 of doctrine rule 16).
 *
 * Pins: the left pane draws the same phone (PhoneFrame, the show's skin), fed
 * from the tab's read-only GETs; taps, Back and Reset in it send no
 * phone-state or tap request and no write of any kind; usePhonePlayback is
 * never used; the header links to Phone Studio; an empty phone says where to
 * build screens.
 */

import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn(),
  },
}));

vi.mock('../phone-editor/MissionEditor', () => ({ default: () => null }));

// ScreenContentRenderer and PhoneMapView fetch; stub them.
vi.mock('../ScreenContentRenderer', () => ({ default: () => <div data-testid="content-renderer" /> }));
vi.mock('../phone/PhoneMapView', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, default: () => <div data-testid="map-view" /> };
});

// The saving path. The tab must never use it; the spy proves it is not called.
const usePhonePlaybackSpy = vi.fn();
vi.mock('../../hooks/usePhonePlayback', () => ({
  default: (...args) => { usePhonePlaybackSpy(...args); return {}; },
}));

import api from '../../services/api';
import EpisodeLalasPhoneTab, { playablePhoneScreens } from './EpisodeLalasPhoneTab';

const EPISODE = { id: 'ep-1', show_id: 's-1', title: 'Ep 1' };

const HOME = {
  id: 'home', name: 'Homepage', category: 'phone', is_home: true, generated: true,
  url: 'https://x/home.png', show_id: 's-1',
  screen_links: [{ id: 'z-call', x: 10, y: 20, w: 15, h: 10, target: 'calls', label: 'Call' }],
};
const CALLS = { id: 'calls', name: 'calls list', category: 'phone', generated: true, url: 'https://x/calls.png', show_id: 's-1' };
const CAMERA = { id: 'camera', name: 'Camera', category: 'phone', generated: false, url: null };

function mockGets({ overlays = [HOME, CALLS, CAMERA], frame = { phone_skin: 'lavender', frame_url: null } } = {}) {
  vi.mocked(api.get).mockImplementation((url) => {
    if (url.startsWith('/api/v1/ui-overlays/s-1/missions')) return Promise.resolve({ data: { missions: [] } });
    if (url === '/api/v1/ui-overlays/s-1/frame') return Promise.resolve({ data: { success: true, ...frame } });
    if (url.startsWith('/api/v1/ui-overlays/s-1?')) return Promise.resolve({ data: { data: overlays } });
    if (url.startsWith('/api/v1/feed-enhanced/s-1/moments/ep-1')) return Promise.resolve({ data: { data: [] } });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

function renderTab() {
  return render(
    <MemoryRouter>
      <EpisodeLalasPhoneTab episode={EPISODE} onPreview={() => {}} />
    </MemoryRouter>,
  );
}

async function phonePane() {
  const pane = screen.getByRole('complementary', { name: 'Phone' });
  await within(pane).findByAltText('Homepage');
  return pane;
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  usePhonePlaybackSpy.mockReset();
});

describe('EpisodeLalasPhoneTab — embedded phone (Task #1994)', () => {
  test('the left pane draws the same phone, in the show\'s skin, from a read-only GET of /frame', async () => {
    mockGets();
    renderTab();
    const pane = await phonePane();
    const frame = pane.querySelector('.phone-hub-frame');
    expect(frame).toBeTruthy();
    // jsdom drops gradient backgrounds, so check the skin by its side-button colour (lavender #9878b8).
    expect(frame.firstElementChild.style.background).toBe('rgb(152, 120, 184)');
    expect(api.get).toHaveBeenCalledWith('/api/v1/ui-overlays/s-1/frame');
    // Embedded: no overlay Close control.
    expect(within(pane).queryByTitle('Close (ESC)')).toBeNull();
    // The right pane still shows the tab's content.
    expect(screen.getByText('2 screens')).toBeTruthy();
  });

  test('taps, Back and Reset in the embedded phone send no phone-state or tap request, and write nothing', async () => {
    mockGets();
    renderTab();
    const pane = await phonePane();
    fireEvent.click(within(pane).getByTitle('Call'));
    await within(pane).findByAltText('calls list');
    expect(within(pane).getByText('>')).toBeTruthy();
    fireEvent.click(within(pane).getByRole('button', { name: 'Back' }));
    await within(pane).findByAltText('Homepage');
    fireEvent.click(within(pane).getByTitle('Reset playthrough'));

    const urls = Object.values(api).flatMap((fn) => (fn?.mock?.calls || []).map(([u]) => String(u)));
    expect(urls.some((u) => u.includes('/phone-state'))).toBe(false);
    expect(api.post).not.toHaveBeenCalled();
    expect(api.put).not.toHaveBeenCalled();
    expect(api.patch).not.toHaveBeenCalled();
    expect(api.delete).not.toHaveBeenCalled();
    expect(usePhonePlaybackSpy).not.toHaveBeenCalled();
  });

  test('the header links to Phone Studio, the show\'s Phone Hub', async () => {
    mockGets();
    renderTab();
    await phonePane();
    const link = screen.getByRole('link', { name: /Edit in Phone Studio/ });
    expect(link.getAttribute('href')).toBe('/shows/s-1/world?tab=overlays-tab');
  });

  test('with no screens, the phone shows "Select a screen" and points to Phone Studio', async () => {
    mockGets({ overlays: [] });
    renderTab();
    const pane = screen.getByRole('complementary', { name: 'Phone' });
    expect(await within(pane).findByText('Select a screen')).toBeTruthy();
    expect(within(pane).getByText(/No screens yet/)).toBeTruthy();
    expect(within(pane).getByRole('link', { name: 'Phone Studio' }).getAttribute('href'))
      .toBe('/shows/s-1/world?tab=overlays-tab');
  });

  test('a failed /frame read still draws the phone, in the default skin', async () => {
    vi.mocked(api.get).mockImplementation((url) => {
      if (url === '/api/v1/ui-overlays/s-1/frame') return Promise.reject(new Error('frame down'));
      if (url.startsWith('/api/v1/ui-overlays/s-1/missions')) return Promise.resolve({ data: { missions: [] } });
      if (url.startsWith('/api/v1/ui-overlays/s-1?')) return Promise.resolve({ data: { data: [HOME] } });
      return Promise.resolve({ data: { data: [] } });
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderTab();
    const pane = await phonePane();
    // rosegold's side-button colour, #c99585.
    expect(pane.querySelector('.phone-hub-frame').firstElementChild.style.background).toBe('rgb(201, 149, 133)');
    spy.mockRestore();
  });

  test('plays only generated screens with an image, the Preview Phone path\'s filter', () => {
    expect(playablePhoneScreens([HOME, CALLS, CAMERA, { id: 'x', generated: true, url: null }]).map((s) => s.id))
      .toEqual(['home', 'calls']);
  });
});
