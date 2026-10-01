/**
 * Episode title approval + title card (Task #2386, ruling P11).
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeTitleCard, { formatEstimate } from './EpisodeTitleCard';

const EPISODE = { id: 'ep-1', show_id: 'show-1', title: 'Gala Night' };
const ESTIMATE = { usd: 0.04, priced: true, unit: 'megapixel', units: 1, model: 'fal-ai/flux-pro/v1.1' };

const state = (over = {}) => ({
  title: 'Gala Night', approved: false, approved_at: null, approved_value: null, card: null, offer: { offered: false },
  ...over,
});
const ok = (data) => Promise.resolve({ data: { success: true, data } });

describe('EpisodeTitleCard', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
  });

  test('not approved: "Approve title"; approving shows the design offer with its cost', async () => {
    vi.mocked(api.get).mockReturnValue(ok(state()));
    vi.mocked(api.post).mockReturnValue(ok(state({
      approved: true, approved_value: 'Gala Night',
      offer: { offered: true, kind: 'design', requires_approval: false, estimate: ESTIMATE },
    })));
    render(<EpisodeTitleCard episode={EPISODE} />);

    fireEvent.click(await screen.findByRole('button', { name: /Approve title/ }));
    expect(api.post).toHaveBeenCalledWith('/api/v1/episodes/ep-1/title/approve', { title: 'Gala Night' });
    expect(await screen.findByRole('button', { name: 'Full-screen framed card — est. $0.04' })).toBeTruthy();
    expect(screen.getByTestId('etc-approved')).toBeTruthy();
  });

  test('design posts to the episode and shows the new card', async () => {
    vi.mocked(api.get).mockReturnValue(ok(state({
      approved: true, offer: { offered: true, kind: 'design', requires_approval: false, estimate: ESTIMATE },
    })));
    vi.mocked(api.post).mockReturnValue(ok({
      assetId: 'a1', imageUrl: 'https://img/card.png', title: 'Gala Night',
      state: state({ approved: true, card: { asset_id: 'a1', designed_for: 'Gala Night', outdated: false, image_url: 'https://img/card.png' } }),
    }));
    render(<EpisodeTitleCard episode={EPISODE} />);

    fireEvent.click(await screen.findByRole('button', { name: /Full-screen framed card/ }));
    expect(api.post).toHaveBeenCalledWith('/api/v1/episodes/ep-1/title-card');
    const img = await screen.findByTestId('etc-thumb');
    expect(img.getAttribute('src')).toBe('https://img/card.png');
    expect(screen.queryByRole('button', { name: /Full-screen framed card/ })).toBeNull();
  });

  test('outdated card: "Title changed — card outdated" and a redesign that approves the new title first', async () => {
    vi.mocked(api.get).mockReturnValue(ok(state({
      title: 'Gala Night II', approved_value: 'Gala Night',
      card: { asset_id: 'a1', designed_for: 'Gala Night', outdated: true, image_url: 'https://img/old.png' },
      offer: { offered: true, kind: 'redesign', requires_approval: true, estimate: ESTIMATE },
    })));
    vi.mocked(api.post).mockImplementation((url) => (url.endsWith('/title/approve')
      ? ok(state({ approved: true }))
      : ok({ state: state({ approved: true, card: { asset_id: 'a2', designed_for: 'Gala Night II', outdated: false, image_url: 'https://img/new.png' } }) })));
    render(<EpisodeTitleCard episode={{ ...EPISODE, title: 'Gala Night II' }} />);

    expect(await screen.findByTestId('etc-outdated')).toBeTruthy();
    expect(screen.getByText(/Title changed — card outdated/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Approve title$/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Approve title & redesign (est. $0.04)' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.post).mock.calls[0]).toEqual(['/api/v1/episodes/ep-1/title/approve', { title: 'Gala Night II' }]);
    expect(vi.mocked(api.post).mock.calls[1]).toEqual(['/api/v1/episodes/ep-1/title-card']);
    await waitFor(() => expect(screen.getByTestId('etc-thumb').getAttribute('src')).toBe('https://img/new.png'));
  });

  test('a budget refusal shows its message', async () => {
    vi.mocked(api.get).mockReturnValue(ok(state({
      approved: true, offer: { offered: true, kind: 'design', requires_approval: false, estimate: { ...ESTIMATE, usd: null, priced: false } },
    })));
    vi.mocked(api.post).mockRejectedValue(Object.assign(new Error('Request failed'), {
      response: { status: 429, data: { error: 'Daily image budget reached.' } },
    }));
    render(<EpisodeTitleCard episode={EPISODE} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Full-screen framed card — est. price not set' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Daily image budget reached.');
  });

  test('formatEstimate', () => {
    expect(formatEstimate({ usd: 0.04 })).toBe('$0.04');
    expect(formatEstimate({ usd: 0.12 })).toBe('$0.12');
    expect(formatEstimate({ usd: null })).toBe('price not set');
    expect(formatEstimate(null)).toBe('price not set');
  });
});
