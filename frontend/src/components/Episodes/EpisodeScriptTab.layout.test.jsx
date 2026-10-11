/**
 * The Script tab's layout (Evoni's mockup; Task #2881): the beat list with
 * the beats this script has and a phone on each beat with a phone moment;
 * "BEAT n Name"; at phone width the pills, the context chips from the
 * episode's own data and the bottom bar; "Saved" in the top line.
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
  '## BEAT: 1 · Opening Ritual', 'Prime: "Hi."',
  '## BEAT: 4 · Interruption Pulse 1', '[UI:OPEN Mail]', 'Lala: "A message."',
  '## BEAT: 11 · Event Outcome', 'Prime: "We made it."', 'Lala: "We did."',
].join('\n');
const SCREENS = [{ id: 'mail', name: 'Mail', category: 'phone_screen', generated: true, url: null }];

const renderTab = (script = SCRIPT) => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: script, script_locked_beats: [] }} show={{ id: 'show-1' }} /></MemoryRouter>,
);

let balance;
let outfit;
beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  balance = 420;
  outfit = [];
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/world/show-1/balance?episode_id=ep-1') return { data: { success: true, balance: 999, balance_before_episode: balance } };
    if (url === '/api/v1/wardrobe/outfit/ep-1') return { data: { items: outfit } };
    if (url === '/api/v1/episode-brief/ep-1/plan') return { data: { data: [{ beat_number: 11, sceneSet: { name: "STUDIO BY SABLE's Studio" } }] } };
    if (url === '/api/v1/ui-overlays/show-1/frame') return { data: { success: true, frame_url: null } };
    if (url.startsWith('/api/v1/ui-overlays/show-1')) return { data: { data: SCREENS } };
    return { data: { data: [] } };
  });
});

describe('Script tab layout', () => {
  test('the beat list: the beats the script has, a phone where a beat has a phone moment, and the legend', async () => {
    renderTab();
    const list = await screen.findByTestId('script-beatlist');
    expect([...list.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['1Opening Ritual', '4Interruption Pulse 1', '11Event Outcome']);
    await waitFor(() => expect(within(list).getByTestId('script-nav-phone-4')).toBeTruthy());
    expect(within(list).queryByTestId('script-nav-phone-1')).toBeNull();
    expect(within(list).queryByTestId('script-nav-phone-11')).toBeNull();
    expect(list.textContent).toContain('= has a phone moment');
  });

  test('choosing a beat in the list opens it; the heading reads BEAT n Name', async () => {
    renderTab();
    expect(screen.getByTestId('script-beat-1').className).toContain('is-open');
    fireEvent.click(screen.getByTestId('script-nav-11'));
    expect(screen.getByTestId('script-beat-11').className).toContain('is-open');
    expect(screen.getByTestId('script-beat-1').className).not.toContain('is-open');
    expect(screen.getByTestId('script-nav-11').getAttribute('aria-current')).toBe('true');
    expect(screen.getByTestId('script-beat-label-11').textContent).toBe('Beat 11');
    expect(screen.getByTestId('script-beat-11').querySelector('.esp-beat-name').textContent).toBe('Event Outcome');
  });

  test('the pills open a beat too, and mark the phone moments', async () => {
    renderTab();
    const pills = screen.getByTestId('script-pills');
    await waitFor(() => expect(within(screen.getByTestId('script-pill-4')).getByLabelText('Has a phone moment')).toBeTruthy());
    expect([...pills.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['1 · Opening Ritual', '4 · Interruption Pulse 1', '11 · Event Outcome']);
    fireEvent.click(screen.getByTestId('script-pill-4'));
    expect(screen.getByTestId('script-beat-4').className).toContain('is-open');
  });

  test("the chips are the episode's own: coins, the look, the open beat's scene set and who speaks in it", async () => {
    renderTab();
    await waitFor(() => expect(screen.getByTestId('script-chip-coins').textContent).toBe('Lala has 420 coins'));
    expect(screen.getByTestId('script-chip-look').textContent).toBe('Not dressed yet');
    expect(screen.getByTestId('script-chip-scene').textContent).toBe('No scene set');
    expect(screen.getByTestId('script-chip-room').textContent).toBe('Prime');
    fireEvent.click(screen.getByTestId('script-pill-11'));
    await waitFor(() => expect(screen.getByTestId('script-chip-scene').textContent).toBe("STUDIO BY SABLE's Studio"));
    expect(screen.getByTestId('script-chip-room').textContent).toBe('Prime, Lala');
  });

  test('chips say so when a value is missing or could not be read', async () => {
    balance = null;
    outfit = [{ id: 'w1', name: 'Crimson Satin Ballerina Pump' }, { id: 'w2', name: 'Crimson Bloom Enamel Stud Earrings' }];
    renderTab('## BEAT: 2 · Login Sequence\n[UI:OPEN Mail]');
    await waitFor(() => expect(screen.getByTestId('script-chip-look').textContent).toBe('Dressed · 2 pieces'));
    expect(screen.getByTestId('script-chip-coins').textContent).toBe('Coins not read');
    expect(screen.getByTestId('script-chip-room').textContent).toBe('No one speaks yet');
  });

  test('True at Beat N: coins from the balance before the episode and the script, the look from the closet beat', async () => {
    outfit = [{ id: 'w1', name: 'Crimson Satin Ballerina Pump' }];
    renderTab(['## BEAT: 1 · Opening Ritual', 'Prime: "Hi."', '[STAT: coins +50]', '## BEAT: 8 · Transformation Loop', '[UI:OPEN Closet]', '## BEAT: 11 · Event Outcome', 'Lala: "We did."', '[STAT: coins -120]'].join('\n'));
    const card = await screen.findByTestId('script-beat-state');
    expect(card.textContent).toContain('True at Beat 1');
    await waitFor(() => expect(within(card).getByTestId('script-truth-coins').textContent).toContain('470 coins'));
    expect(within(card).getByTestId('script-truth-coins').textContent).toContain('420 before the episode, +50 in the script so far');
    await waitFor(() => expect(within(card).getByTestId('script-truth-wearing').textContent.trim()).toBe('WearingGetting dressed at Beat 8'));
    expect(screen.getByTestId('script-chip-look').textContent).toBe('Getting dressed at Beat 8');
    expect(within(card).getByTestId('script-truth-room').textContent.trim()).toBe('In the roomSpeaking: Prime');
    expect(within(card).getByTestId('script-truth-time').textContent.trim()).toBe('Story timeStory time not set');
    fireEvent.click(screen.getByTestId('script-pill-11'));
    await waitFor(() => expect(within(screen.getByTestId('script-beat-state')).getByTestId('script-truth-coins').textContent).toContain('350 coins'));
    expect(screen.getByTestId('script-chip-coins').textContent).toBe('Lala has 350 coins');
    expect(within(screen.getByTestId('script-beat-state')).getByTestId('script-truth-wearing').textContent.trim()).toBe('Wearing1 piece: Crimson Satin Ballerina Pump');
    expect(within(screen.getByTestId('script-beat-state')).getByTestId('script-truth-where').textContent.trim()).toBe("WhereSTUDIO BY SABLE's Studio");
    expect(screen.getByTestId('script-beat-state').textContent).not.toMatch(/stress/i);
  });

  test('the bottom bar opens the line adder or the phone picker in the open beat, and the context panel', async () => {
    renderTab();
    fireEvent.click(screen.getByTestId('script-bar-line'));
    expect(within(screen.getByTestId('script-beat-1')).getByTestId('script-line-adder')).toBeTruthy();
    fireEvent.click(screen.getByTestId('script-bar-phone'));
    expect(within(screen.getByTestId('script-beat-1')).getByTestId('script-moment-picker')).toBeTruthy();
    // Another beat does not inherit the request.
    fireEvent.click(screen.getByTestId('script-nav-11'));
    expect(within(screen.getByTestId('script-beat-11')).queryByTestId('script-moment-picker')).toBeNull();
    fireEvent.click(screen.getByTestId('script-bar-context'));
    expect(screen.getByTestId('script-bar-context').getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByTestId('script-context-close'));
    expect(screen.getByTestId('script-bar-context').getAttribute('aria-expanded')).toBe('false');
  });

  test('Saved in the top line, Unsaved changes after an edit', async () => {
    renderTab();
    expect(screen.getByTestId('script-saved').textContent).toContain('Saved');
    fireEvent.click(screen.getByTestId('script-bar-line'));
    expect(screen.queryByTestId('script-dirty')).toBeNull();
  });

  test('no script: no beat list, pills or bar', () => {
    renderTab('');
    expect(screen.queryByTestId('script-beatlist')).toBeNull();
    expect(screen.queryByTestId('script-pills')).toBeNull();
    expect(screen.queryByTestId('script-mobilebar')).toBeNull();
  });
});
