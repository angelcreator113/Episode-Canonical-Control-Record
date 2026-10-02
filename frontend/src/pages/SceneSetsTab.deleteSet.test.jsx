/**
 * D1 and D2 (Evoni, 2026-10-02) on the Scene Sets page:
 *   D1. "Deleting a scene set that episodes, beats or locations use asks for
 *   a replacement set and moves every use ... to it; deleting without a
 *   replacement shows how many uses will be left pointing at a removed set."
 *   D2. "A scene set created while working in a show gets that show's
 *   show_id."
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() } }));

import apiClient from '../services/api';
import { DeleteSetDialog, createShowIdFor, SetShowSelect } from './SceneSetsTab';

const SET = { id: 'set-old', name: "Lala's Closet", show_id: 'show-1' };
const SETS = [SET, { id: 'set-new', name: "lala's closet", show_id: 'show-1' }, { id: 'set-other', name: 'Other show set', show_id: 'show-2' }];
const USES = { locations: 1, beats: 4, events: 0, defaults: 1, scenes: 4, total: 10 };

describe('DeleteSetDialog (D1)', () => {
  beforeEach(() => Object.values(apiClient).forEach((fn) => fn.mockReset()));

  test('lists the uses, offers the show\'s other sets, and moves the uses to the chosen one', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: { success: true, moved: { beats: 4 } } });
    const onDone = vi.fn();
    render(<DeleteSetDialog set={SET} uses={USES} sets={SETS} onDone={onDone} onCancel={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByTestId('delete-set-uses').textContent).toBe('Used by 1 episode location, 4 beats, 1 show default, 4 scenes.');
    const select = within(dialog).getByLabelText('Replacement set');
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Choose a replacement…', "lala's closet", 'Other show set']);
    expect(within(dialog).getByRole('button', { name: /Move uses and delete/ }).disabled).toBe(true);
    fireEvent.change(select, { target: { value: 'set-new' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Move uses and delete/ }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/scene-sets/set-old?replacement_id=set-new');
  });

  test('deleting without a replacement says how many uses will point at a removed set', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: { success: true } });
    const onDone = vi.fn();
    render(<DeleteSetDialog set={SET} uses={USES} sets={SETS} onDone={onDone} onCancel={vi.fn()} />);
    const anyway = screen.getByRole('button', { name: 'Delete anyway (10 uses left pointing at a removed set)' });
    fireEvent.click(anyway);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/scene-sets/set-old?confirm_orphan=true');
  });
});

describe('createShowIdFor (D2)', () => {
  test('the show the page is in, else the one chosen, else the only show', () => {
    expect(createShowIdFor({ pageShowId: 'show-1', chosen: '', shows: [] })).toBe('show-1');
    expect(createShowIdFor({ pageShowId: null, chosen: 'show-2', shows: [{ id: 'show-1' }, { id: 'show-2' }] })).toBe('show-2');
    expect(createShowIdFor({ pageShowId: null, chosen: '', shows: [{ id: 'show-1' }] })).toBe('show-1');
    expect(createShowIdFor({ pageShowId: null, chosen: '', shows: [{ id: 'show-1' }, { id: 'show-2' }] })).toBeNull();
  });
});

describe('SetShowSelect (D2: an existing set\'s show)', () => {
  beforeEach(() => Object.values(apiClient).forEach((fn) => fn.mockReset()));

  test('lists the shows, saves the choice, and "No show" clears it', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: { success: true } });
    const onSaved = vi.fn();
    render(<SetShowSelect set={{ id: 'set-1', show_id: null }} shows={[{ id: 'show-1', name: 'Styling Adventures' }, { id: 'show-2', title: 'Other' }]} onSaved={onSaved} />);
    const select = screen.getByLabelText('Show');
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['No show', 'Styling Adventures', 'Other']);
    fireEvent.change(select, { target: { value: 'show-1' } });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('show-1'));
    expect(apiClient.put).toHaveBeenCalledWith('/api/v1/scene-sets/set-1', { show_id: 'show-1' });
    fireEvent.change(select, { target: { value: '' } });
    await waitFor(() => expect(apiClient.put).toHaveBeenLastCalledWith('/api/v1/scene-sets/set-1', { show_id: null }));
  });
});
