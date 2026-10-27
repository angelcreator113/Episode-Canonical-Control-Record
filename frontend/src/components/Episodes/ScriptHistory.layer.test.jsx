/**
 * History is above the site's header on a phone (Evoni, 2026-10-27: "When I
 * click the history tab I can't click or see the exit button"). The panel was
 * inside the Script tab at z-index 60; the sticky site header (--z-sticky) and
 * the assistant button (--z-assistant) drew over its top, where Close is, and
 * Close scrolled away with the list. It is now on the page's body, on the
 * modal layer, with its header row pinned.
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

const SCRIPT = '## BEAT: 1 · Opening Ritual\nLala: Hi besties.';
const css = readFileSync(resolve(__dirname, 'EpisodeScriptPage.css'), 'utf8');
const rule = (selector) => (css.match(new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')} \\{([^}]*)\\}`)) || [])[2] || '';

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockImplementation(async (url) => (url === '/api/v1/episodes/ep-1/script-versions'
    ? { data: { data: [{ id: '3f2a9c1e-0000-4000-8000-000000000001', created_at: new Date().toISOString(), source: 'save', beats: 1, preview: 'Lala: Hi.' }] } }
    : { data: { data: [] } }));
});

describe('Script History: above the page, Close always reachable', () => {
  test('the panel and its backdrop are on the page\'s body, outside the Script tab', async () => {
    const { container } = render(
      <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT }} show={{ id: 'show-1' }} /></MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('script-history'));
    const panel = await screen.findByTestId('script-history-panel');
    expect(panel.parentElement).toBe(document.body);
    expect(container.contains(panel)).toBe(false);
    expect(screen.getByTestId('script-history-backdrop').parentElement).toBe(document.body);
    fireEvent.click(within(panel).getByRole('button', { name: 'Close' }));
    expect(screen.queryByTestId('script-history-panel')).toBeNull();
  });

  test('the panel is on the modal layer, above the sticky header and the assistant; the backdrop just under it', () => {
    expect(rule('.esp-history')).toMatch(/z-index: var\(--z-modal, 1100\)/);
    expect(rule('.esp-history-backdrop')).toMatch(/z-index: calc\(var\(--z-modal, 1100\) - 1\)/);
  });

  test('its header row (the title and Close) stays at the top while the list scrolls, with a full-size Close', () => {
    expect(rule('.esp-history-head')).toMatch(/position: sticky; top: 0/);
    expect(rule('.esp-history-head')).toMatch(/background: var\(--studio-page\)/);
    expect(rule('.esp-history-head .esp-btn')).toMatch(/min-width: 44px; min-height: 44px/);
  });
});
