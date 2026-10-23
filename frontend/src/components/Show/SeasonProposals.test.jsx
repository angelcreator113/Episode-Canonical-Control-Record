/**
 * Season Plan › From the feed (2026-10-17): the open proposal, what moved on
 * the feed, the changes with why; she keeps what she ticks.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SeasonProposals, { signalLines } from './SeasonProposals';

const OPEN = {
  id: 'p1', status: 'proposed', summary: 'Sift is peaking; lean into the rivalry.',
  signals: { followers: [{ handle: 'slowsift', change: 12000 }], states: [{ handle: 'slowsift', to: 'peaking' }], storylines: [{ title: 'The copied look', status: 'paid_off' }], met: [{ handle: 'slowsift', episode_number: 4 }] },
  changes: [
    { kind: 'phase_theme', phase: 2, phase_title: 'Ascension', tagline: 'Rivals rising', why: 'Sift +12,000' },
    { kind: 'slot_intention', slot_number: 9, story_purpose: 'Lala faces Sift at the launch', why: 'peaking' },
  ],
};

let api;
beforeEach(() => {
  api = { get: vi.fn(async () => ({ data: { open: OPEN, recent: [] } })), post: vi.fn() };
});

describe('From the feed', () => {
  test('what moved, and each change with why', async () => {
    render(<SeasonProposals showId="s1" api={api} />);
    expect(await screen.findByText('Sift is peaking; lean into the rivalry.')).toBeTruthy();
    expect(screen.getByText('@slowsift +12,000 followers')).toBeTruthy();
    expect(screen.getByText('“The copied look” paid off')).toBeTruthy();
    expect(screen.getByText('Phase 2: Ascension')).toBeTruthy();
    expect(screen.getByText('Tagline: “Rivals rising”')).toBeTruthy();
    expect(screen.getByText("E9's purpose")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Accept 2 of 2' })).toBeTruthy();
  });

  test('Accept sends only what is ticked, then reloads the season', async () => {
    api.post.mockResolvedValue({ data: { applied: [{ index: 0, ok: false, skipped: true }, { index: 1, ok: true }] } });
    const onApplied = vi.fn();
    render(<SeasonProposals showId="s1" api={api} onApplied={onApplied} />);
    fireEvent.click(await screen.findByRole('checkbox', { name: /Phase 2/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Accept 1 of 2' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/s1/season/proposals/p1/accept', { changes: [1] }));
    expect(onApplied).toHaveBeenCalled();
    expect(await screen.findByText(/Applied 1 change to the season/)).toBeTruthy();
  });

  test('Dismiss changes nothing; with nothing open, Check The Pulse now asks for one', async () => {
    api.post.mockResolvedValue({ data: {} });
    render(<SeasonProposals showId="s1" api={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/world/s1/season/proposals/p1/dismiss'));

    api.get.mockResolvedValue({ data: { open: null, recent: [] } });
    api.post.mockResolvedValue({ data: { skipped: 'unchanged' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check The Pulse now' }));
    await waitFor(() => expect(api.post).toHaveBeenLastCalledWith('/api/v1/world/s1/season/proposals'));
    expect(await screen.findByText('Nothing new on The Pulse.')).toBeTruthy();
    expect(screen.getByText(/Nothing proposed right now/)).toBeTruthy();
    // Nothing open: one line with its check, not the full card (Evoni, 2026-10-22 layout list).
    const card = screen.getByTestId('season-proposals');
    expect(card.className).toBe('sp-card is-quiet');
    expect(card.querySelector('.sp-about')).toBeNull();
  });

  test('signal lines read nothing from no signals', () => {
    expect(signalLines(null)).toEqual([]);
    expect(signalLines({ followers: [{ handle: 'a', change: -300 }] })[0]).toMatchObject({ up: false, text: '@a -300 followers' });
  });
});
