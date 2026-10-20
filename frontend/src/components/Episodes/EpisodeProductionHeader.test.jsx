/**
 * The top of Production (Evoni's Production mock, 2026-10-17): seven steps
 * that open where each is worked on, the episode at a glance, the
 * checklist's progress, and Mark Ready.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('../../lib/rawClipsApi', async () => {
  const actual = await vi.importActual('../../lib/rawClipsApi');
  return { ...actual, rawClipsApi: { list: vi.fn() } };
});

import api from '../../services/api';
import { rawClipsApi } from '../../lib/rawClipsApi';
import EpisodeProductionHeader from './EpisodeProductionHeader';

const SECTIONS = [
  { id: 'brief', label: 'Episode Brief', items: [{ id: 'a', required: true }] },
  { id: 'world', label: 'Event & Venue', items: [{ id: 'b', required: true }] },
  { id: 'scene', label: 'Scene Plan', items: [{ id: 'c' }, { id: 'd' }] },
];
const EPISODE = {
  id: 'ep-1', episode_number: 1, title: 'Studio by Sable', status: 'in_build', script_content: 'INT.',
  description: 'Lala attends a creative workshop.', air_date: '2026-10-16T12:00:00Z',
};

const renderHeader = (props = {}) => render(
  <MemoryRouter>
    <EpisodeProductionHeader episode={EPISODE} sections={SECTIONS} checks={{ a: true, b: true, c: true }} onOpenTab={vi.fn()} onMarkReady={vi.fn()} {...props} />
  </MemoryRouter>,
);

describe('EpisodeProductionHeader', () => {
  beforeEach(() => {
    rawClipsApi.list.mockReset().mockResolvedValue([{ id: 'c1', beat_number: 1 }, { id: 'c2', beat_number: 2 }]);
    vi.mocked(api.get).mockReset().mockRejectedValue({ response: { status: 404 } });
  });

  test('the steps show what is done, and the first open one is current', async () => {
    renderHeader();
    await waitFor(() => expect(screen.getByTestId('eph-step-files').className).toContain('is-done'));
    expect(screen.getByTestId('eph-step-brief').className).toContain('is-done');
    expect(screen.getByTestId('eph-step-script').className).toContain('is-done');
    expect(screen.getByTestId('eph-step-scenes').getAttribute('aria-current')).toBe('step');
    expect(screen.getByTestId('eph-step-edit').textContent).toContain('2 of 14 scenes have a clip');
    expect(screen.getByTestId('eph-step-thumbnail').className).not.toContain('is-done');
  });

  test('Files carries "Takes: n of 14 beats" from the clips it already loads (Teleprompter batch 2)', async () => {
    rawClipsApi.list.mockResolvedValue([{ id: 'c1', beat_number: 1 }, { id: 'c2', beat_number: 1 }, { id: 'c3', beat_number: 8 }, { id: 'c4', beat_number: null }]);
    renderHeader();
    await waitFor(() => expect(screen.getByTestId('eph-step-stat-files').textContent).toBe('Takes: 2 of 14 beats'));
    expect(rawClipsApi.list).toHaveBeenCalledTimes(1);
  });

  test('a step opens its tab, or its page', async () => {
    const onOpenTab = vi.fn();
    renderHeader({ onOpenTab });
    fireEvent.click(within(screen.getByTestId('eph-step-files')).getByRole('button'));
    expect(onOpenTab).toHaveBeenCalledWith('files');
    expect(within(screen.getByTestId('eph-step-thumbnail')).getByRole('link').getAttribute('href')).toBe('/template-studio/youtube?episode=ep-1');
    expect(within(screen.getByTestId('eph-step-edit')).getByRole('link').getAttribute('href')).toBe('/episodes/ep-1/timeline');
    await waitFor(() => expect(rawClipsApi.list).toHaveBeenCalledWith('ep-1'));
  });

  test('a primary thumbnail finishes the Thumbnail step', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: { id: 't1' } } });
    renderHeader();
    await waitFor(() => expect(screen.getByTestId('eph-step-thumbnail').className).toContain('is-done'));
    expect(api.get).toHaveBeenCalledWith('/api/v1/thumbnails/episode/ep-1/primary');
  });

  test('the episode at a glance and the progress by section', () => {
    renderHeader();
    expect(screen.getByText('Episode 1')).toBeTruthy();
    expect(screen.getByText('Studio by Sable')).toBeTruthy();
    expect(screen.getByText('Lala attends a creative workshop.')).toBeTruthy();
    expect(screen.getByText('3 of 4 checks')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('75');
    expect(screen.getByText('1/2')).toBeTruthy();
  });

  test('Mark Ready while the episode is not yet In review; then the status shows instead', () => {
    const onMarkReady = vi.fn();
    const { unmount } = renderHeader({ onMarkReady });
    fireEvent.click(screen.getByTestId('eph-mark-ready'));
    expect(onMarkReady).toHaveBeenCalled();
    unmount();
    renderHeader({ episode: { ...EPISODE, status: 'in_review' } });
    expect(screen.queryByTestId('eph-mark-ready')).toBeNull();
    expect(screen.getByTestId('eph-ready').textContent).toContain('In review');
  });

  test('a clips read that throws at once leaves the header up', async () => {
    rawClipsApi.list.mockImplementation(() => { throw new Error('boom'); });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderHeader();
    await waitFor(() => expect(console.error).toHaveBeenCalled());
    expect(screen.getByTestId('eph-step-files').className).not.toContain('is-done');
  });
});
