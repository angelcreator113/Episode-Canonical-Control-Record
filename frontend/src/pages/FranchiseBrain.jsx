// FranchiseBrain.jsx
// Franchise Knowledge Management — the living brain of the LalaVerse
// Tab in the Universe page, story-side cluster (knowledge tab)
// Tabbed layout: Franchise Laws | Active Knowledge | Pending Review | Ingest Document | Extract from Chat | Franchise Guard

import { useState, useEffect, useCallback } from 'react';
import PdfIngestZone from '../components/PdfIngestZone';

const API = import.meta.env.VITE_API_URL || '';

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

const INNER_TABS = [
  { key: 'laws',      label: 'Franchise Laws',   icon: '⬡' },
  { key: 'active',    label: 'Active Knowledge',  icon: null },
  { key: 'pending',   label: 'Pending Review',    icon: null },
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
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [innerTab, setInnerTab] = useState('laws');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: 'narrative', severity: 'important', always_inject: false });
  const [saving, setSaving] = useState(false);
  const [ingestText, setIngestText] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [guardText, setGuardText] = useState('');
  const [guardResult, setGuardResult] = useState(null);
  const [guarding, setGuarding] = useState(false);
  const [extractText, setExtractText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [toast, setToast] = useState(null);

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
    } catch (e) { showToast(e.message, 'error'); }
  }

  async function archiveEntry(id) {
    try {
      const res = await fetch(`${API}/franchise-brain/entries/${id}/archive`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Failed to archive');
      showToast('Entry archived');
      load();
    } catch (e) { showToast(e.message, 'error'); }
  }

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
    if (!guardText.trim()) return;
    setGuarding(true);
    try {
      const res = await fetch(`${API}/franchise-brain/guard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: guardText }),
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
    <div style={{ background: C.bg, minHeight: '70vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '28px 32px 20px' }}>
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
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, padding: '0 32px', gap: 0 }}>
        {INNER_TABS.map(tab => {
          const active = innerTab === tab.key;
          return (
            <button
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
              {tab.icon && <span style={{ fontSize: 11, opacity: active ? 1 : 0.5 }}>{tab.icon}</span>}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ padding: '24px 32px' }}>

        {/* Create form — shows on any tab when triggered */}
        {showForm && (
          <form onSubmit={handleCreate} style={{ ...S.card, marginBottom: 20, borderColor: C.accent }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: C.accent }}>New Knowledge Entry</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
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

        {/* ── Franchise Laws tab ── */}
        {innerTab === 'laws' && (
          <EntriesList entries={entries} loading={loading} catLookup={catLookup} emptyMsg="No franchise laws found — run the migration to seed the six absolute laws." onActivate={activateEntry} onArchive={archiveEntry} />
        )}

        {/* ── Active Knowledge tab ── */}
        {innerTab === 'active' && (
          <EntriesList entries={entries} loading={loading} catLookup={catLookup} emptyMsg="No active knowledge entries yet. Add decisions or ingest documents to populate." onActivate={activateEntry} onArchive={archiveEntry} />
        )}

        {/* ── Pending Review tab ── */}
        {innerTab === 'pending' && (
          <EntriesList entries={entries} loading={loading} catLookup={catLookup} emptyMsg="No entries pending review." onActivate={activateEntry} onArchive={archiveEntry} />
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
                Paste any content — script, chapter, outline — and the guard will check it against all active franchise laws and knowledge.
              </div>
              <textarea
                style={{ ...S.textarea, minHeight: 160 }}
                value={guardText}
                onChange={e => setGuardText(e.target.value)}
                placeholder="Paste content to check against franchise rules..."
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button style={{ ...S.btnPrimary, background: C.red }} onClick={handleGuard} disabled={guarding || !guardText.trim()}>
                  {guarding ? 'Checking...' : 'Run Guard Check'}
                </button>
              </div>
            </div>
            {guardResult && (
              <div style={{ ...S.card, marginTop: 16, borderColor: guardResult.violations?.length ? C.red : C.green }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: guardResult.violations?.length ? C.red : C.green }}>
                  {guardResult.violations?.length ? `⚠ ${guardResult.violations.length} violation(s) found` : '✓ No violations detected'}
                </div>
                {guardResult.violations?.map((v, i) => (
                  <div key={i} style={{ fontSize: 13, color: C.textDim, padding: '6px 0', borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
                    <span style={{ fontWeight: 600, color: C.red }}>{v.rule || v.law}</span>
                    {v.explanation && <span> — {v.explanation}</span>}
                  </div>
                ))}
                {guardResult.summary && (
                  <div style={{ fontSize: 13, color: C.textDim, marginTop: 8, lineHeight: 1.6 }}>{guardResult.summary}</div>
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
function EntriesList({ entries, loading, catLookup, emptyMsg, onActivate, onArchive }) {
  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: C.textFaint }}>Loading...</div>;
  }
  if (entries.length === 0) {
    return <div style={{ textAlign: 'center', padding: 60, color: C.textFaint, fontSize: 14 }}>{emptyMsg}</div>;
  }
  return entries.map(entry => {
    const cat = catLookup[entry.category] || { icon: '?', color: C.textDim };
    return (
      <div key={entry.id} style={{ ...S.card, borderLeft: `3px solid ${cat.color}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 14 }}>{cat.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{entry.title}</span>
              {entry.always_inject && <span style={S.badge(C.gold)}>always inject</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, fontSize: 11, color: C.textDim }}>
              <span style={S.badge(cat.color)}>{entry.category}</span>
              <span style={S.badge(entry.severity === 'critical' ? C.red : entry.severity === 'important' ? C.accent : C.textDim)}>
                {entry.severity}
              </span>
              <span>{STATUS_LABELS[entry.status] || entry.status}</span>
              {entry.injection_count > 0 && <span>· injected {entry.injection_count}×</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {entry.status === 'pending_review' && (
              <button style={{ ...S.btn, fontSize: 11, color: C.green }} onClick={() => onActivate(entry.id)}>✓ Activate</button>
            )}
            {entry.status !== 'archived' && (
              <button style={{ ...S.btn, fontSize: 11, color: C.textDim }} onClick={() => onArchive(entry.id)}>📦</button>
            )}
          </div>
        </div>
        <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{entry.content}</div>
        {entry.source_document && (
          <div style={{ fontSize: 11, color: C.textFaint, marginTop: 8 }}>
            Source: {entry.source_document} {entry.source_version ? `v${entry.source_version}` : ''} · {entry.extracted_by}
          </div>
        )}
      </div>
    );
  });
}
