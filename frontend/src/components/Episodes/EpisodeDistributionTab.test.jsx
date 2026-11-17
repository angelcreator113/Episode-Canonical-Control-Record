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

// Evoni, 2026-11-16: a draft changes the drafted words only. What she has set on a platform, saved or not, stays.
describe('EpisodeDistributionTab — a draft keeps what is not copy', () => {
  const EP = {
    id: 'ep-1', show_id: 'show-1', title: 'Gala Night', teaser: 'What did she leave behind?',
    distribution_metadata: {
      youtube: { enabled: true, title: 'Old title', description: 'Old words', hashtags: ['#old'], status: 'published', scheduled_time: '2026-11-02T18:00', platform_url: 'https://youtube.test/watch?v=1', thumbnail_url: 'https://img.test/t.png', generated_at: '2026-10-01T00:00:00.000Z' },
      tiktok: { enabled: true, title: 'Old tiktok', description: 'Old', hashtags: [], status: 'scheduled', scheduled_time: '2026-11-20T17:30', generated_at: '2026-10-01T00:00:00.000Z' },
      instagram: { enabled: false, title: '', caption: 'My own caption', description: 'Old ig', hashtags: ['#mine'], status: 'draft', generated_at: '2026-10-01T00:00:00.000Z' },
    },
  };
  // What the server answers for a platform: its stored entry with the new words (services/distributionService).
  const answer = (platform, stored) => ({ ...stored, title: `New ${platform} title`, description: `New ${platform} words`, hashtags: ['#new'], tags: ['new'], generated_at: '2026-11-16T12:00:00.000Z', account_name: 'acct', account_url: 'https://acct.test' });
  const renderTab = async () => {
    const rtl = await import('@testing-library/react');
    const { MemoryRouter } = await import('react-router-dom');
    const { default: Tab } = await import('./EpisodeDistributionTab');
    vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: [] } });
    rtl.render(<MemoryRouter><Tab episode={EP} onUpdate={() => {}} onOpenTab={() => {}} /></MemoryRouter>);
    await rtl.screen.findByTestId('dist-row-youtube');
    return rtl;
  };
  const savedPayload = () => vi.mocked(apiClient.put).mock.calls.at(-1)[1].distribution_metadata;
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  test('applyGeneratedCopy: only the copy fields of the platforms drafted change', async () => {
    const { applyGeneratedCopy, GENERATED_COPY_FIELDS } = await import('./EpisodeDistributionTab');
    const current = JSON.parse(JSON.stringify(EP.distribution_metadata));
    const out = applyGeneratedCopy(current, { youtube: answer('youtube', { status: 'draft', scheduled_time: null, platform_url: null, thumbnail_url: null }) });
    expect(out.youtube).toMatchObject({ status: 'published', scheduled_time: '2026-11-02T18:00', platform_url: 'https://youtube.test/watch?v=1', thumbnail_url: 'https://img.test/t.png', enabled: true });
    expect(out.youtube).toMatchObject({ title: 'New youtube title', description: 'New youtube words', hashtags: ['#new'], tags: ['new'], account_name: 'acct' });
    expect(Object.keys(out.youtube).filter((k) => out.youtube[k] !== current.youtube[k]).sort()).toEqual([...GENERATED_COPY_FIELDS].sort());
    // Platforms the draft does not name are the very same objects.
    expect(out.tiktok).toBe(current.tiktok);
    expect(out.instagram).toBe(current.instagram);
    // A platform drafted before keeps its switch as she left it: Instagram stays off.
    expect(applyGeneratedCopy(current, { instagram: answer('instagram', {}) }).instagram).toMatchObject({ enabled: false, caption: 'My own caption', description: 'New instagram words' });
    // A platform drafted for the first time is switched on and takes the server's defaults for what it lacks.
    const first = applyGeneratedCopy({ facebook: { enabled: false, title: 'Gala Night', caption: '', description: '', hashtags: [], scheduled_time: null, status: 'draft', thumbnail_url: null, platform_url: null } },
      { facebook: answer('facebook', { status: 'draft', scheduled_time: null, platform_url: null, thumbnail_url: null }) });
    expect(first.facebook).toMatchObject({ enabled: true, title: 'New facebook title', status: 'draft', scheduled_time: null, platform_url: null, caption: '' });
    // Nothing drafted: nothing changes.
    expect(applyGeneratedCopy(current, {})).toEqual(current);
    expect(applyGeneratedCopy(current, { youtube: null })).toEqual(current);
  });

  test('an unsaved change to the status and the link survives a draft, and is what Save sends', async () => {
    const { screen, fireEvent, within } = await renderTab();
    // She opens TikTok, marks it published and pastes its link, and has not saved.
    fireEvent.click(within(screen.getByTestId('dist-row-tiktok')).getByRole('button', { name: /TikTok/ }));
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'published' } });
    fireEvent.change(screen.getByDisplayValue('2026-11-20T17:30'), { target: { value: '2026-12-01T09:00' } });
    // The server answers with what it has stored (still "scheduled") and the new words, for every platform.
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: { context_used: { source: 'teaser' }, platforms: {
      youtube: answer('youtube', EP.distribution_metadata.youtube),
      tiktok: answer('tiktok', EP.distribution_metadata.tiktok),
      instagram: answer('instagram', EP.distribution_metadata.instagram),
      facebook: answer('facebook', { status: 'draft', scheduled_time: null, platform_url: null, thumbnail_url: null }),
    } } } });
    fireEvent.click(within(screen.getByTestId('results-share')).getByRole('button', { name: /Draft for all platforms/ }));
    expect((await screen.findByRole('status')).textContent).toMatch(/^Drafted for 4 platforms/);
    // On the page: her status and time are still what she set. (The new words are checked in what Save sends.)
    expect(screen.getByLabelText('Status').value).toBe('published');
    expect(screen.getByDisplayValue('2026-12-01T09:00')).toBeTruthy();
    // And in what Save sends.
    vi.mocked(apiClient.put).mockResolvedValue({ data: { success: true } });
    fireEvent.click(within(screen.getByTestId('distribution-savebar')).getByRole('button', { name: /Save Distribution/ }));
    await screen.findByText('Saved.');
    const sent = savedPayload();
    expect(sent.tiktok).toMatchObject({ status: 'published', scheduled_time: '2026-12-01T09:00', title: 'New tiktok title', enabled: true });
    expect(sent.youtube).toMatchObject({ status: 'published', platform_url: 'https://youtube.test/watch?v=1', thumbnail_url: 'https://img.test/t.png', scheduled_time: '2026-11-02T18:00', title: 'New youtube title' });
    expect(sent.instagram).toMatchObject({ enabled: false, caption: 'My own caption', description: 'New instagram words' });
    expect(sent.facebook).toMatchObject({ enabled: true, status: 'draft', title: 'New facebook title' });
  });

  test('a platform the draft does not name keeps its saved values and her unsaved ones', async () => {
    const { screen, fireEvent, within } = await renderTab();
    // Unsaved: TikTok switched off. Saved: YouTube published. The draft is for Instagram only.
    fireEvent.click(screen.getByRole('switch', { name: 'TikTok on' }));
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: { context_used: { source: 'teaser' }, platforms: { instagram: answer('instagram', EP.distribution_metadata.instagram) } } } });
    fireEvent.click(within(screen.getByTestId('results-share')).getByRole('button', { name: /Draft for all platforms/ }));
    expect((await screen.findByRole('status')).textContent).toMatch(/^Drafted for 1 platforms/);
    expect(screen.getByRole('switch', { name: 'TikTok on' }).checked).toBe(false);
    expect(screen.getByRole('switch', { name: 'YouTube on' }).checked).toBe(true);
    vi.mocked(apiClient.put).mockResolvedValue({ data: { success: true } });
    fireEvent.click(within(screen.getByTestId('distribution-savebar')).getByRole('button', { name: /Save Distribution/ }));
    await screen.findByText('Saved.');
    const sent = savedPayload();
    expect(sent.tiktok).toMatchObject({ enabled: false, status: 'scheduled', scheduled_time: '2026-11-20T17:30', title: 'Old tiktok' });
    expect(sent.youtube).toEqual(EP.distribution_metadata.youtube);
    expect(sent.instagram).toMatchObject({ description: 'New instagram words', caption: 'My own caption' });
  });
});
