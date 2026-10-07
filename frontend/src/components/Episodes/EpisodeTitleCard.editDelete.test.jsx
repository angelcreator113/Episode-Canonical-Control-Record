/**
 * The Title overlay's words and delete (Evoni, 2026-10-07: "i need to be
 * able to edit/delete episode title" — the Title overlay).
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeTitleCard from './EpisodeTitleCard';

const EPISODE = { id: 'ep-1', show_id: 'show-1', title: 'Gala Night' };
const OVERLAY = { asset_id: 'a-1', designed_for: 'Gala Night', outdated: false, style: { variant: 'classic', band: { enabled: false } }, image_url: 'https://x/t.png' };
const state = (over = {}) => ({
  title: 'Gala Night', approved: true, approved_value: 'Gala Night', card: null, offer: { offered: false },
  overlay: OVERLAY, overlay_offer: { offered: true, flourish_estimate: { usd: 0.04 } }, ...over,
});
const ok = (data) => Promise.resolve({ data: { success: true, data } });

describe('Title overlay: edit words and delete', () => {
  beforeEach(() => { Object.values(api).forEach((fn) => fn.mockReset()); });

  test('Edit words saves the new words and shows the redrawn overlay', async () => {
    vi.mocked(api.get).mockReturnValue(ok(state()));
    vi.mocked(api.put).mockReturnValue(ok(state({ title: 'Velvet Night', approved_value: 'Velvet Night', overlay: { ...OVERLAY, designed_for: 'Velvet Night' } })));
    const onChange = vi.fn();
    render(<EpisodeTitleCard episode={EPISODE} onChange={onChange} />);
    fireEvent.click(await screen.findByTestId('etc-words-edit'));
    const input = screen.getByTestId('etc-words-input');
    expect(input.value).toBe('Gala Night');
    expect(screen.getByText(/redrawn in its style at no cost/)).toBeTruthy();
    fireEvent.change(input, { target: { value: 'Velvet Night' } });
    fireEvent.click(screen.getByTestId('etc-words-save'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/episodes/ep-1/title-overlay/words', { title: 'Velvet Night' }));
    await waitFor(() => expect(screen.queryByTestId('etc-words-form')).toBeNull());
    expect(onChange).toHaveBeenCalled();
  });

  test('empty words cannot be saved; a refusal is said', async () => {
    vi.mocked(api.get).mockReturnValue(ok(state()));
    vi.mocked(api.put).mockRejectedValue({ response: { data: { error: 'The title is too long (255 characters at most).' } } });
    render(<EpisodeTitleCard episode={EPISODE} />);
    fireEvent.click(await screen.findByTestId('etc-words-edit'));
    fireEvent.change(screen.getByTestId('etc-words-input'), { target: { value: '  ' } });
    expect(screen.getByTestId('etc-words-save').disabled).toBe(true);
    fireEvent.change(screen.getByTestId('etc-words-input'), { target: { value: 'x'.repeat(10) } });
    fireEvent.click(screen.getByTestId('etc-words-save'));
    expect((await screen.findByRole('alert')).textContent).toBe('The title is too long (255 characters at most).');
  });

  test('Delete overlay asks first, then removes it; with no overlay there is nothing to delete', async () => {
    vi.mocked(api.get).mockReturnValue(ok(state()));
    vi.mocked(api.delete).mockReturnValue(ok({ deleted: 1 }));
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<EpisodeTitleCard episode={EPISODE} />);
    fireEvent.click(await screen.findByTestId('etc-overlay-delete'));
    expect(api.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('etc-overlay-delete'));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/episodes/ep-1/title-overlay'));
    await waitFor(() => expect(screen.queryByTestId('etc-overlay-delete')).toBeNull());
    confirmSpy.mockRestore();
  });
});
