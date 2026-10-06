/**
 * The Society front page (the mock, 2026-10-06): real counts, real trends,
 * Lala on the ladder, the legends; a plain line where there is nothing.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import { rememberShow } from '../../utils/activeShow';
import SocietySummary from './SocietySummary';
import { LEGENDARY_GROUPS } from '../../data/legendaryGroups';

const SHOWS = [{ id: 'show-b', name: 'Styling Adventures' }];
const respond = (over = {}) => vi.mocked(api.get).mockImplementation(async (url) => {
  if (url === '/api/v1/shows') return { data: { success: true, data: SHOWS } };
  if (url.startsWith('/api/v1/social-profiles/analytics/composition')) return over.composition ?? { data: { archetypes: { the_peer: 9, soft_life: 4 } } };
  if (url === '/api/v1/feed-enhanced/show-b/trending') return over.trending ?? { data: { data: [{ topic: '#velvet', post_count: 6, total_engagement: 40 }] } };
  if (url.startsWith('/api/v1/characters/lala/state')) return over.lala ?? { data: { state: { reputation: 3 } } };
  return { data: {} };
});
const renderIt = (props = {}) => render(<MemoryRouter><SocietySummary legendGroups={LEGENDARY_GROUPS} {...props} /></MemoryRouter>);

beforeEach(() => {
  window.localStorage.clear();
  rememberShow('show-b');
  Object.values(api).forEach((fn) => fn.mockReset());
});

describe('SocietySummary', () => {
  test('the archetypes counted, the trends, Lala on her rung, and the legends', async () => {
    respond();
    const onOpen = vi.fn();
    renderIt({ onOpen });
    const arch = await screen.findByTestId('soc-archetypes');
    expect(arch.textContent).toContain('9The Peer');
    expect(screen.getByText('13 LalaVerse profiles')).toBeTruthy();
    expect(screen.getByTestId('soc-trends').textContent).toContain('#velvet');
    expect(screen.getByTestId('soc-trends').textContent).toContain('6 posts');
    const here = screen.getByText('Lala is here').closest('li');
    expect(here.textContent).toContain('Rising');
    expect(api.get).toHaveBeenCalledWith('/api/v1/characters/lala/state?show_id=show-b');
    expect(screen.getByTestId('soc-legends').textContent).toContain('Fashion Icons');
    fireEvent.click(screen.getByRole('button', { name: /Beauty Legends/ }));
    expect(onOpen).toHaveBeenCalledWith('legends', 'Beauty Legends');
  });

  test('nothing yet says so; a failed read says it could not be read', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/shows') return { data: { success: true, data: SHOWS } };
      if (url.startsWith('/api/v1/social-profiles/analytics/composition')) return { data: { archetypes: {} } };
      if (url.includes('/trending')) return { data: { data: [] } };
      throw Object.assign(new Error('x'), { response: { status: 500 } });
    });
    renderIt();
    expect((await screen.findByTestId('soc-arch-empty')).textContent).toContain('No LalaVerse profiles yet');
    expect(screen.getByTestId('soc-trends-empty').textContent).toContain('Nothing is trending yet');
    await waitFor(() => expect(screen.getByText("Lala's reputation could not be read just now.")).toBeTruthy());
    expect(screen.queryByText('Lala is here')).toBeNull();
    spy.mockRestore();
  });
});
