/**
 * Zone icons — behaviour that must survive icon identity (Task #2005, I1).
 *
 * Written before placements resolve their icon by key, and required to pass
 * unchanged after it: a zone's own custom icon (uploaded per zone, tied to no
 * icon overlay) still draws by its address, in the Producer Mode device and in
 * the Preview; and tapping a zone still navigates.
 */

import React from 'react';
import { vi, describe, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../ScreenContentRenderer', () => ({ default: () => null }));
vi.mock('./PhoneMapView', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, default: () => null };
});

import PhoneDevice from './PhoneDevice';
import PhonePreviewMode from '../PhonePreviewMode';

const CUSTOM_ICON = 'https://x/custom-zone-icon.png';
const HOME = {
  id: 'home', name: 'Home', category: 'phone', generated: true, is_home: true,
  url: 'https://x/home.png', show_id: 'show-1',
  screen_links: [
    { id: 'z-custom', x: 10, y: 20, w: 15, h: 10, target: 'dms', label: 'Custom', icon_url: CUSTOM_ICON, icon_urls: [CUSTOM_ICON] },
  ],
};
const DMS = { id: 'dms', name: 'DMs', category: 'phone', generated: true, url: 'https://x/dms.png', show_id: 'show-1' };
// An icon overlay whose address the custom zone does not use.
const CALL_ICON = { id: 'call_icon', name: 'Call', category: 'phone_icon', generated: true, url: 'https://x/call.png' };

afterEach(() => cleanup());

describe('zone icons — pinned before icon identity (Task #2005)', () => {
  test('PhoneDevice draws a zone\'s own custom icon by its address, and a tap navigates', () => {
    const onNavigate = vi.fn();
    render(<PhoneDevice skin="midnight" phoneScreen={HOME} activeScreen={HOME} firstScreen={HOME} onNavigate={onNavigate} />);
    const zone = screen.getByTitle('Custom');
    expect(zone.querySelector('img').getAttribute('src')).toBe(CUSTOM_ICON);
    fireEvent.click(zone);
    expect(onNavigate).toHaveBeenCalledWith('dms');
  });

  test('the Preview draws a zone\'s own custom icon by its address, and a tap navigates', async () => {
    render(<PhonePreviewMode screens={[HOME, DMS, CALL_ICON]} initialScreen={HOME} onClose={() => {}} />);
    const zone = screen.getByTitle('Custom');
    expect(zone.querySelector('img').getAttribute('src')).toBe(CUSTOM_ICON);
    fireEvent.click(zone);
    await screen.findByAltText('DMs');
  });
});
