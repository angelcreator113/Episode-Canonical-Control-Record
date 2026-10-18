/**
 * Admin › The Pulse (Task #2919): the Social Director's sub-tabs (?sub=,
 * Uploads by default) and Uploads › Cover, The Pulse's cover image and alt
 * text saved to the show (/api/v1/shows/:id/pulse-cover).
 */
import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import api from '../services/api';
import PulseDirector, { CoverCard } from './AdminPulse';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('../services/showService', () => ({ default: { getAllShows: vi.fn(async () => [{ id: 'show-1', name: 'Styling Adventures' }]) } }));

const COVER = { url: 'https://cdn/cover.jpg', width: 2400, height: 800, alt: 'Dazzle District at dusk' };

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe('Social Director sub-tabs', () => {
  test('Review by default, with its count on the tab; Uploads shows the cover for the only show; the others say which phase brings them', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.includes('/pulse-cover')) return { data: { cover: null } };
      if (url.includes('/comments/pending')) return { data: { data: [{ id: 'c1', handle: 'fan', text: 'hi' }] } };
      if (url.includes('/feed-posts')) return { data: { data: [], total: url.includes('from=wall') ? 2 : 0 } };
      return { data: {} };
    });
    render(<MemoryRouter initialEntries={['/admin?tab=pulse']}><PulseDirector /></MemoryRouter>);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Review', 'Uploads', 'Story clock', 'Growth', 'Voices', 'Brands', 'Engine', 'Storylines', 'Calendar', 'Polls', 'Recaps']);
    expect(screen.getByRole('tab', { name: /^Review/ }).getAttribute('aria-selected')).toBe('true');
    await screen.findByTestId('pulse-review');
    await waitFor(() => expect(screen.getByRole('tab', { name: /^Review/ }).textContent).toBe('Review (3)'));

    fireEvent.click(screen.getByRole('tab', { name: 'Uploads' }));
    await screen.findByTestId('pulse-cover-add');
    expect(api.get).toHaveBeenCalledWith('/api/v1/shows/show-1/pulse-cover');

    // Storylines (Task 2989) is live: the planner, not a note.
    fireEvent.click(screen.getByRole('tab', { name: 'Storylines' }));
    await screen.findByTestId('pulse-story');
    expect(screen.queryByTestId('pulse-coming')).toBeNull();
    expect(api.get).toHaveBeenCalledWith('/api/v1/pulse-storylines?show_id=show-1');

    // Calendar (Task 2988) is live: the story-time calendar, not a note.
    fireEvent.click(screen.getByRole('tab', { name: 'Calendar' }));
    await screen.findByTestId('pulse-cal');
    expect(screen.queryByTestId('pulse-coming')).toBeNull();
    expect(api.get).toHaveBeenCalledWith('/api/v1/pulse-calendar?show_id=show-1');

    // Polls (Task 3006): the audience polls.
    fireEvent.click(screen.getByRole('tab', { name: 'Polls' }));
    await screen.findByTestId('pulse-poll');
    expect(api.get).toHaveBeenCalledWith('/api/v1/pulse-polls?show_id=show-1');

    // Recaps (Task 3009): the weekly Pulse recap.
    fireEvent.click(screen.getByRole('tab', { name: 'Recaps' }));
    await screen.findByTestId('pulse-recap');
    expect(api.get).toHaveBeenCalledWith('/api/v1/pulse-recaps?show_id=show-1');
  });
});

describe('Uploads › Cover', () => {
  const renderCard = () => render(<MemoryRouter><CoverCard showId="show-1" /></MemoryRouter>);

  test('empty: a dashed "+ Add cover" spot that uploads the chosen file', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { cover: null } });
    vi.mocked(api.post).mockResolvedValue({ data: { cover: { ...COVER, alt: '' } } });
    renderCard();
    expect((await screen.findByTestId('pulse-cover-add')).textContent).toMatch(/\+ Add cover/);

    const file = new File(['x'], 'cover.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('pulse-cover-file'), { target: { files: [file] } });
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const [url, form] = vi.mocked(api.post).mock.calls[0];
    expect(url).toBe('/api/v1/shows/show-1/pulse-cover');
    expect(form.get('image')).toBe(file);
    expect(await screen.findByText('Add alt text: the cover has none yet.')).toBeTruthy();
  });

  test('filled: preview, alt text saves only when changed and not empty, and Remove clears it', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { cover: COVER } });
    vi.mocked(api.patch).mockResolvedValue({ data: { cover: { ...COVER, alt: 'The five Dream Cities' } } });
    vi.mocked(api.delete).mockResolvedValue({ data: { cover: null } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderCard();

    const img = await screen.findByRole('img');
    expect(img.getAttribute('src')).toBe(COVER.url);
    expect(img.getAttribute('alt')).toBe(COVER.alt);
    const save = screen.getByRole('button', { name: 'Save alt text' });
    expect(save.disabled).toBe(true);

    const alt = screen.getByTestId('pulse-cover-alt');
    fireEvent.change(alt, { target: { value: '   ' } });
    expect(save.disabled).toBe(true);
    fireEvent.change(alt, { target: { value: 'The five Dream Cities' } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/v1/shows/show-1/pulse-cover', { alt: 'The five Dream Cities' }));

    fireEvent.click(screen.getByRole('button', { name: /Remove/ }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/shows/show-1/pulse-cover'));
    expect(await screen.findByTestId('pulse-cover-add')).toBeTruthy();
  });

  test('an error from the server is shown', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { cover: null } });
    vi.mocked(api.post).mockRejectedValue({ response: { data: { error: 'The cover must be a PNG, JPEG or WebP image.' } } });
    renderCard();
    await screen.findByTestId('pulse-cover-add');
    fireEvent.change(screen.getByTestId('pulse-cover-file'), { target: { files: [new File(['x'], 'a.gif', { type: 'image/gif' })] } });
    expect((await screen.findByRole('alert')).textContent).toBe('The cover must be a PNG, JPEG or WebP image.');
  });
});
