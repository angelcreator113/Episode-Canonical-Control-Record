/**
 * The Relationships page's data fixes, rendered (Evoni, 2026-10-24: "I want
 * them all"): an error toast says the server's reason; a link to someone
 * outside the cast opens them; seeds dismissed while a generator runs stay
 * gone; the Overview's "Relationship With Lala" comes from the pair with
 * Lala; Add with Mother says it is a family tie.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act, configure } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../services/api';
import RelationshipEngine, { errText } from './RelationshipEngine';

configure({ asyncUtilTimeout: 4000 });

const C = (id, display_name, role_type, extra = {}) => ({ id, display_name, selected_name: null, character_key: id, role_type, ...extra });
const chars = [
  C('lala', 'Lala', 'special', { character_key: 'lala' }),
  C('jade', 'Jade Monroe', 'support'),
  C('dre', 'Dre Coleman', 'support'),
];
const nameOf = (id) => [...chars, C('mom', 'Mona Reyes', 'support')].find(c => c.id === id).display_name;
const R = (id, a, b, f) => ({
  id, character_id_a: a, character_id_b: b, confirmed: true, connection_mode: 'IRL', status: 'Active', is_romantic: false,
  family_role: null, is_blood_relation: false, tension_state: null, stage: null, updated_at: '2026-10-01T00:00:00Z',
  character_a_name: nameOf(a), character_b_name: nameOf(b), relationship_type: 'friend', lala_connection: 'none', ...f,
});
const rels = [
  R('rel-lj', 'lala', 'jade', { relationship_type: 'best_friend', lala_connection: 'knows_lala' }),
  // Jade's pair with Dre says "interacts with content"; it is not about Lala.
  R('rel-jd', 'jade', 'dre', { relationship_type: 'collaborator', lala_connection: 'interacts_content', updated_at: '2026-10-20T00:00:00Z' }),
];
const seeds = [R('seed-1', 'jade', 'dre', { relationship_type: 'rival', confirmed: false })];

function mockApi(extra = () => undefined) {
  vi.mocked(apiClient.get).mockImplementation(async (url) => {
    const hit = extra(url);
    if (hit !== undefined) return hit;
    if (url === '/api/v1/relationships/cast') return { data: { characters: chars, lala_id: 'lala', relationships: rels, candidates: seeds } };
    if (/\/relationships\/[^/]+\/events$/.test(url)) return { data: { events: [] } };
    return { data: {} };
  });
}
const notFound = (error) => Object.assign(new Error('Request failed with status code 404'), { response: { status: 404, data: { error } } });

const renderAt = (entry = '/relationships') => render(
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/relationships" element={<RelationshipEngine />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  Object.values(apiClient).forEach((fn) => fn.mockReset());
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia = vi.fn().mockImplementation((q) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mockApi();
});

describe('errText', () => {
  test("the server's error, else its message, else the client's, else the fallback", () => {
    expect(errText({ response: { data: { error: 'They are family (mother)' } }, message: 'Request failed with status code 409' }, 'x')).toBe('They are family (mother)');
    expect(errText({ response: { data: { message: 'From message' } }, message: 'm' }, 'x')).toBe('From message');
    expect(errText({ message: 'Network Error' }, 'x')).toBe('Network Error');
    expect(errText(null, 'Update failed')).toBe('Update failed');
  });
});

describe("the server's reason in an error toast", () => {
  test('ticking Romantic on a mother pair: the refusal says why', async () => {
    vi.mocked(apiClient.put).mockRejectedValue(Object.assign(new Error('Request failed with status code 409'), {
      response: { status: 409, data: { error: 'They are family (mother), so this cannot be a romance. Change the family role on the Family tab first.' } },
    }));
    renderAt('/relationships?rel=rel-lj');
    await screen.findByLabelText('Story so far');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Romantic/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/They are family \(mother\), so this cannot be a romance/)).toBeTruthy();
    expect(screen.queryByText(/status code 409/)).toBeNull();
  });

  test('a failed generate says the budget is used up', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(Object.assign(new Error('Request failed with status code 429'), {
      response: { status: 429, data: { error: "Today's AI budget is used up, so Generate cannot run until tomorrow." } },
    }));
    renderAt('/relationships?tab=candidates');
    fireEvent.click(await screen.findByRole('button', { name: /◈ Generate/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Generate relationship seeds' });
    fireEvent.click(within(dialog).getByRole('button', { name: /◈ Generate/ }));
    expect(await screen.findByText(/Today's AI budget is used up/)).toBeTruthy();
  });
});

describe('deep links to someone outside the cast', () => {
  test('?rel= for a pair not loaded fetches it, adds the two people and opens the Inspector', async () => {
    const off = R('rel-mom', 'mom', 'jade', { relationship_type: 'family', family_role: 'mother', situation: 'Off the cast' });
    mockApi((url) => (url === '/api/v1/relationships/rel-mom'
      ? { data: { relationship: off, characters: [C('mom', 'Mona Reyes', 'support'), chars[1]] } } : undefined));
    renderAt('/relationships?rel=rel-mom');
    const panel = await screen.findByRole('complementary', { name: 'Mona Reyes and Jade Monroe' });
    expect(within(panel).getByText('Off the cast')).toBeTruthy();
    expect(within(panel).getByText("Mona Reyes is Jade Monroe's mother")).toBeTruthy();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/relationships/rel-mom');
  });

  test("one that is gone says so instead of a blank page", async () => {
    mockApi((url) => {
      if (url === '/api/v1/relationships/rel-gone') throw notFound("That relationship was deleted or isn't confirmed");
      return undefined;
    });
    renderAt('/relationships?rel=rel-gone');
    expect(await screen.findByText("That relationship was deleted or isn't confirmed")).toBeTruthy();
  });

  test('?char= for someone not loaded fetches them and their relationships', async () => {
    mockApi((url) => (url === '/api/v1/relationships/person/mom'
      ? { data: { character: C('mom', 'Mona Reyes', 'support'), characters: [C('mom', 'Mona Reyes', 'support'), chars[1]], relationships: [R('rel-mom', 'mom', 'jade', { relationship_type: 'family', family_role: 'mother' })] } }
      : undefined));
    const { container } = renderAt('/relationships?char=mom');
    await waitFor(() => expect(container.querySelector('.rp-name')?.textContent).toBe('Mona Reyes'));
  });
});

describe('seeds', () => {
  test('one dismissed while a generator runs stays gone when its seeds arrive', async () => {
    let finish;
    vi.mocked(apiClient.post).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    vi.mocked(apiClient.delete).mockResolvedValue({ data: { dismissed: true } });
    renderAt('/relationships?tab=candidates');
    await screen.findByText('Rival');
    fireEvent.click(screen.getByRole('button', { name: /◈ Generate/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Generate relationship seeds' });
    fireEvent.click(within(dialog).getByRole('button', { name: /◈ Generate/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Jade Monroe ↔ Dre Coleman' }));
    await waitFor(() => expect(screen.queryByText('Rival')).toBeNull());
    await act(async () => { finish({ data: { candidates: [R('seed-2', 'lala', 'dre', { relationship_type: 'mentor', confirmed: false })] } }); });
    await screen.findByText('Mentor');
    expect(screen.queryByText('Rival')).toBeNull();
  });
});

describe('Overview', () => {
  test("Relationship With Lala comes from the pair with Lala, not the newest pair", async () => {
    const { container } = renderAt('/relationships?char=jade');
    await waitFor(() => expect(container.querySelector('.rp-name')?.textContent).toBe('Jade Monroe'));
    const row = [...container.querySelectorAll('.rp-about-row')].find((r) => r.querySelector('dt').textContent === 'Relationship With Lala');
    expect(row.querySelector('dd').textContent).toBe('Knows Lala directly');
  });
});

describe('Add', () => {
  test('Mother is saved as a family tie, and the toast opens the Family tab', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { family: true, relationship: R('rel-new', 'jade', 'dre', { relationship_type: 'family', family_role: 'mother', reverse_family_role: 'son', is_blood_relation: true }) } });
    renderAt('/relationships?tab=list');
    fireEvent.click(await screen.findByRole('button', { name: '+ Add' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add relationship' });
    const [a, b] = within(dialog).getAllByRole('combobox');
    fireEvent.change(a, { target: { value: 'jade' } });
    fireEvent.change(b, { target: { value: 'dre' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mother' }));
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Create' })); });
    expect(vi.mocked(apiClient.post).mock.calls[0][1]).toMatchObject({ relationship_type: 'mother', is_romantic: false });
    expect(await screen.findByText('Family tie added')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open Family' }));
    const list = await screen.findByRole('list', { name: 'Family ties' });
    expect(within(list).getByText('mother')).toBeTruthy();
  });
});
