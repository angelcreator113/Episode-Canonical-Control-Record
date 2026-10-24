/**
 * The Relationships page's Seeds (2026-10-24, "I want them all"): why and
 * basis on each card, Confirm through the Inspector with edits, Quick
 * confirm, Confirm all with a refused one, Keep as idea and Bring back,
 * each Dismiss reason, the scene banner's Add all and the Pulse strip.
 * The server half (S1) is mocked here, as the seeds contract describes it.
 */
import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within, configure } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../services/api';
import RelationshipEngine, { sceneSeeds } from './RelationshipEngine';
import { pulseSeedsFor, pulseSeed } from '../components/RelationshipEngine/PulseStrip';
import { basisChips } from '../components/RelationshipEngine/CandidateView';

configure({ asyncUtilTimeout: 4000 });

const C = (id, display_name, role_type, extra = {}) => ({ id, display_name, selected_name: null, character_key: id, role_type, ...extra });
const chars = [
  C('lala', 'Lala', 'special'),
  C('marcus', 'Truthville', 'pressure', { selected_name: 'Marcus Hale', feed_profile_id: 7 }),
  C('jade', 'Jade Monroe', 'support', { feed_profile_id: 9 }),
  C('dre', 'Dre Coleman', 'support', { feed_profile_id: 11 }),
];
const nameOf = (id) => { const c = chars.find(x => x.id === id); return c.selected_name || c.display_name; };
const R = (id, a, b, f) => ({
  id, character_id_a: a, character_id_b: b, confirmed: true, connection_mode: 'IRL', status: 'Active', is_romantic: false,
  family_role: null, tension_state: null, stage: null, updated_at: '2026-10-01T00:00:00Z',
  character_a_name: nameOf(a), character_b_name: nameOf(b), ...f,
});
const rels = [R('rel-lj', 'lala', 'jade', { relationship_type: 'best_friend' })];
const seed = (id, a, b, f = {}) => R(id, a, b, { confirmed: false, seed_state: null, ...f });
const seeds = () => [
  seed('seed-1', 'marcus', 'dre', {
    relationship_type: 'rival', situation: 'Dre photographed the stairwell.', seed_source: 'generate',
    seed_why: 'Built on Episode 3: Jade saw them on the balcony',
    seed_basis: { episodes: [{ id: 'ep-3', number: 3, title: 'The Balcony' }], threads: [{ id: 'th-1', title: 'Who is Truthville' }], twists: [{ id: 'tw-1', title: 'Jade knows' }], facts: [] },
  }),
  seed('seed-2', 'lala', 'dre', { relationship_type: 'love_interest', is_romantic: true, seed_source: 'scene' }),
  seed('seed-k', 'jade', 'dre', { relationship_type: 'mentor', seed_state: 'kept', seed_source: 'pulse', seed_why: 'Kept idea' }),
  seed('seed-l', 'lala', 'marcus', { relationship_type: 'collaborator', seed_state: 'later', dismiss_reason: 'too_soon', seed_why: 'Later idea' }),
];
let cands;
const pulsePairs = [
  { key: '7-9', a: 7, b: 9, type: 'rival', why: 'Both cover the gala looks; Truthville keeps quoting her.', profile_a: { id: 7, handle: 'truthville' }, profile_b: { id: 9, handle: 'jademonroe' } },
  { key: '7-404', a: 7, b: 404, type: 'collab', why: 'Not in the cast', profile_a: { id: 7, handle: 'truthville' }, profile_b: { id: 404, handle: 'stranger' } },
  { key: '9-11', a: 9, b: 11, type: 'bestie', why: 'Already have a seed', profile_a: { id: 9, handle: 'jademonroe' }, profile_b: { id: 11, handle: 'dre' } },
];

function mockApi() {
  vi.mocked(apiClient.get).mockImplementation(async (url) => {
    if (url === '/api/v1/relationships/cast') return { data: { characters: chars, lala_id: 'lala', relationships: rels, candidates: cands } };
    if (url === '/api/v1/feed-relationships/suggestions') return { data: { pairs: pulsePairs } };
    if (/\/relationships\/[^/]+\/events$/.test(url)) return { data: { events: [] } };
    return { data: {} };
  });
}
const posts = (handlers) => vi.mocked(apiClient.post).mockImplementation(async (url, body) => {
  for (const [re, fn] of handlers) if (re.test(url)) return fn(url, body);
  return { data: {} };
});

