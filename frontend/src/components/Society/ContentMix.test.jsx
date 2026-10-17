/**
 * A content type's mix on the Society tab (idea 3, 2026-10-17): shows the
 * pillars with shares; Edit and Save; Suggest fills the form (nothing saved
 * until Save); Reset goes back to the default.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

import api from '../../services/api';
import ContentMix from './ContentMix';

const ORACLE = {
  name: 'The Beauty Oracle', custom: false, has_default: true,
  pillars: [{ name: 'Tutorial', share: 60, example: 'Step by step' }, { name: 'Verdict', share: 40, example: '' }],
};

beforeEach(() => Object.values(api).forEach((fn) => fn.mockReset()));

describe('ContentMix', () => {
  test('shows the pillars with their shares and examples', () => {
    render(<ContentMix type={ORACLE} />);
    expect(screen.getByText('Tutorial')).toBeTruthy();
    expect(screen.getByText('60%')).toBeTruthy();
    expect(screen.getByText('Step by step')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reset to default' })).toBeNull();
  });

  test('edits and saves a mix', async () => {
    const onSaved = vi.fn();
    api.put.mockResolvedValue({ data: { pillars: [{ name: 'Glass skin', share: 60, example: 'Step by step' }, { name: 'Verdict', share: 40, example: '' }] } });
    render(<ContentMix type={ORACLE} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit mix' }));
    fireEvent.change(screen.getAllByLabelText('Name')[0], { target: { value: 'Glass skin' } });
    expect(screen.getByText('Shares add up to 100%.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save mix' }));
    await screen.findByText('Saved. Shares are scaled to add up to 100.');
    expect(api.put).toHaveBeenCalledWith('/api/v1/cast/content-pillars', { name: 'The Beauty Oracle', pillars: [{ name: 'Glass skin', share: 60, example: 'Step by step' }, { name: 'Verdict', share: 40, example: '' }] });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ custom: true }));
  });

  test('suggest fills the form without saving; a type with no mix says so', async () => {
    api.post.mockResolvedValue({ data: { pillars: [{ name: 'Skit', share: 70, example: 'a' }, { name: 'Reaction', share: 30, example: 'b' }] } });
    render(<ContentMix type={{ name: 'The Night Owl', pillars: [], custom: false, has_default: false }} />);
    expect(screen.getByText('No mix yet. Suggest one, or write your own.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Suggest a mix' }));
    await waitFor(() => expect(screen.getAllByLabelText('Name')[0].value).toBe('Skit'));
    expect(api.put).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledWith('/api/v1/cast/content-pillars/suggest', { name: 'The Night Owl' });
  });

  test('a custom mix of a default type can reset to the default', async () => {
    const onSaved = vi.fn();
    api.put.mockResolvedValue({ data: { pillars: ORACLE.pillars } });
    render(<ContentMix type={{ ...ORACLE, custom: true }} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reset to default' }));
    await screen.findByText('Back to the default mix.');
    expect(api.put).toHaveBeenCalledWith('/api/v1/cast/content-pillars', { name: 'The Beauty Oracle', pillars: null });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ custom: false }));
  });
});
