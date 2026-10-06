/**
 * The Show Bible's Knowledge and Documents tabs, organised by what is
 * there (Evoni, 2026-10-06: the Knowledge tab showed 23 sections at 0
 * while ~600 entries sat in Uncategorized; "By category"). Pure: the page
 * renders.
 *
 *   CATEGORIES       the seven franchise_knowledge categories, in words.
 *   categoryGroups   active entries by category, biggest first, each entry
 *                    critical first then always-inject; empty categories
 *                    are left out (the page names them in one line).
 *   entrySource      where an entry came from: an uploaded document (its
 *                    source_document is the document's source_name), a
 *                    LalaVerse page (showBibleSections), or written here.
 *   documentCards    each uploaded document with its rules: extracted,
 *                    active, pending.
 *   otherSources     the sources that are not uploaded documents (the
 *                    LalaVerse pages, seeders, Amber) with their counts.
 */
import { SECTIONS, sectionOf, summaryOf, UNCATEGORIZED } from '../pages/showBibleSections';

export const CATEGORIES = [
  { key: 'franchise_law', label: 'Franchise laws', desc: 'What is always true across the LalaVerse' },
  { key: 'world', label: 'World', desc: 'Places, systems and how the world works' },
  { key: 'character', label: 'Characters', desc: 'Who people are and what they would never do' },
  { key: 'narrative', label: 'Narrative', desc: 'Story shape, arcs and tone' },
  { key: 'locked_decision', label: 'Locked decisions', desc: 'Calls already made; not reopened' },
  { key: 'technical', label: 'Technical', desc: 'How the tools and generators must behave' },
  { key: 'brand', label: 'Brand', desc: 'The look, the voice and the name' },
];
const CATEGORY_KEYS = new Set(CATEGORIES.map((c) => c.key));
export const OTHER_CATEGORY = { key: 'other', label: 'Other', desc: 'Entries with no category' };

const SEVERITY_RANK = { critical: 0, important: 1, context: 2 };
export const SEVERITY_LABEL = { critical: 'Critical', important: 'Important', context: 'Context' };
const scopeOf = (e) => (e?.scope === 'show' ? 'show' : 'franchise');
const categoryOf = (e) => (CATEGORY_KEYS.has(e?.category) ? e.category : OTHER_CATEGORY.key);

/** Where an entry came from: { kind: 'document' | 'page' | 'here' | 'source', label }. */
export function entrySource(entry, documentNames = new Set()) {
  const doc = typeof entry?.source_document === 'string' ? entry.source_document.trim() : '';
  if (doc && documentNames.has(doc)) return { kind: 'document', label: doc };
  const section = sectionOf(entry);
  if (section !== UNCATEGORIZED) {
    const s = SECTIONS.find((x) => x.key === section);
    return { kind: 'page', label: s ? s.label : section };
  }
  if (doc) return { kind: 'source', label: doc };
  return { kind: 'here', label: 'Written here' };
}

const matches = (e, q) => {
  if (!q) return true;
  const needle = q.toLowerCase();
  return [e.title, summaryOf(e), e.source_document].some((v) => String(v || '').toLowerCase().includes(needle));
};

/**
 * Active entries by category: [{ key, label, desc, entries, critical,
 * inject }], biggest first. Filters: search, scope ('all' | 'franchise' |
 * 'show'), doc (a source_document to keep).
 */
export function categoryGroups(entries, { search = '', scope = 'all', doc = null } = {}) {
  const groups = new Map();
  for (const e of entries || []) {
    if (e?.status !== 'active') continue;
    if (scope !== 'all' && scopeOf(e) !== scope) continue;
    if (doc && String(e.source_document || '').trim() !== doc) continue;
    if (!matches(e, search)) continue;
    const key = categoryOf(e);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  const info = (key) => CATEGORIES.find((c) => c.key === key) || OTHER_CATEGORY;
  return [...groups.entries()]
    .map(([key, list]) => ({
      ...info(key),
      entries: list.sort((a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3)
        || Number(Boolean(b.always_inject)) - Number(Boolean(a.always_inject))
        || String(a.title || '').localeCompare(String(b.title || ''))),
      critical: list.filter((e) => e.severity === 'critical').length,
      inject: list.filter((e) => e.always_inject).length,
    }))
    .sort((a, b) => b.entries.length - a.entries.length || a.label.localeCompare(b.label));
}

/** The categories with no active entry, for the one "not filled yet" line. */
export function emptyCategories(entries) {
  const used = new Set((entries || []).filter((e) => e?.status === 'active').map(categoryOf));
  return CATEGORIES.filter((c) => !used.has(c.key));
}

const dayOf = (d) => {
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? null : new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Each uploaded document with its rules, newest first. */
export function documentCards(documents, entries) {
  const bySource = new Map();
  for (const e of entries || []) {
    const name = String(e?.source_document || '').trim();
    if (!name) continue;
    if (!bySource.has(name)) bySource.set(name, []);
    bySource.get(name).push(e);
  }
  return (documents || []).map((d, i) => {
    const name = String(d?.source_name || d?.title || '').trim() || `Document ${i + 1}`;
    const rules = bySource.get(name) || [];
    const text = typeof d?.document_text === 'string' ? d.document_text : '';
    return {
      id: d?.id ?? `doc-${i}`,
      name,
      when: dayOf(d?.ingested_at || d?.created_at),
      extracted: d?.entries_created != null ? Number(d.entries_created) || 0 : null,
      active: rules.filter((e) => e.status === 'active').length,
      pending: rules.filter((e) => e.status === 'pending_review').length,
      words: text ? text.trim().split(/\s+/).filter(Boolean).length : 0,
      excerpt: text ? text.trim().slice(0, 600) : '',
    };
  });
}

/** The sources that are not uploaded documents, biggest first: [{ label, kind, count }]. */
export function otherSources(entries, documentNames = new Set()) {
  const counts = new Map();
  for (const e of entries || []) {
    if (e?.status !== 'active') continue;
    const src = entrySource(e, documentNames);
    if (src.kind === 'document') continue;
    const key = `${src.kind}:${src.label}`;
    counts.set(key, { ...src, count: (counts.get(key)?.count || 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
