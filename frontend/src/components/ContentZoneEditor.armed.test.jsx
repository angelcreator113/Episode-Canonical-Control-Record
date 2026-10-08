/**
 * Content's "Add an area" (Evoni's mockup, 2026-10-08): the next area drawn
 * gets the picked kind, and the pick is used up.
 */
import React from 'react';
import { vi, test, expect, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })), post: vi.fn(), put: vi.fn() } }));
import ContentZoneEditor from './ContentZoneEditor';

if (!window.PointerEvent) {
  window.PointerEvent = class PointerEvent extends MouseEvent {
    constructor(type, init = {}) { super(type, init); this.pointerId = init.pointerId; }
  };
}
afterEach(() => vi.restoreAllMocks());

test('an area drawn while a kind is picked takes that kind', () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 });
  const onSave = vi.fn();
  const onArmedUsed = vi.fn();
  const { container } = render(
    <ContentZoneEditor screenUrl="https://img/s.png" screen={{ id: 's1' }} zones={[]} onSave={onSave}
      armedType={{ content_type: 'feed_posts', content_config: { max_items: 1 } }} onArmedUsed={onArmedUsed} />,
  );
  const surface = container.querySelector('[style*="crosshair"]');
  fireEvent.pointerDown(surface, { clientX: 10, clientY: 10, pointerId: 1 });
  fireEvent.pointerMove(surface, { clientX: 60, clientY: 30, pointerId: 1 });
  fireEvent.pointerUp(surface, { clientX: 60, clientY: 30, pointerId: 1 });
  expect(onArmedUsed).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: /Save/ }));
  expect(onSave.mock.calls[0][0]).toEqual([expect.objectContaining({ content_type: 'feed_posts', content_config: { max_items: 1 }, x: 10, y: 10, w: 50, h: 20 })]);
});
