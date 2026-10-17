/**
 * The Inner life workspace (step 2): five sections, a summary per subject,
 * Edit opening that subject alone, Suggest filling only empty fields with
 * nothing saved, and the Deep profile searched and edited one dimension at
 * a time. The blind spot is the author's.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../../config/api', () => ({ API_URL: '/api/v1' }));

import api from '../../services/api';
import AuthContext from '../../contexts/AuthContext';
import InnerLifeWorkspace from './InnerLifeWorkspace';

const CHARACTER = {
  id: 'c1', status: 'accepted',
  want_architecture: { surface_want: 'To be famous', real_want: 'To be chosen', forbidden_want: 'To quit' },
  wound: { description: 'The shop that closed.', deep_profile_dimensions_affected: ['the_body'] },
  blind_spot: 'She thinks she is the generous one.',
  change_capacity: { mobility: 'conditionally_open', armor_type: 'Wit' },
  deep_profile: { the_body: 'Tall, and she hides it.', grief_loss: { father: 'In winter' } },
};
const gen = (more = {}) => ({ busy: null, note: null, run: vi.fn(), locked: false, ...more });
const ADMIN = { user: { groups: ['admin'] } };

function renderIt({ character = CHARACTER, auth = ADMIN, g = gen(), onSaved = vi.fn() } = {}) {
  render(
    <AuthContext.Provider value={auth}>
      <InnerLifeWorkspace character={character} gen={g} onSaved={onSaved} typeCard={<div data-testid="type-card" />} />
    </AuthContext.Provider>,
  );
  return { g, onSaved };
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
});

describe('the workspace', () => {
  test('five sections with progress; Core shows their type and a summary per subject', () => {
    renderIt();
    const nav = screen.getByRole('navigation', { name: 'Inner life sections' });
    expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Core psychology2/5', 'Emotional architecture2/4', 'Personal history0/4', 'Beliefs & behaviours0/2', 'Deep profile2/14',
    ]);
    expect(screen.getByTestId('type-card')).toBeTruthy();
    const wants = screen.getByTestId('il-subject-wants');
    expect(within(wants).getByText('To be chosen')).toBeTruthy();
    expect(within(wants).getByText('3/3')).toBeTruthy();
    // The forbidden want is not part of the summary.
    expect(within(wants).queryByText('To quit')).toBeNull();
  });

  test('Edit opens that subject only, and saves only what changed, merged onto what is stored', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { success: true, character: { ...CHARACTER, wound: { ...CHARACTER.wound, origin_period: 'Age nine' } } } });
    const { onSaved } = renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Wound' }));
    const form = screen.getByRole('form', { name: 'Edit Wound' });
    expect(screen.queryAllByRole('form')).toHaveLength(1);
    // Other subjects wait while one is open.
    expect(screen.getByRole('button', { name: 'Edit Wants' }).disabled).toBe(true);
    const save = within(form).getByRole('button', { name: 'Save' });
    expect(save.disabled).toBe(true);
    fireEvent.change(within(form).getByLabelText('When it happened'), { target: { value: 'Age nine' } });
    fireEvent.click(save);
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(api.put).toHaveBeenCalledWith('/api/v1/character-registry/characters/c1', {
      wound: { description: 'The shop that closed.', deep_profile_dimensions_affected: ['the_body'], origin_period: 'Age nine' },
    });
    expect(screen.queryByRole('form')).toBeNull();
  });

  test('a failed save keeps the editor open and says why', async () => {
    vi.mocked(api.put).mockRejectedValue({ response: { data: { error: 'Not allowed.' } } });
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Triggers' }));
    fireEvent.change(screen.getByLabelText('Triggers (one per line)'), { target: { value: 'Being ignored' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('Not allowed.')).toBeTruthy());
    expect(screen.getByRole('form', { name: 'Edit Triggers' })).toBeTruthy();
  });

  test('Suggest fills only empty fields and saves nothing', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { proposed: { de_change_capacity: 'highly_rigid', de_change_condition: 'A real apology', de_change_capacity_score: 20 } } });
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: /Emotional architecture/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Change capacity' }));
    fireEvent.click(screen.getByRole('button', { name: /Suggest empty fields/ }));
    await waitFor(() => expect(screen.getByText(/nothing is saved until you press Save/)).toBeTruthy());
    expect(api.post).toHaveBeenCalledWith('/api/v1/character-depth/c1/generate/change');
    // Already chosen: kept. Empty: filled.
    expect(screen.getByLabelText('How far they can change').value).toBe('conditionally_open');
    expect(screen.getByLabelText('What would have to be true for them to change').value).toBe('A real apology');
    expect(api.put).not.toHaveBeenCalled();
  });

  test('the blind spot is the author’s', () => {
    renderIt({ auth: { user: { groups: ['editor'] } } });
    fireEvent.click(screen.getByRole('button', { name: /Emotional architecture/ }));
    expect(screen.queryByTestId('il-subject-blindspot')).toBeNull();
    expect(screen.getByRole('button', { name: /Emotional architecture/ }).textContent).toBe('Emotional architecture1/3');
  });

  test('works with no signed-in user (the blind spot hidden)', () => {
    renderIt({ auth: null });
    fireEvent.click(screen.getByRole('button', { name: /Emotional architecture/ }));
    expect(screen.queryByTestId('il-subject-blindspot')).toBeNull();
  });

  test('an empty subject offers Generate for its own fields', () => {
    const { g } = renderIt({ character: { id: 'c1', status: 'accepted' } });
    const mask = screen.getByTestId('il-subject-mask');
    expect(within(mask).getByText('The mask not written yet.')).toBeTruthy();
    fireEvent.click(within(mask).getByRole('button', { name: /Generate/ }));
    expect(g.run).toHaveBeenCalledWith(['the_mask']);
  });

  test('a finalized character can be read but not edited or generated', () => {
    renderIt({ character: { ...CHARACTER, status: 'finalized', the_mask: null }, g: gen({ locked: true }) });
    expect(screen.queryByRole('button', { name: /^Edit/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Generate/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Fill in everything missing' })).toBeNull();
  });

  test('long text is clamped behind Read more', () => {
    const long = 'She keeps the receipts. '.repeat(20);
    renderIt({ character: { ...CHARACTER, wound: { description: long } } });
    const wound = screen.getByTestId('il-subject-wound');
    const more = within(wound).getByRole('button', { name: 'Read more' });
    expect(wound.querySelector('.il-text').className).toContain('is-clamped');
    fireEvent.click(more);
    expect(wound.querySelector('.il-text').className).not.toContain('is-clamped');
  });
});

describe('the deep profile', () => {
  test('search narrows the dimensions; one opens to read', () => {
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: /Deep profile/ }));
    expect(screen.getByText('2/14 dimensions')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search the dimensions'), { target: { value: 'winter' } });
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.queryByText('The Body')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Grief & Loss' }));
    expect(screen.getByText('father: In winter')).toBeTruthy();
  });

  test('one dimension is edited and saved, the others kept', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { success: true } });
    const { onSaved } = renderIt();
    fireEvent.click(screen.getByRole('button', { name: /Deep profile/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit The Body' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'The Body' }), { target: { value: 'Tall.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const deep_profile = { the_body: 'Tall.', grief_loss: { father: 'In winter' } };
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ deep_profile }));
    expect(api.put).toHaveBeenCalledWith('/api/v1/character-registry/characters/c1', { deep_profile });
  });

  test('an empty dimension can be written', () => {
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: /Deep profile/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit The Unseen' }));
    expect(screen.getByRole('form', { name: 'Edit The Unseen' })).toBeTruthy();
  });
});
