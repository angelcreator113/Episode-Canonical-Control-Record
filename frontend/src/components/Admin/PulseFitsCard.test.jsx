/**
 * Uploads › Lala's everyday fits (Task #2922): the show's fits newest story
 * date first; "+ Add fit" picks a photo, then caption, story date and alt
 * text, then uploads; Edit and Remove per fit.
 */
import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import api from '../../services/api';
import PulseFitsCard from './PulseFitsCard';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

const FITS = [
  { id: 'f2', image_url: 'https://cdn/f2.jpg', caption: 'Brunch', story_date: '2026-04-15', image_alt: 'Lala in linen' },
  { id: 'f1', image_url: 'https://cdn/f1.jpg', caption: null, story_date: '2026-03-01', image_alt: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockResolvedValue({ data: { fits: FITS } });
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview');
  globalThis.URL.revokeObjectURL = vi.fn();
});

const order = () => [...document.querySelectorAll('li.pulse-fit[data-testid]')].map((el) => el.dataset.testid.replace('pulse-fit-', ''));

describe("Uploads › Lala's everyday fits", () => {
  test('lists the show\'s fits newest first, with a "+ Add fit" spot', async () => {
    render(<PulseFitsCard showId="show-1" />);
    await screen.findByTestId('pulse-fit-f2');
    expect(api.get).toHaveBeenCalledWith('/api/v1/pulse-fits?show_id=show-1');
    expect(order()).toEqual(['f2', 'f1']);
    expect(screen.getByTestId('pulse-fit-add').textContent).toMatch(/\+ Add fit/);
    expect(within(screen.getByTestId('pulse-fit-f2')).getByText('Worn 2026-04-15')).toBeTruthy();
    expect(within(screen.getByTestId('pulse-fit-f1')).getByText('No caption')).toBeTruthy();
  });

  test('adding a fit uploads the photo with its fields and places it by story date', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { fit: { id: 'f3', image_url: 'https://cdn/f3.jpg', caption: 'Gallery night', story_date: '2026-05-02' } } });
    render(<PulseFitsCard showId="show-1" />);
    await screen.findByTestId('pulse-fit-f2');
    const file = new File(['x'], 'fit.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('pulse-fit-file'), { target: { files: [file] } });
    const form = within(await screen.findByTestId('pulse-fit-new'));
    fireEvent.change(form.getByLabelText('Caption'), { target: { value: 'Gallery night' } });
    fireEvent.change(form.getByLabelText('Story date'), { target: { value: '2026-05-02' } });
    fireEvent.click(form.getByRole('button', { name: /Add fit/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const [url, body] = vi.mocked(api.post).mock.calls[0];
    expect(url).toBe('/api/v1/pulse-fits');
    expect(body.get('show_id')).toBe('show-1');
    expect(body.get('caption')).toBe('Gallery night');
    expect(body.get('story_date')).toBe('2026-05-02');
    expect(body.get('image')).toBe(file);
    await screen.findByTestId('pulse-fit-f3');
    expect(order()).toEqual(['f3', 'f2', 'f1']);
    expect(screen.getByTestId('pulse-fit-add')).toBeTruthy();
  });

  test('Edit saves the fields; Remove takes the fit off the list', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { fit: { ...FITS[1], caption: 'Coffee run' } } });
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<PulseFitsCard showId="show-1" />);
    const tile = within(await screen.findByTestId('pulse-fit-f1'));
    fireEvent.click(tile.getByRole('button', { name: /Edit/ }));
    fireEvent.change(tile.getByLabelText('Caption'), { target: { value: 'Coffee run' } });
    fireEvent.click(tile.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/v1/pulse-fits/f1', { caption: 'Coffee run', image_alt: '', story_date: '2026-03-01' }));
    expect(await tile.findByText('Coffee run')).toBeTruthy();

    fireEvent.click(within(screen.getByTestId('pulse-fit-f2')).getByRole('button', { name: /Remove/ }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/pulse-fits/f2'));
    await waitFor(() => expect(screen.queryByTestId('pulse-fit-f2')).toBeNull());
  });
});
