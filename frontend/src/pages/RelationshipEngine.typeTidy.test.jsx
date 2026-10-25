/**
 * The one-time type tidy-up (Evoni, 2026-10-24: "Yes tidy up existing
 * relationships"): a quiet banner when GET /type-tidy has items; Review
 * opens one row per relationship to accept, change or skip; Accept all
 * suggested; Save posts the accepted ones, shows refusals and reloads.
 * The server half (S1) is mocked, as the seeds contract describes it.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within, configure } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../services/api';
import RelationshipEngine from './RelationshipEngine';
import { tidyChanges } from '../components/RelationshipEngine/TypeTidy';

configure({ asyncUtilTimeout: 4000 });

const chars = [
  { id: 'lala', display_name: 'Lala', character_key: 'lala', role_type: 'special' },
  { id: 'marcus', display_name: 'Truthville', selected_name: 'Marcus Hale', character_key: 'marcus', role_type: 'pressure' },
  { id: 'jade', display_name: 'Jade Monroe', character_key: 'jade', role_type: 'support' },
];
const items0 = () => [
  { id: 'r1', a_name: 'Lala', b_name: 'Marcus Hale', current_type: 'Subject turned critic', proposed_type: 'rival', proposed_is_romantic: false, flavour: 'Subject turned critic',
    situation_now: 'He reviews her looks.', situation_after: 'Subject turned critic: He reviews her looks.' },
  { id: 'r2', a_name: 'Jade Monroe', b_name: 'Marcus Hale', current_type: 'Fidelity test', proposed_type: 'love_interest', proposed_is_romantic: true, flavour: 'Fidelity test',
    situation_now: '', situation_after: 'Fidelity test' },
  { id: 'r3', a_name: 'Lala', b_name: 'Jade Monroe', current_type: 'The one who stayed', proposed_type: null, proposed_is_romantic: null, flavour: 'The one who stayed',
    situation_now: 'Jade stayed.', situation_after: 'The one who stayed: Jade stayed.' },
];
let items;

beforeEach(() => {
  Object.values(apiClient).forEach((fn) => fn.mockReset());
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia = vi.fn().mockImplementation((q) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  items = items0();
  vi.mocked(apiClient.get).mockImplementation(async (url) => {
    if (url === '/api/v1/relationships/cast') return { data: { characters: chars, lala_id: 'lala', relationships: [], candidates: [] } };
    if (url === '/api/v1/relationships/type-tidy') return { data: { items } };
    return { data: {} };
  });
});

const renderPage = () => render(
  <MemoryRouter initialEntries={['/relationships?tab=list']}>
    <Routes><Route path="/relationships" element={<RelationshipEngine />} /></Routes>
  </MemoryRouter>,
);
const openReview = async () => {
  renderPage();
  expect(await screen.findByText("3 relationships use types the app doesn't know")).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Review' }));
  return screen.findByRole('dialog', { name: 'Tidy up relationship types' });
};
const row = (dialog, name) => within(dialog).getByRole('listitem', { name });

describe('type tidy-up', () => {
  test('no banner when nothing needs a look, or the read fails', async () => {
    items = [];
    const { unmount } = renderPage();
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/v1/relationships/type-tidy'));
    await screen.findByText('3 people · 0 relationships');
    expect(screen.queryByRole('button', { name: 'Review' })).toBeNull();
    unmount();
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (url === '/api/v1/relationships/type-tidy') throw new Error('500');
      return { data: { characters: chars, relationships: [], candidates: [] } };
    });
    renderPage();
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/v1/relationships/type-tidy'));
    expect(screen.queryByRole('button', { name: 'Review' })).toBeNull();
  });

  test('Review: a row per relationship, current → proposed, situation after; no suggestion waits', async () => {
    const dialog = await openReview();
    const r1 = row(dialog, 'Lala ↔ Marcus Hale');
    expect(within(r1).getByText('‘Subject turned critic’')).toBeTruthy();
    expect(within(r1).getByLabelText('New type for Lala ↔ Marcus Hale').value).toBe('rival');
    expect(within(r1).getByLabelText('Situation after').value).toBe('Subject turned critic: He reviews her looks.');
    expect(within(r1).getByRole('button', { name: 'Accept' }).getAttribute('aria-pressed')).toBe('true');
    const r3 = row(dialog, 'Lala ↔ Jade Monroe');
    expect(within(r3).getByLabelText('New type for Lala ↔ Jade Monroe').value).toBe('');
    expect(within(r3).getByText(/No suggestion/)).toBeTruthy();
    expect(within(r3).getByRole('button', { name: 'Skip' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(dialog).getByRole('button', { name: 'Save 2 changes' })).toBeTruthy();
  });

  test('accept, change, skip and edit the situation; Save posts only the accepted, then reloads', async () => {
    const dialog = await openReview();
    vi.mocked(apiClient.post).mockImplementation(async () => { items = []; return { data: { updated: ['r1', 'r3'], refused: [] } }; });
    // r1: change the situation; r2: skip; r3: pick a type (that accepts it)
    fireEvent.change(within(row(dialog, 'Lala ↔ Marcus Hale')).getByLabelText('Situation after'), { target: { value: 'Critic first, then more.' } });
    fireEvent.click(within(row(dialog, 'Jade Monroe ↔ Marcus Hale')).getByRole('button', { name: 'Skip' }));
    fireEvent.change(within(row(dialog, 'Lala ↔ Jade Monroe')).getByLabelText('New type for Lala ↔ Jade Monroe'), { target: { value: 'best friend' } });
    const castReads = vi.mocked(apiClient.get).mock.calls.filter(([u]) => u === '/api/v1/relationships/cast').length;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save 2 changes' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/v1/relationships/type-tidy', { changes: [
      { id: 'r1', relationship_type: 'rival', is_romantic: false, situation: 'Critic first, then more.' },
      { id: 'r3', relationship_type: 'best friend', is_romantic: false, situation: 'The one who stayed: Jade stayed.' },
    ] }));
    expect(await screen.findByText('2 types tidied')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Tidy up relationship types' })).toBeNull());
    expect(screen.queryByRole('button', { name: 'Review' })).toBeNull();
    expect(vi.mocked(apiClient.get).mock.calls.filter(([u]) => u === '/api/v1/relationships/cast').length).toBeGreaterThan(castReads);
  });

  test('Accept all suggested takes every row with a type; a romance type carries is_romantic', async () => {
    const dialog = await openReview();
    vi.mocked(apiClient.post).mockResolvedValue({ data: { updated: ['r1', 'r2'], refused: [] } });
    fireEvent.click(within(row(dialog, 'Lala ↔ Marcus Hale')).getByRole('button', { name: 'Skip' }));
    fireEvent.click(within(row(dialog, 'Jade Monroe ↔ Marcus Hale')).getByRole('button', { name: 'Skip' }));
    expect(within(dialog).getByRole('button', { name: 'Save 0 changes' }).disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Accept all suggested' }));
    // the row with no suggestion stays skipped until a type is picked
    expect(within(row(dialog, 'Lala ↔ Jade Monroe')).getByRole('button', { name: 'Skip' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save 2 changes' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    const { changes } = vi.mocked(apiClient.post).mock.calls[0][1];
    expect(changes.map((c) => c.id)).toEqual(['r1', 'r2']);
    expect(changes[1]).toMatchObject({ relationship_type: 'love_interest', is_romantic: true, situation: 'Fidelity test' });
  });

  test('a type guessed from the situation is filled in but waits for Accept; Accept all leaves it', async () => {
    items = [...items0(), { id: 'r4', a_name: 'Sable Okonkwo-Reyes', b_name: 'Velour Atelier', current_type: 'mirror_image',
      proposed_type: 'collaborator', proposed_is_romantic: false, proposed_from: 'situation', flavour: 'Mirror image',
      situation_now: 'Velour commissions Sable.', situation_after: 'Mirror image: Velour commissions Sable.' }];
    renderPage();
    expect(await screen.findByText("4 relationships use types the app doesn't know")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    const dialog = await screen.findByRole('dialog', { name: 'Tidy up relationship types' });
    const guess = row(dialog, 'Sable Okonkwo-Reyes ↔ Velour Atelier');
    expect(within(guess).getByText('Guessed from the situation: check it, then Accept.')).toBeTruthy();
    expect(within(guess).getByRole('combobox').value).toBe('collaborator');
    expect(within(guess).getByRole('button', { name: 'Skip' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Accept all suggested' }));
    expect(within(guess).getByRole('button', { name: 'Skip' }).getAttribute('aria-pressed')).toBe('true');
    // a Skip she pressed herself also survives Accept all
    fireEvent.click(within(guess).getByRole('button', { name: 'Skip' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Accept all suggested' }));
    expect(within(guess).getByRole('button', { name: 'Skip' }).getAttribute('aria-pressed')).toBe('true');
    // her own Accept takes it
    fireEvent.click(within(guess).getByRole('button', { name: 'Accept' }));
    vi.mocked(apiClient.post).mockResolvedValue({ data: { updated: ['r1', 'r2', 'r4'], refused: [] } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save 3 changes' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    const { changes } = vi.mocked(apiClient.post).mock.calls[0][1];
    expect(changes.map((c) => c.id)).toEqual(['r1', 'r2', 'r4']);
    expect(changes[2]).toMatchObject({ relationship_type: 'collaborator', situation: 'Mirror image: Velour commissions Sable.' });
  });

  test('a refused one is shown with its reason, and stays to fix', async () => {
    const dialog = await openReview();
    vi.mocked(apiClient.post).mockImplementation(async () => {
      items = items.filter((i) => i.id === 'r2' || i.id === 'r3');
      return { data: { updated: ['r1'], refused: [{ id: 'r2', error: 'They are family (sister), so this cannot be a romance.' }] } };
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save 2 changes' }));
    const refused = await screen.findByRole('list', { name: 'Not changed' });
    expect(refused.textContent).toContain('Jade Monroe ↔ Marcus Hale');
    expect(refused.textContent).toContain('They are family (sister), so this cannot be a romance.');
    const still = screen.getByRole('dialog', { name: 'Tidy up relationship types' });
    expect(within(still).queryByRole('listitem', { name: 'Lala ↔ Marcus Hale' })).toBeNull();
    expect(within(still).getByRole('listitem', { name: 'Jade Monroe ↔ Marcus Hale' })).toBeTruthy();
    expect(screen.getByText('1 type tidied, 1 not')).toBeTruthy();
    expect(await screen.findByText("2 relationships use types the app doesn't know")).toBeTruthy();
  });

  test('Cancel closes without saving', async () => {
    const dialog = await openReview();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Tidy up relationship types' })).toBeNull();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  test('tidyChanges: accepted rows with a type; the situation only when it changed', () => {
    const its = items0();
    const rows = {
      r1: { accept: true, type: 'rival', romantic: false, situation: 'He reviews her looks.' },
      r2: { accept: false, type: 'love_interest', romantic: true, situation: 'x' },
      r3: { accept: true, type: '', romantic: false, situation: '' },
    };
    expect(tidyChanges(its, rows)).toEqual([{ id: 'r1', relationship_type: 'rival', is_romantic: false }]);
  });
});
