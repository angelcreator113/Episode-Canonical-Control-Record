/**
 * RelationshipEngine/StoryTimeline — "Story so far" (2026-10-23).
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../../services/api';
import StoryTimeline, { journeyOf, fetchRelationshipEvents } from './StoryTimeline';

beforeEach(() => Object.values(apiClient).forEach((fn) => fn.mockReset()));

describe('StoryTimeline', () => {
  test('the journey: each stage once, in story order', () => {
    expect(journeyOf([
      { stage_before: 'strangers', relationship_stage: 'acquaintances' },
      { stage_before: 'acquaintances', relationship_stage: 'flirting' },
      { stage_before: null, relationship_stage: 'flirting' },
    ])).toEqual(['strangers', 'acquaintances', 'flirting']);
    expect(journeyOf([])).toEqual([]);
  });

  test('fetchRelationshipEvents GET on /relationships/:id/events', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { events: [{ id: 'e' }] } });
    await expect(fetchRelationshipEvents('rel-1')).resolves.toEqual([{ id: 'e' }]);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/relationships/rel-1/events');
  });

  test('an event without an episode has no link; nothing yet says so', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { events: [
      { id: 'e1', event_type: 'betrayal', relationship_stage: null, description: 'She saw the DMs', tension_before: 3, tension_after: 8 },
    ] } });
    const { unmount } = render(<MemoryRouter><StoryTimeline relId="r1" /></MemoryRouter>);
    expect(await screen.findByText('She saw the DMs')).toBeTruthy();
    expect(screen.getByText('Betrayal')).toBeTruthy();
    expect(screen.getByText('Tension 3 → 8')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
    unmount();

    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { events: [] } });
    render(<MemoryRouter><StoryTimeline relId="r2" /></MemoryRouter>);
    expect(await screen.findByText(/Nothing has happened between them/)).toBeTruthy();
  });

  test('a failed load says so and logs', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('boom'));
    render(<MemoryRouter><StoryTimeline relId="r3" /></MemoryRouter>);
    const story = screen.getByLabelText('Story so far');
    expect(await within(story).findByRole('alert')).toBeTruthy();
    expect(spy).toHaveBeenCalled();
  });
});
