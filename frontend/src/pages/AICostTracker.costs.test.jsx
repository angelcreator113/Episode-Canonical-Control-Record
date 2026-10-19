/**
 * The cost page's sections on Admin › AI Costs (components/AICosts/
 * CostOverview; Evoni, 2026-10-19): today against both budgets with their
 * level, unpriced calls named, post pictures (and "not available yet"
 * before the post-pictures column exists), the daily chart with a hover
 * tooltip and a table view, the top lists, spend by feature today or over
 * the range with each feature's raw route names, and a plain note when the
 * budgets are refused.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../services/api';
import AICostTracker, { getCostOverviewApi } from './AICostTracker';

const days = (n) => Array.from({ length: n }, (_, i) => {
  const day = new Date(Date.UTC(2026, 9, 19 - (n - 1 - i))).toISOString().slice(0, 10);
  return { day, text_usd: i === n - 1 ? 3 : 1, image_usd: i === n - 1 ? 8.6 : 0.4, total_usd: i === n - 1 ? 11.6 : 1.4, calls: 10, unpriced_calls: 0 };
});
const feature = (key, label, text, image, routes) => ({
  key, label, text_usd: text, image_usd: image, total_usd: text + image, text_calls: 4, image_calls: 2, unpriced_calls: 0, routes,
});
const overview = (over = {}) => ({
  day: '2026-10-19',
  days: 30,
  budgets: {
    read_ok: true,
    all: { spent_usd: 11.6, cap_usd: 50, left_usd: 38.4, percent: 23.2, level: 'ok' },
    images: { spent_usd: 8.6, cap_usd: 10, left_usd: 1.4, percent: 86, level: 'warn' },
    image_calls: 43,
  },
  alerts: [],
  today: { text_usd: 3, image_usd: 8.6, unpriced_calls: 2 },
  post_pictures: { made_today: 12, limit: 20, waiting: null, waiting_available: false },
  features: {
    today: [feature('camera_roll', 'Camera roll', 0, 6, [{ route_name: 'camera-roll', usd: 6 }]), feature('pulse_engine', 'The Pulse engine', 3, 0, [{ route_name: 'svc:pulseDrafter', usd: 3 }])],
    range: [feature('pulse_engine', 'The Pulse engine', 30, 0, [{ route_name: 'svc:pulseDrafter', usd: 30 }])],
  },
  daily: days(30),
  top_days: [{ day: '2026-10-19', total_usd: 11.6 }],
  top_features: [feature('pulse_engine', 'The Pulse engine', 30, 0, [])],
  ...over,
});

const mockApi = (ov, { refuse = false } = {}) => {
  vi.mocked(apiClient.get).mockImplementation(async (url) => {
    if (url.includes('/cost-overview')) {
      if (refuse) { const err = new Error('403'); err.response = { status: 403 }; throw err; }
      return { data: { success: true, data: ov } };
    }
    if (url.includes('/summary')) return { data: { total_cost: 40, today_cost: 11.6, total_calls: 300 } };
    if (url.includes('/optimizations')) return { data: { tips: [] } };
    return { data: [] };
  });
};

describe('AI Costs — the cost page', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach((fn) => fn?.mockReset?.());
  });

  test('getCostOverviewApi asks for the range, at most 90 days', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: {} });
    await getCostOverviewApi(30);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/ai-usage/cost-overview?days=30');
    await getCostOverviewApi(365);
    expect(apiClient.get).toHaveBeenLastCalledWith('/api/v1/ai-usage/cost-overview?days=90');
  });

  test('today: both budgets with their level, the text/image split and the unpriced calls', async () => {
    mockApi(overview());
    render(<AICostTracker />);
    const all = await screen.findByTestId('aic-budget-all');
    expect(all.textContent).toContain('$11.60');
    expect(all.textContent).toContain('of $50.00');
    expect(all.textContent).toContain('Within budget');
    const images = screen.getByTestId('aic-budget-images');
    expect(images.textContent).toContain('86%');
    expect(images.textContent).toContain('Past 80%');
    expect(within(images).getByRole('meter').getAttribute('aria-valuenow')).toBe('86');
    expect(screen.getByTestId('aic-unpriced').textContent).toContain('2 calls with no price');
  });

  test('post pictures: today against the limit; waiting "not available yet" before the feature exists', async () => {
    mockApi(overview());
    render(<AICostTracker />);
    const pp = await screen.findByTestId('aic-post-pictures');
    expect(pp.textContent).toContain('12');
    expect(pp.textContent).toContain('of 20 a day');
    expect(pp.textContent).toContain('not available yet');
  });

  test('post pictures waiting for tomorrow, when the column exists', async () => {
    mockApi(overview({ post_pictures: { made_today: 20, limit: 20, waiting: 3, waiting_available: true } }));
    render(<AICostTracker />);
    expect((await screen.findByTestId('aic-post-pictures')).textContent).toContain("3 posts waiting for tomorrow's limit");
  });

  test('the chart: hover shows the day\'s text and image spend; the table view lists every day', async () => {
    mockApi(overview());
    render(<AICostTracker />);
    const chart = await screen.findByTestId('aic-chart');
    const legend = within(chart).getByRole('list', { name: 'Legend' });
    expect(legend.textContent).toContain('Text');
    expect(legend.textContent).toContain('Images');
    fireEvent.mouseEnter(screen.getByTestId('aic-bar-2026-10-19'));
    const tip = screen.getByTestId('aic-tip');
    expect(tip.textContent).toContain('Text $3.00');
    expect(tip.textContent).toContain('Images $8.60');
    expect(within(chart).getAllByRole('row')).toHaveLength(31);
  });

  test('top days and features', async () => {
    mockApi(overview());
    render(<AICostTracker />);
    expect((await screen.findByTestId('aic-top-days')).textContent).toContain('$11.60');
    expect(screen.getByTestId('aic-top-features').textContent).toContain('The Pulse engine');
  });

  test('By Feature: grouped spend, today or the range, each with its raw route names', async () => {
    mockApi(overview());
    render(<AICostTracker />);
    await screen.findByTestId('aic-overview');
    fireEvent.click(screen.getByRole('button', { name: /By Feature/ }));
    const table = await screen.findByTestId('aic-features');
    expect(table.textContent).toContain('Camera roll');
    expect(table.textContent).toContain('camera-roll');
    fireEvent.click(within(table).getByRole('button', { name: 'Last 30 days' }));
    expect(table.textContent).not.toContain('Camera roll');
    expect(table.textContent).toContain('$30.00');
    expect(screen.getByText('All route names')).toBeTruthy();
  });

  test('a refusal leaves the rest of the page and says why', async () => {
    mockApi(null, { refuse: true });
    render(<AICostTracker />);
    expect(await screen.findByText('Only an admin can see the budgets.')).toBeTruthy();
    expect(screen.queryByTestId('aic-overview')).toBeNull();
    expect(screen.getByText(/Total Spend/)).toBeTruthy();
  });

  test('the log could not be read: a plain note', async () => {
    mockApi(overview({ budgets: { ...overview().budgets, read_ok: false } }));
    render(<AICostTracker />);
    expect((await screen.findByTestId('aic-today')).textContent).toContain('could not be read');
  });
});
