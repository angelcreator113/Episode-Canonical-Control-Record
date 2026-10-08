/**
 * The Script page (Evoni's Episode mock, 2026-10-05): the script's card
 * with its state and actions, the empty state, and beside them what the
 * script will use (lavender when there, amber when the script fills the
 * gap) and where the voices come from.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab, { rewrittenLine } from './EpisodeScriptTab';

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
    // Look is the outfit locked on the Wardrobe tab, which the script writer reads (2026-10-08).
    expect(within(uses).getByTestId('script-uses-look').textContent).toBe('Look not locked on the Wardrobe tab yet · Open Wardrobe');
    expect(within(uses).getByRole('link', { name: 'Open Wardrobe' }).getAttribute('href')).toBe('/?tab=wardrobe');
    expect(api.get).toHaveBeenCalledWith('/api/v1/wardrobe/outfit/ep-1');
    expect(within(screen.getByTestId('script-voice')).getByText('Open Character Studio').getAttribute('href')).toBe('/character-registry?view=world');
  });

  test('with a script: its beats and approvals, and Raw editor, Regenerate and Save', () => {
    renderTab('## BEAT: 1 · Opening Ritual\nLala: Hi besties.\n\n## BEAT: 2 · Login Sequence\nLala: Logging in.\n');
    expect(screen.getByTestId('script-head').textContent).toContain('2 beats · 0 approved');
    for (const name of ['Raw editor', 'Regenerate', 'Save']) expect(screen.getByRole('button', { name })).toBeTruthy();
    expect(screen.queryByTestId('script-empty')).toBeNull();
  });

  test('an outfit locked on the Wardrobe tab is the Look, lavender, with its pieces', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episode-brief/ep-1') return { data: { data: BRIEF } };
      if (url === '/api/v1/world/show-1/events/ev-1') return { data: { success: true, event: EVENT } };
      if (url === '/api/v1/wardrobe/outfit/ep-1') return { data: { items: [{ id: 'w1', name: 'Silk slip dress' }, { id: 'w2', name: 'Strappy heels' }] } };
      return { data: { data: [] } };
    });
    renderTab();
    await waitFor(() => expect(screen.getByTestId('script-uses-look').getAttribute('data-ok')).toBe('true'));
    expect(screen.getByTestId('script-uses-look').textContent).toBe('Look 2 pieces locked: Silk slip dress, Strappy heels');
  });

  test('Rewrite keeps the speaker, sends the beat it sits in, and says when it fails (2026-10-08)', async () => {
    const SCRIPT = '## BEAT: 1 · Opening Ritual\nPrime: "Hey besties. its been a minute."\nPrime: "Lets go ahead and login."\n';
    vi.mocked(api.post).mockResolvedValueOnce({ data: { rewrittenLine: 'Hey besties, welcome back!' } });
    renderTab(SCRIPT);
    fireEvent.click(screen.getAllByRole('button', { name: '✦ Rewrite' })[0]);
    await waitFor(() => expect(screen.getAllByTestId('script-line')[0].textContent).toContain('"Hey besties, welcome back!"'));
    expect(screen.getAllByTestId('script-line')[0].textContent).toContain('Prime');
    expect(screen.getAllByRole('button', { name: '✦ Rewrite' })).toHaveLength(2);
    const [url, body] = vi.mocked(api.post).mock.calls.at(-1);
    expect(url).toBe('/api/v1/episode-brief/ep-1/rewrite-line');
    expect(body).toMatchObject({ speaker: 'Prime', beatName: 'Opening Ritual', beatLines: ['Prime: "Hey besties. its been a minute."', 'Prime: "Lets go ahead and login."'] });
    expect(screen.getByRole('status').textContent).toContain('Save to keep it');
    expect(screen.getByTestId('script-dirty')).toBeTruthy();

    vi.mocked(api.post).mockRejectedValueOnce(Object.assign(new Error('x'), { response: { data: { error: 'Daily AI budget reached' } } }));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(screen.getAllByRole('button', { name: '✦ Rewrite' })[1]);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Rewrite failed: Daily AI budget reached'));
    spy.mockRestore();
  });

  test('rewrittenLine: the new words in the original line\'s shape', () => {
    expect(rewrittenLine('Prime: "Old words."', 'New words.')).toBe('Prime: "New words."');
    expect(rewrittenLine('Lala: plain', '"Quoted back"')).toBe('Lala: Quoted back');
    expect(rewrittenLine('Prime: "Same."', 'Prime: "Same."')).toBeNull();
    expect(rewrittenLine('Prime: "x"', '  ')).toBeNull();
  });
});
