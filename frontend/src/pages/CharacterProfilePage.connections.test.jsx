/**
 * Connections to Evoni's mock (2026-10-18, step 4 of the character page):
 * the overview with counts, filters, search and pages; the map; feed ties;
 * where they belong. Each person is listed once (2026-10-24): the Key
 * relationships and Relationship history lists are gone, a summary line and
 * each row's "Since …" say the same.
 */
import React from 'react';
import { vi, describe, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../config/api', () => ({ API_URL: '/api/v1' }));

import { RelationshipOverview, ConnectionMap, FeedTies } from './CharacterProfilePage';

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
    // The Relationships page opens with this person selected (?char=; 2026-10-23).
    const links = screen.getAllByRole('link', { name: /Relationship Engine|Add connection/ });
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/relationships?char=c1', '/relationships?char=c1']);
  });

  test('View full map opens the Web with this person selected', () => {
    inRouter(<ConnectionMap character={CHARACTER} relationships={many} />);
    expect(screen.getByRole('link', { name: 'View full map' }).getAttribute('href')).toBe('/relationships?char=c1&tab=web');
  });
});

describe('the map and feed ties', () => {
  test('the map: six of eight around them, with a legend', () => {
    inRouter(<ConnectionMap character={CHARACTER} relationships={many} />);
    const card = screen.getByTestId('ch-conn-map');
    expect(card.querySelectorAll('.ch-cm-line')).toHaveLength(6);
    expect(within(card).getByRole('list', { name: 'Line colours' }).textContent).toBe('FriendsRivals');
    expect(card.textContent).toContain('The 6 closest of 8.');
  });

  test('the centre is them by their chosen name, not their feed handle', () => {
    inRouter(<ConnectionMap character={{ id: 'm', display_name: 'Truthville', selected_name: 'Marcus Hale' }} relationships={many} />);
    const centre = screen.getByTestId('ch-conn-map').querySelector('.ch-cm-node.is-centre');
    expect(centre.textContent).toBe('MMarcus Hale');
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

describe("each connection with its story truth (the person read, 2026-10-23)", () => {
  test('inside its own row, not a second list: stage, heart, Secret, different online, its link', () => {
    const truth = [{ id: 'r3', other: { id: 'p3', name: 'Person 3' }, kind: 'friend', stage: 'lovers', love_interest: true, public_state: 'secret', public_label: 'Secret',
      known_by: ['Jade'], online: { differs: true, says: 'bestie' }, link: '/relationships?rel=r3' }];
    inRouter(<RelationshipOverview character={CHARACTER} relationships={many.slice(0, 4)} truth={truth} />);
    const rows = screen.getAllByTestId('ch-conn');
    expect(rows).toHaveLength(4);
    const row = rows.find((li) => li.textContent.includes('Person 3'));
    expect(within(row).getByRole('img', { name: 'Love interest' })).toBeTruthy();
    expect(within(row).getByText('now lovers')).toBeTruthy();
    expect(within(row).getByText('Secret')).toBeTruthy();
    expect(within(row).getByText('Different online')).toBeTruthy();
    expect(within(row).getByRole('link', { name: /Open in Relationships/ }).getAttribute('href')).toBe('/relationships?rel=r3');
    // The others have no truth row yet: nothing added.
    expect(rows.filter((li) => li.querySelector('.prl'))).toHaveLength(1);
  });
});

describe('the character page Connections (2026-10-24 audit)', () => {
  // As the before shots: Marcus Hale (online as Truthville), three people.
  const MARCUS = { id: 'marcus', display_name: 'Truthville', selected_name: 'Marcus Hale' };
  const conns = [
    { id: 'rel-lm', related_id: 'lala', related_name: 'Lala', relationship_type: 'love_interest', tension_state: 'volatile', created_at: '2026-10-02T10:00:00Z' },
    { id: 'rel-mt', related_id: 'tasha', related_name: 'Tasha Vaughn', relationship_type: 'collaborator', tension_state: 'simmering', created_at: '2026-09-12T10:00:00Z' },
    { id: 'rel-md', related_id: 'dre', related_name: 'Dre Coleman', relationship_type: 'rival', tension_state: 'volatile', created_at: '2026-10-10T10:00:00Z' },
  ];

  test('the love interest is filed under Romance and comes first in Closest first; a summary line, no second list', () => {
    inRouter(<RelationshipOverview character={MARCUS} relationships={conns} />);
    const card = screen.getByTestId('ch-rel-overview');
    const rows = within(card).getAllByTestId('ch-conn');
    expect(rows.map((li) => li.querySelector('.ch-conn-name').textContent)).toEqual(['Lala', 'Tasha Vaughn', 'Dre Coleman']);
    expect(rows[0].querySelector('.ch-conn-meta').textContent).toBe('RomanceSince Oct 2, 2026');
    expect(within(card).getByRole('group', { name: 'Show connections' }).textContent).toBe('All (3)Close (0)Romance (1)Working (1)Rivals (1)');
    expect(within(card).getByTestId('ch-ro-summary').textContent).toBe('Romance: Lala · Closest: Tasha Vaughn');
    expect(card.textContent).toContain('The people in Marcus’s world');
  });

  test('a spouse is Romance with their role, not Family', () => {
    inRouter(<RelationshipOverview character={MARCUS} relationships={[{ id: 's', related_name: 'Dana', relationship_type: 'family', family_role: 'wife', is_romantic: true }]} />);
    const row = screen.getByTestId('ch-conn');
    expect(row.querySelector('.ch-chip').textContent).toBe('Wife');
    expect(row.querySelector('.ch-conn-meta').textContent).toBe('Romance');
  });
});
