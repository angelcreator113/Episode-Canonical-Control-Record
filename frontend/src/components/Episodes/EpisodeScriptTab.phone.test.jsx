/**
 * Evoni, 2026-10-09 (Task #2797): "I have no way of the script knowing when
 * the actually phone will be on screen. Right now it only shows screens."
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';

const SCREENS = [{ id: 'closet', name: 'Closet', category: 'phone_screen', generated: true, url: 'https://x/closet.png' }];
const renderTab = (script) => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: script, script_locked_beats: [] }} show={{ id: 'show-1' }} /></MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/ui-overlays/show-1/frame') return { data: { success: true, frame_url: 'https://x/frame.png' } };
    if (url.startsWith('/api/v1/ui-overlays/show-1')) return { data: { data: SCREENS } };
    return { data: { data: [] } };
  });
  vi.mocked(api.put).mockImplementation(async (url, body) => ({ data: { data: { script_content: body.script_content } } }));
});

describe("Script tab: Lala's phone itself on screen", () => {
  test('"The phone itself" comes on screen, written as [UI:SHOW phone], shown with its frame', async () => {
    renderTab('## BEAT: 4 · Interruption Pulse 1\nLala: Mail!');
    fireEvent.click(screen.getByTestId('script-add-moment-4'));
    const picker = screen.getByTestId('script-moment-picker');
    await waitFor(() => expect(within(picker).getByTestId('script-pick-device-phone').querySelector('img')?.getAttribute('src')).toBe('https://x/frame.png'));
    fireEvent.click(within(picker).getByTestId('script-pick-device-phone'));
    expect(within(picker).getByRole('button', { name: 'Comes on screen' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(picker).queryByRole('button', { name: 'Opens' })).toBeNull();
    fireEvent.click(within(picker).getByTestId('script-moment-add'));
    fireEvent.click(within(picker).getByTestId('script-moment-done'));
    const card = within(screen.getByTestId('script-beat-4')).getByTestId('script-moment');
    expect(card.textContent).toContain("Lala's phone");
    expect(card.textContent).toContain('Comes on screen');
    fireEvent.click(within(screen.getByTestId('script-head')).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    expect(vi.mocked(api.put).mock.calls[0][1].script_content).toBe('## BEAT: 4 · Interruption Pulse 1\nLala: Mail!\n[UI:SHOW phone]');
  });

  test('the phone stays up into the next beat, builds its scene, and a screen with no phone is flagged', async () => {
    renderTab('## BEAT: 4 · Interruption Pulse 1\n[UI:OPEN closet]\n[UI:SHOW phone]\n\n## BEAT: 5 · Reveal\n[UI:OPEN closet]\n[UI:HIDE phone]\n\n## BEAT: 6 · Strategic Reaction\n[UI:OPEN closet]');
    // Beat 4: the closet opens before the phone is up.
    await waitFor(() => expect(within(screen.getByTestId('script-beat-4')).getAllByTestId('script-moment')[0].querySelector('.esp-moment-thumb img')).toBeTruthy());
    const beat4 = within(screen.getByTestId('script-beat-4')).getAllByTestId('script-moment');
    expect(within(beat4[0]).getByTestId('script-moment-phone-down')).toBeTruthy();
    expect(within(beat4[1]).queryByTestId('script-moment-phone-down')).toBeNull();

    // Beat 5: the phone carried in, so the closet is fine, and it builds the scene.
    fireEvent.click(screen.getByTestId('script-beat-5').querySelector('.esp-beat-head'));
    const beat5 = within(screen.getByTestId('script-beat-5')).getAllByTestId('script-moment');
    expect(within(beat5[0]).queryByTestId('script-moment-phone-down')).toBeNull();
    expect(beat5[0].textContent).toContain("With: Lala's phone");
    expect([...screen.getByTestId('script-build-5').querySelectorAll('.esp-build-item span')].map((n) => n.textContent)).toEqual(["Lala's phone", 'Closet']);
    expect(beat5[1].textContent).toContain('Goes away');

    // Beat 6: the phone went away in beat 5.
    fireEvent.click(screen.getByTestId('script-beat-6').querySelector('.esp-beat-head'));
    expect(within(screen.getByTestId('script-beat-6')).getByTestId('script-moment-phone-down')).toBeTruthy();
  });
});
