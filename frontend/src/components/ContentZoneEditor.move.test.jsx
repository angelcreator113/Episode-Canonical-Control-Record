/**
 * Lala's Phone audit (Evoni, 2026-10-07): a content area could be drawn but
 * never moved. Dragging it moves it, inside the screen.
 */
import React from 'react';
import { vi, test, expect, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })), post: vi.fn(), put: vi.fn() } }));
import ContentZoneEditor from './ContentZoneEditor';

const ZONE = { id: 'c1', content_type: '', x: 10, y: 10, w: 30, h: 20 };
const ZONES = [ZONE];

// jsdom has no PointerEvent, so pointer events would carry no coordinates.
if (!window.PointerEvent) {
  window.PointerEvent = class PointerEvent extends MouseEvent {
    constructor(type, init = {}) { super(type, init); this.pointerId = init.pointerId; }
  };
}

afterEach(() => vi.restoreAllMocks());

test('dragging a content area moves it and keeps it on the screen', () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 200, height: 400, right: 200, bottom: 400, x: 0, y: 0 });
  const onSave = vi.fn();
  render(<ContentZoneEditor screenUrl="https://img/s.png" screen={{ id: 's1' }} zones={ZONES} onSave={onSave} />);
  const area = screen.getByTestId('content-zone-c1');
  fireEvent.pointerDown(area, { clientX: 40, clientY: 60, pointerId: 1 });   // 20%, 15%
  fireEvent.pointerMove(area, { clientX: 80, clientY: 100, pointerId: 1 });  // +20%, +10%
  fireEvent.pointerUp(area, { clientX: 80, clientY: 100, pointerId: 1 });
  expect(area.style.left).toBe('30%');
  expect(area.style.top).toBe('20%');

  fireEvent.pointerDown(area, { clientX: 80, clientY: 100, pointerId: 1 });
  fireEvent.pointerMove(area, { clientX: 400, clientY: 900, pointerId: 1 }); // far off the screen
  fireEvent.pointerUp(area, { clientX: 400, clientY: 900, pointerId: 1 });
  expect(area.style.left).toBe('70%');  // 100 - w
  expect(area.style.top).toBe('80%');   // 100 - h

  fireEvent.click(screen.getByRole('button', { name: /Save/ }));
  expect(onSave.mock.calls[0][0]).toEqual([{ ...ZONE, x: 70, y: 80 }]);
});
