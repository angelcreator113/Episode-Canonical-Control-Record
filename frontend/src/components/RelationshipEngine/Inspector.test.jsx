/**
 * RelationshipEngine/Inspector — the editor and the delete confirm keep what
 * was just clicked; only a different relationship resets them (2026-10-24:
 * the reset on open could land after a first click and undo it).
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

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

describe('Inspector header (2026-10-24)', () => {
  const romance = rel('r9', 'marcus', {
    relationship_type: 'love_interest', is_romantic: true, stage: 'lovers', tension_state: 'volatile',
    public_state: 'secret', situation: 'They kissed in the stairwell; Jade saw.',
  });

  test('"Lala ↔ Marcus Hale" on one line, then what it is, then the situation, then Story so far', async () => {
    const { container } = render(<Inspector rel={romance} {...props} />);
    const pair = screen.getByRole('heading', { name: 'Lala and Marcus Hale' });
    expect(pair.textContent).toBe('Lala↔Marcus Hale');
    const pills = screen.getByRole('group', { name: 'What it is' });
    expect([...pills.children].map((n) => n.textContent)).toEqual(['Love interest', 'Lovers', 'Romance', 'Volatile', 'Secret']);
    const situation = container.querySelector('.re-inspector-situation');
    expect(situation.textContent).toBe('They kissed in the stairwell; Jade saw.');
    // Order on the page: names, pills, situation, then the body (Story so far, Who knows, fields).
    const header = container.querySelector('.re-inspector-header');
    expect([...header.children].map((n) => n.className)).toEqual(['re-inspector-header-top', 're-inspector-pills', 're-inspector-situation']);
    const body = container.querySelector('.re-inspector-body');
    expect(header.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The situation is not repeated as a field below.
    expect(within(body).queryByText('They kissed in the stairwell; Jade saw.')).toBeNull();
    await screen.findByLabelText('Story so far');
  });

  test('Rumoured shows at the top; Known shows nothing there', () => {
    const { rerender } = render(<Inspector rel={rel('r1', 'marcus', { public_state: 'rumoured' })} {...props} />);
    expect(within(screen.getByRole('group', { name: 'What it is' })).getByText('Rumoured')).toBeTruthy();
    rerender(<Inspector rel={rel('r2', 'marcus', { public_state: 'known' })} {...props} />);
    expect(screen.getByRole('group', { name: 'What it is' }).textContent).toBe('Friend');
  });

  test('every edit field is named by its label', () => {
    render(<Inspector rel={rel('r1', 'marcus')} {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    // The family role is not an edit field: it is changed on the Family tab.
    const fields = ['Relationship Type', 'Connection Mode', 'Status', 'Tension State', 'Pain Point', 'Situation',
      'Conflict Summary', 'Lala knows', 'Marcus Hale knows', 'Reader knows', 'Lala Mirror', 'Career Echo', 'Lala Connection', 'Notes'];
    for (const name of fields) {
      const el = screen.getByLabelText(name);
      expect(['INPUT', 'SELECT', 'TEXTAREA']).toContain(el.tagName);
    }
    expect(screen.getByLabelText('Situation').value).toBe('Situation r1');
    expect(screen.getByLabelText('Connection Mode').value).toBe('IRL');
    expect(screen.queryByLabelText('Family Role')).toBeNull();
  });
});

/*
 * seedMode (2026-10-24 seeds): a seed's Confirm opens the editor straight
 * away, with Confirm and Cancel; it sends the contract's fields. The family
 * role is editable only for a family type; a confirmed pair keeps it
 * read-only (the Family tab edits it).
 */
describe('Inspector seedMode', () => {
  const seed = (fields = {}) => rel('s1', 'marcus', { confirmed: false, relationship_type: 'rival', seed_why: 'Built on Episode 3', ...fields });

  test('opens on the editor, pre-filled, with Confirm and Cancel only', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<Inspector rel={seed()} {...props} seedMode onConfirm={onConfirm} onClose={onClose} />);
    expect(screen.getByLabelText('Relationship Type').value).toBe('rival');
    expect(screen.getByLabelText('Situation').value).toBe('Situation s1');
    expect(screen.getByText('Built on Episode 3')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByLabelText('Lala Mirror')).toBeNull();
    expect(screen.queryByLabelText('Family Role (Lala is Marcus Hale\'s …)')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Relationship Type'), { target: { value: 'nemesis' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledWith({
      relationship_type: 'nemesis', connection_mode: 'IRL', status: 'Active', tension_state: '', situation: 'Situation s1',
      pain_point_category: '', lala_connection: 'none', notes: '', is_romantic: true,
    });
  });

  test('a family type: the family role is editable and sent', () => {
    const onConfirm = vi.fn();
    render(<Inspector rel={seed({ relationship_type: 'family', family_role: 'aunt' })} {...props} seedMode onConfirm={onConfirm} />);
    const role = screen.getByLabelText("Family Role (Lala is Marcus Hale's …)");
    expect(role.value).toBe('aunt');
    fireEvent.change(role, { target: { value: 'grandmother' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm.mock.calls[0][0]).toMatchObject({ relationship_type: 'family', family_role: 'grandmother' });
  });

  test('typing a family type opens the family role; a plain type closes it', () => {
    render(<Inspector rel={seed()} {...props} seedMode onConfirm={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Relationship Type'), { target: { value: 'stepsister' } });
    expect(screen.getByLabelText("Family Role (Lala is Marcus Hale's …)")).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Relationship Type'), { target: { value: 'rival' } });
    expect(screen.queryByLabelText("Family Role (Lala is Marcus Hale's …)")).toBeNull();
  });

  test('confirmBusy disables Confirm', () => {
    render(<Inspector rel={seed()} {...props} seedMode confirmBusy onConfirm={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Confirming…' }).disabled).toBe(true);
  });

  test('a confirmed pair: Save sends no family role, which stays read-only', () => {
    const onUpdate = vi.fn();
    render(<Inspector rel={rel('r9', 'jade', { relationship_type: 'family', family_role: 'sister' })} {...props} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByText(/change it on the Family tab/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onUpdate.mock.calls[0][0]).not.toHaveProperty('family_role');
  });
});
