/**
 * SceneModelComparison — base-model comparison UI (Task #2396): two prompts,
 * the server's estimate before anything is generated, confirm, and the
 * side-by-side result with logged costs. Also BaseModelSelect.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../services/api';
import SceneModelComparison, { BaseModelSelect, formatUsd } from './SceneModelComparison';

const ESTIMATE = {
  per_model: [
    { model_key: 'flux-dev', label: 'Flux dev', per_still_usd: 0.025, stills: 2, usd: 0.05 },
    { model_key: 'flux-pro-1.1', label: 'Flux pro 1.1', per_still_usd: 0.04, stills: 2, usd: 0.08 },
    { model_key: 'gpt-image-1.5', label: 'GPT Image 1.5 (high)', per_still_usd: 0.2, stills: 2, usd: 0.4 },
  ],
  total_usd: 0.53,
  unpriced: ['gpt-image-1.5 prompt (text) input tokens are not in the rate table.'],
};

const col = (key, label, w, h, cost) => ({
  model_key: key, label, model: key, width: w, height: h, quality: key === 'gpt-image-1.5' ? 'high' : null,
  logged_total_usd: cost * 2, logged_complete: true,
  sets: [0, 1].map(i => ({
    id: `${key}-${i}`, prompt_index: i, prompt: `P${i}`, base_still_url: `https://s3/${key}-${i}.png`,
    generation_status: 'complete', logged_cost_usd: cost, input_tokens_unpriced: false,
  })),
});
const RESULT = {
  group: 'g-1', prompts: ['P0', 'P1'], default_model: 'flux-dev',
  columns: [col('flux-dev', 'Flux dev', 1024, 576, 0.025), col('flux-pro-1.1', 'Flux pro 1.1', 1024, 576, 0.04), col('gpt-image-1.5', 'GPT Image 1.5 (high)', 1536, 1024, 0.2)],
};

describe('SceneModelComparison', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach(fn => fn?.mockReset?.());
  });

  test('estimate first, then confirm, then the stills side by side with logged costs', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (url.endsWith('/scene-sets/model-comparison')) return { data: { groups: [] } };
      if (url.endsWith('/scene-sets/model-comparison/g-1')) return { data: { data: RESULT } };
      throw new Error(`unexpected GET ${url}`);
    });
    vi.mocked(apiClient.post).mockImplementation(async (url, body) => {
      if (!body.confirm) {
        const err = new Error('400');
        err.response = { data: { code: 'CONFIRM_REQUIRED', estimate: ESTIMATE } };
        throw err;
      }
      return { data: { data: { group: 'g-1', sets: [] } } };
    });

    render(<SceneModelComparison />);
    const review = screen.getByRole('button', { name: /Review estimate/ });
    expect(review.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Scene prompt 1'), { target: { value: 'A cream bedroom' } });
    fireEvent.change(screen.getByLabelText('Scene prompt 2'), { target: { value: 'A glass closet' } });
    fireEvent.click(review);

    const estimate = await screen.findByTestId('compare-estimate');
    expect(within(estimate).getByText('Estimated total: $0.530')).toBeTruthy();
    expect(within(estimate).getByText(/GPT Image 1.5 \(high\): 2 × \$0.200 = \$0.400/)).toBeTruthy();
    expect(within(estimate).getByText(/Plus unpriced parts/)).toBeTruthy();
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/scene-sets/model-comparison', { prompts: ['A cream bedroom', 'A glass closet'] });

    fireEvent.click(screen.getByRole('button', { name: /Confirm and generate/ }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(2));
    expect(apiClient.post.mock.calls[1][1]).toEqual({ prompts: ['A cream bedroom', 'A glass closet'], confirm: true });

    const grid = await screen.findByTestId('compare-grid');
    expect(within(grid).getAllByRole('img')).toHaveLength(6);
    expect(within(grid).getByText(/gpt-image-1.5 · 1536×1024 · high/)).toBeTruthy();
    expect(within(grid).getAllByText(/logged \$0.200/)).toHaveLength(2);
    expect(within(grid).getByText('Logged total: $0.400')).toBeTruthy();
    expect(within(grid).getByText(/current default/)).toBeTruthy();
  });

  test('formatUsd never shows an unpriced cost as $0', () => {
    expect(formatUsd(null)).toBe('unpriced');
    expect(formatUsd(0.025)).toBe('$0.025');
  });
});

describe('BaseModelSelect', () => {
  beforeEach(() => {
    Object.values(apiClient).forEach(fn => fn?.mockReset?.());
  });

  test('lists the models, saves the choice, and empty means the default', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: {
      default_model: 'flux-dev',
      models: [
        { key: 'flux-dev', label: 'Flux dev', width: 1024, height: 576, estimate_usd: 0.025 },
        { key: 'gpt-image-1.5', label: 'GPT Image 1.5 (high)', width: 1536, height: 1024, estimate_usd: 0.2 },
      ],
    } });
    vi.mocked(apiClient.put).mockResolvedValue({ data: { success: true } });
    const onSaved = vi.fn();
    render(<BaseModelSelect set={{ id: 'set-1', base_model: null }} onSaved={onSaved} />);

    const select = screen.getByLabelText('Base still model');
    await screen.findByText(/GPT Image 1.5 \(high\) · 1536×1024 · \$0.200/);
    expect(screen.getByText('Default (Flux dev)')).toBeTruthy();

    fireEvent.change(select, { target: { value: 'gpt-image-1.5' } });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('gpt-image-1.5'));
    expect(apiClient.put).toHaveBeenCalledWith('/api/v1/scene-sets/set-1', { base_model: 'gpt-image-1.5' });

    fireEvent.change(select, { target: { value: '' } });
    await waitFor(() => expect(apiClient.put).toHaveBeenLastCalledWith('/api/v1/scene-sets/set-1', { base_model: null }));
  });
});
