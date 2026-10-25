/**
 * Companies in relationships (Evoni, 2026-10-24: "how should we handle
 * relationships between brands?"): when either side of a pair is a
 * registry character marked as a company, every type picker offers the
 * company types only, never a romance; the Inspector says "This is a
 * company"; the Family tab never offers a company as family.
 */
import React from 'react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import apiClient from '../../services/api';
import Inspector from './Inspector';
import AddModal from './AddModal';
import TypeTidyDialog, { typeOptions } from './TypeTidy';
import FamilyView from './FamilyView';
import { CharacterCompanyLine } from '../Companies/CompanyLine';
import FamilySection from '../CharacterFamily/FamilySection';
import { presetsFor, typeLabel, COMPANY_PRESETS, REL_PRESETS } from './tokens';

const column = { id: 'co1', slug: 'the_column', name: 'The Column', kind: 'outlet' };
const chars = [
  { id: 'lala', display_name: 'Lala', role_type: 'special', company: null },
  { id: 'col', display_name: 'The Column', role_type: 'support', company: column },
  { id: 'marcus', display_name: 'Marcus Hale', role_type: 'pressure', company: null },
];
const charById = Object.fromEntries(chars.map((c) => [c.id, c]));
const COMPANY_LABELS = ['Client or partner', 'Sponsor', 'Works for / represents', 'Press or critic', 'Rival brand', 'Fan'];

beforeEach(() => {
  Object.values(apiClient).forEach((fn) => fn.mockReset());
  vi.mocked(apiClient.get).mockResolvedValue({ data: { events: [], families: [] } });
});

describe('the company type list', () => {
  test('presetsFor: company types for a company pair, partner or rival brand for two companies', () => {
    expect(presetsFor({ any: false })).toBe(REL_PRESETS);
    expect(presetsFor({ any: true }).map((p) => p.label)).toEqual(COMPANY_LABELS);
    expect(presetsFor({ any: true, both: true }).map((p) => p.type)).toEqual(['client_partner', 'rival_brand']);
    expect(COMPANY_PRESETS.every((p) => !p.romantic)).toBe(true);
    expect(typeLabel('represents')).toBe('Works for / represents');
    expect(typeLabel({ relationship_type: 'rival_brand' })).toBe('Rival brand');
  });
});

describe('Inspector for Lala and The Column', () => {
  const rel = {
    id: 'r1', character_id_a: 'lala', character_id_b: 'col', relationship_type: 'collaborator', confirmed: true,
    connection_mode: 'Professional', status: 'Active', is_romantic: false, character_b_company: column,
  };
  const props = { charById, onClose: vi.fn(), onDelete: vi.fn(), onSaved: vi.fn() };

  test('says "This is a company: The Column →", linked to its profile', () => {
    render(<MemoryRouter><Inspector rel={rel} {...props} onUpdate={vi.fn()} /></MemoryRouter>);
    const line = screen.getByTestId('company-line');
    expect(line.textContent).toContain('This is a company:');
    expect(within(line).getByRole('link').getAttribute('href')).toBe('/brands/the_column');
  });

  test('Edit offers the company types only, no romance; Save sends the company type, not romantic', () => {
    const onUpdate = vi.fn();
    render(<MemoryRouter><Inspector rel={rel} {...props} onUpdate={onUpdate} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const select = screen.getByLabelText('Relationship Type');
    expect(select.tagName).toBe('SELECT');
    expect([...select.options].map((o) => o.textContent)).toEqual(['Choose a company type…', ...COMPANY_LABELS]);
    expect(screen.queryByText('Romantic (a love interest)')).toBeNull();
    // "collaborator" is not a company type: nothing saves until one is picked.
    expect(screen.getByRole('button', { name: 'Save' }).disabled).toBe(true);
    fireEvent.change(select, { target: { value: 'press' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ relationship_type: 'press', is_romantic: false }));
  });

  test('a seed\'s Confirm offers the company types too, and sends is_romantic false', () => {
    const onConfirm = vi.fn();
    render(<MemoryRouter><Inspector rel={{ ...rel, confirmed: false, relationship_type: 'fan' }} {...props} onUpdate={vi.fn()} seedMode onConfirm={onConfirm} /></MemoryRouter>);
    expect(screen.getByLabelText('Relationship Type').value).toBe('fan');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ relationship_type: 'fan', is_romantic: false }));
    expect(onConfirm.mock.calls[0][0].family_role).toBeUndefined();
  });

  test('a pair of people keeps the free type box and the romance box', () => {
    render(<Inspector rel={{ ...rel, character_id_b: 'marcus', character_b_company: null }} {...props} onUpdate={vi.fn()} />);
    expect(screen.queryByTestId('company-line')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Relationship Type').tagName).toBe('INPUT');
    expect(screen.getByText('Romantic (a love interest)')).toBeTruthy();
  });
});

