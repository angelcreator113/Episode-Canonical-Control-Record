// FranchiseBrain.jsx
// Franchise Knowledge Base — /franchise-brain
// Every locked decision, character truth, and franchise law in one place.
// Upload documents. Type decisions. Extract from conversations. Guard every generation.

import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || '';

const C = {
  bg: '#f7f4ef',
  surface: '#ffffff',
  surfaceAlt: '#f0ece5',
  surfaceRaise: '#faf8f4',
  border: '#e2ddd4',
  borderLight: '#ebe6de',
  text: '#1c1814',
  textDim: '#6b6560',
  textFaint: '#a09a92',
  gold: '#b8863e',
  goldSoft: '#b8863e14',
  goldMid: '#b8863e33',
  red: '#b5544f',
  redSoft: '#b5544f12',
  green: '#4a8c6e',
  greenSoft: '#4a8c6e12',
  blue: '#4a6e8c',
  blueSoft: '#4a6e8c12',
  purple: '#7a5a9e',
  purpleSoft: '#7a5a9e12',
  orange: '#b57a3e',
  law: '#b8863e',
};

const CATEGORY_CONFIG = {
  franchise_law:    { label: 'Franchise Law',    color: C.gold,   icon: '⬡' },
  character:        { label: 'Character',         color: C.blue,   icon: '◎' },
  narrative:        { label: 'Narrative',         color: C.purple, icon: '◇' },
  locked_decision:  { label: 'Locked Decision',   color: C.red,    icon: '◈' },
  brand:            { label: 'Brand',             color: C.green,  icon: '✦' },
  world:            { label: 'World',             color: C.orange, icon: '○' },
  technical:        { label: 'Technical',         color: C.textDim,icon: '⧖' },
};

const SEVERITY_CONFIG = {
  critical:  { label: 'Critical',  color: C.red },
  important: { label: 'Important', color: C.gold },
  context:   { label: 'Context',   color: C.textDim },
};

const SOURCE_DOCS = [
  { value: 'franchise_bible', label: 'Franchise Bible' },
  { value: 'tdd', label: 'TDD' },
  { value: 'roadmap', label: 'Roadmap' },
  { value: 'deviations', label: 'Deviations Log' },
  { value: 'conversation', label: 'Conversation' },
  { value: 'direct', label: 'Direct Entry' },
];

const TABS = [
  { key: 'laws',      label: '⬡ Franchise Laws' },
  { key: 'active',    label: 'Active Knowledge' },
  { key: 'pending',   label: 'Pending Review' },
  { key: 'ingest',    label: 'Ingest Document' },
  { key: 'extract',   label: 'Extract from Chat' },
  { key: 'guard',     label: 'Franchise Guard' },
];

