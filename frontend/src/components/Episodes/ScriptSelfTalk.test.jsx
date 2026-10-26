/**
 * Her self-talk at Beat 13 (Evoni, 2026-10-25): Hard on herself · Honest ·
 * Kind, Honest by default; choosing one saves it, choosing it again takes
 * it back. On the Script tab it sits under "What the script will use" and
 * in the open Beat 13, and saves to PUT /episode-brief/:id/self-talk.
 */
import { vi, beforeEach, describe, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ScriptSelfTalk from './ScriptSelfTalk';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));
import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';

test('Honest by default, not saved; the chosen one is checked; the same one again takes it back', () => {
  const onChoose = vi.fn();
  const { rerender } = render(<ScriptSelfTalk tone={null} onChoose={onChoose} />);
  expect(screen.getByTestId('script-self-talk-honest').getAttribute('aria-checked')).toBe('true');
  expect(screen.getByTestId('script-self-talk-note').textContent).toMatch(/Honest by default: choose one to save it/);
  fireEvent.click(screen.getByTestId('script-self-talk-kind'));
  expect(onChoose).toHaveBeenLastCalledWith('kind');
  rerender(<ScriptSelfTalk tone="kind" onChoose={onChoose} />);
  expect(screen.getByTestId('script-self-talk-kind').getAttribute('aria-checked')).toBe('true');
  expect(screen.getByTestId('script-self-talk-note').textContent).toMatch(/softens the stress by 1.*Saved for this episode/);
  fireEvent.click(screen.getByTestId('script-self-talk-kind'));
  expect(onChoose).toHaveBeenLastCalledWith(null);
  rerender(<ScriptSelfTalk tone="hard" onChoose={onChoose} saving="honest" failed />);
  expect(screen.getByTestId('script-self-talk-honest').textContent).toBe('Saving…');
  expect(screen.getByRole('alert').textContent).toMatch(/Couldn't save/);
});

describe('on the Script tab', () => {
  const SCRIPT = [
    '## BEAT: 6 · Strategic Reaction', 'Lala: "Is this the deal that gets the brands to trust me?"',
    '## BEAT: 13 · Recap Panel', 'Lala (V.O.): One partner closer.',
    '## BEAT: 14 · Cliffhanger', 'Me: bye',
  ].join('\n');
  let brief;
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    Element.prototype.scrollIntoView = vi.fn();
    brief = { event_id: null, event_metadata: {}, her_goal: { id: 'g-1', title: 'Brand Girl Era', kind: 'main', metric: 'brand_trust', how_close: 'more than halfway' } };
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episode-brief/ep-1') return { data: { data: brief } };
      return { data: { data: [] } };
    });
    vi.mocked(api.put).mockImplementation(async (url, body) => ({ data: { data: { self_talk: body.tone ? { tone: body.tone, at: 'now', by: 'u' } : null } } }));
  });
  const renderTab = () => render(
    <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT, script_locked_beats: [] }} show={{ id: 'show-1' }} /></MemoryRouter>,
  );

  test('Uses shows her goal and the choice; choosing Kind saves it on the brief', async () => {
    renderTab();
    fireEvent.click(await screen.findByTestId('script-side-tab-uses'));
    await waitFor(() => expect(screen.getByTestId('script-uses-her-goal').textContent).toMatch(/Brand Girl Era · more than halfway/));
    const control = screen.getByTestId('script-self-talk');
    expect(within(control).getByTestId('script-self-talk-honest').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(control).getByTestId('script-self-talk-kind'));
    expect(api.put).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/self-talk', { tone: 'kind' });
    await waitFor(() => expect(within(control).getByTestId('script-self-talk-kind').getAttribute('aria-checked')).toBe('true'));
  });

  test('a saved tone is read with the brief; Must cover has her goal, weighed at 6 and felt at 13', async () => {
    brief = { ...brief, event_metadata: { self_talk: { tone: 'hard' } } };
    renderTab();
    fireEvent.click(await screen.findByTestId('script-side-tab-uses'));
    await waitFor(() => expect(screen.getByTestId('script-self-talk-hard').getAttribute('aria-checked')).toBe('true'));
    fireEvent.click(screen.getByTestId('script-side-tab-cover'));
    const item = await screen.findByTestId('script-cover-her-goal');
    expect(item.dataset.covered).toBe('true');
    expect(item.textContent).toMatch(/Her goal Brand Girl Era/);
    expect(screen.getByTestId('script-cover-her-goal-beats').textContent).toBe('✓ weighed at Beat 6 · ✓ felt at Beat 13');
  });
});