describe('Add relationship with a company', () => {
  test('only the company types, no custom type and no romance; Create sends is_romantic false', () => {
    const onAdd = vi.fn();
    render(<AddModal chars={chars} rels={[]} onAdd={onAdd} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Character A'), { target: { value: 'lala' } });
    fireEvent.change(screen.getByLabelText('Character B'), { target: { value: 'col' } });
    const group = screen.getByRole('group', { name: 'Relationship type presets' });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(COMPANY_LABELS);
    expect(screen.queryByPlaceholderText('Or type custom…')).toBeNull();
    expect(screen.queryByText('Romantic (a love interest)')).toBeNull();
    fireEvent.click(within(group).getByRole('button', { name: 'Sponsor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ character_id_b: 'col', relationship_type: 'sponsor', is_romantic: false }));
  });
});

describe('the type tidy-up for a company pair', () => {
  const items = [
    { id: 'r1', a_name: 'Lala', b_name: 'The Column', current_type: 'Subject turned critic', proposed_type: 'press', proposed_is_romantic: false,
      proposed_from: 'type', situation_now: '', situation_after: 'Subject turned critic', company: true, brand_pair: false },
    { id: 'r2', a_name: 'Lala', b_name: 'Marcus Hale', current_type: 'Rival', proposed_type: 'rival', proposed_is_romantic: false, proposed_from: 'type', situation_now: '', situation_after: '' },
  ];
  test('its row offers the company types only, with a Company chip; a pair of people keeps the app\'s', () => {
    render(<TypeTidyDialog items={items} saving={false} onSave={vi.fn()} onClose={vi.fn()} />);
    const row = screen.getByRole('listitem', { name: 'Lala ↔ The Column' });
    expect(within(row).getByText('Company')).toBeTruthy();
    const select = within(row).getByLabelText('New type for Lala ↔ The Column');
    expect([...select.options].map((o) => o.textContent)).toEqual(['Pick a type…', ...COMPANY_LABELS]);
    expect(select.value).toBe('press');
    const people = screen.getByRole('listitem', { name: 'Lala ↔ Marcus Hale' });
    expect([...within(people).getByLabelText('New type for Lala ↔ Marcus Hale').options].map((o) => o.textContent)).toContain('Love interest');
    expect(typeOptions({ company: true, brand_pair: true }).map((t) => t.v)).toEqual(['client_partner', 'rival_brand']);
  });
});

describe('the Family tab', () => {
  test('a company is never offered as family: named apart, not "Not in family tree"', async () => {
    render(<MemoryRouter><FamilyView chars={chars} rels={[]} charById={charById} onGenerate={vi.fn()} onUpdateRole={vi.fn()} onRelClick={vi.fn()} /></MemoryRouter>);
    const notInTree = screen.getByText(/Not In Family Tree/).parentElement;
    expect(notInTree.textContent).toContain('Lala');
    expect(notInTree.textContent).not.toContain('The Column');
    expect(screen.getByTestId('family-companies').textContent).toBe('Companies are not family: The Column.');
  });
});

describe('the character page line', () => {
  test('a character marked as a company says so, linked to the company', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { company: column } });
    render(<MemoryRouter><CharacterCompanyLine character={{ id: 'col', extra_fields: { company_id: 'co1' } }} /></MemoryRouter>);
    const line = await screen.findByTestId('company-line');
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/companies/co1');
    expect(within(line).getByRole('link', { name: /The Column/ }).getAttribute('href')).toBe('/brands/the_column');
  });
  test('a person reads nothing and says nothing', () => {
    render(<MemoryRouter><CharacterCompanyLine character={{ id: 'm', extra_fields: { brand_id: 'co1' } }} /></MemoryRouter>);
    expect(screen.queryByTestId('company-line')).toBeNull();
    expect(apiClient.get).not.toHaveBeenCalled();
  });
});

describe("a company's character page Family section", () => {
  test('says a company has no family, with no Add family', async () => {
    render(<MemoryRouter><FamilySection character={{ id: 'col', display_name: 'The Column', extra_fields: { company_id: 'co1' } }} /></MemoryRouter>);
    expect((await screen.findByTestId('ch-family-company')).textContent).toBe('The Column is a company, so it has no family. Its people and deals are on its company profile.');
    expect(screen.queryByRole('button', { name: /Add family/ })).toBeNull();
  });
});
