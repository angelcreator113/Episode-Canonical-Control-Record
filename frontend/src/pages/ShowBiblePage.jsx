import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';

/**
 * ShowBiblePage — Unified knowledge base (enhanced)
 *
 * 4 Tabs:
 *   Knowledge — franchise entries grouped by section, severity bars, injection stats
 *   Decisions — active/pending/archived workflow, bulk actions, source tracking
 *   Documents — ingest text, existing documents list
 *   Guard — franchise guard scene validation with rule counts
 */

const SECTIONS = [
  { key: 'identity', label: 'Identity', icon: '🎯', desc: 'Show name, logline, design tokens' },
  { key: 'character_bible', label: 'Characters', icon: '👤', desc: 'Character definitions and bible' },
  { key: 'personality', label: 'Personality', icon: '💎', desc: 'Personality traits and voice' },
  { key: 'world_rules', label: 'World Rules', icon: '🌍', desc: 'Mechanical and narrative rules' },
  { key: 'economy', label: 'Economy', icon: '🪙', desc: 'Currency, reputation, access systems' },
  { key: 'episode_beats', label: 'Episode Beats', icon: '🎬', desc: '14-beat structure, arc patterns' },
  { key: 'visual_language', label: 'Visual Language', icon: '🎨', desc: 'Design language, color palette' },
  { key: 'scene_rules', label: 'Scene Rules', icon: '📍', desc: 'Scene generation constraints' },
  { key: 'canon_rules', label: 'Canon Rules', icon: '📜', desc: 'What cannot be changed' },
  { key: 'season_1', label: 'Season 1', icon: '📺', desc: 'Season-specific rules' },
];

