/**
 * Task #2783 (Evoni, 2026-10-09): on a phone, tapping in the Script tab
 * jumped the page. Opening a beat closes the open beat above it, so the
 * tapped beat moved up by that beat's height. The tab now scrolls the page
 * back so the tapped beat stays where it was on screen.
 *
 * jsdom has no layout, so each beat's top is computed from the DOM: 60px per
 * beat head, plus 300px for every open beat above it.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';

const SCRIPT = '## BEAT: 1 · Opening Ritual\nLala: Hi besties.\n\n## BEAT: 2 · Login Sequence\nLala: Logging in.\n\n## BEAT: 3 · Welcome\nLala: Welcome.\n';

let scroller;
let realRect;

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
  scroller = document.scrollingElement || document.documentElement;
  scroller.scrollTop = 0;
  let scrollTop = 0;
  Object.defineProperty(scroller, 'scrollTop', { configurable: true, get: () => scrollTop, set: (v) => { scrollTop = v; } });
  realRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function rect() {
    if (!this.classList?.contains('esp-beat')) return realRect.call(this);
    const beats = [...document.querySelectorAll('.esp-beat')];
    const at = beats.indexOf(this);
    const openAbove = beats.slice(0, at).filter((b) => b.classList.contains('is-open')).length;
    const top = 200 + at * 60 + openAbove * 300 - scroller.scrollTop;
    return { top, bottom: top + 60, left: 0, right: 375, width: 375, height: 60, x: 0, y: top };
  };
});

afterEach(() => {
  Element.prototype.getBoundingClientRect = realRect;
  delete scroller.scrollTop;
});

const renderTab = () => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT, script_locked_beats: [] }} show={{ id: 'show-1' }} /></MemoryRouter>,
);
const head = (n) => screen.getByTestId(`script-beat-${n}`).querySelector('.esp-beat-head');

describe('Script tab keeps the tapped beat in place', () => {
  test('opening a beat below the open one leaves the tapped beat where it was', () => {
    renderTab();
    scroller.scrollTop = 400; // beat 3 on screen at 200 + 120 + 300 - 400 = 220
    const before = screen.getByTestId('script-beat-3').getBoundingClientRect().top;
    fireEvent.click(head(3));
    expect(screen.getByTestId('script-beat-3').className).toContain('is-open');
    expect(screen.getByTestId('script-beat-1').className).not.toContain('is-open');
    expect(screen.getByTestId('script-beat-3').getBoundingClientRect().top).toBe(before);
    expect(scroller.scrollTop).toBe(100); // the 300px collapse above, scrolled back
  });

  test('closing the open beat itself does not scroll', () => {
    renderTab();
    scroller.scrollTop = 100;
    fireEvent.click(head(1));
    expect(screen.getByTestId('script-beat-1').className).not.toContain('is-open');
    expect(scroller.scrollTop).toBe(100);
  });
});
