/**
 * PhoneHub — placements stand for their icon (Task #2005, doctrine rule 17).
 *
 * After an icon's image changes, its placement draws the new image and the
 * icon card stays "placed", because both look the icon up by key. A legacy
 * zone whose address is the icon's current image counts too; one left stale
 * by an earlier image change does not (the old address isn't in the data).
 */

import React from 'react';
import { vi, describe, afterEach, test, expect } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';

vi.mock('./ScreenContentRenderer', () => ({ default: () => null }));
vi.mock('./phone/PhoneMapView', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, default: () => null };
});

import PhoneHub from './PhoneHub';

const OLD_URL = 'https://x/call-v1.png';
const NEW_URL = 'https://x/call-v2.png';
// The Call icon after "Change image": same key, new address.
const CALL = { id: 'call_icon', name: 'Call', category: 'phone_icon', generated: true, url: NEW_URL, opens_screen: 'calls' };
const CALLS = { id: 'calls', name: 'calls list', category: 'phone', generated: true, url: 'https://x/calls.png', show_id: 's-1' };

function home(zone) {
  return {
    id: 'home', name: 'Homepage', category: 'phone', generated: true, is_home: true,
    url: 'https://x/home.png', show_id: 's-1', screen_links: [zone],
  };
}

function renderHub(zone) {
  const HOME = home(zone);
  return render(
    <PhoneHub
      screens={[HOME, CALLS, CALL]}
      activeScreen={HOME}
      onSelectScreen={() => {}}
      onNavigate={() => {}}
      activeTab="icons"
      suppressSectionTabs
    />,
  );
}

afterEach(() => cleanup());

describe('PhoneHub — placements stand for their icon (Task #2005)', () => {
  test('a keyed placement draws the icon\'s new image after Change image, and the card stays placed', () => {
    const { container } = renderHub({ id: 'z1', x: 10, y: 20, w: 15, h: 10, target: 'calls', label: 'Call', icon_url: OLD_URL, icon_overlay_id: 'call_icon' });
    const device = container.querySelector('.phone-hub-device');
    expect(within(device).getByTitle('Call').querySelector('img').getAttribute('src')).toBe(NEW_URL);
    expect(screen.getByText('✓ 1 screen')).toBeTruthy();
    expect(screen.queryByText('○ Unplaced')).toBeNull();
  });

  test('a legacy placement whose address is the icon\'s current image counts as placed', () => {
    renderHub({ id: 'z2', x: 10, y: 20, w: 15, h: 10, target: 'calls', label: 'Call', icon_url: NEW_URL });
    expect(screen.getByText('✓ 1 screen')).toBeTruthy();
  });

  test('a legacy placement left stale by an earlier image change keeps its old image and does not count', () => {
    const { container } = renderHub({ id: 'z3', x: 10, y: 20, w: 15, h: 10, target: 'calls', label: 'Call', icon_url: OLD_URL });
    const device = container.querySelector('.phone-hub-device');
    expect(within(device).getByTitle('Call').querySelector('img').getAttribute('src')).toBe(OLD_URL);
    expect(screen.getByText('○ Unplaced')).toBeTruthy();
  });
});
