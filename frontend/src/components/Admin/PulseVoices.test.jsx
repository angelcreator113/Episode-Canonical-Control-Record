/**
 * Admin › The Pulse › Voices (Task 2972): each posting character's voice
 * state, Build and Rebuild, the habits form, the examples (add and remove),
 * the banned phrases, and Pin as voice example from a Review post card.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import api from '../../services/api';
import PulseVoices, { voiceState, habitsToForm, formToHabits } from './PulseVoices';
import { PostCard } from './PulseReviewPost';
import { PulseRevealProvider } from './PulseRevealContext';

const VOICE = {
  id: 'v1', registry_character_id: 'c1', status: 'built', built_at: '2026-10-12T10:00:00Z',
  habits: { case: 'lowercase', punctuation: 'no full stops', emoji: { use: 'rarely', favorites: ['🙄'] }, sentence_length: 'short', temperament: 'oversharer', topics: ['fits', 'gossip'], never_says: ['synergy'], signature_phrases: ['ok but why'] },
  examples: [{ id: 'e1', kind: 'pinned', text: 'ok but who approved beige' }],
};
const DATA = {
  success: true,
  banned_phrases: ['delve', 'tapestry'],
  characters: [
    { registry_character_id: 'c1', display_name: 'Marcus', depth_level: 'alive', handle: 'marcus.k', social_profile_id: 3, voice: VOICE, needs_rebuild: false },
    { registry_character_id: 'c2', display_name: 'Nia', depth_level: 'active', handle: 'nia', social_profile_id: 4, voice: null, needs_rebuild: true },
  ],
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockResolvedValue({ data: DATA });
});

describe('helpers', () => {
  test('the voice state in words', () => {
    expect(voiceState({ voice: null })).toEqual({ label: 'No voice yet', tone: 'none' });
    expect(voiceState({ voice: VOICE, needs_rebuild: true }).label).toBe('Profile changed: rebuild');
    expect(voiceState({ voice: { ...VOICE, status: 'edited', edited_by: 'evoni@x.dev' } }).label).toBe('Edited by evoni@x.dev');
    expect(voiceState({ voice: VOICE }).label).toBe('Built');
  });

  test('habits to the form and back', () => {
    const form = habitsToForm(VOICE.habits);
    expect(form).toMatchObject({ topics: 'fits, gossip', emoji_favorites: '🙄', emoji_use: 'rarely' });
    expect(formToHabits({ ...form, topics: 'fits, , shoes ' })).toEqual({ ...VOICE.habits, topics: ['fits', 'shoes'] });
  });
});

describe('the Voices tab', () => {
  test('a card per posting character with its state; the banned phrases listed', async () => {
    render(<PulseVoices showId="show-1" />);
    const cards = await screen.findAllByTestId('pulse-voices-card');
    expect(api.get).toHaveBeenCalledWith('/api/v1/pulse-voices?show_id=show-1');
    expect(cards.map((c) => within(c).getByTestId('pulse-voices-state').textContent)).toEqual(['Built', 'No voice yet']);
    expect(within(cards[0]).getByRole('button', { name: 'Rebuild' })).toBeTruthy();
    expect(within(cards[1]).getByRole('button', { name: 'Build voice' })).toBeTruthy();
    expect(screen.getByTestId('pulse-voices-banned').textContent).toMatch(/Phrases the gate rejects \(2\)delve · tapestry/);
  });

  test('Build: builds the voice and opens it', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { voice: { ...VOICE, id: 'v2', registry_character_id: 'c2', examples: [] } } });
    render(<PulseVoices showId="show-1" />);
    const nia = (await screen.findAllByTestId('pulse-voices-card'))[1];
    fireEvent.click(within(nia).getByRole('button', { name: 'Build voice' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/pulse-voices/c2/build'));
    expect(await within(nia).findByTestId('pulse-voices-habits')).toBeTruthy();
    expect(within(nia).getByTestId('pulse-voices-state').textContent).toBe('Built');
  });

  test('Rebuild asks first when the voice was edited', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { ...DATA, characters: [{ ...DATA.characters[0], voice: { ...VOICE, status: 'edited' } }] } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<PulseVoices showId="show-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Rebuild' }));
    expect(confirm).toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  test('the habits form saves only a change', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { voice: { ...VOICE, status: 'edited', edited_by: 'evoni@x.dev', habits: { ...VOICE.habits, case: 'mixed' } } } });
    render(<PulseVoices showId="show-1" />);
    const marcus = (await screen.findAllByTestId('pulse-voices-card'))[0];
    fireEvent.click(within(marcus).getByRole('button', { name: 'Show voice' }));
    const save = within(marcus).getByRole('button', { name: 'Save habits' });
    expect(save.disabled).toBe(true);
    fireEvent.change(within(marcus).getByLabelText('Case'), { target: { value: 'mixed' } });
    fireEvent.click(save);
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/pulse-voices/v1', { habits: { ...VOICE.habits, case: 'mixed' } }));
    expect(await within(marcus).findByText('Edited by evoni@x.dev')).toBeTruthy();
  });

  test('temperament: shown, kept on other edits, and saved when changed', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { voice: { ...VOICE, status: 'edited', habits: { ...VOICE.habits, temperament: 'lurker' } } } });
    render(<PulseVoices showId="show-1" />);
    const marcus = (await screen.findAllByTestId('pulse-voices-card'))[0];
    fireEvent.click(within(marcus).getByRole('button', { name: 'Show voice' }));
    const select = within(marcus).getByLabelText('Temperament');
    expect(select.value).toBe('oversharer');
    fireEvent.change(select, { target: { value: 'lurker' } });
    fireEvent.click(within(marcus).getByRole('button', { name: 'Save habits' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/pulse-voices/v1', { habits: { ...VOICE.habits, temperament: 'lurker' } }));
  });

  test('a voice built before temperament existed reads as regular', () => {
    const { temperament, ...older } = VOICE.habits;
    expect(temperament).toBe('oversharer');
    expect(habitsToForm(older).temperament).toBe('regular');
    expect(formToHabits(habitsToForm(older)).temperament).toBe('regular');
  });

  test('examples: add one in their voice, remove one', async () => {
    const added = { ...VOICE, examples: [{ id: 'e2', kind: 'edit', text: 'not the beige again' }, ...VOICE.examples] };
    vi.mocked(api.post).mockResolvedValue({ data: { voice: added } });
    vi.mocked(api.delete).mockResolvedValue({ data: { voice: { ...added, examples: [added.examples[0]] } } });
    render(<PulseVoices showId="show-1" />);
    const marcus = (await screen.findAllByTestId('pulse-voices-card'))[0];
    fireEvent.click(within(marcus).getByRole('button', { name: 'Show voice' }));
    fireEvent.change(within(marcus).getByLabelText('Write one in their voice'), { target: { value: ' not the beige again ' } });
    fireEvent.click(within(marcus).getByRole('button', { name: 'Add example' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/pulse-voices/v1/examples', { text: 'not the beige again', kind: 'edit' }));
    const list = within(marcus).getByTestId('pulse-voices-examples');
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(2));
    expect(within(list).getAllByRole('listitem')[0].textContent).toMatch(/^Yoursnot the beige again/);
    fireEvent.click(within(list).getAllByRole('button', { name: 'Remove' })[1]);
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/pulse-voices/v1/examples/e1'));
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(1));
  });

  test('those Lala has not met yet are listed apart, with when they meet, and their voice can be built', async () => {
    const maren = { registry_character_id: 'c3', display_name: 'Maren', depth_level: 'alive', handle: '@slowsift', social_profile_id: 5, voice: null, needs_rebuild: true, meets_in: 1 };
    vi.mocked(api.get).mockResolvedValue({ data: { ...DATA, characters: [], not_met: [maren, { ...maren, registry_character_id: 'c4', display_name: 'Later', meets_in: null }] } });
    vi.mocked(api.post).mockResolvedValue({ data: { voice: { ...VOICE, id: 'v3', registry_character_id: 'c3' } } });
    render(<PulseVoices showId="show-1" />);
    expect((await screen.findByTestId('pulse-voices-empty')).textContent).toMatch(/Lala has not met anyone below/);
    const group = screen.getByTestId('pulse-voices-unmet');
    expect(within(group).getByRole('heading').textContent).toBe('Lala hasn’t met them yet (2)');
    const [card, later] = within(group).getAllByTestId('pulse-voices-card');
    expect(within(card).getByTestId('pulse-voices-meets').textContent).toBe('Meets Lala in Episode 1');
    expect(within(later).getByTestId('pulse-voices-meets').textContent).toBe('Meets Lala later in the story');
    fireEvent.click(within(card).getByRole('button', { name: 'Build voice' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/pulse-voices/c3/build'));
    expect(await within(card).findByTestId('pulse-voices-approval')).toBeTruthy();
  });

  test('empty, and a failed read', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { ...DATA, characters: [] } });
    const { unmount } = render(<PulseVoices showId="show-1" />);
    expect((await screen.findByTestId('pulse-voices-empty')).textContent).toMatch(/No posting characters yet/);
    unmount();
    vi.mocked(api.get).mockRejectedValue({ response: { status: 500 } });
    render(<PulseVoices showId="show-1" />);
    expect((await screen.findByRole('alert')).textContent).toBe('The voices could not be loaded.');
  });
});

describe('Pin as voice example on a Review post card', () => {
  const wrap = (post) => render(<MemoryRouter><PulseRevealProvider showId="show-1"><PostCard post={post} showId="show-1" /></PulseRevealProvider></MemoryRouter>);
  const post = { id: 'p1', poster_handle: 'marcus.k', social_profile_id: 3, content_text: 'beige again? ok', status: 'live', comments: [] };

  test('pins the post to its poster\'s voice', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {} });
    vi.mocked(api.post).mockResolvedValue({ data: { handle: 'marcus.k', example: { id: 'e9' } } });
    wrap(post);
    fireEvent.click(screen.getByRole('button', { name: 'Pin as voice example' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/pulse-voices/pin', { post_id: 'p1' }));
    expect((await screen.findByRole('status')).textContent).toBe("Pinned to @marcus.k's voice.");
  });

  test('a refusal is shown; no link for a post with no poster profile', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {} });
    vi.mocked(api.post).mockRejectedValue({ response: { status: 409, data: { error: '@marcus.k has no Voice Profile yet. Build it in Voices first.' } } });
    const { unmount } = wrap(post);
    fireEvent.click(screen.getByRole('button', { name: 'Pin as voice example' }));
    expect((await screen.findByRole('alert')).textContent).toBe('@marcus.k has no Voice Profile yet. Build it in Voices first.');
    unmount();
    wrap({ ...post, social_profile_id: null });
    expect(screen.queryByRole('button', { name: 'Pin as voice example' })).toBeNull();
  });
});
