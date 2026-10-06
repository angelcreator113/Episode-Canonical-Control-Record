import { describe, test, expect } from 'vitest';
import { categoryGroups, emptyCategories, entrySource, documentCards, otherSources } from './showBibleKnowledge';

const E = (over) => ({ status: 'active', severity: 'important', category: 'franchise_law', content: 'x', ...over });
const ENTRIES = [
  E({ id: 1, title: 'B law', source_document: 'Show bible v3' }),
  E({ id: 2, title: 'A law', severity: 'critical', source_document: 'Show bible v3' }),
  E({ id: 3, title: 'C law', always_inject: true, source_document: null }),
  E({ id: 4, title: 'World rule', category: 'world', source_document: 'cultural-system-v2.0', scope: 'show' }),
  E({ id: 5, title: 'Odd', category: 'mystery' }),
  E({ id: 6, title: 'Pending', status: 'pending_review', source_document: 'Show bible v3' }),
];
const DOC_NAMES = new Set(['Show bible v3']);

describe('the Show Bible by category', () => {
  test('groups are the active entries by category, biggest first, critical then always-inject first', () => {
    const groups = categoryGroups(ENTRIES);
    expect(groups.map((g) => [g.key, g.entries.length])).toEqual([['franchise_law', 3], ['other', 1], ['world', 1]]);
    expect(groups[0].entries.map((e) => e.title)).toEqual(['A law', 'C law', 'B law']);
    expect(groups[0]).toMatchObject({ label: 'Franchise laws', critical: 1, inject: 1 });
  });

  test('search, scope and a document narrow the groups', () => {
    expect(categoryGroups(ENTRIES, { search: 'world' }).map((g) => g.key)).toEqual(['world']);
    expect(categoryGroups(ENTRIES, { scope: 'show' }).map((g) => g.key)).toEqual(['world']);
    expect(categoryGroups(ENTRIES, { doc: 'Show bible v3' })[0].entries.map((e) => e.id)).toEqual([2, 1]);
  });

  test('the empty categories are named, not drawn', () => {
    expect(emptyCategories(ENTRIES).map((c) => c.key)).toEqual(['character', 'narrative', 'locked_decision', 'technical', 'brand']);
  });

  test('an entry comes from an uploaded document, a LalaVerse page, another source, or here', () => {
    expect(entrySource(ENTRIES[0], DOC_NAMES)).toEqual({ kind: 'document', label: 'Show bible v3' });
    expect(entrySource(ENTRIES[3], DOC_NAMES)).toEqual({ kind: 'page', label: 'Culture & Events' });
    expect(entrySource(E({ source_document: 'Amber' }), DOC_NAMES)).toEqual({ kind: 'source', label: 'Amber' });
    expect(entrySource(ENTRIES[2], DOC_NAMES)).toEqual({ kind: 'here', label: 'Written here' });
  });

  test('a document card counts its rules and reads its text', () => {
    const [card] = documentCards([{ id: 'd1', source_name: 'Show bible v3', entries_created: 3, document_text: 'one two three', ingested_at: '2026-10-01T12:00:00Z' }], ENTRIES);
    expect(card).toMatchObject({ id: 'd1', name: 'Show bible v3', extracted: 3, active: 2, pending: 1, words: 3, excerpt: 'one two three' });
    expect(card.when).toMatch(/2026/);
  });

  test('the other sources leave the uploaded documents out', () => {
    expect(otherSources(ENTRIES, DOC_NAMES).map((s) => [s.kind, s.label, s.count])).toEqual([
      ['here', 'Written here', 2], ['page', 'Culture & Events', 1],
    ]);
  });
});
