import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';

/**
 * ShowBiblePage — Unified knowledge base
 *
 * Merges ShowBrain (15 tabs of franchise rules) + FranchiseBrain
 * (entry CRUD + ingest + guard) + Universe metadata into one page.
 *
 * 5 Tabs:
 *   Knowledge — all franchise entries grouped by section
 *   Decisions — active/pending/archived workflow
 *   Documents — ingest PDFs, extract from chat
 *   Guard — franchise guard scene validation
 *   Universe — LalaVerse universe metadata
 */

const SECTIONS = [
  { key: 'identity', label: 'Identity', icon: '🎯' },
  { key: 'character_bible', label: 'Characters', icon: '👤' },
  { key: 'personality', label: 'Personality', icon: '💎' },
  { key: 'world_rules', label: 'World Rules', icon: '🌍' },
  { key: 'economy', label: 'Economy', icon: '🪙' },
  { key: 'episode_beats', label: 'Episode Beats', icon: '🎬' },
  { key: 'visual_language', label: 'Visual Language', icon: '🎨' },
  { key: 'scene_rules', label: 'Scene Rules', icon: '📍' },
  { key: 'canon_rules', label: 'Canon Rules', icon: '📜' },
  { key: 'season_1', label: 'Season 1', icon: '📺' },
];

const SEVERITY_COLORS = {
  critical: { bg: '#fef2f2', color: '#dc2626', label: '🔴 Critical' },
  important: { bg: '#fef3c7', color: '#92400e', label: '🟡 Important' },
  context: { bg: '#f1f5f9', color: '#64748b', label: '⚪ Context' },
};

const CATEGORIES = ['franchise_law', 'character', 'narrative', 'locked_decision', 'technical', 'brand', 'world'];

