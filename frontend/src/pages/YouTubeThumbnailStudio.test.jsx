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
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../lib/youtubeThumbnailsApi', async () => {
  const actual = await vi.importActual('../lib/youtubeThumbnailsApi');
  return {
    ...actual,
    youtubeThumbnailsApi: {
      sources: vi.fn(), render: vi.fn(), save: vi.fn(), saveStyle: vi.fn(), shows: vi.fn(), episodes: vi.fn(),
      saved: vi.fn(), makePrimary: vi.fn(), removeSaved: vi.fn(), saveDraft: vi.fn(), draft: vi.fn(), uploadPicture: vi.fn(),
      templates: vi.fn(), createTemplate: vi.fn(), updateTemplate: vi.fn(), deleteTemplate: vi.fn(),
      versions: vi.fn(), createVersion: vi.fn(), updateVersion: vi.fn(), deleteVersion: vi.fn(),
      season: vi.fn(), renderSmall: vi.fn(),
      titleIdeas: vi.fn(), cutOut: vi.fn(),
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
  default: ({ spec, selectedId, onSelect, onChange, onSnapshot, grid, safeZones, onZoom }) => (
    <>
    <button type="button" data-testid="canvas-snapshot" onClick={() => onSnapshot?.('data:image/jpeg;base64,c25hcA==')}>snapshot</button>
    <button type="button" data-testid="canvas-pinch" onClick={() => onZoom?.(2.1)}>pinch</button>
    <button type="button" data-testid="canvas-pinch-far" onClick={() => onZoom?.(40)}>pinch far</button>
    <div data-testid="yts-canvas" data-grid={String(Boolean(grid))} data-safe={String(Boolean(safeZones))}>
      {spec.layers.filter((l) => l.visible).map((l) => (
        <button key={l.id} type="button" data-testid={`canvas-${l.id}`} onClick={() => onSelect(l.id)}>{l.id}</button>
      ))}
      <button type="button" data-testid="canvas-drag" onClick={() => onChange(selectedId, { x: 99, y: 11, w: 300, h: 200, rotation: -12 })}>drag</button>
    </div>
    </>
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
    expect(spec.layers.map((l) => l.id)).toEqual(['background', 'shade', 'title', 'lala', 'badge', 'text-1', 'piece-1']);
    expect(layerOf(spec, 'badge').visible).toBe(false);
    // An outfit piece comes in on a photo card, as the layout's pieces do (Evoni, 2026-10-21).
    expect(spec.layers.at(-1)).toMatchObject({ src: 'https://b.s3.amazonaws.com/dress.png', name: 'Sweater dress', frame: 'polaroid', w: 172, h: 172 });
  });

  test('saved thumbnails that do not load: the message says the server\'s answer', async () => {
    youtubeThumbnailsApi.saved.mockRejectedValue({ response: { status: 500, data: { error: 'column "url" does not exist' } } });
    renderPage();
    await opened();
    expect((await screen.findByText(/^Could not load the saved thumbnails/)).textContent)
      .toBe('Could not load the saved thumbnails (500: column "url" does not exist).');
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
    // The shortcuts are also in the canvas's ⋮ menu.
    fireEvent.click(screen.getByTestId('yts-more-btn'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Keyboard shortcuts' }));
    expect(screen.queryByRole('menu')).toBeNull();
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

  test('where YouTube shows it: three sizes with the timestamp; words too small or under the timestamp are named, and pick their layer', async () => {
    renderPage();
    await opened();
    expect(screen.queryByTestId('yts-youtube')).toBeNull(); // no picture of the canvas yet
    fireEvent.click(screen.getByTestId('canvas-snapshot'));
    const yt = within(screen.getByTestId('yts-youtube'));
    expect(yt.getAllByRole('img').map((i) => i.getAttribute('alt'))).toEqual([
      'The thumbnail 360 pixels wide', 'The thumbnail 343 pixels wide', 'The thumbnail 168 pixels wide',
    ]);
    expect(yt.getByText('Up next, beside a video')).toBeTruthy();
    expect(yt.getByText('Readable at every size, and clear of the timestamp.')).toBeTruthy();
    // A title far too long for its box is drawn tiny.
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'word '.repeat(30) } });
    const warn = within(screen.getByTestId('yts-yt-warnings')).getByRole('button', { name: /^Title is about [\d.]+ pixels tall beside a video/ });
    fireEvent.click(warn);
    expect(screen.getByTestId('yts-layer-settings').querySelector('legend').textContent).toBe('Title');
  });

  test('fixing the warnings: Make it readable grows the words; Small on purpose stops the warning; one that cannot be fixed says so', async () => {
    renderPage();
    await opened();
    fireEvent.click(screen.getByTestId('canvas-snapshot'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'word '.repeat(16) } });
    await waitFor(() => expect(layerOf(lastDraft(), 'title').text).toBe('word '.repeat(16)), { timeout: 3000 });
    const before = layerOf(lastDraft(), 'title');
    const list = () => within(screen.getByTestId('yts-yt-warnings'));
    expect(list().getByRole('button', { name: /^Title is about/ })).toBeTruthy();
    fireEvent.click(list().getByRole('button', { name: 'Make it readable' }));
    await waitFor(() => expect(screen.queryByTestId('yts-yt-warnings')).toBeNull(), { timeout: 3000 });
    expect(screen.getByText('Readable at every size, and clear of the timestamp.')).toBeTruthy();
    await waitFor(() => expect(layerOf(lastDraft(), 'title').w).toBeGreaterThan(before.w), { timeout: 3000 });
    // One word far too long to wrap: it cannot be made readable; small on purpose instead.
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'x'.repeat(150) } });
    fireEvent.click(list().getByRole('button', { name: 'Make it readable' }));
    expect(screen.getByRole('status').textContent).toMatch(/^Title cannot be made readable beside a video/);
    fireEvent.click(list().getByRole('button', { name: 'Small on purpose' }));
    await waitFor(() => expect(layerOf(lastDraft(), 'title').smallOk).toBe(true), { timeout: 3000 });
    expect(screen.queryByTestId('yts-yt-warnings')).toBeNull();
  });

  test('the edition label is the episode\'s title; an arrangement kept from before can take it with one click', async () => {
    youtubeThumbnailsApi.sources.mockResolvedValue({
      ...SOURCES,
      suggest: { checklist: [{ text: 'Dress', checked: true }], edition: 'Sweater Dress Edition', pieces: [], logoUrl: null },
    });
    renderPage();
    await opened();
    fireEvent.click(screen.getByRole('button', { name: /Come Style Me/ }));
    expect(screen.getByLabelText('Edition label').value).toBe('Sweater Dress Edition');
    fireEvent.click(screen.getByRole('button', { name: 'Use the episode title' }));
    expect(screen.getByLabelText('Edition label').value).toBe('Studio by Sable');
    expect(screen.queryByRole('button', { name: 'Use the episode title' })).toBeNull();
  });

  test('See it exactly and Save say the file type and size; a JPEG says why', async () => {
    renderPage();
    await opened();
    youtubeThumbnailsApi.render.mockResolvedValueOnce(new Blob([new Uint8Array(1536 * 1024)], { type: 'image/jpeg' }));
    fireEvent.click(screen.getByTestId('yts-exact'));
    const fig = await screen.findByTestId('yts-exact-figure');
    expect(fig.textContent).toContain('Exactly as it will be saved (JPEG, 1.5 MB; over 2 MB as a PNG, so saved as a JPEG for YouTube).');
    expect(within(fig).getByRole('link', { name: /Download/ }).getAttribute('download')).toMatch(/\.jpg$/);
    youtubeThumbnailsApi.save.mockResolvedValue({ id: 7, url: 'https://b.s3.amazonaws.com/t.jpg', type: 'jpeg', bytes: 1536 * 1024 });
    fireEvent.click(screen.getByTestId('yts-save'));
    expect(await screen.findByText("Saved as the episode's thumbnail (JPEG, 1.5 MB; YouTube allows 2 MB).")).toBeTruthy();
  });

  test('picture effects: flip, brightness, contrast, a sticker edge and a shadow; a photo card keeps its own', async () => {
    renderPage();
    await opened();
    fireEvent.click(within(screen.getByTestId('yts-layers')).getByRole('button', { name: 'Lala' }));
    const fx = within(screen.getByTestId('yts-picture-effects'));
    fireEvent.click(fx.getByRole('button', { name: /Flip/ }));
    fireEvent.change(fx.getByRole('slider', { name: 'Brightness' }), { target: { value: '0.2' } });
    fireEvent.change(fx.getByRole('slider', { name: 'Contrast' }), { target: { value: '-0.1' } });
    fireEvent.click(fx.getByRole('checkbox', { name: 'Sticker edge' }));
    fireEvent.change(fx.getByRole('slider', { name: 'Edge width' }), { target: { value: '20' } });
    fireEvent.click(fx.getByRole('checkbox', { name: 'Drop shadow' }));
    await waitFor(() => expect(layerOf(lastDraft(), 'lala').shadow).toBe(true), { timeout: 3000 });
    expect(layerOf(lastDraft(), 'lala')).toMatchObject({ flipX: true, brightness: 0.2, contrast: -0.1, outline: '#FFFFFF', outlineWidth: 20 });
    fireEvent.change(screen.getByRole('combobox', { name: 'Frame' }), { target: { value: 'polaroid' } });
    expect(within(screen.getByTestId('yts-picture-effects')).getByText('A photo card has its own edge and shadow.')).toBeTruthy();
    expect(within(screen.getByTestId('yts-picture-effects')).queryByRole('checkbox', { name: 'Sticker edge' })).toBeNull();
  });

  test('a photo card\'s colour: white, the show\'s colours or any; clearing a photo\'s white background', async () => {
    renderPage();
    await opened();
    fireEvent.click(within(screen.getByTestId('yts-layers')).getByRole('button', { name: 'Lala' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Frame' }), { target: { value: 'polaroid' } });
    const fx = within(screen.getByTestId('yts-picture-effects'));
    expect(fx.getByRole('button', { name: 'Card #FFFFFF' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(fx.getByRole('button', { name: 'Card #E0689F' }));
    fireEvent.click(fx.getByRole('checkbox', { name: "Clear the photo's white background" }));
    await waitFor(() => expect(layerOf(lastDraft(), 'lala').clearWhite).toBe(true), { timeout: 3000 });
    expect(layerOf(lastDraft(), 'lala')).toMatchObject({ frame: 'polaroid', cardColor: '#E0689F' });
    fireEvent.change(fx.getByLabelText('Any card colour'), { target: { value: '#123abc' } });
    await waitFor(() => expect(layerOf(lastDraft(), 'lala').cardColor).toBe('#123ABC'), { timeout: 3000 });
    fireEvent.change(screen.getByRole('combobox', { name: 'Frame' }), { target: { value: 'none' } });
    expect(within(screen.getByTestId('yts-picture-effects')).queryByText('Card colour')).toBeNull();
    expect(within(screen.getByTestId('yts-picture-effects')).getByRole('checkbox', { name: "Clear the photo's white background" }).checked).toBe(true);
  });

  test('copy and paste: Copy keeps the picked layers on this browser; Paste (or Ctrl+V) adds them, here nudged; from another episode a missing role is kept', async () => {
    window.localStorage.removeItem('yts-clipboard');
    renderPage();
    await opened();
    expect(screen.queryByTestId('yts-paste')).toBeNull();
    fireEvent.click(screen.getByTestId('canvas-title'));
    fireEvent.click(within(screen.getByTestId('yts-arrange')).getByRole('button', { name: /Copy/ }));
    const kept = JSON.parse(window.localStorage.getItem('yts-clipboard'));
    expect(kept.from).toEqual({ episodeId: 'ep-1', title: 'Studio by Sable' });
    expect(kept.layers.map((l) => l.id)).toEqual(['title']);
    expect((await screen.findByRole('status')).textContent).toContain('Copied 1 layer. Open any episode and press Paste (Ctrl+V).');
    fireEvent.click(screen.getByTestId('yts-paste'));
    await waitFor(() => expect(lastDraft().layers.at(-1)).toMatchObject({ id: 'title-1', role: null, text: kept.layers[0].text, x: kept.layers[0].x + 24 }), { timeout: 3000 });
    // From another episode, by the keyboard: its badge, and a background this thumbnail lacks.
    window.localStorage.setItem('yts-clipboard', JSON.stringify({ from: { episodeId: 'ep-9', title: 'Gala Night' }, layers: [
      { id: 'logo', role: 'logo', kind: 'image', visible: true, src: 'https://b.s3.amazonaws.com/logo.png', fit: 'contain', x: 20, y: 20, w: 120, h: 60, rotation: 0, opacity: 1 },
    ] }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'yts-clipboard' }));
    await waitFor(() => expect(screen.getByTestId('yts-paste').textContent).toContain('Paste 1 layer'));
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true });
    await waitFor(() => expect(layerOf(lastDraft(), 'logo')).toMatchObject({ id: 'logo', x: 20, y: 20 }), { timeout: 3000 });
    expect((await screen.findByRole('status')).textContent).toContain('Pasted 1 layer from "Gala Night". Undo takes them away.');
  });

  test('versions to compare: keep the arrangement as one; compare Now with each at YouTube\'s sizes; use, rename, update, delete', async () => {
    const red = { id: 'v-1', name: 'Version A', previewUrl: 'https://b.s3.amazonaws.com/va.jpg', spec: presetLayers('lala-left', { title: 'Red dress' }, {}) };
    const gold = { id: 'v-2', name: 'Version B', previewUrl: 'https://b.s3.amazonaws.com/vb.jpg', spec: presetLayers('lala-left', { title: 'word '.repeat(30) }, {}) };
    youtubeThumbnailsApi.sources.mockResolvedValue({ ...SOURCES, versions: [red] });
    youtubeThumbnailsApi.createVersion.mockResolvedValue({ ...gold });
    youtubeThumbnailsApi.versions.mockResolvedValue([red, gold]);
    renderPage();
    await opened();
    const bar = () => within(screen.getByTestId('yts-versions'));
    expect(bar().getByText('Version A')).toBeTruthy();
    fireEvent.click(bar().getByTestId('yts-keep-version'));
    await waitFor(() => expect(youtubeThumbnailsApi.createVersion).toHaveBeenCalledWith('ep-1', { spec: expect.objectContaining({ version: 2 }) }));
    expect((await screen.findByRole('status')).textContent).toContain('Kept as "Version B".');
    await waitFor(() => expect(bar().getByTestId('yts-version-v-2')).toBeTruthy());
    // Compare: Now (the canvas's picture) and each version, at 360 and 168 wide, with how each reads.
    fireEvent.click(screen.getByTestId('canvas-snapshot'));
    fireEvent.click(bar().getByRole('button', { name: /Compare/ }));
    const cmp = within(screen.getByTestId('yts-compare'));
    expect(cmp.getAllByRole('img').map((i) => i.getAttribute('alt'))).toEqual([
      'Now, 360 pixels wide', 'Now, 168 pixels wide', 'Version A, 360 pixels wide', 'Version A, 168 pixels wide', 'Version B, 360 pixels wide', 'Version B, 168 pixels wide',
    ]);
    expect(within(screen.getByTestId('yts-compare-v-1')).getByText('Reads at every size')).toBeTruthy();
    expect(within(screen.getByTestId('yts-compare-v-2')).getByText(/^\d+ warnings?$/)).toBeTruthy();
    fireEvent.click(within(screen.getByTestId('yts-compare-v-1')).getByRole('button', { name: 'Use this one' }));
    await waitFor(() => expect(layerOf(lastDraft(), 'title').text).toBe('Red dress'), { timeout: 3000 });
    expect(screen.queryByTestId('yts-compare')).toBeNull();
    // Rename, update with this (asked first), delete (asked first).
    const card = () => within(screen.getByTestId('yts-version-v-2'));
    youtubeThumbnailsApi.updateVersion.mockResolvedValue({});
    fireEvent.click(card().getByRole('button', { name: /Rename/ }));
    fireEvent.change(card().getByRole('textbox', { name: 'New name for Version B' }), { target: { value: 'Gold dress' } });
    fireEvent.click(card().getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(youtubeThumbnailsApi.updateVersion).toHaveBeenCalledWith('ep-1', 'v-2', { name: 'Gold dress' }));
    fireEvent.click(card().getByRole('button', { name: 'Update with this' }));
    expect(card().getByText('Replace "Version B" with this arrangement?')).toBeTruthy();
    fireEvent.click(card().getByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(youtubeThumbnailsApi.updateVersion).toHaveBeenCalledWith('ep-1', 'v-2', { spec: expect.objectContaining({ version: 2 }) }));
    youtubeThumbnailsApi.deleteVersion.mockResolvedValue({});
    fireEvent.click(card().getByRole('button', { name: 'Delete Version B' }));
    fireEvent.click(card().getByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(youtubeThumbnailsApi.deleteVersion).toHaveBeenCalledWith('ep-1', 'v-2'));
  });

  test('versions: one that cannot be kept says why', async () => {
    youtubeThumbnailsApi.createVersion.mockRejectedValue({ response: { status: 409, data: { error: 'An episode keeps up to 12 versions; delete one first' } } });
    renderPage();
    await opened();
    expect(within(screen.getByTestId('yts-versions')).getByText(/Try a few looks/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('yts-keep-version'));
    expect((await screen.findByRole('alert')).textContent).toContain('An episode keeps up to 12 versions; delete one first');
  });

  test('Remove, by the picked layers: removes them (not locked ones); Undo brings them back', async () => {
    renderPage();
    await opened();
    fireEvent.click(screen.getByTestId('canvas-title'));
    const bar = () => within(screen.getByTestId('yts-arrange'));
    fireEvent.click(bar().getByRole('button', { name: /^Remove$/ }));
    expect(screen.queryByTestId('canvas-title')).toBeNull();
    expect(screen.queryByTestId('yts-arrange')).toBeNull(); // nothing picked now
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }));
    expect(screen.getByTestId('canvas-title')).toBeTruthy();
    // Two picked, one locked: only the other goes.
    fireEvent.click(screen.getByTestId('canvas-title'));
    fireEvent.click(within(screen.getByTestId('yts-layers')).getByRole('button', { name: 'Lock Title' }));
    fireEvent.click(within(screen.getByTestId('yts-layers')).getByRole('button', { name: 'Badge' }), { shiftKey: true });
    expect(bar().getByRole('button', { name: /^Remove$/ }).disabled).toBe(false);
    fireEvent.click(bar().getByRole('button', { name: /^Remove$/ }));
    expect(screen.queryByTestId('canvas-badge')).toBeNull();
    expect(screen.getByTestId('canvas-title')).toBeTruthy();
    // Only a locked one picked: Remove is off.
    expect(bar().getByRole('button', { name: /^Remove$/ }).disabled).toBe(true);
  });

  test('zoom: in and out by a quarter, 100% to 300%, Fit; +, - and 0 on the keyboard', async () => {
    renderPage();
    await opened();
    const zoom = within(screen.getByTestId('yts-zoom'));
    expect(zoom.getByText('100%')).toBeTruthy();
    expect(zoom.getByRole('button', { name: 'Zoom out' }).disabled).toBe(true);
    fireEvent.click(zoom.getByRole('button', { name: 'Zoom in' }));
    expect(zoom.getByText('125%')).toBeTruthy();
    fireEvent.keyDown(window, { key: '+' });
    fireEvent.keyDown(window, { key: '+' });
    expect(zoom.getByText('175%')).toBeTruthy();
    fireEvent.keyDown(window, { key: '-' });
    expect(zoom.getByText('150%')).toBeTruthy();
    for (let i = 0; i < 10; i += 1) fireEvent.click(zoom.getByRole('button', { name: 'Zoom in' }));
    expect(zoom.getByText('300%')).toBeTruthy();
    fireEvent.click(zoom.getByRole('button', { name: 'Fit' }));
    expect(zoom.getByText('100%')).toBeTruthy();
    fireEvent.keyDown(window, { key: '+' });
    fireEvent.keyDown(window, { key: '0' });
    expect(zoom.getByText('100%')).toBeTruthy();
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

  test('text effects: a glow in its colour and size, a shadow, a fade to a second colour, a curve and Straighten', async () => {
    renderPage();
    await opened();
    fireEvent.click(screen.getByTestId('canvas-title'));
    const fx = within(screen.getByTestId('yts-text-effects'));
    expect(fx.queryByRole('slider', { name: 'Effect size' })).toBeNull();
    fireEvent.change(fx.getByRole('combobox', { name: 'Words effect' }), { target: { value: 'glow' } });
    fireEvent.change(fx.getByLabelText('Glow colour'), { target: { value: '#ff0000' } });
    fireEvent.change(fx.getByRole('slider', { name: 'Effect size' }), { target: { value: '24' } });
    fireEvent.click(fx.getByRole('checkbox', { name: 'Fade to a second colour' }));
    fireEvent.change(fx.getByLabelText('Fade to colour'), { target: { value: '#00aaff' } });
    fireEvent.change(fx.getByRole('slider', { name: 'Curve' }), { target: { value: '-45' } });
    expect(fx.getByText('Curve (bend down 45°)')).toBeTruthy();
    expect(fx.getByText('Curved words sit on one line.')).toBeTruthy();
    await waitFor(() => expect(layerOf(lastDraft(), 'title').curve).toBe(-45), { timeout: 3000 });
    expect(layerOf(lastDraft(), 'title')).toMatchObject({ effect: 'glow', effectColor: '#FF0000', effectSize: 24, gradient: '#00AAFF' });
    fireEvent.change(fx.getByRole('combobox', { name: 'Words effect' }), { target: { value: 'shadow' } });
    expect(fx.queryByLabelText('Glow colour')).toBeNull();
    expect(fx.getByText('Shadow size (24)')).toBeTruthy();
    fireEvent.click(fx.getByRole('button', { name: 'Straighten' }));
    fireEvent.click(fx.getByRole('checkbox', { name: 'Fade to a second colour' }));
    await waitFor(() => expect(layerOf(lastDraft(), 'title')).toMatchObject({ effect: 'shadow', curve: 0, gradient: null }), { timeout: 3000 });
  });

  test('stickers: add each one, picked; a burst\'s words, colours, outline; a circle\'s thickness', async () => {
    renderPage();
    await opened();
    const row = within(screen.getByTestId('yts-stickers'));
    fireEvent.click(row.getByRole('button', { name: 'Add burst' }));
    const settings = within(screen.getByTestId('yts-shape-settings'));
    fireEvent.change(settings.getByRole('textbox', { name: 'Sticker words' }), { target: { value: 'SALE' } });
    fireEvent.change(settings.getByLabelText('Sticker colour'), { target: { value: '#00aa00' } });
    fireEvent.change(settings.getByLabelText('Sticker words colour'), { target: { value: '#111111' } });
    fireEvent.change(settings.getByRole('slider', { name: 'Sticker outline width' }), { target: { value: '10' } });
    await waitFor(() => expect(lastDraft().layers.at(-1).strokeWidth).toBe(10), { timeout: 3000 });
    expect(lastDraft().layers.at(-1)).toMatchObject({ kind: 'shape', shape: 'burst', text: 'SALE', fill: '#00AA00', color: '#111111', stroke: '#FFFFFF' });
    expect(screen.getByTestId('yts-layer-settings').querySelector('legend').textContent).toBe('Burst: SALE');
    fireEvent.click(settings.getByRole('checkbox', { name: 'Sticker outline' }));
    await waitFor(() => expect(lastDraft().layers.at(-1).stroke).toBeNull(), { timeout: 3000 });
    fireEvent.click(row.getByRole('button', { name: 'Add circle' }));
    const ring = within(screen.getByTestId('yts-shape-settings'));
    expect(ring.queryByRole('textbox', { name: 'Sticker words' })).toBeNull();
    fireEvent.change(ring.getByRole('slider', { name: 'Circle thickness' }), { target: { value: '30' } });
    for (const name of ['Add arrow', 'Add sparkles', 'Add price tag']) fireEvent.click(row.getByRole('button', { name }));
    await waitFor(() => expect(lastDraft().layers.slice(-4).map((l) => [l.shape, l.thickness ?? null]))
      .toEqual([['ring', 30], ['arrow', null], ['sparkle', null], ['tag', null]]), { timeout: 3000 });
  });

  test('the redesign\'s new pieces: tape, paper (with its words) and shadow stickers; Playfair and Montserrat; blur on a picture and on the background', async () => {
    renderPage();
    await opened();
    const row = within(screen.getByTestId('yts-stickers'));
    fireEvent.click(row.getByRole('button', { name: 'Add paper' }));
    const settings = within(screen.getByTestId('yts-shape-settings'));
    const words = settings.getByRole('textbox', { name: 'Sticker words' });
    expect(words.getAttribute('maxlength')).toBe('60');
    fireEvent.change(words, { target: { value: 'Wear it twice, style it three ways' } });
    for (const name of ['Add tape', 'Add shadow']) fireEvent.click(row.getByRole('button', { name }));
    await waitFor(() => expect(lastDraft().layers.slice(-3).map((l) => l.shape)).toEqual(['paper', 'tape', 'shadow']), { timeout: 3000 });
    expect(lastDraft().layers.at(-3).text).toBe('Wear it twice, style it three ways');
    // The fonts are offered for words.
    fireEvent.click(screen.getByTestId('canvas-title'));
    const font = within(screen.getByTestId('yts-layer-settings')).getByRole('combobox', { name: 'Font' });
    expect(within(font).getAllByRole('option').map((o) => o.textContent)).toEqual(expect.arrayContaining(['Playfair', 'Montserrat']));
    fireEvent.change(font, { target: { value: 'playfair' } });
    // Blur: on the picked picture, and on the background from its card.
    fireEvent.click(screen.getByTestId('canvas-lala'));
    fireEvent.change(within(screen.getByTestId('yts-picture-effects')).getByRole('slider', { name: 'Blur' }), { target: { value: '6' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Blur the background' }), { target: { value: '12' } });
    await waitFor(() => expect(layerOf(lastDraft(), 'background').blur).toBe(12), { timeout: 3000 });
    expect(layerOf(lastDraft(), 'lala').blur).toBe(6);
    expect(layerOf(lastDraft(), 'title').font).toBe('playfair');
  });

  test('the redesign\'s layouts: Checklist focus and Before/After', async () => {
    renderPage();
    await opened();
    fireEvent.click(screen.getByRole('button', { name: /Checklist focus/ }));
    await waitFor(() => expect(lastDraft().layers.map((l) => l.id)).toContain('note'), { timeout: 3000 });
    expect(layerOf(lastDraft(), 'checklist')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Before\/After/ }));
    fireEvent.click(within(screen.getByTestId('yts-ask')).getByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(lastDraft().layers.map((l) => l.id)).toEqual(expect.arrayContaining(['change', 'after-label'])), { timeout: 3000 });
    expect(screen.getByRole('button', { name: /Before\/After/ }).getAttribute('aria-pressed')).toBe('true');
  });

  test('AI help: title ideas from the episode; use one as the title, add its hook as a burst; a refusal says why', async () => {
    youtubeThumbnailsApi.titleIdeas.mockResolvedValue([
      { title: 'The $40 Gala Gown', hook: '$40 FIND' },
      { title: 'Gala Ready in Ten', hook: '' },
    ]);
    renderPage();
    await opened();
    const card = () => within(screen.getByTestId('yts-ai'));
    fireEvent.click(card().getByTestId('yts-ideas-btn'));
    await waitFor(() => expect(card().getByText('The $40 Gala Gown')).toBeTruthy());
    expect(youtubeThumbnailsApi.titleIdeas).toHaveBeenCalledWith('ep-1');
    expect(card().queryByRole('button', { name: 'Add "" as a burst' })).toBeNull();
    fireEvent.click(card().getByRole('button', { name: 'Use "The $40 Gala Gown" as the title' }));
    fireEvent.click(card().getByRole('button', { name: 'Add "$40 FIND" as a burst' }));
    await waitFor(() => expect(lastDraft().layers.at(-1)).toMatchObject({ kind: 'shape', shape: 'burst', text: '$40 FIND' }), { timeout: 3000 });
    expect(layerOf(lastDraft(), 'title').text).toBe('The $40 Gala Gown');
    expect(card().getByTestId('yts-ideas-btn').textContent).toContain('More title ideas');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    youtubeThumbnailsApi.titleIdeas.mockRejectedValueOnce({ response: { data: { error: 'Today\'s AI budget is used up' } } });
    fireEvent.click(card().getByTestId('yts-ideas-btn'));
    expect((await screen.findByRole('alert')).textContent).toContain('Today\'s AI budget is used up');
  });

  test('AI help: Remove the background on a picked picture swaps in the cut-out (kept in Uploads); Undo puts the photo back', async () => {
    youtubeThumbnailsApi.cutOut.mockResolvedValue({ url: 'https://b.s3.amazonaws.com/up/lala-cut.png', label: 'Lala cut out' });
    renderPage();
    await opened();
    fireEvent.click(screen.getByTestId('canvas-lala'));
    fireEvent.click(screen.getByTestId('yts-cut-out'));
    await waitFor(() => expect(layerOf(lastDraft(), 'lala').src).toBe('https://b.s3.amazonaws.com/up/lala-cut.png'), { timeout: 3000 });
    const [episodeId, url, name] = youtubeThumbnailsApi.cutOut.mock.calls[0];
    expect([episodeId, name]).toEqual(['ep-1', 'Lala']);
    expect(url).toMatch(/^https:\/\/b\.s3\.amazonaws\.com\//);
    expect((await screen.findByRole('status')).textContent).toContain('Background removed');
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }));
    // The photo it was cut from comes back.
    await waitFor(() => expect(layerOf(lastDraft(), 'lala').src).toBe(url), { timeout: 3000 });
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
    // More than one Lala (Evoni, 2026-10-22): Side is added beside Front, both picked; clicked again, Side comes off.
    fireEvent.click(within(within(lala).getByTestId('yts-lala-crumbs')).getByRole('button', { name: 'Lala' }));
    fireEvent.click(within(lala).getByRole('button', { name: 'Side, 1 picture' }));
    fireEvent.click(within(lala).getByTitle(lalaSide.label));
    expect(within(lala).getByTitle(lalaSide.label).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('canvas-lala')).toBeTruthy();
    expect(screen.getByTestId('canvas-picture-1')).toBeTruthy();
    expect(within(screen.getByTestId('yts-layers')).getByRole('button', { name: 'Lala 2' })).toBeTruthy();
    fireEvent.click(within(lala).getByTitle(lalaSide.label));
    expect(screen.queryByTestId('canvas-picture-1')).toBeNull();
    expect(screen.getByTestId('canvas-lala')).toBeTruthy();
    expect(screen.queryByTestId('yts-poses-note')).toBeNull();
    expect(screen.queryByTestId('canvas-jaw')).toBeNull();
    const jaw = screen.getByTestId('yts-jaw');
    fireEvent.click(within(jaw).getByTestId('yts-jaw-folder-poses/justawoman/glamour'));
    fireEvent.click(within(jaw).getByTitle('Glamour ★'));
    expect(screen.getByTestId('canvas-jaw')).toBeTruthy();
    // JustAWoman works like Lala now (Evoni, 2026-10-22): picked shows pressed; clicked again it comes off.
    expect(within(jaw).getByTitle('Glamour ★').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(jaw).getByTitle('Glamour ★'));
    expect(screen.queryByTestId('canvas-jaw')).toBeNull();
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

  test('the canvas toolbar: Save as thumbnail and See it exactly on it; the ⋮ menu opens, closes with Esc or a click away, and starts again', async () => {
    renderPage();
    await opened();
    expect(screen.getByTestId('yts-save').textContent).toContain('Save as thumbnail');
    const more = screen.getByTestId('yts-more-btn');
    fireEvent.click(more);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(within(screen.getByRole('menu')).getAllByRole('menuitem').map((b) => b.textContent.trim())).toEqual(['Whole season', 'Start again', 'Keyboard shortcuts']);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(more);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(more);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Start again' }));
    expect(within(screen.getByTestId('yts-ask')).getByText(/Start this episode again/)).toBeTruthy();
  });

  test('once an episode is open the header is one line, with the episode before and after it', async () => {
    youtubeThumbnailsApi.episodes.mockResolvedValue([
      { id: 'ep-0', episode_number: 0, title: 'Pilot' }, { id: 'ep-1', episode_number: 1, title: 'Studio by Sable' }, { id: 'ep-2', episode_number: 2, title: 'Gala' },
    ]);
    renderPage();
    await opened();
    const banner = document.querySelector('.yts-banner');
    expect(banner.classList.contains('is-compact')).toBe(true);
    expect(screen.queryByText(/Drag, resize and turn anything/)).toBeNull();
    const prev = await screen.findByTestId('yts-prev-episode');
    await waitFor(() => expect(prev.disabled).toBe(false));
    expect(prev.getAttribute('title')).toBe('Previous: Pilot');
    expect(screen.getByTestId('yts-next-episode').getAttribute('title')).toBe('Next: Gala');
    fireEvent.click(screen.getByTestId('yts-next-episode'));
    await waitFor(() => expect(youtubeThumbnailsApi.sources).toHaveBeenCalledWith('ep-2'));
    expect(screen.getByLabelText('Episode').value).toBe('ep-2');
    await waitFor(() => expect(screen.getByTestId('yts-next-episode').disabled).toBe(true));
  });

  test('with no episode open the header is the full one, without arrows', async () => {
    renderPage('/template-studio/youtube?show=show-1');
    expect(await screen.findByText(/Drag, resize and turn anything/)).toBeTruthy();
    expect(screen.queryByTestId('yts-prev-episode')).toBeNull();
    expect(document.querySelector('.yts-banner').classList.contains('is-compact')).toBe(false);
  });

  // Evoni, 2026-10-22 layout list: messages float at the foot of the screen.
  test('a message floats at the foot of the screen; a success fades by itself, any message closes with ×', async () => {
    renderPage();
    await opened();
    // Copying layers changes nothing on the thumbnail; it only says so.
    const copy = () => { fireEvent.click(screen.getByTestId('canvas-title')); fireEvent.keyDown(window, { key: 'c', ctrlKey: true }); };
    try {
      copy();
      const toast = await screen.findByTestId('yts-toast');
      expect(toast.classList.contains('yts-toast')).toBe(true);
      expect(toast.getAttribute('role')).toBe('status');
      expect(toast.textContent).toContain('Copied 1 layer');
      fireEvent.click(screen.getByTestId('yts-toast-close'));
      expect(screen.queryByTestId('yts-toast')).toBeNull();
      // Again, and this time it fades by itself.
      vi.useFakeTimers();
      copy();
      expect(screen.getByTestId('yts-toast')).toBeTruthy();
      act(() => { vi.advanceTimersByTime(5100); });
      expect(screen.queryByTestId('yts-toast')).toBeNull();
    } finally {
      vi.useRealTimers();
      window.localStorage.removeItem('yts-clipboard');
    }
  });

  test('a long Layers list shows the top six until Show all; versions and saved thumbnails are strips under the canvas', async () => {
    youtubeThumbnailsApi.saved.mockResolvedValue([{ id: 's1', url: 'https://b.s3.amazonaws.com/s1.png', isPrimary: true }]);
    renderPage();
    await opened();
    expect(screen.queryByTestId('yts-layers-all')).toBeNull(); // six layers: all shown
    for (let i = 0; i < 4; i += 1) fireEvent.click(screen.getByTestId('yts-add-text'));
    const more = screen.getByTestId('yts-layers-all');
    expect(more.textContent).toBe('Show all 10 layers');
    expect(within(screen.getByTestId('yts-layers')).getAllByRole('listitem')).toHaveLength(6);
    expect(screen.queryByTestId('yts-layer-background')).toBeNull();
    fireEvent.click(more);
    expect(screen.getByTestId('yts-layer-background')).toBeTruthy();
    expect(more.textContent).toBe('Show fewer');
    // The strip: right under the canvas, before the Layers card.
    const strip = await screen.findByTestId('yts-strip');
    expect(within(strip).getByTestId('yts-versions')).toBeTruthy();
    expect(await within(strip).findByTestId('yts-saved-s1')).toBeTruthy();
    const order = (el) => [...document.querySelectorAll('section, [data-testid="yts-strip"]')].indexOf(el);
    expect(order(strip)).toBeGreaterThan(order(screen.getByRole('region', { name: 'Editor' })));
    expect(order(strip)).toBeLessThan(order(screen.getByRole('region', { name: 'Layers' })));
  });

  // Evoni, 2026-10-22: whether the arrangement is kept yet, by the canvas.
  test('by the canvas: Saving… while a change waits, then Saved with the time; Not saved when it fails', async () => {
    let finish;
    youtubeThumbnailsApi.saveDraft.mockImplementation(() => new Promise((r) => { finish = r; }));
    renderPage();
    await opened();
    expect(screen.queryByTestId('yts-keep')).toBeNull();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'The Atelier' } });
    expect(screen.getByTestId('yts-keep').textContent).toBe('Saving…');
    await waitFor(() => expect(youtubeThumbnailsApi.saveDraft).toHaveBeenCalled(), { timeout: 3000 });
    await act(async () => { finish({}); });
    await waitFor(() => expect(screen.getByTestId('yts-keep').textContent.trim()).toMatch(/^Saved \d/));
    expect(screen.getByTestId('yts-keep').className).toContain('is-saved');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    youtubeThumbnailsApi.saveDraft.mockRejectedValueOnce(new Error('offline'));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'The Atelier 2' } });
    await waitFor(() => expect(screen.getByTestId('yts-keep').textContent).toBe('Not saved'), { timeout: 3000 });
  });

  test('a saved thumbnail with its layers becomes the show\'s template in one click', async () => {
    const layers = { version: 2, layers: [{ id: 'title', role: 'title', kind: 'text', text: 'Old one', x: 0, y: 0, w: 100, h: 50 }] };
    youtubeThumbnailsApi.saved.mockResolvedValue([
      { id: 's1', url: 'https://b.s3.amazonaws.com/s1.png', isPrimary: true, savedAt: '2026-10-22T10:00:00Z', spec: layers },
      { id: 's0', url: 'https://b.s3.amazonaws.com/s0.png', isPrimary: false, savedAt: '2026-10-20T10:00:00Z', spec: null },
    ]);
    youtubeThumbnailsApi.createTemplate.mockResolvedValue({});
    youtubeThumbnailsApi.templates.mockResolvedValue([]);
    youtubeThumbnailsApi.saveStyle.mockResolvedValue({});
    renderPage();
    await opened();
    expect(screen.queryByTestId('yts-saved-template-s0')).toBeNull(); // saved before layers were kept
    fireEvent.click(await screen.findByTestId('yts-saved-template-s1'));
    await waitFor(() => expect(youtubeThumbnailsApi.createTemplate).toHaveBeenCalled());
    const [showId, body] = youtubeThumbnailsApi.createTemplate.mock.calls[0];
    expect(showId).toBe('show-1');
    expect(body).toMatchObject({ spec: layers, makeDefault: false, name: expect.stringMatching(/^Saved /) });
    expect((await screen.findByTestId('yts-toast')).textContent).toContain('made from that saved thumbnail');
  });

  test('a pinch on the canvas with nothing picked zooms it, to the nearest quarter and no further than the most', async () => {
    renderPage();
    await opened();
    fireEvent.click(screen.getByTestId('canvas-pinch'));
    expect(within(screen.getByTestId('yts-zoom')).getByText('200%')).toBeTruthy();
    fireEvent.click(screen.getByTestId('canvas-pinch-far'));
    expect(within(screen.getByTestId('yts-zoom')).getByRole('button', { name: 'Zoom in' }).disabled).toBe(true);
  });

  test('the grid and the safe zones: toggled on the toolbar, drawn over the canvas only', async () => {
    renderPage();
    await opened();
    const canvas = screen.getByTestId('yts-canvas');
    expect(canvas.dataset.grid).toBe('false');
    fireEvent.click(screen.getByTestId('yts-grid-btn'));
    expect(screen.getByTestId('yts-canvas').dataset.grid).toBe('true');
    expect(screen.getByTestId('yts-grid-btn').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByTestId('yts-safe-btn'));
    expect(screen.getByTestId('yts-canvas').dataset.safe).toBe('true');
    fireEvent.click(screen.getByTestId('yts-grid-btn'));
    expect(screen.getByTestId('yts-canvas').dataset.grid).toBe('false');
    // Not part of the thumbnail: no layer, nothing in the draft.
    expect(youtubeThumbnailsApi.saveDraft).not.toHaveBeenCalled();
  });

  test('layers: each row has a small picture of its layer; dragging a row onto another puts it there', async () => {
    renderPage();
    await opened();
    const row = (id) => screen.getByTestId(`yts-layer-${id}`);
    expect(row('background').querySelector('.yts-layer-thumb img')).toBeTruthy();
    expect(row('badge').querySelector('.yts-layer-thumb').textContent).toBe('EP 1');
    const before = within(screen.getByTestId('yts-layers')).getAllByRole('listitem').map((li) => li.dataset.testid);
    // The badge (at the front) dragged onto the background (at the back) takes its place: the very back.
    fireEvent.dragStart(row('badge'));
    fireEvent.dragOver(row('background'));
    expect(row('background').className).toContain('is-over');
    fireEvent.drop(row('background'));
    await waitFor(() => expect(youtubeThumbnailsApi.saveDraft).toHaveBeenCalled(), { timeout: 3000 });
    expect(lastDraft().layers[0].id).toBe('badge');
    const after = within(screen.getByTestId('yts-layers')).getAllByRole('listitem').map((li) => li.dataset.testid);
    expect(after.at(-1)).toBe('yts-layer-badge');
    expect(after).toHaveLength(before.length);
    // Undo puts it back.
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }));
    expect(within(screen.getByTestId('yts-layers')).getAllByRole('listitem').map((li) => li.dataset.testid)).toEqual(before);
  });

  test('assets: a tab for each folder this episode has, opening on the outfit; picking adds the picture', async () => {
    renderPage();
    await opened();
    const tabs = within(screen.getByRole('tablist', { name: 'Pictures' }));
    expect(tabs.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Outfit', 'Library', 'Scene sets']);
    expect(tabs.getByRole('tab', { name: 'Outfit' }).getAttribute('aria-selected')).toBe('true');
    const add = () => within(screen.getByTestId('yts-add-picture'));
    expect(add().getByTestId('yts-add-picture-folder-outfit/dress')).toBeTruthy();
    fireEvent.click(tabs.getByRole('tab', { name: 'Library' }));
    fireEvent.click(add().getByTestId('yts-add-picture-folder-library/lala'));
    fireEvent.click(add().getByTitle('Lala 2'));
    await waitFor(() => expect(youtubeThumbnailsApi.saveDraft).toHaveBeenCalled(), { timeout: 3000 });
    expect(lastDraft().layers.at(-1)).toMatchObject({ kind: 'image', src: 'https://b.s3.amazonaws.com/lala2.png' });
  });

  test('whole season: the grid in place of the editor; Open in the editor goes back to that episode', async () => {
    youtubeThumbnailsApi.season.mockResolvedValue([{ id: 'ep-1', episode_number: 1, title: 'Studio by Sable', thumbnailUrl: null, hasDraft: false }]);
    youtubeThumbnailsApi.templates.mockResolvedValue([]);
    renderPage();
    await opened();
    fireEvent.click(screen.getByTestId('yts-more-btn'));
    fireEvent.click(screen.getByTestId('yts-season-open'));
    const grid = within(await screen.findByTestId('yts-season'));
    expect(screen.queryByTestId('yts-canvas')).toBeNull();
    expect(youtubeThumbnailsApi.season).toHaveBeenCalledWith('show-1');
    // No template with layers yet: the show's layout.
    expect(grid.getByRole('combobox', { name: 'Template for the season' }).value).toBe('layout');
    fireEvent.click((await grid.findByTestId('yts-season-ep-1')).querySelector('button'));
    expect(await opened()).toBeTruthy();
    expect(screen.queryByTestId('yts-season')).toBeNull();
  });
});

