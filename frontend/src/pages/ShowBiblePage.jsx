import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import useActiveShow from '../hooks/useActiveShow';
import { summaryOf, parseContent } from './showBibleSections';
import ShowBibleSummary from '../components/ShowBible/ShowBibleSummary';
import {
  CATEGORIES, SEVERITY_LABEL, categoryGroups, emptyCategories, entrySource, documentCards, otherSources,
} from '../lib/showBibleKnowledge';
import './ShowBiblePage.css';

/**
 * ShowBiblePage — the franchise knowledge base (the Show Bible).
 *
 * Four tabs:
 *   Knowledge — the active entries by category (Evoni, 2026-10-06: "By
 *               category"; the 24 sections left ~600 entries in
 *               Uncategorized), each with where it came from.
 *   Decisions — active / pending / archived, the review queue.
 *   Documents — every uploaded document with the rules it produced and a
 *               look at its text; "See its rules" opens Knowledge on them.
 *               Paste a new one to extract entries.
 *   Guard     — check one scene brief against the canon.
 *
 * In the LalaVerse hub (embedded) the tabs sit under the Bible's front page
 * (components/ShowBible/ShowBibleSummary): Always true, the Canon guard's
 * "Check now", and Decisions newest first. Styles: ShowBiblePage.css, the
 * hub's design (2026-10-06), tokens only.
 */

