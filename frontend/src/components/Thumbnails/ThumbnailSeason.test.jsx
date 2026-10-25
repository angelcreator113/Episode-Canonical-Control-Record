/**
 * A whole season at once (Evoni, 2026-10-21): the show's template filled
 * with each episode's words and pictures, drawn small in a grid; the ones
 * ticked are saved as each episode's thumbnail and kept as its arrangement.
 */
import React from 'react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import ThumbnailSeason from './ThumbnailSeason';
import { youtubeThumbnailsApi, downloadBlob } from '../../lib/youtubeThumbnailsApi';
import { presetLayers, layerOf } from '../../lib/thumbnailLayers';

vi.mock('../../lib/youtubeThumbnailsApi', async () => {
  const actual = await vi.importActual('../../lib/youtubeThumbnailsApi');
  return {
    ...actual,
    youtubeThumbnailsApi: { season: vi.fn(), templates: vi.fn(), sources: vi.fn(), renderSmall: vi.fn(), save: vi.fn(), saveDraft: vi.fn(), zip: vi.fn() },
    downloadBlob: vi.fn(),
  };
});
vi.mock('../../lib/thumbnailLayers', async () => {
  const actual = await vi.importActual('../../lib/thumbnailLayers');
  return { ...actual, loadThumbnailFonts: vi.fn(() => Promise.resolve()) };
});

const BUCKET = 'https://b.s3.amazonaws.com/';
const EPISODES = [
  { id: 'ep-1', title: 'Pilot', episode_number: 1, thumbnailUrl: `${BUCKET}t1.jpg`, hasDraft: false },
  { id: 'ep-2', title: 'Red Dress', episode_number: 2, thumbnailUrl: null, hasDraft: true },
  { id: 'ep-3', title: 'Gala Night', episode_number: 3, thumbnailUrl: null, hasDraft: false },
];
const TEMPLATE = presetLayers('lala-left', { title: 'Template words' }, {});
const OWN = { ...presetLayers('center', { title: 'Her own' }, {}), savedAt: '2026-10-21T10:00:00Z' };
const sourcesOf = (id) => {
  const ep = EPISODES.find((e) => e.id === id);
  return {
    episode: { id, title: ep.title, episode_number: ep.episode_number },
    show: { id: 'show-1', name: 'Styling Adventures' },
    backgrounds: [{ url: `${BUCKET}${id}-bg.jpg` }],
    draft: ep.hasDraft ? OWN : null,
  };
};

const renderSeason = (props = {}) => render(
  <ThumbnailSeason showId="show-1" onOpenEpisode={vi.fn()} onClose={vi.fn()} {...props} />,
);

