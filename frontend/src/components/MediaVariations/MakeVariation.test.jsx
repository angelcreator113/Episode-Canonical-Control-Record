/**
 * Visual Memory, phase 3 (Evoni, 2026-10-19): make a variation of a library
 * picture — one change, the rest locked — then approve or discard the draft;
 * the original and its variations are shown together.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import { MakeVariation, PictureFamily, MadeFrom } from './MakeVariation';

const original = { id: 'a-1', url: 'https://img/dough.png', caption: 'Dough rising', status: 'approved', visibility: 'internal' };
const made = { id: 'a-2', url: 'https://img/cup.png', caption: 'Dough rising (variation)', status: 'draft', visibility: 'private', parent_asset_id: 'a-1' };
const review = { needs_review: true, reasons: ['Check it matches the original everywhere except what was changed.'] };

describe('MakeVariation', () => {
  beforeEach(() => { Object.values(api).forEach((fn) => fn.mockReset()); });

  test('changing an object starts with everything locked but the props, and makes a draft beside the original', async () => {
    api.post.mockResolvedValueOnce({ data: { success: true, asset: made, review } });
    const onMade = vi.fn();
    render(<MakeVariation asset={original} onMade={onMade} />);
    fireEvent.click(screen.getByTestId('mv-open'));
    const box = screen.getByTestId('make-variation');
    const locks = within(box).getByRole('group', { name: 'Locks' });
    expect(within(locks).getByRole('button', { name: /Face/ }).getAttribute('aria-pressed')).toBe('true');
    const props = within(locks).getByRole('button', { name: /Props/ });
    expect(props.getAttribute('aria-pressed')).toBe('false');
    expect(props.disabled).toBe(true);
    expect(screen.getByTestId('mv-make').disabled).toBe(true);
    fireEvent.change(within(box).getByLabelText('To what'), { target: { value: 'a tea cup instead of the bread bowl' } });
    fireEvent.click(within(locks).getByRole('button', { name: /Wardrobe/ }));
    fireEvent.click(screen.getByTestId('mv-make'));
    const result = await screen.findByTestId('mv-made');
    expect(api.post).toHaveBeenCalledWith('/api/v1/media/a-1/variations', {
      change: { kind: 'object', text: 'a tea cup instead of the bread bowl' }, locks: ['face', 'location'],
    });
    expect(onMade).toHaveBeenCalled();
    expect(within(result).getByAltText('Dough rising')).toBeTruthy();
    expect(within(result).getByAltText('Dough rising (variation)')).toBeTruthy();
    expect(result.textContent).toContain('Check it matches the original');
  });

  test('approving sets who may see it; discarding removes the draft and leaves the original', async () => {
    api.post.mockResolvedValue({ data: { success: true, asset: made, review } });
    api.put.mockResolvedValueOnce({ data: { success: true, asset: { ...made, status: 'approved', visibility: 'public' } } });
    const { unmount } = render(<MakeVariation asset={original} startOpen />);
    fireEvent.change(screen.getByLabelText('To what'), { target: { value: 'a tea cup' } });
    fireEvent.click(screen.getByTestId('mv-make'));
    const result = await screen.findByTestId('mv-made');
    fireEvent.change(within(result).getByLabelText('Who may see it'), { target: { value: 'public' } });
    fireEvent.click(within(result).getByRole('button', { name: /Approve/ }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/media/a-2', { status: 'approved', visibility: 'public' }));
    expect(await within(result).findByText(/Approved/)).toBeTruthy();
    unmount();

    api.delete.mockResolvedValueOnce({ data: { success: true, removed: true } });
    render(<MakeVariation asset={original} startOpen />);
    fireEvent.change(screen.getByLabelText('To what'), { target: { value: 'a tea cup' } });
    fireEvent.click(screen.getByTestId('mv-make'));
    const again = await screen.findByTestId('mv-made');
    fireEvent.click(within(again).getByRole('button', { name: /Discard/ }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/media/a-2'));
    expect(await within(again).findByText(/The original is unchanged/)).toBeTruthy();
  });

  test('adding a character needs someone picked; a refusal (the image budget) is shown', async () => {
    api.get.mockResolvedValue({ data: { success: true, items: [{ entity_type: 'character', entity_id: 'c-2', name: 'Sable' }, { entity_type: 'brand', entity_id: 'b-1', name: 'Sable & Co' }] } });
    api.post.mockRejectedValueOnce({ response: { data: { error: 'Daily image budget reached ($10.00 of $10.00).' } } });
    render(<MakeVariation asset={original} startOpen />);
    fireEvent.change(screen.getByLabelText('Change'), { target: { value: 'add_character' } });
    expect(screen.getByTestId('mv-make').disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText('A name'), { target: { value: 'Sab' } });
    const pick = await screen.findByRole('button', { name: 'Sable' }, { timeout: 2000 });
    expect(screen.queryByRole('button', { name: 'Sable & Co' })).toBeNull();
    fireEvent.click(pick);
    fireEvent.click(screen.getByTestId('mv-make'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/media/a-1/variations', {
      change: { kind: 'add_character', text: '', character_id: 'c-2' }, locks: ['face', 'wardrobe', 'location', 'props'],
    }));
    expect((await screen.findByRole('alert')).textContent).toContain('image budget');
  });
});

describe('PictureFamily', () => {
  beforeEach(() => { Object.values(api).forEach((fn) => fn.mockReset()); });

  test('shows the original and its variations, marking drafts', async () => {
    api.get.mockResolvedValueOnce({ data: { success: true, root_id: 'a-1', items: [original, { ...made, generation: { kind: 'object' } }] } });
    render(<PictureFamily assetId="a-2" />);
    const family = await screen.findByTestId('picture-family');
    expect(api.get).toHaveBeenCalledWith('/api/v1/media/a-2/family');
    expect(family.textContent).toContain('The original and its variations (2)');
    expect(family.textContent).toContain('Variation (object) · draft');
  });

  test('a picture with no variations shows nothing', async () => {
    api.get.mockResolvedValueOnce({ data: { success: true, root_id: 'a-1', items: [original] } });
    const { container } = render(<PictureFamily assetId="a-1" />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });
});

describe('MadeFrom', () => {
  beforeEach(() => { Object.values(api).forEach((fn) => fn.mockReset()); });

  test('names the place picture and the portrait a made picture came from', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { success: true, items: [
      { role: 'place', source_asset_id: 'k-1', caption: 'Home kitchen' },
      { role: 'portrait', character_id: 'm-1', character_name: 'Maren' },
    ] } });
    render(<MadeFrom assetId="n-1" />);
    expect((await screen.findByTestId('picture-made-from')).textContent).toBe('Made from the place picture "Home kitchen", the portrait of Maren.');
    expect(api.get).toHaveBeenCalledWith('/api/v1/media/n-1/sources');
  });

  test('shows nothing when it was made from nothing', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { success: true, items: [] } });
    const { container } = render(<MadeFrom assetId="n-2" />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });
});
