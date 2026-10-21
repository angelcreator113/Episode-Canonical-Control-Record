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
      templates: vi.fn(), createTemplate: vi.fn(), updateTemplate: vi.fn(), deleteTemplate: vi.fn(),
    },
  };
});
vi.mock('../lib/picturePreview', () => ({
  previewUrl: (url) => Promise.resolve(url),
  previewWidth: () => 800,
  usePreview: (url) => url,
}));
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
    expect(thumbnailStudioHref({ showId: 's1', templateId: 't1' })).toBe('/template-studio/youtube?show=s1&template=t1');
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

  test('the episode list\'s error stays on screen after the thumbnail is drawn', async () => {
    youtubeThumbnailsApi.episodes.mockRejectedValue(new Error('400'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderPage();
    await opened();
    fireEvent.click(screen.getByTestId('yts-exact'));
    await screen.findByTestId('yts-preview');
    expect(screen.getByText('Could not load the episodes.')).toBeTruthy();
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

  test('a layout starts again from its arrangement, after asking on the page once something was changed', async () => {
    renderPage();
    await opened();
    fireEvent.click(screen.getByRole('button', { name: /Title only/ }));
    expect(screen.queryByTestId('yts-ask')).toBeNull(); // nothing changed yet
    expect(screen.queryByTestId('canvas-lala')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Lala left/ }));
    const ask = within(screen.getByTestId('yts-ask'));
    expect(ask.getByText(/Start again from this layout\?/)).toBeTruthy();
    fireEvent.click(ask.getByRole('button', { name: 'No' }));
    expect(screen.getByRole('button', { name: /Lala left/ }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: /Lala left/ }));
    fireEvent.click(within(screen.getByTestId('yts-ask')).getByRole('button', { name: 'Yes' }));
    expect(screen.queryByTestId('yts-ask')).toBeNull();
    expect(screen.getByRole('button', { name: /Lala left/ }).getAttribute('aria-pressed')).toBe('true');
  });

  test('Come Style Me: the episode\'s checklist, edition and pieces; the checklist\'s rows ticked and worded here; the headline', async () => {
    youtubeThumbnailsApi.sources.mockResolvedValue({
      ...SOURCES,
      poses: {
        lala: [
          { id: 'p1', url: 'https://b.s3.amazonaws.com/glam.png', pose: 'glamour', label: 'Glamour ★', isDefault: true },
          { id: 'p2', url: 'https://b.s3.amazonaws.com/back.png', pose: 'back', label: 'Back ★', isDefault: true },
        ],
        justawoman: [],
      },
      suggest: {
        checklist: [{ text: 'Sweater dress', checked: true }, { text: 'Hair', checked: true }, { text: 'Vibe', checked: true }],
        edition: 'Sweater Dress Edition',
        pieces: [{ url: 'https://b.s3.amazonaws.com/dress.png', label: 'Sweater dress' }],
        logoUrl: null,
      },
    });
    renderPage();
    await opened();
    expect(screen.queryByTestId('yts-checklist')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Come Style Me/ }));
    // The core and what the episode has: the back pose as the full outfit, its one piece, its edition.
    expect(within(screen.getByTestId('yts-canvas')).getAllByRole('button').map((b) => b.textContent).slice(0, -1))
      .toEqual(['background', 'shade', 'outfit', 'lala', 'piece-1', 'checklist', 'headline', 'kicker', 'edition', 'badge']);
    expect(screen.queryByLabelText('Title')).toBeNull();
    expect(screen.getByLabelText('Headline').value).toBe('Come Style Me');
    expect(screen.getByLabelText('Edition label').value).toBe('Sweater Dress Edition');
    const list = screen.getByTestId('yts-checklist');
    fireEvent.change(within(list).getByLabelText('Checklist row 1'), { target: { value: 'Red sweater dress' } });
    fireEvent.click(within(list).getByLabelText('Tick Hair'));
    fireEvent.click(within(list).getByRole('button', { name: 'Remove checklist row 3' }));
    fireEvent.click(within(list).getByRole('button', { name: 'Add a row' }));
    fireEvent.change(screen.getByLabelText('Headline'), { target: { value: 'Style Me' } });
    await waitFor(() => expect(youtubeThumbnailsApi.saveDraft).toHaveBeenCalled(), { timeout: 3000 });
    const spec = lastDraft();
    expect(layerOf(spec, 'checklist').items).toEqual([
      { text: 'Red sweater dress', checked: true }, { text: 'Hair', checked: false }, { text: 'New', checked: true },
    ]);
    expect(layerOf(spec, 'headline').text).toBe('Style Me');
    expect(layerOf(spec, 'outfit').src).toBe('https://b.s3.amazonaws.com/back.png');
    expect(layerOf(spec, 'lala').src).toBe('https://b.s3.amazonaws.com/glam.png');
    expect(layerOf(spec, 'badge').text).toBe('EPISODE 1');
  });

  test('undo and redo: buttons and Ctrl+Z / Ctrl+Shift+Z; quick changes are one step; not while typing in a field', async () => {
    renderPage();
    await opened();
    expect(screen.getByTestId('yts-undo').disabled).toBe(true);
    fireEvent.click(screen.getByTestId('canvas-title'));
    fireEvent.click(screen.getByTestId('canvas-drag'));
    expect(screen.getByTestId('yts-undo').disabled).toBe(false);
    const title = () => screen.getAllByRole('spinbutton', { name: 'Left (points)' })[0].value;
    expect(title()).toBe('99');
    fireEvent.click(screen.getByTestId('yts-undo'));
    expect(title()).toBe('70'); // Lala right: the title starts at 70
    expect(screen.getByTestId('yts-redo').disabled).toBe(false);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(title()).toBe('99');
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(title()).toBe('70');
    // Typing quickly is one step; Ctrl+Z inside a field is the field's own.
    const field = screen.getByLabelText('Title');
    fireEvent.change(field, { target: { value: 'A' } });
    fireEvent.change(field, { target: { value: 'AB' } });
    fireEvent.keyDown(field, { key: 'z', ctrlKey: true });
    expect(field.value).toBe('AB');
    fireEvent.click(screen.getByTestId('yts-undo'));
    expect(screen.getByLabelText('Title').value).toBe('Studio by Sable');
  });

  test('lock: a locked layer\'s place and size cannot be typed; copy: a copy with no role, picked; Ctrl+D copies the picked one', async () => {
    renderPage();
    await opened();
    const list = screen.getByTestId('yts-layers');
    fireEvent.click(within(list).getByRole('button', { name: 'Lock Lala' }));
    expect(within(list).getByRole('button', { name: 'Unlock Lala' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByTestId('canvas-lala'));
    expect(screen.getByRole('spinbutton', { name: 'Width (points)' }).disabled).toBe(true);
    fireEvent.click(within(list).getByRole('button', { name: 'Copy Lala' }));
    // The copy is picked and can be moved; its size can be typed.
    const width = screen.getByRole('spinbutton', { name: 'Width (points)' });
    expect(width.disabled).toBe(false);
    fireEvent.change(width, { target: { value: '300' } });
    fireEvent.keyDown(window, { key: 'd', ctrlKey: true });
    await waitFor(() => expect(youtubeThumbnailsApi.saveDraft).toHaveBeenCalled(), { timeout: 3000 });
    const spec = lastDraft();
    expect(spec.layers.map((l) => l.id).slice(0, 5)).toEqual(['background', 'shade', 'lala', 'lala-copy-1', 'image-copy-1']);
    expect(layerOf(spec, 'lala').locked).toBe(true);
    expect(spec.layers[3]).toMatchObject({ role: null, locked: false, w: 300 });
    expect(spec.layers[4]).toMatchObject({ role: null, w: 300 });
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

  test('the episode\'s earlier uploads are listed with this visit\'s, newest first, in one Uploads folder', async () => {
    youtubeThumbnailsApi.sources.mockResolvedValue({
      ...SOURCES,
      folders: [{ key: 'uploads', label: 'Uploads', items: [{ url: 'https://b.s3.amazonaws.com/up/old.png', label: 'Old one' }] }, ...SOURCES.folders],
    });
    youtubeThumbnailsApi.uploadPicture.mockResolvedValue({ url: 'https://b.s3.amazonaws.com/up/new.png', label: 'New one' });
    renderPage();
    await opened();
    fireEvent.change(screen.getByTestId('yts-add-picture-input'), { target: { files: [new File(['x'], 'new.png', { type: 'image/png' })] } });
    await waitFor(() => expect(youtubeThumbnailsApi.uploadPicture).toHaveBeenCalled());
    const add = screen.getByTestId('yts-add-picture');
    fireEvent.click(within(add).getByRole('button', { name: 'All folders' }));
    expect(within(add).getAllByRole('button', { name: /^Uploads, / })).toHaveLength(1);
    fireEvent.click(within(add).getByRole('button', { name: 'Uploads, 2 pictures' }));
    expect(within(add).getAllByRole('button', { pressed: false }).map((b) => b.title).filter(Boolean)).toEqual(['New one', 'Old one']);
  });

  test('try it on another episode: that episode\'s words and pictures in this arrangement, drawn on the server', async () => {
    youtubeThumbnailsApi.episodes.mockResolvedValue([
      { id: 'ep-1', episode_number: 1, title: 'Studio by Sable' },
      { id: 'ep-2', episode_number: 2, title: 'Gala Night' },
    ]);
    renderPage();
    await opened();
    fireEvent.click(screen.getByTestId('canvas-title'));
    fireEvent.click(screen.getByTestId('canvas-drag'));
    youtubeThumbnailsApi.sources.mockResolvedValueOnce({ ...SOURCES, episode: { id: 'ep-2', title: 'Gala Night', episode_number: 2 } });
    const select = screen.getByLabelText('Try it on another episode');
    expect([...select.options].map((o) => o.textContent)).toEqual(['Choose an episode', '2. Gala Night']);
    fireEvent.change(select, { target: { value: 'ep-2' } });
    await waitFor(() => expect(youtubeThumbnailsApi.render).toHaveBeenCalled());
    const drawn = youtubeThumbnailsApi.render.mock.calls.at(-1)[0];
    expect(layerOf(drawn, 'title')).toMatchObject({ text: 'Gala Night', x: 99, rotation: -12 });
    expect(layerOf(drawn, 'badge').text).toBe('EP 2');
    expect(await screen.findByTestId('yts-try-figure')).toBeTruthy();
    // This episode is unchanged.
    expect(screen.getByLabelText('Title').value).toBe('Studio by Sable');
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

  test('arranging: Shift-click picks several in the layers list; line them up; spread three; one lines up with the canvas', async () => {
    renderPage();
    await opened();
    const list = within(screen.getByTestId('yts-layers'));
    fireEvent.click(list.getByRole('button', { name: 'Title' }));
    fireEvent.click(list.getByRole('button', { name: 'Show name' }), { shiftKey: true });
    const bar = within(screen.getByTestId('yts-arrange'));
    expect(bar.getByText('2 picked')).toBeTruthy();
    expect(bar.getByRole('button', { name: 'Spread evenly across' }).disabled).toBe(true);
    fireEvent.click(bar.getByRole('button', { name: 'Line up left edges' }));
    await waitFor(() => expect(youtubeThumbnailsApi.saveDraft).toHaveBeenCalled(), { timeout: 3000 });
    const left = Math.min(layerOf(lastDraft(), 'title').x, layerOf(lastDraft(), 'kicker').x);
    expect(layerOf(lastDraft(), 'title').x).toBe(left);
    expect(layerOf(lastDraft(), 'kicker').x).toBe(left);
    // A third: spread across.
    fireEvent.click(list.getByRole('button', { name: 'Badge' }), { ctrlKey: true });
    expect(within(screen.getByTestId('yts-arrange')).getByText('3 picked')).toBeTruthy();
    expect(within(screen.getByTestId('yts-arrange')).getByRole('button', { name: 'Spread evenly across' }).disabled).toBe(false);
    // Shift-click again takes one away.
    fireEvent.click(list.getByRole('button', { name: 'Badge' }), { shiftKey: true });
    expect(within(screen.getByTestId('yts-arrange')).getByText('2 picked')).toBeTruthy();
    // One picked lines up with the canvas: centred across 1280.
    fireEvent.click(list.getByRole('button', { name: 'Title' }));
    const n = youtubeThumbnailsApi.saveDraft.mock.calls.length;
    fireEvent.click(within(screen.getByTestId('yts-arrange')).getByRole('button', { name: 'Line up centres across' }));
    await waitFor(() => expect(youtubeThumbnailsApi.saveDraft.mock.calls.length).toBeGreaterThan(n), { timeout: 3000 });
    const t = layerOf(lastDraft(), 'title');
    expect(Math.abs(t.x + t.w / 2 - 640)).toBeLessThanOrEqual(1);
  });

  test('keys: Delete removes the picked layers (not locked ones), Esc picks nothing, ? shows the shortcuts', async () => {
    renderPage();
    await opened();
    const list = within(screen.getByTestId('yts-layers'));
    fireEvent.click(list.getByRole('button', { name: 'Lock Badge' }));
    fireEvent.click(list.getByRole('button', { name: 'Show name' }));
    fireEvent.click(list.getByRole('button', { name: 'Badge' }), { shiftKey: true });
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(screen.queryByTestId('canvas-kicker')).toBeNull();
    expect(screen.getByTestId('canvas-badge')).toBeTruthy(); // locked: kept
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('yts-arrange')).toBeNull();
    // Typing in a field is left alone.
    fireEvent.click(list.getByRole('button', { name: 'Title' }));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Title words' }), { key: 'Backspace' });
    expect(screen.getByTestId('canvas-title')).toBeTruthy();
    fireEvent.keyDown(window, { key: '?' });
    expect(within(screen.getByTestId('yts-shortcuts')).getByText('Pick everything the box touches')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close the shortcuts' }));
    expect(screen.queryByTestId('yts-shortcuts')).toBeNull();
    fireEvent.click(screen.getByTestId('yts-keys-btn'));
    expect(screen.getByTestId('yts-shortcuts')).toBeTruthy();
  });

  test('loading: a sign while the episode loads; when it fails, Try again loads it again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let fail;
    youtubeThumbnailsApi.sources.mockReturnValueOnce(new Promise((_, reject) => { fail = reject; }));
    renderPage();
    expect(await screen.findByTestId('yts-loading')).toBeTruthy();
    fail({ response: { data: { error: 'The server is busy' } } });
    expect((await screen.findByRole('alert')).textContent).toContain('The server is busy');
    expect(screen.queryByTestId('yts-loading')).toBeNull();
    fireEvent.click(screen.getByTestId('yts-retry'));
    await opened();
    expect(youtubeThumbnailsApi.sources).toHaveBeenCalledTimes(2);
  });

  test('text tools: line up, largest size, letter spacing, a box behind the words', async () => {
    renderPage();
    await opened();
    fireEvent.click(screen.getByTestId('canvas-title'));
    const tools = within(screen.getByTestId('yts-text-tools'));
    fireEvent.click(tools.getByRole('button', { name: 'Line up centre' }));
    expect(tools.getByRole('button', { name: 'Line up centre' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(tools.getByRole('slider', { name: 'Largest size' }), { target: { value: '150' } });
    fireEvent.change(tools.getByRole('slider', { name: 'Letter spacing' }), { target: { value: '6' } });
    fireEvent.click(tools.getByRole('checkbox', { name: 'Box behind the words' }));
    fireEvent.change(tools.getByRole('slider', { name: 'Box see-through' }), { target: { value: '0.25' } });
    fireEvent.change(tools.getByRole('slider', { name: 'Box rounded corners' }), { target: { value: '24' } });
    await waitFor(() => expect(layerOf(lastDraft(), 'title').bgRadius).toBe(24), { timeout: 3000 });
    expect(layerOf(lastDraft(), 'title')).toMatchObject({ align: 'center', size: 150, spacing: 6, bg: '#2C2C2C', bgOpacity: 0.75 });
    fireEvent.click(tools.getByRole('checkbox', { name: 'Box behind the words' }));
    await waitFor(() => expect(layerOf(lastDraft(), 'title').bg).toBeNull(), { timeout: 3000 });
  });

  test('any colour: the accent and the title from the free picker; picked ones are remembered as swatches', async () => {
    window.localStorage.removeItem('yts-recent-colours');
    renderPage();
    await opened();
    const accent = screen.getByLabelText('Any accent colour');
    fireEvent.change(accent, { target: { value: '#123abc' } });
    fireEvent.blur(accent);
    expect(screen.getByRole('button', { name: 'Accent #123ABC' }).getAttribute('aria-pressed')).toBe('true');
    const title = screen.getByLabelText('Any title colour');
    fireEvent.change(title, { target: { value: '#ff8800' } });
    fireEvent.blur(title);
    await waitFor(() => expect(layerOf(lastDraft(), 'title').color).toBe('#FF8800'), { timeout: 3000 });
    expect(layerOf(lastDraft(), 'kicker').color).toBe('#123ABC');
    expect(JSON.parse(window.localStorage.getItem('yts-recent-colours'))).toEqual(['#FF8800', '#123ABC']);
    expect(screen.getByRole('option', { name: 'Recent #123ABC' })).toBeTruthy();
  });

  test('Save as a new template: named, with the colours and the show\'s own Lala; the list comes back', async () => {
    youtubeThumbnailsApi.saveStyle.mockResolvedValue({});
    youtubeThumbnailsApi.createTemplate.mockResolvedValue({ id: 't-1' });
    const tpl = presetLayers('lala-right', { title: 'X' }, {});
    youtubeThumbnailsApi.templates.mockResolvedValue([{ id: 't-1', name: 'Come Style Me', isDefault: true, previewUrl: null, spec: tpl }]);
    renderPage();
    await opened();
    expect(screen.getByText(/No templates yet/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('yts-save-template'));
    fireEvent.change(screen.getByRole('textbox', { name: 'New template name' }), { target: { value: ' Come Style Me ' } });
    expect(screen.getByRole('checkbox', { name: 'Every episode starts from it' }).checked).toBe(true); // the first is the default
    fireEvent.click(screen.getByRole('button', { name: 'Save template' }));
    await waitFor(() => expect(youtubeThumbnailsApi.createTemplate).toHaveBeenCalled());
    const [showId, style] = youtubeThumbnailsApi.saveStyle.mock.calls[0];
    expect(showId).toBe('show-1');
    expect(style).toEqual({ layout: 'lala-right', accent: '#B8962E', textColor: '#FFFFFF', dim: 0.3, lalaUrl: 'https://b.s3.amazonaws.com/lala2.png' });
    const [tShow, body] = youtubeThumbnailsApi.createTemplate.mock.calls[0];
    expect(tShow).toBe('show-1');
    expect(body.name).toBe('Come Style Me');
    expect(body.makeDefault).toBe(true);
    expect(body.spec.layers.map((l) => l.role)).toEqual(['background', 'shade', 'lala', 'kicker', 'title', 'badge']);
    expect(await screen.findByText(/Template "Come Style Me" saved for Styling Adventures. Every episode starts from it./)).toBeTruthy();
    expect(within(screen.getByTestId('yts-template-t-1')).getByText('Come Style Me')).toBeTruthy();
  });

  test('templates: use one (undo goes back), rename, make default, update with this, delete after asking', async () => {
    const haul = presetLayers('center', { title: 'Old' }, {});
    const list = [
      { id: 't-1', name: 'Come Style Me', isDefault: true, previewUrl: 'https://b.s3.amazonaws.com/t1.jpg', spec: presetLayers('lala-left', {}, {}) },
      { id: 't-2', name: 'Haul', isDefault: false, previewUrl: null, spec: haul },
    ];
    youtubeThumbnailsApi.sources.mockResolvedValueOnce({ ...SOURCES, templates: list, template: list[0].spec });
    youtubeThumbnailsApi.templates.mockResolvedValue(list);
    youtubeThumbnailsApi.updateTemplate.mockResolvedValue({});
    youtubeThumbnailsApi.deleteTemplate.mockResolvedValue({});
    youtubeThumbnailsApi.saveStyle.mockResolvedValue({});
    renderPage();
    await opened();
    const card = () => screen.getByTestId('yts-template-t-2');
    fireEvent.click(within(card()).getByRole('button', { name: 'Use' }));
    // Haul's layers, this episode's words.
    expect(screen.getByText(/Started from "Haul"/)).toBeTruthy();
    await waitFor(() => expect(youtubeThumbnailsApi.saveDraft).toHaveBeenCalled(), { timeout: 3000 });
    expect(layerOf(lastDraft(), 'title').text).toBe('Studio by Sable');
    expect(layerOf(lastDraft(), 'title').x).toBe(layerOf(haul, 'title').x);
    expect(layerOf(haul, 'title').x).not.toBe(layerOf(list[0].spec, 'title').x);
    const kept = youtubeThumbnailsApi.saveDraft.mock.calls.length;
    fireEvent.click(screen.getByTestId('yts-undo'));
    await waitFor(() => expect(youtubeThumbnailsApi.saveDraft.mock.calls.length).toBeGreaterThan(kept), { timeout: 3000 });
    expect(layerOf(lastDraft(), 'title').x).toBe(layerOf(list[0].spec, 'title').x);

    fireEvent.click(within(card()).getByRole('button', { name: /rename/i }));
    fireEvent.change(screen.getByRole('textbox', { name: 'New name for Haul' }), { target: { value: 'Big Haul' } });
    fireEvent.click(within(card()).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(youtubeThumbnailsApi.updateTemplate).toHaveBeenCalledWith('show-1', 't-2', { name: 'Big Haul' }));
    expect(await screen.findByText('Renamed to "Big Haul".')).toBeTruthy();

    fireEvent.click(within(card()).getByRole('button', { name: /make default/i }));
    await waitFor(() => expect(youtubeThumbnailsApi.updateTemplate).toHaveBeenCalledWith('show-1', 't-2', { isDefault: true }));

    fireEvent.click(within(card()).getByRole('button', { name: 'Update with this' }));
    fireEvent.click(within(card()).getByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(youtubeThumbnailsApi.updateTemplate).toHaveBeenCalledWith('show-1', 't-2', { spec: expect.objectContaining({ version: 2 }) }));

    fireEvent.click(within(card()).getByRole('button', { name: 'Delete Haul' }));
    fireEvent.click(within(card()).getByRole('button', { name: 'No' }));
    expect(youtubeThumbnailsApi.deleteTemplate).not.toHaveBeenCalled();
    fireEvent.click(within(card()).getByRole('button', { name: 'Delete Haul' }));
    fireEvent.click(within(card()).getByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(youtubeThumbnailsApi.deleteTemplate).toHaveBeenCalledWith('show-1', 't-2'));
  });

  test('a taken name: the server\'s reason shows and the name stays to change', async () => {
    const list = [{ id: 't-1', name: 'Haul', isDefault: true, previewUrl: null, spec: presetLayers('center', {}, {}) }];
    youtubeThumbnailsApi.sources.mockResolvedValueOnce({ ...SOURCES, templates: list, template: list[0].spec });
    youtubeThumbnailsApi.saveStyle.mockResolvedValue({});
    youtubeThumbnailsApi.createTemplate.mockRejectedValue({ response: { status: 409, data: { error: 'That name is taken' } } });
    renderPage();
    await opened();
    fireEvent.click(screen.getByTestId('yts-save-template'));
    expect(screen.getByRole('checkbox', { name: 'Every episode starts from it' }).checked).toBe(false);
    fireEvent.change(screen.getByRole('textbox', { name: 'New template name' }), { target: { value: 'haul' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save template' }));
    expect(await screen.findByText('That name is taken')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'New template name' }).value).toBe('haul');
  });

  test('?template= starts the episode from that template, over its own arrangement, and keeps it', async () => {
    const haul = presetLayers('center', { title: 'Old' }, {});
    const draft = presetLayers('lala-left', { title: 'Mine' }, {});
    youtubeThumbnailsApi.sources.mockResolvedValueOnce({ ...SOURCES, draft, templates: [{ id: 't-2', name: 'Haul', isDefault: false, spec: haul }] });
    renderPage('/template-studio/youtube?show=show-1&episode=ep-1&template=t-2');
    await opened();
    expect(screen.getByTestId('yts-draft-note').textContent).toBe('Started from "Haul".');
    expect(screen.queryByTestId('canvas-lala')).toBeNull();
    await waitFor(() => expect(youtubeThumbnailsApi.saveDraft).toHaveBeenCalled(), { timeout: 3000 });
    expect(layerOf(lastDraft(), 'title').text).toBe('Studio by Sable');
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
    renderPage();
    fireEvent.click(within(await screen.findByTestId('yts-saved-8')).getByRole('button', { name: /Delete/ }));
    expect(youtubeThumbnailsApi.removeSaved).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByTestId('yts-ask')).getByRole('button', { name: 'Yes' }));
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
