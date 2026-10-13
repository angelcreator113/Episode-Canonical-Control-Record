/**
 * The Relationship Map shows each pair's Pulse closeness, read only
 * (Task 3072): the canvas is asked for the active show, and a selected
 * profile's relationships show how close each pair is.
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
    { id: 'e1', source: 1, target: 2, type: 'collab', closeness: 0.62 },
    { id: 'e2', source: 1, target: 3, type: 'orbit', closeness: null },
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
});
