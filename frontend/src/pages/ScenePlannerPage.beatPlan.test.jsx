/**
 * L11 (Evoni, 2026-10-02, docs/EVENT_EPISODE_FLOW.md §8(hh)): "In the Scene
 * Planner, any beat can use any scene set in the show's library. The beat
 * editor lists all the show's sets (searchable, with thumbnails and their
 * angles, like the Place picker); choosing a set not yet linked to the
 * episode adds it to the episode's locations ... A beat whose set or angle
 * Evoni chose is marked 'Chosen by you' ... The planner is renamed 'Beat
 * Plan' and shows the episode's locations at its top, each linking to its
 * set in Scene Sets."
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import api from '../services/api';
import ScenePlannerPage from './ScenePlannerPage';

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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/episodes/ep-1/plan']}>
      <Routes><Route path="/episodes/:episodeId/plan" element={<ScenePlannerPage />} /></Routes>
    </MemoryRouter>
  );
}

describe('ScenePlannerPage: the Beat Plan (L11)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episode-brief/ep-1') return { data: { data: { status: 'draft' } } };
      if (url === '/api/v1/episode-brief/ep-1/plan') return { data: { data: PLAN } };
      if (url === '/api/v1/episodes/ep-1/locations') return { data: { success: true, data: LOCATIONS } };
      if (url.startsWith('/api/v1/scene-sets?show_id=show-1')) return { data: { data: LIBRARY } };
      return { data: {} };
    });
    vi.mocked(api.put).mockResolvedValue({ data: { data: {} } });
  });

  test('is called the Beat Plan and shows the episode\'s locations, each linking to its set in Scene Sets', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Beat Plan' })).toBeTruthy();
    const strip = await screen.findByTestId('beat-plan-locations');
    const links = within(strip).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Home: Lala apartment', 'Car: Town car']);
    expect(links[0].getAttribute('href')).toBe('/shows/show-1/world?tab=scene-sets&set=set-home');
    expect(links[1].getAttribute('href')).toBe('/shows/show-1/world?tab=scene-sets&set=set-car');
  });

  test('a beat Evoni chose is marked "Chosen by you"; the others are not', async () => {
    renderPage();
    await screen.findAllByRole('button', { name: 'Edit' });
    expect(screen.getAllByTestId(/^beat-chosen-/).map((el) => el.dataset.testid)).toEqual(['beat-chosen-1']);
    expect(screen.getByTestId('beat-chosen-1').textContent).toBe('Chosen by you');
  });

  test('the editor lists the show\'s whole library, searchable, with thumbnails and angles; another show\'s sets are left out', async () => {
    renderPage();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[1]);
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
    renderPage();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[1]);
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
    expect(await screen.findByText('Beat 2 saved; “Corner café” joined the episode\'s locations as an extra')).toBeTruthy();
  });

  test('an edit that leaves the set and angle as they were does not mark the beat', async () => {
    renderPage();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[1]);
    const editor = await screen.findByTestId('beat-editor');
    fireEvent.change(within(editor).getByLabelText('Emotional intent'), { target: { value: 'Quiet' } });
    fireEvent.click(within(editor).getByText('Save'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/plan/2', {
      scene_set_id: 'set-home', angle_label: 'CLOSE', shot_type: null, emotional_intent: 'Quiet',
    }));
  });

  test('"Let the plan choose again" hands a chosen beat back to the plan', async () => {
    renderPage();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
    const editor = await screen.findByTestId('beat-editor');
    fireEvent.click(within(editor).getByRole('button', { name: 'Let the plan choose again' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/plan/1', { chosen: false }));
  });
});
