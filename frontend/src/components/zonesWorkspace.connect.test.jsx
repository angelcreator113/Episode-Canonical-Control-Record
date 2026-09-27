/**
 * Zones workspace editors — the Connect repair (Task #2014, doctrine rules 17
 * and 18).
 *
 * TAP (ScreenLinkEditor): picking a library icon stores its key at once and
 * the zone draws that icon's current image, following an image change; a zone
 * with no icon keeps a dashed outline around its label.
 * ICON (IconPlacementMode): given a side panel, its picker renders there;
 * resizing keeps a zone inside the screen; unsaved changes are reported.
 */

import React, { createRef } from 'react';
import { vi, describe, afterEach, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';

vi.mock('./ScreenContentRenderer', () => ({ default: () => null }));
vi.mock('./phone-editor/AIProposalReview', () => ({ default: () => null }));

import ScreenLinkEditor from './ScreenLinkEditor';

// jsdom has no PointerEvent; a MouseEvent-based stand-in keeps coordinates.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type, init = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; }
  }
  window.PointerEvent = PointerEventPolyfill;
}

const SCREEN = { id: 'home', name: 'Homepage', url: 'https://x/home.png' };
const CALL = { id: 'call_icon', name: 'Call', category: 'phone_icon', url: 'https://x/call-v1.png' };
const plain = (over = {}) => ({ id: 'z1', x: 10, y: 20, w: 15, h: 10, target: 'calls', label: 'Phone', icon_url: null, icon_urls: [], ...over });

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const canvasZone = (id) => document.querySelector(`[data-zone-id="${id}"]`);

describe('ScreenLinkEditor — library icons by key (Task #2014)', () => {
  test('picking a library icon stores its key at once and draws it', () => {
    const onZonesChange = vi.fn();
    render(<ScreenLinkEditor screen={SCREEN} links={[plain()]} onSave={vi.fn()} onZonesChange={onZonesChange} iconOverlays={[CALL]} />);
    fireEvent.click(screen.getAllByText('Phone')[0]);
    expect(screen.getByText('No icon')).toBeTruthy();
    fireEvent.click(screen.getByTitle('Call'));
    const [zones, dirty] = onZonesChange.mock.calls.at(-1);
    expect(dirty).toBe(true);
    expect(zones[0]).toMatchObject({ icon_overlay_id: 'call_icon', icon_url: CALL.url, icon_urls: [CALL.url] });
    expect(screen.getByText('Icon: Call')).toBeTruthy();
    expect(canvasZone('z1').querySelector('img').getAttribute('src')).toBe(CALL.url);
  });

  test('once saved with its key, the zone follows the icon\'s image change', () => {
    const keyed = plain({ icon_overlay_id: 'call_icon', icon_url: CALL.url, icon_urls: [CALL.url] });
    const { rerender } = render(<ScreenLinkEditor screen={SCREEN} links={[keyed]} iconOverlays={[CALL]} onSave={vi.fn()} embedded />);
    expect(canvasZone('z1').querySelector('img').getAttribute('src')).toBe(CALL.url);
    rerender(<ScreenLinkEditor screen={SCREEN} links={[keyed]} iconOverlays={[{ ...CALL, url: 'https://x/call-v2.png' }]} onSave={vi.fn()} embedded />);
    expect(canvasZone('z1').querySelector('img').getAttribute('src')).toBe('https://x/call-v2.png');
  });

  test('picking the same icon again removes it', () => {
    const onZonesChange = vi.fn();
    render(<ScreenLinkEditor screen={SCREEN} links={[plain({ icon_overlay_id: 'call_icon', icon_url: CALL.url, icon_urls: [CALL.url] })]} iconOverlays={[CALL]} onSave={vi.fn()} onZonesChange={onZonesChange} />);
    fireEvent.click(screen.getAllByText('Phone')[0]);
    fireEvent.click(screen.getByTitle('Call'));
    const zone = onZonesChange.mock.calls.at(-1)[0][0];
    expect(zone.icon_overlay_id).toBeUndefined();
    expect(zone).toMatchObject({ icon_url: null, icon_urls: [] });
  });

  test('a zone with no icon keeps a dashed outline and its label; a zone with one does not', () => {
    render(<ScreenLinkEditor screen={SCREEN} links={[plain(), plain({ id: 'z2', label: 'Call', icon_overlay_id: 'call_icon', icon_url: CALL.url })]} iconOverlays={[CALL]} onSave={vi.fn()} embedded />);
    expect(canvasZone('z1').style.border).toContain('dashed');
    expect(within(canvasZone('z1')).getByText('Phone')).toBeTruthy();
    expect(canvasZone('z2').style.border).not.toContain('dashed');
    expect(canvasZone('z2').querySelector('img')).toBeTruthy();
  });

  test('a per-zone upload reads "Custom image"', () => {
    render(<ScreenLinkEditor screen={SCREEN} links={[plain({ icon_url: 'https://x/upload.png', icon_urls: ['https://x/upload.png'] })]} iconOverlays={[CALL]} onSave={vi.fn()} />);
    fireEvent.click(screen.getAllByText('Phone')[0]);
    expect(screen.getByText('Custom image')).toBeTruthy();
  });
});

// Task #2021 (one Connect editor) deleted IconPlacementMode. Its two cases
// here now run against the one editor: the picker still opens in the side
// panel, and resizing still keeps a zone inside (the row's Width / Height;
// the workspace's own control is tested in UIOverlaysTab.connectEditor).
describe('Icon placement — beside the phone, and kept inside (Task #2014; one editor since Task #2021)', () => {
  test('with a side panel, the picker renders there, not under the phone', () => {
    const side = document.createElement('div');
    document.body.appendChild(side);
    const { container } = render(<ScreenLinkEditor screen={SCREEN} links={[]} iconOverlays={[CALL]} onSave={vi.fn()} screenTypes={[]} sidePanel={side} embedded />);
    const surface = container.querySelector('[style*="crosshair"]');
    fireEvent.pointerDown(surface, { pointerId: 1, clientX: 50, clientY: 50 });
    fireEvent.pointerUp(surface, { pointerId: 1, clientX: 50, clientY: 50 });
    expect(within(side).getByText('PICK AN ICON + WHERE IT OPENS')).toBeTruthy();
    expect(within(container).queryByText('PICK AN ICON + WHERE IT OPENS')).toBeNull();
    fireEvent.click(within(side).getByTitle('Call'));
    expect(within(side).queryByText('PICK AN ICON + WHERE IT OPENS')).toBeNull();
    side.remove();
  });

  test('widening a zone near the edge keeps it inside, and reports unsaved changes', () => {
    const onSave = vi.fn();
    const onZonesChange = vi.fn();
    const ZONE = plain({ id: 'i1', x: 85, y: 88, w: 10, h: 9, label: 'Edge' });
    render(<ScreenLinkEditor screen={SCREEN} links={[ZONE]} iconOverlays={[CALL]} onSave={onSave} onZonesChange={onZonesChange} />);
    fireEvent.click(screen.getAllByText('Edge')[0]);
    const width = screen.getByText('W').closest('div').parentElement.querySelector('input[type="range"]');
    fireEvent.change(width, { target: { value: '30' } });
    const [zones, dirty] = onZonesChange.mock.calls.at(-1);
    expect(dirty).toBe(true);
    expect(zones[0].x + zones[0].w).toBeLessThanOrEqual(100);
  });
});
