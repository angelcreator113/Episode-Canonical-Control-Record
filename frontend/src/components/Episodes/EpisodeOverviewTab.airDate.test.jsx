/**
 * The Overview's Air Date edit (P0; Evoni's ruling: "Fix field mapping, add
 * validation and regression tests"). The form sent the date as
 * `publish_date`, a key the episode update does not keep, so the edit was
 * dropped. It is sent as `air_date`, the stored timestamp shows as its day
 * in the date input, and after a save the form shows what the server saved.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));
vi.mock('../../services/episodeEventsApi', () => ({ getEpisodeEvents: vi.fn() }));
vi.mock('../episode/SceneSuggestionReview', () => ({ default: () => null }));
vi.mock('../episode/TimelinePlacementsSection', () => ({ default: () => null }));

import api from '../../services/api';
import { getEpisodeEvents } from '../../services/episodeEventsApi';
import EpisodeOverviewTab from './EpisodeOverviewTab';

const EPISODE = {
  id: 'ep-1', show_id: 'show-1', title: 'Gala Night',
  description: 'Lala arrives late.',
  air_date: '2026-11-20T00:00:00.000Z',
};

const openEdit = () =>
  fireEvent.click(within(screen.getByTestId('overview-story-brief')).getByRole('button', { name: 'Edit' }));

describe('EpisodeOverviewTab Air Date edit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: {} });
    vi.mocked(getEpisodeEvents).mockResolvedValue({ events: [] });
  });

  test('the stored air date shows as its day in the date input', () => {
    render(<MemoryRouter><EpisodeOverviewTab episode={EPISODE} show={{ id: 'show-1' }} onUpdate={vi.fn()} /></MemoryRouter>);
    openEdit();
    expect(screen.getByLabelText('Air Date').value).toBe('2026-11-20');
  });

  test('a new air date is sent as air_date, never publish_date', async () => {
    const onUpdate = vi.fn().mockResolvedValue({ data: { ...EPISODE, air_date: '2026-12-01T00:00:00.000Z' } });
    render(<MemoryRouter><EpisodeOverviewTab episode={EPISODE} show={{ id: 'show-1' }} onUpdate={onUpdate} /></MemoryRouter>);
    openEdit();
    fireEvent.change(screen.getByLabelText('Air Date'), { target: { value: '2026-12-01' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    const payload = onUpdate.mock.calls[0][0];
    expect(payload.air_date).toBe('2026-12-01');
    expect(payload).not.toHaveProperty('publish_date');
  });

  test('after a save the form shows the air date the server saved', async () => {
    // The server's reply is what the form shows, not what was typed.
    const onUpdate = vi.fn().mockResolvedValue({ data: { ...EPISODE, air_date: '2026-12-02T00:00:00.000Z' } });
    render(<MemoryRouter><EpisodeOverviewTab episode={EPISODE} show={{ id: 'show-1' }} onUpdate={onUpdate} /></MemoryRouter>);
    openEdit();
    fireEvent.change(screen.getByLabelText('Air Date'), { target: { value: '2026-12-01' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(screen.queryByText('Edit episode')).toBeNull());

    openEdit();
    expect(screen.getByLabelText('Air Date').value).toBe('2026-12-02');
  });

  test('an unchanged air date is not sent (a stored time is never reset)', async () => {
    const onUpdate = vi.fn().mockResolvedValue({ data: { ...EPISODE, title: 'Gala Night II' } });
    const timed = { ...EPISODE, air_date: '2026-11-20T15:00:00.000Z' };
    render(<MemoryRouter><EpisodeOverviewTab episode={timed} show={{ id: 'show-1' }} onUpdate={onUpdate} /></MemoryRouter>);
    openEdit();
    fireEvent.change(screen.getByDisplayValue('Gala Night'), { target: { value: 'Gala Night II' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    const payload = onUpdate.mock.calls[0][0];
    expect(payload.title).toBe('Gala Night II');
    expect(payload).not.toHaveProperty('air_date');
    expect(payload).not.toHaveProperty('publish_date');
  });

  test('clearing the air date sends an empty air_date', async () => {
    const onUpdate = vi.fn().mockResolvedValue({ data: { ...EPISODE, air_date: null } });
    render(<MemoryRouter><EpisodeOverviewTab episode={EPISODE} show={{ id: 'show-1' }} onUpdate={onUpdate} /></MemoryRouter>);
    openEdit();
    fireEvent.change(screen.getByLabelText('Air Date'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(onUpdate.mock.calls[0][0].air_date).toBe('');
    await waitFor(() => expect(screen.queryByText('Edit episode')).toBeNull());
    openEdit();
    expect(screen.getByLabelText('Air Date').value).toBe('');
  });
});
