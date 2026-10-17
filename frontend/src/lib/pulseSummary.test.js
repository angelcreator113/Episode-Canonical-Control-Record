/**
 * Admin › The Pulse at a glance (Evoni's Admin mock, 2026-10-17): the four
 * numbers, what needs attention, recent activity and Review's count, from
 * the reads (summarize is pure); a read that fails counts as empty.
 */
import { vi, describe, test, expect, beforeEach } from 'vitest';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));
import api from '../services/api';
import { summarize, growthStat, loadPulseSummary } from './pulseSummary';

const NOW = new Date(2026, 9, 17, 9, 0);
const at = (d, h) => new Date(2026, 9, d, h).toISOString();
const res = (data, extra = {}) => ({ data: { data, ...extra } });

const RAW = {
  wall: res([
    { id: 'd1', release_state: 'scheduled', release_at: at(17, 18), created_at: at(16, 10), gate_json: { pass: false } },
    { id: 'd2', release_state: 'scheduled', release_at: at(18, 9), created_at: at(16, 12) },
    { id: 'd3', release_state: 'held', created_at: at(15, 9) },
  ], { total: 3 }),
  episode: res([{ id: 'e1', created_at: at(14, 9) }], { total: 4 }),
  pending: res([{ id: 'c1' }, { id: 'c2' }]),
  numbers: { data: { numbers: [{ id: 'n1' }], total: 1 } },
  followers: { data: { proposed: [{ cause: 'episode' }, { cause: 'something-else' }] } },
  closeness: null,
  dms: { data: { threads: [{ messages: [{ status: 'draft' }, { status: 'live' }] }] } },
  growth: { data: { line: [{ cause: 'start', change: 1000, count: 1000, label: 'Start' }, { cause: 'episode', change: 140, count: 1140, label: 'Ep 1' }] } },
  live: res([{ id: 'p1', poster_display_name: 'Lala', content_text: 'echo park evenings', updated_at: at(17, 7) }]),
};

describe('summarize', () => {
  test('the four numbers', () => {
    expect(summarize(RAW, NOW).stats).toEqual({
      scheduled: 2, today: 1, drafts: 7, comments: 2,
      growth: { count: 1140, change: 140, pct: 14, label: 'Ep 1' },
    });
  });

  test('what needs attention, only what waits, each with its Review section', () => {
    const rows = summarize(RAW, NOW).attention;
    expect(rows.map((r) => [r.key, r.count, r.section])).toEqual([
      ['drafts', 7, 'prv-wall-drafts'], ['flagged', 1, 'prv-wall-drafts'], ['comments', 2, 'prv-pending'],
      ['tomorrow', 1, 'prv-wall-drafts'], ['numbers', 1, 'prv-numbers'], ['followers', 1, 'prv-episode-followers'], ['dms', 1, 'prv-dms'],
    ]);
    expect(rows[0].title).toBe('7 drafts to release');
    expect(rows[1].title).toBe('1 engine draft flagged');
  });

  test("recent activity, newest first, and Review's count", () => {
    const s = summarize(RAW, NOW);
    expect(s.activity.map((a) => a.key)).toEqual(['live-p1', 'sched-d2', 'sched-d1']);
    expect(s.reviewCount).toBe(7 + 2 + 1 + 1 + 0 + 1);
  });

  test('nothing read is all zeros and empty lists', () => {
    const s = summarize({}, NOW);
    expect(s.stats).toEqual({ scheduled: 0, today: 0, drafts: 0, comments: 0, growth: null });
    expect(s.attention).toEqual([]);
    expect(s.activity).toEqual([]);
  });
});

test('growthStat: a starting count alone has no percentage', () => {
  expect(growthStat({ line: [{ cause: 'start', change: 500, count: 500 }] })).toEqual({ count: 500, change: 0, pct: null, label: null });
  expect(growthStat({ line: [] })).toBeNull();
});

describe('loadPulseSummary', () => {
  beforeEach(() => { vi.mocked(api.get).mockReset(); });
  test('reads the show, and a failed read counts as empty', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url.includes('/comments/pending')) throw new Error('down');
      if (url.includes('from=wall')) return res([{ id: 'd1' }], { total: 1 });
      return { data: {} };
    });
    const s = await loadPulseSummary('show 1', NOW);
    expect(s.stats.drafts).toBe(1);
    expect(s.stats.comments).toBe(0);
    expect(api.get).toHaveBeenCalledWith('/api/v1/pulse-followers/growth?show_id=show%201');
    expect(console.error).toHaveBeenCalledWith('[PulseSummary] comments could not be read:', 'down');
  });
});
