/**
 * The Script page by keyboard, third pass (Script page audit 3, 2026-10-19,
 * measured at 375x812 with Playwright):
 * - Approve & lock keeps focus while the lock is on its way (aria-disabled,
 *   not disabled: a disabled button dropped focus to the page);
 * - an "Add:" chip shows its adder and focuses it, Escape closes it, and
 *   focus goes back to the chip; after Add, focus stays in the words;
 * - the phone's Context sheet is a modal dialog that keeps Tab inside;
 * - "Ready to film?" says "brand trust", a [STAT:] tag keeps its key.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));
vi.mock('../DreamMap', () => ({ default: () => <div data-testid="dream-map" /> }));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';
import { shownText } from './ScriptHealthPanel';

const SCRIPT = '## BEAT: 1 · Opening Ritual\nLala: Hi besties.\n\n## BEAT: 2 · Login Sequence\nLala: Logging in.';
const renderTab = (script = SCRIPT) => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: script, script_locked_beats: [] }} show={{ id: 'show-1' }} /></MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  window.localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
});
afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); delete Element.prototype.scrollIntoView; });

describe('Approve & lock keeps focus', () => {
  test('aria-disabled while the lock is on its way, and focus stays on it', async () => {
    let reply;
    vi.mocked(api.put).mockImplementation(() => new Promise((r) => { reply = r; }));
    renderTab();
    const lock = screen.getByTestId('script-lock-1');
    lock.focus();
    fireEvent.click(lock);
    await waitFor(() => expect(screen.getByTestId('script-lock-1').getAttribute('aria-disabled')).toBe('true'));
    expect(screen.getByTestId('script-lock-1').disabled).toBe(false);
    // A second press while locking sends nothing.
    fireEvent.click(screen.getByTestId('script-lock-1'));
    expect(api.put).toHaveBeenCalledTimes(1);
    await act(async () => { reply({ data: { data: { script_locked_beats: [1] } } }); });
    await waitFor(() => expect(screen.getByTestId('script-lock-1').textContent).toBe('Unlock'));
    expect(document.activeElement).toBe(screen.getByTestId('script-lock-1'));
  });
});

describe('the "Add:" chips', () => {
  test('Dialogue focuses the adder; Escape closes it and focus goes back to the chip', async () => {
    renderTab();
    const chip = screen.getByTestId('script-add-line-1');
    chip.focus();
    fireEvent.click(chip);
    const adder = await screen.findByTestId('script-line-adder');
    await waitFor(() => expect(document.activeElement).toBe(within(adder).getByTestId('script-line-adder-text')));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    fireEvent.keyDown(within(adder).getByTestId('script-line-adder-text'), { key: 'Escape' });
    expect(screen.queryByTestId('script-line-adder')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('script-add-line-1')));
  });

  test('Done also gives focus back to the chip', async () => {
    renderTab();
    fireEvent.click(screen.getByTestId('script-add-action-1'));
    fireEvent.click(await screen.findByTestId('script-line-adder-done'));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('script-add-action-1')));
  });

  test('after Add, focus stays in the words for the next line', async () => {
    renderTab();
    fireEvent.click(screen.getByTestId('script-add-line-1'));
    const text = await screen.findByTestId('script-line-adder-text');
    fireEvent.change(text, { target: { value: 'One more.' } });
    screen.getByTestId('script-line-adder-add').focus();
    fireEvent.click(screen.getByTestId('script-line-adder-add'));
    expect(document.activeElement).toBe(screen.getByTestId('script-line-adder-text'));
    expect(screen.getByTestId('script-line-adder-add').disabled).toBe(true);
  });

  test('Escape closes the notification adder too', async () => {
    renderTab();
    fireEvent.click(screen.getByTestId('script-add-notify-1'));
    const adder = await screen.findByTestId('script-message-adder-notify');
    fireEvent.keyDown(adder, { key: 'Escape' });
    expect(screen.queryByTestId('script-message-adder-notify')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('script-add-notify-1')));
  });
});

describe("the phone's Context sheet is a dialog", () => {
  test('role=dialog and aria-modal while open; Tab stays inside', async () => {
    renderTab();
    const side = screen.getByTestId('script-side');
    expect(side.getAttribute('role')).toBeNull();
    fireEvent.click(screen.getByTestId('script-bar-context'));
    expect(side.getAttribute('role')).toBe('dialog');
    expect(side.getAttribute('aria-modal')).toBe('true');
    const close = screen.getByTestId('script-context-close');
    await waitFor(() => expect(document.activeElement).toBe(close));
    // jsdom has no layout: every control counts as shown.
    const all = [...side.querySelectorAll('button, [href], input, select, textarea')];
    const last = all[all.length - 1];
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
    // From the page behind it, Tab comes back in.
    screen.getByTestId('script-history').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(side.getAttribute('role')).toBeNull();
  });
});

describe('"Ready to film?" in words', () => {
  test('brand_trust reads "brand trust"; a [STAT:] tag keeps its key', () => {
    expect(shownText("Beat 13: the runway's verdict doesn't move her brand_trust, stress: [STAT: brand_trust ±n] [STAT: stress ±n]."))
      .toBe("Beat 13: the runway's verdict doesn't move her brand trust, stress: [STAT: brand_trust ±n] [STAT: stress ±n].");
  });
});