// On a phone (Evoni, 2026-10-22 layout list): the toolbar on one row, the
// picked layer's settings in a sheet from the bottom, and a small picture of
// the thumbnail pinned at the top once the canvas has scrolled away.
describe('YouTubeThumbnailStudio on a phone', () => {
  let seen = null;
  const realMatchMedia = window.matchMedia;
  const realIO = window.IntersectionObserver;
  beforeEach(() => {
    window.matchMedia = vi.fn((q) => ({ matches: q.includes('760'), media: q, addEventListener: () => {}, removeEventListener: () => {} }));
    window.IntersectionObserver = class {
      constructor(cb) { seen = cb; }
      observe() {}
      disconnect() {}
    };
    Object.values(youtubeThumbnailsApi).forEach((fn) => fn.mockReset());
    youtubeThumbnailsApi.shows.mockResolvedValue([{ id: 'show-1', name: 'Styling Adventures' }]);
    youtubeThumbnailsApi.episodes.mockResolvedValue([{ id: 'ep-1', episode_number: 1, title: 'Studio by Sable' }]);
    youtubeThumbnailsApi.sources.mockResolvedValue(SOURCES);
    youtubeThumbnailsApi.saved.mockResolvedValue([]);
    youtubeThumbnailsApi.saveDraft.mockResolvedValue({});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    window.matchMedia = realMatchMedia;
    window.IntersectionObserver = realIO;
    seen = null;
  });

  test('the toolbar on one row: grid, safe zones and See it exactly in the ⋮ menu; Save says Save', async () => {
    renderPage();
    await opened();
    expect(screen.queryByTestId('yts-grid-btn')).toBeNull();
    expect(screen.queryByTestId('yts-exact')).toBeNull();
    expect(screen.getByTestId('yts-save').textContent.trim()).toBe('Save');
    expect(screen.getByTestId('yts-save').getAttribute('aria-label')).toBe('Save as thumbnail');
    fireEvent.click(screen.getByTestId('yts-more-btn'));
    expect(screen.queryByTestId('yts-keys-btn')).toBeNull();
    const grid = screen.getByTestId('yts-menu-grid');
    expect(grid.getAttribute('role')).toBe('menuitemcheckbox');
    expect(grid.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(grid);
    expect(screen.getByTestId('yts-canvas').dataset.grid).toBe('true');
    fireEvent.click(screen.getByTestId('yts-more-btn'));
    expect(screen.getByTestId('yts-menu-grid').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByTestId('yts-menu-safe'));
    expect(screen.getByTestId('yts-canvas').dataset.safe).toBe('true');
    fireEvent.click(screen.getByTestId('yts-more-btn'));
    expect(screen.getByTestId('yts-menu-exact').textContent).toContain('See it exactly');
  });

  test('a picked layer\'s settings come up in a sheet from the bottom, not the side; Done puts it away', async () => {
    renderPage();
    await opened();
    expect(screen.queryByTestId('yts-sheet')).toBeNull();
    fireEvent.click(screen.getByTestId('canvas-title'));
    const sheet = screen.getByTestId('yts-sheet');
    expect(within(sheet).getByTestId('yts-layer-settings').querySelector('legend').textContent).toBe('Title');
    expect(within(screen.getByRole('complementary', { name: 'Thumbnail settings' })).queryByTestId('yts-layer-settings')).toBeNull();
    expect(document.querySelector('.yts').classList.contains('has-sheet')).toBe(true);
    fireEvent.click(screen.getByTestId('yts-sheet-done'));
    expect(screen.queryByTestId('yts-sheet')).toBeNull();
    expect(document.querySelector('.yts').classList.contains('has-sheet')).toBe(false);
  });

  test('the settings one section at a time, in tabs under the canvas; Layers first', async () => {
    renderPage();
    await opened();
    const tabs = within(screen.getByTestId('yts-phone-tabs'));
    expect(tabs.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Layers', 'Layout', 'Text', 'Assets', 'Characters', 'Background', 'Colours', 'Saved']);
    expect(tabs.getByRole('tab', { name: 'Layers' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('yts-layers')).toBeTruthy();
    expect(screen.queryByLabelText('Title')).toBeNull();
    expect(screen.queryByTestId('yts-lala')).toBeNull();
    fireEvent.click(tabs.getByRole('tab', { name: 'Text' }));
    expect(screen.getByLabelText('Title')).toBeTruthy();
    expect(screen.getByTestId('yts-ai')).toBeTruthy();
    expect(screen.queryByTestId('yts-layers')).toBeNull();
    fireEvent.click(tabs.getByRole('tab', { name: 'Characters' }));
    expect(screen.getByTestId('yts-lala')).toBeTruthy();
    expect(screen.queryByLabelText('Title')).toBeNull();
    fireEvent.click(tabs.getByRole('tab', { name: 'Colours' }));
    expect(screen.getByRole('button', { name: 'Accent #B8962E' })).toBeTruthy();
    expect(screen.queryByTestId('yts-strip')).toBeNull();
    fireEvent.click(tabs.getByRole('tab', { name: 'Saved' }));
    expect(within(screen.getByTestId('yts-strip')).getByTestId('yts-versions')).toBeTruthy();
  });

  test('once the canvas has scrolled away, a small picture of the thumbnail is pinned; a tap goes back to the canvas', async () => {
    renderPage();
    await opened();
    fireEvent.click(screen.getByTestId('canvas-snapshot'));
    expect(screen.queryByTestId('yts-mini')).toBeNull();
    const stage = screen.getByRole('region', { name: 'Editor' });
    stage.scrollIntoView = vi.fn();
    // Below the screen is not "scrolled away".
    act(() => seen([{ intersectionRatio: 0, boundingClientRect: { top: 900 } }]));
    expect(screen.queryByTestId('yts-mini')).toBeNull();
    act(() => seen([{ intersectionRatio: 0, boundingClientRect: { top: -400 } }]));
    const mini = screen.getByTestId('yts-mini');
    expect(mini.querySelector('img').getAttribute('src')).toBe('data:image/jpeg;base64,c25hcA==');
    fireEvent.click(mini);
    expect(stage.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    act(() => seen([{ intersectionRatio: 1, boundingClientRect: { top: 80 } }]));
    expect(screen.queryByTestId('yts-mini')).toBeNull();
  });
});
