/**
 * The quality gate's result on Review's cards (Task 2969): an engine draft
 * shows its voice score, why it waits, and each flag; other posts show
 * nothing; it appears on wall drafts and on posts from episodes.
 */
import React from 'react';
import { vi, describe, test, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(async () => ({ data: {} })), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import { GateResult, PostCard, RequestPost } from './PulseReviewPost';
import { PulseRevealProvider } from './PulseRevealContext';

const FLAGGED = {
  pass: false, voice: 0.42, review: ['about_lala', 'gate'],
  flags: [{ code: 'banned_phrase', detail: 'delve' }, { code: 'voice', detail: 'Voice match 0.42 (below 0.6).' }],
};

describe('GateResult', () => {
  test('a flagged draft: voice, why it waits, each flag', () => {
    render(<GateResult gate={FLAGGED} />);
    const gate = screen.getByTestId('prv-gate');
    expect(gate.className).toContain('prv-gate-flagged');
    expect(within(gate).getByText(/Engine draft/).parentElement.textContent).toBe('Engine draft · voice 42% · waiting: About Lala, Flagged by the gate');
    expect(within(gate).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'AI-sounding phrase: delve', 'Off voice: Voice match 0.42 (below 0.6).',
    ]);
  });

  test("who knows what (Task 2982): an event the poster couldn't know about is named", () => {
    render(<GateResult gate={{ pass: false, voice: 0.9, review: ['gate'], flags: [{ code: 'doesnt_know', detail: 'Starlight Ball' }] }} />);
    expect(within(screen.getByTestId('prv-gate')).getByRole('listitem').textContent)
      .toBe("Names an event they couldn't know about yet: Starlight Ball");
  });

  test("a passing draft waiting only because it is Lala's: no flags list", () => {
    render(<GateResult gate={{ pass: true, voice: 0.91, review: ['lala'], flags: [] }} />);
    const gate = screen.getByTestId('prv-gate');
    expect(gate.className).toContain('prv-gate-pass');
    expect(gate.textContent).toBe("Engine draft · voice 91% · waiting: Lala's post");
    expect(within(gate).queryByRole('list')).toBeNull();
  });

  test('nothing for a post the engine did not draft', () => {
    const { container } = render(<GateResult gate={null} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('on Review cards', () => {
  const post = { id: 'p1', poster_handle: 'marcus', poster_display_name: 'Marcus', content_text: 'delve into the gala', status: 'draft', comments: [], gate_json: FLAGGED };
  const wrap = (ui) => render(<MemoryRouter><PulseRevealProvider showId="show-1">{ui}</PulseRevealProvider></MemoryRouter>);

  test('a wall draft shows its gate result; once live it does not', () => {
    const { unmount } = wrap(<PostCard post={post} showId="show-1" />);
    expect(screen.getByTestId('prv-gate')).toBeTruthy();
    unmount();
    wrap(<PostCard post={{ ...post, status: 'live' }} showId="show-1" />);
    expect(screen.queryByTestId('prv-gate')).toBeNull();
  });

  test("a post from an episode shows its gate result", () => {
    wrap(<RequestPost post={{ ...post, episode_id: 'ep-1', episode: { episode_number: 2 } }} />);
    expect(screen.getByTestId('prv-gate').textContent).toMatch(/^Engine draft · voice 42%/);
  });
});
