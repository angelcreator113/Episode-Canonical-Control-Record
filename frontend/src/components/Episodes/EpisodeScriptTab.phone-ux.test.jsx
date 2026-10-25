/**
 * The Script page on a phone, and by keyboard (Script page audit,
 * 2026-10-19, measured at 375x812):
 * - the bottom bar's "+ Line" / "Phone" open the adder where it can be seen,
 *   and its first control takes focus;
 * - "Ready to film?" starts folded at phone width, and aria-controls always
 *   names an element;
 * - focus comes back to a line's row after its editor closes;
 * - History keeps Tab inside, closes on Escape from anywhere, and gives
 *   focus back to its button;
 * - a chosen beat whose id is gone falls back to the first beat;
 * - the scene picture, the DREAM Map and the Context sheet close on Escape;
 * - "Saved. Beat N is locked…" is not shown as an error.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));
vi.mock('../DreamMap', () => ({ default: () => <div data-testid="dream-map" /> }));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';

const SCRIPT = '## BEAT: 1 · Opening Ritual\nLala: Hi besties.\n\n## BEAT: 2 · Login Sequence\nLala: Logging in.';
const VID = '3f2a9c1e-0000-4000-8000-000000000001';
const renderTab = (script = SCRIPT) => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: script, script_locked_beats: [] }} show={{ id: 'show-1' }} /></MemoryRouter>,
);
const phoneWidth = () => vi.spyOn(window, 'matchMedia').mockImplementation((q) => ({ matches: q.includes('760'), media: q, addEventListener: () => {}, removeEventListener: () => {} }));

let scrolled;
beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  window.localStorage.clear();
  scrolled = [];
  Element.prototype.scrollIntoView = function scrollIntoView(opts) { scrolled.push({ el: this, opts }); };
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/episode-brief/ep-1/plan') {
      return { data: { data: [{ beat_number: 1, sceneSet: { name: 'The Ballroom', base_still_url: 'https://x/ballroom.png' } }] } };
    }
    if (url === '/api/v1/episodes/ep-1/script-versions') {
      return { data: { data: [{ id: VID, created_at: '2026-10-15T01:00:00Z', source: 'save', beats: 1, preview: 'Lala: Older.' }] } };
    }
    if (url === `/api/v1/episodes/ep-1/script-versions/${VID}`) {
      return { data: { data: { id: VID, created_at: '2026-10-15T01:00:00Z', source: 'save', beats: 1, script_content: '## BEAT: 1 · Opening Ritual\nLala: Older.' } } };
    }
    return { data: { data: [] } };
  });
});
afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); delete Element.prototype.scrollIntoView; });

describe('the bottom bar opens where it can be seen', () => {
  test('"+ Line" scrolls the adder to the middle and focuses its words', async () => {
    renderTab();
    fireEvent.click(screen.getByTestId('script-bar-line'));
    const adder = await screen.findByTestId('script-line-adder');
    await waitFor(() => expect(document.activeElement).toBe(within(adder).getByTestId('script-line-adder-text')));
    expect(scrolled.some((s) => s.el === adder && s.opts?.block === 'center')).toBe(true);
  });

  test('"Phone" scrolls the picker to the middle and focuses its first tile', async () => {
    renderTab();
    fireEvent.click(screen.getByTestId('script-bar-phone'));
    const picker = await screen.findByTestId('script-moment-picker');
    await waitFor(() => expect(document.activeElement).toBe(within(picker).getByTestId('script-pick-device-phone')));
    expect(scrolled.some((s) => s.el === picker && s.opts?.block === 'center')).toBe(true);
  });
});

describe('Ready to film?', () => {
  test('starts folded at phone width, even when it was left open', () => {
    window.localStorage.setItem('esp-health-collapsed', '0');
    phoneWidth();
    renderTab();
    const toggle = screen.getByTestId('script-health-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    const list = document.getElementById(toggle.getAttribute('aria-controls'));
    expect(list).not.toBeNull();
    expect(list.hidden).toBe(true);
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(list.hidden).toBe(false);
    expect(list.querySelectorAll('li').length).toBeGreaterThan(0);
  });

  // Folded at every width now, as Evoni's mockup has it (Script page audit 4, 2026-10-19).
  test('starts folded on a desktop too, and aria-controls names the list', () => {
    renderTab();
    const toggle = screen.getByTestId('script-health-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById(toggle.getAttribute('aria-controls'))).not.toBeNull();
  });
});

test("focus comes back to the line's row after Escape, Cancel and Save", async () => {
  renderTab();
  const row = () => within(screen.getByTestId('script-beat-1')).getByTestId('script-line');
  fireEvent.click(row());
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Edit line' }), { key: 'Escape' });
  await waitFor(() => expect(document.activeElement).toBe(row()));
  fireEvent.click(row());
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(document.activeElement).toBe(row()));
  fireEvent.click(row());
  fireEvent.change(screen.getByRole('textbox', { name: 'Edit line' }), { target: { value: 'Lala: Hello besties.' } });
  fireEvent.click(within(screen.getByTestId('script-beat-1')).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(document.activeElement).toBe(row()));
  expect(row().textContent).toContain('Hello besties.');
});

describe('History is a real modal', () => {
  test('Tab stays inside, Escape closes it from anywhere, focus goes back to History', async () => {
    renderTab();
    const opener = screen.getByTestId('script-history');
    opener.focus();
    fireEvent.click(opener);
    const panel = screen.getByTestId('script-history-panel');
    const item = await within(panel).findByTestId('script-history-item');
    const close = within(panel).getByRole('button', { name: 'Close' });
    // Tab from the last control goes round to the first, Shift+Tab back.
    item.focus();
    fireEvent.keyDown(item, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(item);
    // Focus fallen to the page: Tab comes back in, and Escape still closes.
    document.body.focus();
    fireEvent.keyDown(document.body, { key: 'Tab' });
    expect(panel.contains(document.activeElement)).toBe(true);
    document.body.focus();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('script-history-panel')).toBeNull());
    expect(document.activeElement).toBe(screen.getByTestId('script-history'));
  });
});

test('a chosen beat whose id is gone falls back to the first beat', () => {
  phoneWidth();
  renderTab();
  fireEvent.click(screen.getByTestId('script-pill-2'));
  expect(screen.getByTestId('script-beat-2').className).toContain('is-open');
  // Beat 2 is taken out in the raw editor.
  fireEvent.click(screen.getByRole('button', { name: 'Raw editor' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Raw script' }), { target: { value: '## BEAT: 1 · Opening Ritual\nLala: Hi besties.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Beat view' }));
  expect(screen.getByTestId('script-beat-1').className).toContain('is-open');
  expect(screen.getByTestId('script-pill-1').getAttribute('aria-current')).toBe('true');
});

describe('dialogs close on Escape, focus in and back', () => {
  test('the scene picture', async () => {
    renderTab();
    const picture = await screen.findByTestId('script-picture-1');
    picture.focus();
    fireEvent.click(picture);
    const zoom = screen.getByTestId('script-picture-zoom');
    await waitFor(() => expect(document.activeElement).toBe(within(zoom).getByRole('button', { name: 'Close' })));
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    expect(screen.queryByTestId('script-picture-zoom')).toBeNull();
    expect(document.activeElement).toBe(screen.getByTestId('script-picture-1'));
  });

  test('the DREAM Map, which is aria-modal', async () => {
    renderTab();
    const scene = await screen.findByRole('button', { name: /The Ballroom/ });
    // The scene link is beside the beat's head, not inside its role="button".
    expect(scene.closest('[role="button"]')).toBeNull();
    scene.focus();
    fireEvent.click(scene);
    const map = screen.getByRole('dialog', { name: 'DREAM Map' });
    expect(map.getAttribute('aria-modal')).toBe('true');
    await waitFor(() => expect(document.activeElement).toBe(within(map).getByRole('button', { name: 'Close map' })));
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'DREAM Map' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /The Ballroom/ }));
  });

  test("the phone's Context sheet", async () => {
    const { container } = renderTab();
    const bar = screen.getByTestId('script-bar-context');
    bar.focus();
    fireEvent.click(bar);
    expect(container.querySelector('.esp').className).toContain('is-context-open');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('script-context-close')));
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    expect(container.querySelector('.esp').className).not.toContain('is-context-open');
    expect(document.activeElement).toBe(screen.getByTestId('script-bar-context'));
  });

  test("Escape in a line's editor closes the editor, not the Context sheet", () => {
    const { container } = renderTab();
    fireEvent.click(screen.getByTestId('script-bar-context'));
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getByTestId('script-line'));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Edit line' }), { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'Edit line' })).toBeNull();
    expect(container.querySelector('.esp').className).toContain('is-context-open');
  });
});

describe('words and names', () => {
  test('"Saved. Beat N is locked…" is a success toast, not an error', async () => {
    vi.mocked(api.put).mockImplementation(async (_url, body) => ({ data: { data: { script_content: body.script_content }, locked_beats_kept: [1] } }));
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Raw editor' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Raw script' }), { target: { value: `${SCRIPT}\nLala: More.` } });
    fireEvent.click(within(screen.getByTestId('script-head')).getByRole('button', { name: 'Save' }));
    const toast = await screen.findByText(/^Saved\. Beat 1 is locked/);
    expect(toast.className).toContain('is-success');
    expect(toast.className).not.toContain('is-error');
  });

  test('the rewriting spinner is named "Rewriting…", and the pills are a list of buttons', async () => {
    let answer;
    vi.mocked(api.post).mockImplementation(() => new Promise((r) => { answer = r; }));
    renderTab();
    fireEvent.click(within(screen.getByTestId('script-beat-1')).getByRole('button', { name: /^Rewrite line:/ }));
    // The line's panel opens; its Rewrite asks (2026-10-25).
    fireEvent.click(screen.getByTestId('script-rewrite-go'));
    expect(await screen.findByRole('button', { name: 'Rewriting…' })).toBeTruthy();
    answer({ data: { rewrittenLine: 'Hello besties.' } });
    const pills = screen.getByTestId('script-pills');
    expect(pills.tagName).toBe('UL');
    expect(within(pills).getAllByRole('listitem')).toHaveLength(2);
    expect(within(pills).getAllByRole('listitem')[0].firstElementChild).toBe(screen.getByTestId('script-pill-1'));
    expect(screen.getByTestId('script-pill-1').getAttribute('role')).toBeNull();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Rewriting…' })).toBeNull());
  });
});
