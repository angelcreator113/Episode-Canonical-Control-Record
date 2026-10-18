/**
 * Admin › The Pulse › Storylines (Task 2989): storylines with their beats in
 * story order and where each is; a new storyline; adding a beat (moments from
 * the episodes, posters with a voice); Remove, Drop; Suggest beats with Keep
 * and Bin; and errors.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('./PulseRevealContext', () => ({ useReveals: () => ({ episodes: [{ episode_number: 1 }] }) }));

import api from '../../services/api';
import PulseStorylines, { beatState } from './PulseStorylines';

const beat = (id, kind, order, parts = {}) => ({ id, kind, story_order: order, handle: 'marcus.k', brief: `${kind} brief`, status: 'planned', ...parts });
const DATA = {
  success: true,
  present: 17,
  threads: [{ id: 't1', title: 'The rivalry' }],
  storylines: [
    {
      id: 's1', title: 'The silhouette', premise: 'Someone keeps turning up.', status: 'running', show_story_thread_id: 't1',
      beats: [
        beat('b1', 'plant', 15, { label: 'During Ep 1', status: 'drafted', post: { id: 'p1', status: 'live' } }),
        beat('b2', 'build', 17, { label: 'After Ep 1', status: 'queued' }),
        beat('b3', 'payoff', 18, { label: 'The day after Ep 1' }),
      ],
    },
    { id: 's2', title: 'Old news', premise: null, status: 'dropped', show_story_thread_id: null, beats: [] },
  ],
};
const VOICES = { characters: [
  { registry_character_id: 'c1', display_name: 'Marcus', handle: 'marcus.k', social_profile_id: 7, voice: { id: 'v1' } },
  { registry_character_id: 'c2', display_name: 'Nobody', handle: 'nobody', social_profile_id: 8, voice: null },
] };

beforeEach(() => {
  vi.mocked(api.get).mockReset();
  vi.mocked(api.post).mockReset();
  vi.mocked(api.put).mockReset();
  vi.mocked(api.delete).mockReset();
  vi.mocked(api.get).mockImplementation((url) => Promise.resolve({ data: url.startsWith('/api/v1/pulse-voices') ? VOICES : DATA }));
});

const cards = () => screen.findAllByTestId('pulse-story-card');

describe('beatState', () => {
  test('says where a beat is', () => {
    expect(beatState({ status: 'planned' })).toBe('Planned');
    expect(beatState({ status: 'queued' })).toBe('Queued for the engine');
    expect(beatState({ status: 'drafted', post: { status: 'live' } })).toBe('Posted');
    expect(beatState({ status: 'drafted', post: { status: 'draft' } })).toBe('Drafted, waiting in Review');
    expect(beatState({ status: 'drafted' })).toBe('Drafted');
    expect(beatState({ status: 'skipped' })).toBe('Skipped');
  });
});

describe('the Storylines tab', () => {
  test('lists storylines with their thread and beats; a dropped one has no actions', async () => {
    render(<PulseStorylines showId="show-1" />);
    const [running, dropped] = await cards();
    expect(api.get).toHaveBeenCalledWith('/api/v1/pulse-storylines?show_id=show-1');
    expect(within(running).getByText('Follows the thread “The rivalry”.')).toBeTruthy();
    const beats = within(running).getAllByTestId('pulse-story-beat').map((b) => b.textContent);
    expect(beats[0]).toBe('During Ep 1Plant@marcus.k: plant briefPosted');
    expect(beats[1]).toBe('After Ep 1Build@marcus.k: build briefQueued for the engine');
    expect(beats[2]).toBe('The day after Ep 1Payoff@marcus.k: payoff briefPlannedRemove');
    expect(within(dropped).getByText('Dropped')).toBeTruthy();
    expect(within(dropped).queryByRole('button', { name: 'Add a beat' })).toBeNull();
  });

  test('a new storyline posts its title, premise and thread, then reloads', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
    render(<PulseStorylines showId="show-1" />);
    await cards();
    fireEvent.click(screen.getByRole('button', { name: 'New storyline' }));
    const form = screen.getByTestId('pulse-story-new');
    expect(within(form).getByText(/Name the characters it is about by handle/)).toBeTruthy();
    fireEvent.change(within(form).getByLabelText('Title'), { target: { value: ' A lost ring ' } });
    fireEvent.change(within(form).getByLabelText('Premise'), { target: { value: 'It turns up.' } });
    fireEvent.change(within(form).getByLabelText('Follows a show thread (optional)'), { target: { value: 't1' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Create storyline' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/pulse-storylines', { show_id: 'show-1', title: 'A lost ring', premise: 'It turns up.', show_story_thread_id: 't1' }));
    await waitFor(() => expect(screen.queryByTestId('pulse-story-new')).toBeNull());
  });

  test('adds a beat from the story moments and the characters with a voice; a due beat says it was queued', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, queued: true, engine_on: false } });
    render(<PulseStorylines showId="show-1" />);
    const [running] = await cards();
    fireEvent.click(within(running).getByRole('button', { name: 'Add a beat' }));
    const form = within(running).getByTestId('pulse-story-beat-form');
    const who = within(form).getByLabelText('Who posts');
    await waitFor(() => expect(within(who).getAllByRole('option').map((o) => o.textContent)).toEqual(['Choose a character', 'Marcus (@marcus.k)']));
    const when = within(form).getByLabelText('Story moment');
    expect(within(when).getAllByRole('option').map((o) => o.value)).toContain('17');
    fireEvent.change(within(form).getByLabelText('Kind'), { target: { value: 'build' } });
    fireEvent.change(when, { target: { value: '17' } });
    fireEvent.change(who, { target: { value: '7' } });
    fireEvent.change(within(form).getByLabelText('What the post does'), { target: { value: 'spots it again' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add beat' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/pulse-storylines/s1/beats', { kind: 'build', story_order: 17, poster_profile_id: 7, brief: 'spots it again' }));
    expect((await within(running).findByRole('status')).textContent).toBe('Its moment has come: queued; the posting engine drafts it once it is on.');
    expect(within(running).queryByTestId('pulse-story-beat-form')).toBeNull();
  });

  test('Remove deletes a planned beat; Drop drops the storyline', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
    vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
    render(<PulseStorylines showId="show-1" />);
    const [running] = await cards();
    fireEvent.click(within(running).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/pulse-storylines/s1/beats/b3'));
    await waitFor(() => expect(within(running).getByRole('button', { name: 'Drop' }).disabled).toBe(false));
    fireEvent.click(within(running).getByRole('button', { name: 'Drop' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/pulse-storylines/s1', { status: 'dropped' }));
  });

  test('Suggest beats lists suggestions: Keep adds one, Bin drops one; errors show', async () => {
    vi.mocked(api.post).mockImplementation((url) => (url.endsWith('/suggest')
      ? Promise.resolve({ data: { suggestions: [
        { kind: 'plant', story_order: 17, poster_profile_id: 7, handle: 'marcus.k', brief: 'a glimpse' },
        { kind: 'payoff', story_order: 18, poster_profile_id: 7, handle: 'marcus.k', brief: 'the reveal' },
      ] } })
      : Promise.reject({ response: { data: { error: 'Profile 7 has no Voice Profile yet.' } } })));
    render(<PulseStorylines showId="show-1" />);
    const [running] = await cards();
    fireEvent.click(within(running).getByRole('button', { name: 'Suggest beats' }));
    const rows = await within(running).findAllByTestId('pulse-story-suggestion');
    expect(rows.map((r) => r.querySelector('span').textContent)).toEqual(['After Ep 1 · Plant · @marcus.k: a glimpse', 'The day after Ep 1 · Payoff · @marcus.k: the reveal']);
    fireEvent.click(within(rows[1]).getByRole('button', { name: 'Bin' }));
    expect(within(running).getAllByTestId('pulse-story-suggestion')).toHaveLength(1);
    fireEvent.click(within(running).getByRole('button', { name: 'Keep' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/pulse-storylines/s1/beats', { kind: 'plant', story_order: 17, poster_profile_id: 7, brief: 'a glimpse' }));
    expect((await within(running).findByRole('alert')).textContent).toBe('Profile 7 has no Voice Profile yet.');
    expect(within(running).getAllByTestId('pulse-story-suggestion')).toHaveLength(1);
  });

  test('nothing yet, and a failed read, say so', async () => {
    vi.mocked(api.get).mockImplementation((url) => Promise.resolve({ data: url.startsWith('/api/v1/pulse-voices') ? { characters: [] } : { storylines: [], threads: [] } }));
    const { unmount } = render(<PulseStorylines showId="show-1" />);
    expect((await screen.findByTestId('pulse-story-empty')).textContent).toBe('No storylines yet.');
    expect(screen.getByText('No character has a voice yet. Build one in Voices before adding beats.')).toBeTruthy();
    unmount();
    vi.mocked(api.get).mockImplementation(() => Promise.reject({ response: { status: 500 } }));
    render(<PulseStorylines showId="show-1" />);
    expect((await screen.findByRole('alert')).textContent).toBe('The storylines could not be loaded.');
  });
});
