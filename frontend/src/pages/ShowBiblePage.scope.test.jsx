/**
 * The Show Bible reads an entry's stored scope (2026-10-04): the Franchise
 * and Show filters and badges follow franchise_knowledge.scope, never the
 * category, and a new or edited entry sends its scope with the active
 * show's id when it is show-scoped.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../services/api';
import ShowBiblePage from './ShowBiblePage';

const ENTRIES = [
  { id: 1, title: 'Gold is never text', status: 'active', severity: 'important', category: 'technical', scope: 'franchise', content: 'A franchise rule filed under a show category.' },
  { id: 2, title: 'Lala never knows', status: 'active', severity: 'critical', category: 'franchise_law', scope: 'show', show_id: '7b1d2c3e-4f50-4a61-8b72-93c4d5e6f708', content: 'A show rule filed under a franchise category.' },
];
const SHOWS = [{ id: '7b1d2c3e-4f50-4a61-8b72-93c4d5e6f708', name: 'Styling Adventures with Lala', slug: 'styling-adventures-with-lala' }];
const renderAt = (url) => render(<MemoryRouter initialEntries={[url]}><ShowBiblePage embedded /></MemoryRouter>);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url.includes('/entries')) return { data: { entries: ENTRIES, count: ENTRIES.length } };
    if (url.includes('/shows')) return { data: { data: SHOWS } };
    return { data: { documents: [], count: 0 } };
  });
  vi.mocked(api.post).mockResolvedValue({ data: { entry: {}, message: 'Entry created — pending review' } });
});

describe('Show Bible: stored scope', () => {
  test('the Franchise and Show filters follow the stored scope, not the category', async () => {
    renderAt('/universe?tab=bible&sub=knowledge');
    // Grouped by category (2026-10-06): one technical, one franchise law.
    expect((await screen.findByTestId('bible-category-count-technical')).textContent).toBe('1');
    expect(screen.getByTestId('bible-category-count-franchise_law').textContent).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: 'Franchise' }));
    expect(screen.getByRole('button', { name: 'Franchise' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByTestId('bible-category-count-franchise_law')).toBeNull();
    fireEvent.click(screen.getByTestId('bible-category-count-technical').closest('button'));
    expect(screen.getByText('Gold is never text')).toBeTruthy();
    expect(screen.queryByText('Lala never knows')).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: /Show · Styling Adventures with Lala/ }));
    expect(screen.queryByTestId('bible-category-count-technical')).toBeNull();
    fireEvent.click(screen.getByTestId('bible-category-count-franchise_law').closest('button'));
    expect(screen.getByText('Lala never knows')).toBeTruthy();
    expect(screen.queryByText('Gold is never text')).toBeNull();
  });

  test('a new show-scoped entry is sent with the active show id; a franchise one with none', async () => {
    renderAt('/universe?tab=bible&sub=knowledge');
    await screen.findByTestId('bible-category-count-technical');
    fireEvent.click(screen.getByRole('button', { name: /New Entry/ }));
    fireEvent.change(screen.getByPlaceholderText('Entry title...'), { target: { value: 'Season 2 opens in Paris' } });
    fireEvent.change(screen.getByPlaceholderText('Entry content...'), { target: { value: 'Locked.' } });
    await screen.findByRole('option', { name: /Show · Styling Adventures with Lala/ });
    fireEvent.change(screen.getByLabelText('Scope'), { target: { value: 'show' } });
    fireEvent.click(screen.getByRole('button', { name: /Create/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls[0][1]).toMatchObject({ title: 'Season 2 opens in Paris', scope: 'show', show_id: '7b1d2c3e-4f50-4a61-8b72-93c4d5e6f708' });

    fireEvent.click(screen.getByRole('button', { name: /New Entry/ }));
    fireEvent.change(screen.getByPlaceholderText('Entry title...'), { target: { value: 'Fashion is strategy' } });
    fireEvent.change(screen.getByPlaceholderText('Entry content...'), { target: { value: 'Always.' } });
    fireEvent.click(screen.getByRole('button', { name: /Create/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(api.post.mock.calls[1][1]).toMatchObject({ scope: 'franchise', show_id: null });
  });
});
