/**
 * Notification, DM and Post chips in the Script tab (Task #2885): each writes
 * its line; a saved Post line drafts Lala's post and its card says so.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';

const SCRIPT = ['## BEAT: 4 · Interruption Pulse 1', 'Marcus: "Did you see it?"', '## BEAT: 12 · Deliverable Creation', 'Lala: "Okay."'].join('\n');
const EVENT = { id: 'ev-1', show_id: 'show-1', name: 'Studio Session', host_brand: 'STUDIO BY SABLE', canon_consequences: { automation: { guest_profiles: [{ display_name: 'Nia', featured: true }] } } };
const DRAFTS = '/api/v1/feed-posts/episodes/ep-1/script-drafts';

let drafts;
const renderTab = (script = SCRIPT) => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: script, script_locked_beats: [] }} show={{ id: 'show-1' }} /></MemoryRouter>,
);
const save = () => fireEvent.click(within(screen.getByTestId('script-head')).getByRole('button', { name: 'Save' }));

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  Element.prototype.scrollIntoView = vi.fn();
  drafts = [];
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/episode-brief/ep-1') return { data: { data: { event_id: 'ev-1' } } };
    if (url === '/api/v1/world/show-1/events/ev-1') return { data: { event: EVENT } };
    if (url === DRAFTS) return { data: { data: drafts } };
    return { data: { data: [] } };
  });
  vi.mocked(api.put).mockImplementation(async (url, body) => ({ data: { data: { script_content: body.script_content } } }));
  vi.mocked(api.post).mockImplementation(async (url) => {
    if (url === DRAFTS) return { data: { data: [{ beat: 4, text: 'Studio night, statement look.', post_id: 'p1', status: 'draft', created: true }] } };
    return { data: {} };
  });
});

describe('Script tab: Notification, DM and Post', () => {
  test('"Add:" has Notification, DM and Post', () => {
    renderTab();
    const chips = [...screen.getByTestId('script-add-chips-4').querySelectorAll('button')].map((b) => b.textContent);
    expect(chips).toEqual(expect.arrayContaining(['Notification', 'DM', 'Post']));
  });

  test("a DM offers the episode's own people and writes its line", async () => {
    renderTab();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/world/show-1/events/ev-1'));
    fireEvent.click(screen.getByTestId('script-add-dm-4'));
    const adder = screen.getByTestId('script-message-adder-dm');
    await waitFor(() => expect([...adder.querySelectorAll('datalist option')].map((o) => o.value)).toEqual(['STUDIO BY SABLE', 'Nia', 'Marcus']));
    expect(within(adder).getByTestId('script-message-add').disabled).toBe(true);
    fireEvent.change(within(adder).getByTestId('script-message-who'), { target: { value: 'Nia' } });
    fireEvent.change(within(adder).getByTestId('script-message-text'), { target: { value: 'See you there' } });
    fireEvent.click(within(adder).getByTestId('script-message-add'));
    expect(within(screen.getByTestId('script-beat-4')).getAllByTestId('script-moment').map((m) => m.textContent)).toEqual([expect.stringContaining('DM with Nia“See you there”')]);
  });

  test('a Post is pending until saved; saving drafts it and the card says so', async () => {
    renderTab();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(DRAFTS));
    fireEvent.click(screen.getByTestId('script-add-post-4'));
    const adder = screen.getByTestId('script-message-adder-post');
    expect(within(adder).queryByTestId('script-message-who')).toBeNull();
    fireEvent.change(within(adder).getByTestId('script-message-text'), { target: { value: 'Studio night, statement look.' } });
    fireEvent.click(within(adder).getByTestId('script-message-add'));
    expect(screen.getByTestId('script-post-pending')).toBeTruthy();
    expect(api.post).not.toHaveBeenCalledWith(DRAFTS);

    save();
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    expect(vi.mocked(api.put).mock.calls[0][1].script_content).toContain('Marcus: "Did you see it?"\n[UI:POST Studio night, statement look.]');
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(DRAFTS));
    expect((await screen.findByTestId('script-post-drafted')).textContent).toBe('✓ Draft in Lala’s Feed, waiting for approval');
  });

  test('saving a script with no Post line drafts nothing', async () => {
    renderTab();
    save();
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    expect(api.post).not.toHaveBeenCalledWith(DRAFTS);
  });

  test('an approved Post reads as live', async () => {
    drafts = [{ beat: 4, text: 'Out now.', post_id: 'p9', status: 'live' }];
    renderTab(`${SCRIPT.split('\n## BEAT: 12')[0]}\n[UI:POST Out now.]`);
    expect((await screen.findByTestId('script-post-drafted')).textContent).toBe('✓ Live in Lala’s Feed');
  });

  test('a Post already drafted reads as drafted on load', async () => {
    drafts = [{ beat: 4, text: 'Out now.', post_id: 'p9', status: 'draft' }];
    renderTab(`${SCRIPT.split('\n## BEAT: 12')[0]}\n[UI:POST Out now.]`);
    expect((await screen.findByTestId('script-post-drafted')).textContent).toContain('waiting for approval');
  });
});
