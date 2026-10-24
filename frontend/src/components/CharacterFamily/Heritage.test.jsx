/**
 * Heritage in the family (Evoni, 2026-10-24): the Heritage toggle on the
 * Family tab tree and the character page, the inline edit with tags, the
 * quiet panel ("to look at", "This is intended", Undo), the gap list, and
 * Make them a character's suggested heritage.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../../config/api', () => ({ API_URL: '/api/v1' }));

import api from '../../services/api';
import { HeritagePanel, HeritageLine, heritageLabel } from './Heritage';
import FamilySection from './FamilySection';
import FamilyView from '../RelationshipEngine/FamilyView';

const STARTER = ['Black', 'Korean', 'Irish'];
const FLAG = { key: 'parents-dre', type: 'parents', person_id: 'dre', people: ['dre', 'ruth'], sentence: "Dre Coleman is Ruth Coleman's son by blood, but their heritage shares nothing: Ruth — Black; Dre — Korean." };
const PEOPLE = [
  { id: 'ruth', name: 'Ruth Coleman', heritage_tags: ['Black'], ethnicity: null },
  { id: 'dre', name: 'Dre Coleman', heritage_tags: ['Korean'], ethnicity: null },
  { id: 'kai', name: 'Kai Park', heritage_tags: ['Black', 'Korean'], ethnicity: 'Black and Korean' },
  { id: 'nia', name: 'Nia Coleman', heritage_tags: [], ethnicity: null },
];
const REPORT = { people: PEOPLE, flags: [FLAG], intended: [], gaps: [PEOPLE[3]], starter_tags: STARTER };

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
});

describe('heritageLabel', () => {
  test('their own words first, else the tags, else nothing', () => {
    expect(heritageLabel(PEOPLE[2])).toBe('Black and Korean');
    expect(heritageLabel(PEOPLE[0])).toBe('Black');
    expect(heritageLabel(PEOPLE[3])).toBeNull();
  });
});

describe('HeritageLine and the inline edit', () => {
  test('"Heritage not set", then tags picked and one of their own added, saved to the character', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { person: { ...PEOPLE[3], heritage_tags: ['Black', 'Gullah Geechee'] } } });
    const onSaved = vi.fn();
    render(<MemoryRouter><HeritageLine person={PEOPLE[3]} starterTags={STARTER} onSaved={onSaved} /></MemoryRouter>);
    expect(screen.getByText('Heritage not set')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Set heritage for Nia Coleman' }));
    const editor = screen.getByRole('group', { name: 'Heritage for Nia Coleman' });
    const black = within(editor).getByRole('button', { name: 'Black' });
    fireEvent.click(black);
    expect(black.getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(within(editor).getByLabelText('Add your own tag'), { target: { value: '  Gullah   Geechee ' } });
    fireEvent.click(within(editor).getByRole('button', { name: /Add$/ }));
    expect(within(editor).getByRole('button', { name: 'Remove Gullah Geechee' })).toBeTruthy();
    fireEvent.click(within(editor).getByRole('button', { name: 'Save heritage' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/families/heritage/nia', { heritage_tags: ['Black', 'Gullah Geechee'], ethnicity: '' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  test('someone who is not a character shows "—" and the way to make them one', () => {
    render(<MemoryRouter><HeritageLine kind="ghost" makeHref="/character/ruth" /></MemoryRouter>);
    expect(screen.getByLabelText('No heritage: not a character yet').textContent).toBe('—');
    expect(screen.getByRole('link', { name: 'Make them a character' }).getAttribute('href')).toBe('/character/ruth');
  });
});

describe('HeritagePanel', () => {
  test('quiet until opened; each note with Look at it and This is intended; the gap list', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { flag: { ...FLAG, intended: true } } });
    const onChanged = vi.fn();
    render(<MemoryRouter><HeritagePanel report={REPORT} onChanged={onChanged} /></MemoryRouter>);
    const head = screen.getByRole('button', { name: /Heritage:/ });
    expect(head.textContent).toBe('Heritage: 1 to look at · 1 not set');
    expect(screen.queryByText(FLAG.sentence)).toBeNull();
    fireEvent.click(head);
    expect(screen.getByText(/never blocks a save or changes anyone’s heritage/)).toBeTruthy();
    const notes = screen.getByRole('list', { name: 'Heritage to look at' });
    expect(notes.textContent).toContain(FLAG.sentence);
    expect(within(notes).getByRole('link', { name: 'Look at it' }).getAttribute('href')).toBe('/character/dre');
    const gaps = screen.getByRole('list', { name: 'Family members with no heritage set' });
    expect(within(gaps).getByRole('link', { name: 'Nia Coleman' })).toBeTruthy();
    expect(within(gaps).getByRole('button', { name: 'Set heritage for Nia Coleman' })).toBeTruthy();

    fireEvent.click(within(notes).getByRole('button', { name: /This is intended/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/families/heritage/intended/parents-dre'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  test('marked intended: listed quietly, with Undo', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: { flag: FLAG } });
    const onChanged = vi.fn();
    render(<MemoryRouter><HeritagePanel report={{ ...REPORT, flags: [], intended: [FLAG], gaps: [] }} onChanged={onChanged} startOpen /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /Heritage:/ }).textContent).toBe('Heritage: nothing to look at');
    const quiet = screen.getByRole('list', { name: 'Marked intended' });
    expect(quiet.textContent).toContain(FLAG.sentence);
    expect(screen.getByText('Quiet until either person’s heritage tags change.')).toBeTruthy();
    fireEvent.click(within(quiet).getByRole('button', { name: /Undo/ }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/families/heritage/intended/parents-dre'));
  });

  test('someone with words but no tags is in the gap list, and their words are kept when tags are added', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { person: {} } });
    const words = { id: 'bea', name: 'Bea', heritage_tags: [], ethnicity: 'Mixed-race' };
    render(<MemoryRouter><HeritagePanel report={{ ...REPORT, flags: [], gaps: [words] }} startOpen /></MemoryRouter>);
    expect(screen.getByText('In their words: “Mixed-race” · no tags yet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Set heritage for Bea' }));
    fireEvent.click(screen.getByRole('button', { name: 'Korean' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save heritage' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/families/heritage/bea', { heritage_tags: ['Korean'], ethnicity: 'Mixed-race' }));
  });
});

describe('the Family tab: Heritage toggle on the tree', () => {
  const families = [{ id: 'f1', name: 'The Colemans', members: [
    { id: 'm0', kind: 'character', registry_character_id: 'ruth', name: 'Ruth Coleman', generation: -1 },
    { id: 'm1', kind: 'character', registry_character_id: 'dre', name: 'Dre Coleman', role: 'son', role_of_character_id: 'ruth', generation: 0 },
    { id: 'm2', kind: 'character', registry_character_id: 'nia', name: 'Nia Coleman', role: 'daughter', role_of_character_id: 'ruth', generation: 0 },
    { id: 'm3', kind: 'ghost', name: 'Eli Coleman', role: 'son', role_of_character_id: 'ruth', generation: 0 },
  ] }];
  beforeEach(() => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (String(url).endsWith('/families/heritage')) return { data: REPORT };
      return { data: { families } };
    });
  });

  test('off by default; on, each person shows their heritage, "Heritage not set" with an edit, "—" for a name only', async () => {
    const { container } = render(<MemoryRouter><FamilyView chars={[]} rels={[]} charById={{}} onRelClick={vi.fn()} onGenerate={vi.fn()} onUpdateRole={vi.fn()} /></MemoryRouter>);
    const toggle = await screen.findByRole('button', { name: 'Heritage' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    await screen.findByRole('img', { name: 'The Colemans family tree' });
    expect(container.querySelector('.re-ftree-node-heritage')).toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: /Heritage:/ }).textContent).toContain('1 to look at'));

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    const drawn = [...container.querySelectorAll('.re-ftree-node-heritage')].map((t) => t.textContent);
    expect(drawn).toEqual(expect.arrayContaining(['Black', 'Korean', 'Heritage not set', '— Make a character']));
    // The phone's list: the same, with the inline edit and the way to make Eli a character.
    const list = container.querySelector('.re-ftree-list');
    expect(within(list).getByRole('button', { name: 'Set heritage for Nia Coleman' })).toBeTruthy();
    expect(within(list).getByRole('link', { name: 'Make them a character' }).getAttribute('href')).toBe('/character/ruth');
    // The drawing's "Heritage not set" opens the same inline edit.
    fireEvent.click(container.querySelector('.re-ftree-svg .re-ftree-node-heritage.is-unset'));
    expect(container.querySelector('.re-ftree-heritage-edit').textContent).toContain('Nia Coleman');
  });
});

describe('the character page: Heritage in the Family section', () => {
  const DRE = { id: 'dre', selected_name: 'Dre Coleman', heritage_tags: ['Korean'] };
  const READOUT = {
    character_id: 'dre', name: 'Dre Coleman',
    ties: [{ id: 't1', other_id: 'ruth', other_name: 'Ruth Coleman', role: 'mother', my_role: 'son', kind: 'blood', other_heritage_tags: ['Black'] }],
    families: [{ id: 'f1', name: 'The Colemans', members: [
      { id: 'm3', kind: 'ghost', name: 'Eli Coleman', role: 'brother', role_of_character_id: 'dre' },
    ] }],
    family_tree: { members: [] },
  };
  beforeEach(() => {
    vi.mocked(api.get).mockImplementation(async (url, opts) => {
      if (url === '/api/v1/families/character/dre') return { data: READOUT };
      if (url === '/api/v1/families/heritage') return { data: { ...REPORT, people: PEOPLE.slice(0, 2) } };
      if (url === '/api/v1/families/make-character/suggestion') {
        expect(opts.params).toEqual({ character_id: 'dre', role: 'brother' });
        return { data: { suggestion: { heritage_tags: ['Black', 'Korean'], ethnicity: null, from: [{ id: 'ruth', name: 'Ruth Coleman' }, { id: 'omar', name: 'Omar Coleman' }] } } };
      }
      return { data: {} };
    });
  });

  test('the toggle shows their own heritage and each relative\'s; a name only shows "—"', async () => {
    render(<MemoryRouter><FamilySection character={DRE} /></MemoryRouter>);
    await screen.findByRole('list', { name: 'Family ties' });
    expect(screen.queryByText('Dre Coleman’s heritage')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Heritage' }));
    expect(screen.getByText('Dre Coleman’s heritage').parentElement.textContent).toContain('Korean');
    const tie = within(screen.getByRole('list', { name: 'Family ties' })).getAllByRole('listitem')[0];
    expect(tie.textContent).toContain('Black');
    const named = screen.getByTestId('cf-named-family');
    expect(within(named).getByLabelText('No heritage: not a character yet')).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('button', { name: /Heritage:/ }).textContent).toContain('1 to look at'));
  });

  test('Make them a character suggests heritage from the blood parents, editable, sent only as left', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ...READOUT, character: { id: 'eli', name: 'Eli Coleman' } } });
    render(<MemoryRouter><FamilySection character={DRE} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Make Eli Coleman a character' }));
    const box = screen.getByRole('group', { name: 'Make Eli Coleman a character' });
    await waitFor(() => expect(box.textContent).toContain('Suggested from Ruth and Omar, their blood family: Black, Korean. A starting point only: change it or clear it.'));
    expect(within(box).getByRole('button', { name: 'Black' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(box).getByRole('button', { name: 'Korean' }).getAttribute('aria-pressed')).toBe('true');
    // Evoni takes one off before making them.
    fireEvent.click(within(box).getByRole('button', { name: 'Korean' }));
    fireEvent.click(within(box).getByRole('button', { name: 'Make them a character' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/families/make-character', { character_id: 'dre', member_id: 'm3', heritage_tags: ['Black'], ethnicity: '' }));
  });
});
