/**
 * The Overview to Evoni's mock (2026-10-18, step 2 of the character page):
 * Quick facts, Wants and fears under Who they are, Recent activity, and
 * paging on Where they show up.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../config/api', () => ({ API_URL: '/api/v1' }));

import api from '../services/api';
import { QuickFacts, RecentActivity, activityOf, wantsAndFears } from './CharacterProfilePage';

const inRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
});

describe('Quick facts', () => {
  const CHARACTER = { id: 'c1', display_name: 'STUDIO BY SABLE', selected_name: 'Sable Okafor', role_type: 'support', feed_profile_id: 7 };
  const APPEARANCES = { linked: true, episodes: [{ id: 'e3', episode_number: 3 }, { id: 'e1', episode_number: 1 }], events: [] };

  test('their facts and type at a glance; what is missing reads Not set', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.endsWith('/facts')) return { data: { facts: { occupation: 'Designer', followers: { label: '28.4K', source: 'estimate' }, account_status: 'rising', undecided: [] } } };
      if (url.endsWith('/typology')) return { data: { typology: { enneagram: { type: 3, wing: 4 } }, label: 'Type 3w4, The Achiever' } };
      return { data: {} };
    });
    inRouter(<QuickFacts character={CHARACTER} feedProfile={{ society_archetype: 'polished_curator' }} appearances={APPEARANCES} editing={false} onEdit={vi.fn()} />);
    const card = screen.getByTestId('ch-quick');
    await waitFor(() => expect(card.textContent).toContain('Occupation'));
    await waitFor(() => expect(card.textContent).toContain('Designer'));
    const rows = within(card).getAllByRole('definition').map((dd) => dd.textContent);
    expect(rows).toEqual(['Sable Okafor', '3w4, The Achiever', 'Active', 'Episode 1', 'Polished curator', 'Supporting', 'Designer', '28.4K (estimate)', 'Rising']);
  });

  test('no type, no facts: Not set; Edit asks to open the editors, and closing reads the facts again', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {} });
    const onEdit = vi.fn();
    const { rerender } = inRouter(<QuickFacts character={{ id: 'c1', role_type: 'support' }} feedProfile={null} appearances={{ episodes: [] }} editing={false} onEdit={onEdit} />);
    const card = screen.getByTestId('ch-quick');
    await waitFor(() => expect(within(card).getAllByText('Not set').length).toBeGreaterThan(4));
    fireEvent.click(within(card).getByRole('button', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledWith(true);
    const calls = vi.mocked(api.get).mock.calls.length;
    rerender(<MemoryRouter><QuickFacts character={{ id: 'c1', role_type: 'support' }} feedProfile={null} appearances={{ episodes: [] }} editing onEdit={onEdit} /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Done' }).getAttribute('aria-expanded')).toBe('true');
    rerender(<MemoryRouter><QuickFacts character={{ id: 'c1', role_type: 'support' }} feedProfile={null} appearances={{ episodes: [] }} editing={false} onEdit={onEdit} /></MemoryRouter>);
    await waitFor(() => expect(vi.mocked(api.get).mock.calls.length).toBe(calls + 2));
  });
});

describe('Wants and fears', () => {
  test('from their want architecture, desire, fear and wound; JSON text too', () => {
    const { wants, fears } = wantsAndFears({
      want_architecture: JSON.stringify({ surface_want: 'To be believed', real_want: 'A life that feels real', forbidden_want: '' }),
      hidden_want: 'To be seen unfinished', core_desire: '',
      core_fear: 'Being seen as unfinished', wound: { description: 'The show that closed' },
    });
    expect(wants).toEqual([
      { kind: 'Says they want', text: 'To be believed' }, { kind: 'Actually needs', text: 'A life that feels real' },
      { kind: 'Will not admit wanting', text: 'To be seen unfinished' },
    ]);
    expect(fears).toEqual([{ kind: 'Fear', text: 'Being seen as unfinished' }, { kind: 'The wound', text: 'The show that closed' }]);
    expect(wantsAndFears({ want_architecture: 'not json' })).toEqual({ wants: [], fears: [] });
  });
});

describe('Recent activity', () => {
  const APPEARANCES = {
    linked: true,
    events: [{ id: 'v1', show_id: 's1', name: 'Wearable Experiments', role: 'host', event_date: '2026-11-12' }],
    episodes: [{ id: 'e1', episode_number: 1, title: 'I Designed My Outfit' }],
  };
  const TRAIL = { posts: [
    { id: 'p1', text: 'New drop, come play.', status: 'posted', at: '2026-10-14T10:00:00Z' },
    { id: 'p2', text: 'Sketching', status: 'draft', at: '2026-10-16T10:00:00Z' },
  ] };

  test('dated first, newest first; episodes after', () => {
    expect(activityOf(APPEARANCES, TRAIL).map((x) => x.title)).toEqual([
      'Hosts an event', 'Drafted a post', 'Posted to the feed', 'Featured in Episode 1',
    ]);
    expect(activityOf(null, null)).toEqual([]);
  });

  test('each row links where it can, four to a page', () => {
    const posts = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, text: `Post ${i}`, status: 'posted', at: `2026-10-0${i + 1}T10:00:00Z` }));
    inRouter(<RecentActivity appearances={APPEARANCES} trail={{ posts }} />);
    const card = screen.getByTestId('ch-activity');
    expect(within(card).getAllByRole('listitem')).toHaveLength(4);
    expect(within(card).getByRole('link', { name: /Hosts an event/ }).getAttribute('href')).toBe('/shows/s1/events/v1');
    expect(card.textContent).toContain('Nov 12, 2026');
    fireEvent.click(within(card).getByRole('button', { name: 'Next page' }));
    expect(within(card).getAllByRole('listitem')).toHaveLength(4);
    expect(within(card).getByRole('link', { name: /Featured in Episode 1/ }).getAttribute('href')).toBe('/episodes/e1');
  });

  test('nothing yet', () => {
    inRouter(<RecentActivity appearances={{ linked: false, events: [], episodes: [] }} trail={{}} />);
    expect(screen.getByTestId('ch-activity').textContent).toContain('Nothing yet');
  });
});
