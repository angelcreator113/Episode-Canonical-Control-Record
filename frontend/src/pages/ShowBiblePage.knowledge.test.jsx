/**
 * sectionOf still names the LalaVerse page an entry came from (its source
 * chip); since 2026-10-06 the Knowledge tab groups by category ("By
 * category": the sections left ~600 entries in Uncategorized). It put every
 * active entry in exactly one section (2026-10-04): the Show Brain seeder's JSON `section`, the source
 * document's LalaVerse page, or Uncategorized. The old grouping read a
 * field the API never sends and then applies_to[0], which matched no
 * section, so a hundred active rules showed as ten empty sections.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SECTIONS, UNCATEGORIZED, sectionOf, summaryOf } from './showBibleSections';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../services/api';
import ShowBiblePage from './ShowBiblePage';

const active = (over) => ({ status: 'active', severity: 'important', category: 'franchise_law', applies_to: ['story_engine'], ...over });
const ENTRIES = [
  active({ id: 1, title: 'Show Identity — Core DNA', content: JSON.stringify({ section: 'identity', summary: 'Fashion is strategy.' }), source_document: 'show-brain-v1.0', applies_to: ['show_brain'] }),
  active({ id: 2, title: 'The Five Brains', content: JSON.stringify({ section: 'five_brains', summary: 'Writer, director, editor.' }), source_document: 'show-brain-v1.0' }),
  active({ id: 3, title: 'Trend lifecycle', content: 'Trends rise, peak and fade.', source_document: 'cultural-system-v2.0' }),
  active({ id: 4, title: 'Creator tiers', content: 'Six tiers.', source_document: 'influencer-systems-v1.0', category: 'world' }),
  active({ id: 5, title: 'Ingested rule', content: 'Lala never breaks the fourth wall.', source_document: 'Pasted document', extracted_by: 'document_ingestion' }),
  active({ id: 6, title: 'Written here', content: 'Gold is never text.', source_document: null, category: 'locked_decision', applies_to: [] }),
  { id: 7, title: 'Pending one', status: 'pending_review', content: 'Not active.', source_document: 'cultural-system-v2.0', category: 'franchise_law' },
];

describe('sectionOf', () => {
  test('reads the Show Brain JSON section, then the source document, else Uncategorized', () => {
    expect(sectionOf(ENTRIES[0])).toBe('identity');
    expect(sectionOf(ENTRIES[1])).toBe('five_brains');
    expect(sectionOf(ENTRIES[2])).toBe('cultural_system');
    expect(sectionOf(ENTRIES[3])).toBe('influencer_systems');
    expect(sectionOf(ENTRIES[4])).toBe(UNCATEGORIZED);
    expect(sectionOf(ENTRIES[5])).toBe(UNCATEGORIZED);
    expect(sectionOf({ content: '{not json', source_document: 'x' })).toBe(UNCATEGORIZED);
    expect(sectionOf({ content: JSON.stringify({ section: 'not_a_section' }), source_document: 'cultural-memory-v1.0' })).toBe('cultural_memory');
  });

  test('every mapped section exists and Uncategorized is last', () => {
    const keys = SECTIONS.map((s) => s.key);
    expect(keys[keys.length - 1]).toBe(UNCATEGORIZED);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('summaryOf reads the JSON summary and plain text alike', () => {
    expect(summaryOf(ENTRIES[0])).toBe('Fashion is strategy.');
    expect(summaryOf(ENTRIES[2])).toBe('Trends rise, peak and fade.');
  });
});

describe('Show Bible: the Knowledge tab, by category (2026-10-06)', () => {
  const DOCS = [{ id: 'd1', source_name: 'Pasted document', entries_created: 1, document_text: 'Lala never breaks the fourth wall. She never winks at the camera.', created_at: '2026-10-01T00:00:00Z' }];
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    vi.mocked(api.get).mockImplementation(async (url) => (
      url.includes('/entries') ? { data: { entries: ENTRIES, count: ENTRIES.length } } : { data: { documents: DOCS, count: 1 } }
    ));
  });

  test('every active entry sits in its category, biggest first, and the counts add up', async () => {
    render(<MemoryRouter initialEntries={['/universe?tab=bible&sub=knowledge']}><ShowBiblePage embedded /></MemoryRouter>);
    const counts = await screen.findAllByTestId(/^bible-category-count-/);
    expect(counts.map((el) => el.getAttribute('data-testid'))).toEqual(['bible-category-count-franchise_law', 'bible-category-count-locked_decision', 'bible-category-count-world']);
    expect(counts.map((el) => el.textContent)).toEqual(['4', '1', '1']);
    expect(counts.reduce((n, el) => n + Number(el.textContent), 0)).toBe(ENTRIES.filter((e) => e.status === 'active').length);
    // Empty categories are one line, not empty boxes.
    expect(screen.getByTestId('bible-unfilled').textContent).toBe('Not filled yet: Characters, Narrative, Technical, Brand.');
  });

  test('an opened category shows each entry with where it came from', async () => {
    render(<MemoryRouter initialEntries={['/universe?tab=bible&sub=knowledge']}><ShowBiblePage embedded /></MemoryRouter>);
    fireEvent.click((await screen.findByTestId('bible-category-count-franchise_law')).closest('button'));
    expect(screen.getByText('From Pasted document')).toBeTruthy();
    expect(screen.getByText('Culture & Events page')).toBeTruthy();
    expect(screen.getAllByText('Identity page').length).toBe(1);
  });

  test('a document card shows its rules and its text, and "See its rules" opens Knowledge on them', async () => {
    render(<MemoryRouter initialEntries={['/universe?tab=bible&sub=documents']}><ShowBiblePage embedded /></MemoryRouter>);
    const docs = await screen.findByTestId('bible-documents');
    expect(docs.textContent).toContain('Pasted document');
    expect(docs.textContent).toContain('1 entry extracted');
    expect(docs.textContent).toContain('1 active');
    fireEvent.click(screen.getByRole('button', { name: 'Read the start' }));
    expect(docs.textContent).toContain('Lala never breaks the fourth wall.');
    // The other sources: the LalaVerse pages and what was written here.
    expect(screen.getByTestId('bible-sources').textContent).toContain('Written here');
    fireEvent.click(screen.getByRole('button', { name: 'See its 1 rule →' }));
    expect(screen.getByRole('tab', { name: /^Knowledge/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('bible-doc-filter').textContent).toContain('Pasted document');
    expect(screen.getByText('Ingested rule')).toBeTruthy();
    expect(screen.queryByText('Trend lifecycle')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show every source' }));
    expect(screen.queryByTestId('bible-doc-filter')).toBeNull();
  });
});
