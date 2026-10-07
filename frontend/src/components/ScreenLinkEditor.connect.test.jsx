/**
 * Connect, embedded editor (Evoni, 2026-10-07: "start the rest of lalas
 * phone"). AI "Add zones" had its only button in the toolbar Connect never
 * shows, and the icon file input lived in the hidden list, so "Upload a
 * custom icon" did nothing. Both now work in Connect.
 */
import React, { createRef } from 'react';
import { vi, afterEach, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';

vi.mock('./ScreenContentRenderer', () => ({ default: () => null }));

import ScreenLinkEditor from './ScreenLinkEditor';

const SCREEN = { id: 'home', name: 'Homepage', url: 'https://x/home.png' };
const ZONE = { id: 'z1', x: 10, y: 20, w: 15, h: 10, target: 'dms', label: 'Messages', icon_url: null, icon_urls: [] };
// Constants: the editor resets its zones when `links` changes identity. No
// iconOverlays: the editor's own empty default must not loop either.
const ONE = [ZONE];
const NONE = [];

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

test('AI zones: the proposal opens for review, and Approve adds and saves the zones', async () => {
  const onSave = vi.fn();
  const proposed = { id: 'ai-1', x: 5, y: 70, w: 20, h: 10, target: 'chat', label: 'Chat' };
  const onRequestAiZones = vi.fn().mockResolvedValue({ proposal: { zones: [proposed] }, context_summary: { screen: 'Homepage' } });
  const ref = createRef();
  render(<ScreenLinkEditor ref={ref} screen={SCREEN} links={ONE} onSave={onSave} onRequestAiZones={onRequestAiZones} embedded />);
  let count;
  await act(async () => { count = await ref.current.requestAiZones('the chat app'); });
  expect(count).toBe(1);
  expect(onRequestAiZones).toHaveBeenCalledWith('the chat app');
  fireEvent.click(await screen.findByRole('button', { name: /Approve|Apply|Add/ }));
  expect(onSave).toHaveBeenCalledWith([ZONE, proposed]);
});

test('AI zones with nothing proposed opens no review', async () => {
  const ref = createRef();
  render(<ScreenLinkEditor ref={ref} screen={SCREEN} links={NONE} onSave={() => {}} onRequestAiZones={async () => ({ proposal: { zones: [] } })} embedded />);
  let count;
  await act(async () => { count = await ref.current.requestAiZones(); });
  expect(count).toBe(0);
  expect(screen.queryByRole('button', { name: /Approve/ })).toBeNull();
});

test('Upload a custom icon works in Connect: the file reaches onUploadIcon', async () => {
  const onUploadIcon = vi.fn().mockResolvedValue(undefined);
  const ref = createRef();
  render(<ScreenLinkEditor ref={ref} screen={SCREEN} links={ONE} onSave={() => {}} onUploadIcon={onUploadIcon} embedded />);
  const input = screen.getByTestId('zone-icon-file');
  const click = vi.spyOn(input, 'click');
  act(() => { ref.current.uploadIcon('z1'); });
  expect(click).toHaveBeenCalled();
  const file = new File(['x'], 'chat-icon.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(onUploadIcon).toHaveBeenCalledWith('z1', file));
});
