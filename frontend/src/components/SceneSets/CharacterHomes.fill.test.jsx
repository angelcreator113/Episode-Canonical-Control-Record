/**
 * Lala's home filled in when a set's workspace opens (Evoni, 2026-10-16:
 * "if this is lalas home then we know the world location ... fill those in
 * automatically"): once per show, only when the show has something to fill.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import { clearCharacterPlacesCache, clearFillTried, useLalaHomeFill } from './CharacterHomes';

function Probe({ showId, ...cb }) {
  useLalaHomeFill(showId, cb);
  return null;
}
const lala = { id: 'c-lala', name: 'Lala', is_lead: true, places: [] };

describe('useLalaHomeFill', () => {
  beforeEach(() => {
    clearCharacterPlacesCache();
    clearFillTried();
    Object.values(api).forEach((fn) => fn?.mockReset?.());
  });

  test('fills once, says what it filled, and refreshes the page and defaults', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { lead_character_id: null, fill_pending: true, characters: [{ ...lala, is_lead: false }] } } });
    vi.mocked(api.post).mockResolvedValue({ data: { data: {
      lead_set: true,
      placed: [{ scene_set_id: 's1', scene_set_name: "Lala's bedroom", world_location_id: 'l1' }],
      data: { lead_character_id: 'c-lala', fill_pending: false, characters: [lala] },
    } } });
    const onToast = vi.fn(); const onFilled = vi.fn(); const onDefaultsChanged = vi.fn();
    const { rerender } = render(<Probe showId="show-1" onToast={onToast} onFilled={onFilled} onDefaultsChanged={onDefaultsChanged} />);
    await waitFor(() => expect(onToast).toHaveBeenCalledWith("Lala is the show's lead; Lala's bedroom placed in Lala's home."));
    expect(api.post).toHaveBeenCalledWith('/api/v1/shows/show-1/character-places/fill');
    expect(onFilled).toHaveBeenCalledTimes(1);
    expect(onDefaultsChanged).toHaveBeenCalledWith('show-1');
    // Opening another set of the show does not fill again.
    rerender(<Probe showId={null} onToast={onToast} />);
    rerender(<Probe showId="show-1" onToast={onToast} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  test('nothing to fill, or no set open: no write', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { lead_character_id: 'c-lala', fill_pending: false, characters: [lala] } } });
    render(<Probe showId="show-2" />);
    render(<Probe showId={null} />);
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 0));
    expect(api.post).not.toHaveBeenCalled();
  });
});