const ENTRIES_SHOWN = 12;
const EXTRACTED_BY_LABELS = { document_ingestion: 'Ingested', conversation_extraction: 'Extracted from a conversation', direct_entry: 'Written here', system: 'System' };
const EMPTY_FORM = { title: '', content: '', category: 'franchise_law', severity: 'important', always_inject: false, scope: 'franchise' };
const plural = (n, one, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

export default function ShowBiblePage({ embedded = false }) {
  const [searchParams, setSearchParams] = useSearchParams();
  // Show-scoped entries belong to the active show (CTX-01).
  const { show } = useActiveShow();
  // Inside the LalaVerse hub (2026-10-04) `?tab=` is the hub's; this page's
  // own tab is `?sub=`, read and written without touching the hub's.
  const param = embedded ? 'sub' : 'tab';
  const [activeTab, setActiveTab] = useState(searchParams.get(param) || 'knowledge');
  const [entries, setEntries] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openGroups, setOpenGroups] = useState(() => new Set());
  const [fullGroups, setFullGroups] = useState(() => new Set());
  const [expandedEntry, setExpandedEntry] = useState(null);
  const [docFilter, setDocFilter] = useState(null);
  const [openDoc, setOpenDoc] = useState(null);
  const [toast, setToast] = useState(null);
  const [statusFilter, setStatusFilter] = useState('active');
  const [catFilter, setCatFilter] = useState('all');
  const [scopeFilter, setScopeFilter] = useState('all'); // all | franchise | show
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  // A synced card (source_key) is managed by its page: its words, category
  // and severity are edited there. Here, its scope and "In every prompt"
  // (wiring map fix-list item 24). Holds the page's name, or null.
  const [editingManaged, setEditingManaged] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [guardText, setGuardText] = useState('');
  const [guardCharacters, setGuardCharacters] = useState('');
  const [guardResult, setGuardResult] = useState(null);
  const [guarding, setGuarding] = useState(false);
  const [ingestText, setIngestText] = useState('');
  const [ingestSource, setIngestSource] = useState('');
  const [ingesting, setIngesting] = useState(false);

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };
  const switchTab = (tab) => { setActiveTab(tab); setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set(param, tab); return next; }); };

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const [entryRes, docRes] = await Promise.allSettled([
        api.get('/api/v1/franchise-brain/entries?limit=5000'),
        api.get('/api/v1/franchise-brain/documents'),
      ]);
      if (entryRes.status === 'rejected') console.error('[ShowBible] the entries could not be read:', entryRes.reason?.message);
      if (docRes.status === 'rejected') console.error('[ShowBible] the documents could not be read:', docRes.reason?.message);
      setEntries(entryRes.status === 'fulfilled' ? (entryRes.value.data?.data || entryRes.value.data?.entries || []) : []);
      setDocuments(docRes.status === 'fulfilled' ? (docRes.value.data?.data || docRes.value.data?.documents || []) : []);
    } catch (err) { console.error('[ShowBible] load failed:', err); setEntries([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  // CRUD
  const handleSave = async () => {
    setSaving(true);
    try {
      // Scope is stored, never inferred (2026-10-04): a show entry carries the active show's id.
      const marks = { always_inject: form.always_inject, scope: form.scope, show_id: form.scope === 'show' ? (show?.id ?? null) : null };
      // A synced card takes only what the Show Bible owns; its words are its page's (the route refuses them, 409).
      const body = editingId && editingManaged ? marks : { ...form, ...marks };
      if (editingId) { await api.patch(`/api/v1/franchise-brain/entries/${editingId}`, body); showToast('Updated'); }
      else { await api.post('/api/v1/franchise-brain/entries', body); showToast('Created'); }
      setShowForm(false); setEditingId(null); setEditingManaged(null); setForm(EMPTY_FORM);
      loadEntries();
    } catch (err) { showToast(err.response?.data?.error || 'Save failed', 'error'); }
    finally { setSaving(false); }
  };

  const act = async (label, request) => {
    try { await request(); showToast(label); }
    catch (err) { console.error(`[ShowBible] ${label} failed:`, err?.response?.status || err?.message); showToast(`${label} failed`, 'error'); }
    loadEntries();
  };
  const handleActivate = (id) => act('Activated', () => api.patch(`/api/v1/franchise-brain/entries/${id}/activate`));
  const handleArchive = (id) => act('Archived', () => api.patch(`/api/v1/franchise-brain/entries/${id}/archive`));
  const handleDelete = (id) => { if (!window.confirm('Delete permanently?')) return; act('Deleted', () => api.delete(`/api/v1/franchise-brain/entries/${id}`)); };

  const handleBulkActivate = async () => {
    const pending = entries.filter(e => e.status === 'pending_review');
    if (!window.confirm(`Activate all ${pending.length} pending entries?`)) return;
    let failed = 0;
    for (const e of pending) {
      try { await api.patch(`/api/v1/franchise-brain/entries/${e.id}/activate`); }
      catch (err) { failed += 1; console.error('[ShowBible] could not activate entry', e.id, err?.message); }
    }
    loadEntries();
    showToast(failed ? `${pending.length - failed} activated, ${failed} could not be` : `${pending.length} entries activated`, failed ? 'error' : 'success');
  };

  const startNew = () => { setEditingId(null); setEditingManaged(null); setForm(EMPTY_FORM); setShowForm(true); };
  // "+ Add a rule" on the front page: a new entry already marked always-inject.
  const startRule = () => {
    setEditingId(null);
    setEditingManaged(null);
    setForm({ ...EMPTY_FORM, severity: 'critical', always_inject: true });
    setShowForm(true);
  };

  // Scope is the entry's stored tier (franchise_knowledge.scope, migration
  // 20261004120000), no longer guessed from its category.
  const getScope = (e) => (e.scope === 'show' ? 'show' : 'franchise');

  const startEdit = (entry) => {
    setEditingId(entry.id);
    const src = entrySource(entry, docNames);
    setEditingManaged(entry.source_key ? (src.kind === 'page' ? `the ${src.label} page` : 'its source page') : null);
    setForm({ title: entry.title, content: typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content, null, 2), category: entry.category || 'franchise_law', severity: entry.severity || 'important', always_inject: entry.always_inject || false, scope: getScope(entry) });
    setShowForm(true);
  };

  const handleSeed = async () => {
    try { const r = await api.post('/api/v1/franchise-brain/seed'); showToast(r.data?.message || 'Seeded'); loadEntries(); }
    catch (err) { console.error('[ShowBible] seed failed:', err?.message); showToast('Seed failed', 'error'); }
  };
  // The guard contract (routes/franchiseBrainRoutes.js): the route reads
  // scene_brief (the page sent scene_text and was refused with 400) and
  // answers { status, passed, warnings, rules_checked, message } with status
  // 'passed' | 'issues' | 'check_failed'; a check that could not run is never
  // shown as a pass (2026-10-04). With an active show it sends show_id, so
  // the brief is checked against the franchise's rules and that show's,
  // never another show's (wiring map fix-list item 25).
  const handleGuard = async () => {
    setGuarding(true); setGuardResult(null);
    const characters_in_scene = guardCharacters.split(',').map((s) => s.trim()).filter(Boolean);
    try {
      const r = await api.post('/api/v1/franchise-brain/guard', { scene_brief: guardText, characters_in_scene, ...(show?.id ? { show_id: show.id } : {}) });
      setGuardResult(r.data);
    } catch (err) {
      setGuardResult({ status: 'check_failed', passed: false, warnings: [], message: err.response?.data?.error || 'The check could not run' });
    } finally { setGuarding(false); }
  };
  // The ingest contract (routes/franchiseBrainRoutes.js): the route reads
  // document_text and source_name and answers { entries_created, entries };
  // the page used to send { text, source } and was refused with 400 every
  // time (2026-10-04). The extracted entries land in the review queue, so
  // the page opens Decisions on Pending once they are in.
  const handleIngest = async () => {
    setIngesting(true);
    try {
      const r = await api.post('/api/v1/franchise-brain/ingest-document', { document_text: ingestText, source_name: ingestSource.trim() || 'Pasted document' });
      const n = r.data?.entries_created || 0;
      showToast(n > 0 ? `Extracted ${n} ${n === 1 ? 'entry' : 'entries'}, now pending review` : 'No entries could be extracted from that text', n > 0 ? 'success' : 'error');
      setIngestText(''); setIngestSource('');
      await loadEntries();
      if (n > 0) { setStatusFilter('pending_review'); switchTab('decisions'); }
    } catch (err) { showToast(err.response?.data?.error || 'Ingest failed', 'error'); }
    finally { setIngesting(false); }
  };

  const matchSearch = (e) => { if (!search) return true; const q = search.toLowerCase(); return (e.title || '').toLowerCase().includes(q) || summaryOf(e).toLowerCase().includes(q); };
  const matchScope = (e) => scopeFilter === 'all' || getScope(e) === scopeFilter;

  const activeCount = entries.filter(e => e.status === 'active').length;
  const pendingCount = entries.filter(e => e.status === 'pending_review').length;
  const archivedCount = entries.filter(e => e.status === 'archived').length;
  const alwaysInjectCount = entries.filter(e => e.always_inject && e.status === 'active').length;
  const totalInjections = entries.reduce((s, e) => s + (e.injection_count || 0), 0);
  const franchiseCount = entries.filter(e => e.status === 'active' && getScope(e) === 'franchise').length;
  const showCount = entries.filter(e => e.status === 'active' && getScope(e) === 'show').length;

  const docs = useMemo(() => documentCards(documents, entries), [documents, entries]);
  const docNames = useMemo(() => new Set(docs.map((d) => d.name)), [docs]);
  const groups = useMemo(() => categoryGroups(entries, { search, scope: scopeFilter, doc: docFilter }), [entries, search, scopeFilter, docFilter]);
  const unfilled = useMemo(() => emptyCategories(entries), [entries]);
  const sources = useMemo(() => otherSources(entries, docNames), [entries, docNames]);
  // With a search or a document chosen, every group opens.
  const isOpen = (key) => Boolean(search) || Boolean(docFilter) || openGroups.has(key);
  const toggle = (setter, key) => setter((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });

  const seeDocRules = (name) => { setDocFilter(name); setSearch(''); switchTab('knowledge'); };

  const sourceChip = (e) => {
    const src = entrySource(e, docNames);
    const label = src.kind === 'document' ? `From ${src.label}` : src.kind === 'page' ? `${src.label} page` : src.label;
    return <span className={`sbp-chip sbp-chip-src is-${src.kind}`} title={EXTRACTED_BY_LABELS[e.extracted_by] || undefined}>{label}</span>;
  };
  // Franchise-wide is the usual case, so only a show-only entry is marked.
  const scopeChip = (e) => (getScope(e) === 'show'
    ? <span className="sbp-chip is-show" title={e.show_id ? `Show #${e.show_id}` : 'Show (not yet assigned to a show)'}>This show only</span>
    : null);
  const severityChip = (e) => <span className={`sbp-chip sbp-sev is-${SEVERITY_LABEL[e.severity] ? e.severity : 'context'}`}>{SEVERITY_LABEL[e.severity] || 'Context'}</span>;

  const entryRow = (entry, actions) => {
    const isOpenRow = expandedEntry === entry.id;
    const parsed = parseContent(entry);
    return (
      <li key={entry.id} className={`sbp-entry is-${entry.severity || 'context'}${isOpenRow ? ' is-open' : ''}`}>
        <button type="button" className="sbp-entry-head" aria-expanded={isOpenRow} onClick={() => setExpandedEntry(isOpenRow ? null : entry.id)}>
          <span className="sbp-entry-title">{entry.title}</span>
          {!isOpenRow && <span className="sbp-entry-summary">{summaryOf(entry)}</span>}
          <span className="sbp-chips">
            {severityChip(entry)}
            {entry.always_inject && <span className="sbp-chip is-inject">In every prompt</span>}
            {scopeChip(entry)}
            {sourceChip(entry)}
            {entry.injection_count > 0 && <span className="sbp-chip is-quiet">Used {entry.injection_count.toLocaleString()}×</span>}
          </span>
        </button>
        {isOpenRow && (
          <div className="sbp-entry-body">
            <div className="sbp-entry-content">{parsed ? JSON.stringify(parsed, null, 2) : String(entry.content ?? '')}</div>
            <div className="sbp-entry-meta">
              {entry.category && <span>{(CATEGORIES.find((c) => c.key === entry.category)?.label) || entry.category.replace(/_/g, ' ')}</span>}
              {EXTRACTED_BY_LABELS[entry.extracted_by] && <span>{EXTRACTED_BY_LABELS[entry.extracted_by]}</span>}
              {entry.last_injected_at && <span>Last used {new Date(entry.last_injected_at).toLocaleDateString()}</span>}
            </div>
            <div className="sbp-entry-actions">{actions}</div>
          </div>
        )}
      </li>
    );
  };

  const TABS = [
    { key: 'knowledge', label: 'Knowledge', count: activeCount },
    { key: 'decisions', label: 'Decisions', count: pendingCount, countLabel: 'pending' },
    { key: 'documents', label: 'Documents', count: docs.length },
    { key: 'guard', label: 'Guard' },
  ];

  return (
    <div className={`sbp${embedded ? ' is-embedded' : ''}`}>
      {toast && <div className={`sbp-toast is-${toast.type}`} role="status">{toast.msg}</div>}

      {embedded && <ShowBibleSummary entries={entries} loading={loading} show={show} onAddRule={startRule} onOpen={switchTab} />}

      <section className="sbp-shell" aria-label="The whole Bible">
        <div className="sbp-head">
          <div>
            {!embedded && <h1 className="sbp-h1">Show Bible</h1>}
            <h2 className="sbp-title">{embedded ? 'The whole Bible' : 'Everything the AI believes'}</h2>
            <p className="sbp-sub">
              {loading ? 'Loading…' : `${plural(activeCount, 'active entry', 'active entries')} · ${pendingCount.toLocaleString()} pending · ${alwaysInjectCount.toLocaleString()} in every prompt · from ${plural(docs.length, 'document')}`}
            </p>
          </div>
          <div className="sbp-head-actions">
            <button type="button" className="sbp-btn" onClick={startNew}>+ New Entry</button>
            <button type="button" className="sbp-btn is-ghost" onClick={handleSeed}>Seed defaults</button>
          </div>
        </div>

        {/* Audit LAYOUT-02: the stats reflow; six fixed tracks squeezed 375px. */}
        <div className="sbp-stats">
          {[
            { label: 'Active rules', value: activeCount },
            { label: 'Franchise', value: franchiseCount },
            { label: show?.name ? `This show` : 'Show', value: showCount },
            { label: 'Pending review', value: pendingCount },
            { label: 'In every prompt', value: alwaysInjectCount },
            { label: 'Times the AI used them', value: totalInjections },
          ].map((s) => (
            <div key={s.label} className="sbp-stat">
              <span className="sbp-stat-value">{s.value.toLocaleString()}</span>
              <span className="sbp-stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="sbp-tabs" role="tablist" aria-label="Show Bible">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={activeTab === t.key} onClick={() => switchTab(t.key)}
              className={`sbp-tab${activeTab === t.key ? ' is-active' : ''}`}>
              {t.label}{t.count != null && t.count > 0 && <span className="sbp-tab-count">{t.count.toLocaleString()}{t.countLabel ? ` ${t.countLabel}` : ''}</span>}
            </button>
          ))}
        </div>

        {/* Scope + search */}
        {(activeTab === 'knowledge' || activeTab === 'decisions') && (
          <div className="sbp-filters">
            <div className="sbp-seg" role="group" aria-label="Which rules">
              {[
                { key: 'all', label: 'All' },
                { key: 'franchise', label: 'Franchise' },
                { key: 'show', label: show?.name ? `Show · ${show.name}` : 'Show' },
              ].map((s) => (
                <button key={s.key} type="button" aria-pressed={scopeFilter === s.key} className={scopeFilter === s.key ? 'is-active' : ''} onClick={() => setScopeFilter(s.key)}>{s.label}</button>
              ))}
            </div>
            <input className="sbp-input sbp-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search entries..." aria-label="Search entries" />
          </div>
        )}

        {loading && <p className="sbp-note">Loading the knowledge base…</p>}

        {/* ═══ KNOWLEDGE ═══ */}
        {activeTab === 'knowledge' && !loading && (
          <div className="sbp-panel">
            {docFilter && (
              <div className="sbp-docfilter" data-testid="bible-doc-filter">
                <span>Showing the active rules from <strong>{docFilter}</strong></span>
                <button type="button" className="sbp-link" onClick={() => setDocFilter(null)}>Show every source</button>
              </div>
            )}
            {groups.length === 0 ? (
              <p className="sbp-empty">{search || docFilter || scopeFilter !== 'all' ? 'No active entry matches.' : 'The Bible has no active entries yet. Seed the defaults, write one, or paste a document under Documents.'}</p>
            ) : (
              <ul className="sbp-groups">
                {groups.map((g) => {
                  const open = isOpen(g.key);
                  const shown = fullGroups.has(g.key) ? g.entries : g.entries.slice(0, ENTRIES_SHOWN);
                  return (
                    <li key={g.key} className={`sbp-group${open ? ' is-open' : ''}`}>
                      <button type="button" className="sbp-group-head" aria-expanded={open} onClick={() => toggle(setOpenGroups, g.key)}>
                        <span className="sbp-group-text">
                          <span className="sbp-group-label">{g.label}</span>
                          <span className="sbp-group-desc">{g.desc}</span>
                        </span>
                        <span className="sbp-group-badges">
                          {g.critical > 0 && <span className="sbp-chip sbp-sev is-critical">{g.critical.toLocaleString()} critical</span>}
                          {g.inject > 0 && <span className="sbp-chip is-inject">{g.inject.toLocaleString()} in every prompt</span>}
                          <span className="sbp-count" data-testid={`bible-category-count-${g.key}`}>{g.entries.length.toLocaleString()}</span>
                        </span>
                      </button>
                      {open && (
                        <>
                          <ul className="sbp-entries">
                            {shown.map((entry) => entryRow(entry, (
                              <>
                                <button type="button" onClick={() => startEdit(entry)}>Edit</button>
                                <button type="button" onClick={() => handleArchive(entry.id)}>Archive</button>
                                <button type="button" className="is-danger" onClick={() => handleDelete(entry.id)}>Delete</button>
                              </>
                            )))}
                          </ul>
                          {g.entries.length > ENTRIES_SHOWN && (
                            <button type="button" className="sbp-link sbp-more" onClick={() => toggle(setFullGroups, g.key)}>
                              {fullGroups.has(g.key) ? 'Show fewer' : `Show all ${g.entries.length.toLocaleString()}`}
                            </button>
                          )}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {!docFilter && !search && unfilled.length > 0 && (
              <p className="sbp-note" data-testid="bible-unfilled">Not filled yet: {unfilled.map((c) => c.label).join(', ')}.</p>
            )}
          </div>
        )}

        {/* ═══ DECISIONS ═══ */}
        {activeTab === 'decisions' && !loading && (
          <div className="sbp-panel">
            <div className="sbp-toolbar">
              <div className="sbp-seg" role="group" aria-label="Status">
                {[
                  { key: 'active', label: `Active (${activeCount.toLocaleString()})` },
                  { key: 'pending_review', label: `Pending (${pendingCount.toLocaleString()})` },
                  { key: 'archived', label: `Archived (${archivedCount.toLocaleString()})` },
                ].map((f) => (
                  <button key={f.key} type="button" aria-pressed={statusFilter === f.key} className={statusFilter === f.key ? 'is-active' : ''} onClick={() => setStatusFilter(f.key)}>{f.label}</button>
                ))}
              </div>
              <select className="sbp-input sbp-select" aria-label="Category" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
                <option value="all">All categories</option>
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              {statusFilter === 'pending_review' && pendingCount > 0 && (
                <button type="button" className="sbp-btn" onClick={handleBulkActivate}>Activate all ({pendingCount.toLocaleString()})</button>
              )}
            </div>
            {(() => {
              const list = entries.filter((e) => e.status === statusFilter && matchSearch(e) && matchScope(e) && (catFilter === 'all' || e.category === catFilter));
              if (list.length === 0) return <p className="sbp-empty">No {statusFilter.replace('_', ' ')} entries{catFilter !== 'all' || search || scopeFilter !== 'all' ? ' match' : ''}.</p>;
              return (
                <ul className="sbp-entries">
                  {list.map((entry) => entryRow(entry, (
                    <>
                      {statusFilter === 'pending_review' && <button type="button" className="is-primary" onClick={() => handleActivate(entry.id)}>Activate</button>}
                      {statusFilter === 'active' && <button type="button" onClick={() => handleArchive(entry.id)}>Archive</button>}
                      {statusFilter === 'archived' && <button type="button" onClick={() => handleActivate(entry.id)}>Restore</button>}
                      <button type="button" onClick={() => startEdit(entry)}>Edit</button>
                      <button type="button" className="is-danger" onClick={() => handleDelete(entry.id)}>Delete</button>
                    </>
                  )))}
                </ul>
              );
            })()}
          </div>
        )}

        {/* ═══ DOCUMENTS ═══ */}
        {activeTab === 'documents' && !loading && (
          <div className="sbp-panel">
            <h3 className="sbp-h3">Uploaded documents</h3>
            {docs.length === 0 ? (
              <p className="sbp-empty">No documents uploaded yet. Paste one below and the AI pulls its rules out for review.</p>
            ) : (
              <ul className="sbp-docs" data-testid="bible-documents">
                {docs.map((d) => (
                  <li key={d.id} className="sbp-doc">
                    <div className="sbp-doc-head">
                      <span className="sbp-doc-icon" aria-hidden="true" />
                      <div className="sbp-doc-titles">
                        <strong className="sbp-doc-name">{d.name}</strong>
                        <span className="sbp-doc-when">{[d.when, d.words ? plural(d.words, 'word') : null].filter(Boolean).join(' · ')}</span>
                      </div>
                    </div>
                    <div className="sbp-doc-stats">
                      {d.extracted != null && <span>{plural(d.extracted, 'entry', 'entries')} extracted</span>}
                      <span>{d.active.toLocaleString()} active</span>
                      {d.pending > 0 && <span>{d.pending.toLocaleString()} pending</span>}
                    </div>
                    {d.excerpt && openDoc === d.id && <blockquote className="sbp-doc-text">{d.excerpt}{d.words > 100 ? '…' : ''}</blockquote>}
                    <div className="sbp-doc-actions">
                      <button type="button" className="sbp-link" disabled={!d.active} onClick={() => seeDocRules(d.name)}>{d.active ? `See its ${plural(d.active, 'rule')} →` : 'No active rules'}</button>
                      {d.excerpt && <button type="button" className="sbp-link" aria-expanded={openDoc === d.id} onClick={() => setOpenDoc(openDoc === d.id ? null : d.id)}>{openDoc === d.id ? 'Hide the text' : 'Read the start'}</button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {sources.length > 0 && (
              <>
                <h3 className="sbp-h3">Other sources</h3>
                <p className="sbp-note">Entries that did not come from an uploaded document: the LalaVerse pages (their Brain Update), the seeders, and what was written here.</p>
                <ul className="sbp-sources" data-testid="bible-sources">
                  {sources.map((s) => (
                    <li key={`${s.kind}-${s.label}`} className={`sbp-source is-${s.kind}`}>
                      <span>{s.kind === 'page' ? `${s.label} page` : s.label}</span>
                      <span className="sbp-count">{s.count.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="sbp-card">
              <h3 className="sbp-h3">Add a document</h3>
              <p className="sbp-note">Paste a show bible, world rules or a character bio. The AI extracts its entries, and they wait under Decisions for you to approve.</p>
              <input className="sbp-input" value={ingestSource} onChange={(e) => setIngestSource(e.target.value)} placeholder="Source name (e.g. Show bible v3, Lala character bio)" aria-label="Source name" />
              <textarea className="sbp-input sbp-textarea" value={ingestText} onChange={(e) => setIngestText(e.target.value)} placeholder="Paste your document here..." rows={10} aria-label="Document text" />
              <button type="button" className="sbp-btn" onClick={handleIngest} disabled={ingesting || !ingestText.trim()}>
                {ingesting ? 'Extracting…' : 'Extract Knowledge'}
              </button>
            </div>
          </div>
        )}

        {/* ═══ GUARD ═══ */}
        {activeTab === 'guard' && (
          <div className="sbp-panel">
            <div className="sbp-card">
              <div className="sbp-card-head">
                <h3 className="sbp-h3">Check a scene</h3>
                <span className="sbp-note">Against {plural(activeCount, 'active rule')}</span>
              </div>
              <p className="sbp-note">Paste a scene brief or script. The AI checks it against the critical and always-inject rules before anything is generated.</p>
              <input className="sbp-input" value={guardCharacters} onChange={(e) => setGuardCharacters(e.target.value)} placeholder="Characters in the scene, comma-separated (optional)" aria-label="Characters in scene" />
              <textarea className="sbp-input sbp-textarea" value={guardText} onChange={(e) => setGuardText(e.target.value)} placeholder="Paste the scene brief or script to check..." rows={8} aria-label="Scene brief" />
              <button type="button" className="sbp-btn" onClick={handleGuard} disabled={guarding || !guardText.trim()}>
                {guarding ? 'Checking…' : 'Check Scene'}
              </button>
            </div>
            {guardResult && (() => {
              const status = guardResult.status || (guardResult.warnings?.length ? 'issues' : guardResult.passed ? 'passed' : 'check_failed');
              const title = status === 'passed' ? `Passed: ${guardResult.message || 'no franchise risk found'}`
                : status === 'issues' ? `${guardResult.warnings?.length || 0} ${guardResult.warnings?.length === 1 ? 'risk' : 'risks'} found`
                : `Check failed: ${guardResult.message || 'the check could not run'}`;
              return (
                <div data-testid={`guard-result-${status}`} className={`sbp-result is-${status}`}>
                  <div className="sbp-result-title">{title}</div>
                  {status === 'check_failed' && <p className="sbp-note">Nothing was checked. This is not a pass.</p>}
                  {status === 'issues' && (guardResult.warnings || []).map((w, i) => (
                    <div key={i} className="sbp-warning">
                      <strong>{w.law}</strong>{w.risk && <>: {w.risk}</>}
                      {w.suggestion && <div className="sbp-warning-fix">{w.suggestion}</div>}
                    </div>
                  ))}
                  {status === 'issues' && guardResult.message && <p className="sbp-note">{guardResult.message}</p>}
                  {guardResult.rules_checked != null && <p className="sbp-note">Checked against {guardResult.rules_checked} rules</p>}
                </div>
              );
            })()}
          </div>
        )}
      </section>

      {/* ═══ CREATE / EDIT ═══ */}
      {showForm && (
        <div className="sbp-modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="sbp-modal" role="dialog" aria-modal="true" aria-labelledby="sbp-form-title" onClick={(e) => e.stopPropagation()}>
            <h3 id="sbp-form-title" className="sbp-h3">{editingId ? 'Edit entry' : 'New entry'}</h3>
            {editingId && editingManaged && (
              <p className="sbp-note" data-testid="sbp-managed-note">
                Its words, category and severity come from {editingManaged}: change them there, then review its Brain Update. Here you choose its scope and whether it goes in every AI prompt, and Brain Update keeps both when it updates the card.
              </p>
            )}
            <label className="sbp-field">Title<input className="sbp-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Entry title..." readOnly={Boolean(editingManaged)} /></label>
            <div className="sbp-field-row">
              <label className="sbp-field">Category<select className="sbp-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} disabled={Boolean(editingManaged)}>{CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
              <label className="sbp-field">Scope<select aria-label="Scope" className="sbp-input" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}><option value="franchise">Franchise (every show)</option><option value="show">{show?.name ? `Show · ${show.name}` : 'Show'}</option></select></label>
              <label className="sbp-field">Severity<select className="sbp-input" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} disabled={Boolean(editingManaged)}><option value="critical">Critical</option><option value="important">Important</option><option value="context">Context</option></select></label>
            </div>
            <label className="sbp-field">Content<textarea className="sbp-input sbp-textarea" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={8} placeholder="Entry content..." readOnly={Boolean(editingManaged)} /></label>
            <label className="sbp-check"><input type="checkbox" checked={form.always_inject} onChange={(e) => setForm({ ...form, always_inject: e.target.checked })} /> Put it in every AI prompt (always inject)</label>
            <div className="sbp-modal-actions">
              <button type="button" className="sbp-btn is-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="button" className="sbp-btn" onClick={handleSave} disabled={saving || !form.title}>{saving ? 'Saving…' : editingId ? 'Save' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
