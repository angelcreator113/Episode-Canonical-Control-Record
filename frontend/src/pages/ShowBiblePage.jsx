import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import useActiveShow from '../hooks/useActiveShow';
import { SECTIONS, sectionOf, summaryOf, parseContent } from './showBibleSections';

/**
 * ShowBiblePage — Unified knowledge base (enhanced)
 *
 * 4 Tabs:
 *   Knowledge — franchise entries grouped by section, severity bars, injection stats
 *   Decisions — active/pending/archived workflow, bulk actions, source tracking
 *   Documents — ingest text, existing documents list
 *   Guard — franchise guard scene validation with rule counts
 */


const SEVERITY = {
  critical: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', icon: '🔴' },
  important: { bg: '#fef3c7', color: '#92400e', border: '#fde68a', icon: '🟡' },
  context: { bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0', icon: '⚪' },
};

const CATEGORIES = ['franchise_law', 'character', 'narrative', 'locked_decision', 'technical', 'brand', 'world'];
const EXTRACTED_BY_LABELS = { document_ingestion: '📄 Ingested', conversation_extraction: '💬 Extracted', direct_entry: '✏️ Manual', system: '⚙️ System' };

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
  const [expandedSection, setExpandedSection] = useState(null);
  const [expandedEntry, setExpandedEntry] = useState(null);
  const [toast, setToast] = useState(null);
  const [statusFilter, setStatusFilter] = useState('active');
  const [catFilter, setCatFilter] = useState('all');
  const [scopeFilter, setScopeFilter] = useState('all'); // all | franchise | show
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: '', content: '', category: 'franchise_law', severity: 'important', always_inject: false, scope: 'franchise' });
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
        api.get('/api/v1/franchise-brain/documents').catch(() => ({ data: [] })),
      ]);
      setEntries(entryRes.status === 'fulfilled' ? (entryRes.value.data?.data || entryRes.value.data?.entries || []) : []);
      setDocuments(docRes.status === 'fulfilled' ? (docRes.value.data?.data || docRes.value.data?.documents || []) : []);
    } catch { setEntries([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  // CRUD
  const handleSave = async () => {
    setSaving(true);
    try {
      // Scope is stored, never inferred (2026-10-04): a show entry carries the active show's id.
      const body = { ...form, show_id: form.scope === 'show' ? (show?.id ?? null) : null };
      if (editingId) { await api.patch(`/api/v1/franchise-brain/entries/${editingId}`, body); showToast('Updated'); }
      else { await api.post('/api/v1/franchise-brain/entries', body); showToast('Created'); }
      setShowForm(false); setEditingId(null); setForm({ title: '', content: '', category: 'franchise_law', severity: 'important', always_inject: false, scope: 'franchise' });
      loadEntries();
    } catch (err) { showToast(err.response?.data?.error || 'Save failed', 'error'); }
    finally { setSaving(false); }
  };

  const handleActivate = async (id) => { await api.patch(`/api/v1/franchise-brain/entries/${id}/activate`).catch(() => {}); loadEntries(); showToast('Activated'); };
  const handleArchive = async (id) => { await api.patch(`/api/v1/franchise-brain/entries/${id}/archive`).catch(() => {}); loadEntries(); showToast('Archived'); };
  const handleDelete = async (id) => { if (!window.confirm('Delete permanently?')) return; await api.delete(`/api/v1/franchise-brain/entries/${id}`).catch(() => {}); loadEntries(); showToast('Deleted'); };

  const handleBulkActivate = async () => {
    const pending = entries.filter(e => e.status === 'pending_review');
    if (!window.confirm(`Activate all ${pending.length} pending entries?`)) return;
    for (const e of pending) { await api.patch(`/api/v1/franchise-brain/entries/${e.id}/activate`).catch(() => {}); }
    loadEntries(); showToast(`${pending.length} entries activated`);
  };

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setForm({ title: entry.title, content: typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content, null, 2), category: entry.category || 'franchise_law', severity: entry.severity || 'important', always_inject: entry.always_inject || false, scope: getScope(entry) });
    setShowForm(true);
  };

  const handleSeed = async () => { try { const r = await api.post('/api/v1/franchise-brain/seed'); showToast(r.data?.message || 'Seeded'); loadEntries(); } catch { showToast('Seed failed', 'error'); } };
  // The guard contract (routes/franchiseBrainRoutes.js): the route reads
  // scene_brief (the page sent scene_text and was refused with 400) and
  // answers { status, passed, warnings, rules_checked, message } with status
  // 'passed' | 'issues' | 'check_failed'; a check that could not run is never
  // shown as a pass (2026-10-04).
  const handleGuard = async () => {
    setGuarding(true); setGuardResult(null);
    const characters_in_scene = guardCharacters.split(',').map((s) => s.trim()).filter(Boolean);
    try {
      const r = await api.post('/api/v1/franchise-brain/guard', { scene_brief: guardText, characters_in_scene });
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

  // Helpers
  // Sections, summaries and JSON content: showBibleSections.js (2026-10-04).
  const getSummary = summaryOf;
  const getSection = sectionOf;
  const matchSearch = (e) => { if (!search) return true; const q = search.toLowerCase(); return (e.title || '').toLowerCase().includes(q) || getSummary(e).toLowerCase().includes(q); };

  // Scope is the entry's stored tier (franchise_knowledge.scope, migration
  // 20261004120000), no longer guessed from its category.
  const getScope = (e) => (e.scope === 'show' ? 'show' : 'franchise');
  const scopeBadge = (e) => (getScope(e) === 'franchise'
    ? <span title="Franchise: true for every show" style={{ fontSize: 8, padding: '1px 5px', background: '#eef2ff', color: '#6366f1', borderRadius: 3, fontWeight: 600 }}>🌍</span>
    : <span title={e.show_id ? `Show #${e.show_id}` : 'Show (not yet assigned to a show)'} style={{ fontSize: 8, padding: '1px 5px', background: '#FAF7F0', color: '#7A6314', borderRadius: 3, fontWeight: 600 }}>📺</span>);
  const matchScope = (e) => scopeFilter === 'all' || getScope(e) === scopeFilter;

  const activeCount = entries.filter(e => e.status === 'active').length;
  const pendingCount = entries.filter(e => e.status === 'pending_review').length;
  const archivedCount = entries.filter(e => e.status === 'archived').length;
  const alwaysInjectCount = entries.filter(e => e.always_inject && e.status === 'active').length;
  const totalInjections = entries.reduce((s, e) => s + (e.injection_count || 0), 0);
  const franchiseCount = entries.filter(e => e.status === 'active' && getScope(e) === 'franchise').length;
  const showCount = entries.filter(e => e.status === 'active' && getScope(e) === 'show').length;
  const catCounts = {};
  entries.filter(e => e.status === 'active').forEach(e => { catCounts[e.category] = (catCounts[e.category] || 0) + 1; });

  const S = {
    input: { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' },
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: embedded ? 0 : '16px 24px' }}>
      {toast && <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: toast.type === 'error' ? '#FFEBEE' : '#E8F5E9', color: toast.type === 'error' ? '#C62828' : '#16a34a', border: `1px solid ${toast.type === 'error' ? '#FFCDD2' : '#A5D6A7'}`, borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 500 }}>{toast.msg}</div>}

      {/* Header; inside the hub the tab is the heading and the counts stay */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          {!embedded && <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a1a2e' }}>Show Bible</h1>}
          <p style={{ margin: embedded ? 0 : '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
            {activeCount} active · {pendingCount} pending · {alwaysInjectCount} always-inject · {totalInjections.toLocaleString()} total injections
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setEditingId(null); setForm({ title: '', content: '', category: 'franchise_law', severity: 'important', always_inject: false, scope: 'franchise' }); setShowForm(true); }} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'var(--text-inverse)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ New Entry</button>
          <button onClick={handleSeed} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, cursor: 'pointer' }}>🌱 Seed</button>
        </div>
      </div>

      {/* Stats Row */}
      {/* Audit LAYOUT-02: the stats reflow; six fixed tracks squeezed 375px. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Active Rules', value: activeCount, color: '#16a34a' },
          { label: '🌍 Franchise', value: franchiseCount, color: '#6366f1' },
          { label: '📺 Show', value: showCount, color: '#B8962E' },
          { label: 'Pending', value: pendingCount, color: '#f59e0b' },
          { label: 'Always Inject', value: alwaysInjectCount, color: '#ec4899' },
          { label: 'AI Injections', value: totalInjections, color: '#0ea5e9' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: '10px 14px' }}>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #f1f5f9', marginBottom: 16 }}>
        {[
          { key: 'knowledge', icon: '📖', label: 'Knowledge' },
          { key: 'decisions', icon: '⚖️', label: `Decisions${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
          { key: 'documents', icon: '📄', label: 'Documents' },
          { key: 'guard', icon: '🛡️', label: 'Guard' },
        ].map(t => (
          <button key={t.key} onClick={() => switchTab(t.key)} style={{
            padding: '8px 18px', background: 'transparent', border: 'none',
            borderBottom: activeTab === t.key ? '2px solid #B8962E' : '2px solid transparent',
            color: activeTab === t.key ? '#B8962E' : '#94a3b8',
            fontSize: 13, fontWeight: activeTab === t.key ? 700 : 500, cursor: 'pointer',
          }}>{t.icon} {t.label}</button>
        ))}
      </div>

      {/* Scope Filter + Search */}
      {(activeTab === 'knowledge' || activeTab === 'decisions') && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
            {[
              { key: 'all', label: 'All', icon: '📋' },
              { key: 'franchise', label: 'Franchise', icon: '🌍' },
              { key: 'show', label: show?.name ? `Show · ${show.name}` : 'Show', icon: '📺' },
            ].map(s => (
              <button key={s.key} onClick={() => setScopeFilter(s.key)} style={{
                padding: '4px 12px', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: scopeFilter === s.key ? (s.key === 'franchise' ? '#6366f1' : s.key === 'show' ? '#B8962E' : '#64748b') : '#fff',
                color: scopeFilter === s.key ? '#fff' : '#64748b',
              }}>{s.icon} {s.label}</button>
            ))}
          </div>
          {/* Category chips */}
          {activeTab === 'knowledge' && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {Object.entries(catCounts).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                <span key={cat} style={{ padding: '2px 8px', background: '#f1f5f9', borderRadius: 4, fontSize: 9, fontWeight: 600, color: '#64748b' }}>
                  {cat.replace(/_/g, ' ')} ({count})
                </span>
              ))}
            </div>
          )}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entries..." style={{ ...S.input, maxWidth: 300, flex: '0 1 300px' }} />
        </div>
      )}

      {/* ═══ KNOWLEDGE TAB ═══ */}
      {activeTab === 'knowledge' && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SECTIONS.map(section => {
            const sectionEntries = entries.filter(e => e.status === 'active' && getSection(e) === section.key && matchSearch(e) && matchScope(e));
            const critCount = sectionEntries.filter(e => e.severity === 'critical').length;
            const injectCount = sectionEntries.filter(e => e.always_inject).length;
            const isExpanded = expandedSection === section.key;
            return (
              <div key={section.key}>
                <div onClick={() => setExpandedSection(isExpanded ? null : section.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#fff', borderRadius: 8, border: `1px solid ${isExpanded ? '#B8962E' : '#e2e8f0'}`, cursor: 'pointer', transition: 'border-color 0.15s' }}>
                  <span style={{ fontSize: 18 }}>{section.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{section.label}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>{section.desc}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {critCount > 0 && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: '#fef2f2', color: '#dc2626', fontWeight: 600 }}>🔴 {critCount}</span>}
                    {injectCount > 0 && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: '#eef2ff', color: '#6366f1', fontWeight: 600 }}>💉 {injectCount}</span>}
                    <span data-testid={`bible-section-count-${section.key}`} style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: sectionEntries.length > 0 ? '#f0fdf4' : '#f1f5f9', color: sectionEntries.length > 0 ? '#16a34a' : '#94a3b8' }}>{sectionEntries.length}</span>
                  </div>
                  <span style={{ fontSize: 12, color: '#cbd5e1', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▼</span>
                </div>
                {isExpanded && (
                  <div style={{ paddingLeft: 12, marginTop: 4 }}>
                    {sectionEntries.length === 0 ? (
                      <div style={{ padding: '10px 14px', fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No entries — seed defaults or create one</div>
                    ) : sectionEntries.map(entry => {
                      const sev = SEVERITY[entry.severity] || SEVERITY.context;
                      const isOpen = expandedEntry === entry.id;
                      return (
                        <div key={entry.id} style={{ background: '#fff', borderRadius: 8, border: `1px solid ${sev.border}`, borderLeft: `3px solid ${sev.color}`, marginBottom: 6, overflow: 'hidden' }}>
                          <div onClick={() => setExpandedEntry(isOpen ? null : entry.id)} style={{ padding: '10px 14px', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                                <span style={{ fontSize: 12 }}>{sev.icon}</span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{entry.title}</span>
                                {entry.always_inject && <span style={{ fontSize: 8, padding: '1px 5px', background: '#6366f1', color: '#fff', borderRadius: 3, fontWeight: 700 }}>INJECT</span>}
                                {scopeBadge(entry)}
                              </div>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 10, color: '#94a3b8' }}>
                                {entry.injection_count > 0 && <span title="Times used by AI">💉 {entry.injection_count}</span>}
                                <span>{EXTRACTED_BY_LABELS[entry.extracted_by] || '✏️'}</span>
                              </div>
                            </div>
                            {!isOpen && <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, lineHeight: 1.4 }}>{getSummary(entry).slice(0, 150)}...</div>}
                          </div>
                          {isOpen && (
                            <div style={{ padding: '0 14px 12px', borderTop: '1px solid #f1f5f9' }}>
                              <div style={{ padding: '10px 0', fontSize: 12, color: '#475569', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                                {parseContent(entry) ? JSON.stringify(parseContent(entry), null, 2) : String(entry.content ?? '')}
                              </div>
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                                {entry.category && <span style={{ fontSize: 9, padding: '2px 6px', background: '#f1f5f9', borderRadius: 4, color: '#64748b' }}>{entry.category.replace(/_/g, ' ')}</span>}
                                {entry.source_document && <span style={{ fontSize: 9, padding: '2px 6px', background: '#f1f5f9', borderRadius: 4, color: '#64748b' }}>📄 {entry.source_document}</span>}
                                {entry.last_injected_at && <span style={{ fontSize: 9, color: '#94a3b8' }}>Last used: {new Date(entry.last_injected_at).toLocaleDateString()}</span>}
                                <div style={{ flex: 1 }} />
                                <button onClick={e => { e.stopPropagation(); startEdit(entry); }} style={{ padding: '3px 10px', borderRadius: 4, border: '1px solid #e2e8f0', background: '#fff', fontSize: 10, cursor: 'pointer', color: '#64748b' }}>✏️ Edit</button>
                                <button onClick={e => { e.stopPropagation(); handleArchive(entry.id); }} style={{ padding: '3px 10px', borderRadius: 4, border: '1px solid #e2e8f0', background: '#fff', fontSize: 10, cursor: 'pointer', color: '#f59e0b' }}>📦 Archive</button>
                                <button onClick={e => { e.stopPropagation(); handleDelete(entry.id); }} style={{ padding: '3px 10px', borderRadius: 4, border: '1px solid #fecaca', background: '#fff', fontSize: 10, cursor: 'pointer', color: '#dc2626' }}>🗑</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ DECISIONS TAB ═══ */}
      {activeTab === 'decisions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { key: 'active', label: `Active (${activeCount})`, color: '#16a34a' },
                { key: 'pending_review', label: `Pending (${pendingCount})`, color: '#f59e0b' },
                { key: 'archived', label: `Archived (${archivedCount})`, color: '#94a3b8' },
              ].map(f => (
                <button key={f.key} onClick={() => setStatusFilter(f.key)} style={{
                  padding: '5px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: statusFilter === f.key ? f.color + '15' : '#f8f8f8',
                  color: statusFilter === f.key ? f.color : '#94a3b8',
                  border: `1px solid ${statusFilter === f.key ? f.color + '40' : '#e2e8f0'}`,
                }}>{f.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {/* Category filter */}
              <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ ...S.input, width: 'auto', fontSize: 11 }}>
                <option value="all">All categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
              {statusFilter === 'pending_review' && pendingCount > 0 && (
                <button onClick={handleBulkActivate} style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>✓ Activate All ({pendingCount})</button>
              )}
            </div>
          </div>
          {entries.filter(e => e.status === statusFilter && matchSearch(e) && matchScope(e) && (catFilter === 'all' || e.category === catFilter)).map(entry => {
            const sev = SEVERITY[entry.severity] || SEVERITY.context;
            return (
              <div key={entry.id} style={{ background: '#fff', borderRadius: 8, border: `1px solid ${sev.border}`, borderLeft: `3px solid ${sev.color}`, marginBottom: 6, padding: '10px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{entry.title}</span>
                      <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: sev.bg, color: sev.color, fontWeight: 600 }}>{entry.severity}</span>
                      {entry.category && <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: '#f1f5f9', color: '#64748b' }}>{entry.category.replace(/_/g, ' ')}</span>}
                      {entry.always_inject && <span style={{ fontSize: 8, padding: '1px 5px', background: '#6366f1', color: '#fff', borderRadius: 3, fontWeight: 700 }}>INJECT</span>}
                                {scopeBadge(entry)}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, marginBottom: 4 }}>{getSummary(entry).slice(0, 200)}</div>
                    <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#94a3b8' }}>
                      <span>{EXTRACTED_BY_LABELS[entry.extracted_by] || '✏️ Manual'}</span>
                      {entry.injection_count > 0 && <span>💉 Used {entry.injection_count}x by AI</span>}
                      {entry.source_document && <span>📄 {entry.source_document}</span>}
                      {entry.last_injected_at && <span>Last: {new Date(entry.last_injected_at).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 12 }}>
                    {statusFilter === 'pending_review' && <button onClick={() => handleActivate(entry.id)} style={{ padding: '4px 10px', borderRadius: 4, border: 'none', background: '#16a34a', color: '#fff', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>✓ Activate</button>}
                    {statusFilter === 'active' && <button onClick={() => handleArchive(entry.id)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #e2e8f0', background: '#fff', fontSize: 10, cursor: 'pointer', color: '#f59e0b' }}>Archive</button>}
                    {statusFilter === 'archived' && <button onClick={() => handleActivate(entry.id)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #e2e8f0', background: '#fff', fontSize: 10, cursor: 'pointer', color: '#16a34a' }}>Restore</button>}
                    <button onClick={() => startEdit(entry)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #e2e8f0', background: '#fff', fontSize: 10, cursor: 'pointer', color: '#64748b' }}>Edit</button>
                    <button onClick={() => handleDelete(entry.id)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #fecaca', background: '#fff', fontSize: 10, cursor: 'pointer', color: '#dc2626' }}>🗑</button>
                  </div>
                </div>
              </div>
            );
          })}
          {entries.filter(e => e.status === statusFilter).length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 13 }}>No {statusFilter.replace('_', ' ')} entries</div>
          )}
        </div>
      )}

      {/* ═══ DOCUMENTS TAB ═══ */}
      {activeTab === 'documents' && (
        <div>
          {/* Existing documents */}
          {documents.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>📚 Ingested Documents ({documents.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {documents.map((doc, i) => (
                  <div key={doc.id || i} style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{doc.source_name || doc.title || `Document ${i + 1}`}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>
                        {doc.entries_created != null && `${doc.entries_created} entries extracted`}
                        {doc.created_at && ` · ${new Date(doc.created_at).toLocaleDateString()}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ingest form */}
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '16px 18px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>📄 Ingest New Document</h3>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: '#94a3b8' }}>Paste show bible, world rules, character bios. AI extracts knowledge entries automatically.</p>
            <input value={ingestSource} onChange={e => setIngestSource(e.target.value)} placeholder="Source name (e.g. Show bible v3, Lala character bio)" aria-label="Source name" style={{ ...S.input, marginBottom: 8 }} />
            <textarea value={ingestText} onChange={e => setIngestText(e.target.value)} placeholder="Paste your document here..." rows={10} aria-label="Document text" style={{ ...S.input, resize: 'vertical', lineHeight: 1.6 }} />
            <button onClick={handleIngest} disabled={ingesting || !ingestText.trim()} style={{ marginTop: 8, padding: '8px 20px', borderRadius: 8, border: 'none', background: ingestText.trim() ? '#B8962E' : '#e2e8f0', color: ingestText.trim() ? '#fff' : '#94a3b8', fontSize: 13, fontWeight: 600, cursor: ingestText.trim() ? 'pointer' : 'default' }}>
              {ingesting ? '⏳ Extracting...' : '✦ Extract Knowledge'}
            </button>
          </div>
        </div>
      )}

      {/* ═══ GUARD TAB ═══ */}
      {activeTab === 'guard' && (
        <div>
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>🛡️ Franchise Guard</h3>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Checking against {activeCount} active rules</span>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: '#94a3b8' }}>Paste a scene brief or script. AI checks it against the critical and always-inject rules before generation.</p>
            <input value={guardCharacters} onChange={e => setGuardCharacters(e.target.value)} placeholder="Characters in the scene, comma-separated (optional)" aria-label="Characters in scene" style={{ ...S.input, marginBottom: 8 }} />
            <textarea value={guardText} onChange={e => setGuardText(e.target.value)} placeholder="Paste the scene brief or script to check..." rows={8} aria-label="Scene brief" style={{ ...S.input, resize: 'vertical', lineHeight: 1.6 }} />
            <button onClick={handleGuard} disabled={guarding || !guardText.trim()} style={{ marginTop: 8, padding: '8px 20px', borderRadius: 8, border: 'none', background: guardText.trim() ? '#6366f1' : '#e2e8f0', color: guardText.trim() ? '#fff' : '#94a3b8', fontSize: 13, fontWeight: 600, cursor: guardText.trim() ? 'pointer' : 'default' }}>
              {guarding ? '⏳ Checking...' : '🛡️ Check Scene'}
            </button>
          </div>
          {guardResult && (() => {
            const status = guardResult.status || (guardResult.warnings?.length ? 'issues' : guardResult.passed ? 'passed' : 'check_failed');
            const tone = status === 'passed' ? { edge: 'var(--success)', text: 'var(--success-text)', title: `✅ Passed: ${guardResult.message || 'no franchise risk found'}` }
              : status === 'issues' ? { edge: 'var(--danger)', text: 'var(--danger-text)', title: `⚠️ ${guardResult.warnings?.length || 0} ${guardResult.warnings?.length === 1 ? 'risk' : 'risks'} found` }
              : { edge: 'var(--warning)', text: 'var(--warning-text)', title: `⚠️ Check failed: ${guardResult.message || 'the check could not run'}` };
            return (
              <div data-testid={`guard-result-${status}`} style={{ marginTop: 12, background: 'var(--surface-card)', borderRadius: 10, border: '1px solid var(--lala-parchment-3)', borderLeft: `4px solid ${tone.edge}`, padding: '16px 18px' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: tone.text, marginBottom: 8 }}>{tone.title}</div>
                {status === 'check_failed' && <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Nothing was checked. This is not a pass.</div>}
                {status === 'issues' && (guardResult.warnings || []).map((w, i) => (
                  <div key={i} style={{ padding: '8px 12px', background: 'var(--danger-bg)', borderRadius: 6, marginBottom: 4, fontSize: 12, color: 'var(--danger-text)', lineHeight: 1.5 }}>
                    <strong>{w.law}</strong>{w.risk && <>: {w.risk}</>}
                    {w.suggestion && <div style={{ color: 'var(--success-text)', marginTop: 4 }}>💡 {w.suggestion}</div>}
                  </div>
                ))}
                {status === 'issues' && guardResult.message && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>{guardResult.message}</div>}
                {guardResult.rules_checked != null && <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 8 }}>Checked against {guardResult.rules_checked} rules</div>}
              </div>
            );
          })()}
        </div>
      )}

      {/* ═══ CREATE/EDIT MODAL ═══ */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowForm(false)}>
          <div style={{ background: '#fff', borderRadius: 14, width: '90vw', maxWidth: 600, maxHeight: '80vh', overflow: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>{editingId ? 'Edit Entry' : 'New Entry'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><label style={{ fontSize: 10, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 3 }}>Title</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={S.input} placeholder="Entry title..." /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={{ fontSize: 10, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 3 }}>Category</label><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={S.input}>{CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}</select></div>
                <div><label style={{ fontSize: 10, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 3 }}>Scope</label><select aria-label="Scope" value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value })} style={S.input}><option value="franchise">🌍 Franchise (every show)</option><option value="show">📺 {show?.name ? `Show · ${show.name}` : 'Show'}</option></select></div>
                <div><label style={{ fontSize: 10, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 3 }}>Severity</label><select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })} style={S.input}><option value="critical">🔴 Critical</option><option value="important">🟡 Important</option><option value="context">⚪ Context</option></select></div>
              </div>
              <div><label style={{ fontSize: 10, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 3 }}>Content</label><textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={8} style={{ ...S.input, resize: 'vertical', lineHeight: 1.6 }} placeholder="Entry content..." /></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b' }}><input type="checkbox" checked={form.always_inject} onChange={e => setForm({ ...form, always_inject: e.target.checked })} /> Always inject into AI prompts</label>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.title} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#B8962E', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{saving ? '⏳' : editingId ? 'Save' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {loading && <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Loading knowledge base...</div>}
    </div>
  );
}
