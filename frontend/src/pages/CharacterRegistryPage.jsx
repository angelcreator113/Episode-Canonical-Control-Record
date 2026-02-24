/**
 * Character Registry — Archival Design
 *
 * Serious. Literary. Elevated.
 *
 * Three views:
 *   1. Browse (Editorial Grid / Archive List)
 *   2. Full-Page Dossier (Left portrait + Right tabbed sections)
 *
 * "When someone opens the Character Registry, they should feel:
 *  This is serious."
 *
 * Location: frontend/src/pages/CharacterRegistryPage.jsx
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './CharacterRegistryPage.css';
import CharacterVoiceInterview from './CharacterVoiceInterview';

const API = '/api/v1/character-registry';
const AI_API = '/api/v1/character-ai';

/* ── Constants ─────────────────────────────────────────────────── */

const ROLE_LABELS = {
  protagonist: 'Protagonist',
  pressure:    'Antagonist',
  mirror:      'Mirror',
  support:     'Supporting',
  shadow:      'Shadow',
  special:     'Special',
};

const ROLE_OPTIONS = [
  { value: 'protagonist', label: 'Protagonist' },
  { value: 'pressure',    label: 'Antagonist' },
  { value: 'mirror',      label: 'Mirror' },
  { value: 'support',     label: 'Supporting' },
  { value: 'shadow',      label: 'Shadow' },
  { value: 'special',     label: 'Special' },
];

const CANON_TIERS = ['Core Canon', 'Licensed', 'Minor'];

const DOSSIER_TABS = [
  { key: 'overview',      label: 'Overview' },
  { key: 'psychology',    label: 'Psychology' },
  { key: 'aesthetic',     label: 'Aesthetic DNA' },
  { key: 'career',        label: 'Career' },
  { key: 'relationships', label: 'Relationships' },
  { key: 'story',         label: 'Story Presence' },
  { key: 'voice',         label: 'Voice' },
  { key: 'ai',            label: '✦ AI Writer' },
];

const ARCHETYPES = [
  'Strategist', 'Dreamer', 'Performer', 'Guardian', 'Rebel',
  'Visionary', 'Healer', 'Trickster', 'Sage', 'Creator',
];

const GLAM_ENERGIES = ['Minimal', 'Maximal', 'Editorial'];
const STORY_STATUSES = ['Active', 'Evolving', 'Archived'];

/* ── JSONB Helpers ──────────────────────────────────────────────── */

const jGet = (obj, key) => (obj && typeof obj === 'object' ? obj[key] || '' : '');

/* Check if a JSON object has any non-empty value */
const hasJsonData = (obj) => obj && typeof obj === 'object' && Object.values(obj).some(v => v && String(v).trim());

/* Empty state shown when a tab has no data */
function EmptyState({ label, onEdit }) {
  return (
    <div className="cr-dossier-empty">
      <div className="cr-dossier-empty-icon">📝</div>
      <p className="cr-dossier-empty-text">No {label} data yet.</p>
      <button className="cr-dossier-empty-btn" onClick={onEdit}>
        ✎ Add {label}
      </button>
    </div>
  );
}

/* ================================================================
   MAIN COMPONENT
   ================================================================ */
