/**
 * PhoneHub — characterization of the phone device (Task #1983, C1).
 *
 * Written before PhoneDevice is extracted, and required to pass unchanged
 * after it: it pins what Producer Mode's phone draws and how it behaves, so
 * the extraction can prove it changed nothing. ScreenContentRenderer and
 * PhoneMapView are stubbed (they fetch); isMapScreen stays real.
 */

import React from 'react';
import { vi, describe, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';

vi.mock('./ScreenContentRenderer', () => ({
  default: (props) => (
    <div
      data-testid="content-renderer"
      data-props={JSON.stringify({
        zones: props.zones,
        showId: props.showId,
        screenMeta: props.screenMeta,
        interactive: props.interactive,
        episodeId: props.episodeId,
      })}
    />
  ),
}));

vi.mock('./phone/PhoneMapView', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: (props) => (
      <div
        data-testid="map-view"
        data-props={JSON.stringify({ showId: props.showId, fallbackImageUrl: props.fallbackImageUrl })}
      />
    ),
  };
});

import PhoneHub, { getScreenImageStyle } from './PhoneHub';

const HOME = {
  id: 'home', name: 'Home', category: 'phone', generated: true, is_home: true,
  url: 'https://x/home.png', show_id: 'show-1', beat: 'Beat 1',
  image_fit: { mode: 'contain', scale: 110, offsetX: 2, offsetY: -3 },
  screen_links: [
    { id: 'z-dm', x: 10, y: 20, w: 15, h: 10, target: 'dms', label: 'Messages', icon_url: 'https://x/dm-icon.png' },
    { id: 'z-nav', x: 5, y: 90, w: 10, h: 8, target: 'map', label: 'Nav', icon_url: 'https://x/nav.png', persistent: true },
  ],
  content_zones: [{ id: 'cz-1', content_type: 'dm_thread', x: 0, y: 0, w: 100, h: 50 }],
  metadata: { some: 'meta' },
};
const DMS = {
  id: 'dms', name: 'DMs', category: 'phone', generated: true, url: 'https://x/dms.png',
  show_id: 'show-1', description: 'Direct messages screen',
  screen_links: [{ id: 'z-back', x: 0, y: 0, w: 20, h: 10, target: 'home', label: 'Back home' }],
};
const MAP = {
  id: 'map', name: 'Map', category: 'phone', generated: true, url: 'https://x/map-fallback.png', show_id: 'show-1',
};
const CAMERA = { id: 'camera', name: 'Camera', category: 'phone', generated: false, url: null, show_id: 'show-1' };
const ICON = { id: 'dm-icon', name: 'DM Icon', category: 'phone_icon', generated: true, url: 'https://x/dm-icon.png', type: 'icon' };
const SCREENS = [HOME, DMS, MAP, CAMERA, ICON];

function renderHub(props = {}) {
  const utils = render(
    <PhoneHub
      screens={SCREENS}
      activeScreen={HOME}
      onSelectScreen={() => {}}
      onNavigate={() => {}}
      skin="midnight"
      suppressSectionTabs
      {...props}
    />,
  );
  const device = utils.container.querySelector('.phone-hub-device');
  return { ...utils, device, d: within(device) };
}

afterEach(() => cleanup());

