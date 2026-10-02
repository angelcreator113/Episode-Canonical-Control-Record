/**
 * The beat editor (L11, Evoni 2026-10-02, docs/EVENT_EPISODE_FLOW.md §8(hh)):
 * the show's whole library, "Chosen by you", "Let the plan choose again".
 * Since S9 (d) ("the Beat Plan page keeps re-planning only, and every
 * per-beat change happens in Scenes"), it opens from the Scenes tab's
 * "Change background"; these tests moved here from the Beat Plan's.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScenesTab from './EpisodeScenesTab';

const PLAN = [
  { id: 'p1', beat_number: 1, beat_name: 'Opening Ritual', scene_set_id: 'set-home', angle_label: 'WIDE', locked: false, chosen_by_user: true, sceneSet: { id: 'set-home', name: 'Lala apartment' } },
  { id: 'p2', beat_number: 2, beat_name: 'Login Sequence', scene_set_id: 'set-home', angle_label: 'CLOSE', locked: false, chosen_by_user: false, sceneSet: { id: 'set-home', name: 'Lala apartment' } },
];
const LOCATIONS = {
  show_id: 'show-1',
  editable: true,
  locations: [
    { role: 'home', scene_set_id: 'set-home', name: null, scene_set: { id: 'set-home', name: 'Lala apartment' } },
    { role: 'extra', scene_set_id: 'set-car', name: 'Car', scene_set: { id: 'set-car', name: 'Town car' } },
  ],
};
const LIBRARY = [
  { id: 'set-home', show_id: 'show-1', name: 'Lala apartment', scene_type: 'HOME_BASE', base_still_url: 'https://x/home.jpg', angles: [{ id: 'a1', angle_label: 'WIDE', angle_name: 'Wide', still_image_url: 'https://x/wide.jpg' }] },
  { id: 'set-cafe', show_id: 'show-1', name: 'Corner café', scene_type: 'OTHER', base_still_url: null, angles: [
    { id: 'c1', angle_label: 'BOOTH', angle_name: 'Booth', still_image_url: 'https://x/booth.jpg', sort_order: 1 },
    { id: 'c2', angle_label: 'COUNTER', angle_name: 'Counter', still_image_url: null, sort_order: 0 },
  ] },
  { id: 'set-shared', show_id: null, name: 'Rooftop', scene_type: 'OTHER', base_still_url: 'https://x/roof.jpg', angles: [] },
  { id: 'set-foreign', show_id: 'show-2', name: 'Other show loft', scene_type: 'HOME_BASE', angles: [] },
];

function renderTab() {
  const onToast = vi.fn();
  render(
    <MemoryRouter>
      <EpisodeScenesTab episode={{ id: 'ep-1', show_id: 'show-1' }} onToast={onToast} />
    </MemoryRouter>
  );
  return onToast;
}

describe('The beat editor, from the Scenes tab (L11; S9 d)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episode-brief/ep-1/plan') return { data: { data: PLAN } };
      if (url === '/api/v1/episodes/ep-1/locations') return { data: { success: true, data: LOCATIONS } };
      if (url === '/api/v1/episodes/ep-1/scenes') return { data: { success: true, data: [] } };
      if (url.startsWith('/api/v1/scene-sets?show_id=show-1')) return { data: { data: LIBRARY } };
      return { data: {} };
    });
    vi.mocked(api.put).mockResolvedValue({ data: { data: {} } });
  });

  test('the editor lists the show\'s whole library, searchable, with thumbnails and angles; another show\'s sets are left out', async () => {
    const onToast = renderTab();
    fireEvent.click(await screen.findByRole('button', { name: 'Change background for beat 2' }));
    const editor = await screen.findByTestId('beat-editor');
    await within(editor).findByTestId('beat-set-option-set-cafe');
    const names = within(editor).getAllByTestId(/^beat-set-option-/).map((el) => el.dataset.testid.replace('beat-set-option-', ''));
    expect(names).toEqual(['set-home', 'set-cafe', 'set-shared']);
    expect(within(editor).getByTestId('beat-set-option-set-home').textContent).toContain('In this episode');
    expect(within(editor).getByTestId('beat-set-option-set-cafe').querySelector('img').getAttribute('src')).toBe('https://x/booth.jpg');

    fireEvent.change(within(editor).getByLabelText('Search scene sets'), { target: { value: 'roof' } });
    expect(within(editor).getAllByTestId(/^beat-set-option-/).map((el) => el.dataset.testid)).toEqual(['beat-set-option-set-shared']);
  });

  test('choosing a set from the library and one of its angles saves them as chosen; a set joining the episode is said so', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { data: {}, location: { added: true, role: 'extra', name: 'Corner café' } } });
    const onToast = renderTab();
    fireEvent.click(await screen.findByRole('button', { name: 'Change background for beat 2' }));
    const editor = await screen.findByTestId('beat-editor');
    fireEvent.click(await within(editor).findByTestId('beat-set-option-set-cafe'));
    expect(within(editor).getByTestId('beat-editor-adds').textContent).toMatch(/Not in this episode yet/);
    const angles = within(editor).getAllByTestId(/^beat-angle-/);
    expect(angles.map((el) => el.querySelector('.beat-editor-angle-name').textContent)).toEqual(['Counter', 'Booth']);
    expect(angles[0].textContent).toContain('No image');
    fireEvent.click(within(editor).getByTestId('beat-angle-c1'));
    expect(within(editor).getByLabelText('Angle').value).toBe('BOOTH');
    fireEvent.click(within(editor).getByText('Save'));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/plan/2', {
      scene_set_id: 'set-cafe', angle_label: 'BOOTH', shot_type: null, emotional_intent: null, chosen: true,
    }));
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Beat 2 saved; “Corner café” joined the episode\'s locations as an extra', expect.anything()));
  });

  test('an edit that leaves the set and angle as they were does not mark the beat', async () => {
    const onToast = renderTab();
    fireEvent.click(await screen.findByRole('button', { name: 'Change background for beat 2' }));
    const editor = await screen.findByTestId('beat-editor');
    fireEvent.change(within(editor).getByLabelText('Emotional intent'), { target: { value: 'Quiet' } });
    fireEvent.click(within(editor).getByText('Save'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/plan/2', {
      scene_set_id: 'set-home', angle_label: 'CLOSE', shot_type: null, emotional_intent: 'Quiet',
    }));
  });

  test('"Let the plan choose again" hands a chosen beat back to the plan', async () => {
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: 'Change background for beat 1' }));
    const editor = await screen.findByTestId('beat-editor');
    fireEvent.click(within(editor).getByRole('button', { name: 'Let the plan choose again' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/plan/1', { chosen: false }));
  });
});
