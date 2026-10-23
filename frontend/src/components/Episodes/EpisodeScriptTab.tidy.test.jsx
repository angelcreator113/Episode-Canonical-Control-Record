/**
 * The Script tab, tidier (Evoni, 2026-10-22: "how can we improve the script
 * tab layout"; all four options): the script's tools on its bar; the
 * context as one tabbed panel in a rail with the beat list; a leaner beat
 * card (the lines first, the scene and the three cards under Details, the
 * order tip behind a "?"); "+ Add line" as one menu; Ask and Approve pinned
 * at the foot of a phone screen.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'fs';
import { resolve } from 'path';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';

const css = readFileSync(resolve(__dirname, 'EpisodeScriptPage.css'), 'utf8');
const SCRIPT = [
  '## BEAT: 1 · Opening Ritual', 'Lala: "Good morning."',
  '## BEAT: 2 · Login Sequence', '[UI:OPEN Mail]', 'Lala: "A message."',
].join('\n');

const renderTab = () => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT, script_locked_beats: [] }} show={{ id: 'show-1' }} /></MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
});

describe('the tidier Script tab', () => {
  test("the script's tools are on its bar, not in the open beat", async () => {
    renderTab();
    const beat = await screen.findByTestId('script-beat-1');
    const tools = within(screen.getByTestId('script-head')).getByTestId('script-tools');
    expect(within(tools).getByRole('button', { name: 'Raw editor' })).toBeTruthy();
    expect(within(beat).queryByRole('button', { name: 'Raw editor' })).toBeNull();
  });

  test('the context is one panel of tabs beside the beat list, opening on True now', async () => {
    renderTab();
    const rail = await screen.findByTestId('script-rail');
    expect(within(rail).getByTestId('script-side')).toBeTruthy();
    const tabs = within(screen.getByTestId('script-side-tabs')).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(expect.arrayContaining(['Uses', 'Must cover', 'True now', 'Voice']));
    expect(screen.getByTestId('script-side-tab-truth').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('script-beat-state')).toBeTruthy();
    expect(screen.queryByTestId('script-uses')).toBeNull();
    fireEvent.click(screen.getByTestId('script-side-tab-uses'));
    expect(screen.getByTestId('script-uses')).toBeTruthy();
    expect(screen.queryByTestId('script-beat-state')).toBeNull();
  });

  test('"+ Add line" opens the kinds and Escape closes them; the scene and the three cards are under Details', async () => {
    renderTab();
    const beat = await screen.findByTestId('script-beat-1');
    const toggle = within(beat).getByTestId('script-add-menu-1');
    const kinds = within(beat).getByTestId('script-add-chips-1');
    expect(kinds.hidden).toBe(true);
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(kinds.hidden).toBe(false);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(kinds.hidden).toBe(true);
    const details = within(beat).getByTestId('script-details-1');
    expect(details.tagName).toBe('DETAILS');
    expect(details.open).toBe(false);
    expect(within(details).getByTestId('script-checklist-1')).toBeTruthy();
    expect(within(details).getByRole('region', { name: 'Scene visuals' })).toBeTruthy();
    expect(within(details).getByText(/checklist \d+\/\d+/)).toBeTruthy();
    // The order tip is behind a "?".
    expect(screen.getByTestId('script-order-hint').closest('details')).toBeTruthy();
  });

  test('on a phone, Ask and Approve stay at the foot of the screen; the rail sticks beside the beat on a wide one', () => {
    const phone = css.slice(css.indexOf('@media (max-width: 760px)'));
    expect(phone).toMatch(/\.esp-beat-foot \{ display: contents; \}/);
    expect(phone).toMatch(/\.esp-beat-commit \{\s*position: sticky; bottom: calc\(76px/);
    expect(css).toMatch(/\.esp\.has-beatlist \.esp-rail \{\s*position: sticky;/);
  });
});
