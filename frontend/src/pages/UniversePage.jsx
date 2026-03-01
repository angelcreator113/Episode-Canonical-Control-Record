/**
 * UniversePage.jsx
 * frontend/src/pages/UniversePage.jsx
 *
 * Route: /universe
 * Sidebar: ◈ Universe → /universe (under Home)
 *
 * Pass 1 features:
 * - Five tabs: Universe | Series | Production | Wardrobe | Assets
 * - Universe tab: edit all fields, preview toggle, Claude "Structure from Raw Draft"
 * - Series tab: create/edit series, books grouped inside, edit era inline
 * - Production tab: shows + episodes merged — select a show to browse episodes
 * - Canon Timeline strip at bottom of Universe tab
 *
 * Light theme — modern white design with gold accents
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ProductionTab from './ProductionTab';
import Wardrobe from './Wardrobe';
import AssetLibrary from './AssetLibrary';
import './UniversePage.css';

function useWindowWidth() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

const UNIVERSE_API    = '/api/v1/universe';
const STORYTELLER_API = '/api/v1/storyteller';
const SHOWS_API       = '/api/v1/shows';
const MEMORIES_API    = '/api/v1/memories';

const LALAVERSE_ID = 'a0cc3869-7d55-4d4c-8cf8-c2b66300bf6e'; // from seed

// ── Main Page ──────────────────────────────────────────────────────────────

export default function UniversePage() {
  const width = useWindowWidth();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = ['universe','series','production','wardrobe','assets'].includes(searchParams.get('tab'))
    ? searchParams.get('tab') : 'universe';
  const [activeTab, setActiveTab] = useState(initialTab);

  function switchTab(tab) {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  }
  const [universe, setUniverse]   = useState(null);
  const [series, setSeries]       = useState([]);
  const [shows, setShows]         = useState([]);
  const [books, setBooks]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [toast, setToast]         = useState(null);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }

  // ── Load everything ──────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, sRes] = await Promise.all([
        fetch(`${UNIVERSE_API}/${LALAVERSE_ID}`),
        fetch(`${UNIVERSE_API}/series?universe_id=${LALAVERSE_ID}`),
      ]);
      const uData = await uRes.json();
      const sData = await sRes.json();
      setUniverse(uData.universe);
      setSeries(sData.series || []);

      // Load books
      const bRes = await fetch(`${STORYTELLER_API}/books`);
      const bData = await bRes.json();
      setBooks(bData.books || []);

      // Load shows (try, don't fail if endpoint shape differs)
      try {
        const shRes = await fetch(`${SHOWS_API}`);
        const shData = await shRes.json();
        const showsList = shData.data || shData.shows || shData;
        setShows(Array.isArray(showsList) ? showsList : []);
      } catch (_) {}

    } catch (err) {
      console.error('UniversePage load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState />;
  if (!universe) return <ErrorState onRetry={load} />;

  const px = isMobile ? 16 : isTablet ? 28 : 48;
  const tabIcons = { universe: '🌌', series: '📚', production: '🎬', wardrobe: '👗', assets: '📁' };

  return (
    <div className="up-shell">

      {/* Hero Header */}
      <div className="up-hero" style={isMobile ? { padding: '20px 16px' } : isTablet ? { padding: '28px 28px 24px' } : undefined}>
        <div className="up-hero-top">
          <div>
            <div className="up-hero-label">FRANCHISE BRAIN</div>
            <h1 className="up-hero-title" style={isMobile ? { fontSize: 24 } : isTablet ? { fontSize: 30 } : undefined}>{universe.name}</h1>
            <div className="up-hero-slug">/{universe.slug}</div>
          </div>
        </div>

        <div className="up-hero-stats">
          <div className="up-hero-stat">
            <div className="up-stat-value">{series.length}</div>
            <div className="up-stat-label">Series</div>
          </div>
          <div className="up-hero-stat">
            <div className="up-stat-value">{shows.length}</div>
            <div className="up-stat-label">Shows</div>
          </div>
          <div className="up-hero-stat">
            <div className="up-stat-value">{shows.reduce((sum, sh) => sum + (parseInt(sh.episodeCount || sh.dataValues?.episodeCount) || 0), 0)}</div>
            <div className="up-stat-label">Episodes</div>
          </div>
          <div className="up-hero-stat">
            <div className="up-stat-value">{(universe.core_themes || []).length}</div>
            <div className="up-stat-label">Themes</div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="up-tab-bar" style={isMobile ? { padding: '8px 16px', overflowX: 'auto' } : isTablet ? { padding: '10px 28px' } : undefined}>
        {['universe', 'series', 'production', 'wardrobe', 'assets'].map(tab => (
          <button
            key={tab}
            className={`up-tab-btn${activeTab === tab ? ' active' : ''}`}
            style={isMobile ? { flexShrink: 0, textAlign: 'center', fontSize: 12, whiteSpace: 'nowrap' } : undefined}
            onClick={() => switchTab(tab)}
          >
            {tabIcons[tab]} {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="up-tab-content" style={isMobile ? { padding: '0 16px' } : isTablet ? { padding: '0 28px' } : undefined}>
        {activeTab === 'universe' && (
          <UniverseTab
            universe={universe}
            series={series}
            books={books}
            onSaved={(updated) => { setUniverse(updated); showToast('Universe saved'); }}
            showToast={showToast}
            isMobile={isMobile}
            isTablet={isTablet}
          />
        )}
        {activeTab === 'series' && (
          <SeriesTab
            series={series}
            books={books}
            universeId={LALAVERSE_ID}
            onChanged={() => { load(); showToast('Series updated'); }}
            showToast={showToast}
            isMobile={isMobile}
            isTablet={isTablet}
          />
        )}
        {activeTab === 'production' && (
          <ProductionTab
            shows={shows}
            universeId={LALAVERSE_ID}
            onChanged={() => { load(); showToast('Show updated'); }}
            showToast={showToast}
            isMobile={isMobile}
            isTablet={isTablet}
          />
        )}
        {activeTab === 'wardrobe' && (
          <Wardrobe embedded={true} />
        )}
        {activeTab === 'assets' && (
          <AssetLibrary embedded={true} />
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`up-toast ${toast.type === 'error' ? 'up-toast--error' : 'up-toast--success'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  TAB 1 — UNIVERSE
// ══════════════════════════════════════════════════════════════════════════

function UniverseTab({ universe, series, books, onSaved, showToast, isMobile, isTablet }) {
  const [form, setForm]         = useState({
    name:               universe.name || '',
    description:        universe.description || '',
    pnos_beliefs:       universe.pnos_beliefs || '',
    world_rules:        universe.world_rules || '',
    narrative_economy:  universe.narrative_economy || '',
    core_themes:        (universe.core_themes || []).join(', '),
  });
  const [preview, setPreview]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [dirty, setDirty]       = useState(false);
  const [structuring, setStructuring] = useState(false);
  const [rawDraft, setRawDraft] = useState('');
  const [showRawModal, setShowRawModal] = useState(false);

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`${UNIVERSE_API}/${universe.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          core_themes: form.core_themes
            .split(',')
            .map(t => t.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved(data.universe);
      setDirty(false);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function structureFromRaw() {
    if (!rawDraft.trim()) return;
    setStructuring(true);
    try {
      const res = await fetch('/api/v1/memories/structure-universe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: rawDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const s = data.structured;
      setForm(prev => ({
        ...prev,
        description:       s.description       || prev.description,
        pnos_beliefs:      s.pnos_beliefs       || prev.pnos_beliefs,
        world_rules:       s.world_rules        || prev.world_rules,
        narrative_economy: s.narrative_economy  || prev.narrative_economy,
        core_themes:       s.core_themes?.join(', ') || prev.core_themes,
      }));
      setDirty(true);
      setShowRawModal(false);
      setRawDraft('');
      showToast('Draft structured — review and save');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setStructuring(false);
    }
  }

  // ── Canon timeline data ──────────────────────────────────────────────
  const timelineItems = [
    ...books.map(b => ({
      type: 'book',
      label: b.title,
      era: b.era_name,
      position: b.timeline_position,
      canon: b.canon_status,
    })),
    ...[] // shows would go here
  ].sort((a, b) => {
    const order = ['Pre-Show','Early Show','Soft Luxury Era','Prime Era','Legacy Era'];
    return (order.indexOf(a.position) || 0) - (order.indexOf(b.position) || 0);
  });

  return (
    <div className="up-tab-shell">

      {/* Actions bar */}
      <div className="up-actions-bar">
        <button className="up-btn-secondary" onClick={() => setPreview(!preview)}>
          {preview ? '✎ Edit' : '◉ Preview'}
        </button>
        <button
          className="up-btn-secondary"
          onClick={() => setShowRawModal(true)}
        >
          ✦ Structure from Raw Draft
        </button>
        {dirty && (
          <button
            className="up-btn-primary"
            style={{ opacity: saving ? 0.6 : 1 }}
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Universe'}
          </button>
        )}
      </div>

      {preview ? (
        // ── Preview mode ───────────────────────────────────────────────
        <div className="up-preview-shell">
          <h2 className="up-preview-title">{form.name}</h2>
          <div className="up-preview-section">
            <div className="up-preview-label">Description</div>
            <div className="up-preview-body">{form.description}</div>
          </div>
          {form.core_themes && (
            <div className="up-preview-section">
              <div className="up-preview-label">Core Themes</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                {form.core_themes.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                  <span key={t} className="up-theme-chip">{t}</span>
                ))}
              </div>
            </div>
          )}
          <div className="up-preview-section">
            <div className="up-preview-label">PNOS Beliefs</div>
            <div className="up-preview-body">{form.pnos_beliefs}</div>
          </div>
          <div className="up-preview-section">
            <div className="up-preview-label">World Rules</div>
            <div className="up-preview-body">{form.world_rules}</div>
          </div>
          <div className="up-preview-section">
            <div className="up-preview-label">Narrative Economy</div>
            <div className="up-preview-body">{form.narrative_economy}</div>
          </div>
        </div>
      ) : (
        // ── Edit mode ──────────────────────────────────────────────────
        <div className="up-form-shell">

          <Field label='UNIVERSE NAME'>
            <input
              className="up-input"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </Field>

          <Field label='CORE THEMES' hint='Comma-separated'>
            <input
              className="up-input"
              value={form.core_themes}
              onChange={e => set('core_themes', e.target.value)}
              placeholder='ambition, identity, beauty, consequence, becoming'
            />
          </Field>

          <Field label='UNIVERSE DESCRIPTION'>
            <textarea
              className="up-textarea"
              style={{ minHeight: 120 }}
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </Field>

          <Field label='PNOS BELIEFS' hint='The laws that govern how story works'>
            <textarea
              className="up-textarea"
              style={{ minHeight: 180 }}
              value={form.pnos_beliefs}
              onChange={e => set('pnos_beliefs', e.target.value)}
            />
          </Field>

          <Field label='WORLD RULES' hint='Mechanical + narrative rules'>
            <textarea
              className="up-textarea"
              style={{ minHeight: 180 }}
              value={form.world_rules}
              onChange={e => set('world_rules', e.target.value)}
            />
          </Field>

          <Field label='NARRATIVE ECONOMY' hint='Currency, reputation, access systems'>
            <textarea
              className="up-textarea"
              style={{ minHeight: 100 }}
              value={form.narrative_economy}
              onChange={e => set('narrative_economy', e.target.value)}
            />
          </Field>

        </div>
      )}

      {/* Canon Timeline */}
      {timelineItems.length > 0 && (
        <div className="up-timeline-block">
          <div className="up-section-label">CANON TIMELINE</div>
          <div className="up-timeline-strip">
            {timelineItems.map((item, i) => (
              <div key={i} className="up-timeline-item">
                <div className={`up-timeline-dot ${item.type === 'book' ? 'up-timeline-dot--book' : 'up-timeline-dot--show'}`} />
                <div className="up-timeline-label">{item.label}</div>
                {item.era && <div className="up-timeline-era">{item.era}</div>}
                {item.position && <div className="up-timeline-pos">{item.position}</div>}
              </div>
            ))}
            <div className="up-timeline-item" style={{ opacity: 0.35 }}>
              <div className="up-timeline-dot up-timeline-dot--placeholder" />
              <div className="up-timeline-label">[ Next ]</div>
            </div>
          </div>
        </div>
      )}

      {/* Raw Draft Modal */}
      {showRawModal && (
        <div className="up-modal-overlay" onClick={e => e.target === e.currentTarget && setShowRawModal(false)}>
          <div className="up-modal" style={isMobile ? { width: '100%', maxHeight: '100vh', borderRadius: 0, height: '100vh' } : undefined}>
            <div className="up-modal-header">
              <div>
                <div className="up-modal-label">CLAUDE</div>
                <div className="up-modal-title">Structure Universe From Raw Draft</div>
              </div>
              <button className="up-close-btn" onClick={() => setShowRawModal(false)}>✕</button>
            </div>
            <div className="up-modal-body">
              <p className="up-modal-hint">
                Paste your messy world notes, lore, philosophy, or themes. Claude will structure them into description, PNOS beliefs, world rules, core themes, and narrative economy. You review before saving.
              </p>
              <textarea
                className="up-textarea"
                style={{ minHeight: 260 }}
                placeholder='Paste your raw universe notes here…'
                value={rawDraft}
                onChange={e => setRawDraft(e.target.value)}
                autoFocus
              />
            </div>
            <div className="up-modal-footer">
              <button className="up-btn-secondary" onClick={() => setShowRawModal(false)}>Cancel</button>
              <button
                className="up-btn-primary"
                style={{ opacity: structuring ? 0.6 : 1 }}
                onClick={structureFromRaw}
                disabled={structuring || !rawDraft.trim()}
              >
                {structuring ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>Structuring</span>
                    <LoadingDots />
                  </span>
                ) : '✦ Structure with Claude'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  TAB 2 — SERIES
// ══════════════════════════════════════════════════════════════════════════

function SeriesTab({ series, books, universeId, onChanged, showToast, isMobile, isTablet }) {
  const [creating, setCreating]   = useState(false);
  const [newName, setNewName]     = useState('');
  const [newDesc, setNewDesc]     = useState('');
  const [saving, setSaving]       = useState(false);
  const [editingEra, setEditingEra] = useState(null); // bookId
  const [eraValues, setEraValues]   = useState({});
  const [assigning, setAssigning]   = useState(null); // bookId being assigned

  async function assignToSeries(bookId, seriesId) {
    try {
      const res = await fetch(`${STORYTELLER_API}/books/${bookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ series_id: seriesId || null }),
      });
      if (!res.ok) throw new Error('Failed to assign');
      setAssigning(null);
      showToast('Book assigned to series');
      onChanged();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function createSeries() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${UNIVERSE_API}/series`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          universe_id: universeId,
          name: newName.trim(),
          description: newDesc.trim(),
          order_index: series.length,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCreating(false);
      setNewName('');
      setNewDesc('');
      onChanged();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveEra(bookId) {
    const val = eraValues[bookId];
    try {
      const res = await fetch(`${STORYTELLER_API}/books/${bookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ era_name: val }),
      });
      if (!res.ok) throw new Error('Failed');
      setEditingEra(null);
      onChanged();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function deleteSeries(seriesId) {
    if (!confirm('Delete this series? Books will be unlinked but not deleted.')) return;
    try {
      const res = await fetch(`${UNIVERSE_API}/series/${seriesId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      onChanged();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Group books by series
  const unassigned = books.filter(b => !b.series_id);

  return (
    <div className="up-tab-shell">

      {/* Create series button */}
      <div className="up-actions-bar">
        <button className="up-btn-primary" onClick={() => setCreating(true)}>
          + New Series
        </button>
      </div>

      {/* New series form */}
      {creating && (
        <div className="up-create-card">
          <div className="up-section-label">NEW SERIES</div>
          <input
            className="up-input"
            style={{ marginBottom: 10 }}
            placeholder='Series name — e.g. Becoming Prime'
            value={newName}
            onChange={e => setNewName(e.target.value)}
            autoFocus
          />
          <textarea
            className="up-textarea"
            style={{ minHeight: 80, marginBottom: 10 }}
            placeholder='Series description — what story arc does this cover?'
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="up-btn-secondary" onClick={() => setCreating(false)}>Cancel</button>
            <button
              className="up-btn-primary"
              style={{ opacity: saving ? 0.6 : 1 }}
              onClick={createSeries}
              disabled={saving}
            >
              {saving ? 'Creating…' : 'Create Series'}
            </button>
          </div>
        </div>
      )}

      {/* Series list */}
      {series.map(ser => {
        const seriesBooks = books.filter(b => b.series_id === ser.id);
        return (
          <div key={ser.id} className="up-series-card" style={isMobile ? { padding: '14px' } : undefined}>
            <div className="up-series-header" style={isMobile ? { flexDirection: 'column', gap: 8 } : undefined}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div className="up-series-name" style={isMobile ? { fontSize: 19 } : undefined}>{ser.name}</div>
                  {isMobile && (
                    <button className="up-btn-delete" style={{ padding: '8px 12px', flexShrink: 0 }} onClick={() => deleteSeries(ser.id)} title='Delete series'>✕</button>
                  )}
                </div>
                {ser.description && (
                  <div className="up-series-desc" style={isMobile ? { maxWidth: '100%' } : undefined}>{ser.description}</div>
                )}
              </div>
              {!isMobile && (
                <button className="up-btn-delete" onClick={() => deleteSeries(ser.id)} title='Delete series'>✕</button>
              )}
            </div>

            {/* Books in series */}
            {seriesBooks.length === 0 ? (
              <div className="up-empty-books">No books in this series yet.</div>
            ) : (
              <div className="up-book-list">
                {seriesBooks.map(book => (
                  <div key={book.id} className="up-book-row" style={isMobile ? { flexDirection: 'column', alignItems: 'flex-start' } : undefined}>
                    <div className="up-book-row-left">
                      <div className="up-book-title" style={isMobile ? { fontSize: 15 } : undefined}>{book.title}</div>
                      <div className="up-book-meta">
                        {book.primary_pov && <span className="up-meta-chip">{book.primary_pov.replace('_', ' ')}</span>}
                        {book.canon_status && (
                          <span className="up-meta-chip" style={{
                            color: book.canon_status === 'locked' ? '#a78bfa'
                              : book.canon_status === 'active' ? '#4ade80' : '#C9A84C',
                          }}>
                            {book.canon_status}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="up-book-row-right" style={isMobile ? { justifyContent: 'flex-start', width: '100%', flexWrap: 'wrap' } : undefined}>
                      {editingEra === book.id ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', width: isMobile ? '100%' : 'auto' }}>
                          <input
                            className="up-input"
                            style={{ padding: '8px 10px', fontSize: 13, flex: 1, width: 'auto' }}
                            value={eraValues[book.id] ?? book.era_name ?? ''}
                            onChange={e => setEraValues(prev => ({ ...prev, [book.id]: e.target.value }))}
                            autoFocus
                          />
                          <button className="up-btn-micro" style={isMobile ? { padding: '8px 12px' } : undefined} onClick={() => saveEra(book.id)}>✓</button>
                          <button className="up-btn-micro" style={isMobile ? { padding: '8px 12px' } : undefined} onClick={() => setEditingEra(null)}>✕</button>
                        </div>
                      ) : (
                        <button
                          className="up-era-btn"
                          style={isMobile ? { padding: '8px 12px', fontSize: 12 } : undefined}
                          onClick={() => {
                            setEditingEra(book.id);
                            setEraValues(prev => ({ ...prev, [book.id]: book.era_name || '' }));
                          }}
                        >
                          {book.era_name || '+ Set Era'}
                        </button>
                      )}

                      {/* Move to different series */}
                      <select
                        className="up-assign-select"
                        style={isMobile ? { maxWidth: 'none', flex: '1 1 auto', fontSize: 12, padding: '8px 10px' } : undefined}
                        value={ser.id}
                        onChange={e => {
                          const val = e.target.value;
                          if (val !== ser.id) assignToSeries(book.id, val || null);
                        }}
                      >
                        {series.map(sr => (
                          <option key={sr.id} value={sr.id}>{sr.name}</option>
                        ))}
                        <option value=''>— Unassign —</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Unassigned books */}
      {unassigned.length > 0 && (
        <div className="up-series-card" style={{ borderColor: '#eeebe4', ...(isMobile ? { padding: 14 } : {}) }}>
          <div className="up-series-name">Unassigned Books</div>
          <div className="up-book-list">
            {unassigned.map(book => (
              <div key={book.id} className="up-book-row" style={isMobile ? { flexDirection: 'column', alignItems: 'flex-start' } : undefined}>
                <div className="up-book-row-left">
                  <div className="up-book-title" style={isMobile ? { fontSize: 15 } : undefined}>{book.title}</div>
                  <div className="up-book-meta">
                    <span className="up-meta-chip" style={{ color: 'rgba(26,26,46,0.3)' }}>no series</span>
                  </div>
                </div>
                <div className="up-book-row-right">
                  {series.length > 0 ? (
                    <select
                      className="up-assign-select"
                      value=''
                      onChange={e => {
                        if (e.target.value) assignToSeries(book.id, e.target.value);
                      }}
                    >
                      <option value=''>Assign to series…</option>
                      {series.map(sr => (
                        <option key={sr.id} value={sr.id}>{sr.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="up-meta-chip" style={{ color: 'rgba(26,26,46,0.3)' }}>Create a series first</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  TAB 3 — PRODUCTION  (imported from ./ProductionTab.jsx)
// ══════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════
//  SHARED COMPONENTS
// ══════════════════════════════════════════════════════════════════════════

function Field({ label, hint, children }) {
  return (
    <div className="up-field">
      <div className="up-field-header">
        <label className="up-field-label">{label}</label>
        {hint && <span className="up-field-hint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function LoadingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3 }}>
      {[0,1,2].map(i => (
        <span key={i} style={{
          width: 4, height: 4, borderRadius: '50%',
          background: '#b0922e', display: 'inline-block',
          animation: 'pulse 1.2s ease-in-out infinite',
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
    </span>
  );
}

function LoadingState() {
  return (
    <div className="up-loading">
      Loading universe…
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="up-error">
      <div className="up-error-msg">
        Could not load universe data.
      </div>
      <button className="up-btn-secondary" onClick={onRetry}>Retry</button>
    </div>
  );
}

// Styles migrated to UniversePage.css — this stub kept for any edge-case references
const s = {
  _migrated: true,
};

