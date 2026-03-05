/**
 * WorldStudio.jsx  v3 — CSS classes edition
 *
 * Two tabs only:
 *   Characters — world character profiles (generate, activate, edit)
 *               + desire profile + relationship graph + family franchise layer
 *   Registry   — PNOS characters, read-only, with Voice Interview link
 *
 * Scenes tab REMOVED — scene generation moves to Narrative Intelligence
 * Triggers tab REMOVED — tension surfaces inside Story Engine NI
 *
 * Styling via WorldStudio.css — no inline style objects.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useRegistries from '../hooks/useRegistries';
import './WorldStudio.css';

const API = '/api/v1';

/* ── Constants ──────────────────────────────────────────────────────── */
const TYPES = {
  love_interest:   'Love Interest',
  industry_peer:   'Industry Peer',
  mentor:          'Mentor',
  antagonist:      'Antagonist',
  rival:           'Rival',
  collaborator:    'Collaborator',
  one_night_stand: 'One Night Stand',
  recurring:       'Recurring',
};

const TYPE_BADGE_CLASS = {
  love_interest:   'ws-badge-love_interest',
  industry_peer:   'ws-badge-industry_peer',
  mentor:          'ws-badge-mentor',
  antagonist:      'ws-badge-antagonist',
  rival:           'ws-badge-rival',
  collaborator:    'ws-badge-collaborator',
  one_night_stand: 'ws-badge-one_night_stand',
  recurring:       'ws-badge-recurring',
};

const ROLE_LABELS = {
  protagonist: 'Protagonist',
  pressure:    'Antagonist',
  mirror:      'Mirror',
  support:     'Supporting',
  shadow:      'Shadow',
  special:     'Special',
};

const ROLE_ICONS = {
  protagonist: '♛',
  pressure:    '⊗',
  mirror:      '◎',
  support:     '◉',
  shadow:      '◆',
  special:     '✦',
};

const ROLE_BADGE_CLASS = {
  protagonist: 'ws-badge-protagonist',
  pressure:    'ws-badge-pressure',
  mirror:      'ws-badge-mirror',
  support:     'ws-badge-support',
  shadow:      'ws-badge-shadow',
  special:     'ws-badge-special',
};

/* ── Small helpers ──────────────────────────────────────────────────── */
function Badge({ cls = '', children }) {
  return <span className={`ws-badge ${cls}`}>{children}</span>;
}

