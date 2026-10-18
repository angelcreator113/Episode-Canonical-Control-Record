/**
 * The cast rollout on The Cast page: checks the whole cast on request and
 * lists each character's next step, findings, voice, type and facts.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import api from '../../services/api';
import CastFacts from './CastFacts';

const FACTS = { handle: 'set', followers: 'estimate', account_status: 'set', income: 'undecided', occupation: 'missing', major_possessions: 'missing' };
const DATA = {
  success: true,
  summary: { characters: 2, ready: 1, with_findings: 1, without_voice: 1 },
  characters: [
    { id: 'c1', name: 'Maren', handle: '@slowsift', facts: FACTS, findings: 2, intentional: 1, voice: 'none', typology: null, todo: ['Fix 2 findings', 'Set their facts: confirm followers, occupation', 'Build their voice'], ready: false },
    { id: 'c2', name: 'Nia', handle: '@nia', facts: { ...FACTS, followers: 'set', occupation: 'set', major_possessions: 'set' }, findings: 0, voice: 'approved', typology: 'Type 7w8, The Enthusiast', todo: [], ready: true },
  ],
};

describe('CastFacts', () => {
  beforeEach(() => { api.get.mockReset(); });

  test('checks the cast on request, the next step first, each name opening their page', async () => {
    api.get.mockResolvedValue({ data: DATA });
    render(<MemoryRouter><CastFacts registryIds={['r1', 'r2']} /></MemoryRouter>);
    expect(api.get).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Check the whole cast'));
    expect((await screen.findByTestId('cast-facts-summary')).textContent).toBe('2 characters · 1 ready · 1 with findings · 1 without a voice');
    expect(api.get).toHaveBeenCalledWith('/api/v1/cast/consistency?registry_id=r1%2Cr2');
    const [maren, nia] = screen.getAllByTestId('cast-facts-row');
    expect(within(maren).getByText('Next: Fix 2 findings')).toBeTruthy();
    expect(within(maren).getByText('Then: Set their facts: confirm followers, occupation · Build their voice')).toBeTruthy();
    expect(within(maren).getByText('2 findings')).toBeTruthy();
    expect(within(maren).getByText('No voice')).toBeTruthy();
    expect(within(maren).getByText('Income: not decided')).toBeTruthy();
    expect(within(maren).getByText('Followers: estimate')).toBeTruthy();
    expect(within(maren).getByRole('link', { name: 'Maren' }).getAttribute('href')).toBe('/character/c1');
    expect(within(nia).getByText('Ready')).toBeTruthy();
    expect(within(nia).getByText('Type 7w8, The Enthusiast')).toBeTruthy();
    expect(screen.getByText('Check again')).toBeTruthy();
  });

  test('a failed check says so', async () => {
    api.get.mockRejectedValue({ response: { data: { error: 'registry_id must be one or more registry ids (UUIDs), comma-separated' } } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<MemoryRouter><CastFacts registryIds={['r1']} /></MemoryRouter>);
    fireEvent.click(screen.getByText('Check the whole cast'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/registry ids/);
  });
});
