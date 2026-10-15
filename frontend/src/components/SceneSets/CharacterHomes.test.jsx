/**
 * Characters' places on a scene set (2026-10-15, step 3 of
 * docs/VENUE_EVERYDAY_AND_EVENT_LOOKS_PLAN.md).
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import CharacterHomes, { clearCharacterPlacesCache, notifyCharacterPlacesChanged } from './CharacterHomes';

const SET = { id: 'set-loft', name: 'Loft', show_id: 'show-1' };
const data = (lalaPlaces = [], jadePlaces = []) => ({
  lead_character_id: 'c-lala',
  characters: [
    { id: 'c-jade', name: 'Jade', is_lead: false, places: jadePlaces },
    { id: 'c-lala', name: 'Lala', is_lead: true, places: lalaPlaces },
  ],
});

describe('CharacterHomes', () => {
  beforeEach(() => {
    clearCharacterPlacesCache();
    Object.values(api).forEach((fn) => fn?.mockReset?.());
  });

  test('shows who lives here; linking the lead\'s home asks the page to refresh its defaults', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: data() } });
    vi.mocked(api.post).mockResolvedValue({ data: { data: data([{ role: 'home', scene_set_id: 'set-loft', source: 'show_default' }]) } });
    const onToast = vi.fn();
    const onDefaultsChanged = vi.fn();
    render(<CharacterHomes set={SET} onToast={onToast} onDefaultsChanged={onDefaultsChanged} />);
    expect((await screen.findByTestId('character-homes-set-loft')).textContent).toMatch(/None yet/);

    fireEvent.click(screen.getByTestId('character-homes-link-set-loft'));
    fireEvent.change(screen.getByLabelText('Character'), { target: { value: 'c-lala' } });
    fireEvent.click(screen.getByTestId('character-homes-save-set-loft'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/shows/show-1/character-places',
      { character_id: 'c-lala', scene_set_id: 'set-loft', role: 'home', label: undefined }));
    expect((await screen.findByTestId('character-place-c-lala')).textContent).toMatch(/Lala · home \(lead\)/);
    expect(onDefaultsChanged).toHaveBeenCalledWith('show-1');
    expect(onToast).toHaveBeenCalledWith("Loft is Lala's home");
  });

  test('another character\'s other place carries its label; unlinking it does not touch the defaults', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: data([], [{ role: 'other', label: 'Studio', scene_set_id: 'set-loft' }]) } });
    vi.mocked(api.post).mockResolvedValue({ data: { data: data() } });
    const onDefaultsChanged = vi.fn();
    render(<CharacterHomes set={SET} onDefaultsChanged={onDefaultsChanged} />);
    const chip = await screen.findByTestId('character-place-c-jade');
    expect(chip.textContent).toMatch(/Jade · Studio/);
    fireEvent.click(screen.getByLabelText('Unlink Jade'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/shows/show-1/character-places/unlink',
      { character_id: 'c-jade', scene_set_id: 'set-loft', role: 'other' }));
    expect(onDefaultsChanged).not.toHaveBeenCalled();
  });

  test('the lead is chosen in the form', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: data() } });
    vi.mocked(api.put).mockResolvedValue({ data: { data: { lead_character_id: 'c-jade' } } });
    const onToast = vi.fn();
    render(<CharacterHomes set={SET} onToast={onToast} />);
    fireEvent.click(await screen.findByTestId('character-homes-link-set-loft'));
    vi.mocked(api.get).mockResolvedValue({ data: { data: { ...data(), characters: data().characters.map((c) => ({ ...c, is_lead: c.id === 'c-jade' })) } } });
    fireEvent.change(screen.getByLabelText("Show's lead"), { target: { value: 'c-jade' } });
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/shows/show-1/lead-character', { character_id: 'c-jade' }));
    await waitFor(() => expect(onToast).toHaveBeenCalledWith("Jade is the show's lead"));
  });

  test('a set with no show shows nothing', () => {
    const { container } = render(<CharacterHomes set={{ id: 's', name: 'Shared', show_id: null }} />);
    expect(container.textContent).toBe('');
    expect(api.get).not.toHaveBeenCalled();
  });

  test('a change elsewhere (another card, Make default) refreshes this card', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: data() } });
    render(<CharacterHomes set={SET} />);
    expect((await screen.findByTestId('character-homes-set-loft')).textContent).toMatch(/None yet/);
    vi.mocked(api.get).mockResolvedValue({ data: { data: data([{ role: 'home', scene_set_id: 'set-loft', source: 'show_default' }]) } });
    notifyCharacterPlacesChanged('show-1');
    expect((await screen.findByTestId('character-place-c-lala')).textContent).toMatch(/Lala · home \(lead\)/);
  });
});
