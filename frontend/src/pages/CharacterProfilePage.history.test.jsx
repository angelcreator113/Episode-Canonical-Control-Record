/**
 * Fact history on the character page (the spec's #1; Evoni, 2026-10-17):
 * loads when opened; each change with what it was, what it became, when in
 * the story and why.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../config/api', () => ({ API_URL: '/api/v1' }));
vi.mock('../components/CharacterDepthPanel', () => ({ default: () => null }));

import api from '../services/api';
import { FactHistory } from './CharacterProfilePage';

const HISTORY = [
  { at: '2030-03-02T10:00:00.000Z', story_order: 47, story_label: 'After Ep 4', fact: 'occupation', label: 'Occupation', from: 'Creator', to: 'Creator and reseller', reason: 'After the swap', by: 'evoni@x.dev', source: 'fact_sheet' },
  { at: '2030-03-01T10:00:00.000Z', story_order: 0, story_label: 'Backstory', fact: 'followers', label: 'Followers', from: null, to: '1M', reason: 'Where she started', by: 'auto', source: 'followers' },
];

const open = () => {
  const box = screen.getByTestId('ch-history');
  box.open = true;
  fireEvent(box, new Event('toggle'));
  return box;
};

describe('FactHistory', () => {
  beforeEach(() => api.get.mockReset());

  test('loads when opened and lists each change, newest first', async () => {
    api.get.mockResolvedValue({ data: { success: true, history: HISTORY } });
    render(<FactHistory characterId="c1" />);
    expect(api.get).not.toHaveBeenCalled();
    open();
    const items = await screen.findAllByTestId('ch-history-item');
    expect(api.get).toHaveBeenCalledWith('/api/v1/cast/characters/c1/facts/history');
    expect(items[0].textContent).toContain('Occupation Creator → Creator and reseller');
    expect(items[0].textContent).toContain('After Ep 4 · evoni@x.dev');
    expect(within(items[0]).getByText('After the swap')).toBeTruthy();
    expect(items[1].textContent).toContain('Followers set to 1M');
  });

  test('no changes yet says so', async () => {
    api.get.mockResolvedValue({ data: { success: true, history: [] } });
    render(<FactHistory characterId="c1" />);
    open();
    expect(await screen.findByText(/No changes yet/)).toBeTruthy();
  });
});
