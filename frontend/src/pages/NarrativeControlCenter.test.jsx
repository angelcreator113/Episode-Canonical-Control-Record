/**
 * NarrativeControlCenter — Track 6 CP8 behavioral tests (file 2 of 10).
 *
 * 1 fetch site migrated via getTierPipelineApi. The file's existing Track 4
 * fetchJSON wrapper covers other endpoints; this CP8 helper closes the one
 * remaining bare-fetch site at the PipelineTab useEffect.
 */

import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    request: vi.fn(),
  },
}));

import apiClient from '../services/api';
import { getTierPipelineApi, RelTimelineTab } from './NarrativeControlCenter';

describe('NarrativeControlCenter — Track 6 CP8 module-scope helper', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getTierPipelineApi GET on /tier/pipeline', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { pipelines: [], stats: null } });
    await getTierPipelineApi();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/tier/pipeline');
  });

  test('getTierPipelineApi rejection propagates', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('not authorized'));
    await expect(getTierPipelineApi()).rejects.toThrow('not authorized');
  });
});

describe('NarrativeControlCenter — the Relationship Timeline tab never stays on Loading', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('refused (403): it says the tab is for admins, and the loader is gone', async () => {
    vi.mocked(apiClient.request).mockRejectedValue({ response: { status: 403, data: { error: 'Forbidden' } } });
    render(<RelTimelineTab />);
    expect(screen.getByText('Loading...')).toBeTruthy();
    const note = await screen.findByTestId('rel-timeline-error');
    expect(note.textContent).toBe('Relationships are for admins. Your account is not in the admin group.');
    expect(screen.queryByText('Loading...')).toBeNull();
    expect(note.textContent).not.toMatch(/Forbidden/);
  });

  test('any other failure: a plain message, and the loader is gone', async () => {
    vi.mocked(apiClient.request).mockRejectedValue(new Error('Network Error'));
    render(<RelTimelineTab />);
    const note = await screen.findByTestId('rel-timeline-error');
    expect(note.textContent).toBe('Relationships could not be loaded just now. Try again in a moment.');
    expect(screen.queryByText('Loading...')).toBeNull();
  });

  test('read: the relationships are listed, with no error', async () => {
    vi.mocked(apiClient.request).mockResolvedValue({ data: { relationships: [{ id: 'r1', char_a_name: 'Ari', char_b_name: 'Bex' }] } });
    render(<RelTimelineTab />);
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    expect(screen.queryByTestId('rel-timeline-error')).toBeNull();
    expect(screen.getByText('Relationships')).toBeTruthy();
  });
});
