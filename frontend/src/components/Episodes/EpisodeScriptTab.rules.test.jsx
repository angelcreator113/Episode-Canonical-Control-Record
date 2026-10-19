/**
 * The show's rules in "Ready to film?" (lib/scriptRuleChecks; Evoni,
 * 2026-10-17 and 2026-10-18): the tab reads Lala's money from the Money
 * page's lines and the event's shopping list, and each rule is a row on
 * its beat.
 */
import { vi, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';

const SCRIPT = [
  '## BEAT: 8 · Transformation Loop', '[UI:OPEN Closet]', '[WEAR: p1]', 'Me: yes',
  '', '## BEAT: 9 · Reminder/Deadline', 'Me: reminders',
  '', '## BEAT: 13 · Recap Panel', 'Me: what a night',
].join('\n');

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/world/show-1/episodes/ep-1/money') {
      return { data: { data: { lines: [{ look: true, source: { id: 'p1' }, label: 'Velvet Blazer', amount: 120 }] } } };
    }
    if (url === '/api/v1/episode-brief/ep-1') return { data: { data: { event_id: 'ev-1' } } };
    if (url === '/api/v1/world/show-1/events/ev-1') {
      return { data: { event: { id: 'ev-1', show_id: 'show-1', name: 'Studio Session', host_brand: 'STUDIO BY SABLE', canon_consequences: { documents: { shopping_list: { status: 'approved' } } } } } };
    }
    return { data: { data: [] } };
  });
});

test("beat 8's coin line, beat 9's shopping list and Lala's beat 13 line are rows on their beats", async () => {
  render(<MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT, script_locked_beats: [] }} show={{ id: 'show-1' }} /></MemoryRouter>);
  await waitFor(() => expect(screen.getByTestId('script-health-rule-beat8-p1').textContent)
    .toContain('Beat 8: the Velvet Blazer goes on without its coin line [STAT: coins -120].'));
  await waitFor(() => expect(screen.getByTestId('script-health-rule-beat9').textContent).toContain('the approved shopping list never comes up'));
  expect(screen.getByTestId('script-health-rule-beat13').textContent).toContain('Lala never says how the outcome feels.');
  expect(screen.getByTestId('script-health-rule-beat8-p1').getAttribute('data-ok')).toBe('false');
});
