// FranchiseBrain.jsx
// Franchise Knowledge Management — the living brain of the LalaVerse
// Tab in the Universe page, story-side cluster (knowledge tab)
// Tabbed layout: Franchise Laws | Active Knowledge | Pending Review | Ingest Document | Extract from Chat | Franchise Guard

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PdfIngestZone from './PdfIngestZone';

const API = import.meta.env.VITE_API_URL || '/api/v1';

const C = {
  bg: '#faf6f0',
  surface: '#ffffff',
  border: '#e8e0d4',
  text: '#1a1714',
  textDim: '#6b6259',
  textFaint: '#a89f94',
  accent: '#b8863e',
  gold: '#c9a96e',
  red: '#b84040',
  green: '#3a8a60',
  blue: '#3a6a8a',
  purple: '#6a3a8a',
};

const CATEGORIES = [
  { key: 'franchise_law', label: 'Franchise Law', icon: '⚖', color: C.red },
  { key: 'character',     label: 'Character',     icon: '◎', color: C.purple },
  { key: 'narrative',     label: 'Narrative',      icon: '◇', color: C.blue },
  { key: 'locked_decision', label: 'Locked Decision', icon: '🔒', color: C.gold },
  { key: 'technical',    label: 'Technical',      icon: '⚙', color: C.textDim },
  { key: 'brand',        label: 'Brand',          icon: '★', color: C.accent },
  { key: 'world',        label: 'World',          icon: '◈', color: C.green },
];

const SEVERITIES = ['critical', 'important', 'context'];

const STATUS_LABELS = {
  pending_review: '🟡 Pending Review',
  active:         '🟢 Active',
  superseded:     '⚫ Superseded',
  archived:       '📦 Archived',
};

const SOURCE_DOCS = [
  { key: 'cultural-system-v2.0',         route: '/cultural-calendar',          label: 'Cultural Calendar',    icon: '📅', pageName: 'cultural_calendar' },
  { key: 'influencer-systems-v1.0',      route: '/influencer-systems',         label: 'Influencer Systems',   icon: '⭐', pageName: 'influencer_systems' },
  { key: 'world-infrastructure-v1.0',    route: '/world-infrastructure',       label: 'World Infrastructure', icon: '🏛️', pageName: 'world_infrastructure' },
  { key: 'social-timeline-v1.0',         route: '/social-timeline',            label: 'Social Timeline',      icon: '📰', pageName: 'social_timeline' },
  { key: 'social-personality-v1.0',      route: '/social-personality',         label: 'Social Personality',   icon: '🎭', pageName: 'social_personality' },
  { key: 'character-life-simulation-v1.0', route: '/character-life-simulation', label: 'Life Simulation',      icon: '🎲', pageName: 'character_life_simulation' },
  { key: 'cultural-memory-v1.0',         route: '/cultural-memory',            label: 'Cultural Memory',      icon: '🧠', pageName: 'cultural_memory' },
  { key: 'character-depth-engine-v1.0',  route: '/character-depth-engine',     label: 'Character Depth',      icon: '💎', pageName: 'character_depth_engine' },
];

const SOURCE_DOC_LOOKUP = Object.fromEntries(
  SOURCE_DOCS.flatMap(d => {
    const entries = [[d.key, d]];
    // Also map v1.0 variant for cultural-system
    if (d.key === 'cultural-system-v2.0') entries.push(['cultural-system-v1.0', d]);
    return entries;
  })
);

const INNER_TABS = [
  { key: 'laws',      label: 'Franchise Laws',   icon: '⬡' },
  { key: 'active',    label: 'Active Knowledge',  icon: null },
  { key: 'pending',   label: 'Pending Review',    icon: null },
  { key: 'archived',  label: 'Archived',          icon: '📦' },
  { key: 'amber',     label: 'Amber',             icon: '✦' },
  { key: 'sources',   label: 'Source Documents',   icon: '📚' },
  { key: 'documents', label: 'Documents',          icon: '📄' },
  { key: 'ingest',    label: 'Ingest Document',   icon: null },
  { key: 'extract',   label: 'Extract from Chat', icon: null },
  { key: 'guard',     label: 'Franchise Guard',   icon: null },
];

