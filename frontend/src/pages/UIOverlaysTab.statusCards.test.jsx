/**
 * UIOverlaysTab — a screen card's "Continue →" opens the right stage on the
 * right screen (Task #2042, doctrine rule 18).
 *
 *   image    → Build, the screen's editor
 *   links    → Connect on that screen
 *   incoming → Connect on the home screen, where a link to it is placed
 *
 * The cards' lines come from the page's own screenDiagnostics.
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
// Home links to Calls, and has one zone with no destination.
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

function mockApi(screens) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `/api/v1/ui-overlays/${SHOW}`) return { data: { success: true, data: [...screens, CALL] } };
    return { data: { success: true, data: [], missions: [] } };
  });
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
  vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function renderPage(screens = [HOME, CALLS, MAIL, DMS]) {
  mockApi(screens);
  render(<UIOverlaysTab showId={SHOW} />);
  await waitFor(() => expect(document.querySelector('.phone-hub-screen-grid')).toBeTruthy());
}
const grid = () => within(document.querySelector('.phone-hub-screen-grid'));
const cardOf = (name) => grid().getByText(name).closest('.screen-card');
const continueOn = (name) => fireEvent.click(within(cardOf(name)).getByRole('button', { name: /Continue/ }));
const stage = (name) => within(document.querySelector('.phone-hub-stage-row')).getByRole('button', { name });
const connectScreen = () => document.querySelector('.zones-thumbnail.active .zones-thumbnail__label')?.textContent;

describe('UIOverlaysTab — status cards (Task #2042)', () => {
  test('cards read their state from the page\'s diagnostics', async () => {
    await renderPage();
    const home = within(cardOf('Homepage'));
    expect(home.getByText('Needs setup')).toBeTruthy();
    expect(home.getByText('⚠ 1 zone has no destination')).toBeTruthy();
    expect(home.queryByText('⚠ Nothing links here')).toBeNull();

    const calls = within(cardOf('calls list'));
    expect(calls.getByText('Ready')).toBeTruthy();
    expect(calls.getByText('✓ Image')).toBeTruthy();
    expect(calls.queryByRole('button', { name: /Continue/ })).toBeNull();

    expect(within(cardOf('mail inbox')).getByText('⚠ Nothing links here')).toBeTruthy();
    expect(within(cardOf('dm thread')).getByText('⚠ No image')).toBeTruthy();
  });

  test('links: Continue opens Connect on that screen', async () => {
    await renderPage();
    continueOn('Homepage');
    await waitFor(() => expect(stage('Connect').getAttribute('aria-current')).toBe('page'));
    await waitFor(() => expect(connectScreen()).toBe('Homepage'));
    expect(api.put).not.toHaveBeenCalled();
  });

  test('nothing links here: Continue opens Connect on the home screen', async () => {
    await renderPage();
    continueOn('mail inbox');
    await waitFor(() => expect(stage('Connect').getAttribute('aria-current')).toBe('page'));
    await waitFor(() => expect(connectScreen()).toBe('Homepage'));
  });

  test('no image: Continue opens the screen\'s editor in Build', async () => {
    await renderPage();
    continueOn('dm thread');
    await waitFor(() => expect(document.querySelector('.editor-modal')).toBeTruthy());
    expect(stage('Build').getAttribute('aria-current')).toBe('page');
    expect(within(document.querySelector('.editor-modal-header')).getByText('dm thread')).toBeTruthy();
  });

  test('Continue does not also select the card', async () => {
    await renderPage();
    continueOn('mail inbox');
    await waitFor(() => expect(connectScreen()).toBe('Homepage'));
    expect(document.querySelector('.editor-modal')).toBeNull();
  });
});
