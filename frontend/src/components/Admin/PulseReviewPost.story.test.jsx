/**
 * Suggestions from the story (services/storyRipples; Evoni, 2026-10-23:
 * "relationship changes reach the Pulse"): a post the What changed Save
 * suggested says why in Review, "From Episode 4: Lala and Marcus Hale, now
 * flirting", and Approve is the usual one. Other posts say nothing new.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import api from '../../services/api';
import { RequestPost } from './PulseReviewPost';

const STORY = {
  source: 'story', relationship_id: 'rel-1', episode_id: 'ep-4', episode_number: 4,
  line: 'Lala and Marcus Hale, now flirting', secrecy: 'secret', mode: 'rumour',
};
const POST = {
  id: 'p1', status: 'draft', episode_id: 'ep-4', episode: { episode_number: 4 }, poster_handle: 'railguest', poster_display_name: 'Rail Guest',
  content_text: 'who was Lala laughing with at the rail all night??',
  gate_json: { pass: true, flags: [], review: ['story_change'], story: STORY },
};
const show = (post) => render(<MemoryRouter><RequestPost post={post} onChange={() => {}} /></MemoryRouter>);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.put).mockResolvedValue({ data: { data: {} } });
});

describe('a suggestion from the story in Review', () => {
  test('says which episode and which change it comes from, and that a secret only hints', () => {
    show(POST);
    const why = screen.getByTestId('prv-story-why');
    expect(why.textContent).toBe('From Episode 4: Lala and Marcus Hale, now flirting · a secret: hints only, from people who know');
    expect(screen.getByTestId('prv-gate').textContent).toContain('waiting: Suggested from the story');
  });

  test('a public change says only where it is from; Approve is the usual one', async () => {
    show({ ...POST, gate_json: { ...POST.gate_json, story: { ...STORY, secrecy: 'public' } } });
    expect(screen.getByTestId('prv-story-why').textContent).toBe('From Episode 4: Lala and Marcus Hale, now flirting');
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/feed-posts/p1', { status: 'live' }));
  });

  test('a post not from the story shows no reason line', () => {
    show({ ...POST, gate_json: { pass: true, flags: [], review: ['event_draft'] } });
    expect(screen.queryByTestId('prv-story-why')).toBeNull();
  });
});
