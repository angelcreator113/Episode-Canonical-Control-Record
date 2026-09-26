/**
 * UIOverlaysTab — asset changes never touch placements (Task #2005, doctrine rule 17).
 *
 * Change image, Generate and Remove BG each give an icon a new image address.
 * None of them may create, delete, move or rewrite a zone, and none may place
 * the icon: the only request that writes zones is the screen-links PUT, so the
 * test asserts it is never sent. PhoneHub is stubbed to a button that opens
 * the icon's editor the way its card menu does.
 */

import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

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
// Heavy panels not under test.
vi.mock('../components/phone-editor/AIAssistantPanel', () => ({ default: () => null }));
vi.mock('../components/phone-editor/AIProposalReview', () => ({ default: () => null }));
vi.mock('../components/phone-editor/MissionEditor', () => ({ default: () => null }));
vi.mock('../components/ContentZoneEditor', () => ({ default: () => null }));
vi.mock('../components/ScreenLinkEditor', () => ({ default: () => null }));
vi.mock('../components/IconPlacementMode', () => ({ default: () => null }));
vi.mock('../components/PhonePreviewMode', () => ({ default: () => null, ScreenFlowMap: () => null }));

import api from '../services/api';
import UIOverlaysTab from './UIOverlaysTab';

const SHOW = 's-1';
const HOME_ZONES = [
  { id: 'z-call', x: 8, y: 14, w: 12, h: 9, target: 'calls', label: 'Call', icon_url: 'https://x/call-v1.png', icon_overlay_id: 'call_icon' },
];
const HOME = { id: 'home', name: 'Homepage', category: 'phone', generated: true, is_home: true, url: 'https://x/home.png', asset_id: 'a-home', screen_links: HOME_ZONES };
const CALLS = { id: 'calls', name: 'calls list', category: 'phone', generated: true, url: 'https://x/calls.png', asset_id: 'a-calls', screen_links: [] };
const CALL = { id: 'call_icon', name: 'Call', category: 'phone_icon', generated: true, url: 'https://x/call-v1.png', asset_id: 'a-call', opens_screen: 'calls', custom: true, custom_id: 't-call' };

let listCalls = 0;
function mockApi() {
  listCalls = 0;
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `/api/v1/ui-overlays/${SHOW}`) {
      listCalls += 1;
      // After the first load, the icon has a new image (new address), as the
      // server returns after Change image / Generate / Remove BG.
      const call = listCalls > 1 ? { ...CALL, url: 'https://x/call-v2.png', asset_id: 'a-call-2' } : CALL;
      return { data: { success: true, data: [HOME, CALLS, call] } };
    }
    return { data: { success: true, data: [], missions: [] } };
  });
  vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: {} } });
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
}

function zoneWrites() {
  return vi.mocked(api.put).mock.calls.filter(([url]) => String(url).includes('/screen-links/'));
}

async function openCallEditor() {
  render(<UIOverlaysTab showId={SHOW} />);
  fireEvent.click(await screen.findByText('edit-call_icon'));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('UIOverlaysTab — asset changes never touch placements (Task #2005)', () => {
  test('Generate posts the generation and writes no zone', async () => {
    await openCallEditor();
    fireEvent.click(await screen.findByRole('button', { name: /^\s*Generate\s*$/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/api/v1/ui-overlays/${SHOW}/generate/call_icon`, {}));
    await waitFor(() => expect(listCalls).toBeGreaterThan(1));
    expect(zoneWrites()).toEqual([]);
  });

  test('Remove BG posts the removal and writes no zone', async () => {
    await openCallEditor();
    fireEvent.click(await screen.findByRole('button', { name: /Remove BG/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/api/v1/ui-overlays/${SHOW}/remove-bg/a-call`));
    await waitFor(() => expect(listCalls).toBeGreaterThan(1));
    expect(zoneWrites()).toEqual([]);
  });

  test('Change image uploads the file and writes no zone', async () => {
    await openCallEditor();
    let fileInput = null;
    const realClick = HTMLInputElement.prototype.click;
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function click() {
      if (this.type === 'file') { fileInput = this; return; }
      return realClick.call(this);
    });
    fireEvent.click(await screen.findByRole('button', { name: /Upload/ }));
    expect(fileInput).not.toBeNull();
    const file = new File(['png'], 'call.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/api/v1/ui-overlays/${SHOW}/upload/call_icon`, expect.any(FormData)));
    await waitFor(() => expect(listCalls).toBeGreaterThan(1));
    expect(zoneWrites()).toEqual([]);
  });
});
