/**
 * Voice & Pulse to Evoni's mock (2026-10-18, step 3 of the character page):
 * the voice profile and its edit, feed behavior and its edit, post examples
 * with a filter and pages, public and private voice, and drafting posts.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../config/api', () => ({ API_URL: '/api/v1' }));

import api from '../services/api';
import CharacterProfilePage, { VoiceProfile, FeedBehavior, PostExamples, PublicPrivateVoice, voiceRows } from './CharacterProfilePage';

const inRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);
const CHARACTER = {
  id: 'c1', display_name: 'STUDIO BY SABLE', feed_profile_id: 7, status: 'accepted',
  voice_signature: { speech_pattern: 'Short, reflective sentences', vocabulary_tone: 'Fabric, texture, light', catchphrases: ['make it wearable'], extra: 'kept' },
};
const PROFILE = {
  id: 7, handle: 'studiobysable', platform: 'instagram', feed_layer: 'lalaverse', sample_captions: ['the dress before it knew what it was.'],
  posting_voice: 'Polished, visual, thoughtful.', post_frequency: '3-5 per week', content_category: 'Studio work and events',
  current_state: 'rising', follower_count_approx: '28.4K', aesthetic_dna: { vibe_tags: ['Fabric & Form', 'Studio life'] },
  public_persona: 'Calm, intentional and artistic.', private_reality: 'Worries the work is never enough.',
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
});

describe('Voice profile', () => {
  test('the sample, catchphrases and how they sound; empty ones say so', () => {
    inRouter(<VoiceProfile character={CHARACTER} feedProfile={PROFILE} onSaved={vi.fn()} />);
    const card = screen.getByTestId('ch-voice-profile');
    expect(card.textContent).toContain('the dress before it knew what it was.');
    expect(within(card).getByText('make it wearable')).toBeTruthy();
    expect(card.textContent).toContain('How they speakShort, reflective sentences');
    expect(card.textContent).toContain('Inner voiceNot written yet');
    expect(voiceRows(CHARACTER).map((r) => r.key)).toEqual(['speech_pattern', 'vocabulary_tone', 'internal_monologue_style', 'emotional_reactivity']);
  });

  test('Edit saves the voice signature, keeping what it does not show', async () => {
    const onSaved = vi.fn();
    inRouter(<VoiceProfile character={CHARACTER} feedProfile={PROFILE} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Inner voice'), { target: { value: 'Calm' } });
    fireEvent.change(screen.getByLabelText('Catchphrases'), { target: { value: 'make it wearable, light, fabric' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save voice' }));
    const next = {
      speech_pattern: 'Short, reflective sentences', vocabulary_tone: 'Fabric, texture, light', internal_monologue_style: 'Calm',
      emotional_reactivity: null, catchphrases: ['make it wearable', 'light', 'fabric'], extra: 'kept',
    };
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/character-registry/characters/c1', { voice_signature: next }));
    expect(onSaved).toHaveBeenCalledWith({ voice_signature: next });
  });

  test('a finalized character has no Edit', () => {
    inRouter(<VoiceProfile character={{ ...CHARACTER, status: 'finalized' }} feedProfile={null} onSaved={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.getByTestId('ch-voice-profile').textContent).toContain('No sample post yet');
  });
});

describe('Pulse behavior', () => {
  test('posting style, how often, what they post and their topics', () => {
    inRouter(<FeedBehavior character={CHARACTER} feedProfile={{ ...PROFILE, current_state: 'gone_dark' }} appearances={{ feed: { posts: 5 } }} onFeedSaved={vi.fn()} />);
    const card = screen.getByTestId('ch-feed-behavior');
    expect(card.textContent).toContain('Polished, visual, thoughtful.');
    expect(card.textContent).toContain('How often3-5 per week');
    expect(card.textContent).toContain('Posts5');
    expect(card.textContent).toContain('AccountGone Dark');
    expect(within(card).getByText('On The Pulse')).toBeTruthy();
    expect(within(card).getByText('Fabric & Form')).toBeTruthy();
  });

  test('Edit saves the feed profile', async () => {
    const onFeedSaved = vi.fn();
    inRouter(<FeedBehavior character={CHARACTER} feedProfile={PROFILE} appearances={null} onFeedSaved={onFeedSaved} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('How they comment'), { target: { value: 'Warm, short replies' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const body = { posting_voice: 'Polished, visual, thoughtful.', comment_energy: 'Warm, short replies', content_persona: null };
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/social-profiles/7', body));
    expect(onFeedSaved).toHaveBeenCalledWith(body);
  });

  test('no feed profile: where to make one', () => {
    inRouter(<FeedBehavior character={{ ...CHARACTER, feed_profile_id: null }} feedProfile={null} appearances={null} onFeedSaved={vi.fn()} />);
    expect(screen.getByTestId('ch-feed-behavior').textContent).toContain('Not on The Pulse yet');
    expect(screen.getByText('Not on The Pulse', { selector: '.ch-presence' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });
});

describe('Post examples', () => {
  const posts = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, text: `Post ${i}`, status: i === 6 ? 'draft' : 'posted', at: '2026-10-14T10:00:00Z', episode_number: i === 0 ? 1 : null }));

  test('five to a page, a filter for drafts, and the way to draft more', () => {
    const onDraft = vi.fn();
    inRouter(<PostExamples character={CHARACTER} feedProfile={PROFILE} trail={{ posts }} onDraft={onDraft} />);
    const card = screen.getByTestId('ch-post-examples');
    expect(within(card).getAllByRole('listitem')).toHaveLength(5);
    expect(card.textContent).toContain('Episode 1 · Oct 14, 2026');
    fireEvent.click(within(card).getByRole('button', { name: 'Drafts' }));
    expect(within(card).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Post 6DraftOct 14, 2026']);
    expect(within(card).getByRole('button', { name: 'Drafts' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(card).getByRole('button', { name: /Draft new posts/ }));
    expect(onDraft).toHaveBeenCalled();
    expect(within(card).getByRole('link', { name: /View Pulse profile/ }).getAttribute('href')).toBe('/world-studio?tab=feed&layer=lalaverse&profile=7');
  });

  test('none yet', () => {
    inRouter(<PostExamples character={CHARACTER} feedProfile={PROFILE} trail={{ posts: [] }} onDraft={vi.fn()} />);
    expect(screen.getByTestId('ch-post-examples').textContent).toContain('No posts yet.');
  });
});

describe('Public and private voice', () => {
  test('the feed persona against the private reality', () => {
    inRouter(<PublicPrivateVoice character={{ ...CHARACTER, the_mask: { feed_profile_is_mask: true } }} feedProfile={PROFILE} />);
    const card = screen.getByTestId('ch-public-private');
    expect(card.textContent).toContain('Calm, intentional and artistic.');
    expect(card.textContent).toContain('Worries the work is never enough.');
    expect(card.textContent).toContain('Their Pulse profile is their mask');
  });
});

describe('the Voice & Pulse tab', () => {
  test('opens with ?tab=voice; Draft new posts opens the drafter', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/character-registry/characters/c1') return { data: { character: CHARACTER } };
      if (url === '/api/v1/social-profiles/7') return { data: { profile: PROFILE } };
      if (url.endsWith('/story-trail')) return { data: { posts: [{ id: 'p1', text: 'New drop', status: 'posted' }] } };
      return { data: {} };
    });
    render(
      <MemoryRouter initialEntries={['/character/c1?tab=voice']}>
        <Routes><Route path="/character/:id" element={<CharacterProfilePage />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('ch-post-examples').textContent).toContain('New drop'));
    expect(screen.getByTestId('ch-voice-profile')).toBeTruthy();
    expect(screen.queryByTestId('ch-gen')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Draft new posts/ }));
    expect(await screen.findByTestId('ch-gen')).toBeTruthy();
  });
});
