/**
 * The Appearance tab (Evoni, 2026-10-17): how they look, suggested from who
 * they are or written, and portraits made from it, one of which becomes
 * their profile photo.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

import api from '../../services/api';
import CharacterAppearanceTab from './CharacterAppearanceTab';

const CHAR = { id: 'c1', display_name: 'Maren' };
const LOOK = { summary: 'Tall, still, linen-pale', hair: 'Ash blonde, cropped', palette: ['oat', 'ink'], why: 'Her mask is calm.' };

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
});

describe('CharacterAppearanceTab', () => {
  test('no look yet: suggest fills the form from who they are; saving sends it', async () => {
    api.get.mockResolvedValue({ data: { appearance: null, portrait_url: null, portrait_cost: 0.04 } });
    api.post.mockResolvedValue({ data: { proposal: LOOK } });
    api.put.mockResolvedValue({ data: { appearance: { ...LOOK, portraits: [] } } });
    render(<CharacterAppearanceTab character={CHAR} />);
    expect(await screen.findByText(/No appearance yet/)).toBeTruthy();
    expect(screen.getByText('Make a portrait').closest('button').disabled).toBe(true);
    fireEvent.click(screen.getByText('Suggest their look'));
    const form = await screen.findByTestId('cap-form');
    expect(api.post).toHaveBeenCalledWith('/api/v1/cast/characters/c1/appearance/suggest');
    expect(within(form).getByLabelText('Hair').value).toBe('Ash blonde, cropped');
    expect(within(form).getByLabelText('Palette').value).toBe('oat, ink');
    fireEvent.change(within(form).getByLabelText('Face'), { target: { value: 'Sharp cheekbones' } });
    fireEvent.click(within(form).getByText('Save their look'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/cast/characters/c1/appearance', expect.objectContaining({
      summary: 'Tall, still, linen-pale', face: 'Sharp cheekbones', hair: 'Ash blonde, cropped', palette: ['oat', 'ink'], why: 'Her mask is calm.',
    })));
    expect((await screen.findByTestId('cap-sheet')).textContent).toContain('Ash blonde, cropped');
  });

  test('a saved look makes a portrait, at its cost; one becomes their profile photo', async () => {
    const onPortraitChanged = vi.fn();
    api.get.mockResolvedValue({ data: { appearance: { ...LOOK, portraits: [] }, portrait_url: null, portrait_cost: 0.04 } });
    api.post.mockImplementation(async (url, body) => {
      if (url.endsWith('/portrait')) return { data: { url: 'https://x/p1.jpg', appearance: { ...LOOK, portraits: [{ url: 'https://x/p1.jpg' }] }, portrait_url: null } };
      if (url.endsWith('/portrait/use')) return { data: { appearance: { ...LOOK, portraits: [{ url: body.url }] }, portrait_url: body.url } };
      return { data: {} };
    });
    render(<CharacterAppearanceTab character={CHAR} onPortraitChanged={onPortraitChanged} />);
    expect(await screen.findByText(/about \$0\.04 each/)).toBeTruthy();
    fireEvent.click(screen.getByText('Make a portrait'));
    const tile = await screen.findByTestId('cap-portrait');
    expect(api.post).toHaveBeenCalledWith('/api/v1/cast/characters/c1/appearance/portrait');
    fireEvent.click(within(tile).getByText('Use as their profile photo'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/cast/characters/c1/appearance/portrait/use', { url: 'https://x/p1.jpg' }));
    expect(await within(tile).findByText('Their profile photo')).toBeTruthy();
    expect(onPortraitChanged).toHaveBeenCalledWith('https://x/p1.jpg');
  });

  test('an error says why', async () => {
    api.get.mockResolvedValue({ data: { appearance: { ...LOOK, portraits: [] }, portrait_url: null, portrait_cost: null } });
    api.post.mockRejectedValue({ response: { status: 429, data: { error: 'Today\'s image budget is spent.' } } });
    render(<CharacterAppearanceTab character={CHAR} />);
    fireEvent.click(await screen.findByText('Make a portrait'));
    expect((await screen.findByRole('alert')).textContent).toBe('Today\'s image budget is spent.');
  });

  test('Remove drops a portrait; removing their profile photo clears it', async () => {
    const onPortraitChanged = vi.fn();
    api.get.mockResolvedValue({ data: { appearance: { ...LOOK, portraits: [{ url: 'https://x/black.jpg' }] }, portrait_url: 'https://x/black.jpg', portrait_cost: 0.04 } });
    api.post.mockResolvedValue({ data: { appearance: { ...LOOK, portraits: [] }, portrait_url: null } });
    render(<CharacterAppearanceTab character={CHAR} onPortraitChanged={onPortraitChanged} />);
    const tile = await screen.findByTestId('cap-portrait');
    fireEvent.click(within(tile).getByRole('button', { name: 'Remove this portrait (their profile photo)' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/cast/characters/c1/appearance/portrait/remove', { url: 'https://x/black.jpg' }));
    await waitFor(() => expect(screen.queryByTestId('cap-portrait')).toBeNull());
    expect(onPortraitChanged).toHaveBeenCalledWith(null);
  });
});
