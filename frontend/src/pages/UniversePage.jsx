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

      const bRes = await fetch(`${STORYTELLER_API}/books`);
      const bData = await bRes.json();
      setBooks(bData.books || []);

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

  return (
    <div className="up-shell">
      <div className="up-hero-compact" style={{ padding: isMobile ? '10px 16px' : '10px 48px' }}>
        <div className="up-hero-compact-left">
          <h1 className="up-hero-compact-title">{universe.name}</h1>
          <span className="up-hero-compact-slug">/{universe.slug}</span>
        </div>
        <div className="up-hero-compact-stats">
          <div className="up-compact-stat"><span className="up-compact-val">{series.length}</span> series</div>
          <div className="up-compact-stat"><span className="up-compact-val">{shows.length}</span> shows</div>
          <div className="up-compact-stat"><span className="up-compact-val">{shows.reduce((sum, sh) => sum + (parseInt(sh.episodeCount || sh.dataValues?.episodeCount) || 0), 0)}</span> episodes</div>
          <div className="up-compact-stat"><span className="up-compact-val">{(universe.core_themes || []).length}</span> themes</div>
        </div>
      </div>

      <div className="up-tab-content" style={isMobile ? { padding: '0 16px' } : isTablet ? { padding: '0 28px' } : undefined}>
        <UniverseTab
          universe={universe}
          series={series}
          books={books}
          onSaved={(updated) => { setUniverse(updated); showToast('Universe saved'); }}
          showToast={showToast}
          isMobile={isMobile}
          isTablet={isTablet}
        />
      </div>

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