const S = {
  card: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    transition: 'border-color 0.2s',
  },
  badge: (color) => ({
    display: 'inline-block',
    fontSize: 11,
    letterSpacing: '0.03em',
    padding: '2px 8px',
    borderRadius: 6,
    background: color + '14',
    color: color,
    fontWeight: 600,
  }),
  btn: {
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 6,
    border: `1px solid ${C.border}`,
    background: C.surface,
    color: C.text,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  btnPrimary: {
    padding: '8px 18px',
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 6,
    border: 'none',
    background: C.accent,
    color: '#fff',
    cursor: 'pointer',
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    fontSize: 13,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    background: C.surface,
    color: C.text,
    outline: 'none',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '8px 10px',
    fontSize: 13,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    background: C.surface,
    color: C.text,
    outline: 'none',
    resize: 'vertical',
    minHeight: 80,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
};

export default function FranchiseBrain() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [innerTab, setInnerTab] = useState('laws');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: 'narrative', severity: 'important', always_inject: false });
  const [saving, setSaving] = useState(false);
  const [ingestText, setIngestText] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [guardForm, setGuardForm] = useState({ scene_brief: '', characters_in_scene: '', scene_type: '', tone: '' });
  const [guardResult, setGuardResult] = useState(null);
  const [guarding, setGuarding] = useState(false);
  const [extractText, setExtractText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [toast, setToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tabCounts, setTabCounts] = useState({ laws: 0, active: 0, pending: 0 });
  const [sourceCounts, setSourceCounts] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [brainDocs, setBrainDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState(null);
  const [amberActivity, setAmberActivity] = useState(null);
  const [amberLoading, setAmberLoading] = useState(false);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Load entries — filter based on active inner tab
  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (innerTab === 'laws') params.set('category', 'franchise_law');
      else if (innerTab === 'active') params.set('status', 'active');
      else if (innerTab === 'pending') params.set('status', 'pending_review');
      else if (innerTab === 'archived') params.set('status', 'archived');
      const res = await fetch(`${API}/franchise-brain/entries?${params}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [innerTab, showToast]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Load tab counts for badges
  const loadCounts = useCallback(async () => {
    try {
      const [lawsRes, activeRes, pendingRes, archivedRes] = await Promise.all([
        fetch(`${API}/franchise-brain/entries?category=franchise_law`),
        fetch(`${API}/franchise-brain/entries?status=active`),
        fetch(`${API}/franchise-brain/entries?status=pending_review`),
        fetch(`${API}/franchise-brain/entries?status=archived`),
      ]);
      const [lawsData, activeData, pendingData, archivedData] = await Promise.all([
        lawsRes.json(), activeRes.json(), pendingRes.json(), archivedRes.json(),
      ]);
      setTabCounts({
        laws: lawsData.count || 0,
        active: activeData.count || 0,
        pending: pendingData.count || 0,
        archived: archivedData.count || 0,
      });
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadCounts(); }, [loadCounts]);

  // Load per-source-document entry counts for Sources tab
  const loadSourceCounts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/franchise-brain/entries?limit=5000`);
      if (!res.ok) return;
      const data = await res.json();
      const counts = {};
      for (const e of (data.entries || [])) {
        if (e.source_document) counts[e.source_document] = (counts[e.source_document] || 0) + 1;
      }
      setSourceCounts(counts);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadSourceCounts(); }, [loadSourceCounts]);

  // Load brain documents for Documents tab
  const loadBrainDocs = useCallback(async () => {
    setDocsLoading(true);
    try {
      const res = await fetch(`${API}/franchise-brain/documents`);
      if (!res.ok) return;
      const data = await res.json();
      setBrainDocs(data.documents || []);
    } catch { /* silent */ }
    finally { setDocsLoading(false); }
  }, []);

  useEffect(() => { if (innerTab === 'documents') loadBrainDocs(); }, [innerTab, loadBrainDocs]);

  // Load Amber activity for Amber tab
  const loadAmberActivity = useCallback(async () => {
    setAmberLoading(true);
    try {
      const res = await fetch(`${API}/franchise-brain/amber-activity`);
      if (!res.ok) return;
      const data = await res.json();
      setAmberActivity(data);
    } catch { /* silent */ }
    finally { setAmberLoading(false); }
  }, []);

  useEffect(() => { if (innerTab === 'amber') loadAmberActivity(); }, [innerTab, loadAmberActivity]);

  async function unarchiveEntry(id) {
    try {
      const res = await fetch(`${API}/franchise-brain/entries/${id}/unarchive`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Failed to restore');
      showToast('Entry restored to active');
      load();
      loadCounts();
    } catch (e) { showToast(e.message, 'error'); }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/franchise-brain/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed to create');
      showToast('Entry created');
      setForm({ title: '', content: '', category: 'narrative', severity: 'important', always_inject: false });
      setShowForm(false);
      load();
      loadCounts();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function activateEntry(id) {
    try {
      const res = await fetch(`${API}/franchise-brain/entries/${id}/activate`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Failed to activate');
      showToast('Entry activated');
      load();
      loadCounts();
    } catch (e) { showToast(e.message, 'error'); }
  }

  async function archiveEntry(id) {
    try {
      const res = await fetch(`${API}/franchise-brain/entries/${id}/archive`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Failed to archive');
      showToast('Entry archived');
      load();
      loadCounts();
    } catch (e) { showToast(e.message, 'error'); }
  }

  async function deleteEntry(id) {
    if (!confirm('Delete this entry permanently?')) return;
    try {
      const res = await fetch(`${API}/franchise-brain/entries/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      showToast('Entry deleted');
      load();
      loadCounts();
    } catch (e) { showToast(e.message, 'error'); }
  }

  function startEdit(entry) {
    setEditingId(entry.id);
    setEditForm({ title: entry.title, content: entry.content, category: entry.category, severity: entry.severity, always_inject: entry.always_inject });
  }

  async function saveEdit(id) {
    try {
      const res = await fetch(`${API}/franchise-brain/entries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error('Failed to update');
      showToast('Entry updated');
      setEditingId(null);
      load();
    } catch (e) { showToast(e.message, 'error'); }
  }

  async function bulkActivate() {
    const pending = entries.filter(e => e.status === 'pending_review');
    if (!pending.length) return;
    if (!confirm(`Activate all ${pending.length} pending entries?`)) return;
    try {
      await Promise.all(pending.map(e =>
        fetch(`${API}/franchise-brain/entries/${e.id}/activate`, { method: 'PATCH' })
      ));
      showToast(`Activated ${pending.length} entries`);
      load();
      loadCounts();
    } catch (e) { showToast(e.message, 'error'); }
  }

  // Filter entries by search query
  const filteredEntries = searchQuery.trim()
    ? entries.filter(e =>
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : entries;

  async function handleIngest() {
    if (!ingestText.trim()) return;
    setIngesting(true);
    try {
      const res = await fetch(`${API}/franchise-brain/ingest-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_text: ingestText }),
      });
      if (!res.ok) throw new Error('Ingestion failed');
      const data = await res.json();
      showToast(`Ingested ${data.entries_created || 0} entries`);
      setIngestText('');
      setInnerTab('pending');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setIngesting(false);
    }
  }

  async function handleGuard() {
    if (!guardForm.scene_brief.trim()) return;
    setGuarding(true);
    try {
      const payload = {
        scene_brief: guardForm.scene_brief,
        characters_in_scene: guardForm.characters_in_scene ? guardForm.characters_in_scene.split(',').map(s => s.trim()).filter(Boolean) : [],
        scene_type: guardForm.scene_type || undefined,
        tone: guardForm.tone || undefined,
      };
      const res = await fetch(`${API}/franchise-brain/guard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Guard check failed');
      const data = await res.json();
      setGuardResult(data);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setGuarding(false);
    }
  }

  async function handleExtract() {
    if (!extractText.trim()) return;
    setExtracting(true);
    try {
      const res = await fetch(`${API}/franchise-brain/ingest-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_text: extractText, source: 'chat_extract' }),
      });
      if (!res.ok) throw new Error('Extraction failed');
      const data = await res.json();
      showToast(`Extracted ${data.entries_created || 0} entries`);
      setExtractText('');
      setInnerTab('pending');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setExtracting(false);
    }
  }

  const catLookup = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

  return (
    <div className="fb-root" style={{ background: C.bg, minHeight: '70vh' }}>
      {/* Header */}
      <div className="fb-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '28px 32px 20px' }}>
        <div style={{ display: 'flex', gap: 14 }}>
          <div style={{ width: 4, background: C.accent, borderRadius: 2, alignSelf: 'stretch' }} />
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text }}>Franchise Brain</h2>
            <div style={{ fontSize: 12, letterSpacing: '0.12em', color: C.accent, marginTop: 4, textTransform: 'uppercase', fontWeight: 500 }}>
              Every decision. Every law. Every locked truth.
            </div>
          </div>
        </div>
        <button style={S.btnPrimary} onClick={() => { setShowForm(true); setInnerTab('active'); }}>
          + Add Decision
        </button>
      </div>

      {/* Inner tabs */}
      <div className="fb-inner-tabs" style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, padding: '0 32px', gap: 0 }}>
        {INNER_TABS.map(tab => {
          const active = innerTab === tab.key;
          return (
            <button
              className="fb-inner-tab"
              key={tab.key}
              onClick={() => setInnerTab(tab.key)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: active ? `2px solid ${C.accent}` : '2px solid transparent',
                padding: '10px 18px',
                marginBottom: -1,
                fontSize: 13,
                color: active ? C.text : C.textFaint,
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'color 0.15s',
              }}
            >
              {tab.icon && <span className="fb-tab-icon" style={{ fontSize: 11, opacity: active ? 1 : 0.5 }}>{tab.icon}</span>}
              <span className="fb-tab-label">{tab.label}</span>
              {tabCounts[tab.key] > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700, background: active ? C.accent : C.border,
                  color: active ? '#fff' : C.textDim, borderRadius: 10, padding: '1px 6px', marginLeft: 2,
                }}>{tabCounts[tab.key]}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="fb-content" style={{ padding: '24px 32px' }}>

        {/* Create form — shows on any tab when triggered */}
        {showForm && (
          <form onSubmit={handleCreate} className="fb-form" style={{ ...S.card, marginBottom: 20, borderColor: C.accent }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: C.accent }}>New Knowledge Entry</div>
            <div className="fb-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: C.textDim, marginBottom: 4, display: 'block' }}>Title</label>
                <input style={S.input} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. JustAWoman is never small" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, color: C.textDim, marginBottom: 4, display: 'block' }}>Category</label>
                  <select style={S.input} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: C.textDim, marginBottom: 4, display: 'block' }}>Severity</label>
                  <select style={S.input} value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
                    {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: C.textDim, marginBottom: 4, display: 'block' }}>Content</label>
              <textarea style={S.textarea} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="What the AI must know, always..." />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: 12, color: C.textDim, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.always_inject} onChange={e => setForm(f => ({ ...f, always_inject: e.target.checked }))} />
                Always inject into prompts
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" style={S.btn} onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" style={S.btnPrimary} disabled={saving}>{saving ? 'Saving...' : 'Create Entry'}</button>
              </div>
            </div>
          </form>
        )}

        {/* Search bar — visible on list tabs */}
        {['laws', 'active', 'pending', 'archived'].includes(innerTab) && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
            <input
              style={{ ...S.input, maxWidth: 320 }}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search entries by title or content..."
            />
            {searchQuery && (
              <span style={{ fontSize: 12, color: C.textDim }}>{filteredEntries.length} result{filteredEntries.length !== 1 ? 's' : ''}</span>
            )}
            {innerTab === 'pending' && entries.length > 0 && (
              <button style={{ ...S.btnPrimary, marginLeft: 'auto', fontSize: 12, padding: '6px 14px' }} onClick={bulkActivate}>
                ✓ Activate All ({entries.length})
              </button>
            )}
          </div>
        )}

        {/* ── Franchise Laws tab ── */}
        {innerTab === 'laws' && (
          <EntriesList entries={filteredEntries} loading={loading} catLookup={catLookup} emptyMsg="No franchise laws found — run the migration to seed the six absolute laws." onActivate={activateEntry} onArchive={archiveEntry} onDelete={deleteEntry} onEdit={startEdit} editingId={editingId} editForm={editForm} setEditForm={setEditForm} onSaveEdit={saveEdit} onCancelEdit={() => setEditingId(null)} />
        )}

        {/* ── Active Knowledge tab ── */}
        {innerTab === 'active' && (
          <EntriesList entries={filteredEntries} loading={loading} catLookup={catLookup} emptyMsg="No active knowledge entries yet. Add decisions or ingest documents to populate." onActivate={activateEntry} onArchive={archiveEntry} onDelete={deleteEntry} onEdit={startEdit} editingId={editingId} editForm={editForm} setEditForm={setEditForm} onSaveEdit={saveEdit} onCancelEdit={() => setEditingId(null)} />
        )}

        {/* ── Pending Review tab ── */}
        {innerTab === 'pending' && (
          <EntriesList entries={filteredEntries} loading={loading} catLookup={catLookup} emptyMsg="No entries pending review." onActivate={activateEntry} onArchive={archiveEntry} onDelete={deleteEntry} onEdit={startEdit} editingId={editingId} editForm={editForm} setEditForm={setEditForm} onSaveEdit={saveEdit} onCancelEdit={() => setEditingId(null)} />
        )}

        {/* ── Archived tab ── */}
        {innerTab === 'archived' && (
          <EntriesList entries={filteredEntries} loading={loading} catLookup={catLookup} emptyMsg="No archived entries." onActivate={activateEntry} onArchive={archiveEntry} onDelete={deleteEntry} onEdit={startEdit} editingId={editingId} editForm={editForm} setEditForm={setEditForm} onSaveEdit={saveEdit} onCancelEdit={() => setEditingId(null)} onUnarchive={unarchiveEntry} isArchiveView />
        )}

        {/* ── Amber tab ── */}
        {innerTab === 'amber' && (
          <div>
            {amberLoading ? (
              <div style={{ fontSize: 13, color: C.textFaint, padding: 24, textAlign: 'center' }}>Loading Amber's activity…</div>
            ) : !amberActivity ? (
              <div style={{ ...S.card, textAlign: 'center', color: C.textDim, padding: 32 }}>No activity data yet.</div>
            ) : (
              <div>
                {/* Amber Header */}
                <div style={{ ...S.card, borderLeft: `3px solid #d4789a`, marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <span style={{ fontSize: 28 }}>✦</span>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Amber</div>
                      <div style={{ fontSize: 12, color: '#d4789a', fontStyle: 'italic' }}>Director of Vibes. First hire. Protector of the vision.</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.7 }}>
                    Amber can read the brain, push world content for your review, propose relationships and memories,
                    audit world pages, and develop new content — but she <b>cannot approve anything</b>. Only you can.
                    That's how she's protected: every decision passes through you.
                  </div>
                </div>

                {/* Growth Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: 'Total Entries', value: amberActivity.growth?.total_entries || 0, color: C.accent },
                    { label: 'Active', value: amberActivity.growth?.by_status?.active || 0, color: C.green },
                    { label: 'Pending Review', value: amberActivity.growth?.by_status?.pending_review || 0, color: C.gold },
                    { label: 'Archived', value: amberActivity.growth?.by_status?.archived || 0, color: C.textDim },
                    { label: 'Amber Pushed', value: amberActivity.amber?.total_contributions || 0, color: '#d4789a' },
                  ].map(stat => (
                    <div key={stat.label} style={{ ...S.card, textAlign: 'center', marginBottom: 0 }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                      <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* Knowledge by Category */}
                <div style={{ ...S.card, marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12 }}>Knowledge by Category</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {CATEGORIES.map(cat => {
                      const count = amberActivity.growth?.by_category?.[cat.key] || 0;
                      const total = amberActivity.growth?.total_entries || 1;
                      const pct = Math.round((count / total) * 100);
                      return (
                        <div key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{cat.icon}</span>
                          <span style={{ fontSize: 12, color: C.textDim, width: 110 }}>{cat.label}</span>
                          <div style={{ flex: 1, height: 6, background: C.border, borderRadius: 3 }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: cat.color, borderRadius: 3, transition: 'width 0.3s' }} />
                          </div>
                          <span style={{ fontSize: 11, color: C.textDim, width: 40, textAlign: 'right' }}>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Most Injected Knowledge */}
                {amberActivity.most_injected?.length > 0 && (
                  <div style={{ ...S.card, marginBottom: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12 }}>🔥 Most Used Knowledge</div>
                    <div style={{ fontSize: 12, color: C.textDim, marginBottom: 10 }}>These entries are injected into Amber's context most often — the living core of the brain.</div>
                    {amberActivity.most_injected.map(e => (
                      <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.accent, width: 36, textAlign: 'right' }}>{e.injection_count}×</span>
                        <span style={{ fontSize: 13, color: C.text, flex: 1 }}>{e.title}</span>
                        <span style={S.badge((catLookup[e.category] || {}).color || C.textDim)}>{e.category}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Amber's Contributions */}
                {amberActivity.amber?.recent_entries?.length > 0 && (
                  <div style={{ ...S.card, marginBottom: 16, borderLeft: '3px solid #d4789a' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12 }}>✦ Amber's Recent Contributions</div>
                    {amberActivity.amber.recent_entries.map(e => (
                      <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                        <span style={{ fontSize: 11, color: '#d4789a', width: 80 }}>{e.extracted_by === 'amber_push' ? '📤 push' : '🌍 worlddev'}</span>
                        <span style={{ fontSize: 13, color: C.text, flex: 1 }}>{e.title}</span>
                        <span style={S.badge(e.status === 'active' ? C.green : e.status === 'pending_review' ? C.gold : C.textDim)}>{e.status}</span>
                        <span style={{ fontSize: 11, color: C.textFaint }}>{new Date(e.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recent Brain Activity */}
                <div style={{ ...S.card }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12 }}>📋 Recent Activity</div>
                  {amberActivity.recent_activity?.map(e => (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 11, color: C.textFaint, width: 80 }}>{new Date(e.updated_at).toLocaleDateString()}</span>
                      <span style={{ fontSize: 13, color: C.text, flex: 1 }}>{e.title}</span>
                      <span style={S.badge((catLookup[e.category] || {}).color || C.textDim)}>{e.category}</span>
                      <span style={S.badge(e.status === 'active' ? C.green : e.status === 'pending_review' ? C.gold : e.status === 'archived' ? C.textDim : C.blue)}>{e.status}</span>
                    </div>
                  ))}
                </div>

                {/* Protection & Guardrails */}
                <div style={{ ...S.card, marginTop: 16, borderLeft: '3px solid ' + C.green }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 10 }}>🛡 Protection & Guardrails</div>
                  <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.8 }}>
                    <div style={{ marginBottom: 8 }}><b>How Amber is protected:</b></div>
                    <div>✦ Every entry she pushes starts as <span style={S.badge(C.gold)}>pending_review</span> — you decide what becomes active</div>
                    <div>✦ She cannot approve brain entries, confirm relationships, or confirm memories</div>
                    <div>✦ All her contributions are tagged with her source (<code>amber_push</code> / <code>amber_worlddev</code>) for full auditability</div>
                    <div>✦ The Franchise Guard checks every scene against active laws before generation</div>
                    <div style={{ marginTop: 12, marginBottom: 8 }}><b>How Amber protects her agents (the 5 Brains):</b></div>
                    <div>✦ <b>Story Brain</b> — narrative rules, franchise laws, locked decisions. Only activated entries inject into prompts</div>
                    <div>✦ <b>Character Brain</b> — character truths, relationship rules, personality boundaries</div>
                    <div>✦ <b>World Brain</b> — world infrastructure, cultural systems, social dynamics</div>
                    <div>✦ <b>Brand Brain</b> — brand identity, tone rules, visual language</div>
                    <div>✦ <b>Tech Brain</b> — system state, deployment facts, API boundaries</div>
                    <div style={{ marginTop: 8 }}>Each brain grows through ingestion + extraction. Amber can push content into them, but <b>only you</b> can activate it. That's the firewall.</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Source Documents tab ── */}
        {innerTab === 'sources' && (
          <div>
            <div style={{ fontSize: 13, color: C.textDim, marginBottom: 16 }}>
              These world-building pages feed knowledge into the brain. Click to visit a page, or view how many entries each has contributed.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
              {SOURCE_DOCS.map(doc => {
                const count = sourceCounts[doc.key] || 0;
                return (
                  <div
                    key={doc.key}
                    onClick={() => navigate(doc.route)}
                    style={{
                      ...S.card, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
                      borderLeft: `3px solid ${C.accent}`, marginBottom: 0,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.borderLeftColor = C.accent; }}
                  >
                    <span style={{ fontSize: 28 }}>{doc.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{doc.label}</div>
                      <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
                        {count > 0 ? `${count} brain entr${count === 1 ? 'y' : 'ies'}` : 'No entries yet'}
                      </div>
                    </div>
                    <span style={{ fontSize: 16, color: C.textFaint }}>→</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Documents tab ── */}
        {innerTab === 'documents' && (
          <div>
            <div style={{ fontSize: 13, color: C.textDim, marginBottom: 16 }}>
              Full text of every document ingested into the brain. Click to expand and see the original content.
            </div>
            {docsLoading ? (
              <div style={{ fontSize: 13, color: C.textFaint, padding: 24, textAlign: 'center' }}>Loading documents…</div>
            ) : brainDocs.length === 0 ? (
              <div style={{ ...S.card, textAlign: 'center', color: C.textDim, padding: 32 }}>
                No documents ingested yet. Use the <b>Ingest Document</b> tab to add your first one.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {brainDocs.map(doc => (
                  <div key={doc.id} style={{ ...S.card, borderLeft: `3px solid ${C.blue}` }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                      onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                    >
                      <span style={{ fontSize: 20 }}>📄</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{doc.source_name}</div>
                        <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
                          {doc.entries_created} entr{doc.entries_created === 1 ? 'y' : 'ies'} extracted · {doc.ingested_by || 'manual'}
                          {doc.created_at && <> · {new Date(doc.created_at).toLocaleDateString()}</>}
                        </div>
                      </div>
                      <span style={{ fontSize: 14, color: C.textFaint, transition: 'transform 0.2s', transform: expandedDoc === doc.id ? 'rotate(90deg)' : 'none' }}>▶</span>
                    </div>
                    {expandedDoc === doc.id && (
                      <pre style={{
                        marginTop: 12, padding: 14, background: C.bg, borderRadius: 6,
                        fontSize: 12, color: C.text, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word', maxHeight: 400, overflowY: 'auto',
                        border: `1px solid ${C.border}`,
                      }}>
                        {doc.document_text}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Ingest Document tab ── */}
        {innerTab === 'ingest' && (
          <div style={{ maxWidth: 720 }}>
            <PdfIngestZone
              brain="story"
              source="franchise_bible"
              version="v3.1"
              onResult={(result) => {
                showToast(`Ingested ${result.entries_extracted || 0} entries from PDF`);
                if (result.brain === 'story') setInnerTab('pending');
                else load();
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
              <div style={{ flex: 1, height: 1, background: '#e0d9ce' }} />
              <span style={{ fontSize: 11, color: '#a89f94', letterSpacing: '0.08em' }}>OR PASTE TEXT</span>
              <div style={{ flex: 1, height: 1, background: '#e0d9ce' }} />
            </div>

            <div style={{ ...S.card, borderColor: C.blue }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: C.text }}>📄 Document Ingestion</div>
              <div style={{ fontSize: 12, color: C.textDim, marginBottom: 14 }}>
                Paste a franchise document, character bible, or story outline. AI will extract knowledge entries for review.
              </div>
              <textarea
                style={{ ...S.textarea, minHeight: 160 }}
                value={ingestText}
                onChange={e => setIngestText(e.target.value)}
                placeholder="Paste franchise document text here..."
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button style={S.btnPrimary} onClick={handleIngest} disabled={ingesting || !ingestText.trim()}>
                  {ingesting ? 'Ingesting...' : 'Ingest & Extract'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Extract from Chat tab ── */}
        {innerTab === 'extract' && (
          <div style={{ maxWidth: 720 }}>
            <div style={{ ...S.card, borderColor: C.purple }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: C.text }}>💬 Extract from Chat</div>
              <div style={{ fontSize: 12, color: C.textDim, marginBottom: 14 }}>
                Paste a conversation, Amber session, or brainstorm. AI will identify franchise-relevant decisions and knowledge to extract.
              </div>
              <textarea
                style={{ ...S.textarea, minHeight: 160 }}
                value={extractText}
                onChange={e => setExtractText(e.target.value)}
                placeholder="Paste chat / conversation text here..."
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button style={S.btnPrimary} onClick={handleExtract} disabled={extracting || !extractText.trim()}>
                  {extracting ? 'Extracting...' : 'Extract Knowledge'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Franchise Guard tab ── */}
        {innerTab === 'guard' && (
          <div style={{ maxWidth: 720 }}>
            <div style={{ ...S.card, borderColor: C.red }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: C.text }}>🛡 Franchise Guard</div>
              <div style={{ fontSize: 12, color: C.textDim, marginBottom: 14 }}>
                Describe a scene and the guard will check it against all active franchise laws and knowledge before generation.
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: C.textDim, marginBottom: 4, display: 'block' }}>Scene Brief *</label>
                <textarea
                  style={{ ...S.textarea, minHeight: 120 }}
                  value={guardForm.scene_brief}
                  onChange={e => setGuardForm(f => ({ ...f, scene_brief: e.target.value }))}
                  placeholder="Describe the scene — what happens, where, and why..."
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: C.textDim, marginBottom: 4, display: 'block' }}>Characters (comma-separated)</label>
                  <input
                    style={S.input}
                    value={guardForm.characters_in_scene}
                    onChange={e => setGuardForm(f => ({ ...f, characters_in_scene: e.target.value }))}
                    placeholder="e.g. Lala, Miko, Ren"
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: C.textDim, marginBottom: 4, display: 'block' }}>Scene Type</label>
                  <input
                    style={S.input}
                    value={guardForm.scene_type}
                    onChange={e => setGuardForm(f => ({ ...f, scene_type: e.target.value }))}
                    placeholder="e.g. confrontation, flashback"
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: C.textDim, marginBottom: 4, display: 'block' }}>Tone</label>
                  <input
                    style={S.input}
                    value={guardForm.tone}
                    onChange={e => setGuardForm(f => ({ ...f, tone: e.target.value }))}
                    placeholder="e.g. tense, comedic"
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button style={{ ...S.btnPrimary, background: C.red }} onClick={handleGuard} disabled={guarding || !guardForm.scene_brief.trim()}>
                  {guarding ? 'Checking...' : 'Run Guard Check'}
                </button>
              </div>
            </div>
            {guardResult && (
              <div style={{ ...S.card, marginTop: 16, borderColor: guardResult.warnings?.length ? C.red : C.green }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: guardResult.warnings?.length ? C.red : C.green }}>
                  {guardResult.warnings?.length ? `⚠ ${guardResult.warnings.length} warning(s) found` : '✓ No violations detected'}
                </div>
                {guardResult.warnings?.map((v, i) => (
                  <div key={i} style={{ fontSize: 13, color: C.textDim, padding: '6px 0', borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
                    <span style={{ fontWeight: 600, color: C.red }}>{v.law}</span>
                    {v.risk && <span> — {v.risk}</span>}
                    {v.suggestion && <div style={{ fontSize: 12, color: C.green, marginTop: 4 }}>💡 {v.suggestion}</div>}
                  </div>
                ))}
                {guardResult.message && (
                  <div style={{ fontSize: 13, color: C.textDim, marginTop: 8, lineHeight: 1.6 }}>{guardResult.message}</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, padding: '10px 20px',
          borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 9999,
          background: toast.type === 'error' ? C.red : C.green, color: '#fff',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* Shared entries list sub-component */
function EntriesList({ entries, loading, catLookup, emptyMsg, onActivate, onArchive, onDelete, onEdit, editingId, editForm, setEditForm, onSaveEdit, onCancelEdit, onUnarchive, isArchiveView }) {
  const nav = useNavigate();
  const [expandedIds, setExpandedIds] = useState(new Set());
  const COLLAPSE_LEN = 300;

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: C.textFaint }}>Loading...</div>;
  }
  if (entries.length === 0) {
    return <div style={{ textAlign: 'center', padding: 60, color: C.textFaint, fontSize: 14 }}>{emptyMsg}</div>;
  }
  return entries.map(entry => {
    const cat = catLookup[entry.category] || { icon: '?', color: C.textDim };
    const isEditing = editingId === entry.id;
    const isLong = entry.content && entry.content.length > COLLAPSE_LEN;
    const isExpanded = expandedIds.has(entry.id);

    if (isEditing) {
      return (
        <div key={entry.id} className="fb-entry-card" style={{ ...S.card, borderLeft: `3px solid ${C.accent}`, borderColor: C.accent }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: C.accent }}>Editing Entry</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: C.textDim, marginBottom: 4, display: 'block' }}>Title</label>
              <input style={S.input} value={editForm.title || ''} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontSize: 11, color: C.textDim, marginBottom: 4, display: 'block' }}>Category</label>
                <select style={S.input} value={editForm.category || ''} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.textDim, marginBottom: 4, display: 'block' }}>Severity</label>
                <select style={S.input} value={editForm.severity || ''} onChange={e => setEditForm(f => ({ ...f, severity: e.target.value }))}>
                  {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: C.textDim, marginBottom: 4, display: 'block' }}>Content</label>
            <textarea style={{ ...S.textarea, minHeight: 100 }} value={editForm.content || ''} onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: 12, color: C.textDim, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={editForm.always_inject || false} onChange={e => setEditForm(f => ({ ...f, always_inject: e.target.checked }))} />
              Always inject
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={S.btn} onClick={onCancelEdit}>Cancel</button>
              <button style={S.btnPrimary} onClick={() => onSaveEdit(entry.id)}>Save</button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={entry.id} className="fb-entry-card" style={{ ...S.card, borderLeft: `3px solid ${cat.color}` }}>
        <div className="fb-entry-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 14 }}>{cat.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{entry.title}</span>
              {entry.always_inject && <span style={S.badge(C.gold)}>always inject</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, fontSize: 11, color: C.textDim, flexWrap: 'wrap' }}>
              <span style={S.badge(cat.color)}>{entry.category}</span>
              <span style={S.badge(entry.severity === 'critical' ? C.red : entry.severity === 'important' ? C.accent : C.textDim)}>
                {entry.severity}
              </span>
              <span>{STATUS_LABELS[entry.status] || entry.status}</span>
              {entry.injection_count > 0 && <span>· injected {entry.injection_count}×</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={{ ...S.btn, fontSize: 11, color: C.blue }} onClick={() => onEdit(entry)} title="Edit">✎</button>
            {entry.status === 'pending_review' && (
              <button style={{ ...S.btn, fontSize: 11, color: C.green }} onClick={() => onActivate(entry.id)}>✓ Activate</button>
            )}
            {isArchiveView && onUnarchive ? (
              <button style={{ ...S.btn, fontSize: 11, color: C.green }} onClick={() => onUnarchive(entry.id)} title="Restore to active">↩ Restore</button>
            ) : entry.status !== 'archived' && (
              <button style={{ ...S.btn, fontSize: 11, color: C.textDim }} onClick={() => onArchive(entry.id)} title="Archive">📦</button>
            )}
            <button style={{ ...S.btn, fontSize: 11, color: C.red }} onClick={() => onDelete(entry.id)} title="Delete">✕</button>
          </div>
        </div>
        <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {isLong && !isExpanded ? entry.content.slice(0, COLLAPSE_LEN) + '...' : entry.content}
        </div>
        {isLong && (
          <button
            style={{ background: 'none', border: 'none', fontSize: 12, color: C.accent, cursor: 'pointer', padding: '4px 0', fontWeight: 600 }}
            onClick={() => toggleExpand(entry.id)}
          >
            {isExpanded ? '▴ Show less' : '▾ Show more'}
          </button>
        )}
        {entry.source_document && (() => {
          const srcDoc = SOURCE_DOC_LOOKUP[entry.source_document];
          return (
            <div style={{ fontSize: 11, color: C.textFaint, marginTop: 8 }}>
              Source: {srcDoc ? (
                <span
                  style={{ color: C.blue, cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => nav(srcDoc.route)}
                >
                  {srcDoc.icon} {srcDoc.label}
                </span>
              ) : entry.source_document}
              {entry.source_version ? ` v${entry.source_version}` : ''} · {entry.extracted_by}
            </div>
          );
        })()}
      </div>
    );
  });
}
