/**
 * Production coverage (§8(o) item 2; Evoni, 2026-10-03, episode creation
 * step 8): what each beat requires, what is met, and one Continue to the
 * first missing thing. Clips read "not tracked yet", never missing.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

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
      .toBe('9 of 26 required ready · 6 not tracked yet (clips have no home yet) · 3 of 14 beats covered');
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
});