const SEVERITY = {
  critical: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', icon: '🔴' },
  important: { bg: '#fef3c7', color: '#92400e', border: '#fde68a', icon: '🟡' },
  context: { bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0', icon: '⚪' },
};

const CATEGORIES = ['franchise_law', 'character', 'narrative', 'locked_decision', 'technical', 'brand', 'world'];
const EXTRACTED_BY_LABELS = { document_ingestion: '📄 Ingested', conversation_extraction: '💬 Extracted', direct_entry: '✏️ Manual', system: '⚙️ System' };

export default function ShowBiblePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'knowledge');
  const [entries, setEntries] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedSection, setExpandedSection] = useState(null);
  const [expandedEntry, setExpandedEntry] = useState(null);
  const [toast, setToast] = useState(null);
  const [statusFilter, setStatusFilter] = useState('active');
  const [catFilter, setCatFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: '', content: '', category: 'franchise_law', severity: 'important', always_inject: false });
  const [saving, setSaving] = useState(false);
  const [guardText, setGuardText] = useState('');
  const [guardResult, setGuardResult] = useState(null);
  const [guarding, setGuarding] = useState(false);
  const [ingestText, setIngestText] = useState('');
  const [ingesting, setIngesting] = useState(false);

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };
  const switchTab = (tab) => { setActiveTab(tab); setSearchParams({ tab }); };

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
      if (editingId) { await api.patch(`/api/v1/franchise-brain/entries/${editingId}`, form); showToast('Updated'); }
      else { await api.post('/api/v1/franchise-brain/entries', form); showToast('Created'); }
      setShowForm(false); setEditingId(null); setForm({ title: '', content: '', category: 'franchise_law', severity: 'important', always_inject: false });
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
    setForm({ title: entry.title, content: typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content, null, 2), category: entry.category || 'franchise_law', severity: entry.severity || 'important', always_inject: entry.always_inject || false });
    setShowForm(true);
  };

  const handleSeed = async () => { try { const r = await api.post('/api/v1/franchise-brain/seed'); showToast(r.data?.message || 'Seeded'); loadEntries(); } catch { showToast('Seed failed', 'error'); } };
  const handleGuard = async () => { setGuarding(true); setGuardResult(null); try { const r = await api.post('/api/v1/franchise-brain/guard', { scene_text: guardText }); setGuardResult(r.data); } catch { showToast('Guard failed', 'error'); } finally { setGuarding(false); } };
  const handleIngest = async () => { setIngesting(true); try { const r = await api.post('/api/v1/franchise-brain/ingest-document', { text: ingestText, source: 'manual_paste' }); showToast(`Extracted ${r.data?.entries_created || 0} entries`); setIngestText(''); loadEntries(); } catch { showToast('Ingest failed', 'error'); } finally { setIngesting(false); } };

  // Helpers
  const getSummary = (e) => { if (typeof e.content === 'string') return e.content.slice(0, 300); if (e.content?.summary) return e.content.summary; return JSON.stringify(e.content).slice(0, 300); };
  const getSection = (e) => { if (typeof e.content === 'object' && e.content?.section) return e.content.section; const tags = Array.isArray(e.applies_to) ? e.applies_to : []; return tags[0] || e.category || 'other'; };
  const matchSearch = (e) => { if (!search) return true; const q = search.toLowerCase(); return (e.title || '').toLowerCase().includes(q) || getSummary(e).toLowerCase().includes(q); };

  const activeCount = entries.filter(e => e.status === 'active').length;
  const pendingCount = entries.filter(e => e.status === 'pending_review').length;
  const archivedCount = entries.filter(e => e.status === 'archived').length;
  const alwaysInjectCount = entries.filter(e => e.always_inject && e.status === 'active').length;
  const totalInjections = entries.reduce((s, e) => s + (e.injection_count || 0), 0);

  const S = {
    input: { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' },
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 24px' }}>
      {toast && <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: toast.type === 'error' ? '#FFEBEE' : '#E8F5E9', color: toast.type === 'error' ? '#C62828' : '#16a34a', border: `1px solid ${toast.type === 'error' ? '#FFCDD2' : '#A5D6A7'}`, borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 500 }}>{toast.msg}</div>}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a1a2e' }}>Show Bible</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
            {activeCount} active · {pendingCount} pending · {alwaysInjectCount} always-inject · {totalInjections.toLocaleString()} total injections
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setEditingId(null); setForm({ title: '', content: '', category: 'franchise_law', severity: 'important', always_inject: false }); setShowForm(true); }} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#B8962E', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ New Entry</button>
          <button onClick={handleSeed} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, cursor: 'pointer' }}>🌱 Seed</button>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Active Rules', value: activeCount, color: '#16a34a' },
          { label: 'Pending Review', value: pendingCount, color: '#f59e0b' },
          { label: 'Always Inject', value: alwaysInjectCount, color: '#6366f1' },
          { label: 'AI Injections', value: totalInjections, color: '#B8962E' },
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

      {/* Search */}
      {(activeTab === 'knowledge' || activeTab === 'decisions') && (
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entries..." style={{ ...S.input, marginBottom: 12, maxWidth: 400 }} />
      )}

      {/* ═══ KNOWLEDGE TAB ═══ */}
      {activeTab === 'knowledge' && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SECTIONS.map(section => {
            const sectionEntries = entries.filter(e => e.status === 'active' && getSection(e) === section.key && matchSearch(e));
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
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: sectionEntries.length > 0 ? '#f0fdf4' : '#f1f5f9', color: sectionEntries.length > 0 ? '#16a34a' : '#94a3b8' }}>{sectionEntries.length}</span>
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
                                {typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content, null, 2)}
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
          {entries.filter(e => e.status === statusFilter && matchSearch(e) && (catFilter === 'all' || e.category === catFilter)).map(entry => {
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
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{doc.title || doc.source || `Document ${i + 1}`}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>
                        {doc.entries_count && `${doc.entries_count} entries extracted`}
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
            <textarea value={ingestText} onChange={e => setIngestText(e.target.value)} placeholder="Paste your document here..." rows={10} style={{ ...S.input, resize: 'vertical', lineHeight: 1.6 }} />
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
            <p style={{ margin: '0 0 10px', fontSize: 12, color: '#94a3b8' }}>Paste a scene or script. AI checks for violations against all active franchise rules.</p>
            <textarea value={guardText} onChange={e => setGuardText(e.target.value)} placeholder="Paste scene text to validate..." rows={8} style={{ ...S.input, resize: 'vertical', lineHeight: 1.6 }} />
            <button onClick={handleGuard} disabled={guarding || !guardText.trim()} style={{ marginTop: 8, padding: '8px 20px', borderRadius: 8, border: 'none', background: guardText.trim() ? '#6366f1' : '#e2e8f0', color: guardText.trim() ? '#fff' : '#94a3b8', fontSize: 13, fontWeight: 600, cursor: guardText.trim() ? 'pointer' : 'default' }}>
              {guarding ? '⏳ Checking...' : '🛡️ Check Scene'}
            </button>
          </div>
          {guardResult && (
            <div style={{ marginTop: 12, background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', borderLeft: `4px solid ${guardResult.violations?.length > 0 ? '#dc2626' : '#16a34a'}`, padding: '16px 18px' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: guardResult.violations?.length > 0 ? '#dc2626' : '#16a34a', marginBottom: 8 }}>
                {guardResult.violations?.length > 0 ? `⚠️ ${guardResult.violations.length} violation(s)` : '✅ Scene passes all franchise rules'}
              </div>
              {guardResult.violations?.map((v, i) => (
                <div key={i} style={{ padding: '8px 12px', background: '#fef2f2', borderRadius: 6, marginBottom: 4, fontSize: 12, color: '#dc2626', lineHeight: 1.5 }}>
                  <strong>{v.rule}:</strong> {v.explanation}
                </div>
              ))}
              {guardResult.notes && <div style={{ fontSize: 12, color: '#64748b', marginTop: 8, lineHeight: 1.5 }}>{guardResult.notes}</div>}
              {guardResult.rules_checked && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 8 }}>Checked against {guardResult.rules_checked} rules</div>}
            </div>
          )}
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
