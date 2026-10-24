/**
 * The character page's Family section (Evoni, 2026-10-23): their ties,
 * their named family, + Add family, Make them a character, Import family.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../../config/api', () => ({ API_URL: '/api/v1' }));

import api from '../../services/api';
import FamilySection, { kindOfRole } from './FamilySection';

const DRE = { id: 'dre', selected_name: 'Dre Coleman', display_name: 'dre.c' };
const READOUT = {
  character_id: 'dre', name: 'Dre Coleman',
  ties: [
    { id: 't1', other_id: 'jade', other_name: 'Jade Monroe', role: 'sister', my_role: 'brother', kind: 'blood', tension: 'healing' },
    { id: 't2', other_id: 'kim', other_name: 'Kim Ash', role: 'stepsister', my_role: 'stepbrother', kind: 'step' },
  ],
  families: [{
    id: 'f1', name: 'The Colemans', home_city: 'Velour City', members: [
      { id: 'm0', kind: 'character', registry_character_id: 'dre', name: 'Dre Coleman', generation: 0 },
      { id: 'm1', kind: 'ghost', name: 'Aunt Bee', role: 'aunt', role_of_character_id: 'dre', role_of_name: 'Dre Coleman', generation: -1 },
      { id: 'm2', kind: 'profile', social_profile_id: 9, handle: 'cuz', name: 'Cousin Rae', role: 'cousin', role_of_character_id: 'dre', generation: 0 },
      { id: 'm3', kind: 'character', registry_character_id: 'jade', name: 'Jade Monroe', role: 'sister' },
    ],
  }],
  family_tree: { generational_wound: 'nobody leaves', imported_at: null, members: [
    { index: 0, name: 'Omar Coleman', relation: 'father', sketch: 'quiet', matched_character_id: null },
    { index: 1, name: 'Jade Monroe', relation: 'sister', matched_character_id: 'jade' },
  ] },
};
const PEOPLE = { characters: [{ id: 'sable', name: 'Sable' }], profiles: [{ id: 12, name: 'Pulse Pat', handle: 'pat', registry_character_id: null }] };

const show = () => render(<MemoryRouter><FamilySection character={DRE} /></MemoryRouter>);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/api/v1/families/character/dre') return { data: READOUT };
    if (url === '/api/v1/families/people') return { data: PEOPLE };
    return { data: {} };
  });
});

describe('the Family section', () => {
  test('their ties with role and kind, their named family, the generated tree to import', async () => {
    show();
    const ties = await screen.findByRole('list', { name: 'Family ties' });
    const rows = within(ties).getAllByRole('listitem');
    expect(rows[0].textContent).toContain('Jade Monroesister');
    expect(rows[0].textContent).toContain('Blood');
    expect(rows[0].textContent).toContain('Dre Coleman is their brother · healing');
    expect(rows[1].className).toContain('is-step');
    expect(within(rows[0]).getByRole('link', { name: 'Jade Monroe' }).getAttribute('href')).toBe('/character/jade');

    // The named family leaves out Dre himself and anyone already tied above.
    const fam = screen.getByTestId('cf-named-family');
    expect(fam.textContent).toContain('The Colemans · Velour City');
    const members = within(within(fam).getByRole('list')).getAllByRole('listitem');
    expect(members.map((m) => m.querySelector('.ch-conn-name').textContent)).toEqual(['Aunt Bee', 'Cousin Rae']);
    expect(members[0].textContent).toContain('Not built yet');
    expect(members[1].textContent).toContain('On the Pulse · @cuz');

    expect(screen.getByText('Generational wound: nobody leaves')).toBeTruthy();
    const tree = screen.getByTestId('cf-tree');
    expect(within(tree).getByRole('button', { name: 'Make Omar Coleman a character' })).toBeTruthy();
    expect(within(tree).queryByRole('button', { name: 'Make Jade Monroe a character' })).toBeNull();
    expect(tree.textContent).toContain('In the registry');
  });

  test('+ Add family: a Pulse profile, their role, the kind it implies, then the reply shows', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ...READOUT, ties: [...READOUT.ties, { id: 't3', other_id: 'pat', other_name: 'Pulse Pat', role: 'cousin', kind: 'blood' }] } });
    show();
    fireEvent.click(await screen.findByRole('button', { name: /Add family/ }));
    const form = screen.getByRole('form', { name: 'Add family' });
    fireEvent.click(within(form).getByRole('radio', { name: 'A Pulse profile' }));
    await waitFor(() => expect(within(form).getAllByRole('option').map((o) => o.textContent)).toContain('Pulse Pat (@pat)'));
    fireEvent.change(within(form).getAllByRole('combobox')[0], { target: { value: '12' } });
    fireEvent.change(within(form).getByPlaceholderText('sister, aunt, chosen family…'), { target: { value: 'stepcousin' } });
    expect(form.textContent).toContain('Pulse Pat is Dre Coleman’s stepcousin (step).');
    fireEvent.click(within(form).getByRole('button', { name: 'Add to family' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/families/ties', { character_id: 'dre', role: 'stepcousin', kind: 'step', social_profile_id: 12 }));
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Add family' })).toBeNull());
    expect(within(screen.getByRole('list', { name: 'Family ties' })).getAllByRole('listitem')).toHaveLength(3);
  });

  test('+ Add family: a typed name; a refusal shows', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { data: { error: 'A partner or spouse is romance, not a family tie: add them as a relationship.' } } });
    show();
    fireEvent.click(await screen.findByRole('button', { name: /Add family/ }));
    const form = screen.getByRole('form', { name: 'Add family' });
    fireEvent.click(within(form).getByRole('radio', { name: 'Type a name' }));
    fireEvent.change(within(form).getByPlaceholderText('Ruth Coleman'), { target: { value: 'Ruth' } });
    fireEvent.change(within(form).getByPlaceholderText('sister, aunt, chosen family…'), { target: { value: 'wife' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Add to family' }));
    expect(await within(form).findByText(/romance, not a family tie/)).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/api/v1/families/ties', expect.objectContaining({ ghost_name: 'Ruth', role: 'wife' }));
  });

  test('Make them a character: the dialog (heritage to add or leave), then a link to them', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ...READOUT, character: { id: 'bee', name: 'Aunt Bee' } } });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Make Aunt Bee a character' }));
    const box = screen.getByRole('group', { name: 'Make Aunt Bee a character' });
    // An aunt is not someone whose heritage follows from Dre's parents: no suggestion, nothing filled in.
    expect(box.textContent).toContain('Add their heritage now, or leave it for later.');
    fireEvent.click(within(box).getByRole('button', { name: 'Make them a character' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/families/make-character', { character_id: 'dre', member_id: 'm1', heritage_tags: [], ethnicity: '' }));
    const done = await screen.findByText(/is a character now/);
    expect(within(done.closest('p')).getByRole('link', { name: 'Aunt Bee' }).getAttribute('href')).toBe('/character/bee');

    fireEvent.click(screen.getByRole('button', { name: 'Make Omar Coleman a character' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Make Omar Coleman a character' })).getByRole('button', { name: 'Make them a character' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/families/make-character', { character_id: 'dre', tree_index: 0, heritage_tags: [], ethnicity: '' }));
  });

  test('Import family, then the generated tree is gone', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ...READOUT, family_tree: { ...READOUT.family_tree, imported_at: '2026-10-23T00:00:00Z' } } });
    show();
    fireEvent.click(await screen.findByRole('button', { name: /Import family/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/families/import/dre'));
    await waitFor(() => expect(screen.queryByTestId('cf-tree')).toBeNull());
  });

  test('taking someone out of the family', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: { removed: true } });
    show();
    fireEvent.click(await screen.findByRole('button', { name: "Remove Kim Ash from Dre Coleman's family" }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/families/ties/t2'));
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Family ties' })).getAllByRole('listitem')).toHaveLength(1));
  });

  test('no family yet says so', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { ties: [], families: [], family_tree: { members: [] } } });
    show();
    expect(await screen.findByText(/No family ties yet/)).toBeTruthy();
    expect(screen.queryByTestId('cf-tree')).toBeNull();
  });

  test('kindOfRole reads the kind a role implies', () => {
    expect(kindOfRole('stepmother')).toBe('step');
    expect(kindOfRole('adopted son')).toBe('adoptive');
    expect(kindOfRole('chosen family')).toBe('chosen');
    expect(kindOfRole('sister-in-law')).toBe('married');
    expect(kindOfRole('aunt')).toBe('blood');
  });
});
