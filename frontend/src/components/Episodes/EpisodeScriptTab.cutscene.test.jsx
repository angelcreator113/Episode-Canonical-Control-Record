/**
 * No phone in the cutscene, beats 11–13 (Script page re-audit, 2026-10-19):
 * the bottom bar's Phone is off there and says why, the beat's Add chips
 * offer no phone moment, the pills mark no phone moment, and a
 * notification written there is flagged.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';

const SCRIPT = [
  '## BEAT: 4 · Interruption Pulse 1', '[UI:OPEN Mail]', 'Lala: "A message."',
  '## BEAT: 12 · Fashion Challenge', '[UI:OPEN Mail]', '[UI:NOTIFY @sable "Walk for us"]', 'Lala: "Me? Now?"',
].join('\n');
const SCREENS = [{ id: 'mail', name: 'Mail', category: 'phone_screen', generated: true, url: null }];

const renderTab = () => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT, script_locked_beats: [] }} show={{ id: 'show-1' }} /></MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/ui-overlays/show-1/frame') return { data: { success: true, frame_url: null } };
    if (url.startsWith('/api/v1/ui-overlays/show-1')) return { data: { data: SCREENS } };
    return { data: { data: [] } };
  });
});

describe('the cutscene has no phone', () => {
  test('Phone in the bottom bar is off in beat 12 and says why; on in beat 4', async () => {
    renderTab();
    const phone = screen.getByTestId('script-bar-phone');
    expect(phone.disabled).toBe(false);
    fireEvent.click(screen.getByTestId('script-pill-12'));
    expect(phone.disabled).toBe(true);
    expect(phone.getAttribute('title')).toBe('Beats 11–13 are the cutscene: no phone.');
  });

  test("beat 12's Add chips offer no phone moment, and say why", async () => {
    renderTab();
    fireEvent.click(screen.getByTestId('script-pill-12'));
    const chips = screen.getByTestId('script-add-chips-12');
    expect(within(chips).queryByTestId('script-add-moment-12')).toBeNull();
    expect(within(chips).queryByTestId('script-add-notify-12')).toBeNull();
    expect(within(chips).queryByTestId('script-add-post-12')).toBeNull();
    expect(within(chips).getByTestId('script-add-line-12')).toBeTruthy();
    // Beside the "+ Add line" button (Evoni, 2026-10-22 layout list).
    expect(screen.getByTestId('script-cutscene-note-12').textContent).toBe('Beats 11–13 are the cutscene: no phone.');
    fireEvent.click(screen.getByTestId('script-pill-4'));
    expect(within(screen.getByTestId('script-add-chips-4')).getByTestId('script-add-moment-4')).toBeTruthy();
  });

  test('the beat 12 pill marks no phone moment; beat 4 does', async () => {
    renderTab();
    const pills = screen.getByTestId('script-pills');
    await waitFor(() => expect(within(pills).getByTestId('script-pill-4').querySelector('svg')).toBeTruthy());
    expect(within(pills).getByTestId('script-pill-12').querySelector('svg')).toBeNull();
  });

  test('a notification in beat 12 is flagged as no phone', async () => {
    renderTab();
    fireEvent.click(screen.getByTestId('script-pill-12'));
    const beat = screen.getByTestId('script-beat-12');
    await waitFor(() => expect(within(beat).getAllByTestId('script-moment-phone-down').length).toBe(2));
    within(beat).getAllByTestId('script-moment-phone-down').forEach((n) => expect(n.textContent).toBe('Beats 11–13 are the cutscene: no phone.'));
  });
});
