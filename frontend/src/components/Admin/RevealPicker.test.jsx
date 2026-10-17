/**
 * Setting reveals in Admin › The Pulse (Task 2940; spec §5): the picker
 * says when an item reveals, saves an episode, event or set-story-time
 * reveal through PUT /api/v1/pulse-reveals, clears it, shows errors, and
 * renders nothing outside the provider; Uploads › Characters says when Lala
 * meets each character and lets Evoni set or reset it.
 */
import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import api from '../../services/api';
import RevealPicker from './RevealPicker';
import { PulseRevealProvider } from './PulseRevealContext';
import PulseCharactersCard from './PulseCharactersCard';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

const SHOW = 'show-1';
const EPISODES = [{ id: 'ep1', episode_number: 1, title: 'One' }, { id: 'ep2', episode_number: 2, title: 'Two' }, { id: 'epx', episode_number: null, title: 'Unnumbered' }];
let reveals;
let met;
beforeEach(() => {
  vi.clearAllMocks();
  reveals = [];
  met = [];
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url.startsWith('/api/v1/pulse-reveals/met?')) return { data: { met } };
    if (url.startsWith('/api/v1/pulse-reveals?')) return { data: { reveals } };
    if (url.startsWith('/api/v1/episodes?')) return { data: { data: EPISODES } };
    if (url.startsWith('/api/v1/character-registry/registries')) {
      return { data: { registries: [{ id: 'r1', characters: [{ id: 'c1', display_name: 'Ava' }, { id: 'c2', display_name: 'Zara' }, { id: 'c3', display_name: 'Nell' }] }] } };
    }
    return { data: {} };
  });
  vi.mocked(api.put).mockImplementation(async (url, body) => ({ data: { reveal: { id: 'rv1', ...body, label: 'During Ep 2', item_id: body.item_id } } }));
  vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
});

const inProvider = (ui) => render(<MemoryRouter><PulseRevealProvider showId={SHOW}>{ui}</PulseRevealProvider></MemoryRouter>);

