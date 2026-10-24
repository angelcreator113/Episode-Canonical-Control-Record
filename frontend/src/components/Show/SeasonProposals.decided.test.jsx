/**
 * From The Pulse › Decided (Evoni's review, 2026-10-24): the decided
 * proposals the server sends as `recent` sit in a fold, "Decided · N",
 * each accepted or dismissed with its date; with or without an open one.
 */
import React from 'react';
import { vi, describe, test, expect } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import SeasonProposals, { decidedDate, decidedProposals } from './SeasonProposals';

const RECENT = [
  { id: 'r1', status: 'accepted', summary: 'Lean into the rivalry.', applied: [{ ok: true }, { ok: true }, { ok: false }], decided_at: '2026-10-22T15:00:00Z', created_at: '2026-10-22T10:00:00Z' },
  { id: 'r2', status: 'dismissed', summary: 'Open a thread for Sift.', applied: null, decided_at: '2026-10-20T09:00:00Z', created_at: '2026-10-19T10:00:00Z' },
  { id: 'r3', status: 'no_change', summary: 'Nothing moved.', created_at: '2026-10-18T10:00:00Z' },
];
const apiWith = (data) => ({ get: vi.fn(async () => ({ data })), post: vi.fn() });

describe('Decided proposals', () => {
  test('a fold "Decided · 2" with accepted and dismissed, their dates; a no-change check is not a decision', async () => {
    render(<SeasonProposals showId="s1" api={apiWith({ open: null, recent: RECENT })} />);
    const fold = await screen.findByTestId('season-proposals-decided');
    expect(fold.tagName).toBe('DETAILS');
    expect(fold.open).toBe(false);
    expect(within(fold).getByText('Decided · 2')).toBeTruthy();
    fireEvent.click(within(fold).getByText('Decided · 2'));
    const accepted = within(fold).getByTestId('season-proposal-decided-r1');
    expect(accepted.textContent).toBe('Accepted · 2 changes applied · 22 Oct 2026Lean into the rivalry.');
    expect(within(fold).getByTestId('season-proposal-decided-r2').textContent).toBe('Dismissed · 20 Oct 2026Open a thread for Sift.');
    expect(within(fold).queryByTestId('season-proposal-decided-r3')).toBeNull();
  });

  test('shown beside an open proposal too', async () => {
    const open = { id: 'p1', status: 'proposed', summary: 'Now', signals: {}, changes: [{ kind: 'slot_intention', slot_number: 3, story_purpose: 'x' }] };
    render(<SeasonProposals showId="s1" api={apiWith({ open, recent: RECENT.slice(1) })} />);
    expect(await screen.findByText('Decided · 1')).toBeTruthy();
  });

  test('no decided proposals: no fold', async () => {
    render(<SeasonProposals showId="s1" api={apiWith({ open: null, recent: [RECENT[2]] })} />);
    await screen.findByTestId('season-proposals');
    expect(screen.queryByTestId('season-proposals-decided')).toBeNull();
  });

  test('helpers', () => {
    expect(decidedProposals(RECENT).map((p) => p.id)).toEqual(['r1', 'r2']);
    expect(decidedProposals(null)).toEqual([]);
    expect(decidedDate('2026-10-24T12:00:00Z')).toBe('24 Oct 2026');
    expect(decidedDate(null)).toBe('');
    expect(decidedDate('not a date')).toBe('');
  });
});
