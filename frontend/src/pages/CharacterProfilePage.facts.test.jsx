/**
 * "Their facts" on the character page (Character Consistency Engine step 2;
 * Evoni, 2026-10-16).
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../config/api', () => ({ API_URL: '/api/v1' }));
vi.mock('../components/CharacterDepthPanel', () => ({ default: () => null }));

import api from '../services/api';
import { TheirFacts } from './CharacterProfilePage';

const FACTS = {
  feed_linked: true, handle: '@slowsift', account_status: 'gone_dark',
  followers: { count: 2000000, label: '2M', source: 'ledger' },
  income: { amount: 15000, cadence: 'per_month', source: 'Brand deals' }, occupation: 'Content creator',
  major_possessions: [], affordability: { key: 'well_off', label: 'Well off', yearly: 180000 }, undecided: ['major_possessions'],
};
const renderCard = (onFeedSaved = vi.fn()) => render(<MemoryRouter><TheirFacts character={{ id: 'c1' }} onFeedSaved={onFeedSaved} /></MemoryRouter>);

describe('Their facts', () => {
  beforeEach(() => { api.get.mockReset(); api.put.mockReset(); api.post.mockReset(); });

  test('shows each fact once, with undecided ones marked', async () => {
    api.get.mockResolvedValue({ data: { facts: FACTS } });
    renderCard();
    const card = await screen.findByTestId('ch-facts');
    expect(await within(card).findByText('@slowsift')).toBeTruthy();
    expect(within(card).getByText('2M')).toBeTruthy();
    expect(within(card).getByText('Gone dark')).toBeTruthy();
    expect(within(card).getByText('$15,000 per month · Brand deals')).toBeTruthy();
    expect(within(card).getByText('Not decided yet')).toBeTruthy();
    expect(within(card).getByText('Well off ($180,000 a year)')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/api/v1/cast/characters/c1/facts');
  });

  test('editing followers asks why, and sends only what changed', async () => {
    api.get.mockResolvedValue({ data: { facts: FACTS } });
    api.put.mockResolvedValue({ data: { facts: { ...FACTS, followers: { count: 2500000, label: '2.5M', source: 'ledger' } } } });
    const onFeedSaved = vi.fn();
    renderCard(onFeedSaved);
    fireEvent.click(await screen.findByText('Edit facts'));
    fireEvent.change(screen.getByLabelText('Followers', { selector: 'input[type=number]' }), { target: { value: '2500000' } });
    fireEvent.change(screen.getByLabelText('Why the followers changed'), { target: { value: 'The live went viral' } });
    fireEvent.click(screen.getByText('Save facts'));
    await screen.findByText('Saved.');
    const [url, body] = api.put.mock.calls[0];
    expect(url).toBe('/api/v1/cast/characters/c1/facts');
    expect(body.followers).toEqual({ count: 2500000, reason: 'The live went viral' });
    expect(body).not.toHaveProperty('handle');
    expect(body).not.toHaveProperty('account_status');
    expect(onFeedSaved).toHaveBeenCalledWith(expect.objectContaining({ follower_count_approx: '2.5M' }));
  });

  test('a refused save says why', async () => {
    api.get.mockResolvedValue({ data: { facts: FACTS } });
    api.put.mockRejectedValue(Object.assign(new Error('x'), { response: { data: { error: 'A handle is one @ then letters' } } }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderCard();
    fireEvent.click(await screen.findByText('Edit facts'));
    fireEvent.change(screen.getByLabelText('Handle', { selector: 'input:not([type=checkbox])' }), { target: { value: '@@bad' } });
    fireEvent.click(screen.getByText('Save facts'));
    expect((await screen.findByRole('alert')).textContent).toBe('A handle is one @ then letters');
  });

  test('Suggest facts from their profile fills the missing ones in the form; nothing saves until Save facts', async () => {
    const bare = { ...FACTS, income: null, occupation: null, major_possessions: [], affordability: null, undecided: [] };
    api.get.mockResolvedValue({ data: { facts: bare } });
    api.post.mockResolvedValue({ data: { success: true, fills: ['occupation', 'income', 'major_possessions'],
      proposal: { occupation: 'Slow-fashion creator', income: { amount: 240000, cadence: 'per_year', source: 'Brand deals' }, major_possessions: ['A linen studio', 'A 1974 Vespa'] },
      why: 'Her career says brand deals.' } });
    api.put.mockResolvedValue({ data: { facts: { ...bare, occupation: 'Slow-fashion creator' } } });
    renderCard();
    fireEvent.click(await screen.findByText('Suggest facts from their profile'));
    expect(await screen.findByText(/Suggested from their profile: Her career says brand deals\. Save to keep it, or change it first\./)).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/api/v1/cast/characters/c1/facts/suggest');
    expect(screen.getByLabelText('Occupation', { selector: 'input:not([type=checkbox])' }).value).toBe('Slow-fashion creator');
    expect(screen.getByLabelText('Major possessions', { selector: 'input:not([type=checkbox])' }).value).toBe('A linen studio, A 1974 Vespa');
    expect(screen.getByPlaceholderText('Amount').value).toBe('240000');
    expect(api.put).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Save facts'));
    await screen.findByText('Saved.');
    expect(api.put).toHaveBeenCalledWith('/api/v1/cast/characters/c1/facts', expect.objectContaining({
      occupation: 'Slow-fashion creator',
      income: { amount: 240000, cadence: 'per_year', source: 'Brand deals' },
      major_possessions: ['A linen studio', 'A 1974 Vespa'],
    }));
  });

  test('no Suggest button when nothing is missing; a refused suggestion says why', async () => {
    api.get.mockResolvedValue({ data: { facts: FACTS } });
    const { unmount } = renderCard();
    await screen.findByText('Edit facts');
    expect(screen.queryByText('Suggest facts from their profile')).toBeNull();
    unmount();
    api.get.mockResolvedValue({ data: { facts: { ...FACTS, occupation: null } } });
    api.post.mockRejectedValue({ response: { data: { error: 'There is nothing written about them yet to read their facts from.' } } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderCard();
    fireEvent.click(await screen.findByText('Suggest facts from their profile'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/nothing written about them/);
  });
});
