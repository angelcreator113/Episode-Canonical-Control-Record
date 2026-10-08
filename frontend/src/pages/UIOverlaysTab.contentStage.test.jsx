/**
 * The Content stage (Evoni's mockup, 2026-10-08): "Live content" with what
 * this screen's areas show, "Add an area" kinds that the next drawn area
 * takes, and the other screens that have content.
 */

import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
vi.mock('../components/ScreenContentRenderer', () => ({ default: () => null, CONTENT_TYPE_MAP: { wardrobe_accessories: { label: 'Accessories' } } }));
vi.mock('../components/phone/PhoneMapView', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, default: () => null };
});
vi.mock('../components/phone-editor/AIAssistantPanel', () => ({ default: () => null }));
vi.mock('../components/phone-editor/AIProposalReview', () => ({ default: () => null }));
vi.mock('../components/phone-editor/MissionEditor', () => ({ default: () => null }));
// The editor stub shows the kind it was handed and can draw an area.
vi.mock('../components/ContentZoneEditor', async () => {
  const React = await import('react');
  return {
    default: React.forwardRef(function Stub({ armedType, onArmedUsed }, ref) {
      React.useImperativeHandle(ref, () => ({ isDirty: () => false, save: async () => true }));
      return (
        <div data-testid="content-editor" data-armed={armedType?.content_type || ''}>
          <button type="button" onClick={() => onArmedUsed?.()}>draw</button>
        </div>
      );
    }),
  };
});

import api from '../services/api';
import UIOverlaysTab from './UIOverlaysTab';

// jsdom has no PointerEvent; a MouseEvent-based stand-in keeps coordinates.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type, init = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; }
  }
  window.PointerEvent = PointerEventPolyfill;
}

const SHOW = 's-1';
const scr = (id, name, extra = {}) => ({ id, name, category: 'phone', generated: true, url: `https://x/${id}.png`, asset_id: `a-${id}`, show_id: SHOW, screen_links: [], ...extra });
const HOME = scr('home', 'Homepage', { is_home: true, content_zones: [{ id: 'c1', x: 0, y: 0, w: 100, h: 20, content_type: 'feed_posts', content_config: { max_items: 1 } }] });
const ACC = scr('acc', 'Accessories Page', { content_zones: [{ id: 'c2', x: 0, y: 0, w: 50, h: 20, content_type: 'wardrobe_accessories' }] });
const CAM = scr('cam', 'Camera');

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === `/api/v1/ui-overlays/${SHOW}`) return { data: { success: true, data: [HOME, ACC, CAM] } };
    return { data: { success: true, data: [], missions: [] } };
  });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function openContent() {
  render(<UIOverlaysTab showId={SHOW} />);
  await waitFor(() => expect(document.querySelector('.phone-hub-screen-grid')).toBeTruthy());
  fireEvent.click(within(document.querySelector('.phone-hub-stage-row')).getByRole('button', { name: 'Content' }));
  await waitFor(() => expect(screen.getByTestId('content-editor')).toBeTruthy());
}

describe("The Content stage (Evoni's mockup)", () => {
  test('says what the areas show, and which other screens have content', async () => {
    await openContent();
    expect(screen.getByText('Live content')).toBeTruthy();
    expect(screen.getByTestId('content-area-summary').textContent).toBe('1 area · Latest post');
    expect(screen.getByTestId('content-other-screens').textContent).toContain('Accessories Page 1');
  });

  test('a picked kind goes to the editor for the next area, then clears', async () => {
    await openContent();
    fireEvent.click(screen.getByTestId('content-kind-dm_thread'));
    expect(screen.getByTestId('content-editor').dataset.armed).toBe('dm_thread');
    expect(screen.getByText('Drag on the screen to place the DM thread')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'draw' }));
    await waitFor(() => expect(screen.getByTestId('content-editor').dataset.armed).toBe(''));
  });

  test('another screen with content opens from its link, and the pick is dropped', async () => {
    await openContent();
    fireEvent.click(screen.getByTestId('content-kind-dm_thread'));
    fireEvent.click(screen.getByRole('button', { name: 'Accessories Page 1' }));
    await waitFor(() => expect(document.querySelector('.zones-tab__sidebar-screen').textContent).toBe('Accessories Page'));
    expect(screen.getByTestId('content-editor').dataset.armed).toBe('');
  });
});
