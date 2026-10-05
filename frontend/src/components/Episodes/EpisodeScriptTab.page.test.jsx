/**
 * The Script page (Evoni's Episode mock, 2026-10-05): the script's card
 * with its state and actions, the empty state, and beside them what the
 * script will use (lavender when there, amber when the script fills the
 * gap) and where the voices come from.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';

const EVENT = {
  id: 'ev-1', show_id: 'show-1', name: 'Wearable Experiments', host_brand: 'SABLE',
  venue_location_id: 'loc-1', venue_name: "SABLE's Studio", scene_set_id: 'set-1', outfit_pieces: [],
  narrative_stakes: 'A first credit', canon_consequences: { automation: { guest_profiles: [{ handle: 'g1' }] } },
};
const BRIEF = { event_id: 'ev-1', episode_archetype: 'Redemption', designed_intent: 'pass', narrative_purpose: 'x', forward_hook: 'y' };
const renderTab = (script = '') => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: script }} show={{ id: 'show-1' }} /></MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockClear?.());
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/episode-brief/ep-1') return { data: { data: BRIEF } };
    if (url === '/api/v1/world/show-1/events/ev-1') return { data: { success: true, event: EVENT, sceneSet: { id: 'set-1', name: 'Studio set' }, venueLocation: { id: 'loc-1', name: "SABLE's Studio" } } };
    return { data: { data: [] } };
  });
});

describe('Script page', () => {
  test('with no script: Not generated yet, one Generate Script, and the empty card', async () => {
    renderTab();
    const head = screen.getByTestId('script-head');
    expect(head.textContent).toContain('Not generated yet');
    expect(screen.getAllByRole('button', { name: 'Generate Script' })).toHaveLength(1);
    expect(screen.getByTestId('script-empty').textContent).toContain('No script yet');
  });

  test('what the script will use: lavender where it is set, amber where the script fills it', async () => {
    renderTab();
    await screen.findByText("SABLE's Studio", { exact: false });
    const uses = screen.getByTestId('script-uses');
    expect(within(uses).getByTestId('script-uses-brief').getAttribute('data-ok')).toBe('true');
    expect(within(uses).getByTestId('script-uses-event').textContent).toBe('Event Wearable Experiments');
    expect(within(uses).getByTestId('script-uses-cast').getAttribute('data-ok')).toBe('false');
    expect(within(uses).getByTestId('script-uses-look').textContent).toBe('Look not chosen');
    expect(within(screen.getByTestId('script-voice')).getByText('Open Character Studio').getAttribute('href')).toBe('/character-registry?view=world');
  });

  test('with a script: its beats and approvals, and Raw editor, Regenerate and Save', () => {
    renderTab('## BEAT: 1 · Opening Ritual\nLala: Hi besties.\n\n## BEAT: 2 · Login Sequence\nLala: Logging in.\n');
    expect(screen.getByTestId('script-head').textContent).toContain('2 beats · 0 approved');
    for (const name of ['Raw editor', 'Regenerate', 'Save']) expect(screen.getByRole('button', { name })).toBeTruthy();
    expect(screen.queryByTestId('script-empty')).toBeNull();
  });
});
