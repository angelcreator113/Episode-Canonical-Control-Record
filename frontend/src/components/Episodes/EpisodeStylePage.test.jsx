/**
 * Production → Style Page (was Lookbook; Task #2876; spec Part 2, "Style
 * Page"): the sheet is the editor. Every spot can be tapped on the sheet and
 * filled from the panel by choosing from Files (photos are uploaded in
 * Files › Style photos, never here; Evoni, 2026-10-22); the tagline and
 * the hair and nails names edit in place; the venue Swap shows the event
 * scene set's next image; readiness is the shared 12-chip rule; Approve and
 * Reopen. Every write goes through the existing Lookbook and style sheet
 * routes. The values are Episode 1's reference values (spec Part 2).
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../lib/stylePalette', () => ({ extractPalette: vi.fn(async () => []) }));

import api from '../../services/api';
import EpisodeStylePage, { SPOT_INFO, EXPORT_SIZES } from './EpisodeStylePage';
import { EPISODE_ONE } from './StyleSheetTemplate.fixture';
import { READINESS_CHIPS } from '../../lib/styleReadiness';

// The server's readiness (Task #2877): here Front and Venue are ready.
const readiness = (readyKeys = ['front', 'venue']) => {
  const items = READINESS_CHIPS.map((c) => ({ ...c, ready: readyKeys.includes(c.key) }));
  return { items, done: readyKeys.length, total: 12, missing: items.filter((i) => !i.ready).map((i) => i.label) };
};

const EP = 'ep-1';
const LB_URL = `/api/v1/episodes/${EP}/lookbook`;
const SHEET_URL = `/api/v1/episodes/${EP}/style-sheet`;
const CATS = ['unsorted', 'front', 'side', 'back', 'hero', 'hair', 'nails', 'eyes', 'lips', 'skin', 'venue', 'inspo'];
const photo = (id, category, extra = {}) => ({ id, category, source: 'upload', image_url: `data:image/png;base64,${id}`, in_lookbook: true, file_name: `${id}.png`, ...extra });

function lookbook(over = {}) {
  const images = Object.fromEntries(CATS.map((c) => [c, []]));
  images.front = [photo('f1', 'front')];
  images.unsorted = [photo('u1', 'unsorted')];
  return {
    id: 'lb-1', episode_id: EP, hair_name: '', nails_name: '', tagline: '', beauty_notes: {},
    sheet_status: 'draft', images_in: 2, images,
    event: { id: 'ev-1', name: 'Wearable Experiments Studio Session' },
    scene_set: { id: 'set-1', name: "STUDIO BY SABLE's Studio" },
    venue_options: [
      { source: 'scene_set_base', ref_id: 'set-1', label: 'Set base', image_url: 'https://cdn.example/base.jpg', in_lookbook: false, image_id: null },
      { source: 'scene_angle', ref_id: 'ang-1', label: 'Wide', image_url: 'https://cdn.example/wide.jpg', in_lookbook: false, image_id: null },
    ],
    texture_pieces: [],
    ...over,
  };
}
const sheet = (over = {}) => ({
  ...EPISODE_ONE,
  look: { ...EPISODE_ONE.look, front: 'data:image/png;base64,f1' },
  venue: { ...EPISODE_ONE.venue, image: 'https://cdn.example/base.jpg', chosen_image_id: null },
  palette_sources: [],
  status: 'draft',
  stale: false,
  readiness: readiness(),
  ...over,
});

const POSES_URL = `/api/v1/episode-poses/${EP}`;
const pose = (id, character_key, p, extra = {}) => ({ id, character_key, pose: p, status: 'ready', is_default: false, final_url: `https://bucket.s3.amazonaws.com/${id}.png`, ...extra });

function mockRoutes({ lb = lookbook(), sh = sheet(), poses = [] } = {}) {
  api.get.mockImplementation(async (url) => {
    if (url === LB_URL) return { data: { data: lb } };
    if (url === SHEET_URL) return { data: { data: sh } };
    if (url === POSES_URL) return { data: { data: poses } };
    return { data: {} };
  });
}
const renderPage = async (opts) => {
  mockRoutes(opts);
  const onOpenTab = vi.fn();
  render(<EpisodeStylePage episode={{ id: EP }} onOpenTab={onOpenTab} />);
  await screen.findByTestId('episode-style-page');
  return { onOpenTab };
};
const sheetEl = () => within(screen.getByTestId('style-sheet'));
// A Hero photo in the Lookbook and on the sheet.
const withHero = () => ({
  lb: lookbook({ images: { ...lookbook().images, hero: [photo('h1', 'hero')] } }),
  sh: sheet({ look: { ...EPISODE_ONE.look, front: 'data:image/png;base64,f1', hero: 'data:image/png;base64,h1' } }),
});
const panel = () => within(screen.getByTestId('esp2-spot-panel'));

beforeEach(() => { vi.clearAllMocks(); });

describe('Style Page', () => {
  test('header: Style Page, Draft, Photos in Files, Approve; the sheet at its real layout', async () => {
    const { onOpenTab } = await renderPage();
    expect(screen.getByRole('heading', { level: 2, name: 'Style Page' })).toBeTruthy();
    expect(screen.getByTestId('esp2-status').textContent).toBe('Draft');
    expect(screen.queryByRole('button', { name: /Drop photos to sort/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Photos in Files/ }));
    expect(onOpenTab).toHaveBeenCalledWith('files');
    expect(screen.getByRole('button', { name: /Approve/ })).toBeTruthy();
    // Real values from the episode's own data, not invented.
    expect(sheetEl().getAllByText('Wearable Experiments Studio Session').length).toBeGreaterThan(0);
    expect(api.get).toHaveBeenCalledWith(LB_URL);
    expect(api.get).toHaveBeenCalledWith(SHEET_URL);
  });

  test('every empty spot is a "+ Add" button on the sheet, Body reads Needed', async () => {
    await renderPage();
    for (const name of ['Add Side', 'Add Back', 'Add Hero', 'Add Eyes', 'Add Lips', 'Add Skin', 'Add Hair', 'Add Nails', 'Add Inspo']) {
      expect(sheetEl().getAllByRole('button', { name }).length).toBeGreaterThan(0);
    }
    expect(sheetEl().getByRole('button', { name: 'Add Body (needed)' })).toBeTruthy();
    // A filled spot is an Edit button, not "+ Add".
    expect(sheetEl().getByRole('button', { name: 'Edit Front' })).toBeTruthy();
    expect(sheetEl().queryByRole('button', { name: 'Add Front' })).toBeNull();
  });

  test('tapping a spot selects it and opens it in the panel; nothing uploads on the Style Page', async () => {
    await renderPage();
    expect(screen.getByText(/Tap a spot on the sheet/)).toBeTruthy();
    fireEvent.click(sheetEl().getByRole('button', { name: 'Add Side' }));
    expect(sheetEl().getByRole('button', { name: 'Add Side' }).getAttribute('aria-pressed')).toBe('true');
    expect(panel().getByRole('heading', { name: 'Editing Lala in the look · Side' })).toBeTruthy();
    expect(panel().getByText(SPOT_INFO.side.hint)).toBeTruthy();
    // Uploading happens in Files › Style photos (Evoni, 2026-10-22).
    expect(screen.getByTestId('episode-style-page').querySelector('input[type="file"]')).toBeNull();
    expect(panel().queryByRole('button', { name: /Upload/ })).toBeNull();
    expect(panel().getByTestId('esp2-files-open')).toBeTruthy();
  });

  test('Choose from Files lists her Style photos folder by folder, and files the picked one in the spot', async () => {
    await renderPage({ lb: lookbook({ images: { ...lookbook().images, hero: [photo('h1', 'hero')] } }) });
    fireEvent.click(sheetEl().getByRole('button', { name: 'Add Hair' }));
    fireEvent.click(panel().getByTestId('esp2-files-open'));
    const files = within(await screen.findByTestId('esp2-files'));
    expect(files.getByTestId('esp2-files-folder-unsorted').textContent).toContain('Style photos · To sort');
    expect(files.getByRole('button', { name: 'Use h1.png for Hair' })).toBeTruthy();
    // A photo filed under front before 2026-10-22 shows in To sort.
    expect(within(files.getByTestId('esp2-files-folder-unsorted')).getByRole('button', { name: 'Use f1.png for Hair' })).toBeTruthy();
    api.patch.mockResolvedValue({ data: { data: { lookbook: lookbook() } } });
    fireEvent.click(files.getByRole('button', { name: 'Use u1.png for Hair' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(`${LB_URL}/images/u1`, { category: 'hair' }));
  });

  test("taking a photo off the sheet sends it back to To sort; it stays in Files", async () => {
    await renderPage(withHero());
    fireEvent.click(sheetEl().getByRole('button', { name: 'Edit Hero' }));
    api.patch.mockResolvedValue({ data: { data: { lookbook: lookbook() } } });
    fireEvent.click(panel().getByRole('button', { name: 'Take the Hero photo off the sheet (it stays in Files)' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(`${LB_URL}/images/h1`, { category: 'unsorted' }));
    expect(api.delete).not.toHaveBeenCalled();
  });

  const POSES_ALL = [
    pose('p1', 'lala', 'side', { is_default: true }), pose('p5', 'lala', 'side'), pose('p2', 'lala', 'glamour'),
    pose('p3', 'justawoman', 'side'), pose('p4', 'lala', 'back', { status: 'processing', final_url: null }),
  ];

  test("Front, Side and Back are Lala's poses: Choose from Files offers that angle's, and picking one stars it", async () => {
    await renderPage({ poses: POSES_ALL });
    fireEvent.click(sheetEl().getByRole('button', { name: 'Add Side' }));
    expect(panel().getByText("Lala's starred Side pose in Files › Photos.")).toBeTruthy();
    fireEvent.click(panel().getByTestId('esp2-files-open'));
    const files = within(await screen.findByTestId('esp2-files'));
    await files.findByRole('button', { name: 'Use Lala Side (starred) for Side' });
    expect(files.getByRole('button', { name: 'Use Lala Side for Side' })).toBeTruthy();
    // Only Lala's Side poses: not Glamour, not JustAWoman, no Style photos.
    expect(files.queryByRole('button', { name: /Glamour|JustAWoman/ })).toBeNull();
    expect(files.queryByTestId('esp2-files-folder-unsorted')).toBeNull();
    api.patch.mockResolvedValue({ data: { data: {} } });
    fireEvent.click(files.getByRole('button', { name: 'Use Lala Side for Side' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(`/api/v1/episode-poses/${EP}/p5`, { is_default: true }));
    expect(api.post).not.toHaveBeenCalled();
  });

  test('for another spot, Choose from Files lists every ready pose of Lala and JustAWoman and copies the pick', async () => {
    await renderPage({ poses: POSES_ALL });
    fireEvent.click(sheetEl().getByRole('button', { name: 'Add Hero' }));
    fireEvent.click(panel().getByTestId('esp2-files-open'));
    const files = within(await screen.findByTestId('esp2-files'));
    await files.findByRole('button', { name: 'Use Lala Glamour for Hero' });
    expect(files.getByRole('button', { name: 'Use JustAWoman Side for Hero' })).toBeTruthy();
    // A photo still being processed is not offered.
    expect(files.queryByRole('button', { name: /Lala Back/ })).toBeNull();
    api.post.mockResolvedValue({ data: { data: { lookbook: lookbook() } } });
    fireEvent.click(files.getByRole('button', { name: 'Use Lala Glamour for Hero' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${LB_URL}/images/from-pose`, { pose_id: 'p2', category: 'hero' }));
  });

  test('with no photos in Files, Choose from Files offers Open Files', async () => {
    const { onOpenTab } = await renderPage({ poses: [], lb: lookbook({ images: Object.fromEntries(CATS.map((c) => [c, []])) }) });
    fireEvent.click(sheetEl().getByRole('button', { name: 'Add Hero' }));
    fireEvent.click(panel().getByTestId('esp2-files-open'));
    expect(await screen.findByText(/Upload them in Files › Photos/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open Files' }));
    expect(onOpenTab).toHaveBeenCalledWith('files');
  });

  test("a spot filled from Files says so: Lala's pose shows until a photo is put there", async () => {
    const url = 'https://bucket.s3.amazonaws.com/back.png';
    await renderPage({ sh: sheet({ look_from_files: { back: { id: 'p9', url, label: 'Lala · back' } } }) });
    fireEvent.click(sheetEl().getAllByRole('button', { name: /Back/ })[0]);
    const note = within(panel().getByTestId('esp2-from-files'));
    expect(note.getByText(/From Files · Lala · back/)).toBeTruthy();
    expect(note.getByRole('img').getAttribute('src')).toBe(url);
  });

  // Two of Evoni's designs, cut down (the real five come from the server's styleSheetDesigns).
  const DESIGN = (key, name, number, spots) => ({
    key, name, number, background: '#FFF9F5',
    elements: [
      { kind: 'text', x: 0, y: 0, w: 960, h: 40, text: name.toUpperCase(), size: 30, color: '#38283B', font: 'serif', align: 'center' },
      { kind: 'text', x: 0, y: 40, w: 960, h: 30, field: 'episode_event', placeholder: 'EPISODE __ • EVENT / VENUE', size: 16, color: '#5A3769', font: 'sans', align: 'center' },
      ...spots.map(([spot, label], i) => ({ kind: 'photo', spot, label, x: 10 + i * 100, y: 100, w: 90, h: 120, fill: '#F6D8E6', radius: 10 })),
    ],
  });
  const DESIGNS = [
    DESIGN('episode_look', 'The Episode Look', '01', [['hero', 'HERO / LALA'], ['front', 'FRONT'], ['shoes', 'SHOES']]),
    DESIGN('style_diary', 'The Style Diary', '02', [['hero', 'MAIN OUTFIT'], ['detail', 'DETAIL SHOT'], ['beauty', 'BEAUTY']]),
  ];
  const SIZES = [
    { key: 'pinterest', label: 'Pinterest', width: 1000, height: 1500 },
    { key: 'ig_story', label: 'Instagram story', width: 1080, height: 1920 },
  ];
  const withDesigns = (over = {}) => sheet({
    designs: DESIGNS,
    design_sizes: SIZES,
    design_values: { photo_paths: { hero: 'look.front', front: 'look.front' }, fields: { episode_event: 'EPISODE 01  •  WEARABLE EXPERIMENTS' }, palette: [] },
    ...over,
  });

  test("the designs: Classic and Evoni's designs as tabs; a design shows with this episode's values", async () => {
    await renderPage({ sh: withDesigns() });
    const tabs = within(screen.getByTestId('esp2-designs'));
    expect(tabs.getAllByRole('tab').map((t) => t.textContent)).toEqual(['ClassicThe style sheet', '01The Episode Look', '02The Style Diary']);
    expect(screen.getByTestId('esp2-design-classic').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('style-sheet')).toBeTruthy();

    fireEvent.click(screen.getByTestId('esp2-design-episode_look'));
    const d = within(screen.getByTestId('style-design-episode_look'));
    expect(screen.queryByTestId('style-sheet')).toBeNull();
    expect(d.getByText(/^EPISODE 01\s+•\s+WEARABLE EXPERIMENTS$/)).toBeTruthy();
    // Front is filled (the main photo falls back to it); Shoes waits for a photo.
    expect(d.getByRole('button', { name: 'Edit hero / lala' }).querySelector('img').getAttribute('src')).toBe('data:image/png;base64,f1');
    expect(d.getByRole('button', { name: 'Add shoes' })).toBeTruthy();
    expect(screen.getByText(/Not on this design: .*Detail/)).toBeTruthy();
  });

  test('tapping a frame on a design opens its spot, and says how many designs use it', async () => {
    await renderPage({ sh: withDesigns() });
    fireEvent.click(screen.getByTestId('esp2-design-style_diary'));
    const d = within(screen.getByTestId('style-design-style_diary'));
    fireEvent.click(d.getByRole('button', { name: 'Add detail shot' }));
    expect(panel().getByRole('heading', { name: 'Editing Lala in the look · Detail' })).toBeTruthy();
    expect(panel().getByTestId('esp2-design-use').textContent).toBe('In 1 of 2 designs');
    expect(d.getByRole('button', { name: 'Add detail shot' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(d.getByRole('button', { name: 'Edit main outfit' }));
    expect(panel().getByTestId('esp2-design-use').textContent).toBe('In 2 of 2 designs');
    fireEvent.click(d.getByRole('button', { name: 'Add beauty' }));
    expect(panel().getByRole('heading', { name: 'Editing Beauty details · Eyes' })).toBeTruthy();
  });

  test('the designs download once approved: this one in the chosen size, all of them, or every size', async () => {
    await renderPage({ lb: lookbook({ sheet_status: 'approved' }), sh: withDesigns({ status: 'approved' }) });
    URL.createObjectURL = vi.fn(() => 'blob:design');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const blob = new Blob(['png'], { type: 'image/png' });
    api.get.mockImplementation(async () => ({ data: blob, headers: {} }));
    // On Classic there is no design to download alone.
    expect(screen.getByTestId('esp2-design-download').disabled).toBe(true);
    fireEvent.click(screen.getByTestId('esp2-design-style_diary'));
    fireEvent.click(screen.getByTestId('esp2-size-ig_story'));
    expect(screen.getByTestId('esp2-size-ig_story').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByTestId('esp2-design-download'));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(`${SHEET_URL}/design/style_diary/ig_story`, { responseType: 'blob' }));
    fireEvent.click(screen.getByTestId('esp2-designs-zip'));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(`${SHEET_URL}/designs-zip/ig_story`, { responseType: 'blob' }));
    fireEvent.click(screen.getByTestId('esp2-designs-zip-all'));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(`${SHEET_URL}/designs-zip/all`, { responseType: 'blob' }));
    click.mockRestore();
  });

  test('while Draft the designs cannot be downloaded', async () => {
    await renderPage({ sh: withDesigns() });
    fireEvent.click(screen.getByTestId('esp2-design-episode_look'));
    for (const id of ['esp2-design-download', 'esp2-designs-zip', 'esp2-designs-zip-all']) expect(screen.getByTestId(id).disabled).toBe(true);
  });

  test('the tagline edits in place on the footer and saves when left', async () => {
    await renderPage();
    fireEvent.click(sheetEl().getByRole('button', { name: 'Tap to write a tagline' }));
    const input = sheetEl().getByLabelText('Write a tagline');
    api.put.mockResolvedValue({ data: { data: lookbook({ tagline: 'Dressed for the experiment.' }) } });
    fireEvent.change(input, { target: { value: 'Dressed for the experiment.' } });
    fireEvent.blur(input);
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(LB_URL, { tagline: 'Dressed for the experiment.' }));
  });

  test('the hair name edits in place under its image', async () => {
    await renderPage();
    fireEvent.click(sheetEl().getByRole('button', { name: 'Add Hair' }));
    const input = sheetEl().getByLabelText('Hair name');
    api.put.mockResolvedValue({ data: { data: lookbook({ hair_name: 'soft glam waves' }) } });
    fireEvent.change(input, { target: { value: 'soft glam waves' } });
    fireEvent.blur(input);
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(LB_URL, { hair_name: 'soft glam waves' }));
  });

  test('Swap puts the scene set\'s next image on the sheet', async () => {
    await renderPage();
    const after = lookbook({
      venue_options: [
        { source: 'scene_set_base', ref_id: 'set-1', label: 'Set base', image_url: 'https://cdn.example/base.jpg', in_lookbook: false, image_id: null },
        { source: 'scene_angle', ref_id: 'ang-1', label: 'Wide', image_url: 'https://cdn.example/wide.jpg', in_lookbook: true, image_id: 'img-wide' },
      ],
    });
    after.images.venue = [photo('img-wide', 'venue', { source: 'scene_angle' })];
    api.put.mockResolvedValue({ data: { data: after } });
    api.patch.mockResolvedValue({ data: { data: { lookbook: after } } });
    fireEvent.click(sheetEl().getByRole('button', { name: 'Swap the venue image' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(`${LB_URL}/venue`, { source: 'scene_angle', ref_id: 'ang-1', in_lookbook: true }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(`${LB_URL}/images/img-wide`, { sort_order: 0 }));
  });

  test("readiness: Ready x of 12 as the server computed it, a chip per item; a chip opens its spot", async () => {
    await renderPage();
    // The server says Front and Venue are ready.
    expect(screen.getByTestId('esp2-ready').textContent).toBe('Ready 2 of 12');
    expect(screen.getByTestId('esp2-chip-front').className).toContain('is-ready');
    expect(screen.getByTestId('esp2-chip-venue').className).toContain('is-ready');
    expect(screen.getByTestId('esp2-chip-wardrobe').className).not.toContain('is-ready');
    fireEvent.click(screen.getByTestId('esp2-chip-beauty'));
    expect(panel().getByRole('heading', { name: 'Editing Beauty details · Eyes' })).toBeTruthy();
  });

  // Task #3155: the Palette chip counts five saved colours; colours taken
  // from the pieces are offered to save, and saved as they are shown.
  test('colours taken from the pieces can be saved, and are saved as shown', async () => {
    const { extractPalette } = await import('../../lib/stylePalette');
    const FIVE = ['#A01428', '#B8962E', '#D4AF93', '#BB6573', '#E3D4AD'].map((hex) => ({ hex, source: 'pieces' }));
    vi.mocked(extractPalette).mockResolvedValueOnce(FIVE);
    await renderPage({ sh: sheet({ palette: null, palette_sources: ['data:image/png;base64,AA'] }) });
    fireEvent.click(sheetEl().getByRole('button', { name: /Palette/ }));
    const save = await waitFor(() => panel().getByTestId('esp2-palette-save'));
    expect(save.textContent).toContain('Save these colours');
    api.put.mockResolvedValue({ data: { data: lookbook() } });
    fireEvent.click(save);
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(LB_URL, { palette: FIVE }));
  });

  test('with five colours already saved there is nothing to save', async () => {
    await renderPage({ sh: sheet({ palette: ['#A01428', '#B8962E', '#D4AF93', '#BB6573', '#E3D4AD'].map((hex) => ({ hex })) }) });
    fireEvent.click(sheetEl().getByRole('button', { name: /Palette/ }));
    expect(panel().queryByTestId('esp2-palette-save')).toBeNull();
  });

  test('the wardrobe spot lists the saved look and opens Wardrobe', async () => {
    const { onOpenTab } = await renderPage();
    fireEvent.click(sheetEl().getByRole('button', { name: 'Add Body (needed)' }));
    expect(panel().getByText('Crimson Satin Ballerina Pump')).toBeTruthy();
    expect(panel().getByText('Needed')).toBeTruthy();
    fireEvent.click(panel().getByRole('button', { name: /Open Wardrobe/ }));
    expect(onOpenTab).toHaveBeenCalledWith('wardrobe');
  });

  test('Approve approves the sheet; approved, editing stays open (it returns the sheet to Draft)', async () => {
    await renderPage();
    api.post.mockResolvedValue({ data: { data: sheet({ status: 'approved' }) } });
    mockRoutes({ lb: lookbook({ sheet_status: 'approved' }), sh: sheet({ status: 'approved' }) });
    fireEvent.click(screen.getByRole('button', { name: /Approve/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${SHEET_URL}/approve`));
    await waitFor(() => expect(screen.getByTestId('esp2-status').textContent).toContain('Approved'));
    expect(screen.getByText(/Editing anything returns it to Draft/)).toBeTruthy();
    fireEvent.click(sheetEl().getByRole('button', { name: 'Add Side' }));
    expect(panel().getByTestId('esp2-files-open').disabled).toBe(false);
    expect(screen.getByRole('button', { name: /Reopen/ })).toBeTruthy();
  });

  test('Share & export: six sizes, off while Draft', async () => {
    await renderPage();
    const exp = within(screen.getByTestId('esp2-export'));
    expect(exp.getByText('Approve the sheet to export it.')).toBeTruthy();
    expect(EXPORT_SIZES.map((e) => e.size)).toEqual(['sheet', 'pin', 'story', 'post', 'look', 'pdf']);
    for (const e of EXPORT_SIZES) expect(screen.getByTestId(`esp2-export-${e.size}`).disabled).toBe(true);
  });

  test('Share & export: approved and up to date, a size downloads from the server', async () => {
    await renderPage({ lb: lookbook({ sheet_status: 'approved' }), sh: sheet({ status: 'approved' }) });
    const blob = new Blob(['png'], { type: 'image/png' });
    api.get.mockResolvedValueOnce({ data: blob, headers: { 'content-disposition': 'attachment; filename="style-sheet-episode-01-pin.png"' } });
    URL.createObjectURL = vi.fn(() => 'blob:sheet');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    expect(screen.getByTestId('esp2-export-pin').disabled).toBe(false);
    fireEvent.click(screen.getByTestId('esp2-export-pin'));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(`${SHEET_URL}/export/pin`, { responseType: 'blob' }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    click.mockRestore();
  });

  test('Share & export: an approved sheet that is out of date cannot be exported', async () => {
    await renderPage({ lb: lookbook({ sheet_status: 'approved' }), sh: sheet({ status: 'approved', stale: true }) });
    expect(within(screen.getByTestId('esp2-export')).getByText(/approve the sheet again/)).toBeTruthy();
    expect(screen.getByTestId('esp2-export-sheet').disabled).toBe(true);
  });

  test('Send to Distribution is off while Draft', async () => {
    await renderPage();
    expect(screen.getByTestId('esp2-send-distribution').disabled).toBe(true);
    expect(screen.getByLabelText('Include Shop the Look links').disabled).toBe(true);
  });

  test('Send to Distribution sends every size, with Shop the Look links when ticked, and links to Distribution', async () => {
    const { onOpenTab } = await renderPage({ lb: lookbook({ sheet_status: 'approved' }), sh: sheet({ status: 'approved' }) });
    api.post.mockResolvedValue({ data: { data: {
      sent: true, items: EXPORT_SIZES.map((e) => ({ size: e.size })), disclosure: 'Some links are affiliate links; I may earn a commission.',
    } } });
    fireEvent.click(screen.getByLabelText('Include Shop the Look links'));
    fireEvent.click(screen.getByTestId('esp2-send-distribution'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${SHEET_URL}/distribution`, { include_shop_links: true }));
    const status = await screen.findByTestId('esp2-sent');
    expect(status.textContent).toMatch(/Sent: 6 sizes and a caption draft are in Distribution\. The disclosure is added\./);
    fireEvent.click(within(status).getByRole('button', { name: 'Open Distribution' }));
    expect(onOpenTab).toHaveBeenCalledWith('distribution');
  });

  test('a refused send shows the server\'s message', async () => {
    await renderPage({ lb: lookbook({ sheet_status: 'approved' }), sh: sheet({ status: 'approved' }) });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    api.post.mockRejectedValue({ response: { data: { error: 'Approve the style sheet before sending it to Distribution.' } } });
    fireEvent.click(screen.getByTestId('esp2-send-distribution'));
    expect((await screen.findByRole('alert')).textContent).toBe('Approve the style sheet before sending it to Distribution.');
  });

  test('a failed save shows its message and keeps the page', async () => {
    await renderPage(withHero());
    api.patch.mockRejectedValue({ response: { data: { error: 'Photo not found in this episode\'s Lookbook' } } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(sheetEl().getByRole('button', { name: 'Edit Hero' }));
    fireEvent.click(panel().getByRole('button', { name: /Take the Hero photo off the sheet/ }));
    expect((await screen.findByRole('alert')).textContent).toBe("Photo not found in this episode's Lookbook");
    expect(screen.getByTestId('episode-style-page')).toBeTruthy();
  });
});
