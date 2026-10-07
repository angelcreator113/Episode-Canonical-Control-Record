/**
 * UIOverlaysTab — "+ Add" asks what you're adding, and an icon shows its
 * background state (Task #2024, doctrine rules 17 and 18; I3).
 *
 * "+ Add" offers Screen, Icon or Content Area and nothing else; Batch Upload
 * and the phone frame are in "More". The create form shows the key the name
 * gets. Content Area asks which screen, then opens Content there; with no
 * screen to draw on it offers Screen. An icon's background reads Original,
 * Removing…, Removed or Failed (with the reason and a Retry); a screen shows
 * no state.
 */

import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

vi.mock('../components/PhoneHub', () => ({
  default: ({ screens = [], onEditScreen }) => (
    <div data-testid="phone-hub">
      {screens.map((s) => (
        <button key={s.id} type="button" onClick={() => onEditScreen(s)}>{`edit-${s.id}`}</button>
      ))}
    </div>
  ),
}));
vi.mock('../components/phone-editor/MissionEditor', () => ({ default: () => null }));
vi.mock('../components/ContentZoneEditor', () => ({
  default: ({ screen: s }) => <div data-testid="content-editor">{`content-on-${s?.id}`}</div>,
}));
vi.mock('../components/ScreenLinkEditor', () => ({ default: () => null }));
vi.mock('../components/PhonePreviewMode', () => ({ default: () => null, ScreenFlowMap: () => null }));

import api from '../services/api';
import UIOverlaysTab from './UIOverlaysTab';

const SHOW = 's-1';
const HOME = { id: 'home', name: 'Homepage', category: 'phone', generated: true, is_home: true, url: 'https://x/home.png', asset_id: 'a-home', screen_links: [] };
const CALLS = { id: 'calls', name: 'Calls', category: 'phone', generated: true, url: 'https://x/calls.png', asset_id: 'a-calls', screen_links: [] };
const CALL = { id: 'call_icon', name: 'Call', category: 'phone_icon', generated: true, url: 'https://x/call.png', asset_id: 'a-call', bg_removed: false };

