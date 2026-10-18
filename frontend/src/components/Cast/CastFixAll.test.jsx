/**
 * Fix what can be fixed on Facts & checks (Evoni, 2026-10-18): one run over
 * the cast, each change with an Undo, what was left and why, and the
 * rewrites waiting for her one "Apply all" click (untick any to leave it).
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import api from '../../services/api';
import CastFixAll from './CastFixAll';

const RUN = {
  success: true,
  stopped: null,
  summary: { characters: 2, changes: 2, queued: 2, left: 1 },
  characters: [
    {
      id: 'c1', name: 'Sable',
      changes: [
        { id: 'ch1', character_id: 'c1', kind: 'followers', label: 'Followers confirmed at 1.2M' },
        { id: 'ch2', character_id: 'c1', kind: 'typology', label: 'Type set: Type 4w3, The Individualist' },
      ],
      queued: [
        { character_id: 'c1', flag_id: 'aaaaaaaaaaaa', verdict: 'fix', before: 'She owns a yacht.', after: 'She dreams of a yacht.', why: 'She cannot afford one.', field_label: 'Description' },
        { character_id: 'c1', flag_id: 'bbbbbbbbbbbb', verdict: 'fine', before: 'Her mother had a yacht.', after: null, why: 'About her mother.', field_label: 'Wound' },
      ],
      left: ['Their voice: make them Active first.'],
    },
    { id: 'c2', name: 'Nia', changes: [], queued: [], left: [] },
  ],
};

describe('CastFixAll', () => {
  beforeEach(() => { api.post.mockReset(); });

  test('runs the cast, lists the changes and what was left, and refreshes the check', async () => {
    api.post.mockResolvedValueOnce({ data: RUN });
    const onDone = vi.fn();
    render(<CastFixAll registryIds={['r1', 'r2']} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fix what can be fixed' }));
    expect((await screen.findByTestId('cast-fix-summary')).textContent).toBe('2 changes made · 2 rewrites waiting for you');
    expect(api.post).toHaveBeenCalledWith('/api/v1/cast/consistency/fix-all', { registry_id: 'r1,r2' });
    expect(onDone).toHaveBeenCalled();
    const rows = screen.getAllByTestId('cast-fix-row');
    expect(rows).toHaveLength(1);   // Nia had nothing to do
    expect(within(rows[0]).getByText('Followers confirmed at 1.2M')).toBeTruthy();
    expect(within(rows[0]).getByText('Left: Their voice: make them Active first.')).toBeTruthy();
  });

  test('Undo puts one change back', async () => {
    api.post.mockResolvedValueOnce({ data: RUN }).mockResolvedValueOnce({ data: { success: true, ok: true } });
    render(<CastFixAll registryIds={['r1']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fix what can be fixed' }));
    const [first] = await screen.findAllByTestId('cast-fix-change');
    fireEvent.click(within(first).getByRole('button', { name: 'Undo' }));
    expect(await within(first).findByText('Undone')).toBeTruthy();
    expect(api.post).toHaveBeenLastCalledWith('/api/v1/cast/consistency/undo', { change: RUN.characters[0].changes[0] });
  });

  test('Apply all sends the ticked rewrites only', async () => {
    api.post.mockResolvedValueOnce({ data: RUN }).mockResolvedValueOnce({
      data: { success: true, applied: 1, skipped: 0, results: [{ character_id: 'c1', flag_id: 'aaaaaaaaaaaa', ok: true, change: { id: 'ch3', kind: 'text', label: 'Description: rewritten' } }] },
    });
    render(<CastFixAll registryIds={['r1']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fix what can be fixed' }));
    const queue = await screen.findByTestId('cast-fix-queue');
    expect(within(queue).getByText('She dreams of a yacht.')).toBeTruthy();
    expect(within(queue).getByText('Keep as written: Her mother had a yacht.')).toBeTruthy();
    fireEvent.click(within(queue).getAllByRole('checkbox')[1]);
    fireEvent.click(within(queue).getByRole('button', { name: 'Apply all 1' }));
    await waitFor(() => expect(screen.getByTestId('cast-fix-applied')).toBeTruthy());
    expect(api.post).toHaveBeenLastCalledWith('/api/v1/cast/consistency/apply-rewrites', {
      items: [{ character_id: 'c1', flag_id: 'aaaaaaaaaaaa', verdict: 'fix', before: 'She owns a yacht.', after: 'She dreams of a yacht.', why: 'She cannot afford one.' }],
    });
    expect(screen.getByText('Description: rewritten')).toBeTruthy();
  });

  test('a stopped run says why', async () => {
    api.post.mockResolvedValueOnce({ data: { ...RUN, stopped: 'AI daily budget exceeded ($50.00 / $50). Call blocked.' } });
    render(<CastFixAll registryIds={['r1']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fix what can be fixed' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/The run stopped: AI daily budget exceeded/);
  });
});
