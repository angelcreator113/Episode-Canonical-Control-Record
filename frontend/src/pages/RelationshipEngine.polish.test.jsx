/**
 * The Relationships page, polish (2026-10-24 audit, "I want them all"): the
 * Family header and list count the same ties (spouses are romance), a
 * dismissed seed can be undone, the Web opens on the person the link names,
 * and Lala's role reads Protagonist everywhere.
 */
import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act, configure } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../services/api';
import RelationshipEngine from './RelationshipEngine';

// A cold first run can be slow to transform; give the finds room.
configure({ asyncUtilTimeout: 4000 });

const C = (id, display_name, role_type, extra = {}) => ({ id, display_name, selected_name: null, character_key: id, role_type, ...extra });
const chars = [
  C('lala', 'Lala', 'special', { character_key: 'lala' }),
  C('marcus', 'Truthville', 'pressure', { selected_name: 'Marcus Hale' }),
  C('jade', 'Jade Monroe', 'support'),
  C('dre', 'Dre Coleman', 'support'),
];
const R = (id, a, b, f) => ({
  id, character_id_a: a, character_id_b: b, confirmed: true, connection_mode: 'IRL', status: 'Active', is_romantic: false,
  family_role: null, is_blood_relation: false, tension_state: null, stage: null, updated_at: '2026-10-01T00:00:00Z',
  character_a_name: chars.find(c => c.id === a).selected_name || chars.find(c => c.id === a).display_name,
  character_b_name: chars.find(c => c.id === b).selected_name || chars.find(c => c.id === b).display_name, ...f,
});
const rels = [
  R('rel-jw', 'jade', 'dre', { relationship_type: 'married', family_role: 'husband' }),
  R('rel-lm', 'lala', 'marcus', { relationship_type: 'love_interest', is_romantic: true, stage: 'flirting', situation: 'Flirting at the rail', updated_at: '2026-10-23T00:00:00Z' }),
  R('rel-lj', 'lala', 'jade', { relationship_type: 'best_friend', tension_state: 'calm', stage: 'close_friends' }),
  R('rel-jd', 'jade', 'dre', { relationship_type: 'siblings', family_role: 'brother', is_blood_relation: true }),
];
const seeds = [R('seed-1', 'marcus', 'dre', { relationship_type: 'rival', confirmed: false })];
const events = [
  { id: 'e1', event_type: 'first_meeting', relationship_stage: 'acquaintances', stage_before: 'strangers', tension_before: 1, tension_after: 2, description: 'They meet at the gala', beat: null, quote: null, episode_id: null },
  { id: 'e2', event_type: 'escalation', relationship_stage: 'flirting', stage_before: 'acquaintances', tension_before: 2, tension_after: 4, beat: 11,
    description: 'He asks to see her again', quote: 'Same time next week?', episode_id: 'ep-4', episode_number: 4, episode_title: 'The Gala' },
];

const castReply = () => ({ data: { characters: chars, lala_id: 'lala', relationships: rels, candidates: seeds } });

function mockApi() {
  vi.mocked(apiClient.get).mockImplementation(async (url) => {
    if (url === '/api/v1/relationships/cast') return castReply();
    if (url === '/api/v1/relationships/rel-lm/events') return { data: { events } };
    if (/\/relationships\/[^/]+\/events$/.test(url)) return { data: { events: [] } };
    return { data: {} };
  });
}

const renderAt = (entry = '/relationships') => render(
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/relationships" element={<RelationshipEngine />} />
      <Route path="*" element={<p>elsewhere</p>} />
    </Routes>
  </MemoryRouter>,
);

const setPhone = (phone) => {
  window.matchMedia = vi.fn().mockImplementation((q) => ({
    matches: phone && q.includes('600px'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
};

beforeEach(() => {
  Object.values(apiClient).forEach((fn) => fn.mockReset());
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  setPhone(false);
  mockApi();
});
afterEach(() => { vi.useRealTimers(); });

describe('polish', () => {
  test('Family: the header count and the list agree (a husband is romance, not family)', async () => {
    const { container } = renderAt('/relationships?tab=family');
    // The ties as cards are behind the List toggle (2026-10-24), closed at first.
    // Its count agrees with the header too.
    fireEvent.click(await screen.findByRole('button', { name: /^List · 1 family tie/ }));
    const list = await screen.findByRole('list', { name: 'Family ties' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(container.querySelector('.re-sub-stats').textContent).toBe('1 bond');
    // The List toggle carries the count (2026-10-24); open, it reads "Hide the list".
    expect(screen.getByRole('button', { name: /Hide the list/ }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByLabelText('Love interests and partners').textContent).toContain('husband');
  });

  test('Seeds: dismiss, then Undo brings the seed back', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: { dismissed: true } });
    vi.mocked(apiClient.post).mockResolvedValue({ data: { relationship: seeds[0] } });
    renderAt('/relationships?tab=candidates');
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss Marcus Hale ↔ Dre Coleman' }));
    // Dismiss asks why first (2026-10-24 seeds); the reason rides in the body.
    fireEvent.click(screen.getByRole('radio', { name: 'Wrong for them' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/relationships/dismiss/seed-1', { data: { reason: 'wrong_for_them' } }));
    await screen.findByText('No Proposed Seeds');
    expect(screen.getByText(/Dismissed Marcus Hale and Dre Coleman/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/v1/relationships/seed-1/restore'));
    expect(await screen.findByRole('button', { name: 'Dismiss Marcus Hale ↔ Dre Coleman' })).toBeTruthy();
  });

  test("the Web opens on the link's person (the character page's View full map)", async () => {
    renderAt('/relationships?char=marcus&tab=web');
    const card = await screen.findByRole('dialog', { name: 'Character: Marcus Hale' });
    expect(card.querySelector('.re-webview-info-role').textContent).toBe('Pressure');
  });

  test("Lala's role is Protagonist in the sidebar and on her profile", async () => {
    const { container } = renderAt();
    const side = await screen.findByRole('button', { name: 'Lala, protagonist' });
    expect(side.querySelector('.re-char-role').textContent).toBe('Protagonist');
    await waitFor(() => expect(container.querySelector('.rp-chips')?.textContent).toContain('Protagonist'));
  });
});
