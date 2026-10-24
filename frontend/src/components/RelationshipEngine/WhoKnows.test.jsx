/**
 * RelationshipEngine/WhoKnows — "Who knows" in the Inspector (2026-10-23).
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../../services/api';
import WhoKnows, { knowerName } from './WhoKnows';

const charById = {
  lala: { id: 'lala', display_name: 'Lala' },
  marcus: { id: 'marcus', display_name: 'Truthville', selected_name: 'Marcus Hale' },
  jade: { id: 'jade', display_name: 'Jade Monroe', feed_profile_id: 7 },
  dre: { id: 'dre', display_name: 'Dre' },
};
const rel = (fields = {}) => ({
  id: 'r1', character_id_a: 'lala', character_id_b: 'marcus', relationship_type: 'love_interest', is_romantic: true,
  known_by: [{ registry_character_id: 'jade', how: 'saw them on the balcony' }], public_state: 'secret', updated_at: 't0', ...fields,
});

beforeEach(() => Object.values(apiClient).forEach((fn) => fn.mockReset()));

describe('WhoKnows', () => {
  test('shows who knows, where everyone else stands, and who can be added', () => {
    render(<WhoKnows rel={rel()} charById={charById} />);
    expect(screen.getByRole('heading', { name: 'Who knows' })).toBeTruthy();
    expect(screen.getByText('Lala and Marcus Hale know, of course.')).toBeTruthy();
    expect(screen.getByText('Jade Monroe').closest('li').getAttribute('title')).toBe('saw them on the balcony');
    expect(screen.getByRole('radio', { name: /Secret/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText(/Everyone else:/).closest('p').textContent).toBe('Everyone else: doesn’t know');
    // The two of them and Jade are not offered; Dre is.
    const options = [...screen.getByRole('combobox').querySelectorAll('option')].map((o) => o.textContent);
    expect(options).toEqual(['Choose from the cast…', 'Dre']);
  });

  test('adding from the cast saves the list and hands the saved row back', async () => {
    const saved = rel({ known_by: [{ registry_character_id: 'jade' }, { registry_character_id: 'dre' }], updated_at: 't1' });
    vi.mocked(apiClient.put).mockResolvedValue({ data: { relationship: saved } });
    const onSaved = vi.fn();
    render(<WhoKnows rel={rel()} charById={charById} onSaved={onSaved} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'dre' } });
    expect(screen.getByText('Dre')).toBeTruthy();
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(apiClient.put).toHaveBeenCalledWith('/api/v1/relationships/r1', {
      known_by: [{ registry_character_id: 'jade', how: 'saw them on the balcony' }, { registry_character_id: 'dre' }],
    });
  });

  test('removing a person, and picking Rumoured, each save', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: { relationship: null } });
    render(<WhoKnows rel={rel()} charById={charById} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Jade Monroe' }));
    expect(screen.getByText('Nobody else is listed.')).toBeTruthy();
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/api/v1/relationships/r1', { known_by: [] }));
    fireEvent.click(screen.getByRole('radio', { name: /Rumoured/ }));
    expect(screen.getByText(/Everyone else:/).closest('p').textContent).toBe('Everyone else: has only heard talk');
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/api/v1/relationships/r1', { public_state: 'rumoured' }));
  });

  test('a failed save puts it back and says why', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(apiClient.put).mockRejectedValue({ response: { data: { error: 'Someone listed as knowing is not a character.' } } });
    render(<WhoKnows rel={rel()} charById={charById} />);
    fireEvent.click(screen.getByRole('radio', { name: /Known/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('Someone listed as knowing is not a character.');
    expect(screen.getByRole('radio', { name: /Secret/ }).getAttribute('aria-checked')).toBe('true');
  });

  test('an old row with nothing set reads as Known, nobody listed', () => {
    render(<WhoKnows rel={rel({ known_by: undefined, public_state: undefined })} charById={charById} />);
    expect(screen.getByRole('radio', { name: /Known/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Nobody else is listed.')).toBeTruthy();
    expect(screen.getByText(/Everyone else:/).closest('p').textContent).toBe('Everyone else: knows');
  });

  test('knowerName: a cast member, a Feed profile, a name', () => {
    expect(knowerName({ registry_character_id: 'marcus' }, charById)).toBe('Marcus Hale');
    expect(knowerName({ profile_id: 7 }, charById)).toBe('Jade Monroe');
    expect(knowerName({ profile_id: 9, name: 'Gossip Gal' }, charById)).toBe('Gossip Gal');
    expect(knowerName({ profile_id: 9 }, charById)).toBe('Feed profile #9');
    expect(knowerName({ name: 'The doorman' }, charById)).toBe('The doorman');
    expect(knowerName({ registry_character_id: 'gone' }, charById)).toBe('Someone no longer in the cast');
  });
});
