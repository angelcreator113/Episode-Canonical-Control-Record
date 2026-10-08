/**
 * Zones workspace — behaviour that must survive the Connect repair (Task
 * #2014, doctrine rules 17 and 18), pinned on main before the change.
 *
 * TAP editor (ScreenLinkEditor): saving writes the zones in the same
 * screen_links shape, and a zone's target, label, conditions and actions are
 * kept on save; a per-zone custom icon upload reaches onUploadIcon.
 * ICON mode (IconPlacementMode): tapping the screen and picking an icon still
 * creates a zone, saved with its icon.
 *
 * Task #2021 (one Connect editor) deleted IconPlacementMode; its case here now
 * runs against the one editor, ScreenLinkEditor, where a tap on an empty spot
 * opens the same picker. The expectation is unchanged.
 */

import React, { createRef } from 'react';
import { vi, describe, afterEach, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

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
const CALL = { id: 'call_icon', name: 'Call', category: 'phone_icon', url: 'https://x/call.png' };
const ZONES = [
  {
    id: 'z1', x: 10, y: 20, w: 15, h: 10, target: 'calls', label: 'Call',
    icon_url: 'https://x/custom.png', icon_urls: ['https://x/custom.png'],
    conditions: [{ key: 'met_lala', op: 'eq', value: true }],
    actions: [{ type: 'set_state', key: 'called', value: true }],
    persistent: true,
  },
  { id: 'z2', x: 40, y: 20, w: 15, h: 10, target: 'dms', label: 'Messages', icon_url: null, icon_urls: [] },
];

beforeEach(() => {
  // jsdom has no layout; give every element a 100×100 box so taps map 1:1 to percentages.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ScreenLinkEditor — pinned (Task #2014)', () => {
  test('saving writes the zones in the same shape, every field kept', () => {
    const onSave = vi.fn();
    const ref = createRef();
    render(<ScreenLinkEditor ref={ref} screen={SCREEN} links={ZONES} iconOverlays={[CALL]} onSave={onSave} embedded />);
    act(() => { ref.current.save(); });
    expect(onSave).toHaveBeenCalledWith(ZONES, SCREEN);
  });

  test('editing a label keeps the zone\'s target, conditions, actions and icon on save', () => {
    const onSave = vi.fn();
    const ref = createRef();
    render(<ScreenLinkEditor ref={ref} screen={SCREEN} links={ZONES} iconOverlays={[CALL]} onSave={onSave} embedded />);
    act(() => { ref.current.updateZone('z1', { label: 'Phone' }); });
    act(() => { ref.current.save(); });
    const saved = onSave.mock.calls[0][0];
    expect(saved[0]).toEqual({ ...ZONES[0], label: 'Phone' });
    expect(saved[1]).toEqual(ZONES[1]);
  });

  test('a per-zone custom icon upload reaches onUploadIcon with the zone id and file', async () => {
    const onUploadIcon = vi.fn().mockResolvedValue(undefined);
    let fileInput = null;
    const realClick = HTMLInputElement.prototype.click;
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function click() {
      if (this.type === 'file') { fileInput = this; return; }
      return realClick.call(this);
    });
    render(<ScreenLinkEditor screen={SCREEN} links={ZONES} iconOverlays={[CALL]} onSave={vi.fn()} onUploadIcon={onUploadIcon} />);
    fireEvent.click(screen.getAllByText('Messages')[0]);
    fireEvent.click(screen.getByTitle('Upload a custom icon'));
    expect(fileInput).not.toBeNull();
    const file = new File(['png'], 'star.png', { type: 'image/png' });
    await act(async () => { fireEvent.change(fileInput, { target: { files: [file] } }); });
    expect(onUploadIcon).toHaveBeenCalledWith('z2', file);
  });
});

describe('Icon placement — pinned (Task #2014; one editor since Task #2021)', () => {
  test('tapping the screen and picking an icon creates a zone, saved with its icon', () => {
    const onSave = vi.fn();
    const ref = createRef();
    render(<ScreenLinkEditor ref={ref} screen={SCREEN} links={[]} iconOverlays={[CALL]} onSave={onSave} screenTypes={[]} embedded />);
    const surface = document.querySelector('[style*="crosshair"]');
    fireEvent.pointerDown(surface, { pointerId: 1, clientX: 50, clientY: 50 });
    fireEvent.pointerUp(surface, { pointerId: 1, clientX: 50, clientY: 50 });
    fireEvent.click(screen.getByTitle('Call'));
    act(() => { ref.current.save(); });
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ label: 'Call', icon_url: CALL.url, icon_overlay_id: 'call_icon', target: '' });
    for (const k of ['x', 'y', 'w', 'h']) expect(typeof saved[0][k]).toBe('number');
  });
});
