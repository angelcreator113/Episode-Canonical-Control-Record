/**
 * UIOverlaysTab — the Phone Hub's top area and the screen cards' output,
 * pinned before the setup guide (Task #2053, step 1).
 *
 * Written against main before any source change. The header (title, the
 * tiles since the 2026-10-07 redesign, More), the "+ Add" chooser, the stage row and each screen
 * card's status stay as they are; the setup guide is added beside them, so
 * every assertion here holds before and after.
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
vi.mock('../components/phone-editor/MissionEditor', () => ({ default: () => null }));
vi.mock('../components/ContentZoneEditor', () => ({ default: () => null }));

import api from '../services/api';
import UIOverlaysTab from './UIOverlaysTab';

const SHOW = 's-1';
const CALL = { id: 'call_icon', name: 'Call', category: 'phone_icon', generated: true, url: 'https://x/call.png', asset_id: 'a-call' };
const screenOf = (over) => ({ category: 'phone', generated: true, show_id: SHOW, screen_links: [], custom: true, ...over });
const HOME = screenOf({
  id: 'home', name: 'Homepage', is_home: true, url: 'https://x/home.png', asset_id: 'a-home',
  screen_links: [
    { id: 'z-call', x: 10, y: 20, w: 12, h: 9, target: 'calls', label: 'Call', icon_overlay_id: 'call_icon' },
    { id: 'z-none', x: 40, y: 20, w: 12, h: 9, label: 'Nowhere' },
  ],
});
const CALLS = screenOf({ id: 'calls', name: 'calls list', url: 'https://x/calls.png', asset_id: 'a-calls' });
const MAIL = screenOf({ id: 'mail', name: 'mail inbox', url: 'https://x/mail.png', asset_id: 'a-mail' });
const DMS = screenOf({ id: 'dms', name: 'dm thread', generated: false, url: null });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `/api/v1/ui-overlays/${SHOW}`) return { data: { success: true, data: [HOME, CALLS, MAIL, DMS, CALL] } };
    return { data: { success: true, data: [], missions: [] } };
  });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function renderPage() {
  const utils = render(<UIOverlaysTab showId={SHOW} />);
  await waitFor(() => expect(document.querySelector('.phone-hub-screen-grid')).toBeTruthy());
  return utils;
}
const menuItems = (label) => {
  const trigger = Array.from(document.querySelectorAll('.overlays-header .toolbar-menu > button'))
    .find(b => b.querySelector('.btn-label')?.textContent === label);
  fireEvent.click(trigger);
  const list = trigger.closest('.toolbar-menu').querySelector('.toolbar-menu__list');
  const items = Array.from(list.querySelectorAll('button')).map(b => b.textContent.replace(/\s+/g, ' ').trim());
  fireEvent.click(trigger);
  return items;
};

describe('UIOverlaysTab top area — pinned before the setup guide (Task #2053)', () => {
  // The header's tiles (Evoni's mock, 2026-10-07) replace "4/5 screens ready",
  // which counted every row with an image, the Call icon included. Ready is
  // the cards' rule: Homepage has a zone with no destination, mail inbox has
  // nothing linking to it and dm thread has no image, so 1 of the 4 screens.
  // The header bar (Evoni's mockup, 2026-10-08): the tiles became chips.
  // calls list is reached from Homepage but leads nowhere (a dead end);
  // mail inbox is reached from nothing; dm thread has no image, so it is in
  // neither count.
  test('the header bar reads Lala\'s Phone and its chips: screens ready, icons, dead ends, not reachable', async () => {
    await renderPage();
    const header = document.querySelector('.overlays-header');
    expect(within(header).getByRole('heading', { name: "Lala's Phone" })).toBeTruthy();
    const chips = Array.from(header.querySelectorAll('[data-testid="phone-hub-chips"] li')).map(li => li.textContent);
    expect(chips).toEqual(['1/4 screens ready', '1 icon', '1 dead end', '1 screen not reachable']);
  });

  test('a chip opens the stage that fixes it: dead ends open the Map', async () => {
    await renderPage();
    fireEvent.click(screen.getByTestId('phone-chip-dead'));
    await waitFor(() => expect(within(document.querySelector('.phone-hub-stage-row')).getByRole('button', { name: 'Map' }).getAttribute('aria-current')).toBe('page'));
    expect(screen.getByRole('heading', { name: 'How Lala moves through her phone' })).toBeTruthy();
  });

  // The contact sheet and batch upload were removed (Evoni, 2026-10-07,
  // Lala's Phone step 2).
  test('More holds the Flow Map and the frame', async () => {
    await renderPage();
    expect(menuItems('More')).toEqual(['Flow Map', 'Upload Frame']);
  });

  test('"+ Add" asks what you are adding: Screen, Icon or Content Area', async () => {
    await renderPage();
    const items = menuItems('Add');
    expect(items.map(t => t.split(' ')[0])).toEqual(['Screen', 'Icon', 'Content']);
    expect(document.querySelector('.overlays-toolbar .toolbar-menu')).toBeTruthy();
  });

  // Advanced ▾ (show-wide Missions) is gone: missions are per episode now.
  test('the stage row reads Map · Build · Connect · Content · Preview, Build current', async () => {
    await renderPage();
    const row = document.querySelector('.phone-hub-stage-row');
    const names = within(row).getAllByRole('button').map(b => b.textContent.trim());
    expect(names).toEqual(['Map', 'Build', 'Connect', 'Content', 'Preview']);
    expect(within(row).getByRole('button', { name: 'Build' }).getAttribute('aria-current')).toBe('page');
  });

  test('the stage row is in the header bar, before the phone', async () => {
    await renderPage();
    const header = document.querySelector('.overlays-header');
    const layout = document.querySelector('.phone-hub-layout');
    expect(header.compareDocumentPosition(layout) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(header.querySelector('.phone-hub-stage-row')).toBeTruthy();
    expect(layout.querySelector('.phone-hub-stage-row')).toBeNull();
    expect(layout.querySelector('.phone-hub-screen-grid')).toBeTruthy();
  });

  test('each screen card keeps its status word, lines and Continue', async () => {
    await renderPage();
    const grid = document.querySelector('.phone-hub-screen-grid');
    const summary = Array.from(grid.querySelectorAll('.screen-card')).map((card) => {
      const status = card.querySelector('[data-testid="screen-card-status"]');
      return {
        text: status ? Array.from(status.querySelectorAll('.screen-card-status__line')).map(l => l.textContent) : null,
        continue: !!card.querySelector('.screen-card-continue'),
      };
    });
    const byName = (name) => summary[Array.from(grid.querySelectorAll('.screen-card')).findIndex(c => within(c).queryByText(name))];
    expect(byName('Homepage')).toEqual({ text: ['✓ Image', '⚠ 1 zone has no destination'], continue: true });
    expect(byName('calls list')).toEqual({ text: ['✓ Image', 'No zones yet'], continue: false });
    expect(byName('mail inbox')).toEqual({ text: ['✓ Image', 'No zones yet', '⚠ Nothing links here'], continue: true });
    expect(byName('dm thread').continue).toBe(true);
    expect(byName('dm thread').text[0]).toBe('⚠ No image');
  });
});