function TypeBadge({ type }) {
  return (
    <Badge cls={TYPE_BADGE_CLASS[type] || ''}>
      {TYPES[type] || type}
    </Badge>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════ */

export default function WorldStudio() {
  const navigate = useNavigate();

  /* ── Tab ─────────────────────────────────────────────────────────── */
  const [tab, setTab] = useState('characters');

  /* ── Characters ───────────────────────────────────────────────────── */
  const [characters,     setCharacters]     = useState([]);
  const [selectedChar,   setSelectedChar]   = useState(null);
  const [charDetail,     setCharDetail]     = useState(null);
  const [charFilter,     setCharFilter]     = useState('all');
  const [charSearch,     setCharSearch]     = useState('');
  const [editMode,       setEditMode]       = useState(false);
  const [editForm,       setEditForm]       = useState({});
  const [saving,         setSaving]         = useState(false);
  const [generating,     setGenerating]     = useState(false);
  const [confirming,     setConfirming]     = useState(false);
  const [previewChars,   setPreviewChars]   = useState([]);
  const [previewSel,     setPreviewSel]     = useState(new Set());
  const [previewNotes,   setPreviewNotes]   = useState('');
  const [showPreview,    setShowPreview]    = useState(false);
  const [bulkActivating, setBulkActivating] = useState(false);

  /* ── Relationship graph ─────────────────────────────────────────── */
  const [showAddRel, setShowAddRel] = useState(false);
  const [relForm,    setRelForm]    = useState({
    related_character_id: '', related_character_name: '',
    related_character_source: 'world_characters',
    relationship_type: 'friendship', family_role: '',
    history_summary: '', current_status: 'active',
    tension_state: 'Stable', romantic_eligible: false,
    knows_about_transfer: false, series_layer: 'lalaverse', notes: '',
  });
  const [savingRel, setSavingRel] = useState(false);

  /* ── Registry ────────────────────────────────────────────────────── */
  const { registries, loading: regLoading } = useRegistries();
  const [activeRegId,     setActiveRegId]     = useState(null);
  const [regChars,        setRegChars]        = useState([]);
  const [regSearch,       setRegSearch]       = useState('');
  const [regRoleFilter,   setRegRoleFilter]   = useState('all');
  const [selectedRegChar, setSelectedRegChar] = useState(null);

  /* ── UI ──────────────────────────────────────────────────────────── */
  const [toast,   setToast]   = useState(null);
  const [seeding, setSeeding] = useState(false);

  const flash = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  /* ── Loaders ─────────────────────────────────────────────────────── */
  const loadCharacters = useCallback(async () => {
    try {
      const r = await fetch(`${API}/world/characters`);
      const d = await r.json();
      setCharacters(d.characters || []);
    } catch (e) { console.error(e); }
  }, []);

  const loadCharDetail = useCallback(async (id) => {
    try {
      const r = await fetch(`${API}/world/characters/${id}`);
      const d = await r.json();
      setCharDetail(d.character || null);
      setEditMode(false);
    } catch (e) { console.error(e); }
  }, []);

  const loadRegChars = useCallback(async (regId) => {
    try {
      const r = await fetch(`${API}/character-registry/registries/${regId}`);
      const d = await r.json();
      setRegChars(d.registry?.characters || d.characters || []);
    } catch (e) { setRegChars([]); }
  }, []);

  useEffect(() => { loadCharacters(); }, []);
  useEffect(() => { if (selectedChar) loadCharDetail(selectedChar); }, [selectedChar]);
  useEffect(() => {
    if (registries.length && !activeRegId) setActiveRegId(registries[0].id);
  }, [registries]);
  useEffect(() => { if (activeRegId) loadRegChars(activeRegId); }, [activeRegId]);

  /* ── Ecosystem generate / preview / confirm ───────────────────────── */
  const generatePreview = async () => {
    setGenerating(true);
    try {
      const r = await fetch(`${API}/world/generate-ecosystem-preview`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const d = await r.json();
      if (d.characters?.length) {
        setPreviewChars(d.characters);
        setPreviewNotes(d.generation_notes || '');
        setPreviewSel(new Set(d.characters.map((_, i) => i)));
        setShowPreview(true);
      } else flash(d.error || 'Generation failed', 'error');
    } catch (e) { flash(e.message, 'error'); }
    finally { setGenerating(false); }
  };

  const confirmPreview = async () => {
    const selected = previewChars.filter((_, i) => previewSel.has(i));
    if (!selected.length) { flash('Select at least one character', 'error'); return; }
    setConfirming(true);
    try {
      const r = await fetch(`${API}/world/generate-ecosystem-confirm`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characters: selected, generation_notes: previewNotes }),
      });
      const d = await r.json();
      if (d.characters) {
        flash(`${d.count} characters committed`);
        setShowPreview(false);
        loadCharacters();
      } else flash(d.error || 'Confirm failed', 'error');
    } catch (e) { flash(e.message, 'error'); }
    finally { setConfirming(false); }
  };

  /* ── Character actions ────────────────────────────────────────────── */
  const activateChar = async (id) => {
    await fetch(`${API}/world/characters/${id}/activate`, { method: 'POST' });
    flash('Character activated');
    loadCharacters();
    if (selectedChar === id) loadCharDetail(id);
  };

  const archiveChar = async (id) => {
    await fetch(`${API}/world/characters/${id}/archive`, { method: 'POST' });
    flash('Character archived');
    setSelectedChar(null); setCharDetail(null); loadCharacters();
  };

  const deleteChar = async (id) => {
    if (!window.confirm('Delete this character permanently?')) return;
    await fetch(`${API}/world/characters/${id}`, { method: 'DELETE' });
    flash('Character deleted');
    setSelectedChar(null); setCharDetail(null); loadCharacters();
  };

  const saveCharEdit = async () => {
    if (!selectedChar) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}/world/characters/${selectedChar}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const d = await r.json();
      if (d.character) {
        flash('Saved'); setEditMode(false);
        loadCharDetail(selectedChar); loadCharacters();
      } else flash(d.error || 'Save failed', 'error');
    } catch (e) { flash(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const bulkActivate = async () => {
    const drafts = characters.filter(c => c.status === 'draft');
    if (!drafts.length) { flash('No drafts to activate', 'error'); return; }
    setBulkActivating(true);
    for (const c of drafts) {
      await fetch(`${API}/world/characters/${c.id}/activate`, { method: 'POST' }).catch(() => {});
    }
    flash(`${drafts.length} characters activated`);
    loadCharacters();
    if (selectedChar) loadCharDetail(selectedChar);
    setBulkActivating(false);
  };

  const seedRelationships = async () => {
    setSeeding(true);
    try {
      const r = await fetch(`${API}/world/seed-relationships`, { method: 'POST' });
      const d = await r.json();
      flash(d.message || 'Done');
    } catch (e) { flash(e.message, 'error'); }
    finally { setSeeding(false); }
  };

  /* ── Relationship graph ───────────────────────────────────────────── */
  const addRelationship = async () => {
    if (!selectedChar) return;
    setSavingRel(true);
    try {
      const r = await fetch(`${API}/world/characters/${selectedChar}/relationships`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(relForm),
      });
      const d = await r.json();
      if (d.graph) {
        flash('Relationship added');
        setShowAddRel(false);
        loadCharDetail(selectedChar);
      } else flash(d.error || 'Add failed', 'error');
    } catch (e) { flash(e.message, 'error'); }
    finally { setSavingRel(false); }
  };

  const deleteRelationship = async (relId) => {
    await fetch(`${API}/world/characters/${selectedChar}/relationships/${relId}`, { method: 'DELETE' });
    flash('Relationship removed');
    loadCharDetail(selectedChar);
  };

  /* ── Derived ──────────────────────────────────────────────────────── */
  const filtered = characters.filter(c => {
    if (charFilter !== 'all' && c.character_type !== charFilter) return false;
    if (charSearch && !(c.name || '').toLowerCase().includes(charSearch.toLowerCase())) return false;
    return true;
  });
  const uniqueTypes = [...new Set(characters.map(c => c.character_type))];

  const filteredReg = regChars.filter(ch => {
    const name = (ch.selected_name || ch.display_name || '').toLowerCase();
    if (regSearch && !name.includes(regSearch.toLowerCase())) return false;
    if (regRoleFilter !== 'all' && ch.role_type !== regRoleFilter) return false;
    return true;
  });

  const relGraph = charDetail ? (
    typeof charDetail.relationship_graph === 'string'
      ? JSON.parse(charDetail.relationship_graph || '[]')
      : (charDetail.relationship_graph || [])
  ) : [];

  const draftCount = characters.filter(c => c.status === 'draft').length;

  /* ═══════════════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════════════ */
  return (
    <div className="ws-page">

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <header className="ws-header">
        <button className="ws-btn-back" onClick={() => navigate(-1)}>← Back</button>

        <div>
          <div className="ws-header-title">World Studio</div>
          <div className="ws-header-sub">Characters · Registry</div>
        </div>

        <div className="ws-tab-bar">
          {[
            { key: 'characters', label: 'Characters', count: characters.length },
            { key: 'registry',   label: 'Registry',   count: regChars.length },
          ].map(t => (
            <button
              key={t.key}
              className={`ws-tab ${tab === t.key ? 'ws-tab-active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              <span className="ws-tab-count">{t.count}</span>
            </button>
          ))}
        </div>

        <div className="ws-header-controls">
          {tab === 'characters' && (
            <>
              {draftCount > 0 && (
                <button className="ws-btn ws-btn-green" onClick={bulkActivate} disabled={bulkActivating}>
                  {bulkActivating ? '…' : `✓ Activate ${draftCount} Drafts`}
                </button>
              )}
              <button className="ws-btn ws-btn-ghost" onClick={seedRelationships} disabled={seeding}>
                {seeding ? '…' : '🔗 Seed Relationships'}
              </button>
              <button className="ws-btn ws-btn-gold" onClick={generatePreview} disabled={generating}>
                {generating ? '⏳ Generating…' : '✦ Generate Ecosystem'}
              </button>
            </>
          )}
          {tab === 'registry' && (
            <button className="ws-btn ws-btn-outline" onClick={() => navigate('/character-registry')}>
              Open Full Registry →
            </button>
          )}
        </div>
      </header>

      {/* ── STATS BAR ───────────────────────────────────────────────── */}
      <div className="ws-stats-bar">
        <div className="ws-stat">
          <span className="ws-stat-value">{characters.length}</span>
          <span className="ws-stat-label">Characters</span>
        </div>
        <div className="ws-stat">
          <span className="ws-stat-value ws-stat-value-green">
            {characters.filter(c => c.status === 'active').length}
          </span>
          <span className="ws-stat-label">Active</span>
        </div>
        <div className="ws-stat">
          <span className="ws-stat-value ws-stat-value-muted">
            {characters.filter(c => c.status === 'draft').length}
          </span>
          <span className="ws-stat-label">Draft</span>
        </div>
        <div className="ws-stat-divider" />
        <div className="ws-stat">
          <span className="ws-stat-value ws-stat-value-rose">
            {characters.filter(c => c.intimate_eligible).length}
          </span>
          <span className="ws-stat-label">Intimate</span>
        </div>
        <div className="ws-stat">
          <span className="ws-stat-value ws-stat-value-teal">{regChars.length}</span>
          <span className="ws-stat-label">PNOS Registry</span>
        </div>
      </div>

      {/* ── BODY ────────────────────────────────────────────────────── */}
      <div className="ws-body">

        {/* ═══ SIDEBAR ════════════════════════════════════════════════ */}
        <aside className="ws-sidebar">
          <div className="ws-sidebar-title">
            {tab === 'characters' ? 'Characters' : 'Registry'}
          </div>

          {/* Characters sidebar */}
          {tab === 'characters' && (
            <>
              <input
                className="ws-sidebar-search"
                placeholder="Search…"
                value={charSearch}
                onChange={e => setCharSearch(e.target.value)}
              />
              <div className="ws-filter-row">
                {['all', ...uniqueTypes].map(t => (
                  <button
                    key={t}
                    className={`ws-filter-pill ${charFilter === t ? 'ws-filter-pill-active' : ''}`}
                    onClick={() => setCharFilter(t)}
                  >
                    {t === 'all' ? 'All' : (TYPES[t] || t)}
                  </button>
                ))}
              </div>

              {filtered.length === 0 ? (
                <div className="ws-empty ws-empty-small">
                  <div className="ws-empty-icon">✦</div>
                  <div className="ws-empty-text">No characters yet</div>
                </div>
              ) : filtered.map(c => (
                <div
                  key={c.id}
                  className={`ws-char-card ${selectedChar === c.id ? 'ws-char-card-selected' : ''}`}
                  onClick={() => setSelectedChar(c.id)}
                >
                  <div className="ws-char-card-top">
                    <span className="ws-char-card-name">{c.name}</span>
                    {c.intimate_eligible && <span className="ws-char-card-intimate">♡</span>}
                    <span className={`ws-char-card-status ${c.status === 'active' ? 'ws-char-card-status-active' : 'ws-char-card-status-draft'}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="ws-char-card-occupation">{c.occupation}</div>
                  <div className="ws-char-card-badges">
                    <TypeBadge type={c.character_type} />
                  </div>
                  {c.signature && (
                    <div className="ws-char-card-signature">"{c.signature}"</div>
                  )}
                </div>
              ))}
            </>
          )}

          {/* Registry sidebar */}
          {tab === 'registry' && (
            <>
              <input
                className="ws-sidebar-search"
                placeholder="Search registry…"
                value={regSearch}
                onChange={e => setRegSearch(e.target.value)}
              />
              <div className="ws-filter-row">
                {['all', 'protagonist', 'pressure', 'mirror', 'support', 'shadow', 'special'].map(r => (
                  <button
                    key={r}
                    className={`ws-filter-pill ${regRoleFilter === r ? 'ws-filter-pill-active' : ''}`}
                    onClick={() => setRegRoleFilter(r)}
                  >
                    {r === 'all' ? 'All' : (ROLE_LABELS[r] || r)}
                  </button>
                ))}
              </div>

              {registries.length > 1 && (
                <select
                  className="ws-select"
                  value={activeRegId || ''}
                  onChange={e => setActiveRegId(e.target.value)}
                  style={{ width: '100%', marginBottom: 10 }}
                >
                  {registries.map(r => (
                    <option key={r.id} value={r.id}>{r.name || r.title || r.book_tag}</option>
                  ))}
                </select>
              )}

              {filteredReg.map(ch => (
                <div
                  key={ch.id}
                  className={`ws-char-card ${selectedRegChar?.id === ch.id ? 'ws-char-card-selected' : ''}`}
                  onClick={() => setSelectedRegChar(ch)}
                >
                  <div className="ws-char-card-top">
                    <span className="ws-char-card-intimate">{ROLE_ICONS[ch.role_type] || '✦'}</span>
                    <span className="ws-char-card-name">{ch.selected_name || ch.display_name}</span>
                    {ch.status === 'finalized' && ch.world_exists && (
                      <Badge cls="ws-badge-protagonist">Canon</Badge>
                    )}
                  </div>
                  <div className="ws-char-card-badges">
                    <Badge cls={ROLE_BADGE_CLASS[ch.role_type] || ''}>{ROLE_LABELS[ch.role_type] || ch.role_type}</Badge>
                    <Badge cls={ch.status === 'finalized' ? 'ws-badge-approved' : 'ws-badge-draft'}>{ch.status}</Badge>
                    {ch.appearance_mode && <Badge cls="">{ch.appearance_mode}</Badge>}
                  </div>
                </div>
              ))}
            </>
          )}
        </aside>

        {/* ═══ MAIN CANVAS ════════════════════════════════════════════ */}
        <main className="ws-main">

          {/* Characters: empty state */}
          {tab === 'characters' && characters.length === 0 && (
            <div className="ws-empty">
              <div className="ws-empty-icon">✦</div>
              <div className="ws-empty-title">Start your World Ecosystem</div>
              <div className="ws-empty-text">
                Generate a full cast of world characters. Preview them, select who stays, confirm.
              </div>
              <div className="ws-empty-actions">
                <button className="ws-btn ws-btn-gold ws-btn-lg" onClick={generatePreview} disabled={generating}>
                  {generating ? '⏳ Generating…' : '✨ Generate Ecosystem'}
                </button>
              </div>
            </div>
          )}

          {/* Characters: dashboard (no selection) */}
          {tab === 'characters' && characters.length > 0 && !charDetail && (
            <div className="ws-dashboard">
              <div className="ws-dashboard-title">Ecosystem Overview</div>
              <div className="ws-dash-section">
                <div className="ws-dash-section-label">Character Types</div>
                <div className="ws-dash-type-grid">
                  {uniqueTypes.map(t => {
                    const count = characters.filter(c => c.character_type === t).length;
                    const pct   = Math.round((count / characters.length) * 100);
                    return (
                      <div key={t} className="ws-dash-type-card" onClick={() => setCharFilter(t)}>
                        <TypeBadge type={t} />
                        <div className="ws-dash-type-name" style={{ marginTop: 8 }}>{count}</div>
                        <div className="ws-dash-type-count">characters</div>
                        <div className="ws-dash-type-bar" style={{ marginTop: 6 }}>
                          <div className="ws-dash-type-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Characters: detail view */}
          {tab === 'characters' && charDetail && (
            <div key={charDetail.id} className="ws-detail">

              {/* Toolbar */}
              <div className="ws-detail-toolbar">
                <div className="ws-detail-header-badges">
                  <TypeBadge type={charDetail.character_type} />
                  {charDetail.intimate_eligible && <Badge cls="ws-badge-intimate">♡ Intimate</Badge>}
                  <Badge cls={
                    charDetail.status === 'active'   ? 'ws-badge-active' :
                    charDetail.status === 'archived' ? 'ws-badge-archived' :
                    'ws-badge-draft'
                  }>
                    {charDetail.status}
                  </Badge>
                </div>
                <div className="ws-detail-actions">
                  {!editMode && (
                    <button className="ws-btn ws-btn-ghost ws-btn-sm"
                      onClick={() => { setEditForm({ ...charDetail }); setEditMode(true); }}>
                      ✎ Edit
                    </button>
                  )}
                  {editMode && (
                    <button className="ws-btn ws-btn-ghost ws-btn-sm" onClick={() => setEditMode(false)}>
                      ✕ Cancel
                    </button>
                  )}
                  {editMode && (
                    <button className="ws-btn ws-btn-gold ws-btn-sm" onClick={saveCharEdit} disabled={saving}>
                      {saving ? 'Saving…' : '✓ Save'}
                    </button>
                  )}
                  {!editMode && charDetail.status !== 'archived' && (
                    <button className="ws-btn ws-btn-ghost ws-btn-sm ws-btn-muted"
                      onClick={() => archiveChar(charDetail.id)}>
                      Archive
                    </button>
                  )}
                  {!editMode && (
                    <button className="ws-btn ws-btn-danger ws-btn-sm"
                      onClick={() => deleteChar(charDetail.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {!editMode ? (
                <>
                  <h2 className="ws-detail-name">{charDetail.name}</h2>
                  <div className="ws-detail-meta">
                    {[charDetail.age_range, charDetail.occupation, charDetail.world_location].filter(Boolean).join(' · ')}
                  </div>

                  {charDetail.aesthetic && (
                    <div className="ws-detail-section">
                      <div className="ws-section-label ws-section-label-gold">Aesthetic</div>
                      <div className="ws-detail-text">{charDetail.aesthetic}</div>
                    </div>
                  )}

                  {charDetail.signature && (
                    <blockquote className="ws-detail-blockquote">"{charDetail.signature}"</blockquote>
                  )}

                  {/* Surface / Real want */}
                  <div className="ws-detail-section">
                    <div className="ws-detail-grid">
                      <div className="ws-want-card">
                        <div className="ws-want-card-label ws-want-card-label-gold">Surface Want</div>
                        <div className="ws-want-card-text">{charDetail.surface_want}</div>
                      </div>
                      <div className="ws-want-card">
                        <div className="ws-want-card-label ws-want-card-label-rose">Real Want</div>
                        <div className="ws-want-card-text">{charDetail.real_want}</div>
                      </div>
                    </div>
                  </div>

                  {/* Desire Profile */}
                  {(charDetail.attracted_to || charDetail.how_they_love || charDetail.desire_they_wont_admit) && (
                    <div className="ws-detail-section">
                      <div className="ws-section-label ws-section-label-rose">Desire Profile</div>
                      {charDetail.attracted_to && (
                        <div className="ws-inspector-field">
                          <span className="ws-inspector-field-label ws-inspector-field-label-muted">Attracted To</span>
                          <div className="ws-inspector-card">{charDetail.attracted_to}</div>
                        </div>
                      )}
                      {charDetail.how_they_love && (
                        <div className="ws-inspector-field">
                          <span className="ws-inspector-field-label ws-inspector-field-label-muted">How They Love</span>
                          <div className="ws-inspector-card">{charDetail.how_they_love}</div>
                        </div>
                      )}
                      {charDetail.desire_they_wont_admit && (
                        <div className="ws-inspector-field">
                          <span className="ws-inspector-field-label ws-inspector-field-label-muted">What They Won't Admit</span>
                          <div className="ws-inspector-card ws-inspector-card-dim">
                            {charDetail.desire_they_wont_admit}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Relationship Graph */}
                  <div className="ws-detail-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div className="ws-section-label" style={{ margin: 0 }}>
                        Relationships ({relGraph.length})
                      </div>
                      <button className="ws-btn ws-btn-ghost ws-btn-sm" onClick={() => setShowAddRel(true)}>
                        + Add
                      </button>
                    </div>

                    {relGraph.length === 0 ? (
                      <div className="ws-inspector-card ws-rel-empty">
                        No relationships logged yet.
                      </div>
                    ) : relGraph.map((rel, i) => (
                      <div key={rel.rel_id || i} className="ws-inspector-card ws-rel-item">
                        <div className="ws-rel-item-top">
                          <span className="ws-rel-item-name">{rel.character_name || '—'}</span>
                          <div className="ws-rel-item-badges">
                            <Badge cls="">{rel.relationship_type?.replace(/_/g, ' ')}</Badge>
                            {rel.current_status && <Badge cls="ws-badge-draft">{rel.current_status}</Badge>}
                            {rel.rel_id && (
                              <button className="ws-rel-remove" onClick={() => deleteRelationship(rel.rel_id)}>✕</button>
                            )}
                          </div>
                        </div>
                        {rel.family_role && (
                          <div className="ws-rel-family-role">Family role: {rel.family_role}</div>
                        )}
                        {rel.history_summary && (
                          <div className="ws-rel-history">{rel.history_summary}</div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Family in Franchise */}
                  {charDetail.family_layer && (
                    <div className="ws-detail-section">
                      <div className="ws-section-label ws-section-label-gold">Family in Franchise</div>
                      <div className="ws-inspector-card">
                        <Badge cls="ws-badge-protagonist">{charDetail.family_layer.replace(/_/g, ' ')}</Badge>
                        {charDetail.family_layer !== 'lalaverse' && (
                          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ws-muted)' }}>
                            This character's family exists in the <strong>{charDetail.family_layer.replace(/_/g, ' ')}</strong> layer.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Deeper Profile */}
                  {(charDetail.origin_story || charDetail.public_persona || charDetail.private_reality) && (
                    <div className="ws-detail-section">
                      <div className="ws-section-label">Deeper Profile</div>
                      {charDetail.origin_story && (
                        <div className="ws-inspector-field">
                          <span className="ws-inspector-field-label ws-inspector-field-label-muted">Origin Story</span>
                          <div className="ws-inspector-card">{charDetail.origin_story}</div>
                        </div>
                      )}
                      {charDetail.public_persona && (
                        <div className="ws-inspector-field">
                          <span className="ws-inspector-field-label ws-inspector-field-label-muted">Public Persona</span>
                          <div className="ws-inspector-card">{charDetail.public_persona}</div>
                        </div>
                      )}
                      {charDetail.private_reality && (
                        <div className="ws-inspector-field">
                          <span className="ws-inspector-field-label ws-inspector-field-label-muted">Private Reality</span>
                          <div className="ws-inspector-card ws-inspector-card-dim">{charDetail.private_reality}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {charDetail.status === 'draft' && (
                    <button className="ws-btn ws-btn-green" onClick={() => activateChar(charDetail.id)}>
                      Activate Character
                    </button>
                  )}
                </>
              ) : (
                /* Edit Form */
                <div className="ws-edit-form">
                  {[
                    { key: 'name',                    label: 'Name' },
                    { key: 'age_range',               label: 'Age Range' },
                    { key: 'occupation',              label: 'Occupation' },
                    { key: 'world_location',          label: 'Location' },
                    { key: 'aesthetic',               label: 'Aesthetic',              long: true },
                    { key: 'surface_want',            label: 'Surface Want',           long: true },
                    { key: 'real_want',               label: 'Real Want',              long: true },
                    { key: 'what_they_want_from_lala',label: 'What They Want From Lala', long: true },
                    { key: 'how_they_meet',           label: 'How They Meet',          long: true },
                    { key: 'dynamic',                 label: 'Dynamic',               long: true },
                    { key: 'intimate_style',          label: 'Intimate Style',         long: true },
                    { key: 'attracted_to',            label: 'Attracted To',           long: true },
                    { key: 'how_they_love',           label: 'How They Love',          long: true },
                    { key: 'desire_they_wont_admit',  label: "What They Won't Admit",  long: true },
                    { key: 'origin_story',            label: 'Origin Story',           long: true },
                    { key: 'public_persona',          label: 'Public Persona',         long: true },
                    { key: 'private_reality',         label: 'Private Reality',        long: true },
                    { key: 'arc_role',                label: 'Arc Role',               long: true },
                  ].map(f => (
                    <div key={f.key} className="ws-edit-field">
                      <label className="ws-edit-label">{f.label}</label>
                      {f.long
                        ? <textarea className="ws-textarea ws-edit-textarea"
                            value={editForm[f.key] || ''}
                            onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} />
                        : <input className="ws-input"
                            value={editForm[f.key] || ''}
                            onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} />
                      }
                    </div>
                  ))}
                  <div className="ws-edit-field">
                    <label className="ws-edit-label">Family Layer</label>
                    <select className="ws-select"
                      value={editForm.family_layer || 'lalaverse'}
                      onChange={e => setEditForm(p => ({ ...p, family_layer: e.target.value }))}>
                      <option value="real_world">Real World</option>
                      <option value="lalaverse">LalaVerse</option>
                      <option value="series_2">Series 2</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Registry tab: read-only */}
          {tab === 'registry' && (
            <div>
              <div className="ws-registry-header">
                <div>
                  <div className="ws-dashboard-title">PNOS Character Registry</div>
                  <div style={{ fontSize: 12, color: 'var(--ws-muted)', marginTop: 4 }}>
                    Psychological forces — read-only in World Studio. Edit in the Character Registry.
                  </div>
                </div>
                <button className="ws-btn ws-btn-lavender" onClick={() => navigate('/character-interview')}>
                  🎤 Open Voice Interview
                </button>
              </div>

              {regLoading ? (
                <div className="ws-empty"><div className="ws-spinner ws-spinner-lg" /></div>
              ) : selectedRegChar ? (
                <div className="ws-detail">
                  <button className="ws-btn ws-btn-ghost ws-btn-sm" style={{ marginBottom: 16 }}
                    onClick={() => setSelectedRegChar(null)}>
                    ← Back to Registry
                  </button>
                  <div className="ws-detail-header-badges">
                    <span style={{ fontSize: 20 }}>{ROLE_ICONS[selectedRegChar.role_type] || '✦'}</span>
                    <Badge cls={ROLE_BADGE_CLASS[selectedRegChar.role_type] || ''}>{ROLE_LABELS[selectedRegChar.role_type]}</Badge>
                    <Badge cls={selectedRegChar.status === 'finalized' ? 'ws-badge-approved' : 'ws-badge-draft'}>
                      {selectedRegChar.status}
                    </Badge>
                    {selectedRegChar.world_exists && <Badge cls="ws-badge-protagonist">Canon</Badge>}
                  </div>
                  <h2 className="ws-detail-name">{selectedRegChar.selected_name || selectedRegChar.display_name}</h2>
                  <div className="ws-detail-meta">
                    {ROLE_LABELS[selectedRegChar.role_type]} · {selectedRegChar.appearance_mode}
                  </div>

                  {[
                    { label: 'Core Desire',      val: selectedRegChar.core_desire,       cls: 'ws-inspector-field-label-gold' },
                    { label: 'Core Fear',         val: selectedRegChar.core_fear,         cls: 'ws-inspector-field-label-rose' },
                    { label: 'Signature Trait',   val: selectedRegChar.signature_trait,   cls: 'ws-inspector-field-label-muted' },
                    { label: 'Subtitle',          val: selectedRegChar.subtitle,          cls: 'ws-inspector-field-label-muted' },
                    { label: 'Primary Wound',     val: selectedRegChar.primary_wound,     cls: 'ws-inspector-field-label-rose' },
                    { label: 'Defense Mechanism', val: selectedRegChar.defense_mechanism, cls: 'ws-inspector-field-label-muted' },
                  ].filter(f => f.val).map(f => (
                    <div key={f.label} className="ws-inspector-field">
                      <div className={`ws-inspector-field-label ${f.cls}`}>{f.label}</div>
                      <div className="ws-inspector-card">{f.val}</div>
                    </div>
                  ))}

                  <div className="ws-detail-actions" style={{ marginTop: 16 }}>
                    <button className="ws-btn ws-btn-outline"
                      onClick={() => navigate(`/character-registry?highlight=${selectedRegChar.id}`)}>
                      📋 Open Full Dossier
                    </button>
                    <button className="ws-btn ws-btn-lavender"
                      onClick={() => navigate(`/character-registry?highlight=${selectedRegChar.id}&action=interview`)}>
                      🎤 Voice Interview
                    </button>
                  </div>
                </div>
              ) : (
                <div className="ws-registry-grid">
                  {filteredReg.map(ch => (
                    <div
                      key={ch.id}
                      className="ws-registry-card"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedRegChar(ch)}
                    >
                      <div className="ws-registry-card-top">
                        <span className="ws-registry-card-icon">{ROLE_ICONS[ch.role_type] || '✦'}</span>
                        <span className="ws-registry-card-name">{ch.selected_name || ch.display_name}</span>
                        {ch.status === 'finalized' && ch.world_exists && (
                          <Badge cls="ws-badge-protagonist">Canon</Badge>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                        <Badge cls={ROLE_BADGE_CLASS[ch.role_type] || ''}>{ROLE_LABELS[ch.role_type] || ch.role_type}</Badge>
                        <Badge cls={ch.status === 'finalized' ? 'ws-badge-approved' : 'ws-badge-draft'}>{ch.status}</Badge>
                      </div>
                      {ch.core_desire && (
                        <div className="ws-registry-card-trait ws-registry-card-trait-desire">
                          <span className="ws-registry-card-trait-label">Desire: </span>{ch.core_desire}
                        </div>
                      )}
                      {ch.core_fear && (
                        <div className="ws-registry-card-trait ws-registry-card-trait-fear">
                          <span className="ws-registry-card-trait-label">Fear: </span>{ch.core_fear}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        {/* ═══ RIGHT INSPECTOR ════════════════════════════════════════ */}
        {tab === 'characters' && charDetail && (
          <aside className="ws-inspector">
            <div className="ws-inspector-title">World Profile</div>

            {charDetail.how_they_meet && (
              <div className="ws-inspector-section">
                <div className="ws-inspector-field-label ws-inspector-field-label-teal">How They Meet</div>
                <div className="ws-inspector-card">{charDetail.how_they_meet}</div>
              </div>
            )}

            {charDetail.dynamic && (
              <div className="ws-inspector-section">
                <div className="ws-inspector-field-label ws-inspector-field-label-lavender">Dynamic</div>
                <div className="ws-inspector-card">{charDetail.dynamic}</div>
              </div>
            )}

            {charDetail.what_they_want_from_lala && (
              <div className="ws-inspector-section">
                <div className="ws-inspector-field-label ws-inspector-field-label-teal">What They Want From Lala</div>
                <div className="ws-inspector-card">{charDetail.what_they_want_from_lala}</div>
              </div>
            )}

            {charDetail.intimate_eligible && (
              <div className="ws-inspector-section">
                <div className="ws-inspector-field-label ws-inspector-field-label-rose">Intimate Profile</div>
                {charDetail.intimate_style && (
                  <div className="ws-inspector-field">
                    <span className="ws-inspector-field-label ws-inspector-field-label-rose">Style</span>
                    <div className="ws-inspector-card">{charDetail.intimate_style}</div>
                  </div>
                )}
                {charDetail.intimate_dynamic && (
                  <div className="ws-inspector-field">
                    <span className="ws-inspector-field-label ws-inspector-field-label-rose">Dynamic</span>
                    <div className="ws-inspector-card">{charDetail.intimate_dynamic}</div>
                  </div>
                )}
                {charDetail.what_lala_feels && (
                  <div className="ws-inspector-field">
                    <span className="ws-inspector-field-label ws-inspector-field-label-rose">What Lala Feels</span>
                    <div className="ws-inspector-card">{charDetail.what_lala_feels}</div>
                  </div>
                )}
                <p style={{ marginTop: 10, fontSize: 11, color: 'var(--ws-muted)', fontStyle: 'italic', lineHeight: 1.5 }}>
                  Scene generation triggers inside Narrative Intelligence when tension reaches threshold.
                </p>
              </div>
            )}

            {charDetail.arc_role && (
              <div className="ws-inspector-section">
                <div className="ws-inspector-field-label ws-inspector-field-label-gold">Arc Role</div>
                <div className="ws-inspector-card">{charDetail.arc_role}</div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              <button className="ws-btn ws-btn-outline ws-btn-full" onClick={() => navigate('/relationships')}>
                🔗 View Relationships
              </button>
              {charDetail.registry_character_id && (
                <button className="ws-btn ws-btn-outline ws-btn-full"
                  onClick={() => navigate(`/character-registry?highlight=${charDetail.registry_character_id}`)}>
                  📋 Registry Entry
                </button>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ═══ PREVIEW MODAL ══════════════════════════════════════════════ */}
      {showPreview && (
        <div className="ws-modal-overlay" onClick={() => !confirming && setShowPreview(false)}>
          <div className="ws-modal ws-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="ws-modal-title">Preview Generated Characters</div>
            <div className="ws-modal-sub">
              {previewChars.length} characters generated. Deselect any you don't want, then confirm.
            </div>
            {previewNotes && <div className="ws-modal-notes">{previewNotes}</div>}
            <div className="ws-modal-grid">
              {previewChars.map((c, i) => (
                <div
                  key={i}
                  className={`ws-preview-card ${previewSel.has(i) ? 'ws-preview-card-selected' : ''}`}
                  onClick={() => setPreviewSel(prev => {
                    const next = new Set(prev);
                    next.has(i) ? next.delete(i) : next.add(i);
                    return next;
                  })}
                >
                  <div className="ws-preview-card-top">
                    <span className="ws-preview-card-name">{c.name}</span>
                    <div className={`ws-preview-card-check ${previewSel.has(i) ? 'ws-preview-card-check-active' : ''}`}>
                      {previewSel.has(i) && '✓'}
                    </div>
                  </div>
                  <div className="ws-preview-card-meta">{c.age_range} · {c.occupation}</div>
                  <div className="ws-preview-card-badges">
                    <TypeBadge type={c.character_type} />
                    {c.intimate_eligible && <Badge cls="ws-badge-intimate">♡ Intimate</Badge>}
                  </div>
                  {c.signature && <div className="ws-preview-card-signature">"{c.signature}"</div>}
                </div>
              ))}
            </div>
            <div className="ws-modal-footer">
              <span className="ws-modal-footer-info">{previewSel.size} of {previewChars.length} selected</span>
              <div className="ws-modal-footer-actions">
                <button className="ws-btn ws-btn-ghost" onClick={() => setShowPreview(false)}>Cancel</button>
                <button className="ws-btn ws-btn-gold" disabled={confirming || !previewSel.size} onClick={confirmPreview}>
                  {confirming ? 'Committing…' : `Confirm ${previewSel.size} Characters`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ADD RELATIONSHIP MODAL ═════════════════════════════════════ */}
      {showAddRel && (
        <div className="ws-modal-overlay" onClick={() => setShowAddRel(false)}>
          <div className="ws-modal" onClick={e => e.stopPropagation()}>
            <div className="ws-modal-title">Add Relationship</div>

            <div className="ws-form-grid">
              <div className="ws-form-row">
                <label className="ws-form-label">Character Name</label>
                <input className="ws-input" placeholder="Name or describe…"
                  value={relForm.related_character_name}
                  onChange={e => setRelForm(p => ({ ...p, related_character_name: e.target.value }))} />
              </div>
              <div className="ws-form-row">
                <label className="ws-form-label">Character (if in World Studio)</label>
                <select className="ws-select" style={{ width: '100%' }}
                  value={relForm.related_character_id}
                  onChange={e => {
                    const char = characters.find(c => c.id === e.target.value);
                    setRelForm(p => ({
                      ...p,
                      related_character_id: e.target.value,
                      related_character_name: char ? char.name : p.related_character_name,
                    }));
                  }}>
                  <option value="">— Select existing —</option>
                  {characters.filter(c => c.id !== selectedChar).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="ws-form-row">
              <label className="ws-form-label">Relationship Type</label>
              <div className="ws-filter-row">
                {['family', 'romantic_history', 'friendship', 'rivalry', 'professional', 'estranged'].map(t => (
                  <button
                    key={t}
                    className={`ws-filter-pill ${relForm.relationship_type === t ? 'ws-filter-pill-active' : ''}`}
                    onClick={() => setRelForm(p => ({ ...p, relationship_type: t }))}
                  >
                    {t.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            {relForm.relationship_type === 'family' && (
              <div className="ws-form-row">
                <label className="ws-form-label">Family Role</label>
                <input className="ws-input" placeholder="mother, sister, cousin, aunt…"
                  value={relForm.family_role}
                  onChange={e => setRelForm(p => ({ ...p, family_role: e.target.value }))} />
              </div>
            )}

            <div className="ws-form-row">
              <label className="ws-form-label">History Summary</label>
              <textarea className="ws-textarea" placeholder="What happened between them…"
                value={relForm.history_summary}
                onChange={e => setRelForm(p => ({ ...p, history_summary: e.target.value }))} />
            </div>

            <div className="ws-form-grid">
              <div className="ws-form-row">
                <label className="ws-form-label">Current Status</label>
                <select className="ws-select" style={{ width: '100%' }}
                  value={relForm.current_status}
                  onChange={e => setRelForm(p => ({ ...p, current_status: e.target.value }))}>
                  {['active', 'close', 'complicated', 'estranged', 'ended', 'unknown'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="ws-form-row">
                <label className="ws-form-label">Franchise Layer</label>
                <select className="ws-select" style={{ width: '100%' }}
                  value={relForm.series_layer}
                  onChange={e => setRelForm(p => ({ ...p, series_layer: e.target.value }))}>
                  <option value="lalaverse">LalaVerse</option>
                  <option value="real_world">Real World</option>
                  <option value="series_2">Series 2</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ws-muted)', cursor: 'pointer' }}>
                <input type="checkbox" checked={relForm.romantic_eligible}
                  onChange={e => setRelForm(p => ({ ...p, romantic_eligible: e.target.checked }))} />
                Romantic eligible
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ws-muted)', cursor: 'pointer' }}>
                <input type="checkbox" checked={relForm.knows_about_transfer}
                  onChange={e => setRelForm(p => ({ ...p, knows_about_transfer: e.target.checked }))} />
                Knows about transfer
              </label>
            </div>

            <div className="ws-modal-footer" style={{ marginTop: 20 }}>
              <div />
              <div className="ws-modal-footer-actions">
                <button className="ws-btn ws-btn-ghost" onClick={() => setShowAddRel(false)}>Cancel</button>
                <button className="ws-btn ws-btn-gold" disabled={savingRel || !relForm.relationship_type} onClick={addRelationship}>
                  {savingRel ? 'Saving…' : 'Add Relationship'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ──────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`ws-toast ${toast.type === 'error' ? 'ws-toast-error' : 'ws-toast-success'}`}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
        </div>
      )}
    </div>
  );
}