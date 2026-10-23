/**
 * Where relationships disagree (Evoni, 2026-10-23): the list comes from
 * GET /relationships/drift and opens when there is something on it; each
 * row says who and what each store says; Fix posts the item's key and
 * reloads (and the map is told); Different on purpose posts keep; an error
 * shows the server's reason; nothing on the list says everything agrees.
 */
import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import api from '../../services/api';
import RelationshipDrift from './RelationshipDrift';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const ITEMS = [
  {
    key: 'pulse_kind:12', kind: 'pulse_kind',
    who: [{ name: 'Nia', handle: '@nia' }, { name: 'Marcus', handle: '@marcus' }],
    says: [{ store: 'Story (Relationships)', value: 'rival' }, { store: 'The Pulse', value: 'bestie' }],
    fix: { label: 'Make it rival on The Pulse' },
  },
  {
    key: 'lala_tie:7', kind: 'lala_tie',
    who: [{ name: 'Lala', handle: null }, { name: 'Dee', handle: '@dee' }],
    says: [{ store: 'Story (Relationships)', value: 'sister' }, { store: "Pulse profile's tie to Lala", value: 'not set' }],
    fix: { label: 'Set their tie to Lala to "knows Lala in person"' },
  },
];

describe('RelationshipDrift', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
  });

  test('lists each disagreement with who and what each store says, open when there are some', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { items: ITEMS } });
    render(<RelationshipDrift />);
    expect(await screen.findByText('Where relationships disagree (2)')).toBeTruthy();
    const rows = await screen.findAllByTestId('rd-item');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Nia (@nia) and Marcus (@marcus)');
    expect(rows[0].textContent).toContain('Story and Pulse disagree');
    expect(rows[0].textContent).toContain('Story (Relationships)rival');
    expect(rows[0].textContent).toContain('The Pulsebestie');
    expect(rows[1].textContent).toContain('Lala and Dee (@dee)');
    expect(api.get).toHaveBeenCalledWith('/api/v1/relationships/drift');
  });

  test('Fix posts the item and reloads; the map is told', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { items: ITEMS } }).mockResolvedValueOnce({ data: { items: [ITEMS[1]] } });
    vi.mocked(api.post).mockResolvedValue({ data: { applied: 'pulse_kind:12' } });
    const onFixed = vi.fn();
    render(<RelationshipDrift onFixed={onFixed} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Make it rival on The Pulse' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/relationships/drift/pulse_kind%3A12/fix', {}));
    expect(await screen.findByText('Fixed: Make it rival on The Pulse.')).toBeTruthy();
    expect(screen.getAllByTestId('rd-item')).toHaveLength(1);
    expect(onFixed).toHaveBeenCalledTimes(1);
  });

  test('Different on purpose posts keep; a refusal shows the reason', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { items: ITEMS } });
    vi.mocked(api.post)
      .mockResolvedValueOnce({ data: { kept: 'lala_tie:7' } })
      .mockRejectedValueOnce({ response: { data: { error: 'That disagreement is not there any more. Reload the list.' } } });
    const onFixed = vi.fn();
    render(<RelationshipDrift onFixed={onFixed} />);
    const keeps = await screen.findAllByRole('button', { name: 'Different on purpose' });
    fireEvent.click(keeps[1]);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/relationships/drift/lala_tie%3A7/keep', {}));
    expect(await screen.findByText(/stay different on purpose/)).toBeTruthy();
    expect(onFixed).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Make it rival on The Pulse' }));
    expect((await screen.findByRole('alert')).textContent).toBe('That disagreement is not there any more. Reload the list.');
  });

  test('nothing to show: closed, and opened it says everything agrees', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { items: [] } });
    render(<RelationshipDrift />);
    const toggle = await screen.findByText('Where relationships disagree (0)');
    expect(screen.queryByTestId('rd-empty')).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByTestId('rd-empty').textContent).toBe('Everything agrees.');
  });
});
