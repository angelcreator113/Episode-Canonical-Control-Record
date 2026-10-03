/**
 * Production coverage (§8(o) item 2; Evoni, 2026-10-03, episode creation
 * step 8): what each beat requires, what is met, and one Continue to the
 * first missing thing; a required clip cell attaches a clip (the clip home).
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import ProductionCoveragePanel from './ProductionCoveragePanel';

const ind = (requirement, met = null, text = null) => ({ requirement, met, text });
const COVERAGE = {
  required: 26, met: 9, untracked: 6, covered: 3, total: 14,
  next: { beat_number: 4, beat_name: 'Interruption Pulse 1', indicator: 'environment', label: 'Environment', text: 'Bedroom has no base image' },
  beats: [
    { number: 1, name: 'Opening Ritual', covered: false, indicators: {
      environment: ind('per_episode'), host: ind('required', null, 'No clip home yet'),
      character: ind('not_required'), interface: ind('not_required', false),
    } },
    { number: 4, name: 'Interruption Pulse 1', covered: false, indicators: {
      environment: ind('required', false, 'Bedroom has no base image'), host: ind('not_required'),
      character: ind('not_required'), interface: ind('required', true, 'Mail — Beat 4'),
    } },
  ],
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
});

describe('ProductionCoveragePanel', () => {
  test('summary separates ready, required and not-tracked; Continue opens the Scenes tab for a missing set', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: COVERAGE } });
    render(<ProductionCoveragePanel episodeId="ep-1" />);
    const panel = await screen.findByTestId('production-coverage');
    expect(api.get).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/production-coverage');
    expect(within(panel).getByTestId('coverage-summary').textContent)
      .toBe('9 of 26 required ready · 6 not tracked yet · 3 of 14 beats covered');
    expect(within(panel).getByTestId('coverage-next').textContent)
      .toBe('Next: Beat 4 · Interruption Pulse 1: Environment (Bedroom has no base image)');
    expect(within(panel).getByTestId('coverage-continue').getAttribute('href')).toBe('/episodes/ep-1?tab=scenes');
  });

  test('an interface gap continues to the Overlays tab', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { ...COVERAGE, next: { ...COVERAGE.next, indicator: 'interface', label: 'Interface' } } } });
    render(<ProductionCoveragePanel episodeId="ep-1" />);
    expect((await screen.findByTestId('coverage-continue')).getAttribute('href')).toBe('/episodes/ep-1?tab=overlays');
  });

  test('the beat grid marks met, missing, not required, per episode and not tracked', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: COVERAGE } });
    render(<ProductionCoveragePanel episodeId="ep-1" />);
    fireEvent.click(await screen.findByTestId('coverage-toggle'));
    expect(screen.getByTestId('coverage-1-environment').textContent).toBe('ep');
    expect(screen.getByTestId('coverage-1-host').textContent).toBe('?');
    expect(screen.getByTestId('coverage-attach-1-host')).toBeTruthy();
    expect(screen.queryByTestId('coverage-attach-1-character')).toBeNull();
    expect(screen.getByTestId('coverage-1-character').textContent).toBe('—');
    expect(screen.getByTestId('coverage-4-environment').textContent).toBe('○');
    expect(screen.getByTestId('coverage-4-environment').getAttribute('title')).toBe('Bedroom has no base image');
    expect(screen.getByTestId('coverage-4-interface').textContent).toBe('✓');
  });

  test('nothing checkable missing says so, with no Continue', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { ...COVERAGE, next: null } } });
    render(<ProductionCoveragePanel episodeId="ep-1" />);
    expect(await screen.findByTestId('coverage-next-none')).toBeTruthy();
    expect(screen.queryByTestId('coverage-continue')).toBeNull();
  });

  test('a failed load says so', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('boom'));
    render(<ProductionCoveragePanel episodeId="ep-1" />);
    expect((await screen.findByTestId('coverage-failed')).textContent).toBe('Production coverage could not be loaded.');
  });

  describe('attaching a clip', () => {
    const CLIP_NEXT = {
      ...COVERAGE,
      next: { beat_number: 1, beat_name: 'Opening Ritual', indicator: 'host', label: 'JustAWoman clip', text: 'No clip attached' },
    };
    const VIDEO = { id: 'a-1', name: 'Headphones take', media_type: 'video' };
    const IMAGE = { id: 'a-2', name: 'Poster', media_type: 'image', content_type: 'image/png' };
    const routes = (clips = []) => vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.endsWith('/performance-clips')) return { data: { data: clips } };
      if (url.startsWith('/api/v1/assets')) return { data: { data: [VIDEO, IMAGE, { id: 'a-3', name: 'Take 2', content_type: 'video/mp4' }] } };
      return { data: { data: CLIP_NEXT } };
    });

    test('a missing clip as next offers Attach, which picks an episode video and saves it', async () => {
      routes();
      vi.mocked(api.put).mockResolvedValue({ data: { data: {} } });
      render(<ProductionCoveragePanel episodeId="ep-1" />);
      expect(screen.queryByTestId('coverage-continue')).toBeNull();
      fireEvent.click(await screen.findByTestId('coverage-attach-next'));
      const form = screen.getByTestId('clip-form');
      expect(form.textContent).toContain('JustAWoman clip · Beat 1 · Opening Ritual');
      await waitFor(() => expect(within(form).getAllByRole('option')).toHaveLength(3));
      expect(within(form).getAllByRole('option').map((o) => o.textContent)).toEqual(['None (use a URL)', 'Headphones take', 'Take 2']);
      expect(api.get).toHaveBeenCalledWith('/api/v1/assets?episode_id=ep-1&limit=100');
      fireEvent.change(screen.getByTestId('clip-asset'), { target: { value: 'a-1' } });
      expect(screen.queryByTestId('clip-url')).toBeNull();
      fireEvent.change(screen.getByTestId('clip-label'), { target: { value: 'Headphones on' } });
      fireEvent.click(screen.getByTestId('clip-approved'));
      fireEvent.click(screen.getByTestId('clip-save'));
      await waitFor(() => expect(screen.queryByTestId('clip-form')).toBeNull());
      expect(api.put).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/performance-clips', {
        canonical_beat_number: 1, performer: 'justawoman', asset_id: 'a-1', video_url: null, label: 'Headphones on', status: 'approved',
      });
      // Coverage and the clip list reload after a save.
      expect(vi.mocked(api.get).mock.calls.filter(([u]) => u.endsWith('/production-coverage'))).toHaveLength(2);
    });

    test('a pasted URL saves as a draft; Save stays off until there is a clip', async () => {
      routes();
      vi.mocked(api.put).mockResolvedValue({ data: { data: {} } });
      render(<ProductionCoveragePanel episodeId="ep-1" />);
      fireEvent.click(await screen.findByTestId('coverage-attach-next'));
      expect(screen.getByTestId('clip-save').disabled).toBe(true);
      fireEvent.change(screen.getByTestId('clip-url'), { target: { value: ' https://cdn.example/take.mp4 ' } });
      fireEvent.click(screen.getByTestId('clip-save'));
      await waitFor(() => expect(api.put).toHaveBeenCalled());
      expect(vi.mocked(api.put).mock.calls[0][1]).toMatchObject({ asset_id: null, video_url: 'https://cdn.example/take.mp4', label: null, status: 'draft' });
    });

    test('an attached clip opens filled in from the grid, and Remove deletes it', async () => {
      routes([{ id: 'clip-9', canonical_beat_number: 1, performer: 'justawoman', video_url: 'https://cdn.example/old.mp4', label: 'Old take', status: 'draft' }]);
      vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
      render(<ProductionCoveragePanel episodeId="ep-1" />);
      fireEvent.click(await screen.findByTestId('coverage-toggle'));
      fireEvent.click(screen.getByTestId('coverage-attach-1-host'));
      await waitFor(() => expect(screen.getByTestId('clip-label').value).toBe('Old take'));
      expect(screen.getByTestId('clip-url').value).toBe('https://cdn.example/old.mp4');
      expect(screen.getByTestId('clip-save').textContent).toBe('Save clip');
      fireEvent.click(screen.getByTestId('clip-remove'));
      await waitFor(() => expect(screen.queryByTestId('clip-form')).toBeNull());
      expect(api.delete).toHaveBeenCalledWith('/api/v1/episode-brief/ep-1/performance-clips/clip-9');
    });

    test('a refused save shows the reason and keeps the form open', async () => {
      routes();
      vi.mocked(api.put).mockRejectedValue({ response: { data: { error: 'video_url must start with http:// or https://' } } });
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(<ProductionCoveragePanel episodeId="ep-1" />);
      fireEvent.click(await screen.findByTestId('coverage-attach-next'));
      fireEvent.change(screen.getByTestId('clip-url'), { target: { value: 'ftp://x' } });
      fireEvent.click(screen.getByTestId('clip-save'));
      expect((await screen.findByTestId('clip-error')).textContent).toBe('video_url must start with http:// or https://');
      expect(screen.getByTestId('clip-form')).toBeTruthy();
      spy.mockRestore();
    });
  });
});