describe('ThumbnailSeason', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:small');
    globalThis.URL.revokeObjectURL = vi.fn();
    youtubeThumbnailsApi.season.mockResolvedValue(EPISODES);
    youtubeThumbnailsApi.templates.mockResolvedValue([
      { id: 't-1', name: 'Come Style Me', isDefault: true, spec: TEMPLATE },
      { id: 't-2', name: 'No layers', isDefault: false, spec: null },
    ]);
    youtubeThumbnailsApi.sources.mockImplementation((id) => Promise.resolve(sourcesOf(id)));
    youtubeThumbnailsApi.renderSmall.mockResolvedValue(new Blob(['jpg'], { type: 'image/jpeg' }));
    youtubeThumbnailsApi.save.mockImplementation((id) => Promise.resolve({ url: `${BUCKET}${id}-saved.jpg` }));
    youtubeThumbnailsApi.saveDraft.mockResolvedValue({});
  });

  test('lists the episodes without a thumbnail, on the default template; draws each, its own arrangement kept', async () => {
    renderSeason();
    await screen.findByTestId('yts-season-ep-2');
    expect(screen.queryByTestId('yts-season-ep-1')).toBeNull(); // already has one
    // Only templates with layers, the default chosen; the show's layout last.
    const select = screen.getByRole('combobox', { name: 'Template for the season' });
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Come Style Me (default)', "The show's layout"]);
    expect(select.value).toBe('t-1');

    fireEvent.click(screen.getByTestId('yts-season-draw'));
    await waitFor(() => expect(youtubeThumbnailsApi.renderSmall).toHaveBeenCalledTimes(2));
    const drawn = Object.fromEntries(youtubeThumbnailsApi.renderSmall.mock.calls.map(([spec]) => [layerOf(spec, 'title').text, spec]));
    // Episode 2 keeps its own arrangement (without savedAt); episode 3 gets the template with its words and picture.
    expect(drawn['Her own']).toBeTruthy();
    expect(drawn['Her own'].savedAt).toBeUndefined();
    expect(layerOf(drawn['Gala Night'], 'background').src).toBe(`${BUCKET}ep-3-bg.jpg`);
    expect(layerOf(drawn['Gala Night'], 'kicker').text).toBe('Styling Adventures');
    const two = within(await screen.findByTestId('yts-season-ep-2'));
    await waitFor(() => expect(two.getByText('Its own arrangement')).toBeTruthy());
    expect(within(screen.getByTestId('yts-season-ep-3')).getByText('From "Come Style Me"')).toBeTruthy();
    expect(within(screen.getByTestId('yts-season-ep-3')).getByRole('img').getAttribute('alt')).toBe('3. Gala Night, as it would be saved');
    expect(screen.getByTestId('yts-season-save').textContent).toContain('Save 2 picked');
  });

  test('an episode in the season\'s slots is named by its slot label (2026-10-25)', async () => {
    youtubeThumbnailsApi.season.mockResolvedValue([
      { id: 'ep-3', title: 'Gala Night', episode_number: 25, slot_number: 1, label: 'S2 · E1', thumbnailUrl: null, hasDraft: false },
    ]);
    renderSeason();
    const card = within(await screen.findByTestId('yts-season-ep-3'));
    expect(card.getByText('S2 · E1. Gala Night')).toBeTruthy();
    expect(screen.queryByText(/^25\. /)).toBeNull();
  });

  test('saves the ticked ones as each episode\'s thumbnail; a template one is kept as its arrangement too', async () => {
    renderSeason();
    fireEvent.click(await screen.findByTestId('yts-season-draw'));
    await waitFor(() => expect(screen.getByTestId('yts-season-save').textContent).toContain('Save 2 picked'));
    // Untick episode 2: only episode 3 is saved.
    fireEvent.click(within(screen.getByTestId('yts-season-ep-2')).getByRole('checkbox', { name: 'Save this one' }));
    expect(screen.getByTestId('yts-season-save').textContent).toContain('Save 1 picked');
    fireEvent.click(screen.getByTestId('yts-season-save'));
    await waitFor(() => expect(within(screen.getByTestId('yts-season-ep-3')).getByText('Saved')).toBeTruthy());
    expect(youtubeThumbnailsApi.save).toHaveBeenCalledTimes(1);
    expect(youtubeThumbnailsApi.save).toHaveBeenCalledWith('ep-3', expect.objectContaining({ version: 2 }));
    expect(youtubeThumbnailsApi.saveDraft).toHaveBeenCalledWith('ep-3', youtubeThumbnailsApi.save.mock.calls[0][1]);
    expect(screen.getByRole('status').textContent).toBe('Saved 1 thumbnail. Each is now its episode\'s thumbnail.');
    // Episode 3 now has a thumbnail: drawing again is for episode 2 only; episode 3 stays, marked Saved.
    expect(screen.getByTestId('yts-season-draw').textContent).toContain('Draw again 1 episode');
    expect(within(screen.getByTestId('yts-season-ep-3')).getByText('Saved')).toBeTruthy();
  });

  // Evoni, 2026-10-22: the whole season in one zip.
  test('downloads the ticked ones in one zip, each full size as it would be saved, named by its episode', async () => {
    youtubeThumbnailsApi.zip.mockResolvedValue(new Blob(['zip'], { type: 'application/zip' }));
    renderSeason();
    fireEvent.click(await screen.findByTestId('yts-season-draw'));
    await waitFor(() => expect(screen.getByTestId('yts-season-zip').textContent).toContain('Download 2 as a zip'));
    fireEvent.click(screen.getByTestId('yts-season-zip'));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalled());
    const [name, items] = youtubeThumbnailsApi.zip.mock.calls[0];
    expect(name).toBe('season');
    expect(items.map((i) => i.name)).toEqual(['2. Red Dress', '3. Gala Night']);
    expect(items[1].spec).toMatchObject({ version: 2 });
    expect(downloadBlob.mock.calls[0][1]).toBe('season.zip');
    expect(screen.getByRole('status').textContent).toBe('2 thumbnails in season.zip.');
    expect(youtubeThumbnailsApi.save).not.toHaveBeenCalled();
  });

  test('one that fails to save says why on its card, and the rest still save', async () => {
    youtubeThumbnailsApi.save.mockImplementation((id) => (id === 'ep-2'
      ? Promise.reject({ response: { data: { error: 'A picture could not be read' } } })
      : Promise.resolve({ url: `${BUCKET}${id}.jpg` })));
    renderSeason();
    fireEvent.click(await screen.findByTestId('yts-season-draw'));
    await waitFor(() => expect(screen.getByTestId('yts-season-save').textContent).toContain('Save 2 picked'));
    fireEvent.click(screen.getByTestId('yts-season-save'));
    await waitFor(() => expect(within(screen.getByTestId('yts-season-ep-3')).getByText('Saved')).toBeTruthy());
    expect(within(screen.getByTestId('yts-season-ep-2')).getByRole('alert').textContent).toBe('A picture could not be read');
    // Its own arrangement is not saved again as a draft.
    expect(youtubeThumbnailsApi.saveDraft).not.toHaveBeenCalledWith('ep-2', expect.anything());
    expect(screen.getAllByRole('alert').some((a) => a.textContent === 'Saved 1 thumbnail; 1 could not be saved (see its card).')).toBe(true);
  });

  test('options: the template ignoring own arrangements; episodes that have a thumbnail; the show\'s layout', async () => {
    renderSeason();
    await screen.findByTestId('yts-season-ep-2');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include episodes that already have a thumbnail' }));
    expect(within(screen.getByTestId('yts-season-ep-1')).getByText(/Has a thumbnail: saving replaces it/)).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: "Keep an episode's own arrangement where it has one" }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Template for the season' }), { target: { value: 'layout' } });
    fireEvent.click(screen.getByTestId('yts-season-draw'));
    await waitFor(() => expect(youtubeThumbnailsApi.renderSmall).toHaveBeenCalledTimes(3));
    const titles = youtubeThumbnailsApi.renderSmall.mock.calls.map(([spec]) => layerOf(spec, 'title').text).sort();
    expect(titles).toEqual(['Gala Night', 'Pilot', 'Red Dress']);
    await waitFor(() => expect(within(screen.getByTestId('yts-season-ep-2')).getByText("From the show's layout")).toBeTruthy());
  });

  test('one that cannot be drawn says why; Open in the editor and Back', async () => {
    youtubeThumbnailsApi.renderSmall.mockImplementation((spec) => (layerOf(spec, 'title').text === 'Gala Night'
      ? Promise.reject({ response: { data: { error: 'A picture is not one of ours' } } })
      : Promise.resolve(new Blob(['jpg']))));
    const onOpenEpisode = vi.fn();
    const onClose = vi.fn();
    renderSeason({ onOpenEpisode, onClose });
    fireEvent.click(await screen.findByTestId('yts-season-draw'));
    const three = () => within(screen.getByTestId('yts-season-ep-3'));
    await waitFor(() => expect(three().getByRole('alert').textContent).toBe('A picture is not one of ours'));
    expect(three().getByText('Could not draw it')).toBeTruthy();
    expect(three().getByRole('checkbox', { name: 'Save this one' }).disabled).toBe(true);
    fireEvent.click(three().getByRole('button', { name: /Open in the editor/ }));
    expect(onOpenEpisode).toHaveBeenCalledWith('ep-3');
    fireEvent.click(screen.getByRole('button', { name: /Back to one episode/ }));
    expect(onClose).toHaveBeenCalled();
  });

  test('every episode has a thumbnail: says so; the season not loading says why', async () => {
    youtubeThumbnailsApi.season.mockResolvedValueOnce([EPISODES[0]]);
    const { unmount } = renderSeason();
    expect(await screen.findByText('Every episode has a thumbnail.')).toBeTruthy();
    unmount();
    youtubeThumbnailsApi.season.mockRejectedValueOnce({ response: { data: { error: 'Show not found' } } });
    renderSeason();
    expect((await screen.findByRole('alert')).textContent).toBe('Show not found');
  });
});
