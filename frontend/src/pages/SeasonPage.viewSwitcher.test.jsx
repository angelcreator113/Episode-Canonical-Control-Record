/**
 * The Roadmap's view switcher on a phone (Evoni, 2026-11-12).
 *
 * It was a fixed 392px wide: at 375px its last view, Calendar, was cut off
 * at the edge of the screen, and at 320px more of it. Below 600px it now
 * takes the phone shape the Events switcher already had: the full row,
 * shared equally by its four buttons. Same element, same buttons; no second
 * switcher. Wider screens are unchanged.
 *
 * jsdom does no layout, so the widths are checked two ways: the stylesheet's
 * own rules here, and a real browser at 320, 375, 414 and 1280px (in the PR).
 */
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import api from '../services/api';
import SeasonPage from './SeasonPage';

const CSS = fs.readFileSync(path.join(__dirname, 'SeasonPage.css'), 'utf8');
/** The body of the first `@media (max-width: 600px)` block that mentions the selector. */
function phoneBlockWith(selector) {
  const re = /@media \(max-width: 600px\) \{/g;
  let m;
  while ((m = re.exec(CSS))) {
    let depth = 1; let i = re.lastIndex;
    while (depth && i < CSS.length) { if (CSS[i] === '{') depth += 1; else if (CSS[i] === '}') depth -= 1; i += 1; }
    const body = CSS.slice(re.lastIndex, i - 1);
    if (body.includes(selector)) return body;
  }
  return null;
}
/** The declarations of the rule(s) in `block` whose selector list includes `selector` exactly. */
function declarations(block, selector) {
  return [...block.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, sel]) => sel.replace(/\/\*[\s\S]*?\*\//g, '').split(',').map((s) => s.trim()).includes(selector))
    .map(([, , body]) => body).join(' ');
}

const slot = (n, phase) => ({ id: `slot-${n}`, slot_number: n, phase, label: `S1 · E${n}`, state: 'needs_event', locked: false, intention: {}, episode: null, event: null });
const SLOTS = [1, 2, 3, 4, 5, 6].map((n) => slot(n, Math.ceil(n / 2)));
const PHASES = [1, 2, 3].map((p) => ({ phase: p, title: ['Foundation', 'Ascension', 'Legacy'][p - 1], episode_start: (p - 1) * 2 + 1, episode_end: p * 2, slots: SLOTS.filter((s) => s.phase === p) }));
const ARC = { id: 'arc-1', season_number: 1, title: 'Soft Luxury Ascension', current_phase: 1, phases: PHASES.map(({ slots, ...p }) => p) };

function Where() { const l = useLocation(); return <span data-testid="where">{l.pathname}{l.search}</span>; }
const renderAt = (address) => render(
  <MemoryRouter initialEntries={[address]}>
    <Routes><Route path="/shows/:showId/season" element={<><SeasonPage /><Where /></>} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  vi.mocked(api.get).mockReset().mockImplementation(async (url) => {
    if (url.includes('/season/roadmap')) return { data: { roadmap: { season_number: 1, slot_count: 6, next_slot_number: 1, counts: {}, phases: PHASES, two_parters: [], specials: [] } } };
    if (/\/world\/show-1\/arc(\?|$)/.test(url)) return { data: { arc: ARC } };
    if (url.includes('/episodes')) return { data: { data: [], pagination: { total: 0 } } };
    if (url === '/api/v1/shows/show-1') return { data: { data: { name: 'Styling Adventures' } } };
    return { data: {} };
  });
});

