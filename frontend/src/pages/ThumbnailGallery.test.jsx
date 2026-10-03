/**
 * Thumbnail Gallery reads the route's episode (audit TRUTH-03,
 * 2026-10-03): its real thumbnails, an honest empty state, a failed read
 * with Retry, and Delete that deletes. No sample records.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
  episodeAPI: { getById: vi.fn() },
}));

import api, { episodeAPI } from '../services/api';
import ThumbnailGallery, { thumbnailStatus } from './ThumbnailGallery';

const THUMBS = [
  { id: 11, episodeId: 'ep-1', thumbnailType: 'primary', format: 'jpeg', publishStatus: 'PUBLISHED', isPrimary: true, widthPixels: 1280, heightPixels: 720, generatedAt: '2026-09-30T10:00:00Z' },
  { id: 12, episodeId: 'ep-1', thumbnailType: 'poster', format: 'png', publishStatus: 'DRAFT', isPrimary: false, generatedAt: '2026-10-01T10:00:00Z' },
];
const renderAt = (episodeId = 'ep-1') => render(
  <MemoryRouter initialEntries={[`/thumbnails/${episodeId}`]}>
    <Routes><Route path="/thumbnails/:episodeId" element={<ThumbnailGallery />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  episodeAPI.getById.mockReset();
  episodeAPI.getById.mockResolvedValue({ data: { id: 'ep-1', episode_number: 6, title: 'Brunch Outfit Styling' } });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('ThumbnailGallery', () => {
  test('shows the route episode\'s own thumbnails, never samples', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: THUMBS, count: 2, episodeId: 'ep-1' } });
    renderAt();
    expect((await screen.findByTestId('thumbnail-count')).textContent).toBe('Ep. 6: Brunch Outfit Styling · 2 thumbnails');
    expect(api.get).toHaveBeenCalledWith('/api/v1/thumbnails/episode/ep-1');
    const primary = screen.getByTestId('thumbnail-11');
    expect(primary.textContent).toContain('Primary · ⭐ primary');
    expect(primary.textContent).toContain('JPEG · 1280×720');
    expect(screen.getByTestId('thumbnail-12').textContent).toContain('Poster');
    expect(screen.queryByText(/Capsule Wardrobe/)).toBeNull();
  });

  test('an episode with none says so; a filter that matches nothing says that instead', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [], count: 0, episodeId: 'ep-1' } });
    renderAt();
    expect((await screen.findByTestId('thumbnail-empty')).textContent).toContain('No thumbnails yet for this episode');
    expect(screen.queryByText(/Brunch Outfit Styling/)).toBeTruthy();
  });

  test('a failed read is an error with Retry; an unknown episode says so', async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { response: { status: 500, data: { error: 'Thumbnails unavailable' } } }))
      .mockResolvedValueOnce({ data: { data: THUMBS } });
    renderAt();
    const failed = await screen.findByTestId('thumbnail-load-failed');
    expect(failed.textContent).toContain("Could not load this episode's thumbnails. Thumbnails unavailable");
    expect(screen.queryByTestId('thumbnail-empty')).toBeNull();
    fireEvent.click(within(failed).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByTestId('thumbnail-11')).toBeTruthy());

    vi.mocked(api.get).mockRejectedValue(Object.assign(new Error('nope'), { response: { status: 404 } }));
    renderAt('ep-missing');
    expect((await screen.findByText(/Episode ep-missing was not found/)).textContent).toBeTruthy();
  });

  test('Delete deletes the record and removes the card; a refused delete says why', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: THUMBS } });
    vi.mocked(api.delete).mockResolvedValueOnce({ data: { message: 'deleted' } });
    renderAt();
    const poster = await screen.findByTestId('thumbnail-12');
    fireEvent.click(within(poster).getByRole('button', { name: 'Delete Poster' }));
    await waitFor(() => expect(screen.queryByTestId('thumbnail-12')).toBeNull());
    expect(api.delete).toHaveBeenCalledWith('/api/v1/thumbnails/12');
    expect(api.get).toHaveBeenCalledTimes(1);

    vi.mocked(api.delete).mockRejectedValueOnce(Object.assign(new Error('forbidden'), { response: { status: 403 } }));
    fireEvent.click(within(screen.getByTestId('thumbnail-11')).getByRole('button', { name: 'Delete Primary' }));
    expect((await screen.findByTestId('thumbnail-notice')).textContent).toBe('You do not have permission to delete thumbnails.');
    expect(screen.getByTestId('thumbnail-11')).toBeTruthy();
  });

  test('thumbnailStatus reads the record\'s status and defaults to draft', () => {
    expect(thumbnailStatus({ publishStatus: 'PUBLISHED' })).toBe('PUBLISHED');
    expect(thumbnailStatus({ publish_status: 'ARCHIVED' })).toBe('ARCHIVED');
    expect(thumbnailStatus({})).toBe('DRAFT');
  });
});
