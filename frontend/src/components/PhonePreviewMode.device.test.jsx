/**
 * PhonePreviewMode draws through PhoneDevice (Task #1990, C2): the same frame
 * and content zones as Producer Mode, with the Preview's own tap layer.
 */

import React from 'react';
import { vi, describe, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('./ScreenContentRenderer', () => ({
  default: (props) => (
    <div
      data-testid="content-renderer"
      data-props={JSON.stringify({ zones: props.zones, showId: props.showId, interactive: props.interactive, episodeId: props.episodeId })}
    />
  ),
}));

vi.mock('./phone/PhoneMapView', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, default: () => <div data-testid="map-view" /> };
});

import PhonePreviewMode from './PhonePreviewMode';

const HOME = {
  id: 'home', name: 'Home', generated: true, is_home: true,
  url: 'https://x/home.png', show_id: 'show-1',
  content_zones: [{ id: 'cz-1', content_type: 'dm_thread', x: 0, y: 0, w: 100, h: 50 }],
  screen_links: [{ id: 'z-dm', x: 10, y: 20, w: 15, h: 10, target: 'dms', label: 'Messages', icon_url: 'https://x/dm.png' }],
};
const DMS = { id: 'dms', name: 'DMs', generated: true, url: 'https://x/dms.png', show_id: 'show-1' };
const MAP = { id: 'map', name: 'Map', generated: true, url: 'https://x/map.png', show_id: 'show-1' };

function renderPreview(props = {}) {
  return render(<PhonePreviewMode screens={[HOME, DMS, MAP]} initialScreen={HOME} onClose={() => {}} {...props} />);
}

afterEach(() => cleanup());

describe('PhonePreviewMode draws through PhoneDevice (Task #1990)', () => {
  test('renders PhoneFrame in the chosen skin and ScreenContentRenderer, not interactive, with no episodeId', () => {
    const { container } = renderPreview({ phoneSkin: 'lavender' });
    const frame = container.querySelector('.phone-hub-frame');
    expect(frame).toBeTruthy();
    // jsdom drops gradient backgrounds, so check the skin by its side-button colour (lavender #9878b8).
    expect(frame.firstElementChild.style.background).toBe('rgb(152, 120, 184)');
    expect(JSON.parse(screen.getByTestId('content-renderer').getAttribute('data-props'))).toEqual({
      zones: HOME.content_zones, showId: 'show-1', interactive: false,
    });
    expect(screen.getByAltText('Home').getAttribute('src')).toBe(HOME.url);
  });

  test('draws each tap zone once, from the Preview\'s own layer', () => {
    renderPreview();
    expect(screen.getAllByTitle('Messages')).toHaveLength(1);
  });

  test('a custom frame is drawn, and falls back to the built-in frame if it fails to load', () => {
    renderPreview({ customFrameUrl: 'https://x/frame.png' });
    const img = screen.getByAltText('Phone frame');
    expect(img.getAttribute('src')).toBe('https://x/frame.png');
    fireEvent.error(img);
    expect(screen.queryByAltText('Phone frame')).toBeNull();
    expect(screen.getByAltText('Home')).toBeTruthy();
  });

  test('a map screen draws the live map', () => {
    renderPreview({ initialScreen: MAP });
    expect(screen.getByTestId('map-view')).toBeTruthy();
  });
});
