/**
 * EpisodeDistributionTab — Track 6 CP11 behavioral tests (file 13 of 17).
 *
 * 3 fetch sites migrated via 3 fresh helpers (no cross-CP overlap).
 * Per-platform publishing metadata family.
 */

import { vi, describe, beforeEach, test, expect } from 'vitest';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    request: vi.fn(),
  },
}));

import apiClient from '../../services/api';
import {
  getEpisodeDistributionApi,
  putEpisodeDistributionApi,
  generateEpisodeDistributionApi,
} from './EpisodeDistributionTab';

describe('EpisodeDistributionTab — Track 6 CP11 module-scope helpers', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getEpisodeDistributionApi GET on /world/:showId/episodes/:id/distribution', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: {} } });
    await getEpisodeDistributionApi('s-1', 'ep-1');
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/world/s-1/episodes/ep-1/distribution',
    );
  });

  test('putEpisodeDistributionApi PUT on …/distribution with distribution_metadata wrapper', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
    const meta = { youtube: { enabled: true } };
    await putEpisodeDistributionApi('s-1', 'ep-1', meta);
    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/v1/world/s-1/episodes/ep-1/distribution',
      { distribution_metadata: meta },
    );
  });

  test('generateEpisodeDistributionApi POST on …/generate-distribution returns response.data', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { success: true, data: { platforms: { youtube: {} } } },
    });
    const out = await generateEpisodeDistributionApi('s-1', 'ep-1', {});
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/world/s-1/episodes/ep-1/generate-distribution',
      {},
    );
    expect(out.success).toBe(true);
  });

  describe('Error path propagation', () => {
    test('getEpisodeDistributionApi rejection propagates (caller falls through to defaults)', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('not found'));
      await expect(getEpisodeDistributionApi('s', 'ep')).rejects.toThrow('not found');
    });

    test('putEpisodeDistributionApi rejection propagates (caller falls back to onUpdate)', async () => {
      vi.mocked(apiClient.put).mockRejectedValue(new Error('forbidden'));
      await expect(putEpisodeDistributionApi('s', 'ep', {})).rejects.toThrow('forbidden');
    });

    test('generateEpisodeDistributionApi rejection propagates (caller alerts)', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('rate limited'));
      await expect(generateEpisodeDistributionApi('s', 'ep', {})).rejects.toThrow('rate limited');
    });
  });
});

// The one thumbnail editor (Evoni, 2026-10-20): the tab shows the episode's
// thumbnail and links to Templates › YouTube thumbnails; it uploads nothing.
vi.mock('./StyleSheetDistributionCard', () => ({ default: () => null }));

describe('EpisodeDistributionTab — thumbnail', () => {
  const renderTab = async (episode) => {
    const { render, screen } = await import('@testing-library/react');
    const { MemoryRouter } = await import('react-router-dom');
    const { default: Tab } = await import('./EpisodeDistributionTab');
    render(<MemoryRouter><Tab episode={episode} onUpdate={() => {}} /></MemoryRouter>);
    return screen;
  };

  test('an enabled platform shows the episode\'s thumbnail and an Edit link to the editor', async () => {
    const screen = await renderTab({
      id: 'ep-1', show_id: 'show-1', title: 'Studio by Sable', thumbnail_url: 'https://b.s3.amazonaws.com/t.png',
      distribution_metadata: { youtube: { enabled: true, title: 'Studio by Sable', hashtags: [] } },
    });
    const box = await screen.findByTestId('distribution-thumbnail');
    expect(box.querySelector('img').getAttribute('src')).toBe('https://b.s3.amazonaws.com/t.png');
    const link = screen.getByRole('link', { name: 'Edit in Thumbnail Studio' });
    expect(link.getAttribute('href')).toBe('/template-studio/youtube?show=show-1&episode=ep-1');
    expect(screen.queryByRole('button', { name: /Upload Thumbnail|Remove/ })).toBeNull();
  });

  test('with no thumbnail yet it offers to make one there', async () => {
    const screen = await renderTab({
      id: 'ep-2', show_id: 'show-1', title: 'x',
      distribution_metadata: { youtube: { enabled: true, title: 'x', hashtags: [] } },
    });
    expect((await screen.findByRole('link', { name: 'Make it in Thumbnail Studio' })).getAttribute('href'))
      .toBe('/template-studio/youtube?show=show-1&episode=ep-2');
  });
});

// Evoni, 2026-10-22 (Results layout): Share (the teaser, platform copy,
// Pulse posts) sits at the top of Distribution; the tab is full width; Save
// follows along the bottom while there are unsaved changes.
describe('EpisodeDistributionTab — share and save', () => {
  test('Share is at the top; editing a field brings up the save bar, which saves', async () => {
    const { render, screen, fireEvent, waitFor, within } = await import('@testing-library/react');
    const { MemoryRouter } = await import('react-router-dom');
    const { default: Tab } = await import('./EpisodeDistributionTab');
    vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: [] } });
    vi.mocked(apiClient.put).mockResolvedValue({ data: { success: true } });
    const onOpenTab = vi.fn();
    render(<MemoryRouter><Tab episode={{ id: 'ep-1', show_id: 'show-1', title: 'x', distribution_metadata: { youtube: { enabled: true, title: 'x', hashtags: [] } } }} onUpdate={() => {}} onOpenTab={onOpenTab} /></MemoryRouter>);
    const share = await screen.findByTestId('results-share');
    fireEvent.click(within(share).getByRole('button', { name: 'Write teaser' }));
    expect(onOpenTab).toHaveBeenCalledWith('overview');
    expect(screen.queryByTestId('distribution-savebar')).toBeNull();
    const title = await screen.findByDisplayValue('x');
    fireEvent.change(title, { target: { value: 'Gala Night' } });
    const bar = await screen.findByTestId('distribution-savebar');
    fireEvent.click(within(bar).getByRole('button', { name: /Save Distribution/ }));
    await waitFor(() => expect(apiClient.put).toHaveBeenCalled());
  });

  test('full width: no narrow column; clip, not hidden, so the bar can stick', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const css = readFileSync(resolve(__dirname, 'EpisodeDistributionTab.css'), 'utf8');
    const root = css.slice(css.indexOf('.episode-distribution-tab {'), css.indexOf('}', css.indexOf('.episode-distribution-tab {')));
    expect(root).not.toMatch(/max-width/);
    expect(root).toMatch(/overflow-x: clip/);
    expect(css).toMatch(/\.distribution-savebar \{\s*position: sticky;/);
  });
});
