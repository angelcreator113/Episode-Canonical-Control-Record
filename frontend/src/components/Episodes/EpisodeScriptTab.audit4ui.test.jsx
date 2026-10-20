/**
 * Script page audit 4, on screen (2026-10-19): nothing hides under the
 * episode's sticky header, focus stays on a line after it is edited, the open
 * beat's head doesn't fold it beside the beat list, "Ready to film?" starts
 * folded, beat 14's opportunity is optional, a [WEAR] cue names its piece,
 * the line count matches the numbered cards, the Assets card is capped, and
 * the beat list draws lucide icons, not emoji.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'fs';
import { resolve } from 'path';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab, { lineFocusReady } from './EpisodeScriptTab';
import { AssetsCard, ScriptBeatList } from './ScriptBeatParts';
import { scriptHealth } from '../../lib/scriptHealth';

const SCRIPT = [
  '## BEAT: 1 · Opening Ritual', '(Morning light.)', 'Lala: "Hello there."', '[WEAR: piece-1]', '[WEAR: piece-9]',
  '## BEAT: 2 · Login Sequence', '(She types.)',
  '## BEAT: 3 · Welcome', '(She spins.)',
].join('\n');
const renderTab = (locks = []) => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT, script_locked_beats: locks }} show={{ id: 'show-1' }} /></MemoryRouter>,
);
const css = readFileSync(resolve(__dirname, 'EpisodeScriptPage.css'), 'utf8');
const ephCss = readFileSync(resolve(__dirname, 'EpisodeProductionHeader.css'), 'utf8');

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  Element.prototype.scrollIntoView = vi.fn();
  window.localStorage.clear();
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (String(url).includes('/wardrobe/outfit/')) return { data: { items: [{ id: 'piece-1', name: 'Gold gown' }] } };
    return { data: { data: [] } };
  });
  vi.mocked(api.put).mockImplementation(async (url, body) => ({ data: { data: body } }));
});
afterEach(() => { vi.restoreAllMocks(); });

describe('focus after editing a line (Script page audit 4)', () => {
  test('the fallback waits while the change is not yet drawn', () => {
    // Not committed yet: the script is still the one the edit was asked on.
    expect(lineFocusReady({ asked: 'a', committed: 'a', drawn: 'a' })).toBe(false);
    // Committed, but the beats drawn are still the old script's.
    expect(lineFocusReady({ asked: 'a', committed: 'b', drawn: 'a' })).toBe(false);
    // Drawn: the row there now is the edited line's.
    expect(lineFocusReady({ asked: 'a', committed: 'b', drawn: 'b' })).toBe(true);
  });

  test("Ctrl+Enter leaves focus on the edited line's row once its id has settled", async () => {
    const frames = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { frames.push(cb); return frames.length; });
    renderTab();
    const beat = await screen.findByTestId('script-beat-1');
    const row = within(beat).getAllByTestId('script-line')[1];
    fireEvent.click(row);
    const box = within(beat).getByLabelText('Edit line');
    fireEvent.change(box, { target: { value: 'Lala: "Hello again."' } });
    fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true });
    // Every frame the page asked for runs, as a browser would, after the ids settled.
    for (let i = 0; i < 80 && frames.length; i += 1) act(() => { frames.shift()(0); });
    const now = document.activeElement;
    expect(now.isConnected).toBe(true);
    expect(now.dataset.testid).toBe('script-line');
    expect(now.textContent).toContain('Hello again.');
  });
});

describe('the sticky header (Script page audit 4)', () => {
  test('a chosen beat whose head would sit under the compact header is scrolled clear of it', async () => {
    const header = document.createElement('div');
    header.className = 'ed-header-new is-compact';
    document.body.appendChild(header);
    const rect = (top, bottom) => ({ top, bottom, left: 0, right: 100, width: 100, height: bottom - top, x: 0, y: top, toJSON() {} });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function box() {
      if (this.classList?.contains('ed-header-new')) return rect(0, 74);
      if (this.dataset?.beatId) return rect(30, 600);
      return rect(0, 0);
    });
    renderTab();
    await screen.findByTestId('script-beat-1');
    const scrolled = vi.mocked(Element.prototype.scrollIntoView);
    scrolled.mockClear();
    fireEvent.click(screen.getByTestId('script-nav-2'));
    expect(scrolled).toHaveBeenCalled();
    header.remove();
  });

  test("the episode page pads its scroller by the compact header's height", () => {
    const page = readFileSync(resolve(__dirname, '../../pages/EpisodeDetail.jsx'), 'utf8');
    expect(page).toMatch(/scroller\.style\.scrollPaddingTop = compact \? `\$\{h \+ 12\}px` : '';/);
  });

  test('screen-reader text stays inside the tab, so the document itself never scrolls', () => {
    expect(css).toMatch(/\.esp \{\s*position: relative;/);
  });

  test('beats and every control keep clear of the sticky header and the phone bar', () => {
    expect(css).toMatch(/\.esp-beat\s*\{[^}]*scroll-margin-top:/);
    const phone = css.slice(css.indexOf('@media (max-width: 760px)'));
    expect(phone).toMatch(/:has\(\.esp\.has-beatlist\)[^{]*\{\s*scroll-padding-bottom:/);
  });
});

describe('the open beat beside the beat list (Script page audit 4)', () => {
  test("its head doesn't fold it, and shows no fold chevron", async () => {
    renderTab();
    const beat = await screen.findByTestId('script-beat-1');
    fireEvent.click(beat.querySelector('.esp-beat-head'));
    expect(screen.getByTestId('script-beat-1').className).toContain('is-open');
    expect(css).toMatch(/\.esp\.has-beatlist \.esp-beat\.is-open \.esp-beat-chev\s*\{[^}]*display:\s*none/);
  });

  test('the fold chevron is a lucide icon, not a ▼ character', async () => {
    renderTab();
    const beat = await screen.findByTestId('script-beat-1');
    const chev = beat.querySelector('.esp-beat-chev');
    expect(chev.tagName.toLowerCase()).toBe('svg');
    expect(beat.textContent).not.toContain('▼');
  });
});

describe('Ready to film? (Script page audit 4)', () => {
  test('starts folded on a desktop too, even when it was left open', async () => {
    window.localStorage.setItem('esp-health-collapsed', '0');
    renderTab();
    const toggle = await screen.findByTestId('script-health-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByTestId('script-health-sum').textContent).toMatch(/to check|All clear/);
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });
});

describe("beat 14's opportunity is optional (Evoni, 2026-10-19)", () => {
  test('none attached is a note, not a thing to check', () => {
    const beats = Array.from({ length: 14 }, (_, i) => ({ id: `beat-${i + 1}`, number: i + 1, lines: ['(x)'] }));
    const row = scriptHealth({ beats, beat14: { opportunity: null } }).find((r) => r.key === 'beat14');
    expect(row.ok).toBe(true);
    expect(row.text).toMatch(/\(optional\)/);
  });
});

describe('the line cards (Script page audit 4)', () => {
  test('a [WEAR] cue names the piece of the look, or its id when the look has no such piece', async () => {
    renderTab();
    const beat = await screen.findByTestId('script-beat-1');
    await waitFor(() => expect(beat.textContent).toContain('Puts on Gold gown'));
    expect(beat.textContent).toContain('Puts on piece-9');
  });

  test('"n lines" counts the numbered cards', async () => {
    renderTab();
    const beat = await screen.findByTestId('script-beat-1');
    const numbered = beat.querySelectorAll('.esp-line-n').length;
    expect(numbered).toBe(4);
    expect(beat.querySelector('.esp-beat-count').textContent).toMatch(/^4 lines/);
  });
});

describe('the Assets card (Script page audit 4)', () => {
  const assets = Array.from({ length: 20 }, (_, i) => ({ key: `a${i}`, name: `Piece ${i + 1}`, kind: 'wardrobe', label: 'Wardrobe' }));
  test('shows 8, then all of them on "Show all"', () => {
    render(<MemoryRouter><AssetsCard beatNumber={1} assets={assets} /></MemoryRouter>);
    expect(screen.getAllByTestId('script-asset')).toHaveLength(8);
    const more = screen.getByRole('button', { name: 'Show all 20' });
    fireEvent.click(more);
    expect(screen.getAllByTestId('script-asset')).toHaveLength(20);
    expect(screen.getByRole('button', { name: 'Show fewer' }).getAttribute('aria-expanded')).toBe('true');
  });
  test('8 or fewer need no toggle', () => {
    render(<MemoryRouter><AssetsCard beatNumber={1} assets={assets.slice(0, 8)} /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: /Show all/ })).toBeNull();
  });
});

describe('the beat list without pictures (Script page audit 4)', () => {
  test('draws a lucide icon for each beat, never an emoji', () => {
    const beats = [{ id: 'beat-9', number: 9, name: 'Reminder / Deadline', icon: '⏰', lines: [] }];
    const drag = { current: () => null, start() {}, end() {}, half: () => 'before' };
    render(<MemoryRouter><ScriptBeatList beats={beats} openId={null} onChoose={() => {}} drag={drag} onMoveBeat={() => {}} onApprove={() => {}} /></MemoryRouter>);
    const icon = document.querySelector('.esp-beatlist-icon');
    expect(icon.querySelector('svg')).not.toBeNull();
    expect(icon.textContent).not.toContain('⏰');
  });
});

describe('the row ⋮ menu (Script page audit 4)', () => {
  test('gives focus back to its ⋮ after Approve & lock', async () => {
    renderTab();
    const row = await screen.findByTestId('script-row-2');
    const det = row.querySelector('details');
    det.open = true; fireEvent(det, new Event('toggle'));
    const approve = await within(row).findByRole('button', { name: 'Approve & lock' });
    approve.focus(); fireEvent.click(approve);
    await waitFor(() => expect(screen.getByTestId('script-row-2').dataset.status).toBe('approved'));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('script-row-2').querySelector('summary')));
  });
});

describe('touch targets and the steps strip (Script page audit 4)', () => {
  const coarse = (s) => s.slice(s.indexOf('@media (pointer: coarse)'));
  test('on a touch screen of any width the buttons are 44px', () => {
    expect(css).toMatch(/@media \(pointer: coarse\)/);
    expect(coarse(css)).toMatch(/\.esp-health-open[^{]*\{[^}]*min-height:\s*44px/s);
    expect(ephCss).toMatch(/@media \(pointer: coarse\)/);
    expect(coarse(ephCss)).toMatch(/\.eph-btn[^{]*\{[^}]*min-height:\s*44px/s);
  });
  test('the production steps strip lets the next step peek in at phone width', () => {
    const phone = ephCss.slice(ephCss.indexOf('@media (max-width: 760px)'));
    expect(phone).toMatch(/\.eph-step\s*\{\s*flex:\s*0 0 84px/);
  });
});
