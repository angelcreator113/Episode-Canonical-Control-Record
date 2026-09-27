/**
 * PhoneHub — the card output that status cards must keep (Task #2042, step 1).
 *
 * Written against main before any source change. Screen cards show their
 * name; the home screen's card reads "★ HOME" (is_home, else the first
 * generated screen); icon cards read "✓ N screen(s)", "⚠ No target" or
 * "○ Unplaced". The status lines added by doctrine rule 18 sit beside these,
 * so every assertion here holds before and after.
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

const CALL = { id: 'call_icon', name: 'Call', category: 'phone_icon', generated: true, url: 'https://x/call.png' };
const MAIL = { id: 'mail_icon', name: 'Mail', category: 'phone_icon', generated: true, url: 'https://x/mail.png' };
const CAMERA = { id: 'camera_icon', name: 'Camera', category: 'phone_icon', generated: true, url: 'https://x/camera.png' };

const HOME = {
  id: 'home', name: 'Homepage', category: 'phone', generated: true, is_home: true,
  url: 'https://x/home.png', show_id: 's-1',
  screen_links: [
    { id: 'z1', x: 10, y: 20, w: 12, h: 9, target: 'calls', label: 'Call', icon_overlay_id: 'call_icon' },
    { id: 'z2', x: 30, y: 20, w: 12, h: 9, label: 'Mail', icon_overlay_id: 'mail_icon' },
  ],
};
const CALLS = { id: 'calls', name: 'Calls list', category: 'phone', generated: true, url: 'https://x/calls.png', show_id: 's-1' };
const DMS = { id: 'dms', name: 'DMs', category: 'phone', generated: false, url: null, show_id: 's-1' };

function hub(screens, tab = 'screens') {
  return render(
    <PhoneHub
      screens={screens}
      activeScreen={screens[0]}
      onSelectScreen={() => {}}
      onNavigate={() => {}}
      activeTab={tab}
      suppressSectionTabs
    />,
  );
}

const cards = (container) => Array.from(container.querySelectorAll('.screen-card'));
const cardFor = (container, name) => cards(container).find(c => within(c).queryByText(name));

afterEach(() => cleanup());

describe('PhoneHub cards — pinned before status cards (Task #2042)', () => {
  test('every screen card shows its name', () => {
    const { container } = hub([HOME, CALLS, DMS, CALL, MAIL, CAMERA]);
    const grid = container.querySelector('.phone-hub-screen-grid');
    expect(cards(grid)).toHaveLength(3);
    ['Homepage', 'Calls list', 'DMs'].forEach(name => expect(within(grid).getByText(name)).toBeTruthy());
  });

  test('the home screen card reads ★ HOME and never Unreached', () => {
    const { container } = hub([HOME, CALLS, DMS, CALL, MAIL, CAMERA]);
    const home = cardFor(container, 'Homepage');
    expect(within(home).getByText('★ HOME')).toBeTruthy();
    expect(within(home).queryByText(/Unreached/)).toBeNull();
    expect(within(cardFor(container, 'Calls list')).queryByText('★ HOME')).toBeNull();
  });

  test('with no screen marked home, the first generated screen is home', () => {
    const { container } = hub([DMS, { ...CALLS }, { ...HOME, is_home: false }]);
    expect(within(cardFor(container, 'Calls list')).getByText('★ HOME')).toBeTruthy();
    expect(within(cardFor(container, 'Homepage')).queryByText('★ HOME')).toBeNull();
    expect(within(cardFor(container, 'DMs')).queryByText('★ HOME')).toBeNull();
  });

  test('icon cards read placed with a target, placed without one, or unplaced', () => {
    const { container } = hub([HOME, CALLS, DMS, CALL, MAIL, CAMERA], 'icons');
    const grid = container.querySelector('.phone-hub-icon-grid');
    expect(within(cardFor(grid, 'Call')).getByText('✓ 1 screen')).toBeTruthy();
    expect(within(cardFor(grid, 'Mail')).getByText('⚠ No target')).toBeTruthy();
    expect(within(cardFor(grid, 'Camera')).getByText('○ Unplaced')).toBeTruthy();
  });
});
