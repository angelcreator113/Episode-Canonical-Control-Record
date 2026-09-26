/**
 * PhoneDevice — the drawing of Lala's Phone, tested directly (Task #1983, C1).
 *
 * The same cases PhoneHub.device.test.jsx pins through PhoneHub, driven by
 * PhoneDevice's own props. ScreenContentRenderer and PhoneMapView are stubbed
 * (they fetch); isMapScreen stays real.
 */

import React from 'react';
import { vi, describe, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../ScreenContentRenderer', () => ({
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

vi.mock('./PhoneMapView', async (importOriginal) => {
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

import PhoneDevice from './PhoneDevice';
import { getScreenImageStyle } from './phoneStyle';

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
  id: 'dms', name: 'DMs', category: 'phone', generated: true, url: 'https://x/dms.png', show_id: 'show-1',
  screen_links: [{ id: 'z-back', x: 0, y: 0, w: 20, h: 10, target: 'home', label: 'Back home' }],
};
const MAP = { id: 'map', name: 'Map', category: 'phone', generated: true, url: 'https://x/map-fallback.png', show_id: 'show-1' };
const CAMERA = { id: 'camera', name: 'Camera', category: 'phone', generated: false, url: null, show_id: 'show-1' };
const PERSISTENT = HOME.screen_links.filter((l) => l.persistent && l.icon_url);

function renderDevice(props = {}) {
  return render(
    <PhoneDevice
      skin="midnight"
      useCustomFrame={false}
      phoneScreen={HOME}
      activeScreen={HOME}
      firstScreen={HOME}
      persistentLinks={PERSISTENT}
      onNavigate={() => {}}
      {...props}
    />,
  );
}

afterEach(() => cleanup());

describe('PhoneDevice (Task #1983)', () => {
  test('draws the screen image with getScreenImageStyle in the built-in frame', () => {
    const { container } = renderDevice();
    expect(container.querySelector('.phone-hub-frame')).toBeTruthy();
    const img = screen.getByAltText('Home');
    const expected = getScreenImageStyle(HOME, undefined);
    expect(img.getAttribute('src')).toBe(HOME.url);
    expect(img.style.objectFit).toBe(expected.objectFit);
    expect(img.style.transform).toBe(expected.transform);
    expect(screen.getByText('Beat 1')).toBeTruthy();
  });

  test('passes zones, showId, metadata and interactive=false to ScreenContentRenderer, with no episodeId', () => {
    renderDevice();
    expect(JSON.parse(screen.getByTestId('content-renderer').getAttribute('data-props'))).toEqual({
      zones: HOME.content_zones, showId: 'show-1', screenMeta: HOME.metadata, interactive: false,
    });
  });

  test('screen links and persistent links call onNavigate; persistent links skip the home screen', () => {
    const onNavigate = vi.fn();
    renderDevice({ onNavigate });
    expect(screen.getAllByTitle('Nav')).toHaveLength(1);
    fireEvent.click(screen.getByTitle('Messages'));
    expect(onNavigate).toHaveBeenCalledWith('dms');
    cleanup();
    renderDevice({ phoneScreen: DMS, activeScreen: DMS, onNavigate });
    fireEvent.click(screen.getByTitle('Nav'));
    expect(onNavigate).toHaveBeenCalledWith('map');
    fireEvent.click(screen.getByTitle('Back home'));
    expect(onNavigate).toHaveBeenCalledWith('home');
  });

  test('a map screen draws PhoneMapView with the fallback image and no persistent links', () => {
    renderDevice({ phoneScreen: MAP, activeScreen: MAP });
    expect(JSON.parse(screen.getByTestId('map-view').getAttribute('data-props')))
      .toEqual({ showId: 'show-1', fallbackImageUrl: MAP.url });
    expect(screen.queryByTitle('Nav')).toBeNull();
  });

  test('no screen, or an ungenerated one, shows the right placeholder for each frame', () => {
    renderDevice({ phoneScreen: null, activeScreen: null });
    expect(screen.getByText('Select a screen')).toBeTruthy();
    cleanup();
    renderDevice({ phoneScreen: CAMERA, activeScreen: CAMERA });
    expect(screen.getByText('Not generated yet')).toBeTruthy();
    cleanup();
    renderDevice({ phoneScreen: CAMERA, activeScreen: CAMERA, useCustomFrame: true, customFrameUrl: 'https://x/frame.png' });
    expect(screen.getByText('Not generated')).toBeTruthy();
    expect(screen.getByAltText('Phone frame').getAttribute('src')).toBe('https://x/frame.png');
  });

  test('forwards the custom frame load and error events to the caller', () => {
    const onCustomFrameLoad = vi.fn();
    const onCustomFrameError = vi.fn();
    renderDevice({ useCustomFrame: true, customFrameUrl: 'https://x/frame.png', onCustomFrameLoad, onCustomFrameError });
    fireEvent.load(screen.getByAltText('Phone frame'));
    fireEvent.error(screen.getByAltText('Phone frame'));
    expect(onCustomFrameLoad).toHaveBeenCalledTimes(1);
    expect(onCustomFrameError).toHaveBeenCalledTimes(1);
  });

  test('the back button shows only with history and onBack', () => {
    renderDevice({ onBack: vi.fn() });
    expect(screen.queryByText('← Back')).toBeNull();
    cleanup();
    const onBack = vi.fn();
    renderDevice({ navigationHistory: ['home'], onBack });
    fireEvent.click(screen.getByText('← Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
