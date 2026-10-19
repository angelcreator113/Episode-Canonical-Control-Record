/**
 * Connections to Evoni's mock (2026-10-18, step 4 of the character page):
 * the overview with counts, filters, search and pages; the map; key
 * relationships; history; feed ties; where they belong.
 */
import React from 'react';
import { vi, describe, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../config/api', () => ({ API_URL: '/api/v1' }));

import { RelationshipOverview, ConnectionMap, KeyRelationships, RelationshipHistory, FeedTies } from './CharacterProfilePage';

const inRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);
const CHARACTER = { id: 'c1', display_name: 'STUDIO BY SABLE', selected_name: 'Sable Okonkwo-Reyes', portrait_url: '/p.jpg' };
const many = Array.from({ length: 8 }, (_, i) => ({
  id: `r${i}`, related_id: `p${i}`, related_name: `Person ${i}`, relationship_type: i < 2 ? 'rival' : 'friend',
  tension_state: i % 2 ? 'calm' : 'simmering', created_at: `2026-10-0${i + 1}T10:00:00Z`, related_portrait: i === 0 ? '/r0.jpg' : null,
}));

describe('Relationship overview', () => {
  test('counts, five to a page, filters with counts, search', () => {
    inRouter(<RelationshipOverview character={CHARACTER} relationships={many} />);
    const card = screen.getByTestId('ch-rel-overview');
    expect(card.textContent).toContain('The people in Sable’s world');
    expect(within(card).getAllByRole('listitem').filter((li) => li.className.includes('ch-ro-tile')).map((li) => li.textContent))
      .toEqual(['8Total connections', '4Close', '0Working with', '2Rivals']);
    expect(within(card).getAllByTestId('ch-conn')).toHaveLength(5);
    // Filters show only groups someone is in.
    expect(within(card).getByRole('group', { name: 'Show connections' }).textContent).toBe('All (8)Close (4)Friends (6)Rivals (2)');
    fireEvent.click(within(card).getByRole('button', { name: 'Rivals (2)' }));
    expect(within(card).getAllByTestId('ch-conn').map((li) => li.querySelector('.ch-conn-name').textContent)).toEqual(['Person 1', 'Person 0']);
    fireEvent.click(within(card).getByRole('button', { name: 'All (8)' }));
    fireEvent.change(within(card).getByLabelText('Search connections'), { target: { value: 'person 7' } });
    expect(within(card).getAllByTestId('ch-conn')).toHaveLength(1);
    expect(within(card).getByRole('link', { name: 'Person 7' }).getAttribute('href')).toBe('/character/p7');
    fireEvent.change(within(card).getByLabelText('Search connections'), { target: { value: 'nobody' } });
    expect(card.textContent).toContain('No one matches.');
  });

  test('sorted newest first on request', () => {
    inRouter(<RelationshipOverview character={CHARACTER} relationships={many} />);
    const card = screen.getByTestId('ch-rel-overview');
    fireEvent.change(within(card).getByLabelText('Sort connections'), { target: { value: 'newest' } });
    expect(within(card).getAllByTestId('ch-conn')[0].textContent).toContain('Person 7');
    expect(within(card).getAllByTestId('ch-conn')[0].textContent).toContain('Since Oct 8, 2026');
  });

  test('none yet: where to add them', () => {
    inRouter(<RelationshipOverview character={CHARACTER} relationships={[]} />);
    expect(screen.getByTestId('ch-rel-overview').textContent).toContain('No relationships yet.');
    expect(screen.getAllByRole('link', { name: /Relationship Engine|Add connection/ })[0].getAttribute('href')).toBe('/relationships');
  });
});

describe('the map, key relationships, history and feed ties', () => {
  test('the map: six of eight around them, with a legend', () => {
    inRouter(<ConnectionMap character={CHARACTER} relationships={many} />);
    const card = screen.getByTestId('ch-conn-map');
    expect(card.querySelectorAll('.ch-cm-line')).toHaveLength(6);
    expect(within(card).getByRole('list', { name: 'Line colours' }).textContent).toBe('FriendsRivals');
    expect(card.textContent).toContain('The 6 closest of 8.');
  });

  test('key relationships: three, with a way to their page', () => {
    inRouter(<KeyRelationships relationships={many} />);
    const card = screen.getByTestId('ch-key-rels');
    expect(within(card).getAllByRole('link', { name: /View/ })).toHaveLength(3);
    // The closest (calm) first; no portrait, so their initial.
    expect(within(card).getAllByRole('listitem').map((li) => li.textContent.slice(0, 9))).toEqual(['PPerson 1', 'PPerson 3', 'PPerson 5']);
    expect(card.querySelector('img')).toBeNull();
  });

  test('history: four to a page, newest first', () => {
    inRouter(<RelationshipHistory relationships={many} />);
    const card = screen.getByTestId('ch-rel-history');
    const items = within(card).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[0].textContent).toBe('Oct 8, 2026Connected with Person 7Friend');
  });

  test('feed ties, and none', () => {
    const { unmount } = inRouter(<FeedTies entanglements={[{ id: 'e1', dimension: 'ambition_identity', intensity: 'medium', directionality: 'mutual', turbulence_flag: true, profile: { id: 9, handle: '@slowsift' } }]} />);
    const card = screen.getByTestId('ch-feed-ties');
    expect(within(card).getByRole('link', { name: '@slowsift' }).getAttribute('href')).toBe('/pulse?profile=9');
    expect(card.textContent).toContain('Ambition identity · Mutual');
    expect(card.textContent).toContain('Turbulent');
    unmount();
    inRouter(<FeedTies entanglements={{}} />);
    expect(screen.getByTestId('ch-feed-ties').textContent).toContain('No Pulse ties yet.');
  });
});
