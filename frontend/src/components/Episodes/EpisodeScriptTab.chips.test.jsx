/**
 * The Script tab's "Add:" chips, "This episode must cover" and the phone
 * check (Evoni's mockup; Task #2884). Every value is the episode's own.
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
  '## BEAT: 4 · Interruption Pulse 1', '[UI:CLICK Reply]', 'Lala: "A message."',
  '## BEAT: 12 · Deliverable Creation', '(Lala films the Instagram reel for the brand.)',
].join('\n');
const SCREENS = [
  { id: 'home', name: 'Home', category: 'phone_screen', is_home: true, screen_links: [{ label: 'Mail', target: 'mail' }] },
  { id: 'mail', name: 'Mail', category: 'phone_screen', screen_links: [{ label: 'Reply', target: 'reply' }] },
  { id: 'feed', name: 'Feed', category: 'phone_screen' },
];
const EVENT = { id: 'ev-1', show_id: 'show-1', name: 'Wearable Experiments Studio Session', canon_consequences: { automation: { relationship_goals: [{ label: 'Follow up with STUDIO BY SABLE' }] } } };

let deliverables;
let brief;
const renderTab = (script = SCRIPT) => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: script, script_locked_beats: [] }} show={{ id: 'show-1' }} /></MemoryRouter>,
);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  Element.prototype.scrollIntoView = vi.fn();
  deliverables = [{ id: 'd1', description: 'Instagram reel for the brand' }];
  brief = { event_id: 'ev-1', forward_hook: 'A second invitation arrives.' };
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/episode-brief/ep-1') return { data: { data: brief } };
    if (url === '/api/v1/world/show-1/events/ev-1') return { data: { event: EVENT } };
    if (url === '/api/v1/world/show-1/events/ev-1/deliverables') return { data: { deliverables } };
    if (url === '/api/v1/ui-overlays/show-1/frame') return { data: { frame_url: null } };
    if (url.startsWith('/api/v1/ui-overlays/show-1')) return { data: { data: SCREENS } };
    return { data: { data: [] } };
  });
  vi.mocked(api.put).mockImplementation(async (url, body) => ({ data: { data: { script_content: body.script_content } } }));
});

describe('Script tab: Add chips, must cover, phone check', () => {
  test('"Add:" has Action, Dialogue, Open a screen, Scroll the feed, Notification, DM and Post', () => {
    renderTab();
    const chips = screen.getByTestId('script-add-chips-4');
    expect([...chips.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Action', 'Dialogue', 'Open a screen', 'Scroll the feed', 'Notification', 'DM', 'Post']);
  });

  test('Action opens the line adder on Action, and writes an action line', async () => {
    renderTab();
    fireEvent.click(screen.getByTestId('script-add-action-4'));
    const adder = within(screen.getByTestId('script-beat-4')).getByTestId('script-line-adder');
    expect(within(adder).getByRole('button', { name: 'Action' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(within(adder).getByTestId('script-line-adder-text'), { target: { value: 'She checks the time' } });
    fireEvent.click(within(adder).getByTestId('script-line-adder-add'));
    fireEvent.click(within(screen.getByTestId('script-head')).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    expect(vi.mocked(api.put).mock.calls[0][1].script_content).toContain('Lala: "A message."\n(She checks the time)');
  });

  test('Dialogue opens it on Lala', () => {
    renderTab();
    fireEvent.click(screen.getByTestId('script-add-line-4'));
    const adder = screen.getByTestId('script-line-adder');
    expect(within(adder).getByRole('button', { name: 'Lala' }).getAttribute('aria-pressed')).toBe('true');
  });

  test('Scroll the feed opens the picker on the Feed screen with Scrolls chosen', async () => {
    renderTab();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/ui-overlays/show-1?episode_id=ep-1'));
    await waitFor(() => expect(screen.getByTestId('script-phone-check')).toBeTruthy());
    fireEvent.click(screen.getByTestId('script-add-scroll-4'));
    const picker = screen.getByTestId('script-moment-picker');
    expect(picker.textContent).toContain('Scroll the feed');
    expect(within(picker).getByRole('button', { name: 'Scrolls' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(picker).getByTestId('script-moment-add').textContent).toContain('Scrolls Feed');
  });

  test("must cover: the event's deliverables and goals and the brief's hook, ticked when the script mentions them", async () => {
    renderTab();
    await waitFor(() => expect(screen.getByTestId('script-cover-deliverable-d1').dataset.covered).toBe('true'));
    expect(screen.getByTestId('script-cover-deliverable-d1').textContent).toContain('Beat 12');
    expect(screen.getByTestId('script-cover-goal-0').dataset.covered).toBe('false');
    expect(screen.getByTestId('script-cover-hook').textContent).toContain('A second invitation arrives.');
    expect(screen.getByTestId('script-cover').textContent).toContain('From the event package and the brief');
  });

  test('must cover with nothing in the data says so', async () => {
    deliverables = [];
    brief = { event_id: null };
    renderTab();
    expect((await screen.findByTestId('script-cover-empty')).textContent).toMatch(/Nothing to cover/);
  });

  test("the phone check flags a tap on an icon that is not on the screen showing", async () => {
    renderTab();
    const card = await screen.findByTestId('script-phone-check');
    expect(card.textContent).toContain('Phone check · Beat 4');
    await waitFor(() => expect(within(card).getByTestId('script-phone-check-tap').dataset.ok).toBe('false'));
    expect(within(card).getByTestId('script-phone-check-tap').textContent).toBe('Reply is on Mail, but the phone shows Home');
    fireEvent.click(screen.getByTestId('script-nav-12'));
    expect(screen.getByTestId('script-phone-check').textContent).toContain('No phone or overlay moments in this beat.');
  });
});