export default function FranchiseBrain() {
  const [activeTab, setActiveTab] = useState('laws');
  const [entries, setEntries] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // New entry form
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [newEntry, setNewEntry] = useState({ title: '', content: '', category: 'narrative', severity: 'important', applies_to: '', source_document: 'direct' });
  const [savingEntry, setSavingEntry] = useState(false);

  // Ingest
  const [docText, setDocText] = useState('');
  const [docSource, setDocSource] = useState('franchise_bible');
  const [docVersion, setDocVersion] = useState('v3.1');
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState(null);

  // Conversation extract
  const [chatText, setChatText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState(null);

  // Guard
  const [guardBrief, setGuardBrief] = useState('');
  const [guardChars, setGuardChars] = useState('');
  const [guardType, setGuardType] = useState('');
  const [guardRunning, setGuardRunning] = useState(false);
  const [guardResult, setGuardResult] = useState(null);

  // Editing
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => { loadEntries(); }, [activeTab, filterCategory, filterSeverity, searchQuery]);

  async function loadEntries() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab === 'laws') params.set('always_inject', 'true');
      else if (activeTab === 'pending') params.set('status', 'pending_review');
      else if (activeTab === 'active') params.set('status', 'active');
      if (filterCategory) params.set('category', filterCategory);
      if (filterSeverity) params.set('severity', filterSeverity);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`${API}/franchise-brain/entries?${params}`);
      const data = await res.json();
      setEntries(data.entries || []);
      setCounts(data.counts || {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveNewEntry() {
    setSavingEntry(true);
    try {
      const res = await fetch(`${API}/franchise-brain/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newEntry,
          applies_to: newEntry.applies_to.split(',').map(t => t.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowNewEntry(false);
      setNewEntry({ title: '', content: '', category: 'narrative', severity: 'important', applies_to: '', source_document: 'direct' });
      loadEntries();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingEntry(false);
    }
  }

  async function activateEntry(id) {
    await fetch(`${API}/franchise-brain/entries/${id}/activate`, { method: 'POST' });
    loadEntries();
  }

  async function archiveEntry(id) {
    await fetch(`${API}/franchise-brain/entries/${id}/archive`, { method: 'POST' });
    loadEntries();
  }

  async function saveEdit(id) {
    await fetch(`${API}/franchise-brain/entries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editContent }),
    });
    setEditingId(null);
    loadEntries();
  }

  async function handleIngest() {
    if (!docText.trim()) return;
    setIngesting(true); setIngestResult(null);
    try {
      const res = await fetch(`${API}/franchise-brain/ingest-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_text: docText, source_document: docSource, source_version: docVersion }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIngestResult(data);
      setDocText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setIngesting(false);
    }
  }

  async function handleExtract() {
    if (!chatText.trim()) return;
    setExtracting(true); setExtractResult(null);
    try {
      const res = await fetch(`${API}/franchise-brain/extract-conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_text: chatText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setExtractResult(data);
      setChatText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setExtracting(false);
    }
  }

  async function handleGuard() {
    if (!guardBrief.trim()) return;
    setGuardRunning(true); setGuardResult(null);
    try {
      const res = await fetch(`${API}/franchise-brain/guard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene_brief: guardBrief,
          character_names: guardChars.split(',').map(c => c.trim()).filter(Boolean),
          scene_type: guardType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGuardResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardRunning(false);
    }
  }

  const displayEntries = activeTab === 'laws'
    ? entries.filter(e => e.always_inject)
    : entries;

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, sans-serif', color: C.text }}>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: '18px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.surface }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '3px', height: '24px', background: C.gold, borderRadius: '1px' }} />
          <div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '17px', fontWeight: '600', color: C.text }}>Franchise Brain</div>
            <div style={{ fontSize: '11px', color: C.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '2px' }}>
              Every decision. Every law. Every locked truth.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {counts.laws > 0 && (
            <div style={{ padding: '5px 12px', background: C.goldSoft, border: `1px solid ${C.goldMid}`, borderRadius: '2px', fontSize: '11px', color: C.gold }}>
              {counts.laws} absolute laws
            </div>
          )}
          {counts.pending_review > 0 && (
            <div style={{ padding: '5px 12px', background: C.redSoft, border: `1px solid ${C.red}44`, borderRadius: '2px', fontSize: '11px', color: C.red }}>
              {counts.pending_review} pending review
            </div>
          )}
          <button onClick={() => setShowNewEntry(true)} style={{ padding: '8px 16px', background: C.gold, border: 'none', borderRadius: '2px', fontSize: '12px', color: '#ffffff', fontWeight: '700', cursor: 'pointer', letterSpacing: '0.04em' }}>
            + Add Decision
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: `1px solid ${C.border}`, display: 'flex', padding: '0 28px', background: C.surface, overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            background: 'none', border: 'none',
            borderBottom: activeTab === tab.key ? `2px solid ${C.gold}` : '2px solid transparent',
            padding: '12px 18px', marginBottom: '-1px',
            fontSize: '12px', letterSpacing: '0.04em',
            color: activeTab === tab.key ? C.text : C.textDim,
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}>{tab.label}</button>
        ))}
      </div>

      {error && (
        <div style={{ margin: '16px 28px 0', background: C.redSoft, border: `1px solid ${C.red}44`, borderRadius: '2px', padding: '10px 14px', fontSize: '13px', color: C.red }}>
          {error} <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', marginLeft: '8px' }}>✕</button>
        </div>
      )}

      <div style={{ padding: '24px 28px' }}>

        {/* New Entry Modal */}
        {showNewEntry && (
          <div style={{ marginBottom: '24px', background: C.surface, border: `1px solid ${C.gold}44`, borderTop: `2px solid ${C.gold}`, borderRadius: '2px', padding: '20px' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '15px', fontWeight: '600', marginBottom: '16px', color: C.gold }}>Add a Decision</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <FieldLabel>Title</FieldLabel>
                <input value={newEntry.title} onChange={e => setNewEntry(p => ({ ...p, title: e.target.value }))} placeholder="Short label for this decision" style={iS} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <FieldLabel>Category</FieldLabel>
                  <select value={newEntry.category} onChange={e => setNewEntry(p => ({ ...p, category: e.target.value }))} style={iS}>
                    {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel>Severity</FieldLabel>
                  <select value={newEntry.severity} onChange={e => setNewEntry(p => ({ ...p, severity: e.target.value }))} style={iS}>
                    {Object.entries(SEVERITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <FieldLabel>Decision — write it as a direct active statement</FieldLabel>
              <textarea value={newEntry.content} onChange={e => setNewEntry(p => ({ ...p, content: e.target.value }))} placeholder="JustAWoman never compares herself to other women. She watches successful women, gets inspired, and pushes herself harder. Any scene that frames her as competitive with or diminished by another woman is a franchise violation." style={{ ...iS, height: '100px', resize: 'vertical', lineHeight: '1.7' }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <FieldLabel>Applies to (comma-separated tags)</FieldLabel>
              <input value={newEntry.applies_to} onChange={e => setNewEntry(p => ({ ...p, applies_to: e.target.value }))} placeholder="JustAWoman, all_scenes, character" style={iS} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={saveNewEntry} disabled={!newEntry.title || !newEntry.content || savingEntry} style={{ padding: '10px 20px', background: newEntry.title && newEntry.content ? C.gold : C.surfaceAlt, border: 'none', borderRadius: '2px', color: newEntry.title && newEntry.content ? '#ffffff' : C.textFaint, fontSize: '13px', fontWeight: '700', cursor: newEntry.title && newEntry.content ? 'pointer' : 'default' }}>
                {savingEntry ? 'Saving…' : 'Save & Activate →'}
              </button>
              <button onClick={() => setShowNewEntry(false)} style={{ padding: '10px 16px', background: 'none', border: `1px solid ${C.border}`, borderRadius: '2px', color: C.textDim, fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Laws + Active tabs */}
        {(activeTab === 'laws' || activeTab === 'active') && (
          <div>
            {activeTab === 'active' && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search decisions…" style={{ ...iS, flex: 1, minWidth: '200px' }} />
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ ...iS, width: 'auto' }}>
                  <option value="">All categories</option>
                  {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} style={{ ...iS, width: 'auto' }}>
                  <option value="">All severity</option>
                  {Object.entries(SEVERITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            )}

            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center' }}><Spin /></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {displayEntries.length === 0 && (
                  <div style={{ padding: '40px', textAlign: 'center', color: C.textFaint, fontSize: '14px' }}>
                    {activeTab === 'laws' ? 'No franchise laws found — run the migration to seed the six absolute laws.' : 'No entries found.'}
                  </div>
                )}
                {displayEntries.map(entry => {
                  const catConf = CATEGORY_CONFIG[entry.category] || CATEGORY_CONFIG.narrative;
                  const sevConf = SEVERITY_CONFIG[entry.severity] || SEVERITY_CONFIG.important;
                  const isEditing = editingId === entry.id;

                  return (
                    <div key={entry.id} style={{
                      background: C.surface,
                      border: `1px solid ${entry.always_inject ? C.goldMid : C.border}`,
                      borderLeft: `3px solid ${entry.always_inject ? C.gold : catConf.color}`,
                      borderRadius: '2px', padding: '16px 18px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                            {entry.always_inject && (
                              <div style={{ padding: '2px 8px', background: C.goldSoft, border: `1px solid ${C.goldMid}`, borderRadius: '2px', fontSize: '9px', color: C.gold, letterSpacing: '0.12em', fontWeight: '700', textTransform: 'uppercase' }}>
                                ⬡ ABSOLUTE LAW
                              </div>
                            )}
                            <div style={{ padding: '2px 8px', background: `${catConf.color}12`, border: `1px solid ${catConf.color}33`, borderRadius: '2px', fontSize: '10px', color: catConf.color, letterSpacing: '0.08em' }}>
                              {catConf.icon} {catConf.label}
                            </div>
                            <div style={{ padding: '2px 8px', background: `${sevConf.color}10`, border: `1px solid ${sevConf.color}28`, borderRadius: '2px', fontSize: '10px', color: sevConf.color }}>
                              {sevConf.label}
                            </div>
                            {entry.source_document && (
                              <div style={{ fontSize: '10px', color: C.textFaint }}>{entry.source_document} {entry.source_version || ''}</div>
                            )}
                          </div>

                          <div style={{ fontFamily: 'Georgia, serif', fontSize: '14px', fontWeight: '600', color: C.text, marginBottom: '8px' }}>{entry.title}</div>

                          {isEditing ? (
                            <div>
                              <textarea value={editContent} onChange={e => setEditContent(e.target.value)} style={{ ...iS, height: '120px', resize: 'vertical', lineHeight: '1.7', marginBottom: '8px' }} />
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button onClick={() => saveEdit(entry.id)} style={sBtn(C.gold)}>Save</button>
                                <button onClick={() => setEditingId(null)} style={sBtn(C.textFaint, true)}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <p style={{ fontSize: '13px', color: C.textDim, lineHeight: '1.7', margin: 0 }}>{entry.content}</p>
                          )}

                          {entry.applies_to?.length > 0 && (
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '8px' }}>
                              {entry.applies_to.map(tag => (
                                <div key={tag} style={{ padding: '2px 7px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: '2px', fontSize: '10px', color: C.textFaint }}>
                                  {tag}
                                </div>
                              ))}
                            </div>
                          )}

                          {entry.injection_count > 0 && (
                            <div style={{ fontSize: '10px', color: C.textFaint, marginTop: '6px' }}>
                              Injected {entry.injection_count}× {entry.last_injected_at ? `· Last: ${new Date(entry.last_injected_at).toLocaleDateString()}` : ''}
                            </div>
                          )}
                        </div>

                        {!entry.always_inject && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                            {!isEditing && (
                              <button onClick={() => { setEditingId(entry.id); setEditContent(entry.content); }} style={sBtn(C.blue, true)}>Edit</button>
                            )}
                            <button onClick={() => archiveEntry(entry.id)} style={sBtn(C.textFaint, true)}>Archive</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Pending tab */}
        {activeTab === 'pending' && (
          <div>
            <p style={{ fontSize: '13px', color: C.textFaint, marginBottom: '16px', lineHeight: '1.6' }}>
              These entries were extracted from documents or conversations. Review each one — activate what's correct, archive what isn't. Nothing in this list is injecting into generation yet.
            </p>
            {loading ? <div style={{ padding: '40px', textAlign: 'center' }}><Spin /></div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {entries.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: C.textFaint }}>No entries pending review.</div>}
                {entries.map(entry => {
                  const catConf = CATEGORY_CONFIG[entry.category] || CATEGORY_CONFIG.narrative;
                  return (
                    <div key={entry.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${catConf.color}`, borderRadius: '2px', padding: '16px 18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <div style={{ padding: '2px 8px', background: `${catConf.color}12`, border: `1px solid ${catConf.color}33`, borderRadius: '2px', fontSize: '10px', color: catConf.color }}>{catConf.icon} {catConf.label}</div>
                            <div style={{ fontSize: '10px', color: C.textFaint }}>{entry.source_document} {entry.source_version || ''}</div>
                          </div>
                          <div style={{ fontFamily: 'Georgia, serif', fontSize: '14px', fontWeight: '600', color: C.text, marginBottom: '6px' }}>{entry.title}</div>
                          <p style={{ fontSize: '13px', color: C.textDim, lineHeight: '1.7', margin: 0 }}>{entry.content}</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                          <button onClick={() => activateEntry(entry.id)} style={sBtn(C.green)}>Activate →</button>
                          <button onClick={() => archiveEntry(entry.id)} style={sBtn(C.textFaint, true)}>Discard</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Ingest tab */}
        {activeTab === 'ingest' && (
          <div style={{ maxWidth: '760px' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '16px', fontWeight: '600', marginBottom: '6px' }}>Ingest a Document</div>
            <p style={{ fontSize: '13px', color: C.textFaint, lineHeight: '1.6', marginBottom: '20px' }}>
              Paste your Franchise Bible, TDD, Roadmap, or Deviations Log. Claude extracts every decision as individual knowledge entries. You review them all before anything goes live.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <FieldLabel>Source Document</FieldLabel>
                <select value={docSource} onChange={e => setDocSource(e.target.value)} style={iS}>
                  {SOURCE_DOCS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Version</FieldLabel>
                <input value={docVersion} onChange={e => setDocVersion(e.target.value)} placeholder="v3.1" style={iS} />
              </div>
            </div>

            <FieldLabel>Document Text — paste the full content here</FieldLabel>
            <textarea value={docText} onChange={e => setDocText(e.target.value)} placeholder="Paste the full document text here…" style={{ ...iS, height: '280px', resize: 'vertical', lineHeight: '1.7', marginBottom: '14px' }} />

            <button onClick={handleIngest} disabled={!docText.trim() || ingesting} style={{ padding: '12px 24px', background: docText.trim() && !ingesting ? C.gold : C.surfaceAlt, border: 'none', borderRadius: '2px', color: docText.trim() && !ingesting ? '#ffffff' : C.textFaint, fontSize: '14px', fontWeight: '700', cursor: docText.trim() && !ingesting ? 'pointer' : 'default', fontFamily: 'Georgia, serif' }}>
              {ingesting ? 'Extracting decisions…' : 'Extract Knowledge Entries →'}
            </button>

            {ingesting && (
              <div style={{ marginTop: '14px', padding: '14px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: '2px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <Spin /><div><div style={{ fontSize: '13px', color: C.text }}>Reading the document…</div><div style={{ fontSize: '11px', color: C.textFaint, marginTop: '2px' }}>Extracting individual decisions</div></div>
              </div>
            )}

            {ingestResult && (
              <div style={{ marginTop: '16px', padding: '16px', background: C.greenSoft, border: `1px solid ${C.green}44`, borderRadius: '2px' }}>
                <div style={{ fontSize: '14px', color: C.green, fontWeight: '600', marginBottom: '4px' }}>✓ {ingestResult.entries_extracted} entries extracted</div>
                <p style={{ fontSize: '12px', color: C.textDim, margin: '0 0 4px' }}>{ingestResult.summary}</p>
                <p style={{ fontSize: '12px', color: C.textFaint, margin: 0 }}>{ingestResult.message}</p>
                <button onClick={() => setActiveTab('pending')} style={{ marginTop: '10px', padding: '7px 14px', background: C.greenSoft, border: `1px solid ${C.green}44`, borderRadius: '2px', fontSize: '12px', color: C.green, cursor: 'pointer' }}>
                  Review Extracted Entries →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Extract tab */}
        {activeTab === 'extract' && (
          <div style={{ maxWidth: '760px' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '16px', fontWeight: '600', marginBottom: '6px' }}>Extract from a Build Conversation</div>
            <p style={{ fontSize: '13px', color: C.textFaint, lineHeight: '1.6', marginBottom: '20px' }}>
              At the end of a build session, paste the conversation here. Claude pulls out every decision made and queues them for review. Nothing activates until you approve it.
            </p>

            <FieldLabel>Conversation — paste the full chat here</FieldLabel>
            <textarea value={chatText} onChange={e => setChatText(e.target.value)} placeholder="Paste the conversation here…" style={{ ...iS, height: '280px', resize: 'vertical', lineHeight: '1.7', marginBottom: '14px' }} />

            <button onClick={handleExtract} disabled={!chatText.trim() || extracting} style={{ padding: '12px 24px', background: chatText.trim() && !extracting ? C.gold : C.surfaceAlt, border: 'none', borderRadius: '2px', color: chatText.trim() && !extracting ? '#ffffff' : C.textFaint, fontSize: '14px', fontWeight: '700', cursor: chatText.trim() && !extracting ? 'pointer' : 'default', fontFamily: 'Georgia, serif' }}>
              {extracting ? 'Extracting…' : 'Extract Decisions →'}
            </button>

            {extractResult && (
              <div style={{ marginTop: '16px', padding: '16px', background: C.greenSoft, border: `1px solid ${C.green}44`, borderRadius: '2px' }}>
                <div style={{ fontSize: '14px', color: C.green, fontWeight: '600', marginBottom: '4px' }}>✓ {extractResult.entries_extracted} decisions extracted</div>
                <p style={{ fontSize: '12px', color: C.textDim, margin: 0 }}>{extractResult.summary}</p>
                <button onClick={() => setActiveTab('pending')} style={{ marginTop: '10px', padding: '7px 14px', background: C.greenSoft, border: `1px solid ${C.green}44`, borderRadius: '2px', fontSize: '12px', color: C.green, cursor: 'pointer' }}>
                  Review Extracted Decisions →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Guard tab */}
        {activeTab === 'guard' && (
          <div style={{ maxWidth: '760px' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '16px', fontWeight: '600', marginBottom: '6px' }}>Franchise Guard</div>
            <p style={{ fontSize: '13px', color: C.textFaint, lineHeight: '1.6', marginBottom: '20px' }}>
              Paste any scene brief before you generate. The Guard checks it against every active knowledge entry and tells you what might break — before a single word gets written.
            </p>

            <FieldLabel>Scene Brief</FieldLabel>
            <textarea value={guardBrief} onChange={e => setGuardBrief(e.target.value)} placeholder="Paste your scene brief here…" style={{ ...iS, height: '140px', resize: 'vertical', lineHeight: '1.7', marginBottom: '12px' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <FieldLabel>Characters (comma-separated)</FieldLabel>
                <input value={guardChars} onChange={e => setGuardChars(e.target.value)} placeholder="JustAWoman, David" style={iS} />
              </div>
              <div>
                <FieldLabel>Scene Type</FieldLabel>
                <input value={guardType} onChange={e => setGuardType(e.target.value)} placeholder="interior_reckoning, david_mirror…" style={iS} />
              </div>
            </div>

            <button onClick={handleGuard} disabled={!guardBrief.trim() || guardRunning} style={{ padding: '12px 24px', background: guardBrief.trim() && !guardRunning ? C.gold : C.surfaceAlt, border: 'none', borderRadius: '2px', color: guardBrief.trim() && !guardRunning ? '#ffffff' : C.textFaint, fontSize: '14px', fontWeight: '700', cursor: guardBrief.trim() && !guardRunning ? 'pointer' : 'default', fontFamily: 'Georgia, serif' }}>
              {guardRunning ? 'Checking…' : 'Run Franchise Guard →'}
            </button>

            {guardResult && (
              <div style={{ marginTop: '20px' }}>
                <div style={{
                  padding: '14px 18px', marginBottom: '16px',
                  background: guardResult.clear_to_generate ? C.greenSoft : C.redSoft,
                  border: `1px solid ${guardResult.clear_to_generate ? C.green : C.red}44`,
                  borderRadius: '2px',
                  display: 'flex', alignItems: 'center', gap: '12px',
                }}>
                  <div style={{ fontSize: '20px' }}>{guardResult.clear_to_generate ? '✓' : '⚠'}</div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: guardResult.clear_to_generate ? C.green : C.red }}>
                      {guardResult.clear_to_generate ? 'Clear to generate' : 'Violations detected — do not generate yet'}
                    </div>
                    <div style={{ fontSize: '12px', color: C.textDim, marginTop: '2px' }}>{guardResult.guard_note}</div>
                  </div>
                </div>

                {guardResult.violations?.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', color: C.red, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px', fontWeight: '600' }}>Violations</div>
                    {guardResult.violations.map((v, i) => (
                      <div key={i} style={{ background: C.surface, border: `1px solid ${C.red}44`, borderLeft: `3px solid ${C.red}`, borderRadius: '2px', padding: '14px', marginBottom: '8px' }}>
                        <div style={{ fontSize: '12px', color: C.red, fontWeight: '600', marginBottom: '6px' }}>{v.knowledge_entry_title}</div>
                        <div style={{ fontSize: '12px', color: C.textDim, marginBottom: '4px' }}><span style={{ color: C.textFaint }}>In brief:</span> {v.what_in_brief}</div>
                        <div style={{ fontSize: '12px', color: C.textDim, marginBottom: '8px' }}><span style={{ color: C.textFaint }}>Why it matters:</span> {v.why_it_matters}</div>
                        <div style={{ background: C.greenSoft, border: `1px solid ${C.green}33`, borderRadius: '2px', padding: '10px 12px', fontSize: '12px', color: C.green }}>
                          <span style={{ fontWeight: '600' }}>Suggested fix:</span> {v.suggested_correction}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {guardResult.warnings?.length > 0 && (
                  <div>
                    <div style={{ fontSize: '11px', color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px', fontWeight: '600' }}>Flags to Keep in Mind</div>
                    {guardResult.warnings.map((w, i) => (
                      <div key={i} style={{ background: C.surface, border: `1px solid ${C.gold}33`, borderLeft: `3px solid ${C.gold}`, borderRadius: '2px', padding: '12px', marginBottom: '6px' }}>
                        <div style={{ fontSize: '11px', color: C.gold, marginBottom: '4px' }}>{w.knowledge_entry_title}</div>
                        <div style={{ fontSize: '12px', color: C.textDim }}>{w.note}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: '12px', fontSize: '11px', color: C.textFaint }}>
                  {guardResult.entries_checked} knowledge entries checked
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────
function FieldLabel({ children }) {
  return <div style={{ fontSize: '10px', color: '#6b6560', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: '600', marginBottom: '6px' }}>{children}</div>;
}

function Spin() {
  return (
    <>
      <div style={{ width: '18px', height: '18px', border: `2px solid ${C.border}`, borderTop: `2px solid ${C.gold}`, borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}

function sBtn(color, outline = false) {
  return { padding: '6px 14px', background: outline ? 'transparent' : `${color}16`, border: `1px solid ${color}44`, borderRadius: '2px', color, fontSize: '11px', letterSpacing: '0.05em', cursor: 'pointer', fontWeight: '600' };
}

const iS = {
  width: '100%', background: '#faf8f4', border: '1px solid #e2ddd4',
  borderRadius: '2px', padding: '9px 12px', fontSize: '13px',
  color: '#1c1814', fontFamily: 'system-ui', outline: 'none',
  boxSizing: 'border-box',
};