export default function ShowBiblePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'knowledge');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedSection, setExpandedSection] = useState(null);
  const [expandedEntry, setExpandedEntry] = useState(null);
  const [toast, setToast] = useState(null);

  // Decision tab state
  const [statusFilter, setStatusFilter] = useState('active');

  // Create/edit state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: '', content: '', category: 'franchise_law', severity: 'important', always_inject: false });
  const [saving, setSaving] = useState(false);

  // Guard state
  const [guardText, setGuardText] = useState('');
  const [guardResult, setGuardResult] = useState(null);
  const [guarding, setGuarding] = useState(false);

  // Ingest state
  const [ingestText, setIngestText] = useState('');
  const [ingesting, setIngesting] = useState(false);

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const switchTab = (tab) => { setActiveTab(tab); setSearchParams({ tab }); };

  // Load entries
  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/v1/franchise-brain/entries?limit=5000');
      setEntries(res.data?.data || res.data?.entries || []);
    } catch { setEntries([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  // CRUD
  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingId) {
        await api.patch(`/api/v1/franchise-brain/entries/${editingId}`, form);
        showToast('Entry updated');
      } else {
        await api.post('/api/v1/franchise-brain/entries', form);
        showToast('Entry created');
      }
      setShowForm(false); setEditingId(null);
      setForm({ title: '', content: '', category: 'franchise_law', severity: 'important', always_inject: false });
      loadEntries();
    } catch (err) { showToast(err.response?.data?.error || 'Save failed', 'error'); }
    finally { setSaving(false); }
  };

  const handleActivate = async (id) => {
    await api.patch(`/api/v1/franchise-brain/entries/${id}/activate`).catch(() => {});
    loadEntries(); showToast('Entry activated');
  };

  const handleArchive = async (id) => {
    await api.patch(`/api/v1/franchise-brain/entries/${id}/archive`).catch(() => {});
    loadEntries(); showToast('Entry archived');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this entry permanently?')) return;
    await api.delete(`/api/v1/franchise-brain/entries/${id}`).catch(() => {});
    loadEntries(); showToast('Entry deleted');
  };

  const startEdit = (entry) => {
    setEditingId(entry.id);
    const content = typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content, null, 2);
    setForm({ title: entry.title, content, category: entry.category || 'franchise_law', severity: entry.severity || 'important', always_inject: entry.always_inject || false });
    setShowForm(true);
  };

  // Guard
  const handleGuard = async () => {
    setGuarding(true); setGuardResult(null);
    try {
      const res = await api.post('/api/v1/franchise-brain/guard', { scene_text: guardText });
      setGuardResult(res.data);
    } catch (err) { showToast('Guard check failed', 'error'); }
    finally { setGuarding(false); }
  };

  // Ingest
  const handleIngest = async () => {
    setIngesting(true);
    try {
      const res = await api.post('/api/v1/franchise-brain/ingest-document', { text: ingestText, source: 'manual_paste' });
      showToast(`Ingested ${res.data?.entries_created || 0} entries`);
      setIngestText('');
      loadEntries();
    } catch (err) { showToast('Ingest failed', 'error'); }
    finally { setIngesting(false); }
  };

  // Seed
  const handleSeed = async () => {
    try {
      const res = await api.post('/api/v1/franchise-brain/seed');
      showToast(res.data?.message || 'Seeded');
      loadEntries();
    } catch { showToast('Seed failed', 'error'); }
  };

  // Filter helpers
  const getContentSummary = (entry) => {
    if (typeof entry.content === 'string') return entry.content.slice(0, 200);
    if (entry.content?.summary) return entry.content.summary;
    return JSON.stringify(entry.content).slice(0, 200);
  };

  const getSection = (entry) => {
    if (typeof entry.content === 'object' && entry.content?.section) return entry.content.section;
    const tags = Array.isArray(entry.applies_to) ? entry.applies_to : (typeof entry.applies_to === 'string' ? JSON.parse(entry.applies_to).flat() : []);
    return tags[0] || entry.category || 'other';
  };

  const matchesSearch = (entry) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (entry.title || '').toLowerCase().includes(q) || getContentSummary(entry).toLowerCase().includes(q);
  };

  // Counts
  const activeCount = entries.filter(e => e.status === 'active').length;
  const pendingCount = entries.filter(e => e.status === 'pending_review').length;
  const archivedCount = entries.filter(e => e.status === 'archived').length;

  const S = {
    card: { background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '14px 18px', marginBottom: 8 },
    input: { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' },
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 24px' }}>
      {/* Toast */}
      {toast && <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: toast.type === 'error' ? '#FFEBEE' : '#E8F5E9', color: toast.type === 'error' ? '#C62828' : '#16a34a', border: `1px solid ${toast.type === 'error' ? '#FFCDD2' : '#A5D6A7'}`, borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 500 }}>{toast.msg}</div>}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a1a2e' }}>Show Bible</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
            {activeCount} active · {pendingCount} pending · {entries.length} total entries
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setEditingId(null); setForm({ title: '', content: '', category: 'franchise_law', severity: 'important', always_inject: false }); setShowForm(true); }} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#B8962E', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ New Entry</button>
          <button onClick={handleSeed} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>🌱 Seed Defaults</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #f1f5f9', marginBottom: 16 }}>
        {[
          { key: 'knowledge', icon: '📖', label: 'Knowledge' },
          { key: 'decisions', icon: '⚖️', label: 'Decisions' },
          { key: 'documents', icon: '📄', label: 'Documents' },
          { key: 'guard', icon: '🛡️', label: 'Guard' },
        ].map(t => (
          <button key={t.key} onClick={() => switchTab(t.key)} style={{
            padding: '8px 18px', background: 'transparent', border: 'none',
            borderBottom: activeTab === t.key ? '2px solid #B8962E' : '2px solid transparent',
            color: activeTab === t.key ? '#B8962E' : '#94a3b8',
            fontSize: 13, fontWeight: activeTab === t.key ? 700 : 500, cursor: 'pointer',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      {(activeTab === 'knowledge' || activeTab === 'decisions') && (
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entries..." style={{ ...S.input, marginBottom: 16, maxWidth: 400 }} />
      )}

      {/* ═══ KNOWLEDGE TAB ═══ */}
      {activeTab === 'knowledge' && (
        <div>
          {loading ? <div style={{ padding: 20, color: '#94a3b8' }}>Loading...</div> : (
            <div>
              {SECTIONS.map(section => {
                const sectionEntries = entries.filter(e => e.status === 'active' && getSection(e) === section.key && matchesSearch(e));
                return (
                  <div key={section.key} style={{ marginBottom: 8 }}>
                    <div onClick={() => setExpandedSection(expandedSection === section.key ? null : section.key)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#B8962E'} onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}>
                      <span style={{ fontSize: 16 }}>{section.icon}</span>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{section.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: sectionEntries.length > 0 ? '#f0fdf4' : '#f1f5f9', color: sectionEntries.length > 0 ? '#16a34a' : '#94a3b8' }}>{sectionEntries.length}</span>
                      <span style={{ fontSize: 12, color: '#cbd5e1', transform: expandedSection === section.key ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▼</span>
                    </div>
                    {expandedSection === section.key && (
                      <div style={{ paddingLeft: 16, marginTop: 4 }}>
                        {sectionEntries.length === 0 ? (
                          <div style={{ padding: '8px 0', fontSize: 12, color: '#94a3b8' }}>No entries in this section</div>
                        ) : sectionEntries.map(entry => (
                          <div key={entry.id} style={{ ...S.card, cursor: 'pointer' }} onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{entry.title}</div>
                                {expandedEntry !== entry.id && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{getContentSummary(entry)}...</div>}
                              </div>
                              {entry.always_inject && <span style={{ fontSize: 9, padding: '2px 6px', background: '#fef3c7', borderRadius: 4, color: '#92400e', fontWeight: 600 }}>Always Inject</span>}
                            </div>
                            {expandedEntry === entry.id && (
                              <div style={{ marginTop: 10, padding: '10px 12px', background: '#f8fafc', borderRadius: 6, fontSize: 12, color: '#475569', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                {typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content, null, 2)}
                                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                                  <button onClick={e => { e.stopPropagation(); startEdit(entry); }} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #e2e8f0', background: '#fff', fontSize: 10, cursor: 'pointer', color: '#64748b' }}>✏️ Edit</button>
                                  <button onClick={e => { e.stopPropagation(); handleArchive(entry.id); }} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #e2e8f0', background: '#fff', fontSize: 10, cursor: 'pointer', color: '#f59e0b' }}>📦 Archive</button>
                                  <button onClick={e => { e.stopPropagation(); handleDelete(entry.id); }} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #fecaca', background: '#fff', fontSize: 10, cursor: 'pointer', color: '#dc2626' }}>🗑 Delete</button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ DECISIONS TAB ═══ */}
      {activeTab === 'decisions' && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
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
          {entries.filter(e => e.status === statusFilter && matchesSearch(e)).map(entry => {
            const sev = SEVERITY_COLORS[entry.severity] || SEVERITY_COLORS.context;
            return (
              <div key={entry.id} style={{ ...S.card, borderLeft: `3px solid ${sev.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{entry.title}</span>
                      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: sev.bg, color: sev.color }}>{sev.label}</span>
                      {entry.category && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: '#f1f5f9', color: '#64748b' }}>{entry.category}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{getContentSummary(entry)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {statusFilter === 'pending_review' && <button onClick={() => handleActivate(entry.id)} style={{ padding: '4px 10px', borderRadius: 4, border: 'none', background: '#16a34a', color: '#fff', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>✓ Activate</button>}
                    {statusFilter === 'active' && <button onClick={() => handleArchive(entry.id)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #e2e8f0', background: '#fff', fontSize: 10, cursor: 'pointer', color: '#f59e0b' }}>Archive</button>}
                    {statusFilter === 'archived' && <button onClick={() => handleActivate(entry.id)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #e2e8f0', background: '#fff', fontSize: 10, cursor: 'pointer', color: '#16a34a' }}>Restore</button>}
                    <button onClick={() => startEdit(entry)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #e2e8f0', background: '#fff', fontSize: 10, cursor: 'pointer', color: '#64748b' }}>Edit</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ DOCUMENTS TAB ═══ */}
      {activeTab === 'documents' && (
        <div>
          <div style={S.card}>
            <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>📄 Ingest Document</h3>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: '#94a3b8' }}>Paste show bible text, world-building notes, or character bios. AI extracts knowledge entries.</p>
            <textarea value={ingestText} onChange={e => setIngestText(e.target.value)} placeholder="Paste your show bible, world rules, character descriptions, or any knowledge document..." rows={8} style={{ ...S.input, resize: 'vertical', lineHeight: 1.6 }} />
            <button onClick={handleIngest} disabled={ingesting || !ingestText.trim()} style={{ marginTop: 8, padding: '8px 20px', borderRadius: 8, border: 'none', background: ingestText.trim() ? '#B8962E' : '#e2e8f0', color: ingestText.trim() ? '#fff' : '#94a3b8', fontSize: 13, fontWeight: 600, cursor: ingestText.trim() ? 'pointer' : 'default' }}>
              {ingesting ? '⏳ Extracting entries...' : '✦ Extract Knowledge'}
            </button>
          </div>
        </div>
      )}

      {/* ═══ GUARD TAB ═══ */}
      {activeTab === 'guard' && (
        <div>
          <div style={S.card}>
            <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>🛡️ Franchise Guard</h3>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: '#94a3b8' }}>Paste a scene or script excerpt. AI checks it against all active franchise rules for violations.</p>
            <textarea value={guardText} onChange={e => setGuardText(e.target.value)} placeholder="Paste scene text to validate against franchise rules..." rows={6} style={{ ...S.input, resize: 'vertical', lineHeight: 1.6 }} />
            <button onClick={handleGuard} disabled={guarding || !guardText.trim()} style={{ marginTop: 8, padding: '8px 20px', borderRadius: 8, border: 'none', background: guardText.trim() ? '#6366f1' : '#e2e8f0', color: guardText.trim() ? '#fff' : '#94a3b8', fontSize: 13, fontWeight: 600, cursor: guardText.trim() ? 'pointer' : 'default' }}>
              {guarding ? '⏳ Checking...' : '🛡️ Check Scene'}
            </button>
          </div>
          {guardResult && (
            <div style={{ ...S.card, marginTop: 12, borderLeft: `3px solid ${guardResult.violations?.length > 0 ? '#dc2626' : '#16a34a'}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: guardResult.violations?.length > 0 ? '#dc2626' : '#16a34a', marginBottom: 8 }}>
                {guardResult.violations?.length > 0 ? `⚠️ ${guardResult.violations.length} violation(s) found` : '✅ Scene passes all franchise rules'}
              </div>
              {guardResult.violations?.map((v, i) => (
                <div key={i} style={{ padding: '6px 10px', background: '#fef2f2', borderRadius: 6, marginBottom: 4, fontSize: 12, color: '#dc2626' }}>
                  <strong>{v.rule}:</strong> {v.explanation}
                </div>
              ))}
              {guardResult.notes && <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>{guardResult.notes}</div>}
            </div>
          )}
        </div>
      )}

      {/* ═══ CREATE/EDIT MODAL ═══ */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowForm(false)}>
          <div style={{ background: '#fff', borderRadius: 14, width: '90vw', maxWidth: 600, maxHeight: '80vh', overflow: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>{editingId ? 'Edit Entry' : 'New Entry'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 3 }}>Title</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={S.input} placeholder="Entry title..." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 3 }}>Category</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={S.input}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 3 }}>Severity</label>
                  <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })} style={S.input}>
                    <option value="critical">Critical</option>
                    <option value="important">Important</option>
                    <option value="context">Context</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 3 }}>Content</label>
                <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={8} style={{ ...S.input, resize: 'vertical', lineHeight: 1.6 }} placeholder="Entry content..." />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b' }}>
                <input type="checkbox" checked={form.always_inject} onChange={e => setForm({ ...form, always_inject: e.target.checked })} />
                Always inject into AI prompts
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.title} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#B8962E', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{saving ? '⏳' : editingId ? 'Save Changes' : 'Create Entry'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
