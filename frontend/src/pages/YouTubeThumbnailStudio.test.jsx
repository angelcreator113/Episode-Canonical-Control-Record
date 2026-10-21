/**
 * Templates › YouTube thumbnails (Evoni, 2026-10-17): an episode opens with
 * its show's style and its own words; changes re-render the preview; Save
 * stores the episode's thumbnail; Save style keeps the show's look; an
 * upload goes with the render. The one editor (2026-10-20): the episode's
 * saved thumbnails are listed, one can be made current again, an older one
 * deleted.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../lib/youtubeThumbnailsApi', async () => {
  const actual = await vi.importActual('../lib/youtubeThumbnailsApi');
  return {
    ...actual,
    youtubeThumbnailsApi: {
      sources: vi.fn(), render: vi.fn(), save: vi.fn(), saveStyle: vi.fn(), shows: vi.fn(), episodes: vi.fn(),
      saved: vi.fn(), makePrimary: vi.fn(), removeSaved: vi.fn(),
    },
  };
});

import {
  youtubeThumbnailsApi, episodeWords, renderForm, thumbnailStudioHref, defaultPose, folderPath, folderCount, folderCover, firstFolder,
} from '../lib/youtubeThumbnailsApi';
import YouTubeThumbnailStudio from './YouTubeThumbnailStudio';

const SOURCES = {
  episode: { id: 'ep-1', title: 'Studio by Sable', episode_number: 1 },
  show: { id: 'show-1', name: 'Styling Adventures' },
  style: { layout: 'lala-right', accent: '#B8962E', textColor: '#FFFFFF', dim: 0.3, lalaUrl: 'https://b.s3.amazonaws.com/lala2.png' },
  backgrounds: [{ url: 'https://b.s3.amazonaws.com/wide.jpg', label: 'Bedroom · Wide' }, { url: 'https://b.s3.amazonaws.com/cover.jpg', label: 'Show cover' }],
  cutouts: [{ id: 'a1', url: 'https://b.s3.amazonaws.com/lala1.png', label: 'Lala 1' }, { id: 'a2', url: 'https://b.s3.amazonaws.com/lala2.png', label: 'Lala 2' }],
  folders: [
    { key: 'scene-sets', label: 'Scene sets', folders: [
      { key: 'scene-sets/bedroom', label: 'Bedroom', items: [{ url: 'https://b.s3.amazonaws.com/wide.jpg', label: 'Wide' }] },
      { key: 'scene-sets/show', label: 'Show', items: [{ url: 'https://b.s3.amazonaws.com/cover.jpg', label: 'Show cover' }] },
    ] },
    { key: 'library', label: 'Asset library', folders: [
      { key: 'library/lala', label: 'Lala', items: [{ url: 'https://b.s3.amazonaws.com/lala1.png', label: 'Lala 1' }, { url: 'https://b.s3.amazonaws.com/lala2.png', label: 'Lala 2' }] },
    ] },
  ],
};

const renderPage = (entry = '/template-studio/youtube?show=show-1&episode=ep-1') => render(
  <MemoryRouter initialEntries={[entry]}><YouTubeThumbnailStudio /></MemoryRouter>,
);
const lastSpec = () => youtubeThumbnailsApi.render.mock.calls.at(-1)[0];

describe('helpers', () => {
  test('episode words and the request form', () => {
    expect(episodeWords({ title: 'T', episode_number: 3 }, { name: 'S' })).toEqual({ title: 'T', kicker: 'S', badge: 'EP 3' });
    expect(episodeWords({}, null)).toEqual({ title: '', kicker: '', badge: '' });
    const f = new File(['x'], 'bg.png', { type: 'image/png' });
    const form = renderForm({ title: 'T' }, { background: f });
    expect(JSON.parse(form.get('spec'))).toEqual({ title: 'T' });
    expect(form.get('background')).toBe(f);
    expect(form.get('lala')).toBeNull();
  });

  test('folders: the path to one, how many pictures, the cover, where a picker opens', () => {
    const tree = SOURCES.folders;
    expect(folderPath(tree, 'scene-sets/show').map((f) => f.label)).toEqual(['Scene sets', 'Show']);
    expect(folderPath(tree, 'nope')).toEqual([]);
    expect(folderPath(tree, null)).toEqual([]);
    expect(folderCount(tree[0])).toBe(2);
    expect(folderCover(tree[0])).toBe('https://b.s3.amazonaws.com/wide.jpg');
    expect(folderCover({ key: 'x', label: 'X' })).toBeNull();
    expect(firstFolder(tree, ['poses/lala', 'library/lala'])).toBe('library/lala');
    expect(firstFolder(tree, ['poses/justawoman'])).toBeNull();
  });

  test('the pose a thumbnail starts from', () => {
    const poses = [
      { url: 'u-f1', pose: 'front', isDefault: true },
      { url: 'u-f2', pose: 'front', isDefault: false },
      { url: 'u-g1', pose: 'glamour', isDefault: false },
    ];
    expect(defaultPose(poses).url).toBe('u-f1'); // a starred Front beats an unstarred Glamour
    expect(defaultPose([{ url: 'g', pose: 'glamour', isDefault: true }, { url: 'f', pose: 'front', isDefault: true }]).url).toBe('g');
    expect(defaultPose([{ url: 'b', pose: 'back', isDefault: false }]).url).toBe('b');
    expect(defaultPose([])).toBeNull();
    const form = renderForm({ title: 'T' }, { jaw: new File(['j'], 'j.png', { type: 'image/png' }) });
    expect(form.get('jaw').name).toBe('j.png');
  });

  test('the editor link opens on the episode when there is one', () => {
    expect(thumbnailStudioHref({ showId: 's1', episodeId: 'e1' })).toBe('/template-studio/youtube?show=s1&episode=e1');
    expect(thumbnailStudioHref({ episodeId: 'e1' })).toBe('/template-studio/youtube?episode=e1');
    expect(thumbnailStudioHref()).toBe('/template-studio/youtube');
  });
});

describe('YouTubeThumbnailStudio', () => {
  beforeEach(() => {
    Object.values(youtubeThumbnailsApi).forEach((fn) => fn.mockReset());
    youtubeThumbnailsApi.shows.mockResolvedValue([{ id: 'show-1', name: 'Styling Adventures' }]);
    youtubeThumbnailsApi.episodes.mockResolvedValue([{ id: 'ep-1', episode_number: 1, title: 'Studio by Sable' }]);
    youtubeThumbnailsApi.sources.mockResolvedValue(SOURCES);
    youtubeThumbnailsApi.render.mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
    youtubeThumbnailsApi.saved.mockResolvedValue([]);
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  test('opens on the episode with the show\'s style, its words and its first picture; the preview renders', async () => {
    renderPage();
    await waitFor(() => expect(youtubeThumbnailsApi.render).toHaveBeenCalled(), { timeout: 2000 });
    expect(lastSpec()).toMatchObject({
      layout: 'lala-right', accent: '#B8962E', title: 'Studio by Sable', kicker: 'Styling Adventures', badge: 'EP 1',
      backgroundUrl: 'https://b.s3.amazonaws.com/wide.jpg', lalaUrl: 'https://b.s3.amazonaws.com/lala2.png',
    });
    expect((await screen.findByTestId('yts-preview')).getAttribute('src')).toBe('blob:preview');
    expect(screen.getByLabelText('Title').value).toBe('Studio by Sable');
  });

  test('the episode list\'s error stays on screen after a good preview', async () => {
    youtubeThumbnailsApi.episodes.mockRejectedValue(new Error('400'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderPage();
    await waitFor(() => expect(screen.getByTestId('yts-preview')).toBeTruthy(), { timeout: 2000 });
    expect(screen.getByText('Could not load the episodes.')).toBeTruthy();
    console.error.mockRestore();
  });

  test('a change re-renders with it: title, layout, picture, accent', async () => {
    renderPage();
    await waitFor(() => expect(youtubeThumbnailsApi.render).toHaveBeenCalledTimes(1), { timeout: 2000 });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'The Atelier' } });
    fireEvent.click(screen.getByRole('button', { name: /Title only/ }));
    const bg = screen.getByTestId('yts-backgrounds');
    // The background opens in Scene sets; the cover is in its Show folder.
    fireEvent.click(within(bg).getByTestId('yts-backgrounds-folder-scene-sets/show'));
    fireEvent.click(within(bg).getByTitle('Show cover'));
    fireEvent.click(screen.getByRole('button', { name: 'Accent #A46EE0' }));
    await waitFor(() => expect(lastSpec()).toMatchObject({ title: 'The Atelier', layout: 'center', backgroundUrl: 'https://b.s3.amazonaws.com/cover.jpg', accent: '#A46EE0' }), { timeout: 2000 });
    expect(screen.queryByTestId('yts-lala')).toBeNull();
  });

  test('an uploaded background goes with the render', async () => {
    renderPage();
    await waitFor(() => expect(youtubeThumbnailsApi.render).toHaveBeenCalled(), { timeout: 2000 });
    const file = new File(['x'], 'mine.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByTestId('yts-backgrounds-input'), { target: { files: [file] } });
    await waitFor(() => expect(youtubeThumbnailsApi.render.mock.calls.at(-1)[1]).toMatchObject({ background: file }), { timeout: 2000 });
    expect(within(screen.getByTestId('yts-backgrounds')).getByText('mine.jpg')).toBeTruthy();
  });

  test('Save stores it as the episode\'s thumbnail and lists it with the saved ones', async () => {
    youtubeThumbnailsApi.save.mockResolvedValue({ id: 7, url: 'https://b.s3.amazonaws.com/t.png' });
    renderPage();
    await waitFor(() => expect(youtubeThumbnailsApi.saved).toHaveBeenCalledTimes(1));
    youtubeThumbnailsApi.saved.mockResolvedValue([{ id: 7, url: 'https://b.s3.amazonaws.com/t.png', isPrimary: true }]);
    fireEvent.click(await screen.findByTestId('yts-save'));
    await waitFor(() => expect(youtubeThumbnailsApi.save).toHaveBeenCalledWith('ep-1', expect.objectContaining({ title: 'Studio by Sable' }), { background: null, lala: null, jaw: null }));
    expect(await screen.findByText("Saved as the episode's thumbnail.")).toBeTruthy();
    expect(screen.queryByRole('link', { name: /thumbnail gallery/ })).toBeNull();
    expect(within(await screen.findByTestId('yts-saved-7')).getByText('Episode thumbnail')).toBeTruthy();
  });

  test('a saved one can be made the episode\'s thumbnail again', async () => {
    youtubeThumbnailsApi.saved.mockResolvedValueOnce([
      { id: 9, url: 'https://b.s3.amazonaws.com/new.png', isPrimary: true },
      { id: 8, url: 'https://b.s3.amazonaws.com/old.png', isPrimary: false },
    ]).mockResolvedValueOnce([
      { id: 8, url: 'https://b.s3.amazonaws.com/old.png', isPrimary: true },
      { id: 9, url: 'https://b.s3.amazonaws.com/new.png', isPrimary: false },
    ]);
    youtubeThumbnailsApi.makePrimary.mockResolvedValue({ id: 8 });
    renderPage();
    const older = await screen.findByTestId('yts-saved-8');
    expect(within(screen.getByTestId('yts-saved-9')).queryByRole('button', { name: /Delete/ })).toBeNull();
    fireEvent.click(within(older).getByRole('button', { name: /Use this one/ }));
    await waitFor(() => expect(youtubeThumbnailsApi.makePrimary).toHaveBeenCalledWith('ep-1', 8));
    await waitFor(() => expect(within(screen.getByTestId('yts-saved-8')).getByText('Episode thumbnail')).toBeTruthy());
  });

  test('an older saved one can be deleted after confirming', async () => {
    youtubeThumbnailsApi.saved.mockResolvedValue([
      { id: 9, url: 'https://b.s3.amazonaws.com/new.png', isPrimary: true },
      { id: 8, url: 'https://b.s3.amazonaws.com/old.png', isPrimary: false },
    ]);
    youtubeThumbnailsApi.removeSaved.mockResolvedValue({ id: 8 });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    fireEvent.click(within(await screen.findByTestId('yts-saved-8')).getByRole('button', { name: /Delete/ }));
    await waitFor(() => expect(youtubeThumbnailsApi.removeSaved).toHaveBeenCalledWith('ep-1', 8));
    await waitFor(() => expect(screen.queryByTestId('yts-saved-8')).toBeNull());
    expect(screen.getByTestId('yts-saved-9')).toBeTruthy();
    confirm.mockRestore();
  });

  test('Save style keeps the layout, colours and Lala for the show', async () => {
    youtubeThumbnailsApi.saveStyle.mockResolvedValue({});
    renderPage();
    fireEvent.click(await screen.findByTestId('yts-save-style'));
    await waitFor(() => expect(youtubeThumbnailsApi.saveStyle).toHaveBeenCalledWith('show-1', {
      layout: 'lala-right', accent: '#B8962E', textColor: '#FFFFFF', dim: 0.3, lalaUrl: 'https://b.s3.amazonaws.com/lala2.png',
    }));
    expect(await screen.findByText(/Style saved for Styling Adventures/)).toBeTruthy();
  });

  test('a refused save says why', async () => {
    youtubeThumbnailsApi.save.mockRejectedValue({ response: { data: { error: 'The background is not an image we can read' } } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderPage();
    fireEvent.click(await screen.findByTestId('yts-save'));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'The background is not an image we can read');
  });

  test('with no episode chosen it asks for one', async () => {
    renderPage('/template-studio/youtube');
    expect(await screen.findByText('Choose a show and an episode to make its thumbnail.')).toBeTruthy();
    expect(youtubeThumbnailsApi.sources).not.toHaveBeenCalled();
  });

  test('the episode\'s poses: Lala starts on her starred pose, grouped by pose; JustAWoman joins when picked', async () => {
    const lalaFront = { url: 'https://b.s3.amazonaws.com/lala-front.png', label: 'Front ★', isDefault: true };
    const lalaSide = { url: 'https://b.s3.amazonaws.com/lala-side.png', label: 'Side', isDefault: false };
    const jawGlam = { url: 'https://b.s3.amazonaws.com/jaw-glam.png', label: 'Glamour ★', isDefault: true };
    youtubeThumbnailsApi.sources.mockResolvedValue({
      ...SOURCES,
      poses: {
        lala: [{ id: 'p1', pose: 'front', ...lalaFront }, { id: 'p2', pose: 'side', ...lalaSide }],
        justawoman: [{ id: 'p3', pose: 'glamour', ...jawGlam }],
      },
      folders: [
        ...SOURCES.folders,
        { key: 'poses', label: 'Character poses', folders: [
          { key: 'poses/lala', label: 'Lala', folders: [
            { key: 'poses/lala/front', label: 'Front', items: [lalaFront] },
            { key: 'poses/lala/side', label: 'Side', items: [lalaSide] },
          ] },
          { key: 'poses/justawoman', label: 'JustAWoman', folders: [{ key: 'poses/justawoman/glamour', label: 'Glamour', items: [jawGlam] }] },
        ] },
      ],
    });
    renderPage();
    await waitFor(() => expect(youtubeThumbnailsApi.render).toHaveBeenCalled(), { timeout: 2000 });
    expect(lastSpec()).toMatchObject({ lalaUrl: 'https://b.s3.amazonaws.com/lala-front.png', jawUrl: null });
    // Lala's picker opens in her poses: one folder per pose, each with its count.
    const lala = screen.getByTestId('yts-lala');
    expect(within(lala).getByTestId('yts-lala-crumbs').textContent).toBe('All foldersCharacter posesLala');
    expect(within(lala).getByRole('button', { name: 'Front, 1 picture' })).toBeTruthy();
    fireEvent.click(within(lala).getByRole('button', { name: 'Side, 1 picture' }));
    expect(within(lala).getByTitle('Side')).toBeTruthy();
    // Back to all folders, then into the Asset library's Lala.
    fireEvent.click(within(lala).getByRole('button', { name: 'All folders' }));
    fireEvent.click(within(lala).getByTestId('yts-lala-folder-library'));
    fireEvent.click(within(lala).getByTestId('yts-lala-folder-library/lala'));
    expect(within(lala).getByTitle('Lala 1')).toBeTruthy();
    expect(screen.queryByTestId('yts-poses-note')).toBeNull();
    const jaw = screen.getByTestId('yts-jaw');
    fireEvent.click(within(jaw).getByTestId('yts-jaw-folder-poses/justawoman/glamour'));
    fireEvent.click(within(jaw).getByTitle('Glamour ★'));
    await waitFor(() => expect(lastSpec()).toMatchObject({ jawUrl: 'https://b.s3.amazonaws.com/jaw-glam.png' }), { timeout: 2000 });
    fireEvent.click(within(screen.getByTestId('yts-jaw')).getByRole('button', { name: /No JustAWoman/ }));
    await waitFor(() => expect(lastSpec()).toMatchObject({ jawUrl: null }), { timeout: 2000 });
  });

  test('Save style keeps the show\'s own Lala when the picked one is this episode\'s pose', async () => {
    youtubeThumbnailsApi.sources.mockResolvedValue({
      ...SOURCES,
      poses: { lala: [{ id: 'p1', url: 'https://b.s3.amazonaws.com/lala-front.png', pose: 'front', label: 'Front ★', isDefault: true }], justawoman: [] },
    });
    youtubeThumbnailsApi.saveStyle.mockResolvedValue({});
    renderPage();
    fireEvent.click(await screen.findByTestId('yts-save-style'));
    await waitFor(() => expect(youtubeThumbnailsApi.saveStyle).toHaveBeenCalledWith('show-1', expect.objectContaining({ lalaUrl: 'https://b.s3.amazonaws.com/lala2.png' })));
  });

  test('with no poses yet it points to the Files tab', async () => {
    renderPage();
    const note = await screen.findByTestId('yts-poses-note');
    expect(within(note).getByRole('link', { name: 'Files tab' }).getAttribute('href')).toBe('/episodes/ep-1?tab=files');
    expect(screen.getByTestId('yts-jaw')).toBeTruthy();
  });
});
