/**
 * The Show Bible's Knowledge tab puts every active entry in exactly one
 * section (2026-10-04): the Show Brain seeder's JSON `section`, the source
 * document's LalaVerse page, or Uncategorized. The old grouping read a
 * field the API never sends and then applies_to[0], which matched no
 * section, so a hundred active rules showed as ten empty sections.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('Show Bible: the Knowledge tab', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    vi.mocked(api.get).mockImplementation(async (url) => (
      url.includes('/entries') ? { data: { entries: ENTRIES, count: ENTRIES.length } } : { data: { documents: [], count: 0 } }
    ));
  });

  test('section counts add up to the active count and Uncategorized holds the rest', async () => {
    render(<MemoryRouter initialEntries={['/universe?tab=bible&sub=knowledge']}><ShowBiblePage embedded /></MemoryRouter>);
    const counts = await screen.findAllByTestId(/^bible-section-count-/);
    expect(counts).toHaveLength(SECTIONS.length);
    const total = counts.reduce((n, el) => n + Number(el.textContent), 0);
    expect(total).toBe(ENTRIES.filter((e) => e.status === 'active').length);
    expect(screen.getByTestId('bible-section-count-identity').textContent).toBe('1');
    expect(screen.getByTestId('bible-section-count-cultural_system').textContent).toBe('1');
    expect(screen.getByTestId(`bible-section-count-${UNCATEGORIZED}`).textContent).toBe('2');
  });
});
