/**
 * UIOverlaysTab — the setup guide at the top of the Phone Hub (Task #2053,
 * doctrine rule 18).
 *
 * Its counts come from the page's own data; "Continue setup →" opens the
 * same places a screen card's Continue does; it starts collapsed once
 * Screens, Icons and Links are complete, and a toggle is remembered per show
 * in this browser.
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
const MAIL_ICON = { id: 'mail_icon', name: 'Mail', category: 'phone_icon', generated: true, url: 'https://x/mail-i.png', asset_id: 'a-mail-i' };
const screenOf = (over) => ({ category: 'phone', generated: true, show_id: SHOW, screen_links: [], custom: true, ...over });
const zone = (id, over) => ({ id, x: 10, y: 20, w: 12, h: 9, ...over });
const HOME = screenOf({
  id: 'home', name: 'Homepage', is_home: true, url: 'https://x/home.png', asset_id: 'a-home',
  screen_links: [
    zone('z-call', { target: 'calls', label: 'Call', icon_overlay_id: 'call_icon' }),
    zone('z-none', { x: 40, label: 'Nowhere' }),
  ],
});
const HOME_LINKED = { ...HOME, screen_links: [HOME.screen_links[0]] };
const CALLS = screenOf({ id: 'calls', name: 'calls list', url: 'https://x/calls.png', asset_id: 'a-calls', content_zones: [{ id: 'c1', content_type: 'text' }] });
const MAIL = screenOf({ id: 'mail', name: 'mail inbox', url: 'https://x/mail.png', asset_id: 'a-mail' });
const DMS = screenOf({ id: 'dms', name: 'dm thread', generated: false, url: null });

function mockApi(items) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `/api/v1/ui-overlays/${SHOW}`) return { data: { success: true, data: items } };
    return { data: { success: true, data: [], missions: [] } };
  });
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
  vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function renderPage(items) {
  mockApi(items);
  render(<UIOverlaysTab showId={SHOW} />);
  await waitFor(() => expect(document.querySelector('.phone-setup-guide')).toBeTruthy());
  await waitFor(() => expect(document.querySelector('.phone-hub-layout')).toBeTruthy());
}
const guide = () => document.querySelector('.phone-setup-guide');
const line = (key) => guide().querySelector(`[data-line="${key}"]`)?.textContent.replace(/Run$/, '').trim();
// The guide is one line (its next step) until opened (Evoni's mockup,
// 2026-10-08); the line-by-line tests open it first.
const openGuide = () => {
  if (!guide().querySelector('.phone-setup-guide__lines')) fireEvent.click(within(guide()).getByRole('button', { name: /Setup/ }));
};
const continueSetup = () => fireEvent.click(within(guide()).getByRole('button', { name: /Continue setup/ }));
const stage = (name) => within(document.querySelector('.phone-hub-stage-row')).getByRole('button', { name });
const connectScreen = () => document.querySelector('.zones-thumbnail.active .zones-thumbnail__label')?.textContent;

describe('UIOverlaysTab — setup guide (Task #2053)', () => {
  test('sits between the header bar and the phone, with counts from the page', async () => {
    await renderPage([HOME, CALLS, MAIL, DMS, CALL, MAIL_ICON]);
    const layout = document.querySelector('.phone-hub-layout');
    expect(document.querySelector('.overlays-header').compareDocumentPosition(guide()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(guide().compareDocumentPosition(layout) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    openGuide();
    expect(line('screens')).toBe('⚠Screens: 3 with an image of 4');
    expect(line('icons')).toBe('⚠Icons: 1 placed of 2');
    expect(line('links')).toBe('⚠Links: 1 of 2 zones have a destination');
    expect(line('content')).toBe('·Content: 1 screen with content zones');
    expect(line('preview')).toBe('·Preview: not run yet');
  });

  test('Screens first: Continue opens the first screen with no image in Build', async () => {
    await renderPage([HOME, CALLS, MAIL, DMS, CALL, MAIL_ICON]);
    continueSetup();
    await waitFor(() => expect(document.querySelector('.editor-modal')).toBeTruthy());
    expect(within(document.querySelector('.editor-modal-header')).getByText('dm thread')).toBeTruthy();
    expect(stage('Build').getAttribute('aria-current')).toBe('page');
  });

  test('then Links: Continue opens Connect on the screen with a zone that has no destination', async () => {
    await renderPage([HOME, CALLS, MAIL, CALL, MAIL_ICON]);
    continueSetup();
    await waitFor(() => expect(stage('Connect').getAttribute('aria-current')).toBe('page'));
    await waitFor(() => expect(connectScreen()).toBe('Homepage'));
    expect(api.put).not.toHaveBeenCalled();
  });

  test('then Icons: Continue opens Connect on the home screen', async () => {
    await renderPage([MAIL, CALLS, HOME_LINKED, CALL, MAIL_ICON]);
    openGuide();
    expect(line('links')).toBe('✓Links: 1 of 1 zone has a destination');
    continueSetup();
    await waitFor(() => expect(stage('Connect').getAttribute('aria-current')).toBe('page'));
    await waitFor(() => expect(connectScreen()).toBe('Homepage'));
  });

  test('no screens yet: Continue opens "+ Add" ▸ Screen', async () => {
    await renderPage([]);
    openGuide();
    expect(line('screens')).toBe('⚠Screens: none yet');
    continueSetup();
    expect(await screen.findByRole('button', { name: 'Create Screen' })).toBeTruthy();
  });

  test('starts as one line with its next step and Continue; complete, it says so', async () => {
    await renderPage([HOME, CALLS, DMS, CALL]);
    expect(guide().querySelector('.phone-setup-guide__lines')).toBeNull();
    expect(within(guide()).getByTestId('phone-setup-next').textContent).toBe('· next: add the next screen image');
    expect(within(guide()).getByRole('button', { name: /Continue setup/ })).toBeTruthy();
    cleanup();
    await renderPage([HOME_LINKED, CALLS, CALL]);
    expect(within(guide()).getByText('✓ Screens, icons and links are done')).toBeTruthy();
    expect(guide().querySelector('.phone-setup-guide__lines')).toBeNull();
    expect(within(guide()).queryByRole('button', { name: /Continue setup/ })).toBeNull();
  });

  test('the toggle is remembered for this show in this browser', async () => {
    await renderPage([HOME_LINKED, CALLS, CALL]);
    fireEvent.click(within(guide()).getByRole('button', { name: /Setup/ }));
    expect(guide().querySelector('.phone-setup-guide__lines')).toBeTruthy();
    expect(window.localStorage.getItem(`phoneSetupGuide:${SHOW}`)).toBe('open');
    cleanup();
    await renderPage([HOME_LINKED, CALLS, CALL]);
    expect(guide().querySelector('.phone-setup-guide__lines')).toBeTruthy();
  });

  test('a browser that refuses storage still shows the guide and toggles it', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await renderPage([HOME, CALLS, DMS, CALL]);
    fireEvent.click(within(guide()).getByRole('button', { name: /Setup/ }));
    expect(guide().querySelector('.phone-setup-guide__lines')).toBeTruthy();
  });

  test('Preview\'s Run runs the flow test from the home screen', async () => {
    const orphan = screenOf({ id: 'orphan', name: 'orphan', url: 'https://x/o.png', asset_id: 'a-o' });
    const dead = { ...HOME_LINKED, screen_links: [...HOME_LINKED.screen_links, zone('z-dead', { x: 60, target: 'gone', label: 'Gone' })] };
    await renderPage([dead, CALLS, orphan, CALL]);
    openGuide();
    fireEvent.click(within(guide()).getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(line('preview')).toBe('·Preview: 1 dead link, 1 screen not reached in the last flow test'));
    expect(within(guide()).queryByRole('button', { name: 'Run' })).toBeNull();
  });

  test('the Connect card\'s Flow Test result shows on the Preview line too', async () => {
    await renderPage([HOME_LINKED, CALLS, CALL]);
    fireEvent.click(within(guide()).getByRole('button', { name: /Setup/ }));
    fireEvent.click(stage('Connect'));
    const card = await waitFor(() => {
      const el = Array.from(document.querySelectorAll('.zones-tab__sidebar-card')).find(c => c.querySelector('.zones-flow__title'));
      expect(el).toBeTruthy();
      return el;
    });
    fireEvent.click(within(card).getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(line('preview')).toBe('·Preview: no issues in the last flow test'));
    expect(within(card).getByText(/Checked 2 screens, reached 2/)).toBeTruthy();
  });
});
