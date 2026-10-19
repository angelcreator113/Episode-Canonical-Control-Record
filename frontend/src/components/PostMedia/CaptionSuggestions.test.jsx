/**
 * Visual Memory phase 4 (CaptionSuggestions): the caption's reading, their
 * pictures ranked with why, and one thing to do. A made picture is a private
 * draft: Approve (with who may see it), and Attach puts it with the post's
 * pictures; nothing goes on the post by itself.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import CaptionSuggestions from './CaptionSuggestions';

const reading = { subject: 'a candle', activity: '', mood: 'calm', setting: 'home kitchen', person_in_frame: 'no', objects: ['candle'], avoid: [] };
const kitchen = { id: 'k-1', url: 'https://img/k.jpg', caption: 'Home kitchen', status: 'approved', visibility: 'internal', score: 4, ready: false, why: ['set in the home kitchen'] };
const made = { id: 'n-1', url: 'https://img/new.jpg', caption: 'a candle', status: 'draft', visibility: 'private' };
const suggestions = (plan) => ({ data: { success: true, cached: true, fallback: false, reading, ranked: [kitchen], plan } });
const create = (extra = {}) => ({ action: 'create', references: [{ kind: 'place', asset_id: 'k-1' }], blocked: null, ...extra });

describe('CaptionSuggestions', () => {
  beforeEach(() => { Object.values(api).forEach((fn) => fn.mockReset()); });

  test('shows the reading and offers the edit, with the rest kept', async () => {
    const edit = { action: 'edit', asset_id: 'k-1', change: { kind: 'object', text: 'add candle' }, locks: ['face', 'wardrobe', 'location'] };
    vi.mocked(api.post)
      .mockResolvedValueOnce(suggestions({ recommended: 'edit', use: null, edit, create: create() }))
      .mockResolvedValueOnce({ data: { success: true, action: 'edit', asset: { ...made, parent_asset_id: 'k-1' }, review: { reasons: ['Check the place still reads as their kitchen.'] } } });
    const onMade = vi.fn();
    render(<CaptionSuggestions postId="p-1" library={[]} isChosen={() => false} onUse={vi.fn()} onMade={onMade} />);
    expect((await screen.findByTestId('cs-reading')).textContent).toContain('a candle · calm · home kitchen · no one in it');
    expect(screen.getByText(/Add candle, keeping the face, wardrobe and place/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Make this edit/ }));
    await waitFor(() => expect(api.post).toHaveBeenLastCalledWith('/api/v1/post-media/posts/p-1/suggestions/run', { choice: edit }));
    expect((await screen.findByTestId('cs-made')).textContent).toContain('Check the place still reads as their kitchen.');
    expect(onMade).toHaveBeenCalled();
  });

  test('a new picture is approved with its visibility, and attached only on her click', async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce(suggestions({ recommended: 'create', use: null, edit: null, create: create() }))
      .mockResolvedValueOnce({ data: { success: true, action: 'create', asset: made, review: { reasons: ['Check it fits the caption.'] } } });
    vi.mocked(api.put).mockResolvedValueOnce({ data: { success: true } });
    const onUse = vi.fn();
    render(<CaptionSuggestions postId="p-1" library={[]} isChosen={() => false} onUse={onUse} />);
    expect(await screen.findByText(/A new picture from 1 approved reference/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Create a new picture/ }));
    await waitFor(() => expect(api.post).toHaveBeenLastCalledWith('/api/v1/post-media/posts/p-1/suggestions/run', { choice: { action: 'create' } }));
    await screen.findByTestId('cs-made');
    expect(onUse).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Who may see it'), { target: { value: 'public' } });
    fireEvent.click(screen.getByRole('button', { name: /Approve/ }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/media/n-1', { status: 'approved', visibility: 'public' }));
    fireEvent.click(await screen.findByTestId('cs-attach'));
    expect(onUse).toHaveBeenCalledWith({ ...made, status: 'approved', visibility: 'public' });
  });

  test('a picture of them with no approved portrait is not offered, and a budget refusal is said plainly', async () => {
    vi.mocked(api.post).mockResolvedValueOnce(suggestions({
      recommended: 'create', use: null, edit: null,
      create: create({ references: [], blocked: 'There is no approved portrait of Maren yet, so a new picture with them in it is not made.' }),
    }));
    render(<CaptionSuggestions postId="p-1" library={[]} isChosen={() => false} onUse={vi.fn()} />);
    expect(await screen.findByText(/no approved portrait of Maren/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Create a new picture/ }).disabled).toBe(true);

    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 429, data: { error: 'Daily image budget reached. Nothing was made; try again when the budget resets.' } } });
    render(<CaptionSuggestions postId="p-2" library={[]} isChosen={() => false} onUse={vi.fn()} />);
    expect((await screen.findByRole('alert')).textContent).toContain('Nothing was made');
  });
});