const renderAt = (entry = '/relationships?tab=candidates') => render(
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/relationships" element={<RelationshipEngine />} />
      <Route path="*" element={<p>elsewhere</p>} />
    </Routes>
  </MemoryRouter>,
);
const card = (name) => screen.getByRole('button', { name: `Dismiss ${name}` }).closest('[role="listitem"]');

beforeEach(() => {
  Object.values(apiClient).forEach((fn) => fn.mockReset());
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia = vi.fn().mockImplementation((q) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  cands = seeds();
  mockApi();
});
afterEach(() => { vi.useRealTimers(); });

describe('Seeds: the card', () => {
  test('Why, basis chips (the episode links to it) and the source chip; pending only in the list and count', async () => {
    const { container } = renderAt();
    await screen.findByRole('button', { name: 'Dismiss Marcus Hale ↔ Dre Coleman' });
    const c1 = card('Marcus Hale ↔ Dre Coleman');
    expect(within(c1).getByText('Built on Episode 3: Jade saw them on the balcony')).toBeTruthy();
    const ep = within(c1).getByRole('link', { name: 'Episode 3' });
    expect(ep.getAttribute('href')).toBe('/episodes/ep-3');
    expect(within(c1).getByText('Thread: Who is Truthville')).toBeTruthy();
    expect(within(c1).getByText('Twist: Jade knows')).toBeTruthy();
    expect(within(c1).getByText('Generate')).toBeTruthy();
    expect(within(card('Lala ↔ Dre Coleman')).getByText('Scene')).toBeTruthy();
    // kept and later wait in folds, not in the list or the count
    expect(container.querySelectorAll('.cg-seed-grid > [role="listitem"]')).toHaveLength(2);
    expect(container.querySelector('.re-sub-stats').textContent).toBe('2 pending');
    expect(screen.getByRole('tab', { name: /Seeds/ }).textContent).toContain('2');
  });

  test('basisChips: episodes by number, threads and twists named, empty basis none', () => {
    expect(basisChips(null)).toEqual([]);
    const chips = basisChips({ episodes: [{ id: 'e', number: 2, title: 'T' }], threads: [{ id: 't', title: 'A' }], twists: [{ id: 'w', title: 'B' }], facts: ['On the Pulse: rival'] });
    expect(chips.map((c) => c.label)).toEqual(['Episode 2', 'Thread: A', 'Twist: B', 'On the Pulse: rival']);
    expect(chips[0].to).toBe('/episodes/e');
  });
});

describe('Seeds: confirming', () => {
  test('Confirm opens the Inspector pre-filled; Confirm there posts the edited fields', async () => {
    posts([[/\/confirm\/seed-1$/, () => { const c = cands[0]; cands = cands.slice(1); return { data: { relationship: { ...c, confirmed: true } } }; }]]);
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm Marcus Hale ↔ Dre Coleman' }));
    const insp = await screen.findByRole('complementary', { name: 'Marcus Hale and Dre Coleman' });
    expect(within(insp).getByLabelText('Relationship Type').value).toBe('rival');
    expect(within(insp).getByLabelText('Situation').value).toBe('Dre photographed the stairwell.');
    expect(within(insp).getByText('Built on Episode 3: Jade saw them on the balcony')).toBeTruthy();
    expect(within(insp).queryByRole('button', { name: 'Save' })).toBeNull();
    expect(within(insp).queryByRole('button', { name: 'Delete this relationship' })).toBeNull();
    expect(within(insp).getByRole('button', { name: 'Cancel' })).toBeTruthy();
    fireEvent.change(within(insp).getByLabelText('Situation'), { target: { value: 'Dre has the photo and wants a price.' } });
    fireEvent.change(within(insp).getByLabelText('Tension State'), { target: { value: 'volatile' } });
    fireEvent.click(within(insp).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/v1/relationships/confirm/seed-1', expect.objectContaining({
      relationship_type: 'rival', situation: 'Dre has the photo and wants a price.', tension_state: 'volatile', is_romantic: false,
    })));
    const body = vi.mocked(apiClient.post).mock.calls.find(([u]) => u.endsWith('/confirm/seed-1'))[1];
    // only the contract's fields; a non-family type sends no family role
    expect(Object.keys(body).sort()).toEqual(['connection_mode', 'is_romantic', 'lala_connection', 'notes', 'pain_point_category', 'relationship_type', 'situation', 'status', 'tension_state']);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Dismiss Marcus Hale ↔ Dre Coleman' })).toBeNull());
    expect(screen.queryByRole('complementary', { name: 'Marcus Hale and Dre Coleman' })).toBeNull();
    expect(await screen.findByText('Confirmed Marcus Hale and Dre Coleman')).toBeTruthy();
  });

  test('a refused Confirm keeps the Inspector open and says why', async () => {
    posts([[/\/confirm\/seed-2$/, () => { const e = new Error('409'); e.response = { status: 409, data: { error: 'They are family (sister), so this cannot be a romance.' } }; throw e; }]]);
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm Lala ↔ Dre Coleman' }));
    const insp = await screen.findByRole('complementary', { name: 'Lala and Dre Coleman' });
    fireEvent.click(within(insp).getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('They are family (sister), so this cannot be a romance.')).toBeTruthy();
    expect(screen.getByRole('complementary', { name: 'Lala and Dre Coleman' })).toBeTruthy();
  });

  test('Cancel closes the Inspector and leaves the seed pending', async () => {
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm Marcus Hale ↔ Dre Coleman' }));
    const insp = await screen.findByRole('complementary', { name: 'Marcus Hale and Dre Coleman' });
    fireEvent.click(within(insp).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('complementary', { name: 'Marcus Hale and Dre Coleman' })).toBeNull();
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Dismiss Marcus Hale ↔ Dre Coleman' })).toBeTruthy();
  });

  test('Quick confirm confirms as it is (no body)', async () => {
    posts([[/\/confirm\/seed-1$/, () => { const c = cands[0]; cands = cands.slice(1); return { data: { relationship: c } }; }]]);
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: 'Quick confirm Marcus Hale ↔ Dre Coleman' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/v1/relationships/confirm/seed-1'));
    expect(vi.mocked(apiClient.post).mock.calls[0]).toHaveLength(1);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Dismiss Marcus Hale ↔ Dre Coleman' })).toBeNull());
    expect(await screen.findByText('Relationship confirmed')).toBeTruthy();
  });

  test('Confirm all: a confirm step, then the confirmed go and the refused one stays, with its reason', async () => {
    posts([[/\/confirm-all$/, () => { const c = cands[0]; cands = cands.slice(1); return { data: {
      confirmed: [{ ...c, confirmed: true }],
      refused: [{ id: 'seed-2', error: 'They are family (sister), so this cannot be a romance.' }],
    } }; }]]);
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: /Confirm all \(2\)/ }));
    expect(screen.getByText(/Confirm all 2 pending seeds as they are\?/)).toBeTruthy();
    expect(apiClient.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, confirm all' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/v1/relationships/confirm-all', { ids: ['seed-1', 'seed-2'] }));
    expect(await screen.findByText('1 confirmed.')).toBeTruthy();
    const refused = screen.getByRole('list', { name: 'Not confirmed' });
    expect(refused.textContent).toContain('Lala ↔ Dre Coleman');
    expect(refused.textContent).toContain('They are family (sister), so this cannot be a romance.');
    expect(screen.queryByRole('button', { name: 'Dismiss Marcus Hale ↔ Dre Coleman' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Dismiss Lala ↔ Dre Coleman' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('list', { name: 'Not confirmed' })).toBeNull();
  });

  test('Not now leaves everything as it was', async () => {
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: /Confirm all \(2\)/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Confirm all \(2\)/ })).toBeTruthy();
  });
});

