/**
 * The orientation strip at the top of a LalaVerse hub tab (2026-10-04):
 * three lines (what it is, who reads it, what to do here), dismissed per
 * tab and remembered in this browser, brought back by its Guide link; a
 * blocked localStorage never breaks it.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TabOrientation from './TabOrientation';
import { ORIENTATION } from '../pages/lalaverseOrientation';

const props = { id: 'world', ...ORIENTATION.world };

beforeEach(() => { window.localStorage.clear(); });

describe('TabOrientation', () => {
  test('shows the three lines and dismisses with Got it, remembered per tab', () => {
    const { unmount } = render(<TabOrientation {...props} />);
    const strip = screen.getByTestId('orientation-world');
    expect(strip.textContent).toContain(ORIENTATION.world.what);
    expect(strip.textContent).toContain(ORIENTATION.world.reads);
    expect(strip.textContent).toContain(ORIENTATION.world.doHere);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss this guide' }));
    expect(screen.queryByTestId('orientation-world')).toBeNull();
    expect(window.localStorage.getItem('lalaverse.orientation.world.dismissed')).toBe('1');
    unmount();
    // A fresh mount of the same tab stays dismissed; another tab does not.
    render(<TabOrientation {...props} />);
    expect(screen.queryByTestId('orientation-world')).toBeNull();
    render(<TabOrientation id="culture" {...ORIENTATION.culture} />);
    expect(screen.getByTestId('orientation-culture')).toBeTruthy();
  });

  test('the Guide link brings a dismissed strip back', () => {
    window.localStorage.setItem('lalaverse.orientation.world.dismissed', '1');
    render(<TabOrientation {...props} />);
    fireEvent.click(screen.getByRole('button', { name: `Guide: ${ORIENTATION.world.title}` }));
    expect(screen.getByTestId('orientation-world')).toBeTruthy();
    expect(window.localStorage.getItem('lalaverse.orientation.world.dismissed')).toBeNull();
  });

  test('a blocked localStorage is logged, not fatal', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<TabOrientation {...props} />);
    expect(screen.getByTestId('orientation-world')).toBeTruthy();
    getItem.mockRestore(); spy.mockRestore();
  });

  test('every hub tab has its three lines', () => {
    for (const key of ['overview', 'bible', 'world', 'society', 'culture', 'state']) {
      for (const field of ['title', 'what', 'reads', 'doHere']) expect(ORIENTATION[key][field].length, `${key}.${field}`).toBeGreaterThan(20);
    }
  });
});
