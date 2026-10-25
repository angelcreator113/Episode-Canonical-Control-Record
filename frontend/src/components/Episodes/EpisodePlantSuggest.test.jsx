/**
 * Script tab › Plants for later (2026-10-25): Suggest plants from this
 * script asks once and shows drafts only; she fixes a draft's words, kind,
 * beat and payoff, then Keep saves it as planted here; Drop discards it;
 * nothing is saved on its own; the refusal and the no-script state.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import EpisodePlantSuggest from './EpisodePlantSuggest';

const FOUND = {
  show_id: 'show-1', episode: { id: 'ep-1', title: 'The Archive', slot_number: 1 }, plant_slot_id: 'sl1',
  later_slots: [{ id: 'sl2', slot_number: 2 }, { id: 'sl6', slot_number: 6 }],
  drafts: [
    { title: 'Declan Ferris is @thriftveil', kind: 'twist', description: 'He copies her archive.', quote: 'logging in as @thriftveil', plant_beat: 3, plant_slot_id: 'sl1', payoff_slot_id: 'sl6' },
    { title: 'Studio by Sable wants her to model', kind: 'opportunity', description: null, quote: null, plant_beat: null, plant_slot_id: 'sl1', payoff_slot_id: null },
  ],
};
const ui = (props = {}) => render(<MemoryRouter><EpisodePlantSuggest episodeId="ep-1" hasScript {...props} /></MemoryRouter>);
const draftRows = () => screen.queryAllByTestId(/^script-plant-p-/);

beforeEach(() => { vi.clearAllMocks(); });

describe('EpisodePlantSuggest', () => {
  test('suggests drafts and saves nothing until Keep', async () => {
    api.post.mockResolvedValue({ data: FOUND });
    ui();
    fireEvent.click(screen.getByTestId('script-plants-suggest'));
    await waitFor(() => expect(draftRows()).toHaveLength(2));
    expect(api.post).toHaveBeenCalledWith('/api/v1/episodes/ep-1/season-plants/suggest');
    expect(api.put).not.toHaveBeenCalled();
    expect(screen.getByText('Suggested by AI. Nothing is saved until you keep it.')).toBeTruthy();
    expect(screen.getByText('“logging in as @thriftveil”')).toBeTruthy();
    expect(screen.getByTestId('script-plants-all').getAttribute('href')).toBe('/shows/show-1/season?tab=plants');
  });

  test('Keep saves her edits as a plant planted here; Drop discards one', async () => {
    const onSaved = vi.fn();
    api.post.mockResolvedValue({ data: FOUND });
    api.put.mockResolvedValue({ data: {} });
    ui({ onSaved });
    fireEvent.click(screen.getByTestId('script-plants-suggest'));
    await waitFor(() => expect(draftRows()).toHaveLength(2));
    const [first, second] = draftRows().map((el) => within(el));
    fireEvent.click(second.getByRole('button', { name: 'Drop Studio by Sable wants her to model' }));
    expect(draftRows()).toHaveLength(1);

    fireEvent.change(first.getByLabelText('The plant'), { target: { value: 'Declan is @thriftveil' } });
    fireEvent.change(first.getByLabelText('Kind'), { target: { value: 'mystery' } });
    fireEvent.change(first.getByLabelText('Beat'), { target: { value: '4' } });
    expect([...first.getByLabelText('Pays off in').options].map((o) => o.textContent)).toEqual(['Not chosen yet', 'Episode 2', 'Episode 6']);
    fireEvent.click(first.getByRole('button', { name: 'Keep Declan is @thriftveil' }));
    expect(await screen.findByText('Kept “Declan is @thriftveil” as a plant.')).toBeTruthy();
    expect(api.put).toHaveBeenCalledWith('/api/v1/world/show-1/season/twists', {
      title: 'Declan is @thriftveil', description: 'He copies her archive.', kind: 'mystery', plant_beat: 4,
      plant_slot_id: 'sl1', payoff_slot_id: 'sl6', status: 'planted', thread_ids: [], character_ids: [], note: '',
    });
    expect(draftRows()).toHaveLength(0);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  test('a refusal says so, and there is nothing to read without a script', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    api.post.mockRejectedValue({ response: { data: { error: 'This episode is not in the season yet.' } } });
    const { unmount } = ui();
    fireEvent.click(screen.getByTestId('script-plants-suggest'));
    expect(await screen.findByText('This episode is not in the season yet.')).toBeTruthy();
    unmount();
    ui({ hasScript: false });
    expect(screen.getByTestId('script-plants-suggest').disabled).toBe(true);
    expect(screen.getByText('Write the script first.')).toBeTruthy();
  });
});
