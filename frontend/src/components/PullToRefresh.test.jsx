/**
 * Pull to refresh refreshes only on a real pull (Evoni, 2026-10-05: it
 * refreshed by accident while scrolling): the page at the top, nothing under
 * the finger scrolled, a mostly vertical drag, past THRESHOLD.
 */
import React from 'react';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import PullToRefresh, { THRESHOLD, scrolledAncestor } from './PullToRefresh';

let reload;
const realLocation = window.location;

beforeEach(() => {
  window.ontouchstart = null; // a touch device
  reload = vi.fn();
  Object.defineProperty(window, 'location', { configurable: true, value: { ...realLocation, reload } });
});
afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
  delete window.ontouchstart;
  document.body.innerHTML = '';
});

// A page with a panel of its own; the drag happens on a line inside it.
function setup({ panelScrollTop = 0 } = {}) {
  const panel = document.createElement('div');
  const line = document.createElement('p');
  panel.appendChild(line);
  document.body.appendChild(panel);
  Object.defineProperty(panel, 'scrollTop', { configurable: true, writable: true, value: panelScrollTop });
  render(<PullToRefresh />);
  return { panel, line };
}

const at = (x, y) => ({ touches: [{ clientX: x, clientY: y }] });
function drag(el, moves) {
  act(() => { fireEvent.touchStart(el, at(100, 0)); });
  for (const [x, y] of moves) act(() => { fireEvent.touchMove(el, at(x, y)); });
  act(() => { fireEvent.touchEnd(el, { touches: [] }); });
}
// Finger travel that reaches the threshold (the pull is damped by half).
const FAR = THRESHOLD * 2 + 20;

describe('PullToRefresh', () => {
  test('a long downward pull at the top with nothing scrolled refreshes', () => {
    const { line } = setup();
    drag(line, [[100, 40], [100, FAR]]);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  test('scrolling a scrolled-down panel back up never refreshes', () => {
    const { line } = setup({ panelScrollTop: 300 });
    drag(line, [[100, 40], [100, FAR]]);
    expect(reload).not.toHaveBeenCalled();
  });

  test('a panel that scrolls during the drag cancels the pull', () => {
    const { panel, line } = setup();
    act(() => { fireEvent.touchStart(line, at(100, 0)); });
    act(() => { fireEvent.touchMove(line, at(100, 40)); });
    panel.scrollTop = 12;
    act(() => { fireEvent.touchMove(line, at(100, FAR)); });
    act(() => { fireEvent.touchEnd(line, { touches: [] }); });
    expect(reload).not.toHaveBeenCalled();
  });

  test('a sideways swipe and a short pull do not refresh', () => {
    const { line } = setup();
    drag(line, [[160, 30], [300, FAR]]);
    expect(reload).not.toHaveBeenCalled();
    drag(line, [[100, 80], [100, 200]]); // 100 damped: under the threshold
    expect(reload).not.toHaveBeenCalled();
    expect(THRESHOLD).toBeGreaterThan(100);
  });

  test('scrolledAncestor sees a scrolled element above the target', () => {
    const { panel, line } = setup();
    expect(scrolledAncestor(line)).toBe(false);
    panel.scrollTop = 1;
    expect(scrolledAncestor(line)).toBe(true);
  });
});
