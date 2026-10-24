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
});
