/**
 * World Studio's Feed tab is the one home for making Feed profiles (Task
 * #2761): it makes them for both feeds, LalaVerse and real world, and a
 * link can open one profile (?profile=, a friend from the Feed page).
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));
vi.mock('./RelationshipEngine', () => ({ default: () => null }));
vi.mock('./SocialProfileGenerator', () => ({
  default: ({ defaultFeedLayer, embedded, initialProfileId }) => (
    <div data-testid="generator">layer={defaultFeedLayer} embedded={String(embedded)} profile={String(initialProfileId)}</div>
  ),
}));

import api from '../services/api';
import WorldStudio from './WorldStudio';

const renderAt = (url) => render(<MemoryRouter initialEntries={[url]}><WorldStudio /></MemoryRouter>);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockResolvedValue({ data: {} });
  vi.mocked(api.post).mockResolvedValue({ data: {} });
  // World Studio also reads some lists with fetch; they are not under test here.
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })));
});

describe('World Studio Feed tab', () => {
  test('a link opens the LalaVerse feed at one profile; the switch moves to the real world', async () => {
    renderAt('/world-studio?tab=feed&layer=lalaverse&profile=9');
    expect((await screen.findByTestId('generator')).textContent).toBe('layer=lalaverse embedded=true profile=9');
    expect(screen.getByTestId('ws4-feed-layer-lalaverse').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByTestId('ws4-feed-layer-real_world'));
    expect((await screen.findByTestId('generator')).textContent).toContain('layer=real_world');
    expect(screen.getByTestId('ws4-feed-layer-real_world').getAttribute('aria-selected')).toBe('true');
  });

  test('with no ?layer= it opens on the real world, as before', async () => {
    renderAt('/world-studio?tab=feed');
    expect((await screen.findByTestId('generator')).textContent).toBe('layer=real_world embedded=true profile=null');
  });
});
