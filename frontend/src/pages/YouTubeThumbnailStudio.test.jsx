/**
 * Templates › YouTube thumbnails (Evoni, 2026-10-17). The thumbnail is
 * layers (2026-10-21): an episode opens on its own arrangement, else the
 * show's template filled with its words and pictures, else the show's
 * layout; the controls change the layers; a change on the canvas (moved,
 * resized, turned) is kept for the episode; Save draws and stores it; Save
 * as template makes it where every episode starts. Pictures are in folders;
 * an upload is kept and lands in Uploads. The one editor (2026-10-20): the
 * episode's saved thumbnails are listed, one can be made current again, an
 * older one deleted. The canvas itself is stubbed (ThumbnailCanvas.test).
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../lib/youtubeThumbnailsApi', async () => {
  const actual = await vi.importActual('../lib/youtubeThumbnailsApi');
  return {
    ...actual,
    youtubeThumbnailsApi: {
      sources: vi.fn(), render: vi.fn(), save: vi.fn(), saveStyle: vi.fn(), shows: vi.fn(), episodes: vi.fn(),
      saved: vi.fn(), makePrimary: vi.fn(), removeSaved: vi.fn(), saveDraft: vi.fn(), draft: vi.fn(), uploadPicture: vi.fn(),
    },
  };
});
vi.mock('../lib/thumbnailLayers', async () => {
  const actual = await vi.importActual('../lib/thumbnailLayers');
  return { ...actual, loadThumbnailFonts: vi.fn(() => Promise.resolve()) };
});
// The canvas: each visible layer as a button that picks it, and a button
// that "drags" the picked layer (what Konva's drag and transform report).
vi.mock('../components/Thumbnails/ThumbnailCanvas', () => ({
  default: ({ spec, selectedId, onSelect, onChange }) => (
    <div data-testid="yts-canvas">
      {spec.layers.filter((l) => l.visible).map((l) => (
        <button key={l.id} type="button" data-testid={`canvas-${l.id}`} onClick={() => onSelect(l.id)}>{l.id}</button>
      ))}
      <button type="button" data-testid="canvas-drag" onClick={() => onChange(selectedId, { x: 99, y: 11, w: 300, h: 200, rotation: -12 })}>drag</button>
    </div>
  ),
}));

import {
  youtubeThumbnailsApi, episodeWords, thumbnailStudioHref, defaultPose, folderPath, folderCount, folderCover, firstFolder,
} from '../lib/youtubeThumbnailsApi';
import { presetLayers, layerOf } from '../lib/thumbnailLayers';
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
    { key: 'outfit', label: "This episode's outfit", folders: [
      { key: 'outfit/dress', label: 'Dress', items: [{ url: 'https://b.s3.amazonaws.com/dress.png', label: 'Sweater dress' }] },
    ] },
    { key: 'library', label: 'Asset library', folders: [
      { key: 'library/lala', label: 'Lala', items: [{ url: 'https://b.s3.amazonaws.com/lala1.png', label: 'Lala 1' }, { url: 'https://b.s3.amazonaws.com/lala2.png', label: 'Lala 2' }] },
    ] },
  ],
  template: null,
  draft: null,
};

const renderPage = (entry = '/template-studio/youtube?show=show-1&episode=ep-1') => render(
  <MemoryRouter initialEntries={[entry]}><YouTubeThumbnailStudio /></MemoryRouter>,
);
const lastDraft = () => youtubeThumbnailsApi.saveDraft.mock.calls.at(-1)[1];
const opened = () => screen.findByTestId('yts-canvas');

describe('helpers', () => {
  test('episode words', () => {
    expect(episodeWords({ title: 'T', episode_number: 3 }, { name: 'S' })).toEqual({ title: 'T', kicker: 'S', badge: 'EP 3' });
    expect(episodeWords({}, null)).toEqual({ title: '', kicker: '', badge: '' });
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
    youtubeThumbnailsApi.saveDraft.mockResolvedValue({});
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:exact');
    globalThis.URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  test('with no template or arrangement, the episode opens on the show\'s layout with its words and first pictures', async () => {
    renderPage();
    await opened();
    expect(screen.getByLabelText('Title').value).toBe('Studio by Sable');
    expect(screen.getByLabelText('Show name line').value).toBe('Styling Adventures');
    expect(screen.getByLabelText('Badge').value).toBe('EP 1');
    // Lala right: the background, the shade, Lala (the show's saved one), the words, the badge.
    expect(within(screen.getByTestId('yts-canvas')).getAllByRole('button').map((b) => b.textContent).slice(0, -1))
      .toEqual(['background', 'shade', 'lala', 'kicker', 'title', 'badge']);
    expect(screen.getByRole('button', { name: /Lala right/ }).getAttribute('aria-pressed')).toBe('true');
    expect(youtubeThumbnailsApi.saveDraft).not.toHaveBeenCalled(); // opening is not a change
  });

  test('an episode\'s own arrangement comes first; else the show\'s template, with this episode\'s words', async () => {
    const draft = { ...presetLayers('center', { title: 'Kept title', kicker: 'K', badge: '' }, {}), savedAt: '2026-10-21T10:00:00Z' };
    youtubeThumbnailsApi.sources.mockResolvedValueOnce({ ...SOURCES, draft, template: presetLayers('lala-left', { title: 'Old' }, {}) });
    const { unmount } = renderPage();
    await opened();
    expect(screen.getByLabelText('Title').value).toBe('Kept title');
    expect(screen.getByTestId('yts-draft-note').textContent).toBe('Your arrangement for this episode.');
    unmount();

    const template = presetLayers('lala-left', { title: 'Old', kicker: 'Old show', badge: 'EP 0', lalaUrl: 'https://b.s3.amazonaws.com/x.png' }, {});
    template.layers.find((l) => l.role === 'title').rotation = -8;
    youtubeThumbnailsApi.sources.mockResolvedValueOnce({ ...SOURCES, template });
    renderPage();
    await opened();
    expect(screen.getByLabelText('Title').value).toBe('Studio by Sable');
    expect(screen.getByLabelText('Badge').value).toBe('EP 1');
  });

  test('a change on the canvas (moved, resized, turned) is kept for the episode, a moment later', async () => {
    renderPage();
    await opened();
    fireEvent.click(screen.getByTestId('canvas-title'));
    expect(screen.getByTestId('yts-layer-settings')).toBeTruthy();
    fireEvent.click(screen.getByTestId('canvas-drag'));
    await waitFor(() => expect(youtubeThumbnailsApi.saveDraft).toHaveBeenCalled(), { timeout: 3000 });
    expect(youtubeThumbnailsApi.saveDraft.mock.calls.at(-1)[0]).toBe('ep-1');
    expect(layerOf(lastDraft(), 'title')).toMatchObject({ x: 99, y: 11, w: 300, h: 200, rotation: -12 });
    expect(await screen.findByText('Arrangement kept for this episode.')).toBeTruthy();
  });

  test('before the server has its update, keeping the arrangement says so', async () => {
    youtubeThumbnailsApi.saveDraft.mockRejectedValue({ response: { status: 503 } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderPage();
    await opened();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'The Atelier' } });
    expect(await screen.findByText('Arrangements are kept once the server has its latest update.', {}, { timeout: 3000 })).toBeTruthy();
  });

  test('the controls change the layers: words, the background from its folder, the accent, Lala gone and back', async () => {
    renderPage();
    await opened();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'The Atelier' } });
    const bg = screen.getByTestId('yts-backgrounds');
    // The background opens in Scene sets; the cover is in its Show folder.
    fireEvent.click(within(bg).getByTestId('yts-backgrounds-folder-scene-sets/show'));
    fireEvent.click(within(bg).getByTitle('Show cover'));
    fireEvent.click(screen.getByRole('button', { name: 'Accent #A46EE0' }));
    fireEvent.click(within(screen.getByTestId('yts-lala')).getByRole('button', { name: /No Lala/ }));
    await waitFor(() => expect(youtubeThumbnailsApi.saveDraft).toHaveBeenCalled(), { timeout: 3000 });
    const spec = lastDraft();
    expect(layerOf(spec, 'title').text).toBe('The Atelier');
    expect(layerOf(spec, 'background').src).toBe('https://b.s3.amazonaws.com/cover.jpg');
    expect(layerOf(spec, 'shade').accent).toBe('#A46EE0');
    expect(layerOf(spec, 'badge').fill).toBe('#A46EE0');
    expect(layerOf(spec, 'lala')).toBeNull();
    // Lala again: from the Asset library (she has no poses here).
    fireEvent.click(within(screen.getByTestId('yts-lala')).getByTitle('Lala 1'));
    expect(screen.getByTestId('canvas-lala')).toBeTruthy();
  });

  test('a layout starts again from its arrangement, after asking once something was changed', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await opened();
    fireEvent.click(screen.getByRole('button', { name: /Title only/ }));
    expect(confirm).not.toHaveBeenCalled(); // nothing changed yet
    expect(screen.queryByTestId('canvas-lala')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Lala left/ }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Lala left/ }).getAttribute('aria-pressed')).toBe('true');
  });

  test('the layers list hides, orders and removes; words and pictures can be added', async () => {
    renderPage();
    await opened();
    const list = screen.getByTestId('yts-layers');
    fireEvent.click(within(list).getByRole('button', { name: 'Hide Badge' }));
    expect(screen.queryByTestId('canvas-badge')).toBeNull();
    fireEvent.click(within(list).getByRole('button', { name: 'Remove Show name' }));
    expect(screen.queryByTestId('canvas-kicker')).toBeNull();
    fireEvent.click(within(list).getByRole('button', { name: 'Send Title back' }));
    fireEvent.click(screen.getByTestId('yts-add-text'));
    const add = screen.getByTestId('yts-add-picture');
    fireEvent.click(within(add).getByTestId('yts-add-picture-folder-outfit/dress'));
    fireEvent.click(within(add).getByTitle('Sweater dress'));
    await waitFor(() => expect(youtubeThumbnailsApi.saveDraft).toHaveBeenCalled(), { timeout: 3000 });
    const spec = lastDraft();
    // The title went back one, behind Lala.
    expect(spec.layers.map((l) => l.id)).toEqual(['background', 'shade', 'title', 'lala', 'badge', 'text-1', 'picture-1']);
    expect(layerOf(spec, 'badge').visible).toBe(false);
    expect(spec.layers.at(-1)).toMatchObject({ src: 'https://b.s3.amazonaws.com/dress.png', name: 'Sweater dress' });
  });

  test('an upload is kept on the server, used, and listed in Uploads', async () => {
    youtubeThumbnailsApi.uploadPicture.mockResolvedValue({ url: 'https://b.s3.amazonaws.com/up/mine.jpg', label: 'mine.jpg' });
    renderPage();
    await opened();
    const file = new File(['x'], 'mine.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByTestId('yts-backgrounds-input'), { target: { files: [file] } });
    await waitFor(() => expect(youtubeThumbnailsApi.uploadPicture).toHaveBeenCalledWith('ep-1', file));
    await waitFor(() => expect(youtubeThumbnailsApi.saveDraft).toHaveBeenCalled(), { timeout: 3000 });
    expect(layerOf(lastDraft(), 'background').src).toBe('https://b.s3.amazonaws.com/up/mine.jpg');
    fireEvent.click(within(screen.getByTestId('yts-lala')).getByRole('button', { name: 'All folders' }));
    expect(within(screen.getByTestId('yts-lala')).getByRole('button', { name: 'Uploads, 1 picture' })).toBeTruthy();
  });

  test('See it exactly draws it on the server; Save stores the layers as the episode\'s thumbnail and lists it', async () => {
    youtubeThumbnailsApi.save.mockResolvedValue({ id: 7, url: 'https://b.s3.amazonaws.com/t.png' });
    renderPage();
    await opened();
    fireEvent.click(screen.getByTestId('yts-exact'));
    await waitFor(() => expect(youtubeThumbnailsApi.render).toHaveBeenCalledWith(expect.objectContaining({ version: 2 })));
    expect((await screen.findByTestId('yts-preview')).getAttribute('src')).toBe('blob:exact');
    youtubeThumbnailsApi.saved.mockResolvedValue([{ id: 7, url: 'https://b.s3.amazonaws.com/t.png', isPrimary: true }]);
    fireEvent.click(screen.getByTestId('yts-save'));
    await waitFor(() => expect(youtubeThumbnailsApi.save).toHaveBeenCalledWith('ep-1', expect.objectContaining({ version: 2 })));
    expect(layerOf(youtubeThumbnailsApi.save.mock.calls[0][1], 'title').text).toBe('Studio by Sable');
    expect(await screen.findByText("Saved as the episode's thumbnail.")).toBeTruthy();
    expect(within(await screen.findByTestId('yts-saved-7')).getByText('Episode thumbnail')).toBeTruthy();
  });

  test('Save as template keeps the arrangement, the colours and the show\'s own Lala for every episode', async () => {
    youtubeThumbnailsApi.saveStyle.mockResolvedValue({});
    renderPage();
    await opened();
    fireEvent.click(screen.getByTestId('yts-save-template'));
    await waitFor(() => expect(youtubeThumbnailsApi.saveStyle).toHaveBeenCalled());
    const [showId, style] = youtubeThumbnailsApi.saveStyle.mock.calls[0];
    expect(showId).toBe('show-1');
    expect(style).toMatchObject({ layout: 'lala-right', accent: '#B8962E', textColor: '#FFFFFF', dim: 0.3, lalaUrl: 'https://b.s3.amazonaws.com/lala2.png' });
    expect(style.template.layers.map((l) => l.role)).toEqual(['background', 'shade', 'lala', 'kicker', 'title', 'badge']);
    expect(await screen.findByText(/Template saved for Styling Adventures/)).toBeTruthy();
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
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    fireEvent.click(within(await screen.findByTestId('yts-saved-8')).getByRole('button', { name: /Delete/ }));
    await waitFor(() => expect(youtubeThumbnailsApi.removeSaved).toHaveBeenCalledWith('ep-1', 8));
    await waitFor(() => expect(screen.queryByTestId('yts-saved-8')).toBeNull());
    expect(screen.getByTestId('yts-saved-9')).toBeTruthy();
  });

  test('a refused save says why; the episode list\'s error stays on screen', async () => {
    youtubeThumbnailsApi.save.mockRejectedValue({ response: { data: { error: 'The background is not a picture we can read' } } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderPage();
    await opened();
    fireEvent.click(screen.getByTestId('yts-save'));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'The background is not a picture we can read');
  });

  test('with no episode chosen it asks for one', async () => {
    renderPage('/template-studio/youtube');
    expect(await screen.findByText('Choose a show and an episode to make its thumbnail.')).toBeTruthy();
    expect(youtubeThumbnailsApi.sources).not.toHaveBeenCalled();
  });

  test('the episode\'s poses: Lala starts on her starred pose, in her folder; JustAWoman joins when picked', async () => {
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
    await opened();
    const lala = screen.getByTestId('yts-lala');
    expect(within(lala).getByTestId('yts-lala-crumbs').textContent).toBe('All foldersCharacter posesLala');
    fireEvent.click(within(lala).getByRole('button', { name: 'Front, 1 picture' }));
    expect(within(lala).getByTitle('Front ★').getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByTestId('yts-poses-note')).toBeNull();
    expect(screen.queryByTestId('canvas-jaw')).toBeNull();
    const jaw = screen.getByTestId('yts-jaw');
    fireEvent.click(within(jaw).getByTestId('yts-jaw-folder-poses/justawoman/glamour'));
    fireEvent.click(within(jaw).getByTitle('Glamour ★'));
    expect(screen.getByTestId('canvas-jaw')).toBeTruthy();
    fireEvent.click(within(jaw).getByRole('button', { name: /No JustAWoman/ }));
    expect(screen.queryByTestId('canvas-jaw')).toBeNull();
  });

  test('with no poses yet it points to the Files tab', async () => {
    renderPage();
    const note = await screen.findByTestId('yts-poses-note');
    expect(within(note).getByRole('link', { name: 'Files tab' }).getAttribute('href')).toBe('/episodes/ep-1?tab=files');
    expect(screen.getByTestId('yts-jaw')).toBeTruthy();
  });
});
