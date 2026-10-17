/**
 * Across the cast (the spec's #2; Evoni, 2026-10-17): contradictions
 * between characters, loaded on request, each naming whose post or profile
 * says it and linking to them.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));

import api from '../../services/api';
import CastCrossCheck from './CastCrossCheck';

const FLAGS = [
  { id: 'f1', check: 'at_event', character_id: 'nia', character_name: 'Nia', where: 'Draft post', post_id: 'p1', event_name: 'Linen Gala',
    found: 'the post puts Nia at Linen Gala', expected: 'Nia is not on the guest list of Linen Gala', excerpt: "I'm at the Linen Gala" },
  { id: 'f2', check: 'other_followers', character_id: 'maren', character_name: 'Maren', other_id: 'kai', other_name: 'Kai', where: 'Profile: Description',
    found: '1.2M followers', expected: 'Kai has 50k followers', excerpt: 'Her rival Kai has 1.2M followers.' },
];
const view = (ids = ['r1']) => render(<MemoryRouter><CastCrossCheck registryIds={ids} /></MemoryRouter>);

describe('CastCrossCheck', () => {
  beforeEach(() => api.get.mockReset());

  test('loads on request and lists each contradiction, whose it is, and who it is about', async () => {
    api.get.mockResolvedValue({ data: { success: true, flags: FLAGS, summary: { characters: 3, posts_checked: 4, flags: 2, characters_flagged: 2 } } });
    view(['r1', 'r2']);
    expect(api.get).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Check across the cast'));
    expect((await screen.findByTestId('cast-cross-summary')).textContent).toBe('2 contradictions involving 2 characters (3 checked, 4 posts).');
    expect(api.get).toHaveBeenCalledWith('/api/v1/cast/cross-check?registry_id=r1%2Cr2');
    const rows = screen.getAllByTestId('cast-cross-row');
    expect(within(rows[0]).getByText('At an event they weren’t at')).toBeTruthy();
    expect(within(rows[0]).getByRole('link', { name: 'Nia' }).getAttribute('href')).toBe('/character/nia');
    expect(rows[0].textContent).toContain(': the post puts Nia at Linen Gala; but Nia is not on the guest list of Linen Gala.');
    expect(within(rows[1]).getByRole('link', { name: 'Kai' }).getAttribute('href')).toBe('/character/kai');
    expect(screen.getByText('Check again')).toBeTruthy();
  });

  test('no contradictions says so; an error says why', async () => {
    api.get.mockResolvedValueOnce({ data: { success: true, flags: [], summary: { characters: 1, posts_checked: 1, flags: 0, characters_flagged: 0 } } });
    view();
    fireEvent.click(screen.getByText('Check across the cast'));
    expect((await screen.findByTestId('cast-cross-summary')).textContent).toBe('No contradictions between 1 character (1 post checked).');
    api.get.mockRejectedValueOnce({ response: { data: { error: 'registry_id must be one or more registry ids (UUIDs), comma-separated' } } });
    fireEvent.click(screen.getByText('Check again'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/registry_id must be/);
  });
});
