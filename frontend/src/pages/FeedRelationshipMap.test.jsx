/**
 * The Relationship Map shows each pair's Pulse closeness, read only
 * (Task 3072): the canvas is asked for the active show, and a selected
 * profile's relationships show how close each pair is.
 * Since Task 3115 the map edits The Pulse's relationships: its form offers
 * The Pulse's 17 kinds, there is no Auto-Generate, and a refused pair says why.
 * Storyline seeds (idea 4, PR 3, 2026-10-17): a relationship the canvas marks
 * seedable (never Lala's) has a Storyline button that opens the seed panel.
 */
import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import api from '../services/api';
import FeedRelationshipMap from './FeedRelationshipMap';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../hooks/useActiveShow', () => ({ default: () => ({ showId: 'show-1', loaded: true }) }));

const canvas = {
  nodes: [
    { id: 1, handle: 'nia', display_name: 'Nia', state: 'rising' },
    { id: 2, handle: 'marcus', display_name: 'Marcus', state: 'rising' },
    { id: 3, handle: 'kim', display_name: 'Kim', state: 'rising' },
  ],
  edges: [
    { id: 'e1', source: 1, target: 2, type: 'collab', closeness: 0.62, seedable: true },
    { id: 'e2', source: 1, target: 3, type: 'orbit', closeness: null, seedable: false },
  ],
};

describe('FeedRelationshipMap closeness', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/feed-relationships/canvas') return { data: canvas };
      if (url === '/api/v1/feed-relationships/profiles') return { data: { profiles: [] } };
      return { data: {} };
    });
  });

  test('asks for the active show and shows a pair\'s closeness; a pair without one shows none', async () => {
    const { container } = render(<MemoryRouter><FeedRelationshipMap /></MemoryRouter>);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/feed-relationships/canvas', { params: { show_id: 'show-1' } }));
    const nia = await waitFor(() => {
      const g = [...container.querySelectorAll('g')].find((el) => el.querySelector('text')?.textContent?.includes('nia'));
      expect(g).toBeTruthy();
      return g;
    });
    fireEvent.click(nia);
    const close = await screen.findAllByTestId('frm-closeness');
    expect(close.map((el) => el.textContent)).toEqual(['62% close']);
  });

  test('the form offers The Pulse\'s kinds; no Auto-Generate; a refused pair shows the reason', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/feed-relationships/canvas') return { data: canvas };
      if (url === '/api/v1/feed-relationships/profiles') return { data: { profiles: [{ id: 1, handle: 'nia' }, { id: 2, handle: 'marcus' }] } };
      return { data: {} };
    });
    vi.mocked(api.post).mockRejectedValueOnce({ response: { data: { error: 'These two already have this relationship.' } } });
    render(<MemoryRouter><FeedRelationshipMap /></MemoryRouter>);
    expect(screen.queryByText(/Auto-Generate/)).toBeNull();
    fireEvent.click(await screen.findByText('+ Add Relationship'));
    const [a, kind, b] = screen.getAllByRole('combobox');
    expect([...kind.querySelectorAll('option')].map((o) => o.value)).toEqual([
      'collab', 'bestie', 'mentor', 'management', 'family', 'couple', 'situationship', 'ex', 'baby_daddy', 'baby_mama',
      'rival', 'feud', 'shade', 'former_friends', 'copycat', 'secret_link', 'orbit',
    ]);
    await waitFor(() => expect(a.querySelectorAll('option')).toHaveLength(3));
    fireEvent.change(a, { target: { value: '1' } });
    fireEvent.change(kind, { target: { value: 'former_friends' } });
    fireEvent.change(b, { target: { value: '2' } });
    fireEvent.click(screen.getByText(/^Create/));
    expect(await screen.findByText('These two already have this relationship.')).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/api/v1/feed-relationships', {
      influencer_a_id: 1, influencer_b_id: 2, relationship_type: 'former_friends', is_public: true,
    });
  });

  test('a seedable relationship has a Storyline button that opens the seed panel; Lala\'s has none', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { title: 'Co-Host', premise: '@nia and @marcus plan a live.', pair: { a: { handle: 'nia' }, b: { handle: 'marcus' } }, can_post: [] } });
    const { container } = render(<MemoryRouter><FeedRelationshipMap /></MemoryRouter>);
    const nia = await waitFor(() => {
      const g = [...container.querySelectorAll('g')].find((el) => el.querySelector('text')?.textContent?.includes('nia'));
      expect(g).toBeTruthy();
      return g;
    });
    fireEvent.click(nia);
    expect(await screen.findAllByRole('button', { name: /^Storyline with/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Storyline with @marcus' }));
    expect(await screen.findByTestId('pair-storyline')).toBeTruthy();
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/feed-relationships/e1/storyline-seed', { show_id: 'show-1' }));
  });

  test('says Pulse, not Feed, and carries "Where relationships disagree" (Evoni, 2026-10-23)', async () => {
    const { container } = render(<MemoryRouter><FeedRelationshipMap /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Pulse Relationship Map');
    expect(await screen.findByTestId('relationship-drift')).toBeTruthy();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/relationships/drift'));
    expect(container.textContent).not.toMatch(/feed relationship|social profile/i);
  });
});
