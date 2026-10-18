/**
 * A content type's shared audiences on the Society tab (idea 4,
 * 2026-10-17): shows the types it shares with and competes with; Edit and
 * Save; Suggest fills the form without saving; Reset for a changed default.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

import api from '../../services/api';
import AudienceLinks, { loadAudienceMap } from './AudienceLinks';

const TYPES = ['The Beauty Oracle', 'The Trendsetter', 'The Luxury Icon'];
const serve = (oracle) => api.get.mockResolvedValue({ data: { types: [
  { name: 'The Beauty Oracle', shares: ['The Trendsetter'], competes: [], custom: false, has_default: true, ...oracle },
  { name: 'The Trendsetter', shares: [], competes: [], custom: false, has_default: true },
] } });

beforeEach(async () => {
  Object.values(api).forEach((fn) => fn.mockReset());
  serve({});
  await loadAudienceMap(true);
});

describe('AudienceLinks', () => {
  test('shows who it shares an audience with and competes with', async () => {
    render(<AudienceLinks name="The Beauty Oracle" types={TYPES} />);
    expect(await screen.findByText('The Trendsetter')).toBeTruthy();
    expect(screen.getByText('none')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reset to default' })).toBeNull();
  });

  test('edits and saves', async () => {
    api.put.mockResolvedValue({ data: { type: { name: 'The Beauty Oracle', shares: ['The Trendsetter'], competes: ['The Luxury Icon'], custom: true, has_default: true } } });
    render(<AudienceLinks name="The Beauty Oracle" types={TYPES} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByLabelText('Competes with: The Luxury Icon'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved.');
    expect(api.put).toHaveBeenCalledWith('/api/v1/cast/audience-map', { name: 'The Beauty Oracle', shares: ['The Trendsetter'], competes: ['The Luxury Icon'] });
    expect(screen.getByText('(yours)', { exact: false })).toBeTruthy();
  });

  test('suggest fills the form and saves nothing', async () => {
    api.post.mockResolvedValue({ data: { shares: ['The Luxury Icon'], competes: [], why: 'Both sell the dream.' } });
    render(<AudienceLinks name="The Beauty Oracle" types={TYPES} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Suggest' }));
    await waitFor(() => expect(screen.getByLabelText('Shares an audience with: The Luxury Icon').checked).toBe(true));
    expect(screen.getByLabelText('Shares an audience with: The Trendsetter').checked).toBe(false);
    expect(api.put).not.toHaveBeenCalled();
    expect(screen.getByText(/Both sell the dream/)).toBeTruthy();
  });

  test('a changed default can reset', async () => {
    serve({ custom: true, shares: ['The Luxury Icon'] });
    await loadAudienceMap(true);
    api.put.mockResolvedValue({ data: { type: { name: 'The Beauty Oracle', shares: ['The Trendsetter'], competes: [], custom: false, has_default: true } } });
    render(<AudienceLinks name="The Beauty Oracle" types={TYPES} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reset to default' }));
    await screen.findByText('Back to the default.');
    expect(api.put).toHaveBeenCalledWith('/api/v1/cast/audience-map', { name: 'The Beauty Oracle', reset: true });
  });
});
