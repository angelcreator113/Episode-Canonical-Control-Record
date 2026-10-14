/**
 * AdminShowGate (Task #3140): a show opened by ?show= is the active show
 * everywhere. Show settings opened by a link used to edit that show while
 * the LalaVerse Overview stayed on the remembered one, so the Overview showed
 * another show's description ("ffffffff") as this one's. Two shows of the
 * same name are told apart in the selector.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const SHOWS = [
  { id: 'show-a', name: 'Styling Adventures with Lala', episodeCount: 0, description: 'ffffffff' },
  { id: 'show-b', name: 'Styling Adventures with Lala', episodeCount: 12, description: 'Lala styles her way through the LalaVerse.' },
];
vi.mock('../../services/showService', () => ({ default: { getAllShows: vi.fn(async () => SHOWS) } }));

import AdminShowGate from './AdminShowGate';
import { rememberShow, rememberedShowId } from '../../utils/activeShow';

const renderAt = (url) => render(
  <MemoryRouter initialEntries={[url]}>
    <AdminShowGate>{(showId) => <div data-testid="gated">{showId}</div>}</AdminShowGate>
  </MemoryRouter>,
);

describe('AdminShowGate', () => {
  beforeEach(() => { window.localStorage.clear(); });

  test('a show opened by ?show= becomes the remembered, active show', async () => {
    rememberShow('show-a');
    renderAt('/admin?tab=show-settings&show=show-b');
    expect((await screen.findByTestId('gated')).textContent).toBe('show-b');
    await waitFor(() => expect(rememberedShowId()).toBe('show-b'));
  });

  test('an unknown ?show= is not remembered, and the active show is used', async () => {
    rememberShow('show-a');
    renderAt('/admin?tab=show-settings&show=gone');
    expect((await screen.findByTestId('gated')).textContent).toBe('show-a');
    expect(rememberedShowId()).toBe('show-a');
  });

  test('two shows of the same name read differently in the selector', async () => {
    renderAt('/admin?show=show-b');
    const options = [...(await screen.findByTestId('admin-show-select')).querySelectorAll('option')].map((o) => o.textContent);
    expect(options).toEqual(['Styling Adventures with Lala · 0 episodes', 'Styling Adventures with Lala · 12 episodes']);
  });
});
