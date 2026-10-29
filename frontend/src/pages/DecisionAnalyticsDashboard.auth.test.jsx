/**
 * SEC-3 (2026-10-29): the decision analytics routes are admin only, so the
 * dashboard must call them through the app's client, which sends the sign-in
 * token. Plain axios sent none, and the page would get 401s.
 */
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(async () => ({ data: { data: [] } })) },
}));
vi.mock('axios', () => ({ default: { get: vi.fn(async () => { throw new Error('plain axios must not be used'); }) } }));

import api from '../services/api';
import axios from 'axios';
import DecisionAnalyticsDashboard from './DecisionAnalyticsDashboard';

describe('DecisionAnalyticsDashboard loads through the signed-in client', () => {
  beforeEach(() => vi.clearAllMocks());

  test('every analytics read goes through services/api, none through plain axios', async () => {
    render(<DecisionAnalyticsDashboard />);
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(4));
    const urls = api.get.mock.calls.map(([u]) => u);
    expect(urls).toEqual(expect.arrayContaining([
      '/api/decision-analytics/stats',
      '/api/decision-analytics/by-type',
      '/api/decision-analytics/timeline?interval=day',
      '/api/decision-analytics/patterns',
    ]));
    expect(axios.get).not.toHaveBeenCalled();
  });
});
