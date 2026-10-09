/**
 * Evoni, 2026-10-09 (Task #2789): "when I'm writing my script I'm not able to
 * inject things from lala's phone … I would like to have a picture of the
 * scene … I also need to know when and which overlays will be showing on
 * screen." Each beat shows its scene, its phone moments and overlays, and
 * adds them from their pictures.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';

const SCRIPT = '## BEAT: 4 · Interruption Pulse 1\nLala: Mail!\n[UI:CLICK MailIcon]\n\n## BEAT: 5 · Reveal\nLala: An invite?\n[UI:DISPLAY InviteLetterOverlay]';

const PLAN = [
  { beat_number: 4, sceneSet: { name: "Lala's Bedroom" }, location: { image: { url: 'https://x/bedroom.png', label: "Lala's Bedroom · Bed" } } },
  { beat_number: 5, sceneSet: { name: "Lala's Bedroom" }, location: null },
];
const SCREENS = [
  { id: 'mail', name: 'Mail', category: 'phone_screen', generated: true, url: 'https://x/mail.png' },
  { id: 'closet', name: 'Closet', category: 'phone_screen', generated: true, url: 'https://x/closet.png' },
  { id: 'mail_icon_badge', name: 'Mail badge', category: 'phone_icon', url: 'https://x/badge.png' },
];
const OVERLAYS = { pieces: [
  { key: 'invitation', label: 'Invitation', image_url: 'https://x/invite.png' },
  { key: 'shopping_list_doc', label: 'Shopping list', image_url: 'https://x/list.png' },
] };

const renderTab = (locked = []) => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT, script_locked_beats: locked }} show={{ id: 'show-1' }} /></MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/episode-brief/ep-1/plan') return { data: { data: PLAN } };
    if (url.startsWith('/api/v1/ui-overlays/show-1')) return { data: { data: SCREENS } };
    if (url === '/api/v1/episodes/ep-1/overlays') return { data: { data: OVERLAYS } };
    return { data: { data: [] } };
  });
});

describe('Script tab: what is on screen in each beat', () => {
  test('a beat shows its scene picture, larger on a tap; a beat without one says so', async () => {
    renderTab();
    const pic = await screen.findByTestId('script-picture-4');
    expect(pic.querySelector('img').getAttribute('src')).toBe('https://x/bedroom.png');
    expect(pic.textContent).toContain("Lala's Bedroom · Bed");
    fireEvent.click(pic);
    expect(screen.getByTestId('script-picture-zoom').querySelector('img').getAttribute('src')).toBe('https://x/bedroom.png');
    fireEvent.click(screen.getByTestId('script-picture-zoom'));
    expect(screen.queryByTestId('script-picture-zoom')).toBeNull();

    fireEvent.click(screen.getByTestId('script-beat-5').querySelector('.esp-beat-head'));
    expect(screen.getByTestId('script-nopicture-5').textContent).toContain('No picture for this beat yet');
    expect(screen.getByTestId('script-expects-5').textContent).toContain("The invitation letter, opened · Lala's Phone → Full Screen");
  });

  test('UI lines read as moments with the screen or overlay they name', async () => {
    renderTab();
    await waitFor(() => expect(within(screen.getByTestId('script-beat-4')).getByTestId('script-moment').textContent).toContain('Taps Mail'));
    expect(within(screen.getByTestId('script-beat-4')).getByTestId('script-moment').querySelector('img').getAttribute('src')).toBe('https://x/mail.png');
    fireEvent.click(screen.getByTestId('script-beat-5').querySelector('.esp-beat-head'));
    const shown = within(screen.getByTestId('script-beat-5')).getByTestId('script-moment');
    expect(shown.textContent).toContain('On screen');
    expect(shown.textContent).toContain('Shows Invitation');
  });

  test('Phone / overlay adds the picked moment at the end of the beat, unsaved until Save', async () => {
    vi.mocked(api.put).mockImplementation(async (url, body) => ({ data: { data: { script_content: body.script_content } } }));
    renderTab();
    await screen.findByTestId('script-picture-4');
    fireEvent.click(screen.getByTestId('script-add-moment-4'));
    const picker = screen.getByTestId('script-moment-picker');
    await waitFor(() => expect(within(picker).getByTestId('script-pick-phone-closet')).toBeTruthy());
    // Icons are not screens.
    expect(within(picker).queryByTestId('script-pick-phone-mail_icon_badge')).toBeNull();
    fireEvent.click(within(picker).getByTestId('script-pick-phone-closet'));
    fireEvent.click(within(picker).getByRole('button', { name: 'Scrolls' }));
    fireEvent.click(within(picker).getByTestId('script-moment-add'));
    expect(screen.queryByTestId('script-moment-picker')).toBeNull();
    const moments = within(screen.getByTestId('script-beat-4')).getAllByTestId('script-moment');
    expect(moments[moments.length - 1].textContent).toContain('Scrolls Closet');
    expect(screen.getByTestId('script-dirty')).toBeTruthy();

    fireEvent.click(within(screen.getByTestId('script-head')).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    expect(vi.mocked(api.put).mock.calls[0][1].script_content).toBe(
      '## BEAT: 4 · Interruption Pulse 1\nLala: Mail!\n[UI:CLICK MailIcon]\n[UI:SCROLL closet]\n\n## BEAT: 5 · Reveal\nLala: An invite?\n[UI:DISPLAY InviteLetterOverlay]',
    );
  });

  test('an overlay is added as shown on screen', async () => {
    renderTab();
    await screen.findByTestId('script-picture-4');
    fireEvent.click(screen.getByTestId('script-add-moment-4'));
    const picker = screen.getByTestId('script-moment-picker');
    await waitFor(() => expect(within(picker).getByTestId('script-pick-overlay-shopping_list_doc')).toBeTruthy());
    fireEvent.click(within(picker).getByTestId('script-pick-overlay-shopping_list_doc'));
    expect(within(picker).queryByRole('button', { name: 'Opens' })).toBeNull();
    fireEvent.click(within(picker).getByTestId('script-moment-add'));
    const moments = within(screen.getByTestId('script-beat-4')).getAllByTestId('script-moment');
    expect(moments[moments.length - 1].textContent).toContain('Shows Shopping list');
  });

  test('a locked beat adds nothing', async () => {
    renderTab([4]);
    await screen.findByTestId('script-picture-4');
    expect(screen.queryByTestId('script-add-moment-4')).toBeNull();
  });
});