describe('the stylesheet: the switcher on a phone', () => {
  const phone = phoneBlockWith('.szn-toolbar .szn-seg');

  test('below 600px the Roadmap switcher takes the full row and never its own fixed width', () => {
    expect(phone).toBeTruthy();
    const seg = declarations(phone, '.szn-toolbar .szn-seg');
    expect(seg).toMatch(/display:\s*flex/);
    expect(seg).toMatch(/width:\s*100%/);
  });

  test('its four buttons share the row equally and may shrink, so none is pushed off the screen', () => {
    const btn = declarations(phone, '.szn-toolbar .szn-seg button');
    expect(btn).toMatch(/flex:\s*1 1 0/);
    expect(btn).toMatch(/min-width:\s*0/);
    expect(btn).toMatch(/flex-direction:\s*column/);
    // Labels stay readable and are not clipped: no nowrap, no hidden overflow, no ellipsis.
    expect(btn).not.toMatch(/white-space:\s*nowrap|overflow:\s*hidden|text-overflow/);
    expect(btn).toMatch(/font-size:\s*13px/);
  });

  test('it is the Events switcher\'s own phone rule, shared: one rule for both, not a second design', () => {
    expect(declarations(phone, '.szn-events-bar .szn-seg')).toBe(declarations(phone, '.szn-toolbar .szn-seg'));
    expect(declarations(phone, '.szn-events-bar .szn-seg button')).toBe(declarations(phone, '.szn-toolbar .szn-seg button'));
  });

  test('wider screens are unchanged: the base rules are as they were, and nothing outside a phone query names the toolbar switcher', () => {
    expect(CSS).toContain('.szn-seg { display: inline-flex; padding: 3px; border-radius: 999px; border: 1px solid var(--sp-line); background: var(--sp-card); }');
    expect(CSS).toMatch(/\.szn-seg button \{\s*display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 6px 14px;/);
    const outside = CSS.replace(/@media \(max-width: 600px\) \{[\s\S]*?\n\}/g, '');
    expect(outside).not.toContain('.szn-toolbar .szn-seg');
  });

  test('keyboard focus stays visible on the switcher\'s buttons', () => {
    const rule = CSS.match(/([^{}]*\.szn-seg button:focus-visible[^{}]*)\{([^{}]*)\}/);
    expect(rule).toBeTruthy();
    expect(rule[2]).toMatch(/outline:\s*(?!none)[^;]+;/);
    // The phone rule removes no outline.
    expect(phone).not.toMatch(/outline:\s*(none|0)/);
  });
});

describe('the switcher itself: one group, four views, by click and by keyboard', () => {
  const VIEWS = [['grid', 'Grid'], ['timeline', 'Timeline'], ['week', 'This week'], ['calendar', 'Calendar']];

  test('one group named View holds exactly the four views, each a real button with its words', async () => {
    renderAt('/shows/show-1/season?tab=roadmap');
    await screen.findByTestId('szn-view-grid');
    const groups = screen.getAllByRole('group', { name: 'View' });
    expect(groups).toHaveLength(1);
    expect(groups[0].className).toBe('szn-seg');
    const buttons = within(groups[0]).getAllByRole('button');
    expect(buttons.map((b) => b.textContent.trim())).toEqual(VIEWS.map(([, label]) => label));
    for (const b of buttons) { expect(b.tagName).toBe('BUTTON'); expect(b.getAttribute('type')).toBe('button'); expect(b.disabled).toBe(false); }
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false', 'false']);
  });

  test('a click switches to each view and says which is on', async () => {
    renderAt('/shows/show-1/season?tab=roadmap');
    await screen.findByTestId('szn-view-grid');
    for (const [key] of [...VIEWS].reverse()) {
      fireEvent.click(screen.getByTestId(`szn-view-${key}`));
      await waitFor(() => expect(screen.getByTestId(`szn-view-${key}`).getAttribute('aria-pressed')).toBe('true'));
      if (key !== 'grid') expect(screen.getByTestId('where').textContent).toContain(`view=${key}`);
    }
  });

  test('the keyboard reaches all four: native buttons in reading order, none taken out of the tab order', async () => {
    renderAt('/shows/show-1/season?tab=roadmap');
    await screen.findByTestId('szn-view-grid');
    const buttons = within(screen.getByRole('group', { name: 'View' })).getAllByRole('button');
    // A native <button type="button"> is focusable and answers Enter and Space in every browser;
    // jsdom does not turn a key press into a click, so that part is checked in a real browser (see the PR).
    for (const b of buttons) {
      expect(b.hasAttribute('tabindex')).toBe(false);
      expect(b.getAttribute('aria-hidden')).toBeNull();
      b.focus();
      expect(document.activeElement).toBe(b);
    }
    expect(buttons.map((b) => b.getAttribute('data-testid'))).toEqual(VIEWS.map(([key]) => `szn-view-${key}`));
  });
});
