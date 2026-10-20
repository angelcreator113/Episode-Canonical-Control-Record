/**
 * FeedEnhancements — Lala's reactions to a Pulse person (show side check,
 * 2026-10-20, F1): the panel calls the profile's own lala-reactions route,
 * which builds the prompt on the server; /memories/ai never existed.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../../services/api';
import { generateLalaReactionsApi, LalaReactions } from './FeedEnhancements';

describe("FeedEnhancements — Lala's reactions", () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('generateLalaReactionsApi posts to the profile, with no prompt from the browser', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { reactions: [] } });
    await generateLalaReactionsApi(42);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/social-profiles/42/lala-reactions');
  });

  test('the panel shows the reactions the server sends', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { reactions: [
      { trigger: 'Her morning robe', internal_monologue: 'I want that ease.', what_she_posts: 'Soft mornings.', emotional_cost: 'A little envy' },
    ] } });
    render(<LalaReactions profile={{ id: 7, handle: 'slowsift', platform: 'pulse' }} onClose={() => {}} />);
    fireEvent.click(screen.getByText('Generate Reactions'));
    await waitFor(() => expect(screen.getByText('Her morning robe')).toBeTruthy());
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/social-profiles/7/lala-reactions');
  });

  test('a failure is said plainly, not only logged', async () => {
    vi.mocked(apiClient.post).mockRejectedValue({ response: { data: { error: 'The AI could not be reached; nothing was spent.' } } });
    render(<LalaReactions profile={{ id: 7, handle: 'slowsift', platform: 'pulse' }} onClose={() => {}} />);
    fireEvent.click(screen.getByText('Generate Reactions'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('could not be reached'));
  });
});
