/**
 * The Relationships page, rendered (2026-10-23 audit): the Inspector's
 * story so far, the Overview's love interests and stages, deep links,
 * Delete that asks first and can be undone, Retry, the Family tab keeping
 * romance apart, seeds that add up, and the phone layout (a bottom sheet,
 * list cards).
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

describe('Overview', () => {
  test('a Love interests card with a heart, and the current stage on Recent Relationships and Connections', async () => {
    const { container } = renderAt();
    const card = await waitFor(() => {
      const el = container.querySelector('.rp-love');
      if (!el) throw new Error('no love card');
      return el;
    });
    expect(within(card).getByText('Love interests')).toBeTruthy();
    expect(within(card).getByText('Marcus Hale')).toBeTruthy();
    expect(within(card).getByText('Flirting')).toBeTruthy();
    expect(card.querySelector('.rp-love-heart svg')).toBeTruthy();
    // Recent relationships and connections carry the stage too; one name per person.
    expect(screen.getAllByText('Close friends').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('Truthville')).toBeNull();
    expect(screen.getAllByText('Love interest').length).toBeGreaterThan(0);
    expect(screen.queryByText('love_interest')).toBeNull();
  });
});

describe('deep links', () => {
  test('?char= selects that person', async () => {
    const { container } = renderAt('/relationships?char=jade');
    await waitFor(() => expect(container.querySelector('.rp-name')?.textContent).toBe('Jade Monroe'));
  });

  test('?rel= opens that relationship, with the story so far', async () => {
    renderAt('/relationships?rel=rel-lm');
    const story = await screen.findByLabelText('Story so far');
    await within(story).findByText('He asks to see her again');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/relationships/rel-lm/events');
    const journey = within(story).getByLabelText('Stages so far');
    expect([...journey.querySelectorAll('.re-stage')].map((n) => n.textContent)).toEqual(['Strangers', 'Acquaintances', 'Flirting']);
    expect(within(story).getByText('Tension 2 → 4')).toBeTruthy();
    expect(within(story).getByText('Beat 11')).toBeTruthy();
    expect(within(story).getByText(/Same time next week\?/)).toBeTruthy();
    const ep = within(story).getByRole('link', { name: /Episode 4/ });
    expect(ep.getAttribute('href')).toBe('/episodes/ep-4');
  });
});

describe('the Inspector', () => {
  test('closes when the tab changes', async () => {
    renderAt('/relationships?rel=rel-lm');
    await screen.findByLabelText('Story so far');
    fireEvent.click(screen.getByRole('tab', { name: /Tree/ }));
    await waitFor(() => expect(screen.queryByLabelText('Story so far')).toBeNull());
  });

  test('Delete asks first, then marks it deleted; Undo restores it', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: { deleted: true } });
    vi.mocked(apiClient.post).mockResolvedValue({ data: { relationship: rels[0] } });
    renderAt('/relationships?rel=rel-lm');
    await screen.findByLabelText('Story so far');
    fireEvent.click(screen.getByRole('button', { name: 'Delete this relationship' }));
    expect(apiClient.delete).not.toHaveBeenCalled();
    // The confirm shows after the click; on a busy runner that can take a moment.
    expect(await screen.findByText(/Their story so far is kept/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
    await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/relationships/rel-lm'));
    const undo = await screen.findByRole('button', { name: 'Undo' });
    fireEvent.click(undo);
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/v1/relationships/rel-lm/restore'));
  });

  test('Save sends an emptied field so the server clears it', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: { relationship: { ...rels[0], situation: null } } });
    renderAt('/relationships?rel=rel-lm');
    await screen.findByLabelText('Story so far');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const situation = screen.getByDisplayValue('Flirting at the rail');
    fireEvent.change(situation, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(apiClient.put).toHaveBeenCalled());
    const [url, body] = vi.mocked(apiClient.put).mock.calls[0];
    expect(url).toBe('/api/v1/relationships/rel-lm');
    expect(body.situation).toBe('');
    expect(body.is_romantic).toBe(true);
  });
});

describe('loading', () => {
  test('Retry after a failed load loads again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Network down'));
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(document.querySelector('.rp-love')).toBeTruthy());
    expect(vi.mocked(apiClient.get).mock.calls.filter(([u]) => u === '/api/v1/relationships/cast')).toHaveLength(2);
  });
});

describe('Family and Seeds', () => {
  test('Family lists family only; a love interest sits apart with no family edit', async () => {
    renderAt('/relationships?tab=family');
    const list = await screen.findByRole('list', { name: 'Family ties' });
    expect(within(list).getByText('brother')).toBeTruthy();
    expect(within(list).queryByText('Marcus Hale')).toBeNull();
    const romance = screen.getByLabelText('Love interests and partners');
    expect(within(romance).getByText(/Marcus Hale/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Edit role for Lala and Marcus Hale/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Edit role for Jade Monroe and Dre Coleman/ })).toBeTruthy();
  });

  test('generated seeds join the pending ones', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { candidates: [R('seed-2', 'lala', 'dre', { relationship_type: 'mentor', confirmed: false })] } });
    renderAt('/relationships?tab=candidates');
    await screen.findByText('Rival');
    fireEvent.click(screen.getByRole('button', { name: /◈ Generate/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Generate relationship seeds' });
    fireEvent.click(within(dialog).getByRole('button', { name: /◈ Generate/ }));
    await screen.findByText('Mentor');
    expect(screen.getByText('Rival')).toBeTruthy();
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/relationships/generate', { focus_character_id: null });
  });
});

describe('phone (375px)', () => {
  test('the Inspector is a bottom sheet: a modal dialog, focus inside, Escape closes', async () => {
    setPhone(true);
    const { container } = renderAt('/relationships?rel=rel-lm');
    const sheet = await screen.findByRole('dialog', { name: 'Lala and Marcus Hale' });
    expect(sheet.getAttribute('aria-modal')).toBe('true');
    expect(container.querySelector('.re-inspector-panel.is-sheet')).toBeTruthy();
    expect(container.querySelector('.re-sheet-backdrop')).toBeTruthy();
    await waitFor(() => expect(sheet.contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(sheet, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Lala and Marcus Hale' })).toBeNull());
  });

  test('the backdrop closes the sheet; no empty Inspector placeholder on a phone', async () => {
    setPhone(true);
    const { container } = renderAt('/relationships?tab=list');
    await screen.findAllByText('Marcus Hale');
    expect(container.querySelector('.re-inspector-panel')).toBeNull();
    // the List also renders as cards (the CSS shows them under 600px)
    const cards = container.querySelectorAll('.re-list-card');
    expect(cards.length).toBe(3);
    fireEvent.click(cards[0]);
    await screen.findByRole('dialog', { name: 'Lala and Marcus Hale' });
    fireEvent.click(container.querySelector('.re-sheet-backdrop'));
    await waitFor(() => expect(container.querySelector('.re-inspector-panel')).toBeNull());
  });
});

describe('Add', () => {
  test('the Love interest preset makes a romantic love_interest', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { relationship: R('rel-new', 'jade', 'marcus', { relationship_type: 'love_interest', is_romantic: true }) } });
    renderAt('/relationships?tab=list');
    await screen.findAllByText('Marcus Hale');
    // The toolbar shows once the list tab is applied; on a busy runner that can come after the names.
    fireEvent.click(await screen.findByRole('button', { name: '+ Add' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add relationship' });
    const [a, b] = within(dialog).getAllByRole('combobox');
    fireEvent.change(a, { target: { value: 'jade' } });
    fireEvent.change(b, { target: { value: 'marcus' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Love interest' }));
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Create' })); });
    const [url, body] = vi.mocked(apiClient.post).mock.calls[0];
    expect(url).toBe('/api/v1/relationships');
    expect(body).toMatchObject({ character_id_a: 'jade', character_id_b: 'marcus', relationship_type: 'love_interest', is_romantic: true });
  });
});
