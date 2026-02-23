/**
 * UniversePage.jsx
 * frontend/src/pages/UniversePage.jsx
 *
 * Route: /universe
 * Sidebar: ◈ Universe → /universe (under Home)
 *
 * Pass 1 features:
 * - Three tabs: Universe | Series | Shows
 * - Universe tab: edit all fields, preview toggle, Claude "Structure from Raw Draft"
 * - Series tab: create/edit series, books grouped inside, edit era inline
 * - Shows tab: linked shows, edit description + era
 * - Canon Timeline strip at bottom of Universe tab
 *
 * Light theme — matches app parchment/serif design system
 */

import { useState, useEffect, useCallback } from 'react';
import ShowWorldView from './ShowWorldView';

const UNIVERSE_API    = '/api/v1/universe';
const STORYTELLER_API = '/api/v1/storyteller';
const SHOWS_API       = '/api/v1/shows';
const MEMORIES_API    = '/api/v1/memories';

const LALAVERSE_ID = 'a0cc3869-7d55-4d4c-8cf8-c2b66300bf6e'; // from seed

// ── Main Page ──────────────────────────────────────────────────────────────

export default function UniversePage() {
  const [activeTab, setActiveTab] = useState('universe');
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

  return (
    <div style={s.shell}>

      {/* Page header */}
      <div style={s.pageHeader}>
        <div>
          <div style={s.pageLabel}>FRANCHISE BRAIN</div>
          <h1 style={s.pageTitle}>{universe.name}</h1>
          <div style={s.pageSlug}>/{universe.slug}</div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={s.tabBar}>
        {['universe', 'series', 'shows'].map(tab => (
          <button
            key={tab}
            style={{
              ...s.tabBtn,
              color: activeTab === tab ? '#C9A84C' : 'rgba(26,21,16,0.35)',
              borderBottom: activeTab === tab
                ? '2px solid #C9A84C'
                : '2px solid transparent',
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'universe' ? '🌌 Universe' :
             tab === 'series'   ? '📚 Series' : '📺 Shows'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={s.tabContent}>
        {activeTab === 'universe' && (
          <UniverseTab
            universe={universe}
            series={series}
            books={books}
            onSaved={(updated) => { setUniverse(updated); showToast('Universe saved'); }}
            showToast={showToast}
          />
        )}
        {activeTab === 'series' && (
          <SeriesTab
            series={series}
            books={books}
            universeId={LALAVERSE_ID}
            onChanged={() => { load(); showToast('Series updated'); }}
            showToast={showToast}
          />
        )}
        {activeTab === 'shows' && (
          <ShowsTab
            shows={shows}
            universeId={LALAVERSE_ID}
            onChanged={() => { load(); showToast('Show updated'); }}
            showToast={showToast}
          />
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          ...s.toast,
          background: toast.type === 'error' ? '#B85C38' : '#4A7C59',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  TAB 1 — UNIVERSE
// ══════════════════════════════════════════════════════════════════════════

function UniverseTab({ universe, series, books, onSaved, showToast }) {
  const [form, setForm]         = useState({
    name:               universe.name || '',
    description:        universe.description || '',
    pnos_beliefs:       universe.pnos_beliefs || '',
    world_rules:        universe.world_rules || '',
    narrative_economy:  universe.narrative_economy || '',
    core_themes:        (universe.core_themes || []).join(', '),
  });
  const [preview, setPreview]   = useState(false);
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
    <div style={s.tabShell}>

      {/* Actions bar */}
      <div style={s.actionsBar}>
        <button style={s.secondaryBtn} onClick={() => setPreview(!preview)}>
          {preview ? '✎ Edit' : '◉ Preview'}
        </button>
        <button
          style={s.secondaryBtn}
          onClick={() => setShowRawModal(true)}
        >
          ✦ Structure from Raw Draft
        </button>
        {dirty && (
          <button
            style={{ ...s.primaryBtn, opacity: saving ? 0.6 : 1 }}
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Universe'}
          </button>
        )}
      </div>

      {preview ? (
        // ── Preview mode ───────────────────────────────────────────────
        <div style={s.previewShell}>
          <h2 style={s.previewTitle}>{form.name}</h2>
          <div style={s.previewSection}>
            <div style={s.previewLabel}>Description</div>
            <div style={s.previewBody}>{form.description}</div>
          </div>
          {form.core_themes && (
            <div style={s.previewSection}>
              <div style={s.previewLabel}>Core Themes</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                {form.core_themes.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                  <span key={t} style={s.themeChip}>{t}</span>
                ))}
              </div>
            </div>
          )}
          <div style={s.previewSection}>
            <div style={s.previewLabel}>PNOS Beliefs</div>
            <div style={s.previewBody}>{form.pnos_beliefs}</div>
          </div>
          <div style={s.previewSection}>
            <div style={s.previewLabel}>World Rules</div>
            <div style={s.previewBody}>{form.world_rules}</div>
          </div>
          <div style={s.previewSection}>
            <div style={s.previewLabel}>Narrative Economy</div>
            <div style={s.previewBody}>{form.narrative_economy}</div>
          </div>
        </div>
      ) : (
        // ── Edit mode ──────────────────────────────────────────────────
        <div style={s.formShell}>

          <Field label='UNIVERSE NAME'>
            <input
              style={s.input}
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </Field>

          <Field label='CORE THEMES' hint='Comma-separated'>
            <input
              style={s.input}
              value={form.core_themes}
              onChange={e => set('core_themes', e.target.value)}
              placeholder='ambition, identity, beauty, consequence, becoming'
            />
          </Field>

          <Field label='UNIVERSE DESCRIPTION'>
            <textarea
              style={{ ...s.textarea, minHeight: 120 }}
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </Field>

          <Field label='PNOS BELIEFS' hint='The laws that govern how story works'>
            <textarea
              style={{ ...s.textarea, minHeight: 180 }}
              value={form.pnos_beliefs}
              onChange={e => set('pnos_beliefs', e.target.value)}
            />
          </Field>

          <Field label='WORLD RULES' hint='Mechanical + narrative rules'>
            <textarea
              style={{ ...s.textarea, minHeight: 180 }}
              value={form.world_rules}
              onChange={e => set('world_rules', e.target.value)}
            />
          </Field>

          <Field label='NARRATIVE ECONOMY' hint='Currency, reputation, access systems'>
            <textarea
              style={{ ...s.textarea, minHeight: 100 }}
              value={form.narrative_economy}
              onChange={e => set('narrative_economy', e.target.value)}
            />
          </Field>

        </div>
      )}

      {/* Canon Timeline */}
      {timelineItems.length > 0 && (
        <div style={s.timelineBlock}>
          <div style={s.sectionLabel}>CANON TIMELINE</div>
          <div style={s.timelineStrip}>
            {timelineItems.map((item, i) => (
              <div key={i} style={s.timelineItem}>
                <div style={{
                  ...s.timelineDot,
                  background: item.type === 'book' ? '#C9A84C' : '#4A7C59',
                }} />
                <div style={s.timelineItemLabel}>{item.label}</div>
                {item.era && <div style={s.timelineItemEra}>{item.era}</div>}
                {item.position && <div style={s.timelineItemPos}>{item.position}</div>}
              </div>
            ))}
            <div style={{ ...s.timelineItem, opacity: 0.35 }}>
              <div style={{ ...s.timelineDot, background: 'rgba(26,21,16,0.1)', border: '1px dashed rgba(26,21,16,0.25)' }} />
              <div style={s.timelineItemLabel}>[ Next ]</div>
            </div>
          </div>
        </div>
      )}

      {/* Raw Draft Modal */}
      {showRawModal && (
        <div style={s.modalOverlay} onClick={e => e.target === e.currentTarget && setShowRawModal(false)}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <div>
                <div style={s.modalLabel}>CLAUDE</div>
                <div style={s.modalTitle}>Structure Universe From Raw Draft</div>
              </div>
              <button style={s.closeBtn} onClick={() => setShowRawModal(false)}>✕</button>
            </div>
            <div style={s.modalBody}>
              <p style={s.modalHint}>
                Paste your messy world notes, lore, philosophy, or themes. Claude will structure them into description, PNOS beliefs, world rules, core themes, and narrative economy. You review before saving.
              </p>
              <textarea
                style={{ ...s.textarea, minHeight: 260 }}
                placeholder='Paste your raw universe notes here…'
                value={rawDraft}
                onChange={e => setRawDraft(e.target.value)}
                autoFocus
              />
            </div>
            <div style={s.modalFooter}>
              <button style={s.secondaryBtn} onClick={() => setShowRawModal(false)}>Cancel</button>
              <button
                style={{ ...s.primaryBtn, opacity: structuring ? 0.6 : 1 }}
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

function SeriesTab({ series, books, universeId, onChanged, showToast }) {
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
    <div style={s.tabShell}>

      {/* Create series button */}
      <div style={s.actionsBar}>
        <button style={s.primaryBtn} onClick={() => setCreating(true)}>
          + New Series
        </button>
      </div>

      {/* New series form */}
      {creating && (
        <div style={s.createCard}>
          <div style={s.sectionLabel}>NEW SERIES</div>
          <input
            style={{ ...s.input, marginBottom: 10 }}
            placeholder='Series name — e.g. Becoming Prime'
            value={newName}
            onChange={e => setNewName(e.target.value)}
            autoFocus
          />
          <textarea
            style={{ ...s.textarea, minHeight: 80, marginBottom: 10 }}
            placeholder='Series description — what story arc does this cover?'
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={s.secondaryBtn} onClick={() => setCreating(false)}>Cancel</button>
            <button
              style={{ ...s.primaryBtn, opacity: saving ? 0.6 : 1 }}
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
          <div key={ser.id} style={s.seriesCard}>
            <div style={s.seriesHeader}>
              <div>
                <div style={s.seriesName}>{ser.name}</div>
                {ser.description && (
                  <div style={s.seriesDesc}>{ser.description}</div>
                )}
              </div>
              <button
                style={s.deleteBtn}
                onClick={() => deleteSeries(ser.id)}
                title='Delete series'
              >
                ✕
              </button>
            </div>

            {/* Books in series */}
            {seriesBooks.length === 0 ? (
              <div style={s.emptyBooks}>No books in this series yet.</div>
            ) : (
              <div style={s.bookList}>
                {seriesBooks.map(book => (
                  <div key={book.id} style={s.bookRow}>
                    <div style={s.bookRowLeft}>
                      <div style={s.bookRowTitle}>{book.title}</div>
                      <div style={s.bookRowMeta}>
                        {book.primary_pov && <span style={s.metaChip}>{book.primary_pov.replace('_', ' ')}</span>}
                        {book.canon_status && (
                          <span style={{
                            ...s.metaChip,
                            color: book.canon_status === 'locked' ? '#7B5EA7'
                              : book.canon_status === 'active' ? '#4A7C59' : '#C9A84C',
                          }}>
                            {book.canon_status}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Era + reassign */}
                    <div style={s.bookRowRight}>
                      {editingEra === book.id ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            style={{ ...s.input, padding: '6px 10px', fontSize: 13, width: 160 }}
                            value={eraValues[book.id] ?? book.era_name ?? ''}
                            onChange={e => setEraValues(prev => ({ ...prev, [book.id]: e.target.value }))}
                            autoFocus
                          />
                          <button style={s.microBtn} onClick={() => saveEra(book.id)}>✓</button>
                          <button style={s.microBtn} onClick={() => setEditingEra(null)}>✕</button>
                        </div>
                      ) : (
                        <button
                          style={s.eraBtn}
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
                        style={s.assignSelect}
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
        <div style={{ ...s.seriesCard, borderColor: 'rgba(26,21,16,0.08)' }}>
          <div style={s.seriesName}>Unassigned Books</div>
          <div style={s.bookList}>
            {unassigned.map(book => (
              <div key={book.id} style={s.bookRow}>
                <div style={s.bookRowLeft}>
                  <div style={s.bookRowTitle}>{book.title}</div>
                  <div style={s.bookRowMeta}>
                    <span style={{ ...s.metaChip, color: 'rgba(26,21,16,0.3)' }}>no series</span>
                  </div>
                </div>
                <div style={s.bookRowRight}>
                  {series.length > 0 ? (
                    <select
                      style={s.assignSelect}
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
                    <span style={{ ...s.metaChip, color: 'rgba(26,21,16,0.25)' }}>Create a series first</span>
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
//  TAB 3 — SHOWS  (with ShowWorldView entry)
// ══════════════════════════════════════════════════════════════════════════

function ShowsTab({ shows, universeId, onChanged, showToast }) {
  const [selectedShow, setSelectedShow] = useState(null);
  const [creating, setCreating]         = useState(false);
  const [newForm, setNewForm]           = useState({ title: '', description: '' });
  const [saving, setSaving]             = useState(false);

  const safeShows = Array.isArray(shows) ? shows : [];
  const linkedShows = safeShows.filter(sh =>
    sh.universe_id === universeId || safeShows.length <= 3
  );

  /* ── Enter show world ─────────────────────────────── */
  if (selectedShow) {
    return (
      <ShowWorldView
        show={selectedShow}
        onBack={() => setSelectedShow(null)}
      />
    );
  }

  /* ── Create show ──────────────────────────────────── */
  async function createShow() {
    if (!newForm.title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(SHOWS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:       newForm.title.trim(),
          description: newForm.description.trim(),
          universe_id: universeId,
        }),
      });
      if (!res.ok) throw new Error('Failed to create show');
      setCreating(false);
      setNewForm({ title: '', description: '' });
      onChanged();
      showToast('Show created');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={s.tabShell}>

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={s.sectionTitle}>Shows · {linkedShows.length}</div>
        {!creating && (
          <button style={s.primaryBtn} onClick={() => setCreating(true)}>
            + New Show
          </button>
        )}
      </div>

      {/* Create form */}
      {creating && (
        <div style={{ ...s.showCard, marginBottom: 16 }}>
          <Field label='SHOW TITLE'>
            <input
              style={s.input}
              value={newForm.title}
              onChange={e => setNewForm(p => ({ ...p, title: e.target.value }))}
              placeholder='e.g. My New Show'
              autoFocus
            />
          </Field>
          <Field label='DESCRIPTION'>
            <textarea
              style={{ ...s.textarea, minHeight: 60 }}
              value={newForm.description}
              onChange={e => setNewForm(p => ({ ...p, description: e.target.value }))}
              placeholder='Short description…'
            />
          </Field>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={s.secondaryBtn} onClick={() => { setCreating(false); setNewForm({ title: '', description: '' }); }}>Cancel</button>
            <button
              style={{ ...s.primaryBtn, opacity: saving ? 0.6 : 1 }}
              onClick={createShow}
              disabled={saving || !newForm.title.trim()}
            >
              {saving ? 'Creating…' : 'Create Show'}
            </button>
          </div>
        </div>
      )}

      {/* Show cards */}
      {linkedShows.length === 0 ? (
        <div style={s.emptyState}>
          <div style={s.emptyTitle}>No shows linked to this universe yet.</div>
          <div style={s.emptyHint}>Click "+ New Show" to create one.</div>
        </div>
      ) : (
        <div style={st.showGrid}>
          {linkedShows.map(show => (
            <ShowCard key={show.id} show={show} onSelect={setSelectedShow} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── ShowCard ─────────────────────────────────────────────────────────── */

function ShowCard({ show, onSelect }) {
  const eraColor = show.era_name ? '#C9A84C' : 'rgba(26,21,16,0.15)';

  return (
    <button
      style={st.card}
      onClick={() => onSelect(show)}
      type='button'
    >
      {/* Era stripe */}
      <div style={{ ...st.eraStripe, background: eraColor }} />

      <div style={st.cardInner}>
        <div style={st.cardTitle}>{show.title || show.name}</div>
        {show.era_name && <div style={st.cardEra}>{show.era_name}</div>}
        {show.description && <div style={st.cardDesc}>{show.description}</div>}

        {/* Mini stats row */}
        <div style={st.cardStats}>
          {show.episode_count != null && <span style={st.cardStat}>📋 {show.episode_count}</span>}
          {show.event_count   != null && <span style={st.cardStat}>❤️ {show.event_count}</span>}
          {show.goal_count    != null && <span style={st.cardStat}>🎯 {show.goal_count}</span>}
        </div>

        <div style={st.cardArrow}>Enter show world →</div>
      </div>
    </button>
  );
}

/* ── ShowsTab styles (st namespace — avoids collision with main s) ──── */

const st = {
  showGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 14,
  },
  card: {
    background: '#fff',
    border: '1px solid rgba(26,21,16,0.08)',
    borderRadius: 6,
    padding: 0,
    cursor: 'pointer',
    textAlign: 'left',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    transition: 'box-shadow 0.12s, border-color 0.12s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  eraStripe: {
    height: 4,
    width: '100%',
  },
  cardInner: {
    padding: '16px 18px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  cardTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 17,
    color: '#14100c',
  },
  cardEra: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    letterSpacing: '0.08em',
    color: '#C9A84C',
  },
  cardDesc: {
    fontFamily: 'DM Sans, sans-serif',
    fontSize: 12,
    color: 'rgba(26,21,16,0.5)',
    lineHeight: 1.4,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  cardStats: {
    display: 'flex',
    gap: 10,
    marginTop: 4,
  },
  cardStat: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    color: 'rgba(26,21,16,0.35)',
  },
  cardArrow: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    letterSpacing: '0.06em',
    color: 'rgba(26,21,16,0.25)',
    marginTop: 6,
  },
};

// ══════════════════════════════════════════════════════════════════════════
//  SHARED COMPONENTS
// ══════════════════════════════════════════════════════════════════════════

function Field({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <label style={s.fieldLabel}>{label}</label>
        {hint && <span style={s.fieldHint}>{hint}</span>}
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
          background: '#14100c', display: 'inline-block',
          animation: 'pulse 1.2s ease-in-out infinite',
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
    </span>
  );
}

function LoadingState() {
  return (
    <div style={{ padding: 60, textAlign: 'center', fontFamily: 'DM Mono, monospace',
      fontSize: 14, color: 'rgba(26,21,16,0.4)', letterSpacing: '0.08em' }}>
      Loading universe…
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div style={{ padding: 60, textAlign: 'center' }}>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 14,
        color: '#B85C38', marginBottom: 12 }}>
        Could not load universe data.
      </div>
      <button style={s.secondaryBtn} onClick={onRetry}>Retry</button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
//  STYLES — Light Theme (parchment design system)
// ══════════════════════════════════════════════════════════════════════════

const s = {
  shell: {
    minHeight: '100vh',
    background: '#faf9f7',
    color: 'rgba(26,21,16,0.85)',
    fontFamily: "'DM Sans', sans-serif",
  },
  pageHeader: {
    padding: '36px 48px 0',
    borderBottom: '1px solid rgba(201,168,76,0.18)',
    paddingBottom: 24,
  },
  pageLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    letterSpacing: '0.22em',
    color: '#C9A84C',
    marginBottom: 6,
  },
  pageTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 36,
    fontStyle: 'italic',
    color: 'rgba(26,21,16,0.92)',
    fontWeight: 400,
    margin: 0,
    marginBottom: 4,
  },
  pageSlug: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 13,
    color: 'rgba(26,21,16,0.35)',
    letterSpacing: '0.1em',
  },
  tabBar: {
    display: 'flex',
    gap: 0,
    padding: '0 48px',
    borderBottom: '1px solid rgba(201,168,76,0.15)',
  },
  tabBtn: {
    background: 'none',
    border: 'none',
    fontFamily: 'DM Mono, monospace',
    fontSize: 14,
    letterSpacing: '0.1em',
    padding: '16px 24px',
    cursor: 'pointer',
    transition: 'color 0.15s',
  },
  tabContent: {
    padding: '0 48px',
    maxWidth: 900,
  },
  tabShell: {
    paddingTop: 28,
    paddingBottom: 60,
  },
  actionsBar: {
    display: 'flex',
    gap: 10,
    marginBottom: 28,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  formShell: {
    maxWidth: 720,
  },
  previewShell: {
    maxWidth: 720,
  },
  previewTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 28,
    fontStyle: 'italic',
    color: '#C9A84C',
    fontWeight: 400,
    marginBottom: 24,
  },
  previewSection: {
    marginBottom: 28,
  },
  previewLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    letterSpacing: '0.18em',
    color: 'rgba(26,21,16,0.45)',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  previewBody: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 16,
    lineHeight: 1.75,
    color: 'rgba(26,21,16,0.75)',
    whiteSpace: 'pre-wrap',
  },
  themeChip: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    color: 'rgba(161,128,46,0.85)',
    background: 'rgba(201,168,76,0.12)',
    borderRadius: 3,
    padding: '4px 10px',
    letterSpacing: '0.06em',
  },
  fieldLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    letterSpacing: '0.14em',
    color: 'rgba(26,21,16,0.5)',
    textTransform: 'uppercase',
  },
  fieldHint: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    color: 'rgba(26,21,16,0.35)',
    letterSpacing: '0.06em',
  },
  input: {
    background: '#f5f0e8',
    border: '1px solid rgba(26,21,16,0.1)',
    borderRadius: 3,
    fontFamily: "'Playfair Display', serif",
    fontSize: 15,
    color: 'rgba(26,21,16,0.85)',
    padding: '12px 14px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  textarea: {
    background: '#f5f0e8',
    border: '1px solid rgba(26,21,16,0.1)',
    borderRadius: 3,
    fontFamily: "'Playfair Display', serif",
    fontSize: 15,
    color: 'rgba(26,21,16,0.8)',
    padding: '12px 14px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    resize: 'vertical',
    lineHeight: 1.65,
  },
  primaryBtn: {
    background: '#C9A84C',
    border: 'none',
    borderRadius: 3,
    fontFamily: 'DM Mono, monospace',
    fontSize: 13,
    letterSpacing: '0.1em',
    color: '#14100c',
    fontWeight: 600,
    padding: '10px 22px',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  secondaryBtn: {
    background: 'none',
    border: '1px solid rgba(26,21,16,0.18)',
    borderRadius: 3,
    fontFamily: 'DM Mono, monospace',
    fontSize: 13,
    letterSpacing: '0.08em',
    color: 'rgba(26,21,16,0.55)',
    padding: '10px 18px',
    cursor: 'pointer',
    transition: 'all 0.12s',
  },
  deleteBtn: {
    background: 'none',
    border: '1px solid rgba(184,92,56,0.25)',
    borderRadius: 3,
    color: 'rgba(184,92,56,0.65)',
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'DM Mono, monospace',
  },
  microBtn: {
    background: 'none',
    border: '1px solid rgba(26,21,16,0.15)',
    borderRadius: 3,
    color: 'rgba(26,21,16,0.55)',
    padding: '5px 9px',
    cursor: 'pointer',
    fontFamily: 'DM Mono, monospace',
    fontSize: 13,
  },
  sectionLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    letterSpacing: '0.18em',
    color: 'rgba(26,21,16,0.4)',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  // Series tab
  createCard: {
    background: 'rgba(201,168,76,0.06)',
    border: '1px solid rgba(201,168,76,0.2)',
    borderRadius: 3,
    padding: '18px 20px',
    marginBottom: 24,
  },
  seriesCard: {
    background: 'rgba(26,21,16,0.02)',
    border: '1px solid rgba(201,168,76,0.18)',
    borderRadius: 3,
    padding: '18px 20px',
    marginBottom: 16,
  },
  seriesHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  seriesName: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 22,
    fontStyle: 'italic',
    color: 'rgba(26,21,16,0.88)',
    marginBottom: 4,
  },
  seriesDesc: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 13,
    color: 'rgba(26,21,16,0.45)',
    letterSpacing: '0.02em',
    lineHeight: 1.6,
    maxWidth: 560,
  },
  bookList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    paddingTop: 8,
    borderTop: '1px solid rgba(26,21,16,0.06)',
  },
  bookRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    flexWrap: 'wrap',
    gap: 8,
  },
  bookRowLeft: {
    flex: 1,
  },
  bookRowRight: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    flex: '1 1 180px',
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  bookRowTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 16,
    color: 'rgba(26,21,16,0.78)',
    marginBottom: 3,
  },
  bookRowMeta: {
    display: 'flex',
    gap: 6,
  },
  metaChip: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    letterSpacing: '0.04em',
    color: '#C9A84C',
    background: 'rgba(201,168,76,0.1)',
    borderRadius: 3,
    padding: '3px 8px',
  },
  eraBtn: {
    background: 'none',
    border: '1px solid rgba(26,21,16,0.12)',
    borderRadius: 3,
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    color: 'rgba(26,21,16,0.45)',
    padding: '5px 10px',
    cursor: 'pointer',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
    flex: '0 1 auto',
  },
  emptyBooks: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 13,
    color: 'rgba(26,21,16,0.35)',
    paddingTop: 10,
    letterSpacing: '0.04em',
  },
  assignSelect: {
    background: '#f5f0e8',
    border: '1px solid rgba(201,168,76,0.3)',
    borderRadius: 3,
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    color: 'rgba(26,21,16,0.65)',
    padding: '5px 8px',
    cursor: 'pointer',
    letterSpacing: '0.04em',
    outline: 'none',
    maxWidth: 160,
    minWidth: 0,
    flex: '1 1 auto',
  },
  moveBtn: {
    background: 'none',
    border: '1px solid rgba(26,21,16,0.1)',
    borderRadius: 3,
    fontFamily: 'DM Mono, monospace',
    fontSize: 14,
    color: 'rgba(26,21,16,0.35)',
    padding: '4px 8px',
    cursor: 'pointer',
    transition: 'all 0.12s',
  },
  // Shows tab
  showCard: {
    background: 'rgba(26,21,16,0.02)',
    border: '1px solid rgba(74,124,89,0.2)',
    borderRadius: 3,
    padding: '18px 20px',
    marginBottom: 16,
  },
  showHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  showName: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 22,
    fontStyle: 'italic',
    color: 'rgba(26,21,16,0.88)',
    marginBottom: 4,
  },
  showEra: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    color: '#4A7C59',
    letterSpacing: '0.06em',
  },
  showDesc: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 14,
    color: 'rgba(26,21,16,0.5)',
    lineHeight: 1.7,
    marginTop: 10,
    letterSpacing: '0.02em',
  },
  emptyState: {
    paddingTop: 40,
    textAlign: 'center',
  },
  emptyTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 20,
    fontStyle: 'italic',
    color: 'rgba(26,21,16,0.5)',
    marginBottom: 10,
  },
  emptyHint: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 13,
    color: 'rgba(26,21,16,0.35)',
    letterSpacing: '0.04em',
  },
  // Timeline
  timelineBlock: {
    marginTop: 40,
    paddingTop: 28,
    borderTop: '1px solid rgba(201,168,76,0.15)',
  },
  timelineStrip: {
    display: 'flex',
    gap: 0,
    overflowX: 'auto',
    paddingBottom: 8,
  },
  timelineItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    minWidth: 120,
    padding: '0 12px',
    borderRight: '1px solid rgba(26,21,16,0.06)',
    position: 'relative',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  timelineItemLabel: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 14,
    fontStyle: 'italic',
    color: 'rgba(26,21,16,0.7)',
    textAlign: 'center',
    lineHeight: 1.3,
  },
  timelineItemEra: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    color: '#C9A84C',
    letterSpacing: '0.04em',
    textAlign: 'center',
  },
  timelineItemPos: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 11,
    color: 'rgba(26,21,16,0.3)',
    letterSpacing: '0.04em',
    textAlign: 'center',
  },
  // Modal
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.25)',
    backdropFilter: 'blur(4px)',
    zIndex: 400,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    background: '#faf9f7',
    border: '1px solid rgba(201,168,76,0.25)',
    borderRadius: 4,
    width: 580,
    maxWidth: '100%',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '20px 24px 16px',
    borderBottom: '1px solid rgba(201,168,76,0.15)',
    flexShrink: 0,
  },
  modalLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 12,
    letterSpacing: '0.18em',
    color: '#C9A84C',
    marginBottom: 4,
  },
  modalTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 22,
    fontStyle: 'italic',
    color: 'rgba(26,21,16,0.88)',
  },
  modalBody: {
    padding: '18px 24px',
    overflowY: 'auto',
    flex: 1,
  },
  modalHint: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 13,
    color: 'rgba(26,21,16,0.45)',
    letterSpacing: '0.02em',
    lineHeight: 1.7,
    marginBottom: 14,
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    padding: '14px 24px',
    borderTop: '1px solid rgba(201,168,76,0.12)',
    flexShrink: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(26,21,16,0.35)',
    fontSize: 15,
    cursor: 'pointer',
    padding: 4,
  },
  toast: {
    position: 'fixed',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    color: 'white',
    fontFamily: 'DM Mono, monospace',
    fontSize: 14,
    padding: '12px 24px',
    borderRadius: 3,
    letterSpacing: '0.06em',
    zIndex: 500,
    whiteSpace: 'nowrap',
  },
};
