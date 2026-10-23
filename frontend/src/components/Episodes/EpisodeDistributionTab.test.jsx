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
vi.mock('./StyleSheetDistributionCard', () => ({ default: () => <div data-testid="style-sheet-card" /> }));

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

// Evoni, 2026-10-22 (Distribution layout): the platforms as one status list,
// Draft for all platforms in Share's Platform copy box, the editor in two
// columns, the style sheet last; notes on the page, not pop-ups.
describe('EpisodeDistributionTab — layout', () => {
  const EP = {
    id: 'ep-1', show_id: 'show-1', title: 'Gala Night', teaser: 'What did she leave behind?',
    distribution_metadata: {
      youtube: { enabled: true, title: 'Gala Night', hashtags: [], status: 'scheduled', scheduled_time: '2026-11-02T18:00' },
      tiktok: { enabled: false, caption: '', hashtags: [] },
    },
  };
  const renderTab = async (episode = EP) => {
    const rtl = await import('@testing-library/react');
    const { MemoryRouter } = await import('react-router-dom');
    const { default: Tab } = await import('./EpisodeDistributionTab');
    vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: [] } });
    rtl.render(<MemoryRouter><Tab episode={episode} onUpdate={() => {}} onOpenTab={() => {}} /></MemoryRouter>);
    await rtl.screen.findByTestId('dist-row-youtube');
    return rtl;
  };
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  test('one list: each platform with its switch, status and date; off is one word', async () => {
    const { screen, within } = await renderTab();
    const rows = screen.getAllByRole('listitem').filter((li) => li.dataset.testid?.startsWith('dist-row-'));
    expect(rows.map((r) => r.dataset.testid)).toEqual(['dist-row-youtube', 'dist-row-tiktok', 'dist-row-instagram', 'dist-row-facebook']);
    expect(within(rows[0]).getByText(/^Scheduled · /)).toBeTruthy();
    expect(within(rows[1]).getByText('Off')).toBeTruthy();
    expect(within(rows[0]).getByRole('switch', { name: 'YouTube on' }).checked).toBe(true);
    expect(within(rows[1]).getByRole('switch', { name: 'TikTok on' }).checked).toBe(false);
  });

  test('a row opens its editor; an off platform is one line with no second Enable button', async () => {
    const { screen, fireEvent, within } = await renderTab();
    fireEvent.click(within(screen.getByTestId('dist-row-tiktok')).getByRole('button', { name: /TikTok/ }));
    expect(screen.getByRole('heading', { name: 'TikTok' })).toBeTruthy();
    expect(screen.getByText('TikTok is off for this episode. Switch it on in the list to fill it in.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Enable/ })).toBeNull();
    // Switching it on opens it to fill in, and Save follows.
    fireEvent.click(screen.getByRole('switch', { name: 'TikTok on' }));
    expect(await screen.findByText('Caption')).toBeTruthy();
    expect(screen.getByTestId('distribution-savebar')).toBeTruthy();
  });

  test('two columns: the words, then when, where and the picture', async () => {
    const { screen } = await renderTab();
    const words = document.querySelector('.editor-words');
    const side = document.querySelector('.editor-side');
    expect(words.textContent).toMatch(/Title.*Hashtags/s);
    expect(side.textContent).toMatch(/Scheduled Time.*Status.*Platform URL.*Thumbnail/s);
    expect(screen.getByTestId('distribution-thumbnail').querySelector('.thumbnail-upload').style.aspectRatio).toBe('16 / 9');
  });

  test('Draft for all platforms is in the Platform copy box; what it did shows on the page', async () => {
    const { screen, fireEvent, within } = await renderTab();
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: { platforms: { youtube: { title: 'Gala' }, tiktok: { caption: 'x' } }, context_used: { source: 'teaser' } } } });
    const share = screen.getByTestId('results-share');
    fireEvent.click(within(share).getByRole('button', { name: /Draft for all platforms/ }));
    expect((await screen.findByRole('status')).textContent).toBe('Drafted for 2 platforms from the viewer teaser. Look them over, then save.');
    expect(window.alert).not.toHaveBeenCalled();
    // No Generate or Save in the header any more; the bar saves.
    expect(screen.queryByRole('button', { name: /Generate from Episode/ })).toBeNull();
    expect(screen.getAllByRole('button', { name: /Save Distribution/ })).toHaveLength(1);
  });

  test('Save says so on the page', async () => {
    const { screen, fireEvent, within } = await renderTab();
    vi.mocked(apiClient.put).mockResolvedValue({ data: { success: true } });
    fireEvent.change(screen.getByDisplayValue('Gala Night'), { target: { value: 'Gala Night, Again' } });
    fireEvent.click(within(screen.getByTestId('distribution-savebar')).getByRole('button', { name: /Save Distribution/ }));
    expect((await screen.findByRole('status')).textContent).toBe('Saved.');
    expect(screen.queryByTestId('distribution-savebar')).toBeNull();
    expect(window.alert).not.toHaveBeenCalled();
  });

  test('the order: Share, the platforms, the editor, then the style sheet', async () => {
    const { screen } = await renderTab();
    const order = [screen.getByTestId('results-share'), screen.getByRole('list', { name: 'Platforms' }), screen.getByRole('heading', { name: 'YouTube' }), screen.getByTestId('style-sheet-card')];
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});
