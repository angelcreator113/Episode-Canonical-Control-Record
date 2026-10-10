/**
 * Distribution → Style sheet (Task #2878): the sent sheet's sizes as
 * downloads, the caption she edits, Shop the Look, and the affiliate
 * disclosure, which the server adds and the card shows with no way to
 * edit it. Nothing posts; Copy puts the post text on the clipboard.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '../../services/api';
import StyleSheetDistributionCard from './StyleSheetDistributionCard';

const EP = 'ep-1';
const URL_ = `/api/v1/episodes/${EP}/style-sheet/distribution`;
const DISCLOSURE = 'Some links are affiliate links; I may earn a commission.';
const SIZES = [['sheet', 'Style sheet', 1024, 1536], ['pin', 'Pinterest pin', 1000, 1500], ['story', 'Instagram story', 1080, 1920],
  ['post', 'Instagram post', 1080, 1350], ['look', 'The look only', 640, 1100], ['pdf', 'Print PDF', 576, 864]];

const entry = (over = {}) => ({
  sent: true,
  sent_at: '2026-10-10T20:00:00.000Z',
  out_of_date: false,
  items: SIZES.map(([size, label, width, height]) => ({ size, label, width, height, path: `/api/v1/episodes/${EP}/style-sheet/export/${size}` })),
  caption: 'Episode 01: Wearable Experiments\n\nWearable Experiments Studio Session · STUDIO BY SABLE',
  caption_max: 2200,
  include_shop_links: false,
  shop_links: [
    { piece_id: 'w1', label: 'Crimson Satin Ballerina Pump', retailer: null, url: 'https://shop.example/pump', affiliate: false },
    { piece_id: 'w2', label: 'Crimson Bloom Enamel Stud Earrings', retailer: null, url: 'https://aff.example/studs', affiliate: true },
  ],
  disclosure: null,
  disclosure_locked: false,
  post_text: 'Episode 01: Wearable Experiments\n\nWearable Experiments Studio Session · STUDIO BY SABLE',
  ...over,
});
const renderCard = async (data = entry()) => {
  api.get.mockResolvedValue({ data: { data: data } });
  render(<StyleSheetDistributionCard episodeId={EP} episodeNumber={1} />);
  await screen.findByTestId('ssd-card');
};

beforeEach(() => { vi.clearAllMocks(); });

describe('Style sheet in Distribution', () => {
  test('not sent: says where to send it from', async () => {
    await renderCard({ sent: false });
    expect(api.get).toHaveBeenCalledWith(URL_);
    expect(screen.getByText(/Not sent yet\. Approve the style sheet on the Style Page, then Send to Distribution\./)).toBeTruthy();
  });

  test('sent: every size downloads, the caption draft is there, links are offered', async () => {
    await renderCard();
    for (const [size] of SIZES) expect(screen.getByTestId(`ssd-item-${size}`).disabled).toBe(false);
    expect(screen.getByLabelText('Caption').value).toMatch(/^Episode 01: Wearable Experiments/);
    expect(screen.getByLabelText('Include Shop the Look links').checked).toBe(false);
    expect(screen.getByText('Crimson Bloom Enamel Stud Earrings')).toBeTruthy();
    expect(screen.getByText('Affiliate')).toBeTruthy();
    expect(screen.queryByTestId('ssd-disclosure')).toBeNull();

    const blob = new Blob(['png'], { type: 'image/png' });
    api.get.mockResolvedValueOnce({ data: blob, headers: {} });
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    fireEvent.click(screen.getByTestId('ssd-item-story'));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(`/api/v1/episodes/${EP}/style-sheet/export/story`, { responseType: 'blob' }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    click.mockRestore();
  });

  test('including the links saves the toggle; the disclosure shows, locked, with no field to edit it', async () => {
    await renderCard();
    api.patch.mockResolvedValue({ data: { data: entry({ include_shop_links: true, disclosure: DISCLOSURE, disclosure_locked: true }) } });
    fireEvent.click(screen.getByLabelText('Include Shop the Look links'));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(URL_, { include_shop_links: true }));
    const disclosure = await screen.findByTestId('ssd-disclosure');
    expect(disclosure.textContent).toContain(DISCLOSURE);
    expect(disclosure.textContent).toContain('Added because an affiliate link is included');
    expect(disclosure.querySelector('input, textarea, button')).toBeNull();
    expect(screen.getByLabelText('Caption').value).not.toContain(DISCLOSURE);
  });

  test('the caption saves; copy waits for the save and copies the post text', async () => {
    await renderCard(entry({ include_shop_links: true, disclosure: DISCLOSURE, post_text: `${DISCLOSURE}\n\nStudio night.` }));
    const save = screen.getByRole('button', { name: 'Save caption' });
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Caption'), { target: { value: 'Studio night.' } });
    expect(screen.getByRole('button', { name: /Copy post text/ }).disabled).toBe(true);
    api.patch.mockResolvedValue({ data: { data: entry({ caption: 'Studio night.', include_shop_links: true, disclosure: DISCLOSURE, post_text: `${DISCLOSURE}\n\nStudio night.` }) } });
    fireEvent.click(save);
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(URL_, { caption: 'Studio night.' }));
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await waitFor(() => expect(screen.getByRole('button', { name: /Copy post text/ }).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: /Copy post text/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${DISCLOSURE}\n\nStudio night.`));
    expect(await screen.findByRole('button', { name: /Copied/ })).toBeTruthy();
  });

  test('out of date: the downloads are off and it says why', async () => {
    await renderCard(entry({ out_of_date: true }));
    expect(screen.getByText(/The sheet changed since it was sent/)).toBeTruthy();
    expect(screen.getByTestId('ssd-item-sheet').disabled).toBe(true);
  });

  test('Remove takes it out of Distribution', async () => {
    await renderCard();
    api.delete.mockResolvedValue({ data: { data: { sent: false } } });
    fireEvent.click(screen.getByRole('button', { name: /Remove from Distribution/ }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith(URL_));
    expect(await screen.findByText(/Not sent yet/)).toBeTruthy();
  });

  test('a refused save shows the server\'s message', async () => {
    await renderCard();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    api.patch.mockRejectedValue({ response: { data: { error: 'The caption is at most 2200 characters.' } } });
    fireEvent.change(screen.getByLabelText('Caption'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save caption' }));
    expect((await screen.findByRole('alert')).textContent).toBe('The caption is at most 2200 characters.');
  });
});
