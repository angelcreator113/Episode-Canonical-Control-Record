/**
 * B2 (Evoni, 2026-10-02): the scene planner's Edit buttons did nothing. Edit
 * opens a beat editor that saves through PUT /episode-brief/:id/plan/:beat;
 * a locked beat's Edit is disabled.
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
  { id: 'p3', beat_number: 3, beat_name: 'Welcome', scene_set_id: 'set-venue', angle_label: 'WIDE', locked: true, sceneSet: { id: 'set-venue', name: 'The Glasshouse' } },
  { id: 'p4', beat_number: 4, beat_name: 'Interruption Pulse 1', scene_set_id: 'set-home', angle_label: 'CLOSE', shot_type: 'medium', locked: false, sceneSet: { id: 'set-home', name: 'Lala apartment' } },
];
const SETS = [
  { id: 'set-home', name: 'Lala apartment', angles: [{ angle_label: 'CLOSE' }, { angle_label: 'VANITY' }] },
  { id: 'set-venue', name: 'The Glasshouse', angles: [{ angle_label: 'WIDE' }, { angle_label: 'DOORWAY' }] },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/episodes/ep-1/plan']}>
      <Routes><Route path="/episodes/:episodeId/plan" element={<ScenePlannerPage />} /></Routes>
    </MemoryRouter>
  );
}

describe('ScenePlannerPage: editing a beat (B2)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/episode-brief/ep-1') return { data: { data: { status: 'draft' } } };
      if (url === '/api/v1/episode-brief/ep-1/plan') return { data: { data: PLAN } };
      if (url === '/api/v1/episodes/ep-1/scene-sets') return { data: { data: SETS } };
      return { data: {} };
    });
    vi.mocked(api.put).mockResolvedValue({ data: { data: {} } });
  });

  test('Edit opens the beat\'s editor and saves its set, angle, shot and intent', async () => {
    renderPage();
    const editButtons = await screen.findAllByRole('button', { name: 'Edit' });
    expect(editButtons[0].disabled).toBe(true); // beat 3 is locked
    fireEvent.click(editButtons[1]);

    const editor = await screen.findByTestId('beat-editor');
    expect(within(editor).getByText('Edit beat 4: Interruption Pulse 1')).toBeTruthy();
    await waitFor(() => expect(within(editor).getByRole('option', { name: 'The Glasshouse' })).toBeTruthy());
    fireEvent.change(within(editor).getByLabelText('Scene set'), { target: { value: 'set-venue' } });
    fireEvent.change(within(editor).getByLabelText('Angle'), { target: { value: 'DOORWAY' } });
    fireEvent.change(within(editor).getByLabelText('Shot'), { target: { value: 'establishing' } });
    fireEvent.change(within(editor).getByLabelText('Emotional intent'), { target: { value: 'She hesitates at the door' } });
    fireEvent.click(within(editor).getByText('Save'));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/plan/4', {
      scene_set_id: 'set-venue', angle_label: 'DOORWAY', shot_type: 'establishing', emotional_intent: 'She hesitates at the door',
    }));
    await waitFor(() => expect(screen.queryByTestId('beat-editor')).toBeNull());
  });
});
