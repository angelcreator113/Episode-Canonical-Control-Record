/**
 * The Relationships page after the 2026-10-26 audit: a quiet refresh keeps
 * the page where she is (no re-applied link, no lost people), the person
 * picked in the sidebar narrows List and Seeds, a refused Save keeps its
 * editor, one seed's action leaves the other cards usable, and Generate
 * aimed at a slot waits for the season.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within, configure } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../services/api';
import RelationshipEngine, { keepOutside, familyOf } from './RelationshipEngine';
import { Inspector, CandidateView, GenModal } from '../components/RelationshipEngine';

configure({ asyncUtilTimeout: 4000 });

const C = (id, display_name, role_type) => ({ id, display_name, selected_name: null, character_key: id, role_type });
const chars = [C('lala', 'Lala', 'special'), C('jade', 'Jade Monroe', 'support'), C('dre', 'Dre Coleman', 'support'), C('nia', 'Nia Okafor', 'mirror')];
const R = (id, a, b, f = {}) => ({
  id, character_id_a: a, character_id_b: b, relationship_type: 'friend', confirmed: true, connection_mode: 'IRL',
  status: 'Active', is_romantic: false, family_role: null, tension_state: null, stage: null, updated_at: '2026-10-01T00:00:00Z', ...f,
});
const rels = [R('rel-lj', 'lala', 'jade'), R('rel-jd', 'jade', 'dre', { relationship_type: 'siblings', family_role: 'brother' }), R('rel-ln', 'lala', 'nia', { relationship_type: 'rival' })];
const seeds = [R('seed-1', 'dre', 'nia', { relationship_type: 'rival', confirmed: false }), R('seed-2', 'lala', 'dre', { confirmed: false })];

let castCalls = 0;
beforeEach(() => {
  Object.values(apiClient).forEach((fn) => fn.mockReset());
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia = vi.fn().mockImplementation((q) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  castCalls = 0;
  vi.mocked(apiClient.get).mockImplementation(async (url) => {
    if (url === '/api/v1/relationships/cast') {
      castCalls += 1;
      return { data: { characters: chars, lala_id: 'lala', relationships: rels, candidates: castCalls === 1 ? seeds : seeds.slice(1) } };
    }
    return { data: {} };
  });
});

const renderAt = (entry) => render(
  <MemoryRouter initialEntries={[entry]}>
    <Routes><Route path="/relationships" element={<RelationshipEngine />} /></Routes>
  </MemoryRouter>,
);

describe('a quiet refresh keeps the page where she is', () => {
  test('a closed deep-linked Inspector stays closed after a confirm', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });
    renderAt('/relationships?rel=rel-lj&tab=list');
    fireEvent.click(await screen.findByRole('button', { name: 'Close inspector' }));
    fireEvent.click(screen.getByRole('tab', { name: /Seeds/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Quick confirm Dre Coleman ↔ Nia Okafor' }));
    await waitFor(() => expect(castCalls).toBe(2));
    // still on Seeds, no Inspector
    expect(screen.getByRole('tab', { name: /Seeds/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Close inspector' })).toBeNull();
  });

  test('keepOutside keeps the people a link brought in, and their pairs', () => {
    const outsider = C('zed', 'Zed', 'support');
    const theirs = R('rel-lz', 'lala', 'zed');
    const state = { outside: ['zed'], chars: [...chars, outsider], rels: [...rels, theirs] };
    const next = keepOutside(state, { chars, rels, cands: [] });
    expect(next.chars.map(c => c.id)).toContain('zed');
    expect(next.rels.map(r => r.id)).toContain('rel-lz');
    // with no one from outside, the read is taken as it is
    expect(keepOutside({ outside: [], chars: [], rels: [] }, { chars, rels }).chars).toBe(chars);
  });
});

describe('the person picked in the sidebar', () => {
  test('narrows List to their relationships, and Show everyone undoes it', async () => {
    renderAt('/relationships?tab=list');
    const people = await screen.findByRole('group', { name: 'People' });
    fireEvent.click(within(people).getByRole('button', { name: /Dre Coleman/ }));
    const table = screen.getByRole('table', { name: 'Relationships list' });
    expect(within(table).getAllByRole('row')).toHaveLength(2); // header + Jade ↔ Dre
    expect(screen.getByText(/Showing relationships of/).textContent).toContain('Dre Coleman');
    fireEvent.click(screen.getByRole('button', { name: 'Show everyone' }));
    expect(within(table).getAllByRole('row')).toHaveLength(4);
  });

  test('a deep link to Seeds with ?char= shows that person’s seeds', async () => {
    renderAt('/relationships?tab=candidates&char=lala');
    await screen.findByRole('button', { name: 'Quick confirm Lala ↔ Dre Coleman' });
    expect(screen.queryByRole('button', { name: 'Quick confirm Dre Coleman ↔ Nia Okafor' })).toBeNull();
  });

  test('familyOf keeps every tie reachable from them, not only their own', () => {
    const fam = [R('a', 'mom', 'lala', { relationship_type: 'parent', family_role: 'mother' }), R('b', 'mom', 'aunt', { relationship_type: 'siblings', family_role: 'sister' }), R('c', 'lala', 'nia', { relationship_type: 'rival' })];
    expect(familyOf(fam, 'lala').map(r => r.id)).toEqual(['a', 'b']);
  });
});

describe('a refused Save keeps the editor', () => {
  test('the Inspector stays in Edit, with her text, when the save fails', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { events: [] } });
    const onUpdate = vi.fn().mockResolvedValue(false);
    const charById = Object.fromEntries(chars.map(c => [c.id, c]));
    render(<Inspector rel={rels[0]} charById={charById} onClose={() => {}} onUpdate={onUpdate} onDelete={() => {}} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    expect(await screen.findByRole('button', { name: 'Save' })).toBeTruthy();
  });
});

describe('one seed in flight', () => {
  test('only that card waits', () => {
    const charById = Object.fromEntries(chars.map(c => [c.id, c]));
    const noop = () => {};
    render(
      <MemoryRouter>
        <CandidateView cands={seeds} charById={charById} busy="seed-1"
          onConfirm={noop} onQuickConfirm={noop} onKeep={noop} onDismiss={noop} onBringBack={noop} onConfirmAll={noop} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Quick confirm Dre Coleman ↔ Nia Okafor' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Quick confirm Lala ↔ Dre Coleman' }).disabled).toBe(false);
  });
});

describe('Generate aimed at a slot', () => {
  test('waits for the season before it can generate', () => {
    vi.mocked(apiClient.get).mockImplementation(() => new Promise(() => {}));
    render(<GenModal chars={chars} genning={false} onGenerate={() => {}} onClose={() => {}} initialSlot="11111111-2222-3333-4444-555555555555" />);
    const btn = screen.getByRole('button', { name: 'Loading the season…' });
    expect(btn.disabled).toBe(true);
  });
});
