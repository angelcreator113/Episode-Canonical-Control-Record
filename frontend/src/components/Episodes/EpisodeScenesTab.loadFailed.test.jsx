/**
 * Scenes › Plan when the beats don't load (Evoni, 2026-11-12): it says so
 * with Retry, and does not say "No beat plan yet · Make the beat plan". A
 * read that succeeds with no beats keeps that empty state.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import apiClient from '../../services/api';
import EpisodeScenesTab from './EpisodeScenesTab';

const others = { data: { success: true, data: [] } };
const planFails = () => vi.mocked(apiClient.get).mockImplementation((url) => (url.endsWith('/episode-brief/ep-1/plan') ? Promise.reject(new Error('Network Error')) : Promise.resolve(others)));
const planEmpty = () => vi.mocked(apiClient.get).mockImplementation((url) => Promise.resolve(url.endsWith('/episode-brief/ep-1/plan') ? { data: { data: [], count: 0 } } : others));
const renderTab = () => render(<MemoryRouter><EpisodeScenesTab episode={{ id: 'ep-1' }} /></MemoryRouter>);

describe('EpisodeScenesTab: a failed beats read is not "no beat plan yet"', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('the read fails: an error with Retry; "Make the beat plan" is not offered', async () => {
    planFails();
    renderTab();
    const failed = await screen.findByTestId('est-plan-failed');
    expect(failed.textContent).toContain("Couldn't load this episode's beats. Nothing was changed.");
    expect(screen.queryByText(/No beat plan yet/)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Make the beat plan' })).toBeNull();
  });

  test('Retry reads again; an empty plan then shows "No beat plan yet" with its link, as before', async () => {
    planFails();
    renderTab();
    await screen.findByTestId('est-plan-failed');
    planEmpty();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText(/No beat plan yet/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Make the beat plan' }).getAttribute('href')).toBe('/episodes/ep-1/plan');
    expect(screen.queryByTestId('est-plan-failed')).toBeNull();
  });

  test('a first read that succeeds with no beats: the empty state, unchanged', async () => {
    planEmpty();
    renderTab();
    expect(await screen.findByText(/No beat plan yet/)).toBeTruthy();
    expect(screen.queryByTestId('est-plan-failed')).toBeNull();
  });
});