let list;
function mockApi(initial, { afterRemoval } = {}) {
  list = initial;
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `/api/v1/ui-overlays/${SHOW}`) return { data: { success: true, data: list } };
    return { data: { success: true, data: [], missions: [] } };
  });
  vi.mocked(api.post).mockImplementation(async (url) => {
    if (String(url).includes('/remove-bg/')) {
      if (afterRemoval) list = afterRemoval(list);
      return { data: { success: true, data: {} } };
    }
    return { data: { success: true, data: {} } };
  });
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
}

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function renderPage() {
  render(<UIOverlaysTab showId={SHOW} />);
  await screen.findByTestId('phone-hub');
}
const openMenu = (label) => {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^\\+?\\s*${label}$`) }));
  return within(document.querySelector('.toolbar-menu__list'));
};
const option = (menu, label) => menu.getAllByRole('button').find((b) => b.querySelector('.overlays-add-chooser__label')?.textContent === label);

describe('"+ Add" asks what you\'re adding (Task #2024)', () => {
  test('it asks one question with three options, and nothing else', async () => {
    mockApi([HOME, CALLS, CALL]);
    await renderPage();
    const menu = openMenu('Add');
    expect(menu.getByText('What are you adding?')).toBeTruthy();
    const labels = menu.getAllByRole('button').map((b) => b.querySelector('.overlays-add-chooser__label')?.textContent);
    expect(labels).toEqual(['Screen', 'Icon', 'Content Area']);
    expect(menu.queryByText(/Upload Frame/)).toBeNull();
  });

  // Batch upload was removed (Evoni, 2026-10-07, Lala's Phone step 2).
  test('the frame is in "More"; batch upload is gone', async () => {
    mockApi([HOME, CALLS, CALL]);
    await renderPage();
    const more = openMenu('More');
    expect(more.queryByRole('button', { name: /Batch Upload/ })).toBeNull();
    expect(more.getByRole('button', { name: /Upload Frame/ })).toBeTruthy();
  });

  test('"More" opens with no screens generated, so the frame can be uploaded first', async () => {
    mockApi([{ ...HOME, generated: false, url: null }]);
    await renderPage();
    const more = openMenu('More');
    expect(more.getByRole('button', { name: /Upload Frame/ }).disabled).toBe(false);
    expect(more.getByRole('button', { name: /Flow Map/ }).disabled).toBe(true);
  });

  test('Screen and Icon open their create forms, which show the key the name gets', async () => {
    mockApi([HOME, CALLS, CALL]);
    await renderPage();
    fireEvent.click(option(openMenu('Add'), 'Screen'));
    expect(await screen.findByText('New Phone Screen')).toBeTruthy();
    expect(screen.queryByTestId('create-key')).toBeNull();
    fireEvent.change(screen.getByPlaceholderText(/e\.g\., Feed View/), { target: { value: 'DM Thread!' } });
    expect(screen.getByTestId('create-key').textContent).toBe("Key: dm_thread — can't be changed later");
    cleanup();

    mockApi([HOME, CALLS, CALL]);
    await renderPage();
    fireEvent.click(option(openMenu('Add'), 'Icon'));
    expect(await screen.findByText('New App Icon')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/e\.g\., Social Feed Icon/), { target: { value: 'Camera' } });
    expect(screen.getByTestId('create-key').textContent).toBe("Key: camera — can't be changed later");
  });

  test('Content Area asks which screen, starting from the current one, then opens Content there', async () => {
    mockApi([HOME, CALLS, CALL]);
    await renderPage();
    fireEvent.click(option(openMenu('Add'), 'Content Area'));
    const dialog = within(await screen.findByRole('dialog', { name: 'Add a content area' }));
    const select = dialog.getByLabelText('Which screen is it on?');
    expect(select.value).toBe('home');
    // Only screens with an image; icons are not offered.
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['home', 'calls']);
    fireEvent.change(select, { target: { value: 'calls' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Draw it in Content' }));
    expect(await screen.findByText('content-on-calls')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Add a content area' })).toBeNull();
    expect(document.querySelector('.phone-hub-stage-row .phone-hub-section-tab.active').textContent).toMatch(/Content/);
  });

  test('with no screen to draw on, Content Area offers Screen instead', async () => {
    mockApi([{ ...HOME, generated: false, url: null }, CALL]);
    await renderPage();
    fireEvent.click(option(openMenu('Add'), 'Content Area'));
    const dialog = within(await screen.findByRole('dialog', { name: 'Add a content area' }));
    expect(dialog.getByText(/no screen has an image yet/)).toBeTruthy();
    expect(dialog.queryByRole('button', { name: 'Draw it in Content' })).toBeNull();
    fireEvent.click(dialog.getByRole('button', { name: 'Add a Screen' }));
    expect(await screen.findByText('New Phone Screen')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Add a content area' })).toBeNull();
  });
});

describe('an icon shows its background state (Task #2024, I3)', () => {
  const bgState = () => screen.getByTestId('bg-state');
  // The words on the line, without the Retry button's label.
  const bgText = () => Array.from(bgState().childNodes).filter((n) => n.nodeName !== 'BUTTON').map((n) => n.textContent).join('');
  const hasRetry = () => !!within(bgState()).queryByRole('button', { name: 'Retry' });
  async function openCall() {
    await renderPage();
    fireEvent.click(screen.getByText('edit-call_icon'));
    await screen.findByTestId('bg-state');
  }

  test('Original, then Removing… while it runs, then Removed once the server shows it', async () => {
    mockApi([HOME, CALLS, CALL], { afterRemoval: (l) => l.map((o) => (o.id === 'call_icon' ? { ...o, bg_removed: true, url: 'https://x/call-nobg.png' } : o)) });
    let release;
    const gate = new Promise((r) => { release = r; });
    const realPost = vi.mocked(api.post).getMockImplementation();
    vi.mocked(api.post).mockImplementation(async (url, ...rest) => { await gate; return realPost(url, ...rest); });
    await openCall();
    expect(bgText()).toBe('Background: Original');
    fireEvent.click(screen.getByRole('button', { name: /Remove background/ }));
    await waitFor(() => expect(bgText()).toBe('Background: Removing…'));
    expect(screen.getByRole('button', { name: /Removing…/ }).disabled).toBe(true);
    release();
    await waitFor(() => expect(bgText()).toBe('Background: Removed'));
    expect(hasRetry()).toBe(false);
    expect(screen.getByText('Background removed')).toBeTruthy();
  });

  test('an icon already without its background reads Removed', async () => {
    mockApi([HOME, CALLS, { ...CALL, bg_removed: true }]);
    await openCall();
    expect(bgText()).toBe('Background: Removed');
  });

  test('a failure says why in plain words, and Retry runs it again', async () => {
    mockApi([HOME, CALLS, CALL], { afterRemoval: (l) => l.map((o) => (o.id === 'call_icon' ? { ...o, bg_removed: true } : o)) });
    const realPost = vi.mocked(api.post).getMockImplementation();
    vi.mocked(api.post).mockImplementationOnce(async () => {
      throw Object.assign(new Error('Request failed with status code 503'), { response: { status: 503, data: { error: 'Background removal not configured. Set REMOVEBG_API_KEY.' } } });
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await openCall();
    fireEvent.click(screen.getByRole('button', { name: /Remove background/ }));
    await waitFor(() => expect(bgText()).toBe("Background: Failed — Background removal isn't set up on this server"));
    expect(hasRetry()).toBe(true);
    vi.mocked(api.post).mockImplementation(realPost);
    fireEvent.click(within(bgState()).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(bgText()).toBe('Background: Removed'));
    const removals = vi.mocked(api.post).mock.calls.filter(([url]) => String(url).includes('/remove-bg/'));
    expect(removals.map(([url]) => url)).toEqual([`/api/v1/ui-overlays/${SHOW}/remove-bg/a-call`, `/api/v1/ui-overlays/${SHOW}/remove-bg/a-call`]);
  });

  test('another server error shows the server\'s own message', async () => {
    mockApi([HOME, CALLS, CALL]);
    vi.mocked(api.post).mockRejectedValueOnce(Object.assign(new Error('x'), { response: { status: 500, data: { error: 'remove.bg quota used up' } } }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await openCall();
    fireEvent.click(screen.getByRole('button', { name: /Remove background/ }));
    await waitFor(() => expect(bgText()).toBe('Background: Failed — remove.bg quota used up'));
    expect(hasRetry()).toBe(true);
  });

  test('a success the server doesn\'t confirm reads Failed, not Removed', async () => {
    mockApi([HOME, CALLS, CALL]);
    await openCall();
    fireEvent.click(screen.getByRole('button', { name: /Remove background/ }));
    await waitFor(() => expect(bgText()).toBe("Background: Failed — The server didn't report the background as removed"));
    expect(screen.queryByText('Background removed')).toBeNull();
  });

  test('a screen shows no background state', async () => {
    mockApi([HOME, CALLS, CALL]);
    await renderPage();
    fireEvent.click(screen.getByText('edit-calls'));
    expect(await screen.findByRole('button', { name: /Remove background/ })).toBeTruthy();
    expect(screen.queryByTestId('bg-state')).toBeNull();
  });
});
