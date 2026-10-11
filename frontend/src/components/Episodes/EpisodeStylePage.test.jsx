/**
 * Production → Style Page (was Lookbook; Task #2876; spec Part 2, "Style
 * Page"): the sheet is the editor. Every spot can be tapped on the sheet and
 * filled from the panel (Upload, or a photo from To sort); the tagline and
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

function mockRoutes({ lb = lookbook(), sh = sheet() } = {}) {
  api.get.mockImplementation(async (url) => {
    if (url === LB_URL) return { data: { data: lb } };
    if (url === SHEET_URL) return { data: { data: sh } };
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
const panel = () => within(screen.getByTestId('esp2-spot-panel'));

beforeEach(() => { vi.clearAllMocks(); });

describe('Style Page', () => {
  test('header: Style Page, Draft, Drop photos to sort, Approve; the sheet at its real layout', async () => {
    await renderPage();
    expect(screen.getByRole('heading', { level: 2, name: 'Style Page' })).toBeTruthy();
    expect(screen.getByTestId('esp2-status').textContent).toBe('Draft');
    expect(screen.getByRole('button', { name: /Drop photos to sort/ })).toBeTruthy();
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

  test('tapping a spot selects it and opens it in the panel; Upload sends the photo to that spot', async () => {
    await renderPage();
    expect(screen.getByText(/Tap a spot on the sheet/)).toBeTruthy();
    fireEvent.click(sheetEl().getByRole('button', { name: 'Add Side' }));
    expect(sheetEl().getByRole('button', { name: 'Add Side' }).getAttribute('aria-pressed')).toBe('true');
    expect(panel().getByRole('heading', { name: 'Editing Lala in the look · Side' })).toBeTruthy();
    expect(panel().getByText(SPOT_INFO.side.hint)).toBeTruthy();
    api.post.mockResolvedValue({ data: { data: { lookbook: lookbook() } } });
    const file = new File(['x'], 'side.png', { type: 'image/png' });
    fireEvent.change(panel().getByLabelText('Upload Side'), { target: { files: [file] } });
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [url, form] = api.post.mock.calls[0];
    expect(url).toBe(`${LB_URL}/images`);
    expect(form.get('category')).toBe('side');
    expect(form.getAll('files')).toEqual([file]);
  });

  test('a photo from To sort goes into the selected spot', async () => {
    await renderPage();
    fireEvent.click(sheetEl().getByRole('button', { name: 'Add Back' }));
    api.patch.mockResolvedValue({ data: { data: { lookbook: lookbook() } } });
    fireEvent.click(panel().getByRole('button', { name: 'Use u1.png for Back' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(`${LB_URL}/images/u1`, { category: 'back' }));
  });

  test('"Drop photos to sort" uploads into To sort', async () => {
    await renderPage();
    api.post.mockResolvedValue({ data: { data: { lookbook: lookbook() } } });
    const files = [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.jpg', { type: 'image/jpeg' })];
    fireEvent.change(screen.getByLabelText('Drop photos to sort'), { target: { files } });
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post.mock.calls[0][1].get('category')).toBeNull();
    expect(api.post.mock.calls[0][1].getAll('files')).toHaveLength(2);
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
    expect(panel().getByRole('button', { name: /Upload Side/ }).disabled).toBe(false);
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
    expect(status.textContent).toMatch(/Sent: 6 sizes and a caption draft are in Distribution\. The affiliate disclosure is added\./);
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
    await renderPage();
    api.post.mockRejectedValue({ response: { data: { error: 'Only PNG, JPEG or WebP.' } } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.change(screen.getByLabelText('Drop photos to sort'), { target: { files: [new File(['a'], 'a.png', { type: 'image/png' })] } });
    expect((await screen.findByRole('alert')).textContent).toBe('Only PNG, JPEG or WebP.');
    expect(screen.getByTestId('episode-style-page')).toBeTruthy();
  });
});
