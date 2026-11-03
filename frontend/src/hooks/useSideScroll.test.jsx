/** A tab row that slides sideways with a mouse drag or the wheel, and still clicks (Evoni, 2026-11-03). */
import React from 'react';
import { vi, describe, test, expect } from 'vitest';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import useSideScroll, { sideEdges } from './useSideScroll';

if (typeof window.PointerEvent === 'undefined') {
  window.PointerEvent = class PointerEvent extends window.MouseEvent {
    constructor(type, init = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; this.pointerType = init.pointerType ?? 'mouse'; }
  };
}

/** jsdom lays nothing out: give the row a width, a content width and a real scrollLeft. */
function sized(el, { client = 300, content = 900 } = {}) {
  if (el.dataset.sized) return; // a re-render attaches the same element again
  el.dataset.sized = '1';
  let left = 0;
  Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => client });
  Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => content });
  Object.defineProperty(el, 'scrollLeft', {
    configurable: true,
    get: () => left,
    set: (v) => { left = Math.max(0, Math.min(content - client, v)); el.dispatchEvent(new Event('scroll')); },
  });
}

function Row({ onPick, size }) {
  const [ref, , className] = useSideScroll();
  const attach = (el) => { if (el && size) sized(el, size); ref(el); };
  return (
    <div data-testid="row" ref={attach} className={className}>
      {['Wardrobe', 'Phone', 'Money', 'Scenes'].map((t) => <button key={t} type="button" onClick={() => onPick(t)}>{t}</button>)}
    </div>
  );
}

describe('useSideScroll', () => {
  test('the edges say where there is more', () => {
    expect(sideEdges({ scrollLeft: 0, scrollWidth: 900, clientWidth: 300 })).toEqual({ left: false, right: true });
    expect(sideEdges({ scrollLeft: 300, scrollWidth: 900, clientWidth: 300 })).toEqual({ left: true, right: true });
    expect(sideEdges({ scrollLeft: 600, scrollWidth: 900, clientWidth: 300 })).toEqual({ left: true, right: false });
    expect(sideEdges({ scrollLeft: 0, scrollWidth: 300, clientWidth: 300 })).toEqual({ left: false, right: false });
  });

  test('a mouse drag slides the row and does not pick the tab it ends on; a press without a drag still picks', async () => {
    const onPick = vi.fn();
    const { getByTestId, getByText } = render(<Row onPick={onPick} size={{}} />);
    const row = getByTestId('row');
    await waitFor(() => expect(row.className).toBe('side-scroll can-right'));
    fireEvent.pointerDown(getByText('Phone'), { button: 0, clientX: 200, pointerType: 'mouse' });
    fireEvent.pointerMove(window, { clientX: 80, pointerType: 'mouse' });
    expect(row.scrollLeft).toBe(120);
    fireEvent.pointerUp(window, { clientX: 80, pointerType: 'mouse' });
    fireEvent.click(getByText('Phone'));
    expect(onPick).not.toHaveBeenCalled();
    expect(row.className).toBe('side-scroll can-left can-right');

    fireEvent.pointerDown(getByText('Money'), { button: 0, clientX: 100, pointerType: 'mouse' });
    fireEvent.pointerMove(window, { clientX: 102, pointerType: 'mouse' });
    fireEvent.pointerUp(window, { clientX: 102, pointerType: 'mouse' });
    fireEvent.click(getByText('Money'));
    expect(onPick).toHaveBeenCalledWith('Money');
    expect(row.scrollLeft).toBe(120);
  });

  test('a drag let go outside the row does not eat the next click (a key press on a tab)', async () => {
    const onPick = vi.fn();
    const { getByText } = render(<Row onPick={onPick} size={{}} />);
    fireEvent.pointerDown(getByText('Phone'), { button: 0, clientX: 200, pointerType: 'mouse' });
    fireEvent.pointerMove(window, { clientX: 40, pointerType: 'mouse' });
    fireEvent.pointerUp(window, { clientX: 40, pointerType: 'mouse' }); // outside: no click follows
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.click(getByText('Wardrobe'));
    expect(onPick).toHaveBeenCalledWith('Wardrobe');
  });

  test('the wheel slides the row while it can move, then leaves the wheel to the page', () => {
    const { getByTestId } = render(<Row onPick={() => {}} size={{}} />);
    const row = getByTestId('row');
    const wheel = (deltaY) => {
      const e = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
      act(() => { row.dispatchEvent(e); });
      return e.defaultPrevented;
    };
    expect(wheel(250)).toBe(true);
    expect(row.scrollLeft).toBe(250);
    expect(wheel(1000)).toBe(true);
    expect(row.scrollLeft).toBe(600);
    expect(wheel(100)).toBe(false); // at its end: the page scrolls
    expect(row.className).toBe('side-scroll can-left');
  });

  test('a row that fits is left alone: no fade, the wheel scrolls the page, a drag is a click', async () => {
    const onPick = vi.fn();
    const { getByTestId, getByText } = render(<Row onPick={onPick} size={{ client: 900, content: 900 }} />);
    const row = getByTestId('row');
    await new Promise((r) => setTimeout(r, 5));
    expect(row.className).toBe('side-scroll');
    const e = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
    row.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
    fireEvent.pointerDown(getByText('Phone'), { button: 0, clientX: 200, pointerType: 'mouse' });
    fireEvent.pointerMove(window, { clientX: 80, pointerType: 'mouse' });
    fireEvent.pointerUp(window, { clientX: 80, pointerType: 'mouse' });
    fireEvent.click(getByText('Phone'));
    expect(onPick).toHaveBeenCalledWith('Phone');
  });
});
