/**
 * UIOverlaysTab — the Phone Hub's top area and the screen cards' output,
 * pinned before the setup guide (Task #2053, step 1).
 *
 * Written against main before any source change. The header (title, "N/M
 * screens ready", More), the "+ Add" chooser, the stage row and each screen
 * card's status stay as they are; the setup guide is added beside them, so
 * every assertion here holds before and after.
 */

import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, fireEvent, cleanup, waitFor, within } from '@testing-library/react';

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
  test('the header reads Phone Hub and "N/M screens ready"', async () => {
    await renderPage();
    const header = document.querySelector('.overlays-header');
    expect(within(header).getByRole('heading', { name: 'Phone Hub' })).toBeTruthy();
    expect(within(header).getByText('4/5 screens ready')).toBeTruthy();
  });

  test('More holds Flow Map, Export, Batch Upload and the frame', async () => {
    await renderPage();
    expect(menuItems('More')).toEqual(['Flow Map', 'Export contact sheet', 'Batch Upload', 'Upload Frame']);
  });

  test('"+ Add" asks what you are adding: Screen, Icon or Content Area', async () => {
    await renderPage();
    const items = menuItems('Add');
    expect(items.map(t => t.split(' ')[0])).toEqual(['Screen', 'Icon', 'Content']);
    expect(document.querySelector('.overlays-toolbar .toolbar-menu')).toBeTruthy();
  });

  test('the stage row reads Build · Connect · Content · Preview · Advanced, Build current', async () => {
    await renderPage();
    const row = document.querySelector('.phone-hub-stage-row');
    const names = within(row).getAllByRole('button').map(b => b.textContent.trim());
    expect(names).toEqual(['Build', 'Connect', 'Content', 'Preview', 'Advanced']);
    expect(within(row).getByRole('button', { name: 'Build' }).getAttribute('aria-current')).toBe('page');
  });

  test('the header and toolbar come before the stage row and the phone', async () => {
    await renderPage();
    const header = document.querySelector('.overlays-header');
    const layout = document.querySelector('.phone-hub-layout');
    expect(header.compareDocumentPosition(layout) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(layout.querySelector('.phone-hub-stage-row')).toBeTruthy();
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