describe('Seeds: Keep as idea, Later and Bring back', () => {
  test('Keep as idea moves it to Kept ideas; Bring back returns it', async () => {
    posts([[/\/seed-state$/, (url, body) => ({ data: { relationship: { ...cands[0], seed_state: body.state } } })]]);
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: 'Keep Marcus Hale ↔ Dre Coleman as an idea' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/v1/relationships/seed-1/seed-state', { state: 'kept' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Dismiss Marcus Hale ↔ Dre Coleman' })).toBeNull());
    const fold = screen.getByRole('region', { name: 'Kept ideas' });
    const toggle = within(fold).getByRole('button', { name: /Kept ideas · 2/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(within(fold).getByText('Kept idea')).toBeTruthy();
    fireEvent.click(within(fold).getByRole('button', { name: 'Bring back Marcus Hale ↔ Dre Coleman' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/v1/relationships/seed-1/seed-state', { state: null }));
    expect(await screen.findByRole('button', { name: 'Dismiss Marcus Hale ↔ Dre Coleman' })).toBeTruthy();
  });

  test('a seed under Later comes back through restore', async () => {
    posts([[/\/seed-l\/restore$/, () => ({ data: { relationship: { ...cands[3], seed_state: null, dismiss_reason: null } } })]]);
    renderAt();
    const fold = await screen.findByRole('region', { name: 'Later' });
    fireEvent.click(within(fold).getByRole('button', { name: /Later · 1/ }));
    fireEvent.click(within(fold).getByRole('button', { name: 'Bring back Lala ↔ Marcus Hale' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/v1/relationships/seed-l/restore'));
    expect(await screen.findByRole('button', { name: 'Dismiss Lala ↔ Marcus Hale' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Later' })).toBeNull();
  });
});

describe('Seeds: Dismiss reasons', () => {
  test('the picker: a reason first, Cancel closes it without a call', async () => {
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss Marcus Hale ↔ Dre Coleman' }));
    const picker = screen.getByRole('group', { name: 'Why dismiss Marcus Hale ↔ Dre Coleman?' });
    expect(within(picker).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Wrong for them', 'Too soon', 'Already covered', 'Not this type', 'Other']);
    expect(within(picker).getByRole('button', { name: 'Dismiss' }).disabled).toBe(true);
    fireEvent.click(within(picker).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('group', { name: /Why dismiss/ })).toBeNull();
    expect(apiClient.delete).not.toHaveBeenCalled();
  });

  test('Too soon moves it to Later (not deleted)', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: { later: true, relationship: { ...cands[0], seed_state: 'later', dismiss_reason: 'too_soon' } } });
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss Marcus Hale ↔ Dre Coleman' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Too soon' }));
    fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: 'After the reveal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Move to Later' }));
    await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/relationships/dismiss/seed-1', { data: { reason: 'too_soon', note: 'After the reveal' } }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Dismiss Marcus Hale ↔ Dre Coleman' })).toBeNull());
    const fold = screen.getByRole('region', { name: 'Later' });
    fireEvent.click(within(fold).getByRole('button', { name: /Later · 2/ }));
    expect(within(fold).getByRole('button', { name: 'Bring back Marcus Hale ↔ Dre Coleman' })).toBeTruthy();
    expect(within(fold).getByText('Your note: After the reveal')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  test.each([
    ['Wrong for them', 'wrong_for_them', null],
    ['Already covered', 'already_covered', null],
    ['Not this type', 'not_this_type', 'Rivals, not friends'],
    ['Other', 'other', 'Dre is leaving the show'],
  ])('%s dismisses it, with Undo', async (label, reason, note) => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: { dismissed: true } });
    posts([[/\/seed-1\/restore$/, () => ({ data: { relationship: { ...cands[0], dismiss_reason: null } } })]]);
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss Marcus Hale ↔ Dre Coleman' }));
    fireEvent.click(screen.getByRole('radio', { name: label }));
    if (note) fireEvent.change(screen.getByLabelText(reason === 'other' ? 'What is wrong with it?' : 'Note (optional)'), { target: { value: note } });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/relationships/dismiss/seed-1', { data: note ? { reason, note } : { reason } }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Dismiss Marcus Hale ↔ Dre Coleman' })).toBeNull());
    expect(screen.getByText(/Dismissed Marcus Hale and Dre Coleman/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/v1/relationships/seed-1/restore'));
    expect(await screen.findByRole('button', { name: 'Dismiss Marcus Hale ↔ Dre Coleman' })).toBeTruthy();
  });
});