describe('PhoneHub device — characterization (Task #1983)', () => {
  test('a normal screen draws its image with getScreenImageStyle inside the built-in frame', () => {
    const { device, d } = renderHub();
    const frame = device.querySelector('.phone-hub-frame');
    expect(frame).toBeTruthy();
    const img = d.getByAltText('Home');
    expect(img.getAttribute('src')).toBe(HOME.url);
    const expected = getScreenImageStyle(HOME, undefined);
    expect(img.style.objectFit).toBe(expected.objectFit);
    expect(img.style.objectPosition).toBe(expected.objectPosition);
    expect(img.style.transform).toBe(expected.transform);
    // Built-in frame shows the name overlay; no custom frame image.
    expect(d.getByText('Beat 1')).toBeTruthy();
    expect(d.queryByAltText('Phone frame')).toBeNull();
    expect(d.queryByTestId('map-view')).toBeNull();
  });

  test('ScreenContentRenderer gets the zones, showId, metadata and interactive=false (no episodeId)', () => {
    const { d } = renderHub();
    const props = JSON.parse(d.getByTestId('content-renderer').getAttribute('data-props'));
    expect(props).toEqual({
      zones: HOME.content_zones,
      showId: 'show-1',
      screenMeta: HOME.metadata,
      interactive: false,
    });
  });

  test('screen links render with their icons and call onNavigate with the target', () => {
    const onNavigate = vi.fn();
    const { d } = renderHub({ onNavigate });
    const link = d.getByTitle('Messages');
    expect(within(link).getByAltText('Messages').getAttribute('src')).toBe('https://x/dm-icon.png');
    fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalledWith('dms');
  });

  test('persistent home links show on other screens and navigate; not on the home screen itself', () => {
    const onNavigate = vi.fn();
    const home = renderHub({ onNavigate });
    // On home: the nav link appears once (as a normal link), not twice.
    expect(home.d.getAllByTitle('Nav')).toHaveLength(1);
    cleanup();
    const other = renderHub({ activeScreen: DMS, onNavigate });
    const persistent = other.d.getByTitle('Nav');
    fireEvent.click(persistent);
    expect(onNavigate).toHaveBeenCalledWith('map');
    fireEvent.click(other.d.getByTitle('Back home'));
    expect(onNavigate).toHaveBeenCalledWith('home');
  });

  test('a map screen draws PhoneMapView with the fallback image, and hides persistent links', () => {
    const { d } = renderHub({ activeScreen: MAP });
    const props = JSON.parse(d.getByTestId('map-view').getAttribute('data-props'));
    expect(props).toEqual({ showId: 'show-1', fallbackImageUrl: MAP.url });
    expect(d.queryByAltText('Map')).toBeNull();
    expect(d.queryByTitle('Nav')).toBeNull();
  });

  test('no screen shows "Select a screen"; an icon as the active item counts as no screen', () => {
    const none = renderHub({ activeScreen: null });
    expect(none.d.getByText('Select a screen')).toBeTruthy();
    expect(none.d.queryByTestId('content-renderer')).toBeNull();
    cleanup();
    const icon = renderHub({ activeScreen: ICON });
    expect(icon.d.getByText('Select a screen')).toBeTruthy();
  });

  test('an ungenerated screen reads "Not generated yet" in the built-in frame, "Not generated" in a custom one', () => {
    const builtIn = renderHub({ activeScreen: CAMERA });
    expect(builtIn.d.getByText('Not generated yet')).toBeTruthy();
    cleanup();
    const custom = renderHub({ activeScreen: CAMERA, customFrameUrl: 'https://x/frame.png' });
    expect(custom.d.getByText('Not generated')).toBeTruthy();
    expect(custom.d.getByAltText('Phone frame').getAttribute('src')).toBe('https://x/frame.png');
    // Custom frames drop the name overlay.
    expect(custom.d.queryByText('Camera')).toBeNull();
  });

  test('a custom frame that fails to load falls back to the built-in frame', () => {
    const { d } = renderHub({ customFrameUrl: 'https://x/broken.png' });
    fireEvent.error(d.getByAltText('Phone frame'));
    expect(d.queryByAltText('Phone frame')).toBeNull();
    expect(d.getByText('Beat 1')).toBeTruthy();
  });

  test('the back button shows only with history and onBack, and calls onBack', () => {
    const noHistory = renderHub({ onBack: vi.fn() });
    expect(noHistory.d.queryByText('← Back')).toBeNull();
    cleanup();
    const noHandler = renderHub({ navigationHistory: ['home'] });
    expect(noHandler.d.queryByText('← Back')).toBeNull();
    cleanup();
    const onBack = vi.fn();
    const withBoth = renderHub({ navigationHistory: ['home'], onBack });
    fireEvent.click(withBoth.d.getByText('← Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['home, built-in frame', {}],
    ['other screen with history and back', { activeScreen: DMS, navigationHistory: ['home'], onBack: () => {} }],
    ['map screen', { activeScreen: MAP }],
    ['ungenerated screen, custom frame', { activeScreen: CAMERA, customFrameUrl: 'https://x/frame.png' }],
  ])('device markup is unchanged: %s', (_label, props) => {
    const { device } = renderHub(props);
    expect(device.innerHTML).toMatchSnapshot();
  });
});
