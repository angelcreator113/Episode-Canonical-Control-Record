/**
 * Production → Wardrobe → Style sheet (spec Part 2; Task #2814): status
 * and readiness, the shared Lala slots, "Filled in for you" rows, the
 * palette taken from the pieces and adjustable, the tagline, Preview,
 * Approve (saves status) and Download PNG once approved.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../lib/stylePalette', () => ({
  extractPalette: vi.fn(async () => [{ hex: '#A01428', source: 'auto' }, { hex: '#B8962E', source: 'auto' }]),
}));
vi.mock('html2canvas', () => ({
  default: vi.fn(async () => ({ toBlob: (cb) => cb(new Blob(['png'], { type: 'image/png' })) })),
}));

import api from '../../services/api';
import html2canvas from 'html2canvas';
import EpisodeStyleSheetPanel from './EpisodeStyleSheetPanel';
import { EPISODE_ONE } from './StyleSheetTemplate.fixture';

const EP = 'ep-1';
const sheet = (over = {}) => ({
  ...EPISODE_ONE,
  status: 'draft', stale: false, readiness: { done: 3, total: 11, missing: [] }, cost_usd: 0,
  palette_sources: ['data:image/png;base64,AA'],
  venue: { ...EPISODE_ONE.venue, chosen_image_id: 'v1', options: [{ id: 'v1', label: 'Wide', image: null }, { id: 'v2', label: 'Door', image: null }] },
  rows: [
    { key: 'event', label: 'Event details', source: 'Event Package', state: 'ready', detail: 'Wearable Experiments Studio Session' },
    { key: 'venue', label: 'Venue', source: 'Scene set: Studio by Sable', state: 'ready', detail: "STUDIO BY SABLE's Studio" },
    { key: 'wardrobe', label: 'Wardrobe breakdown', source: 'Saved look', state: 'partial', detail: 'Needed: Body' },
    { key: 'beauty', label: 'Hair, nails and beauty', source: 'Lookbook', state: 'missing', detail: 'Hair — · Nails — · Beauty 0 of 3' },
    { key: 'palette', label: 'Color palette', source: 'Piece images', state: 'partial', detail: 'Taken from the pieces when you preview' },
    { key: 'mood', label: 'Mood words', source: 'Event keywords', state: 'ready', detail: 'statement, modern' },
    { key: 'tagline', label: 'Tagline', source: 'You', state: 'missing', detail: 'Not written yet' },
  ],
  ...over,
});

const renderPanel = async (data = sheet()) => {
  api.get.mockResolvedValue({ data: { data } });
  render(<EpisodeStyleSheetPanel episode={{ id: EP }} />);
  await screen.findByTestId('style-sheet-panel');
};

beforeEach(() => { vi.clearAllMocks(); });

describe('Style sheet panel', () => {
  test('title, Draft status, readiness bar and the cost line', async () => {
    await renderPanel();
    expect(api.get).toHaveBeenCalledWith(`/api/v1/episodes/${EP}/style-sheet`);
    expect(screen.getByRole('heading', { name: 'Style sheet' })).toBeTruthy();
    expect(screen.getByTestId('ssp-status').textContent).toBe('Draft');
    expect(screen.getByRole('progressbar', { name: 'Style sheet readiness' }).getAttribute('aria-valuenow')).toBe('3');
    expect(screen.getByTestId('ssp-ready').textContent).toBe('3 of 11');
    expect(screen.getByText(/Cost: \$0/)).toBeTruthy();
  });

  test('the four Lala slots are shared with the Lookbook', async () => {
    await renderPanel();
    for (const k of ['front', 'side', 'back', 'hero']) expect(screen.getByTestId(`ssp-look-${k}`)).toBeTruthy();
    api.post.mockResolvedValue({ data: { data: { lookbook: {} } } });
    fireEvent.change(screen.getByLabelText('Add Hero'), { target: { files: [new File(['x'], 'h.png', { type: 'image/png' })] } });
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post.mock.calls[0][0]).toBe(`/api/v1/episodes/${EP}/lookbook/images`);
    expect(api.post.mock.calls[0][1].get('category')).toBe('hero');
  });

  test('"Filled in for you" rows show their source and state', async () => {
    await renderPanel();
    const row = within(screen.getByTestId('ssp-row-wardrobe'));
    expect(row.getByText('Saved look')).toBeTruthy();
    expect(row.getByText('Partly filled')).toBeTruthy();
    expect(row.getByText('Needed: Body')).toBeTruthy();
    expect(within(screen.getByTestId('ssp-row-event')).getByText('Ready')).toBeTruthy();
    expect(within(screen.getByTestId('ssp-row-beauty')).getByText('Missing')).toBeTruthy();
  });

  test('the palette is taken from the pieces and can be adjusted', async () => {
    await renderPanel();
    const first = await screen.findByLabelText('Palette colour 1');
    expect(first.value).toBe('#a01428');
    api.put.mockResolvedValue({ data: { data: {} } });
    fireEvent.change(first, { target: { value: '#112233' } });
    fireEvent.blur(first);
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(`/api/v1/episodes/${EP}/lookbook`,
      { palette: [{ hex: '#112233', source: 'edited' }, { hex: '#B8962E', source: 'auto' }] }));
  });

  test('the tagline is hers to write and saves on leaving the field', async () => {
    await renderPanel();
    api.put.mockResolvedValue({ data: { data: {} } });
    const input = screen.getByLabelText('Tagline (prints in script on the footer)');
    fireEvent.change(input, { target: { value: 'Every look tells a story.' } });
    fireEvent.blur(input);
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(`/api/v1/episodes/${EP}/lookbook`, { tagline: 'Every look tells a story.' }));
  });

  test('choosing the venue angle reorders the venue photos', async () => {
    await renderPanel();
    api.patch.mockResolvedValue({ data: { data: { lookbook: {} } } });
    fireEvent.change(screen.getByLabelText('Angle on the sheet'), { target: { value: 'v2' } });
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(2));
    expect(api.patch.mock.calls.map((c) => [c[0].split('/').pop(), c[1]])).toEqual([['v2', { sort_order: 0 }], ['v1', { sort_order: 1 }]]);
  });

  test('Preview shows the 1024 x 1536 sheet', async () => {
    await renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Preview style sheet' }));
    expect(await screen.findByTestId('style-sheet')).toBeTruthy();
  });

  test('Approve saves the palette it shows, then the status', async () => {
    await renderPanel();
    await screen.findByLabelText('Palette colour 1');
    api.put.mockResolvedValue({ data: { data: {} } });
    api.post.mockResolvedValue({ data: { data: sheet({ status: 'approved' }) } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/api/v1/episodes/${EP}/style-sheet/approve`));
    expect(api.put).toHaveBeenCalledWith(`/api/v1/episodes/${EP}/lookbook`, { palette: [{ hex: '#A01428', source: 'auto' }, { hex: '#B8962E', source: 'auto' }] });
    await waitFor(() => expect(screen.getByTestId('ssp-status').textContent).toMatch(/Approved/));
  });

  test('once approved: Download PNG draws the sheet, and Reopen returns it to Draft', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:sheet');
    URL.revokeObjectURL = vi.fn();
    await renderPanel(sheet({ status: 'approved', palette: [{ hex: '#A01428', source: 'auto' }] }));
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.getByLabelText('Tagline (prints in script on the footer)').disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Download PNG' }));
    await waitFor(() => expect(html2canvas).toHaveBeenCalled());
    expect(html2canvas.mock.calls[0][1]).toMatchObject({ width: 1024, height: 1536, scale: 1 });
    expect(URL.createObjectURL).toHaveBeenCalled();
    api.post.mockResolvedValue({ data: { data: sheet() } });
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/api/v1/episodes/${EP}/style-sheet/reopen`));
  });

  test('an out-of-date approval says so', async () => {
    await renderPanel(sheet({ status: 'approved', stale: true }));
    expect(screen.getByText(/Out of date/)).toBeTruthy();
  });
});
