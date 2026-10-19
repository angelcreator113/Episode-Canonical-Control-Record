/**
 * A post's pictures and format (Visual Memory phase 2): pick from the
 * poster's library, in order, in a format; a carousel needs two; a picture
 * that isn't public blocks a scheduled post until "Approve and make public";
 * suggestions for the caption come from the same library.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import PostPictures from './PostPictures';

const dough = { id: 'a-1', url: 'https://img/dough.jpg', caption: 'Dough rising', status: 'draft', visibility: 'private' };
const kitchen = { id: 'a-2', url: 'https://img/kitchen.jpg', caption: 'Kitchen', status: 'approved', visibility: 'public' };
const formats = [
  { key: 'post', label: 'Post', min: 0, max: 4 }, { key: 'carousel', label: 'Carousel', min: 2, max: 10 },
  { key: 'story', label: 'Story', min: 0, max: 1 }, { key: 'video', label: 'Pulse video', min: 0, max: 1 }, { key: 'live', label: 'Live', min: 0, max: 1 },
];
const editor = (post = {}) => ({
  success: true,
  post: { id: 'p-1', status: 'draft', release_state: null, format: 'post', photos: [], content_text: 'still here. the bread is rising.', ...post },
  poster: { id: 'c-1', name: 'Maren' }, pictures: [], library: [dough, kitchen], formats,
});

describe('PostPictures', () => {
  beforeEach(() => { Object.values(api).forEach((fn) => fn.mockReset()); });

  test('picks pictures in order and saves them with the format; a carousel needs two', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: editor() });
    vi.mocked(api.put).mockResolvedValue({ data: editor({ format: 'carousel' }) });
    const onSaved = vi.fn();
    render(<PostPictures postId="p-1" onSaved={onSaved} />);
    const library = await screen.findByTestId('pp-library');
    fireEvent.change(screen.getByLabelText('Format'), { target: { value: 'carousel' } });
    fireEvent.click(within(library).getByRole('button', { name: 'Kitchen' }));
    expect(screen.getByTestId('pp-save').disabled).toBe(true);
    fireEvent.click(within(library).getByRole('button', { name: 'Dough rising' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move picture 2 earlier' }));
    fireEvent.click(screen.getByTestId('pp-save'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/post-media/posts/p-1', { asset_ids: ['a-1', 'a-2'], format: 'carousel' }));
    expect(onSaved).toHaveBeenCalled();
    expect(await screen.findByText('Saved. The caption is unchanged.')).toBeTruthy();
  });

  test('a scheduled post with a private picture is blocked until it is approved and made public', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: editor({ release_state: 'scheduled' }) });
    vi.mocked(api.put)
      .mockRejectedValueOnce({ response: { data: { error: 'A picture is not approved and public yet.', code: 'pictures_not_public', pictures: [{ id: 'a-1' }] } } })
      .mockResolvedValueOnce({ data: { success: true } });
    render(<PostPictures postId="p-1" />);
    fireEvent.click(within(await screen.findByTestId('pp-library')).getByRole('button', { name: 'Dough rising' }));
    fireEvent.click(screen.getByTestId('pp-save'));
    fireEvent.click(await screen.findByTestId('pp-approve'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/media/a-1', { status: 'approved', visibility: 'public' }));
  });

  test('suggestions for the caption read it, rank their pictures with why, and Use this puts one with the post', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: editor() });
    vi.mocked(api.post).mockResolvedValueOnce({ data: {
      success: true, cached: false, fallback: false,
      reading: { subject: 'bread dough', activity: 'baking bread', mood: 'quiet', setting: 'home kitchen', person_in_frame: 'optional', objects: ['dough'], avoid: [] },
      ranked: [{ ...dough, score: 12, ready: false, why: ['shows dough, ceramic bowl'] }],
      plan: { recommended: 'use', use: { action: 'use', asset_id: 'a-1', ready: false }, edit: null, create: { action: 'create', references: [], blocked: null } },
    } });
    render(<PostPictures postId="p-1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Suggest for this caption/ }));
    const list = await screen.findByTestId('pp-suggestions');
    expect(list.textContent).toContain('shows dough, ceramic bowl');
    expect(api.post).toHaveBeenCalledWith('/api/v1/post-media/posts/p-1/suggestions', {});
    fireEvent.click(screen.getByTestId('cs-action'));
    expect(within(screen.getByTestId('pp-chosen')).getByAltText('Dough rising')).toBeTruthy();
    expect(api.put).not.toHaveBeenCalled(); // nothing saved until Save
  });
});
