/**
 * Evoni, 2026-10-02: "when a set's base image changes (upload or generate),
 * its stored description written by the image analysis should be refreshed
 * or flagged, since a description of an old image now drives every prompt."
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() } }));

import apiClient from '../services/api';
import { DescriptionReview } from './SceneSetsTab';

const review = (over = {}) => ({ reason: 'base_changed', origin: 'uploaded', base_url: 'https://x/new.jpg', machine_written: false, suggested: null, ...over });
const setWith = (r) => ({ id: 'set-1', canonical_description: 'Mine.', visual_language: r ? { description_review: r } : {} });

describe('DescriptionReview', () => {
  beforeEach(() => Object.values(apiClient).forEach((fn) => fn.mockReset()));

  test('nothing without a review', () => {
    const { container } = render(<DescriptionReview set={setWith(null)} onResolved={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  test('your description after a new base: says so, offers the new image\'s description, and uses it', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: { canonical_description: 'The new one.', visual_language: {} } } });
    const onResolved = vi.fn();
    render(<DescriptionReview set={setWith(review({ suggested: 'The new one.' }))} onResolved={onResolved} />);
    const box = screen.getByTestId('description-review');
    expect(box.textContent).toContain('The base image changed after this description was written. It is still sent with every prompt.');
    expect(box.textContent).toContain('The new image, as the analysis describes it: The new one.');
    fireEvent.click(screen.getByRole('button', { name: "Use the new image's description" }));
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith({ canonical_description: 'The new one.', visual_language: {} }));
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/scene-sets/set-1/description-review', { action: 'use_suggested' });
  });

  test('Keep mine clears it; with no suggestion yet only Keep is offered', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: { canonical_description: 'Mine.', visual_language: {} } } });
    const onResolved = vi.fn();
    render(<DescriptionReview set={setWith(review())} onResolved={onResolved} />);
    expect(screen.queryByRole('button', { name: "Use the new image's description" })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Keep this description' }));
    await waitFor(() => expect(onResolved).toHaveBeenCalled());
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/scene-sets/set-1/description-review', { action: 'keep' });
  });

  test('a description the analysis wrote: it will be rewritten from the new image', () => {
    render(<DescriptionReview set={setWith(review({ machine_written: true }))} onResolved={vi.fn()} />);
    expect(screen.getByTestId('description-review').textContent)
      .toContain('This description was written by the image analysis of the earlier base image. It is rewritten when the new image is analysed.');
  });
});