describe('RevealPicker', () => {
  test('outside the provider it renders nothing', () => {
    const { container } = render(<RevealPicker type="post" id="p1" />);
    expect(container.textContent).toBe('');
  });

  test('an item with no reveal always shows; a set one says when, from the saved list', async () => {
    reveals = [{ id: 'rv9', item_type: 'post', item_id: 'p2', image_kind: null, moment: 'after', episode_id: 'ep1', mode: 'hidden', label: 'After Ep 1' }];
    inProvider(<><RevealPicker type="post" id="p1" /><RevealPicker type="post" id="p2" /></>);
    expect((await screen.findByTestId('reveal-post-p1')).textContent).toContain('Always shown');
    await waitFor(() => expect(screen.getByTestId('reveal-post-p2').textContent).toContain('Reveals: After Ep 1 · hidden before'));
  });

  test('an episode reveal: pick the episode and moment, first look by default; only numbered episodes are offered', async () => {
    inProvider(<RevealPicker type="post" id="p1" label="Lala's post" />);
    fireEvent.click(await screen.findByRole('button', { name: "Set the reveal for Lala's post" }));
    const save = screen.getByRole('button', { name: /Save reveal/ });
    expect(save.disabled).toBe(true);
    await waitFor(() => expect(screen.getAllByRole('option', { name: /^Ep / })).toHaveLength(2));
    fireEvent.change(screen.getByLabelText('Episode'), { target: { value: 'ep2' } });
    fireEvent.change(screen.getByLabelText('Moment'), { target: { value: 'lala_arrives' } });
    fireEvent.click(save);
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/pulse-reveals', {
      show_id: SHOW, item_type: 'post', item_id: 'p1', mode: 'teaser', moment: 'lala_arrives', episode_id: 'ep2',
    }));
    await waitFor(() => expect(screen.getByTestId('reveal-post-p1').textContent).toContain('Reveals: During Ep 2 · first look before'));
  });

  test("an event's reveal hangs on its own event; an image carries its kind; hidden can be chosen", async () => {
    inProvider(<RevealPicker type="image" kind="city" id="dazzle_district" eventId="ev1" label="the city" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Set the reveal for the city' }));
    expect(screen.getByLabelText('Its event').checked).toBe(true);
    fireEvent.change(screen.getByLabelText('Moment'), { target: { value: 'announced' } });
    fireEvent.click(screen.getByLabelText('Hidden'));
    fireEvent.click(screen.getByRole('button', { name: /Save reveal/ }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/pulse-reveals', {
      show_id: SHOW, item_type: 'image', item_id: 'dazzle_district', image_kind: 'city', mode: 'hidden', moment: 'announced', event_id: 'ev1',
    }));
  });

  test('a set story time sends ep:<n>:<phase>', async () => {
    inProvider(<RevealPicker type="post" id="p1" label="the post" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Set the reveal for the post' }));
    fireEvent.click(screen.getByLabelText('A set story time'));
    await waitFor(() => expect(screen.getAllByRole('option', { name: /^Ep / }).length).toBeGreaterThan(0));
    fireEvent.change(screen.getByLabelText('Episode'), { target: { value: 'ep1' } });
    fireEvent.change(screen.getByLabelText('When'), { target: { value: 'next_day' } });
    fireEvent.click(screen.getByRole('button', { name: /Save reveal/ }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/pulse-reveals', expect.objectContaining({ moment: 'story_time', at: 'ep:1:next_day' })));
  });

  test('"Always show" clears the reveal; a refused save says why', async () => {
    reveals = [{ id: 'rv9', item_type: 'event', item_id: 'ev1', image_kind: null, moment: 'announced', event_id: 'ev1', mode: 'teaser', label: 'Announced Ep 2' }];
    inProvider(<RevealPicker type="event" id="ev1" eventId="ev1" label="The Gala" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Change the reveal for The Gala' }));
    fireEvent.click(screen.getByRole('button', { name: 'Always show' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/pulse-reveals/rv9'));
    await waitFor(() => expect(screen.getByTestId('reveal-event-ev1').textContent).toContain('Always shown'));

    vi.mocked(api.put).mockRejectedValueOnce({ response: { status: 400, data: { error: 'A moment needs its event_id or episode_id.' } } });
    fireEvent.click(screen.getByRole('button', { name: 'Set the reveal for The Gala' }));
    fireEvent.click(screen.getByRole('button', { name: /Save reveal/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('A moment needs its event_id or episode_id.');
  });
});

describe('Uploads › Characters: when Lala meets them', () => {
  test('derived, set, unmet and unlinked characters each say so; Set and Reset save the reveal', async () => {
    met = [
      { profile_id: 11, registry_character_id: 'c1', derived: { episode_number: 2, from: 'guest' }, set: null, episode_number: 2 },
      { profile_id: 12, registry_character_id: 'c2', derived: { episode_number: 1, from: 'post' }, set: { id: 'rv5', story_order: 35 }, episode_number: 3 },
    ];
    inProvider(<PulseCharactersCard />);
    const ava = within(await screen.findByTestId('pulse-character-c1'));
    await waitFor(() => expect(ava.getByTestId('pulse-met').textContent).toContain('Meets Lala in Ep 2 (from the guest list)'));
    const zara = within(screen.getByTestId('pulse-character-c2'));
    expect(zara.getByTestId('pulse-met').textContent).toContain('Meets Lala in Ep 3 (set)');
    expect(within(screen.getByTestId('pulse-character-c3')).getByTestId('pulse-met').textContent).toBe('Not linked to a Feed profile, so not on The Pulse yet.');

    fireEvent.click(ava.getByRole('button', { name: 'Set when Lala meets Ava' }));
    fireEvent.change(ava.getByLabelText('Lala meets Ava in'), { target: { value: 'ep1' } });
    fireEvent.click(ava.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/pulse-reveals', {
      show_id: SHOW, item_type: 'character', item_id: '11', episode_id: 'ep1', moment: 'during', mode: 'hidden',
    }));

    fireEvent.click(zara.getByRole('button', { name: 'Reset to Ep 1' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/pulse-reveals/rv5'));
    expect(vi.mocked(api.get).mock.calls.filter(([u]) => u.startsWith('/api/v1/pulse-reveals/met?')).length).toBeGreaterThanOrEqual(3);
  });

  test('outside Admin › The Pulse (no provider) the card works without it', async () => {
    render(<MemoryRouter><PulseCharactersCard /></MemoryRouter>);
    await screen.findByTestId('pulse-character-c1');
    expect(screen.queryByTestId('pulse-met')).toBeNull();
    expect(vi.mocked(api.get).mock.calls.some(([u]) => u.includes('/pulse-reveals/met'))).toBe(false);
  });
});
