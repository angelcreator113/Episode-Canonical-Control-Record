/**
 * UIOverlaysTab — creating and renaming, pinned before "+ Add" asks what
 * you're adding (Task #2024, doctrine rules 17 and 18, step 1).
 *
 * Written on main and required to pass unchanged after the chooser lands.
 * The Add menu is reached by its trigger ("Add") and an item whose name
 * starts with "Screen" / "Icon" (main's "+ New Screen" / "+ New Icon", or the
 * chooser's options), so these tests pin what creating does, not the menu:
 * the create request carries the name and category and no key (the server
 * derives the key from the name), the new card takes the key the server
 * returns, a 409 names the existing item, and renaming sends only the name,
 * so the key never changes.
 */

import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

let hubScreens = [];
vi.mock('../components/PhoneHub', () => ({
  default: ({ screens = [], onEditScreen }) => {
    hubScreens = screens;
    return (
      <div data-testid="phone-hub">
        {screens.map((s) => (
          <button key={s.id} type="button" onClick={() => onEditScreen(s)}>{`edit-${s.id}`}</button>
        ))}
      </div>
    );
  },
}));
vi.mock('../components/phone-editor/MissionEditor', () => ({ default: () => null }));
vi.mock('../components/ContentZoneEditor', () => ({ default: () => null }));
vi.mock('../components/ScreenLinkEditor', () => ({ default: () => null }));
vi.mock('../components/PhonePreviewMode', () => ({ default: () => null, ScreenFlowMap: () => null }));

import api from '../services/api';
import UIOverlaysTab from './UIOverlaysTab';

const SHOW = 's-1';
const HOME = { id: 'home', name: 'Homepage', category: 'phone', generated: true, is_home: true, url: 'https://x/home.png', asset_id: 'a-home', screen_links: [], custom: true, custom_id: 't-home' };
const CALLS = { id: 'calls', name: 'Calls', category: 'phone', generated: true, url: 'https://x/calls.png', asset_id: 'a-calls', screen_links: [], custom: true, custom_id: 't-calls' };
const CALL = { id: 'call_icon', name: 'Call', category: 'phone_icon', generated: true, url: 'https://x/call.png', asset_id: 'a-call', opens_screen: 'calls', custom: true, custom_id: 't-call' };

function mockApi() {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `/api/v1/ui-overlays/${SHOW}`) return { data: { success: true, data: [HOME, CALLS, CALL] } };
    return { data: { success: true, data: [], missions: [] } };
  });
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
}

beforeEach(() => {
  vi.clearAllMocks();
  hubScreens = [];
  mockApi();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function renderPage() {
  render(<UIOverlaysTab showId={SHOW} />);
  await screen.findByText('edit-home');
}

// Opens "+ Add" and picks the item whose name starts with `kind`.
function chooseAdd(kind) {
  fireEvent.click(screen.getByRole('button', { name: /^\+?\s*Add$/ }));
  const menu = document.querySelector('.toolbar-menu__list');
  const item = within(menu).getAllByRole('button').find((b) => new RegExp(`^(\\+ New )?${kind}\\b`).test(b.textContent.trim()));
  fireEvent.click(item);
}

async function fillAndCreate(name) {
  const input = await screen.findByPlaceholderText(/e\.g\., /);
  fireEvent.change(input, { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: /^\s*Create/ }));
}

const typeCreates = () => vi.mocked(api.post).mock.calls.filter(([url]) => url === `/api/v1/ui-overlays/${SHOW}/types`);

describe('UIOverlaysTab — creating sends the name, the server derives the key, pinned (Task #2024)', () => {
  test('a new Screen is created with its name and no key, and its card takes the returned key', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: { id: 't-new', type_key: 'dm_thread', name: 'DM Thread', category: 'phone' } } });
    await renderPage();
    chooseAdd('Screen');
    await fillAndCreate('DM Thread');
    await waitFor(() => expect(typeCreates()).toHaveLength(1));
    const body = typeCreates()[0][1];
    expect(body).toMatchObject({ name: 'DM Thread', category: 'phone' });
    expect(body).not.toHaveProperty('type_key');
    await waitFor(() => expect(hubScreens.find((s) => s.id === 'dm_thread')).toMatchObject({ name: 'DM Thread', category: 'phone', custom_id: 't-new' }));
  });

  test('a new Icon is created as phone_icon with no key', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: { id: 't-cam', type_key: 'camera', name: 'Camera', category: 'phone_icon' } } });
    await renderPage();
    chooseAdd('Icon');
    await fillAndCreate('Camera');
    await waitFor(() => expect(typeCreates()).toHaveLength(1));
    const body = typeCreates()[0][1];
    expect(body).toMatchObject({ name: 'Camera', category: 'phone_icon' });
    expect(body).not.toHaveProperty('type_key');
    await waitFor(() => expect(hubScreens.find((s) => s.id === 'camera')).toMatchObject({ category: 'phone_icon' }));
  });

  test('a name already in use is refused with a message naming the existing item', async () => {
    vi.mocked(api.post).mockRejectedValue(Object.assign(new Error('conflict'), { response: { status: 409, data: {} } }));
    await renderPage();
    chooseAdd('Screen');
    await fillAndCreate('Calls');
    expect(await screen.findByText(/Name "Calls" is already in use by an existing screen/)).toBeTruthy();
  });
});

describe('UIOverlaysTab — renaming never changes the key, pinned (Task #2024)', () => {
  test('rename sends only the new name, and the item keeps its key', async () => {
    await renderPage();
    fireEvent.click(screen.getByText('edit-call_icon'));
    fireEvent.click(await screen.findByTitle('Click to rename'));
    const input = document.querySelector('.editor-modal-name-input');
    fireEvent.change(input, { target: { value: 'Phone' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(`/api/v1/ui-overlays/${SHOW}/types/t-call`, { name: 'Phone' }));
    await waitFor(() => expect(hubScreens.find((s) => s.id === 'call_icon')?.name).toBe('Phone'));
    expect(hubScreens.find((s) => s.name === 'Phone').id).toBe('call_icon');
  });
});
