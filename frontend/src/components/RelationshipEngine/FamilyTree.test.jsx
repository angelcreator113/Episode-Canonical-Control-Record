/**
 * The Family tab's tree (Evoni, 2026-10-23): named families and family
 * ties, generations top to bottom, step and chosen dashed, romance never in
 * it, an indented list for a phone.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

import apiClient from '../../services/api';
import FamilyTree from './FamilyTree';
import FamilyView from './FamilyView';
import { buildFamilyTrees, generationStep } from './familyTree';

const R = (id, a, b, f = {}) => ({ id, character_id_a: a, character_id_b: b, relationship_type: 'family', is_romantic: false, is_blood_relation: false, family_role: null, family_kind: null, ...f });
const charById = {
  dre: { id: 'dre', selected_name: 'Dre Coleman' },
  jade: { id: 'jade', selected_name: 'Jade Monroe' },
  kim: { id: 'kim', selected_name: 'Kim Ash' },
  lala: { id: 'lala', selected_name: 'Lala' },
  marcus: { id: 'marcus', selected_name: 'Marcus Hale' },
};
const rels = [
  R('t-sis', 'jade', 'dre', { family_role: 'sister', reverse_family_role: 'brother', family_kind: 'blood', is_blood_relation: true }),
  R('t-step', 'kim', 'dre', { family_role: 'stepsister', family_kind: 'step' }),
  R('t-love', 'lala', 'marcus', { relationship_type: 'love_interest', is_romantic: true, family_role: 'wife' }),
  R('t-friend', 'lala', 'jade', { relationship_type: 'best friend' }),
];
const families = [{
  id: 'f1', name: 'The Colemans', home_city: 'Velour City', members: [
    { id: 'm0', kind: 'character', registry_character_id: 'dre', name: 'Dre Coleman', generation: 0 },
    { id: 'm1', kind: 'ghost', name: 'Ruth Coleman', role: 'grandmother', role_of_character_id: 'dre', generation: -2 },
    { id: 'm2', kind: 'ghost', name: 'Omar Coleman', role: 'father', role_of_character_id: 'dre', generation: -1 },
    { id: 'm3', kind: 'profile', social_profile_id: 9, name: 'Little Rae', role: 'niece', role_of_character_id: 'dre', generation: null },
  ],
}];

beforeEach(() => {
  Object.values(apiClient).forEach((fn) => fn.mockReset());
  vi.mocked(apiClient.get).mockResolvedValue({ data: { families } });
});

describe('buildFamilyTrees', () => {
  test('one family: generations eldest first, ties and members joined, romance and friends left out', () => {
    const trees = buildFamilyTrees({ families, rels, charById });
    expect(trees).toHaveLength(1);
    const [t] = trees;
    expect(t.name).toBe('The Colemans');
    expect(t.rows.map((r) => r.map((n) => n.name))).toEqual([
      ['Ruth Coleman'], ['Omar Coleman'], ['Dre Coleman', 'Jade Monroe', 'Kim Ash'], ['Little Rae'],
    ]);
    const names = t.rows.flat().map((n) => n.name);
    expect(names).not.toContain('Lala');
    expect(names).not.toContain('Marcus Hale');
    expect(t.edges.find((e) => e.relId === 't-step').kind).toBe('step');
  });

  test('ties alone make a family named for its people; a lone person is no tree', () => {
    const trees = buildFamilyTrees({ families: [], rels: [rels[0]], charById });
    expect(trees.map((t) => t.name)).toEqual(['Family of Jade Monroe & Dre Coleman']);
    expect(buildFamilyTrees({ families: [], rels: [rels[2]], charById })).toEqual([]);
  });

  test('generationStep', () => {
    expect(generationStep('mother')).toBe(-1);
    expect(generationStep('great-grandfather')).toBe(-3);
    expect(generationStep('stepson')).toBe(1);
    expect(generationStep('sister-in-law')).toBe(0);
    expect(generationStep('mentor')).toBeNull();
  });
});

describe('FamilyTree', () => {
  test('draws each family; step and chosen are dashed; a tie opens its Inspector', async () => {
    const onRelClick = vi.fn();
    render(<MemoryRouter><FamilyTree rels={rels} charById={charById} onRelClick={onRelClick} /></MemoryRouter>);
    const svg = await screen.findByRole('img', { name: 'The Colemans family tree' });
    const step = within(svg).getByRole('button', { name: "Kim Ash is Dre Coleman's stepsister" });
    expect(step.getAttribute('data-dashed')).toBe('true');
    expect(step.querySelector('path').getAttribute('stroke-dasharray')).toBe('6 5');
    const sister = within(svg).getByRole('button', { name: "Jade Monroe is Dre Coleman's sister" });
    expect(sister.getAttribute('data-dashed')).toBe('false');
    fireEvent.click(sister);
    expect(onRelClick).toHaveBeenCalledWith(rels[0]);
    expect(screen.getByRole('heading', { name: 'The Colemans · Velour City' })).toBeTruthy();
  });

  test('the phone list: each generation indented under the one above', async () => {
    render(<MemoryRouter><FamilyTree rels={rels} charById={charById} /></MemoryRouter>);
    const list = await screen.findByRole('list', { name: 'The Colemans, by generation' });
    const people = within(list).getAllByRole('listitem');
    expect(people.map((p) => [p.querySelector('.re-ftree-person-name').firstChild.textContent, p.dataset.gen])).toEqual([
      ['Ruth Coleman', '0'], ['Omar Coleman', '1'], ['Dre Coleman', '2'], ['Jade Monroe', '2'], ['Kim Ash', '2'], ['Little Rae', '3'],
    ]);
    const kim = people[4];
    expect(within(kim).getByRole('button').textContent).toBe('Dre Coleman’s stepsister · step');
    expect(within(kim).getByRole('button').className).toContain('is-dashed');
    expect(people[0].textContent).toContain('not built yet');
  });
});

describe('the Family tab', () => {
  test('the tree sits above the ties; a named family alone still shows', async () => {
    render(<MemoryRouter><FamilyView chars={Object.values(charById)} rels={rels} charById={charById} onGenerate={vi.fn()} onUpdateRole={vi.fn()} onRelClick={vi.fn()} /></MemoryRouter>);
    expect(await screen.findByTestId('re-family-tree')).toBeTruthy();
    const ties = screen.getByRole('list', { name: 'Family ties' });
    expect(within(ties).getAllByRole('listitem')).toHaveLength(2);
    expect(within(ties).getByText(/stepsister · step/)).toBeTruthy();
  });

  test('no ties but a named family: the tree, not the empty state', async () => {
    render(<MemoryRouter><FamilyView chars={[]} rels={[]} charById={{}} onGenerate={vi.fn()} onUpdateRole={vi.fn()} onRelClick={vi.fn()} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('re-family-tree')).toBeTruthy());
    expect(screen.queryByText('No Family Bonds Yet')).toBeNull();
  });
});