export default function CharacterRegistryPage() {

  const navigate = useNavigate();

  /* ── State ── */
  const [view, setView]             = useState('browse');      // 'browse' | 'dossier'
  const [viewMode, setViewMode]     = useState('grid');        // 'grid' | 'list'
  const [registries, setRegistries] = useState([]);
  const [activeRegistry, setActiveRegistry] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [toast, setToast]           = useState(null);

  // Browse state
  const [search, setSearch]       = useState('');
  const [filters, setFilters]     = useState({ canon: null, role: null, era: null, status: null });
  const [showFilters, setShowFilters] = useState(false);

  // Dossier state
  const [activeChar, setActiveChar]       = useState(null);
  const [dossierTab, setDossierTab]       = useState('overview');
  const [editSection, setEditSection]     = useState(null);
  const [form, setForm]                   = useState({});
  const [saving, setSaving]               = useState(false);

  // New character modal
  const [showNewChar, setShowNewChar]     = useState(false);
  const [newCharForm, setNewCharForm]     = useState({ display_name: '', role_type: 'support', icon: '' });

  // Interview
  const [interviewTarget, setInterviewTarget] = useState(null);
  const [bookId, setBookId] = useState(null);

  // AI Writer state
  const [aiMode, setAiMode]             = useState('scene');    // scene | monologue | profile | gaps | next
  const [aiPrompt, setAiPrompt]         = useState('');
  const [aiMood, setAiMood]             = useState('');
  const [aiOtherChars, setAiOtherChars] = useState('');
  const [aiLength, setAiLength]         = useState('medium');   // short | medium | long
  const [aiDirection, setAiDirection]    = useState('');
  const [aiResult, setAiResult]         = useState(null);
  const [aiLoading, setAiLoading]       = useState(false);
  const [aiError, setAiError]           = useState(null);
  const [aiContextUsed, setAiContextUsed] = useState(null);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type, key: Date.now() });
  }, []);

  /* ── Data Fetching ── */

  const fetchRegistries = useCallback(async () => {
    try {
      const res = await fetch(`${API}/registries`);
      const data = await res.json();
      if (data.success) {
        setRegistries(data.registries || []);
        // Auto-select first registry
        if (data.registries?.length && !activeRegistry) {
          const first = data.registries[0];
          fetchRegistry(first.id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch registries', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRegistry = useCallback(async (id) => {
    try {
      const res = await fetch(`${API}/registries/${id}`);
      const data = await res.json();
      if (data.success) {
        setActiveRegistry(data.registry);
        setRegistries(prev => prev.map(r => r.id === id ? data.registry : r));
      }
    } catch (e) {
      console.error('Failed to fetch registry', e);
    }
  }, []);

  useEffect(() => { fetchRegistries(); }, [fetchRegistries]);

  // Fetch book ID for interview context
  useEffect(() => {
    if (!activeRegistry?.book_tag) return;
    (async () => {
      try {
        const res = await fetch('/api/v1/storyteller/books');
        const data = await res.json();
        const books = data.books || data || [];
        const match = books.find(b =>
          b.title?.toLowerCase().includes('book 1') ||
          b.title?.toLowerCase().includes('before lala')
        );
        if (match) setBookId(match.id);
      } catch (e) { /* no book context */ }
    })();
  }, [activeRegistry?.book_tag]);

  /* ── Characters + Filtering ── */

  const characters = activeRegistry?.characters || [];
  const sorted = [...characters].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const eras = [...new Set(sorted.map(c => c.era_introduced).filter(Boolean))];

  const filtered = sorted.filter(c => {
    if (search) {
      const q = search.toLowerCase();
      const haystack = [c.display_name, c.subtitle, c.description, c.selected_name, c.character_archetype]
        .filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.canon === 'Core Canon' && c.canon_tier !== 'Core Canon') return false;
    if (filters.canon === 'Licensed' && c.canon_tier !== 'Licensed') return false;
    if (filters.role && c.role_type !== filters.role) return false;
    if (filters.era && c.era_introduced !== filters.era) return false;
    if (filters.status === 'archived' && c.status !== 'declined') return false;
    if (filters.status === 'active' && (c.status === 'declined')) return false;
    return true;
  });

  const hasActiveFilters = filters.canon || filters.role || filters.era || filters.status;

  const clearFilters = () => setFilters({ canon: null, role: null, era: null, status: null });

  const toggleFilter = (key, val) => {
    setFilters(prev => ({ ...prev, [key]: prev[key] === val ? null : val }));
  };

  /* ── Character Actions ── */

  const openDossier = (char) => {
    setActiveChar(char);
    setView('dossier');
    setDossierTab('overview');
    setEditSection(null);
  };

  const closeDossier = () => {
    setView('browse');
    setActiveChar(null);
    setEditSection(null);
  };

  const createCharacter = async () => {
    if (!activeRegistry || !newCharForm.display_name.trim()) return;
    try {
      const res = await fetch(`${API}/registries/${activeRegistry.id}/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: newCharForm.display_name.trim(),
          role_type: newCharForm.role_type,
          icon: newCharForm.icon || '◆',
          character_key: newCharForm.display_name.trim().toLowerCase().replace(/\s+/g, '-'),
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Character created');
        setShowNewChar(false);
        setNewCharForm({ display_name: '', role_type: 'support', icon: '' });
        await fetchRegistry(activeRegistry.id);
      } else {
        showToast(data.error || 'Failed to create character', 'error');
      }
    } catch (e) {
      showToast('Failed to create character', 'error');
    }
  };

  const seedBook1 = async () => {
    if (!activeRegistry) return;
    try {
      const res = await fetch(`${API}/registries/${activeRegistry.id}/seed-book1`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(`Seeded ${data.seeded} characters`);
        await fetchRegistry(activeRegistry.id);
      } else {
        showToast(data.error || 'Seed failed', 'error');
      }
    } catch (e) {
      showToast('Failed to seed characters', 'error');
    }
  };

  const createRegistry = async () => {
    try {
      const res = await fetch(`${API}/registries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Book 1 · Before Lala',
          book_tag: 'book-1',
          description: 'Character registry for Book 1 of the PNOS narrative.',
          core_rule: 'Every character either confirms her silence — or threatens to break it.',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Registry created');
        setActiveRegistry(data.registry);
        await fetchRegistries();
      }
    } catch (e) {
      showToast('Failed to create registry', 'error');
    }
  };

  /* ── Dossier Section Save ── */

  const setCharStatus = async (charId, status) => {
    try {
      const res = await fetch(`${API}/characters/${charId}/set-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Character ${status}`);
        await fetchRegistry(activeRegistry.id);
        // Update active char
        const refreshed = await fetch(`${API}/registries/${activeRegistry.id}`);
        const rData = await refreshed.json();
        if (rData.success) {
          const updated = (rData.registry?.characters || []).find(c => c.id === charId);
          if (updated) setActiveChar(updated);
        }
      }
    } catch (e) {
      showToast('Failed to update status', 'error');
    }
  };

  const startEdit = (tabKey) => {
    console.log('[EDIT] startEdit called with tabKey:', tabKey, 'activeChar:', activeChar?.display_name);
    const initial = buildFormForTab(tabKey, activeChar);
    setForm(initial);
    setEditSection(tabKey);
  };

  const cancelEdit = () => { setEditSection(null); setForm({}); };

  const F = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const saveSection = async () => {
    if (!editSection || !activeChar) return;
    setSaving(true);
    try {
      const payload = buildPayloadForTab(editSection, form);
      const res = await fetch(`${API}/characters/${activeChar.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Saved');
        setEditSection(null);
        setForm({});
        // Refresh
        const refreshed = await fetch(`${API}/registries/${activeRegistry.id}`);
        const rData = await refreshed.json();
        if (rData.success) {
          setActiveRegistry(rData.registry);
          const updated = (rData.registry?.characters || []).find(c => c.id === activeChar.id);
          if (updated) setActiveChar(updated);
        }
      } else {
        showToast(data.error || 'Save failed', 'error');
      }
    } catch (e) {
      showToast('Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ── AI Writer Actions ── */
  const aiGenerate = async () => {
    if (!activeChar) return;
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);
    setAiContextUsed(null);

    const endpoints = {
      scene:     'write-scene',
      monologue: 'character-monologue',
      profile:   'build-profile',
      gaps:      'suggest-gaps',
      next:      'what-happens-next',
    };

    const body = { character_id: activeChar.id };

    if (aiMode === 'scene') {
      body.situation = aiPrompt;
      body.mood = aiMood;
      body.other_characters = aiOtherChars;
      body.length = aiLength;
    } else if (aiMode === 'monologue') {
      body.moment = aiPrompt;
      body.prompt = aiMood; // reuse mood field as additional context
    } else if (aiMode === 'next') {
      body.direction = aiDirection || aiPrompt;
    }

    try {
      const res = await fetch(`${AI_API}/${endpoints[aiMode]}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setAiResult(data);
        setAiContextUsed(data.context_used || data.data_sources || null);
      } else {
        setAiError(data.error || 'Generation failed');
      }
    } catch (e) {
      setAiError('Failed to connect to AI service');
    } finally {
      setAiLoading(false);
    }
  };

  const aiClear = () => {
    setAiResult(null);
    setAiError(null);
    setAiPrompt('');
    setAiMood('');
    setAiOtherChars('');
    setAiDirection('');
  };

  /* ── Stats ── */
  const statusCounts = {
    total: sorted.length,
    draft: sorted.filter(c => c.status === 'draft').length,
    accepted: sorted.filter(c => c.status === 'accepted').length,
    finalized: sorted.filter(c => c.status === 'finalized').length,
  };


  /* ================================================================
     RENDER: LOADING
     ================================================================ */
  if (loading) {
    return (
      <div className="cr-page">
        <div className="cr-loading">Loading registry…</div>
      </div>
    );
  }


  /* ================================================================
     RENDER: NO REGISTRY
     ================================================================ */
  if (!activeRegistry) {
    return (
      <div className="cr-page">
        <HeaderBar
          search={search} onSearch={setSearch}
          viewMode={viewMode} onViewMode={setViewMode}
          showFilters={showFilters} onToggleFilters={() => setShowFilters(f => !f)}
          onNewChar={() => {}}
        />
        <div className="cr-content">
          <div className="cr-empty-state">
            <div className="cr-empty-icon">◈</div>
            <h2 className="cr-empty-title">No Registries</h2>
            <p className="cr-empty-desc">Create a character registry to begin defining your cast.</p>
            <button className="cr-empty-btn" onClick={createRegistry}>
              Create Registry
            </button>
          </div>
        </div>
        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }


  /* ================================================================
     RENDER: DOSSIER VIEW
     ================================================================ */
  if (view === 'dossier' && activeChar) {
    const c = activeChar;
    const isCore = c.canon_tier === 'Core Canon';

    return (
      <div className="cr-page">
        {/* Header (simplified for dossier) */}
        <div className="cr-header">
          <div className="cr-header-left">
            <div className="cr-header-brand">LaLaPlace</div>
            <div className="cr-header-breadcrumb">Universe → Registry → Dossier</div>
          </div>
          <div className="cr-header-center">
            <h1 className="cr-header-title">{c.selected_name || c.display_name}</h1>
          </div>
          <div className="cr-header-right">
            <button className="cr-header-btn" onClick={() => setInterviewTarget(c)}>
              Interview
            </button>
            <button className="cr-header-btn" onClick={() => navigate(`/therapy/${activeRegistry?.id || 'default'}`)}>
              ◈ Therapy
            </button>
          </div>
        </div>

        <div className="cr-dossier">
          {/* Back bar */}
          <div className="cr-dossier-back">
            <button className="cr-dossier-back-btn" onClick={closeDossier}>
              ← Back to Registry
            </button>
          </div>

          <div className="cr-dossier-layout">

            {/* ── LEFT PANEL (30%) ── */}
            <div className="cr-dossier-left">
              {/* Portrait */}
              <div className={`cr-dossier-portrait ${isCore ? 'canon-core' : ''}`}>
                {c.icon ? (
                  <span className="portrait-icon">{c.icon}</span>
                ) : (
                  <span className="portrait-initial">{(c.display_name || '?')[0]}</span>
                )}
              </div>

              {/* Identity */}
              <div>
                <h2 className="cr-dossier-name">{c.selected_name || c.display_name}</h2>
                {c.selected_name && c.display_name !== c.selected_name && (
                  <div className="cr-dossier-alias">née {c.display_name}</div>
                )}
              </div>

              {/* Meta fields */}
              <div className="cr-dossier-meta">
                <div className="cr-dossier-meta-row">
                  <span className="cr-dossier-meta-label">Role</span>
                  <span className="cr-dossier-meta-value">{c.role_label || ROLE_LABELS[c.role_type] || c.role_type}</span>
                </div>
                <div className="cr-dossier-meta-row">
                  <span className="cr-dossier-meta-label">Canon Tier</span>
                  <span className={`cr-dossier-meta-value ${isCore ? 'gold' : ''}`}>
                    {c.canon_tier || '—'}
                  </span>
                </div>
                {c.character_archetype && (
                  <div className="cr-dossier-meta-row">
                    <span className="cr-dossier-meta-label">Archetype</span>
                    <span className="cr-dossier-meta-value">{c.character_archetype}</span>
                  </div>
                )}
                {c.first_appearance && (
                  <div className="cr-dossier-meta-row">
                    <span className="cr-dossier-meta-label">First Appeared</span>
                    <span className="cr-dossier-meta-value">{c.first_appearance}</span>
                  </div>
                )}
                {c.era_introduced && (
                  <div className="cr-dossier-meta-row">
                    <span className="cr-dossier-meta-label">Era</span>
                    <span className="cr-dossier-meta-value">{c.era_introduced}</span>
                  </div>
                )}
              </div>

              {/* Status */}
              <div className={`cr-dossier-status ${c.status}`}>
                <span className="cr-dossier-status-dot" />
                {c.status?.toUpperCase()}
              </div>

              {/* Relationship Quick View */}
              {c.relationships_map && (
                <div>
                  <span className="cr-dossier-meta-label" style={{ marginBottom: 8, display: 'block' }}>
                    Relationships
                  </span>
                  <div className="cr-dossier-rel-quick">
                    {jGet(c.relationships_map, 'allies') && (
                      <span className="cr-dossier-rel-chip">
                        <span className="cr-dossier-rel-chip-icon">🤝</span>
                        {jGet(c.relationships_map, 'allies').split(',')[0]?.trim()}
                      </span>
                    )}
                    {jGet(c.relationships_map, 'rivals') && (
                      <span className="cr-dossier-rel-chip">
                        <span className="cr-dossier-rel-chip-icon">⚔</span>
                        {jGet(c.relationships_map, 'rivals').split(',')[0]?.trim()}
                      </span>
                    )}
                    {jGet(c.relationships_map, 'mentors') && (
                      <span className="cr-dossier-rel-chip">
                        <span className="cr-dossier-rel-chip-icon">🏛</span>
                        {jGet(c.relationships_map, 'mentors').split(',')[0]?.trim()}
                      </span>
                    )}
                    {jGet(c.relationships_map, 'love_interests') && (
                      <span className="cr-dossier-rel-chip">
                        <span className="cr-dossier-rel-chip-icon">♡</span>
                        {jGet(c.relationships_map, 'love_interests').split(',')[0]?.trim()}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="cr-dossier-actions">
                {c.status !== 'finalized' ? (
                  <>
                    {c.status !== 'accepted' && (
                      <button className="cr-dossier-action-btn accept" onClick={() => setCharStatus(c.id, 'accepted')}>
                        Accept
                      </button>
                    )}
                    {c.status === 'accepted' && (
                      <button className="cr-dossier-action-btn finalize" onClick={() => setCharStatus(c.id, 'finalized')}>
                        Finalize to Canon
                      </button>
                    )}
                    {c.status !== 'declined' && (
                      <button className="cr-dossier-action-btn decline" onClick={() => setCharStatus(c.id, 'declined')}>
                        Decline
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="cr-dossier-finalized-label">CANON LOCKED</div>
                    <button className="cr-dossier-action-btn revert" onClick={() => setCharStatus(c.id, 'draft')}>
                      Revert to Draft
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ── RIGHT PANEL (70%) ── */}
            <div className="cr-dossier-right">
              {/* Tabs + Edit toggle */}
              <div className="cr-dossier-tabs-row">
                <div className="cr-dossier-tabs">
                  {DOSSIER_TABS.map(t => (
                    <button
                      key={t.key}
                      className={`cr-dossier-tab ${dossierTab === t.key ? 'active' : ''}`}
                      onClick={() => { setDossierTab(t.key); setEditSection(null); }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {!editSection && (
                  <button
                    className="cr-tab-edit-btn"
                    onClick={() => startEdit(dossierTab)}
                  >
                    ✎ Edit Section
                  </button>
                )}
              </div>

              {/* Tab Content */}
              <div className="cr-dossier-tab-content">
                {renderDossierTab(c, dossierTab, editSection, form, saving, startEdit, cancelEdit, saveSection, F, { aiMode, setAiMode, aiPrompt, setAiPrompt, aiMood, setAiMood, aiOtherChars, setAiOtherChars, aiLength, setAiLength, aiDirection, setAiDirection, aiResult, aiLoading, aiError, aiContextUsed, aiGenerate, aiClear })}
              </div>
            </div>
          </div>
        </div>

        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

        <CharacterVoiceInterview
          character={interviewTarget}
          bookId={bookId}
          open={!!interviewTarget}
          onClose={() => setInterviewTarget(null)}
          registryId={activeRegistry?.id}
          characters={activeRegistry?.Characters || []}
          onComplete={() => {
            if (activeRegistry?.id) fetchRegistry(activeRegistry.id);
            setInterviewTarget(null);
            showToast('Profile saved from interview');
          }}
        />
      </div>
    );
  }


  /* ================================================================
     RENDER: BROWSE VIEW (Grid / List)
     ================================================================ */
  return (
    <div className="cr-page">

      {/* Header */}
      <HeaderBar
        search={search}
        onSearch={setSearch}
        viewMode={viewMode}
        onViewMode={setViewMode}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(f => !f)}
        onNewChar={() => activeRegistry ? setShowNewChar(true) : null}
      />

      {/* Filters */}
      {showFilters && (
        <div className="cr-filters">
          <span className="cr-filter-label">Filter</span>

          {/* Canon */}
          <button className={`cr-filter-pill ${filters.canon === 'Core Canon' ? 'active' : ''}`}
            onClick={() => toggleFilter('canon', 'Core Canon')}>Core Canon</button>
          <button className={`cr-filter-pill ${filters.canon === 'Licensed' ? 'active' : ''}`}
            onClick={() => toggleFilter('canon', 'Licensed')}>Licensed</button>

          <span className="cr-filter-sep" />

          {/* Status */}
          <button className={`cr-filter-pill ${filters.status === 'archived' ? 'active' : ''}`}
            onClick={() => toggleFilter('status', 'archived')}>Archived</button>

          <span className="cr-filter-sep" />

          {/* Era */}
          {eras.map(era => (
            <button key={era} className={`cr-filter-pill ${filters.era === era ? 'active' : ''}`}
              onClick={() => toggleFilter('era', era)}>{era}</button>
          ))}

          {eras.length > 0 && <span className="cr-filter-sep" />}

          {/* Role */}
          {Object.entries(ROLE_LABELS).map(([key, label]) => (
            <button key={key} className={`cr-filter-pill ${filters.role === key ? 'active' : ''}`}
              onClick={() => toggleFilter('role', key)}>{label}</button>
          ))}

          {hasActiveFilters && (
            <button className="cr-filter-clear" onClick={clearFilters}>Clear all</button>
          )}
        </div>
      )}

      {/* Content */}
      <div className="cr-content">

        {/* Registry selector if multiple */}
        {registries.length > 1 && (
          <div className="cr-registry-bar">
            <select
              className="cr-registry-select"
              value={activeRegistry?.id || ''}
              onChange={e => fetchRegistry(e.target.value)}
            >
              {registries.map(r => (
                <option key={r.id} value={r.id}>{r.title || 'Untitled'}</option>
              ))}
            </select>
            <span className="cr-registry-meta">
              {activeRegistry?.book_tag} · {activeRegistry?.core_rule}
            </span>
          </div>
        )}

        {/* Stats */}
        <div className="cr-stats-strip">
          <div className="cr-stat-item">
            <span className="cr-stat-count">{statusCounts.total}</span>
            <span className="cr-stat-label">Characters</span>
          </div>
          <div className="cr-stat-item">
            <span className="cr-stat-count">{statusCounts.finalized}</span>
            <span className="cr-stat-label">Canon</span>
          </div>
          <div className="cr-stat-item">
            <span className="cr-stat-count">{statusCounts.accepted}</span>
            <span className="cr-stat-label">Accepted</span>
          </div>
          <div className="cr-stat-item">
            <span className="cr-stat-count">{statusCounts.draft}</span>
            <span className="cr-stat-label">Draft</span>
          </div>
        </div>

        {/* Empty */}
        {sorted.length === 0 ? (
          <div className="cr-empty-state">
            <div className="cr-empty-icon">◈</div>
            <h2 className="cr-empty-title">No Characters</h2>
            <p className="cr-empty-desc">Seed the Book 1 cast or create characters manually.</p>
            <button className="cr-empty-btn" onClick={seedBook1}>Seed Book 1 Cast</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="cr-empty-state">
            <div className="cr-empty-icon">∅</div>
            <h2 className="cr-empty-title">No Matches</h2>
            <p className="cr-empty-desc">No characters match the current filters.</p>
            <button className="cr-empty-btn" onClick={() => { clearFilters(); setSearch(''); }}>
              Clear Filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* ── GRID VIEW ── */
          <div className="cr-grid">
            {filtered.map(c => (
              <CharacterCard key={c.id} c={c} onClick={() => openDossier(c)} />
            ))}
          </div>
        ) : (
          /* ── LIST VIEW ── */
          <div className="cr-list">
            <div className="cr-list-header">
              <span></span>
              <span>Name</span>
              <span>Role · Archetype</span>
              <span>First Appeared</span>
              <span>Era</span>
              <span>Status</span>
              <span></span>
            </div>
            {filtered.map(c => (
              <CharacterRow key={c.id} c={c} onClick={() => openDossier(c)} />
            ))}
          </div>
        )}
      </div>

      {/* New Character Modal */}
      {showNewChar && (
        <div className="cr-modal-overlay" onClick={() => setShowNewChar(false)}>
          <div className="cr-modal" onClick={e => e.stopPropagation()}>
            <h2 className="cr-modal-title">New Character</h2>
            <div className="cr-edit-field">
              <label className="cr-edit-label">Name</label>
              <input className="cr-edit-input" value={newCharForm.display_name}
                onChange={e => setNewCharForm(p => ({ ...p, display_name: e.target.value }))}
                placeholder="Character name" autoFocus />
            </div>
            <div className="cr-edit-field">
              <label className="cr-edit-label">Role</label>
              <select className="cr-edit-input cr-edit-select" value={newCharForm.role_type}
                onChange={e => setNewCharForm(p => ({ ...p, role_type: e.target.value }))}>
                {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="cr-edit-field">
              <label className="cr-edit-label">Icon (emoji)</label>
              <input className="cr-edit-input" value={newCharForm.icon}
                onChange={e => setNewCharForm(p => ({ ...p, icon: e.target.value }))}
                placeholder="◆" style={{ maxWidth: 80 }} />
            </div>
            <div className="cr-modal-actions">
              <button className="cr-edit-cancel-btn" onClick={() => setShowNewChar(false)}>Cancel</button>
              <button className="cr-edit-save-btn" onClick={createCharacter}
                disabled={!newCharForm.display_name.trim()}>Create</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <CharacterVoiceInterview
        character={interviewTarget}
        bookId={bookId}
        open={!!interviewTarget}
        onClose={() => setInterviewTarget(null)}
        registryId={activeRegistry?.id}
        characters={activeRegistry?.Characters || []}
        onComplete={() => {
          if (activeRegistry?.id) fetchRegistry(activeRegistry.id);
          setInterviewTarget(null);
          showToast('Profile saved from interview');
        }}
      />
    </div>
  );
}


/* ================================================================
   HEADER BAR
   ================================================================ */
function HeaderBar({ search, onSearch, viewMode, onViewMode, showFilters, onToggleFilters, onNewChar }) {
  return (
    <div className="cr-header">
      <div className="cr-header-left">
        <div className="cr-header-brand">LaLaPlace</div>
        <div className="cr-header-breadcrumb">World → Characters</div>
      </div>

      <div className="cr-header-center">
        <h1 className="cr-header-title">Characters</h1>
        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
          Your character development bible
        </div>
      </div>

      <div className="cr-header-right">
        <button className="cr-header-btn primary" onClick={onNewChar}>
          + New Character
        </button>

        <button className={`cr-header-btn ${showFilters ? 'active' : ''}`} onClick={onToggleFilters}>
          Filter
        </button>

        <div className="cr-search-wrap">
          <span className="cr-search-icon">⌕</span>
          <input
            className="cr-search-input"
            type="text"
            placeholder="Search characters…"
            value={search}
            onChange={e => onSearch(e.target.value)}
          />
        </div>

        <div className="cr-view-toggle">
          <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => onViewMode('grid')}
            title="Grid view">▦</button>
          <button className={viewMode === 'list' ? 'active' : ''} onClick={() => onViewMode('list')}
            title="List view">☰</button>
        </div>
      </div>
    </div>
  );
}


/* ================================================================
   CHARACTER CARD (Grid)
   ================================================================ */
function CharacterCard({ c, onClick }) {
  const isCore = c.canon_tier === 'Core Canon';
  const roleColor = `var(--role-${c.role_type || 'special'})`;

  return (
    <div className={`cr-card ${isCore ? 'canon-core' : ''}`} onClick={onClick}>
      {/* Portrait */}
      <div className="cr-card-portrait" style={{ background: `linear-gradient(135deg, var(--surface2) 0%, var(--surface3) 100%)` }}>
        <div className="cr-card-portrait-bg" style={{ background: roleColor }} />
        {c.icon ? (
          <span className="cr-card-icon">{c.icon}</span>
        ) : (
          <span className="cr-card-initial">{(c.display_name || '?')[0]}</span>
        )}

        {/* Hover overlay */}
        <div className="cr-card-hover">
          {c.core_desire && (
            <div className="cr-card-hover-desire">"{c.core_desire}"</div>
          )}
          {c.subtitle && (
            <div className="cr-card-hover-essence">{c.subtitle}</div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="cr-card-body">
        <h3 className="cr-card-name">{c.selected_name || c.display_name}</h3>
        <span className={`cr-card-role ${c.role_type}`}>
          {c.role_label || ROLE_LABELS[c.role_type] || c.role_type}
        </span>
        {c.character_archetype && (
          <div className="cr-card-archetype">{c.character_archetype}</div>
        )}
        <div className="cr-card-bottom">
          {c.era_introduced ? (
            <span className="cr-card-era">{c.era_introduced}</span>
          ) : <span />}
          <span className={`cr-card-status-badge ${c.status}`}>{c.status}</span>
        </div>
      </div>
    </div>
  );
}


/* ================================================================
   CHARACTER ROW (List)
   ================================================================ */
function CharacterRow({ c, onClick }) {
  const isCore = c.canon_tier === 'Core Canon';

  return (
    <div className={`cr-list-row ${isCore ? 'canon-core' : ''}`} onClick={onClick}>
      <span className="cr-list-icon">{c.icon || '◆'}</span>
      <div className="cr-list-name-cell">
        <span className="cr-list-name">{c.selected_name || c.display_name}</span>
        {c.subtitle && <span className="cr-list-subtitle">{c.subtitle}</span>}
      </div>
      <div>
        <span className={`cr-list-role`} style={{ color: `var(--role-${c.role_type || 'special'})` }}>
          {c.role_label || ROLE_LABELS[c.role_type] || c.role_type}
        </span>
        {c.character_archetype && (
          <div className="cr-list-archetype">{c.character_archetype}</div>
        )}
      </div>
      <span className="cr-list-era">{c.first_appearance || '—'}</span>
      <span className="cr-list-era">{c.era_introduced || '—'}</span>
      <span className={`cr-list-status ${c.status}`}>{c.status}</span>
      <button className="cr-list-open-btn" onClick={e => { e.stopPropagation(); onClick(); }}>
        Open Dossier
      </button>
    </div>
  );
}


/* ================================================================
   TOAST
   ================================================================ */
function Toast({ msg, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return <div className={`cr-toast ${type}`}>{msg}</div>;
}


/* ================================================================
   DOSSIER TAB CONTENT
   ================================================================ */
function renderDossierTab(c, tab, editSection, form, saving, startEdit, cancelEdit, saveSection, F, ai) {
  const editing = editSection === tab;

  const editControls = editing ? (
    <div className="cr-edit-controls">
      <button className="cr-edit-cancel-btn" onClick={cancelEdit}>Cancel</button>
      <button className="cr-edit-save-btn" onClick={saveSection} disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  ) : null;

  const sectionHeader = (title) => (
    <div className="cr-dossier-section-header">
      <span className="cr-dossier-section-title">{title}</span>
      {!editing && (
        <button className="cr-dossier-edit-btn" onClick={() => startEdit(tab)}>✎ Edit</button>
      )}
    </div>
  );

  switch (tab) {

    /* ── OVERVIEW ── */
    case 'overview':
      return (
        <div className="cr-dossier-section">
          {sectionHeader('Overview')}
          {editControls}
          {editing ? (
            <>
              <EField label="Display Name" value={form.display_name} onChange={v => F('display_name', v)} />
              <EField label="Alias / Selected Name" value={form.selected_name} onChange={v => F('selected_name', v)} />
              <EArea label="Description" value={form.description} onChange={v => F('description', v)} rows={4} />
              <EField label="First Appearance" value={form.first_appearance} onChange={v => F('first_appearance', v)} placeholder="Book 1 · Episode 3" />
              <EField label="Era Introduced" value={form.era_introduced} onChange={v => F('era_introduced', v)} />
              <ESelect label="Canon Tier" value={form.canon_tier} onChange={v => F('canon_tier', v)}
                options={CANON_TIERS.map(t => ({ value: t, label: t }))} allowEmpty />
              <EField label="Creator" value={form.creator} onChange={v => F('creator', v)} />
            </>
          ) : (
            <>
              {(c.description || c.subtitle) && (
                <p style={{ fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.6, color: 'var(--ink)', marginBottom: 20, fontStyle: 'italic', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                  {c.description || c.subtitle}
                </p>
              )}
              <DRow label="First Appearance" value={c.first_appearance} />
              <DRow label="Era Introduced" value={c.era_introduced} />
              <DRow label="Canon Tier" value={c.canon_tier} accent={c.canon_tier === 'Core Canon'} />
              <DRow label="Creator" value={c.creator} />
              {jGet(c.story_presence, 'current_story_status') && (
                <DRow label="Current Arc" value={jGet(c.story_presence, 'current_story_status')} accent />
              )}
              {jGet(c.story_presence, 'unresolved_threads') && (
                <DRow label="Unresolved Threads" value={jGet(c.story_presence, 'unresolved_threads')} />
              )}
            </>
          )}
        </div>
      );

    /* ── PSYCHOLOGY ── */
    case 'psychology':
      return (
        <div className="cr-dossier-section">
          {sectionHeader('Psychology')}
          {editControls}
          {editing ? (
            <>
              <EArea label="Core Desire" value={form.core_desire} onChange={v => F('core_desire', v)} rows={2} />
              <EArea label="Core Fear" value={form.core_fear} onChange={v => F('core_fear', v)} rows={2} />
              <EArea label="Core Wound" value={form.core_wound} onChange={v => F('core_wound', v)} rows={2} />
              <EArea label="Mask — Public Persona" value={form.mask_persona} onChange={v => F('mask_persona', v)} rows={2} />
              <EArea label="Truth — Private Self" value={form.truth_persona} onChange={v => F('truth_persona', v)} rows={2} />
              <ESelect label="Archetype" value={form.character_archetype} onChange={v => F('character_archetype', v)}
                options={ARCHETYPES.map(a => ({ value: a, label: a }))} allowEmpty />
              <EArea label="Signature Trait" value={form.signature_trait} onChange={v => F('signature_trait', v)} rows={2} />
              <EField label="Emotional Baseline" value={form.emotional_baseline} onChange={v => F('emotional_baseline', v)} />
            </>
          ) : (
            <>
              {/* Triad */}
              {(c.core_desire || c.core_fear || c.core_wound) && (
                <div className="cr-dossier-triad">
                  {c.core_desire && (
                    <div className="cr-dossier-triad-item desire">
                      <span className="cr-dossier-triad-label">Desire</span>
                      <p className="cr-dossier-triad-text">{c.core_desire}</p>
                    </div>
                  )}
                  {c.core_fear && (
                    <div className="cr-dossier-triad-item fear">
                      <span className="cr-dossier-triad-label">Fear</span>
                      <p className="cr-dossier-triad-text">{c.core_fear}</p>
                    </div>
                  )}
                  {c.core_wound && (
                    <div className="cr-dossier-triad-item wound">
                      <span className="cr-dossier-triad-label">Wound</span>
                      <p className="cr-dossier-triad-text">{c.core_wound}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Duality: Mask vs Truth */}
              {(c.mask_persona || c.truth_persona) && (
                <div className="cr-dossier-duality">
                  {c.mask_persona && (
                    <div className="cr-dossier-duality-item">
                      <span className="cr-dossier-duality-label">Mask</span>
                      <p className="cr-dossier-duality-text">{c.mask_persona}</p>
                    </div>
                  )}
                  {c.truth_persona && (
                    <div className="cr-dossier-duality-item">
                      <span className="cr-dossier-duality-label">Truth</span>
                      <p className="cr-dossier-duality-text">{c.truth_persona}</p>
                    </div>
                  )}
                </div>
              )}

              <DRow label="Archetype" value={c.character_archetype} accent />
              <DRow label="Signature Trait" value={c.signature_trait} />
              <DRow label="Emotional Baseline" value={c.emotional_baseline} />

              {c.personality && (
                <div className="cr-dossier-pills">
                  {c.personality.split(',').map((t, i) => (
                    <span key={i} className="cr-dossier-pill">{t.trim()}</span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      );

    /* ── AESTHETIC DNA ── */
    case 'aesthetic':
      return (
        <div className="cr-dossier-section">
          {sectionHeader('Aesthetic DNA')}
          {editControls}
          {editing ? (
            <>
              <EField label="Era Aesthetic" value={form.era_aesthetic} onChange={v => F('era_aesthetic', v)} />
              <EArea label="Color Palette" value={form.color_palette} onChange={v => F('color_palette', v)} rows={2}
                placeholder="Warm ivory, muted gold, deep burgundy…" />
              <EArea label="Signature Silhouette" value={form.signature_silhouette} onChange={v => F('signature_silhouette', v)} rows={2} />
              <EArea label="Signature Accessories" value={form.signature_accessories} onChange={v => F('signature_accessories', v)} rows={2} />
              <ESelect label="Glam Energy" value={form.glam_energy} onChange={v => F('glam_energy', v)}
                options={GLAM_ENERGIES.map(g => ({ value: g, label: g }))} allowEmpty />
              <EArea label="Visual Evolution Notes" value={form.visual_evolution_notes} onChange={v => F('visual_evolution_notes', v)} rows={3} />
            </>
          ) : hasJsonData(c.aesthetic_dna) ? (
            <>
              <DRow label="Era Aesthetic" value={jGet(c.aesthetic_dna, 'era_aesthetic')} accent />
              <DRow label="Color Palette" value={jGet(c.aesthetic_dna, 'color_palette')} />
              <DRow label="Signature Silhouette" value={jGet(c.aesthetic_dna, 'signature_silhouette')} />
              <DRow label="Signature Accessories" value={jGet(c.aesthetic_dna, 'signature_accessories')} />
              <DRow label="Glam Energy" value={jGet(c.aesthetic_dna, 'glam_energy')} accent />
              <DRow label="Visual Evolution" value={jGet(c.aesthetic_dna, 'visual_evolution_notes')} />
            </>
          ) : (
            <EmptyState label="Aesthetic DNA" onEdit={() => startEdit(tab)} />
          )}
        </div>
      );

    /* ── CAREER ── */
    case 'career':
      return (
        <div className="cr-dossier-section">
          {sectionHeader('Career & Status')}
          {editControls}
          {editing ? (
            <>
              <EField label="Profession" value={form.profession} onChange={v => F('profession', v)} />
              <EArea label="Career Goal / Ambition" value={form.career_goal} onChange={v => F('career_goal', v)} rows={2} />
              <EField label="Reputation Level" value={form.reputation_level} onChange={v => F('reputation_level', v)} />
              <EArea label="Brand Affiliations" value={form.brand_relationships} onChange={v => F('brand_relationships', v)} rows={2} />
              <EField label="Financial Status" value={form.financial_status} onChange={v => F('financial_status', v)} />
              <EField label="Public Recognition" value={form.public_recognition} onChange={v => F('public_recognition', v)} />
              <EArea label="Ongoing Arc" value={form.ongoing_arc} onChange={v => F('ongoing_arc', v)} rows={3} />
            </>
          ) : hasJsonData(c.career_status) ? (
            <>
              <DRow label="Profession" value={jGet(c.career_status, 'profession')} accent />
              <DRow label="Ambition" value={jGet(c.career_status, 'career_goal')} />
              <DRow label="Reputation" value={jGet(c.career_status, 'reputation_level')} />
              <DRow label="Brand Affiliations" value={jGet(c.career_status, 'brand_relationships')} />
              <DRow label="Public Perception" value={jGet(c.career_status, 'public_recognition')} />
              <DRow label="Financial Status" value={jGet(c.career_status, 'financial_status')} />
              <DRow label="Ongoing Arc" value={jGet(c.career_status, 'ongoing_arc')} />
            </>
          ) : (
            <EmptyState label="Career" onEdit={() => startEdit(tab)} />
          )}
        </div>
      );

    /* ── RELATIONSHIPS ── */
    case 'relationships':
      return (
        <div className="cr-dossier-section">
          {sectionHeader('Relationships')}
          {editControls}
          {editing ? (
            <>
              <EArea label="Allies" value={form.allies} onChange={v => F('allies', v)} rows={2} />
              <EArea label="Rivals" value={form.rivals} onChange={v => F('rivals', v)} rows={2} />
              <EArea label="Mentors" value={form.mentors} onChange={v => F('mentors', v)} rows={2} />
              <EArea label="Love Interests" value={form.love_interests} onChange={v => F('love_interests', v)} rows={2} />
              <EArea label="Business Partners" value={form.business_partners} onChange={v => F('business_partners', v)} rows={2} />
              <EArea label="Dynamic Notes" value={form.dynamic_notes} onChange={v => F('dynamic_notes', v)} rows={3}
                placeholder="Tension? Loyal? Competitive?" />
            </>
          ) : hasJsonData(c.relationships_map) ? (
            <div className="cr-dossier-rel-grid">
              <RelCard type="Allies" icon="🤝" value={jGet(c.relationships_map, 'allies')} />
              <RelCard type="Rivals" icon="⚔" value={jGet(c.relationships_map, 'rivals')} />
              <RelCard type="Mentors" icon="🏛" value={jGet(c.relationships_map, 'mentors')} />
              <RelCard type="Love Interests" icon="♡" value={jGet(c.relationships_map, 'love_interests')} />
              <RelCard type="Business" icon="💼" value={jGet(c.relationships_map, 'business_partners')} />
              {jGet(c.relationships_map, 'dynamic_notes') && (
                <div className="cr-dossier-rel-card" style={{ gridColumn: '1 / -1' }}>
                  <div className="cr-dossier-rel-type">Dynamic Notes</div>
                  <div className="cr-dossier-rel-names">{jGet(c.relationships_map, 'dynamic_notes')}</div>
                </div>
              )}
            </div>
          ) : (
            <EmptyState label="Relationships" onEdit={() => startEdit(tab)} />
          )}
        </div>
      );

    /* ── STORY PRESENCE ── */
    case 'story':
      return (
        <div className="cr-dossier-section">
          {sectionHeader('Story Presence')}
          {editControls}
          {editing ? (
            <>
              <EArea label="Appears in — Books" value={form.appears_in_books} onChange={v => F('appears_in_books', v)} rows={2} />
              <EArea label="Appears in — Shows" value={form.appears_in_shows} onChange={v => F('appears_in_shows', v)} rows={2} />
              <EArea label="Appears in — Series" value={form.appears_in_series} onChange={v => F('appears_in_series', v)} rows={2} />
              <ESelect label="Current Status" value={form.current_story_status} onChange={v => F('current_story_status', v)}
                options={STORY_STATUSES.map(s => ({ value: s, label: s }))} allowEmpty />
              <EArea label="Unresolved Threads" value={form.unresolved_threads} onChange={v => F('unresolved_threads', v)} rows={3} />
              <ESelect label="Future Potential" value={form.future_potential} onChange={v => F('future_potential', v)}
                options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} allowEmpty />
            </>
          ) : hasJsonData(c.story_presence) ? (
            <>
              <DRow label="Books" value={jGet(c.story_presence, 'appears_in_books')} />
              <DRow label="Shows" value={jGet(c.story_presence, 'appears_in_shows')} />
              <DRow label="Series" value={jGet(c.story_presence, 'appears_in_series')} />
              <DRow label="Current Status" value={jGet(c.story_presence, 'current_story_status')} accent />
              <DRow label="Unresolved Threads" value={jGet(c.story_presence, 'unresolved_threads')} />
              <DRow label="Future Potential" value={jGet(c.story_presence, 'future_potential')} accent />

              {/* Evolution tracking preview */}
              {(jGet(c.evolution_tracking, 'version_history') || jGet(c.evolution_tracking, 'era_changes')) && (
                <>
                  <div style={{ borderTop: '1px solid var(--border)', margin: '20px 0 16px', paddingTop: 16 }}>
                    <span className="cr-dossier-section-title">Evolution</span>
                  </div>
                  <DRow label="Version History" value={jGet(c.evolution_tracking, 'version_history')} />
                  <DRow label="Era Changes" value={jGet(c.evolution_tracking, 'era_changes')} />
                  <DRow label="Personality Shifts" value={jGet(c.evolution_tracking, 'personality_shifts')} />
                </>
              )}
            </>
          ) : (
            <EmptyState label="Story Presence" onEdit={() => startEdit(tab)} />
          )}
        </div>
      );

    /* ── VOICE ── */
    case 'voice':
      return (
        <div className="cr-dossier-section">
          {sectionHeader('Voice Profile')}
          {editControls}
          {editing ? (
            <>
              <EField label="Speech Pattern" value={form.speech_pattern} onChange={v => F('speech_pattern', v)}
                placeholder="Direct, playful, sarcastic, poetic" />
              <EField label="Vocabulary Tone" value={form.vocabulary_tone} onChange={v => F('vocabulary_tone', v)}
                placeholder="Luxury, street, soft, sharp" />
              <EArea label="Catchphrases" value={form.catchphrases} onChange={v => F('catchphrases', v)} rows={2} />
              <EArea label="Internal Monologue Style" value={form.internal_monologue_style} onChange={v => F('internal_monologue_style', v)} rows={3} />
              <EField label="Emotional Reactivity" value={form.emotional_reactivity} onChange={v => F('emotional_reactivity', v)}
                placeholder="Low / Moderate / High / Volatile" />
            </>
          ) : hasJsonData(c.voice_signature) ? (
            <>
              <DRow label="Speech Pattern" value={jGet(c.voice_signature, 'speech_pattern')} accent />
              <DRow label="Vocabulary Tone" value={jGet(c.voice_signature, 'vocabulary_tone')} />
              <DRow label="Catchphrases" value={jGet(c.voice_signature, 'catchphrases')} />
              <DRow label="Internal Monologue" value={jGet(c.voice_signature, 'internal_monologue_style')} />
              <DRow label="Dialogue Rhythm" value={jGet(c.voice_signature, 'emotional_reactivity')} accent />
            </>
          ) : (
            <EmptyState label="Voice Profile" onEdit={() => startEdit(tab)} />
          )}
        </div>
      );

    /* ── AI WRITER ── */
    case 'ai':
      return <AIWriterTab character={c} ai={ai} />;

    default:
      return null;
  }
}


/* ================================================================
   AI WRITER TAB
   ================================================================ */
function AIWriterTab({ character, ai }) {
  const {
    aiMode, setAiMode, aiPrompt, setAiPrompt, aiMood, setAiMood,
    aiOtherChars, setAiOtherChars, aiLength, setAiLength,
    aiDirection, setAiDirection, aiResult, aiLoading, aiError,
    aiContextUsed, aiGenerate, aiClear,
  } = ai;

  const charName = character.selected_name || character.display_name;

  const AI_MODES = [
    { key: 'scene',     label: 'Write a Scene',       icon: '✦', desc: 'Claude writes a scene featuring this character using everything it knows' },
    { key: 'monologue', label: 'Inner Monologue',      icon: '◈', desc: 'Hear what this character is really thinking — behind the mask' },
    { key: 'next',      label: 'What Happens Next',    icon: '→', desc: 'Claude predicts the next story beat based on psychology & plot' },
    { key: 'gaps',      label: 'Suggest Missing',      icon: '◇', desc: 'Find underdeveloped areas in this character\'s profile' },
    { key: 'profile',   label: 'Generate from Story',  icon: '⟐', desc: 'Build a profile by reading all memories, lines & relationships' },
  ];

  const renderInputs = () => {
    switch (aiMode) {
      case 'scene':
        return (
          <div className="ai-writer-inputs">
            <div className="ai-writer-field">
              <label>What\'s happening?</label>
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder={`e.g. ${charName} walks into a meeting she wasn't invited to...`}
                rows={3}
              />
            </div>
            <div className="ai-writer-field-row">
              <div className="ai-writer-field half">
                <label>Mood / Feeling</label>
                <input value={aiMood} onChange={e => setAiMood(e.target.value)}
                  placeholder="Tense, electric, quiet" />
              </div>
              <div className="ai-writer-field half">
                <label>Other Characters</label>
                <input value={aiOtherChars} onChange={e => setAiOtherChars(e.target.value)}
                  placeholder="Names of others present" />
              </div>
            </div>
            <div className="ai-writer-length-row">
              <span className="ai-writer-length-label">Length:</span>
              {['short', 'medium', 'long'].map(l => (
                <button key={l} className={`ai-writer-length-btn ${aiLength === l ? 'active' : ''}`}
                  onClick={() => setAiLength(l)}>{l}</button>
              ))}
            </div>
          </div>
        );

      case 'monologue':
        return (
          <div className="ai-writer-inputs">
            <div className="ai-writer-field">
              <label>The moment (optional)</label>
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder={`e.g. Right after she finds out the truth about Dillon...`}
                rows={3}
              />
            </div>
            <div className="ai-writer-field">
              <label>Additional context (optional)</label>
              <input value={aiMood} onChange={e => setAiMood(e.target.value)}
                placeholder="What else should Claude know?" />
            </div>
          </div>
        );

      case 'next':
        return (
          <div className="ai-writer-inputs">
            <div className="ai-writer-field">
              <label>Direction (optional — leave blank for Claude to decide)</label>
              <textarea
                value={aiDirection}
                onChange={e => setAiDirection(e.target.value)}
                placeholder="e.g. I want the story to move toward confrontation... or leave blank and let Claude read the momentum"
                rows={3}
              />
            </div>
          </div>
        );

      case 'gaps':
      case 'profile':
        return (
          <div className="ai-writer-inputs">
            <p className="ai-writer-auto-note">
              Claude will analyze all available data — memories, approved lines, relationships, 
              therapy sessions — to {aiMode === 'gaps' ? 'find what\'s underdeveloped' : 'build a comprehensive profile'}.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  const renderResult = () => {
    if (aiLoading) {
      return (
        <div className="ai-writer-loading">
          <div className="ai-writer-loading-icon">✦</div>
          <div className="ai-writer-loading-text">
            Claude is reading everything about {charName}...
          </div>
          <div className="ai-writer-loading-sub">
            Psychology · Relationships · Memories · Story Lines · Universe
          </div>
        </div>
      );
    }

    if (aiError) {
      return (
        <div className="ai-writer-error">
          <span>⚠ {aiError}</span>
          <button onClick={aiClear} className="ai-writer-retry-btn">Try Again</button>
        </div>
      );
    }

    if (!aiResult) return null;

    // Prose result (scene / monologue)
    if (aiResult.prose) {
      return (
        <div className="ai-writer-result">
          <div className="ai-writer-result-header">
            <span className="ai-writer-result-label">Generated for {aiResult.character_name}</span>
            <div className="ai-writer-result-actions">
              <button onClick={() => navigator.clipboard?.writeText(aiResult.prose)} className="ai-writer-copy-btn">Copy</button>
              <button onClick={aiClear} className="ai-writer-clear-btn">Clear</button>
            </div>
          </div>
          <div className="ai-writer-prose">{aiResult.prose}</div>
          {aiContextUsed && (
            <div className="ai-writer-context-badge">
              Context: {aiContextUsed.memories || 0} memories · {aiContextUsed.relationships || 0} relationships · {aiContextUsed.recent_lines || 0} lines
              {aiContextUsed.has_universe && ' · Universe'}
              {aiContextUsed.has_therapy && ' · Therapy'}
            </div>
          )}
        </div>
      );
    }

    // Beats result (what happens next)
    if (aiResult.beats) {
      const beats = aiResult.beats;
      return (
        <div className="ai-writer-result">
          <div className="ai-writer-result-header">
            <span className="ai-writer-result-label">Story Beats for {aiResult.character_name}</span>
            <button onClick={aiClear} className="ai-writer-clear-btn">Clear</button>
          </div>
          {beats.story_tension && (
            <div className="ai-writer-tension">
              <strong>Core Tension:</strong> {beats.story_tension}
            </div>
          )}
          <div className="ai-writer-beats">
            {(beats.beats || []).map((beat, i) => (
              <div key={i} className="ai-writer-beat">
                <div className="ai-writer-beat-num">{i + 1}</div>
                <div className="ai-writer-beat-body">
                  <div className="ai-writer-beat-title">{beat.title}</div>
                  <div className="ai-writer-beat-desc">{beat.description}</div>
                  <div className="ai-writer-beat-why"><em>Why:</em> {beat.why}</div>
                  {beat.prose_preview && (
                    <div className="ai-writer-beat-preview">"{beat.prose_preview}"</div>
                  )}
                  <div className="ai-writer-beat-meta">
                    {beat.tone && <span className="ai-writer-beat-tone">{beat.tone}</span>}
                    {beat.characters_involved?.length > 0 && (
                      <span className="ai-writer-beat-chars">with {beat.characters_involved.join(', ')}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Analysis result (gaps)
    if (aiResult.analysis) {
      const a = aiResult.analysis;
      return (
        <div className="ai-writer-result">
          <div className="ai-writer-result-header">
            <span className="ai-writer-result-label">Gap Analysis — {aiResult.character_name}</span>
            <button onClick={aiClear} className="ai-writer-clear-btn">Clear</button>
          </div>
          <div className="ai-writer-score-row">
            <div className="ai-writer-score">
              <div className="ai-writer-score-num">{a.overall_depth_score || '?'}</div>
              <div className="ai-writer-score-label">Depth Score</div>
            </div>
            <div className="ai-writer-score-details">
              {a.strongest_aspect && <div><strong>Strongest:</strong> {a.strongest_aspect}</div>}
              {a.weakest_aspect && <div><strong>Weakest:</strong> {a.weakest_aspect}</div>}
            </div>
          </div>
          {(a.gaps || []).map((gap, i) => (
            <div key={i} className={`ai-writer-gap ${gap.severity}`}>
              <div className="ai-writer-gap-header">
                <span className="ai-writer-gap-area">{gap.area}</span>
                <span className={`ai-writer-gap-severity ${gap.severity}`}>{gap.severity?.replace('_', ' ')}</span>
              </div>
              <div className="ai-writer-gap-title">{gap.title}</div>
              <div className="ai-writer-gap-detail">{gap.detail}</div>
              {gap.suggestion && <div className="ai-writer-gap-suggestion">💡 {gap.suggestion}</div>}
            </div>
          ))}
          {a.scene_prompts?.length > 0 && (
            <div className="ai-writer-scene-prompts">
              <div className="ai-writer-scene-prompts-title">Scene Ideas to Explore</div>
              {a.scene_prompts.map((p, i) => (
                <div key={i} className="ai-writer-scene-prompt"
                  onClick={() => { setAiMode('scene'); setAiPrompt(p); }}
                  title="Click to use as scene prompt"
                >✦ {p}</div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Profile result
    if (aiResult.profile) {
      const p = aiResult.profile;
      return (
        <div className="ai-writer-result">
          <div className="ai-writer-result-header">
            <span className="ai-writer-result-label">Generated Profile — {aiResult.character_name}</span>
            <button onClick={aiClear} className="ai-writer-clear-btn">Clear</button>
          </div>
          {p.ai_summary && (
            <div className="ai-writer-profile-summary">{p.ai_summary}</div>
          )}
          <div className="ai-writer-profile-grid">
            {p.core_desire && <div className="ai-writer-profile-item"><strong>Core Desire</strong><span>{p.core_desire}</span></div>}
            {p.core_fear && <div className="ai-writer-profile-item"><strong>Core Fear</strong><span>{p.core_fear}</span></div>}
            {p.core_wound && <div className="ai-writer-profile-item"><strong>Core Wound</strong><span>{p.core_wound}</span></div>}
            {p.mask_persona && <div className="ai-writer-profile-item"><strong>Public Mask</strong><span>{p.mask_persona}</span></div>}
            {p.truth_persona && <div className="ai-writer-profile-item"><strong>Private Truth</strong><span>{p.truth_persona}</span></div>}
            {p.signature_trait && <div className="ai-writer-profile-item"><strong>Signature Trait</strong><span>{p.signature_trait}</span></div>}
            {p.emotional_baseline && <div className="ai-writer-profile-item"><strong>Emotional Baseline</strong><span>{p.emotional_baseline}</span></div>}
          </div>
          {p.description && (
            <div className="ai-writer-profile-desc">
              <strong>Bio:</strong> {p.description}
            </div>
          )}
          {p.evidence?.length > 0 && (
            <div className="ai-writer-evidence">
              <div className="ai-writer-evidence-title">Evidence from Story</div>
              {p.evidence.map((e, i) => <div key={i} className="ai-writer-evidence-item">• {e}</div>)}
            </div>
          )}
          {aiResult.data_sources && (
            <div className="ai-writer-context-badge">
              Analyzed: {aiResult.data_sources.memories || 0} memories · {aiResult.data_sources.relationships || 0} relationships · {aiResult.data_sources.lines_mentioning || 0} character lines · {aiResult.data_sources.recent_lines || 0} story lines
            </div>
          )}
        </div>
      );
    }

    // Fallback: show raw
    if (aiResult.raw) {
      return (
        <div className="ai-writer-result">
          <div className="ai-writer-result-header">
            <span className="ai-writer-result-label">Result</span>
            <button onClick={aiClear} className="ai-writer-clear-btn">Clear</button>
          </div>
          <div className="ai-writer-prose">{aiResult.raw}</div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="ai-writer-tab">
      {/* Header */}
      <div className="ai-writer-header">
        <div className="ai-writer-header-title">✦ AI Writer</div>
        <div className="ai-writer-header-sub">
          Claude knows everything about {charName} — psychology, wounds, relationships, 
          memories, voice, and every approved line of story.
        </div>
      </div>

      {/* Mode selector */}
      <div className="ai-writer-modes">
        {AI_MODES.map(m => (
          <button
            key={m.key}
            className={`ai-writer-mode ${aiMode === m.key ? 'active' : ''}`}
            onClick={() => { setAiMode(m.key); if (aiResult) aiClear(); }}
          >
            <span className="ai-writer-mode-icon">{m.icon}</span>
            <span className="ai-writer-mode-label">{m.label}</span>
            <span className="ai-writer-mode-desc">{m.desc}</span>
          </button>
        ))}
      </div>

      {/* Inputs */}
      {renderInputs()}

      {/* Generate button */}
      {!aiResult && !aiLoading && (
        <button className="ai-writer-generate-btn" onClick={aiGenerate} disabled={aiLoading}>
          ✦ Generate with Claude
        </button>
      )}

      {/* Result */}
      {renderResult()}
    </div>
  );
}


/* ================================================================
   DOSSIER SUB-COMPONENTS
   ================================================================ */

/* Read-mode row */
function DRow({ label, value, accent }) {
  if (!value) return null;
  return (
    <div className="cr-dossier-row">
      <span className="cr-dossier-row-label">{label}</span>
      <span className={`cr-dossier-row-value ${accent ? 'accent' : ''}`}>{value}</span>
    </div>
  );
}

/* Relationship card */
function RelCard({ type, icon, value }) {
  if (!value) return null;
  return (
    <div className="cr-dossier-rel-card">
      <div className="cr-dossier-rel-type">{icon} {type}</div>
      <div className="cr-dossier-rel-names">{value}</div>
    </div>
  );
}

/* Edit field */
function EField({ label, value, onChange, placeholder }) {
  return (
    <div className="cr-edit-field">
      <label className="cr-edit-label">{label}</label>
      <input className="cr-edit-input" value={value || ''} onChange={e => onChange(e.target.value)}
        placeholder={placeholder || label} />
    </div>
  );
}

/* Edit textarea */
function EArea({ label, value, onChange, rows = 3, placeholder }) {
  return (
    <div className="cr-edit-field">
      <label className="cr-edit-label">{label}</label>
      <textarea className="cr-edit-input cr-edit-textarea" value={value || ''}
        onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder || label} />
    </div>
  );
}

/* Edit select */
function ESelect({ label, value, onChange, options, allowEmpty }) {
  return (
    <div className="cr-edit-field">
      <label className="cr-edit-label">{label}</label>
      <select className="cr-edit-input cr-edit-select" value={value || ''} onChange={e => onChange(e.target.value)}>
        {allowEmpty && <option value="">— Select —</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}


/* ================================================================
   FORM ↔ DATA HELPERS
   ================================================================ */

function buildFormForTab(tabKey, c) {
  if (!c) return {};
  switch (tabKey) {
    case 'overview':
      return {
        display_name:     c.display_name || '',
        selected_name:    c.selected_name || '',
        description:      c.description || '',
        first_appearance: c.first_appearance || '',
        era_introduced:   c.era_introduced || '',
        canon_tier:       c.canon_tier || '',
        creator:          c.creator || '',
      };
    case 'psychology':
      return {
        core_desire:         c.core_desire || '',
        core_fear:           c.core_fear || '',
        core_wound:          c.core_wound || '',
        mask_persona:        c.mask_persona || '',
        truth_persona:       c.truth_persona || '',
        character_archetype: c.character_archetype || '',
        signature_trait:     c.signature_trait || '',
        emotional_baseline:  c.emotional_baseline || '',
      };
    case 'aesthetic':
      return {
        era_aesthetic:          jGet(c.aesthetic_dna, 'era_aesthetic'),
        color_palette:          jGet(c.aesthetic_dna, 'color_palette'),
        signature_silhouette:   jGet(c.aesthetic_dna, 'signature_silhouette'),
        signature_accessories:  jGet(c.aesthetic_dna, 'signature_accessories'),
        glam_energy:            jGet(c.aesthetic_dna, 'glam_energy'),
        visual_evolution_notes: jGet(c.aesthetic_dna, 'visual_evolution_notes'),
      };
    case 'career':
      return {
        profession:          jGet(c.career_status, 'profession'),
        career_goal:         jGet(c.career_status, 'career_goal'),
        reputation_level:    jGet(c.career_status, 'reputation_level'),
        brand_relationships: jGet(c.career_status, 'brand_relationships'),
        financial_status:    jGet(c.career_status, 'financial_status'),
        public_recognition:  jGet(c.career_status, 'public_recognition'),
        ongoing_arc:         jGet(c.career_status, 'ongoing_arc'),
      };
    case 'relationships':
      return {
        allies:            jGet(c.relationships_map, 'allies'),
        rivals:            jGet(c.relationships_map, 'rivals'),
        mentors:           jGet(c.relationships_map, 'mentors'),
        love_interests:    jGet(c.relationships_map, 'love_interests'),
        business_partners: jGet(c.relationships_map, 'business_partners'),
        dynamic_notes:     jGet(c.relationships_map, 'dynamic_notes'),
      };
    case 'story':
      return {
        appears_in_books:     jGet(c.story_presence, 'appears_in_books'),
        appears_in_shows:     jGet(c.story_presence, 'appears_in_shows'),
        appears_in_series:    jGet(c.story_presence, 'appears_in_series'),
        current_story_status: jGet(c.story_presence, 'current_story_status'),
        unresolved_threads:   jGet(c.story_presence, 'unresolved_threads'),
        future_potential:     jGet(c.story_presence, 'future_potential'),
      };
    case 'voice':
      return {
        speech_pattern:           jGet(c.voice_signature, 'speech_pattern'),
        vocabulary_tone:          jGet(c.voice_signature, 'vocabulary_tone'),
        catchphrases:             jGet(c.voice_signature, 'catchphrases'),
        internal_monologue_style: jGet(c.voice_signature, 'internal_monologue_style'),
        emotional_reactivity:     jGet(c.voice_signature, 'emotional_reactivity'),
      };
    default:
      return {};
  }
}

function buildPayloadForTab(tabKey, form) {
  switch (tabKey) {
    case 'overview':
      return {
        display_name:     form.display_name,
        selected_name:    form.selected_name,
        description:      form.description,
        first_appearance: form.first_appearance,
        era_introduced:   form.era_introduced,
        canon_tier:       form.canon_tier,
        creator:          form.creator,
      };
    case 'psychology':
      return {
        core_desire:         form.core_desire,
        core_fear:           form.core_fear,
        core_wound:          form.core_wound,
        mask_persona:        form.mask_persona,
        truth_persona:       form.truth_persona,
        character_archetype: form.character_archetype,
        signature_trait:     form.signature_trait,
        emotional_baseline:  form.emotional_baseline,
      };
    case 'aesthetic':
      return {
        aesthetic_dna: {
          era_aesthetic:          form.era_aesthetic,
          color_palette:          form.color_palette,
          signature_silhouette:   form.signature_silhouette,
          signature_accessories:  form.signature_accessories,
          glam_energy:            form.glam_energy,
          visual_evolution_notes: form.visual_evolution_notes,
        },
      };
    case 'career':
      return {
        career_status: {
          profession:          form.profession,
          career_goal:         form.career_goal,
          reputation_level:    form.reputation_level,
          brand_relationships: form.brand_relationships,
          financial_status:    form.financial_status,
          public_recognition:  form.public_recognition,
          ongoing_arc:         form.ongoing_arc,
        },
      };
    case 'relationships':
      return {
        relationships_map: {
          allies:            form.allies,
          rivals:            form.rivals,
          mentors:           form.mentors,
          love_interests:    form.love_interests,
          business_partners: form.business_partners,
          dynamic_notes:     form.dynamic_notes,
        },
      };
    case 'story':
      return {
        story_presence: {
          appears_in_books:     form.appears_in_books,
          appears_in_shows:     form.appears_in_shows,
          appears_in_series:    form.appears_in_series,
          current_story_status: form.current_story_status,
          unresolved_threads:   form.unresolved_threads,
          future_potential:     form.future_potential,
        },
      };
    case 'voice':
      return {
        voice_signature: {
          speech_pattern:           form.speech_pattern,
          vocabulary_tone:          form.vocabulary_tone,
          catchphrases:             form.catchphrases,
          internal_monologue_style: form.internal_monologue_style,
          emotional_reactivity:     form.emotional_reactivity,
        },
      };
    default:
      return form;
  }
}
