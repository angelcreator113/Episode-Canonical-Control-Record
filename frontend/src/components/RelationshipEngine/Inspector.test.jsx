/**
 * RelationshipEngine/Inspector — the editor and the delete confirm keep what
 * was just clicked; only a different relationship resets them (2026-10-24:
 * the reset on open could land after a first click and undo it).
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../../services/api';
import Inspector from './Inspector';

const charById = {
  lala: { id: 'lala', display_name: 'Lala' },
  marcus: { id: 'marcus', display_name: 'Truthville', selected_name: 'Marcus Hale' },
  jade: { id: 'jade', display_name: 'Jade Monroe' },
};
const rel = (id, b, fields = {}) => ({
  id, character_id_a: 'lala', character_id_b: b, relationship_type: 'friend', confirmed: true,
  connection_mode: 'IRL', status: 'Active', is_romantic: false, situation: `Situation ${id}`, ...fields,
});
const props = { charById, onClose: () => {}, onUpdate: () => {}, onDelete: () => {}, onSaved: () => {} };

beforeEach(() => {
  Object.values(apiClient).forEach((fn) => fn.mockReset());
  vi.mocked(apiClient.get).mockResolvedValue({ data: { events: [] } });
});

describe('Inspector', () => {
  test('the same relationship drawn again keeps the editor open', () => {
    const { rerender } = render(<Inspector rel={rel('r1', 'marcus')} {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByDisplayValue('Situation r1')).toBeTruthy();
    // A save or reload hands a new object for the same relationship.
    rerender(<Inspector rel={rel('r1', 'marcus', { updated_at: 'later' })} {...props} />);
    expect(screen.getByDisplayValue('Situation r1')).toBeTruthy();
  });

  test('a different relationship closes the editor and the delete confirm', () => {
    const { rerender } = render(<Inspector rel={rel('r1', 'marcus')} {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete this relationship' }));
    expect(screen.getByText(/Their story so far is kept/)).toBeTruthy();
    rerender(<Inspector rel={rel('r2', 'jade')} {...props} />);
    expect(screen.queryByText(/Their story so far is kept/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByDisplayValue('Situation r2')).toBeTruthy();
    rerender(<Inspector rel={rel('r1', 'marcus')} {...props} />);
    expect(screen.queryByDisplayValue('Situation r2')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
  });

  // 2026-10-24 audit: the form kept what it had when the Inspector opened,
  // and Save put back a family role the Family tab had changed since.
  test('Edit starts from the relationship as it is now', () => {
    const { rerender } = render(<Inspector rel={rel('r1', 'jade', { family_role: 'mother' })} {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    // The Family tab changed it; the same relationship comes back changed.
    rerender(<Inspector rel={rel('r1', 'jade', { family_role: 'aunt', situation: 'Changed on the Family tab' })} {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByDisplayValue('Changed on the Family tab')).toBeTruthy();
  });

  test('the family role is read-only here and never sent with Save', () => {
    const onUpdate = vi.fn();
    render(<Inspector rel={rel('r1', 'jade', { family_role: 'aunt' })} {...props} onUpdate={onUpdate} />);
    expect(screen.getByText('Lala is Jade Monroe\'s aunt')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.queryByDisplayValue('aunt')).toBeNull();
    expect(screen.queryByPlaceholderText('mother, brother…')).toBeNull();
    expect(screen.getByText('Lala is Jade Monroe\'s aunt (change it on the Family tab)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0][0]).not.toHaveProperty('family_role');
    expect(onUpdate.mock.calls[0][0]).toMatchObject({ situation: 'Situation r1', is_romantic: false });
  });
});