describe('One inbox', () => {
  test('From the Pulse: only pairs of cast characters with no seed or relationship; Add puts it in Seeds', async () => {
    const fresh = seed('seed-p', 'marcus', 'jade', { relationship_type: 'rival', seed_source: 'pulse', seed_why: 'Both cover the gala looks; Truthville keeps quoting her.' });
    posts([[/\/relationships\/seeds$/, () => ({ status: 201, data: { candidates: [fresh], skipped: [] } })]]);
    renderAt();
    const strip = await screen.findByRole('region', { name: 'From the Pulse' });
    expect(within(strip).getAllByRole('listitem')).toHaveLength(1);
    expect(within(strip).getByText('@truthville and @jademonroe')).toBeTruthy();
    fireEvent.click(within(strip).getByRole('button', { name: 'Add Marcus Hale ↔ Jade Monroe to Seeds' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/v1/relationships/seeds', {
      source: 'pulse',
      seeds: [expect.objectContaining({ character_id_a: 'marcus', character_id_b: 'jade', relationship_type: 'rival', is_romantic: false, seed_why: 'Both cover the gala looks; Truthville keeps quoting her.' })],
    }));
    expect(await screen.findByRole('button', { name: 'Dismiss Marcus Hale ↔ Jade Monroe' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'From the Pulse' })).toBeNull();
    expect(within(card('Marcus Hale ↔ Jade Monroe')).getByText('Pulse')).toBeTruthy();
  });

  test('the Pulse read failing leaves the Seeds tab working, without the strip', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (url === '/api/v1/relationships/cast') return { data: { characters: chars, lala_id: 'lala', relationships: rels, candidates: cands } };
      if (url === '/api/v1/feed-relationships/suggestions') throw new Error('500');
      return { data: {} };
    });
    renderAt();
    await screen.findByRole('button', { name: 'Dismiss Marcus Hale ↔ Dre Coleman' });
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/v1/feed-relationships/suggestions'));
    expect(screen.queryByRole('region', { name: 'From the Pulse' })).toBeNull();
  });

  test('pulseSeedsFor and pulseSeed: mapped by feed_profile_id, kind as a story type', () => {
    const shown = pulseSeedsFor(pulsePairs, chars, []);
    expect(shown.map((p) => p.key)).toEqual(['7-9', '9-11']);
    expect(pulseSeedsFor(pulsePairs, chars, [{ character_id_a: 'dre', character_id_b: 'jade' }]).map((p) => p.key)).toEqual(['7-9']);
    expect(pulseSeed(shown[1])).toMatchObject({ character_id_a: 'jade', character_id_b: 'dre', relationship_type: 'best friend', seed_basis: { facts: ['On the Pulse: bestie'] } });
  });

  test('the scene banner: Add all to Seeds posts its pairs (source scene) and the banner goes', async () => {
    const state = { autoSuggestions: [
      { pair: ['marcus', 'jade'], sharedDimensions: ['trust', 'public_image'], signal: 'moderate' },
      { pair: ['Lala', 'dre'], sharedDimensions: ['ambition'], signal: 'weak' },
      { pair: ['marcus', 'nobody'], sharedDimensions: ['trust'], signal: 'weak' },
    ], fromScene: 'The Balcony' };
    posts([[/\/relationships\/seeds$/, (url, body) => ({ status: 201, data: {
      candidates: [seed('seed-s1', 'marcus', 'jade', { relationship_type: 'friend', seed_source: 'scene', seed_why: body.seeds[0].seed_why })],
      skipped: [{ index: 1, why: 'Lala and Dre Coleman already have a seed' }],
    } })]]);
    render(
      <MemoryRouter initialEntries={[{ pathname: '/relationships', search: '?tab=list', state }]}>
        <Routes><Route path="/relationships" element={<RelationshipEngine />} /></Routes>
      </MemoryRouter>,
    );
    const banner = await screen.findByRole('region', { name: 'Suggestions from a scene' });
    expect(within(banner).getByText(/The Balcony/)).toBeTruthy();
    fireEvent.click(within(banner).getByRole('button', { name: 'Add all to Seeds' }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/v1/relationships/seeds', {
      source: 'scene',
      seeds: [
        expect.objectContaining({ character_id_a: 'marcus', character_id_b: 'jade', relationship_type: 'friend', seed_why: 'In "The Balcony" both changed in trust, public image.' }),
        expect.objectContaining({ character_id_a: 'lala', character_id_b: 'dre' }),
      ],
    }));
    expect(await screen.findByText('1 added to Seeds (1 already there, 1 not in the cast)')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Suggestions from a scene' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open Seeds' }));
    expect(await screen.findByRole('button', { name: 'Dismiss Marcus Hale ↔ Jade Monroe' })).toBeTruthy();
  });

  test('sceneSeeds: keys or names to the cast, the rest counted', () => {
    const { seeds: out, missing } = sceneSeeds([{ pair: ['jade', 'Marcus Hale'], sharedDimensions: ['trust'], signal: 'strong' }, { pair: ['x', 'y'], sharedDimensions: [] }], chars, 'S');
    expect(missing).toBe(1);
    expect(out).toEqual([expect.objectContaining({ character_id_a: 'jade', character_id_b: 'marcus', seed_basis: { facts: ['Scene: S', 'strong signal'] } })]);
  });
});
