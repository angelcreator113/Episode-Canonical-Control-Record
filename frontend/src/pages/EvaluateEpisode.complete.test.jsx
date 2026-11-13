/**
 * The Evaluate page after Evoni's decisions of 2026-11-12:
 *   - it shows an estimate, labelled as one; the final result is worked out
 *     at completion;
 *   - no script tag is needed to estimate (the server needs none);
 *   - completing is the one shared operation (lib/episodeCompletion), for an
 *     admin, and lands on the episode's Results, where the stored result is;
 *   - a refused completion stays on screen until dismissed;
 *   - the override control and the "Admin Unlock" / unlocked re-evaluate
 *     controls are gone: neither ever changed a result. Overrides already
 *     recorded on an estimate are still shown, as not applied.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import api from '../services/api';
import AuthContext from '../contexts/AuthContext';
import EvaluateEpisode from './EvaluateEpisode';

const ADMIN = { user: { id: 'u1', groups: ['admin'] } };
const EDITOR = { user: { id: 'u2', groups: ['editor'] } };
const ESTIMATE = { score: 62, tier_final: 'pass', breakdown: {}, stat_deltas: {}, narrative_lines: { short: 'A good night.' } };
const refused = (status, data) => Object.assign(new Error('refused'), { response: { status, data } });

let episode;
function Where() { const l = useLocation(); return <span data-testid="where">{l.pathname}{l.search}</span>; }
const renderPage = (auth = ADMIN) => render(
  <AuthContext.Provider value={auth}>
    <MemoryRouter initialEntries={['/episodes/ep-1/evaluate']}>
      <Routes>
        <Route path="/episodes/:id/evaluate" element={<><EvaluateEpisode /><Where /></>} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  </AuthContext.Provider>,
);

beforeEach(() => {
  episode = { id: 'ep-1', show_id: 'show-1', title: 'Gala Night', script_content: 'INT. HALL. No tag in this script.', evaluation_status: null, evaluation_json: null };
  vi.mocked(api.get).mockReset().mockImplementation(async (url) => {
    if (url === '/api/v1/episodes/ep-1') return { data: { data: episode } };
    if (url.includes('/money')) return { data: { data: { warnings: [] } } };
    return { data: {} };
  });
  vi.mocked(api.post).mockReset().mockImplementation(async (url) => {
    if (url.endsWith('/evaluate')) return { data: { success: true, evaluation: ESTIMATE } };
    if (url.endsWith('/complete')) return { data: { success: true, data: { evaluation: { tier: 'safe', score: 55 } } } };
    return { data: {} };
  });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('an estimate, said as one', () => {
  test('a script with no [EVENT:] tag can be estimated: the button is on, and nothing tells her to add a tag', async () => {
    renderPage();
    const estimate = await screen.findByTestId('evaluate-estimate');
    expect(estimate.disabled).toBe(false);
    expect(document.body.textContent).not.toMatch(/Add an \[EVENT:/);
    expect(document.body.textContent).toContain('None (the linked event is used)');
    fireEvent.click(estimate);
    await waitFor(() => expect(vi.mocked(api.post).mock.calls[0][0]).toBe('/api/v1/episodes/ep-1/evaluate'));
  });

  test('the page says the figures are an estimate, decided at completion, and guarantee nothing', async () => {
    renderPage();
    const note = await screen.findByTestId('evaluate-estimate-note');
    expect(note.textContent).toMatch(/This page shows an estimate/);
    expect(note.textContent).toMatch(/worked out when the episode is completed/);
    expect(note.textContent).toMatch(/Nothing on this page is a guaranteed reward/);
  });

  test('an estimate can be recomputed before completion', async () => {
    episode = { ...episode, evaluation_status: 'computed', evaluation_json: ESTIMATE };
    renderPage();
    fireEvent.click(await screen.findByTestId('evaluate-recompute'));
    await waitFor(() => expect(vi.mocked(api.post).mock.calls[0][0]).toBe('/api/v1/episodes/ep-1/evaluate'));
  });
});

describe('controls that never changed a result are gone', () => {
  test('no override control, no Admin Unlock, no unlocked re-evaluate, on an estimate or on a completed episode', async () => {
    episode = { ...episode, evaluation_status: 'computed', evaluation_json: ESTIMATE };
    const first = renderPage();
    await screen.findByTestId('evaluate-recompute');
    for (const gone of [/Apply Override/, /Admin Unlock/, /Re-evaluate \(Unlocked\)/, /Accept Result/, /Accept & Apply Stats/]) expect(document.body.textContent).not.toMatch(gone);
    first.unmount();

    episode = { ...episode, evaluation_status: 'accepted', evaluation_json: { ...ESTIMATE, completed_at: '2026-11-12T00:00:00Z' } };
    renderPage();
    await screen.findByTestId('evaluate-view-result');
    for (const gone of [/Admin Unlock/, /Re-evaluate/, /Canon Locked/]) expect(document.body.textContent).not.toMatch(gone);
    expect(screen.queryByTestId('evaluate-complete')).toBeNull();
    expect(screen.queryByTestId('evaluate-estimate')).toBeNull();
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });

  test('an override already recorded on an estimate is still shown, as not applied at completion', async () => {
    episode = { ...episode, evaluation_status: 'computed', evaluation_json: { ...ESTIMATE, overrides: [{ type: 'tier_change', tier_from: 'safe', tier_to: 'pass', reason_code: 'HOUSE_FAVOR' }] } };
    renderPage();
    await screen.findByTestId('evaluate-recompute');
    expect(document.body.textContent).toContain('Overrides recorded on this estimate (not applied at completion)');
    expect(document.body.textContent).toContain('HOUSE FAVOR');
  });

  test('an overridden estimate tier is told apart from the final tier: what the estimate calculated, what the override shows, and that the server calculates the final one', async () => {
    episode = { ...episode, evaluation_status: 'computed', evaluation_json: { ...ESTIMATE, overrides: [{ type: 'tier_change', tier_from: 'safe', tier_to: 'pass', reason_code: 'HOUSE_FAVOR' }] } };
    renderPage();
    const note = await screen.findByTestId('evaluate-overridden-tier');
    expect(note.textContent).toBe('Overridden estimate tier. The estimate calculated SAFE; a recorded override shows PASS. Completion ignores overrides: the final tier is calculated by the server when the episode is completed.');
  });

  test('no such note on an estimate without a tier override, nor on a completed episode', async () => {
    episode = { ...episode, evaluation_status: 'computed', evaluation_json: { ...ESTIMATE, overrides: [{ type: 'style_adjust', reason_code: 'HOUSE_FAVOR' }] } };
    const first = renderPage();
    await screen.findByTestId('evaluate-recompute');
    expect(screen.queryByTestId('evaluate-overridden-tier')).toBeNull();
    first.unmount();
    episode = { ...episode, evaluation_status: 'accepted', evaluation_json: { ...ESTIMATE } };
    renderPage();
    await screen.findByText('A good night.');
    expect(screen.queryByTestId('evaluate-overridden-tier')).toBeNull();
  });
});

describe('completing from this page is the one shared operation', () => {
  test('it calls the authoritative completion endpoint by the episode\'s id, then goes to the episode\'s Results for the stored result', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('evaluate-complete'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/episodes/ep-1?tab=results'));
    expect(vi.mocked(api.post).mock.calls.map(([u]) => u)).toEqual(['/api/v1/world/show-1/episodes/ep-1/complete']);
    // The legacy accept route is not used, and no alert stands in for the result.
    expect(vi.mocked(api.post).mock.calls.some(([u]) => u.endsWith('/accept'))).toBe(false);
    expect(window.alert).not.toHaveBeenCalled();
  });

  test('a repeat that finds the episode already completed goes to Results too, with no error (no crash on a missing new_state)', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: { already_completed: true } } });
    renderPage();
    fireEvent.click(await screen.findByTestId('evaluate-complete'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/episodes/ep-1?tab=results'));
  });

  test('a refusal stays on screen in the server\'s words until dismissed, and she stays on the page', async () => {
    vi.mocked(api.post).mockRejectedValue(refused(409, { success: false, error: 'E3 is Part 1 of a two-parter: to be continued.', code: 'TWO_PART_TO_BE_CONTINUED' }));
    renderPage();
    fireEvent.click(await screen.findByTestId('evaluate-complete'));
    const alert = await screen.findByTestId('evaluate-refusal');
    expect(alert.textContent).toContain('This is Part 1 of a two-parter');
    expect(alert.textContent).toContain('E3 is Part 1 of a two-parter: to be continued.');
    expect(alert.textContent).toContain('Nothing was booked.');
    await new Promise((r) => setTimeout(r, 60));
    expect(screen.getByTestId('evaluate-refusal')).toBeTruthy();
    expect(screen.getByTestId('where').textContent).toBe('/episodes/ep-1/evaluate');
    fireEvent.click(screen.getByLabelText('Dismiss this message'));
    expect(screen.queryByTestId('evaluate-refusal')).toBeNull();
  });

  test('someone who is not an admin can estimate but is offered no Complete, and is told why', async () => {
    renderPage(EDITOR);
    await screen.findByTestId('evaluate-estimate');
    expect(screen.queryByTestId('evaluate-complete')).toBeNull();
    expect(screen.getByTestId('evaluate-estimate-note').textContent).toMatch(/Completing an episode needs an admin account/);
  });
});
