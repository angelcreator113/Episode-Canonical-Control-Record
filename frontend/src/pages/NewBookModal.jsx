/**
 * NewBookModal.jsx
 * frontend/src/pages/NewBookModal.jsx
 *
 * Literary-first book creation modal.
 * Shows the LalaVerse north star while you fill in literary fields.
 *
 * Usage:
 *   import NewBookModal from './NewBookModal';
 *   <NewBookModal
 *     open={showCreate}
 *     onClose={() => setShowCreate(false)}
 *     showId={currentShow?.id}
 *     onBookCreated={(book) => { ... }}
 *   />
 */

import { useState, useEffect } from 'react';

const UNIVERSE_API    = '/api/v1/universe';
const STORYTELLER_API = '/api/v1/storyteller';

const POV_OPTIONS = [
  { value: 'first_person',  label: 'First Person',        note: 'Raw · intimate · confessional' },
  { value: 'close_third',   label: 'Close Third Person',  note: 'Literary distance · reflection' },
  { value: 'multi_pov',     label: 'Multi-POV',           note: 'Multiple perspectives' },
];

const TIMELINE_OPTIONS = [
  'Pre-Show',
  'Early Show',
  'Soft Luxury Era',
  'Prime Era',
  'Legacy Era',
];

const CANON_OPTIONS = [
  { value: 'draft',  label: 'Draft',  color: '#C9A84C', note: 'In progress · not locked' },
  { value: 'active', label: 'Active', color: '#4A7C59', note: 'Being written · canon building' },
  { value: 'locked', label: 'Locked', color: '#7B5EA7', note: 'Complete · immutable canon' },
];

export default function NewBookModal({ open, onClose, showId, onBookCreated }) {
  const [series, setSeries]     = useState([]);
  const [universe, setUniverse] = useState(null);
  const [form, setForm]         = useState({
    title:             '',
    series_id:         '',
    pov:               'first_person',
    era_name:          '',
    timeline_position: 'Pre-Show',
    canon_status:      'draft',
    description:       '',
  });
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);

  // ── Load series list + universe on open ───────────────────────────────
  useEffect(() => {
    if (!open) return;
    fetch(`${UNIVERSE_API}/series`)
      .then(r => r.json())
      .then(data => {
        const list = data.series || [];
        setSeries(list);
        // Pre-select Becoming Prime if present
        const becomingPrime = list.find(s =>
          s.name.toLowerCase().includes('becoming') ||
          s.name.toLowerCase().includes('prime')
        );
        if (becomingPrime) {
          setForm(prev => ({ ...prev, series_id: becomingPrime.id }));
          if (becomingPrime.universe_id) {
            fetch(`${UNIVERSE_API}/${becomingPrime.universe_id}`)
              .then(r => r.json())
              .then(d => setUniverse(d.universe))
              .catch(() => {});
          }
        }
      })
      .catch(() => {});
  }, [open]);

  // ── When series changes, update universe preview ──────────────────────
  function handleSeriesChange(seriesId) {
    setForm(prev => ({ ...prev, series_id: seriesId }));
    const selected = series.find(s => s.id === seriesId);
    if (selected?.universe_id) {
      fetch(`${UNIVERSE_API}/${selected.universe_id}`)
        .then(r => r.json())
        .then(d => setUniverse(d.universe))
        .catch(() => {});
    }
  }

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    if (!form.title.trim()) {
      setError('Book title is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${STORYTELLER_API}/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          show_id:           showId,
          series_id:         form.series_id || null,
          title:             form.title.trim(),
          description:       form.description.trim() || null,
          primary_pov:       form.pov,
          era_name:          form.era_name.trim() || null,
          timeline_position: form.timeline_position,
          canon_status:      form.canon_status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create book');
      onBookCreated?.(data.book);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  if (!open) return null;

  return (
    <div style={styles.overlay} onClick={handleBackdrop}>
      <div style={styles.modal}>

        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.headerLabel}>NEW BOOK</div>
            <div style={styles.headerTitle}>Add to Canon</div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={styles.body}>

          {/* Universe north-star preview */}
          {universe && (
            <div style={styles.universePreview}>
              <div style={styles.previewLabel}>◈ {universe.name} — North Star</div>
              <div style={styles.previewText}>
                {universe.description?.split('\n')[0]}
              </div>
              {universe.core_themes?.length > 0 && (
                <div style={styles.themeRow}>
                  {universe.core_themes.slice(0, 5).map(t => (
                    <span key={t} style={styles.themeChip}>{t}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Series */}
          <div style={styles.field}>
            <label style={styles.label}>SERIES</label>
            <select
              style={styles.select}
              value={form.series_id}
              onChange={e => handleSeriesChange(e.target.value)}
            >
              <option value=''>— No series —</option>
              {series.map(sr => (
                <option key={sr.id} value={sr.id}>{sr.name}</option>
              ))}
            </select>
            {series.find(sr => sr.id === form.series_id)?.description && (
              <div style={styles.fieldHint}>
                {series.find(sr => sr.id === form.series_id).description}
              </div>
            )}
          </div>

          {/* Book Title */}
          <div style={styles.field}>
            <label style={styles.label}>BOOK TITLE <span style={{ color: '#B85C38' }}>*</span></label>
            <input
              style={styles.input}
              type='text'
              placeholder='e.g. Before Lala'
              value={form.title}
              onChange={e => set('title', e.target.value)}
              autoFocus
            />
          </div>

          {/* Primary POV */}
          <div style={styles.field}>
            <label style={styles.label}>PRIMARY POV</label>
            <div style={styles.optionRow}>
              {POV_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  style={{
                    ...styles.optionBtn,
                    ...(form.pov === opt.value ? styles.optionBtnActive : {}),
                  }}
                  onClick={() => set('pov', opt.value)}
                  type='button'
                >
                  <div style={styles.optionBtnLabel}>{opt.label}</div>
                  <div style={styles.optionBtnNote}>{opt.note}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Era Name + Timeline Position side by side */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ ...styles.field, flex: 1 }}>
              <label style={styles.label}>ERA NAME</label>
              <input
                style={styles.input}
                type='text'
                placeholder='e.g. Pre-Prime Era'
                value={form.era_name}
                onChange={e => set('era_name', e.target.value)}
              />
            </div>
            <div style={{ ...styles.field, flex: 1 }}>
              <label style={styles.label}>TIMELINE POSITION</label>
              <select
                style={styles.select}
                value={form.timeline_position}
                onChange={e => set('timeline_position', e.target.value)}
              >
                {TIMELINE_OPTIONS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Canon Status */}
          <div style={styles.field}>
            <label style={styles.label}>CANON STATUS</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {CANON_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  style={{
                    ...styles.canonBtn,
                    borderColor: form.canon_status === opt.value
                      ? opt.color
                      : 'rgba(245,240,232,0.1)',
                    color: form.canon_status === opt.value
                      ? opt.color
                      : 'rgba(245,240,232,0.35)',
                    background: form.canon_status === opt.value
                      ? `${opt.color}18`
                      : 'none',
                  }}
                  onClick={() => set('canon_status', opt.value)}
                  type='button'
                >
                  <div style={{ fontWeight: 500 }}>{opt.label}</div>
                  <div style={{ fontSize: 8, opacity: 0.7, marginTop: 2 }}>{opt.note}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Book Description */}
          <div style={styles.field}>
            <label style={styles.label}>BOOK DESCRIPTION</label>
            <div style={styles.descHint}>
              Emotional journey · character arc · timeline position. Not mechanics.
            </div>
            <textarea
              style={styles.textarea}
              placeholder='Before the world. Before the panels. Before the first episode. This is the story of JustAWoman — her failed ventures, her identity crisis, and the imagination that became the foundation of everything.'
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={4}
            />
          </div>

          {/* Error */}
          {error && <div style={styles.error}>{error}</div>}

        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button style={styles.cancelBtn} onClick={onClose} type='button'>
            Cancel
          </button>
          <button
            style={{
              ...styles.createBtn,
              opacity: saving ? 0.6 : 1,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
            onClick={handleSubmit}
            disabled={saving}
            type='button'
          >
            {saving ? 'Creating…' : '✦ Create Book'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(14,10,8,0.85)',
    backdropFilter: 'blur(4px)',
    zIndex: 300,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    background: '#1a1510',
    border: '1px solid rgba(201,168,76,0.2)',
    borderRadius: 4,
    width: 620,
    maxWidth: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '22px 28px 18px',
    borderBottom: '1px solid rgba(201,168,76,0.12)',
    flexShrink: 0,
  },
  headerLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    letterSpacing: '0.22em',
    color: '#C9A84C',
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 22,
    fontStyle: 'italic',
    color: 'rgba(245,240,232,0.9)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(245,240,232,0.3)',
    fontSize: 16,
    cursor: 'pointer',
    padding: 4,
    marginTop: 2,
  },
  body: {
    padding: '22px 28px',
    overflowY: 'auto',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  universePreview: {
    background: 'rgba(201,168,76,0.05)',
    border: '1px solid rgba(201,168,76,0.14)',
    borderRadius: 3,
    padding: '12px 14px',
  },
  previewLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    letterSpacing: '0.16em',
    color: '#C9A84C',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  previewText: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 12,
    fontStyle: 'italic',
    color: 'rgba(245,240,232,0.6)',
    lineHeight: 1.5,
    marginBottom: 8,
  },
  themeRow: {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap',
  },
  themeChip: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: 'rgba(201,168,76,0.6)',
    background: 'rgba(201,168,76,0.08)',
    borderRadius: 2,
    padding: '2px 6px',
    letterSpacing: '0.06em',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    letterSpacing: '0.16em',
    color: 'rgba(245,240,232,0.4)',
  },
  fieldHint: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: 'rgba(245,240,232,0.25)',
    lineHeight: 1.5,
    letterSpacing: '0.04em',
  },
  descHint: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: 'rgba(245,240,232,0.2)',
    letterSpacing: '0.06em',
    fontStyle: 'italic',
    marginTop: -2,
  },
  input: {
    background: 'rgba(245,240,232,0.05)',
    border: '1px solid rgba(245,240,232,0.1)',
    borderRadius: 2,
    fontFamily: "'Playfair Display', serif",
    fontSize: 15,
    color: 'rgba(245,240,232,0.85)',
    padding: '10px 12px',
    outline: 'none',
    transition: 'border-color 0.15s',
  },
  select: {
    background: 'rgba(245,240,232,0.05)',
    border: '1px solid rgba(245,240,232,0.1)',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    color: 'rgba(245,240,232,0.7)',
    padding: '9px 10px',
    cursor: 'pointer',
    outline: 'none',
  },
  textarea: {
    background: 'rgba(245,240,232,0.05)',
    border: '1px solid rgba(245,240,232,0.1)',
    borderRadius: 2,
    fontFamily: "'Playfair Display', serif",
    fontSize: 13,
    fontStyle: 'italic',
    color: 'rgba(245,240,232,0.75)',
    padding: '10px 12px',
    outline: 'none',
    resize: 'vertical',
    lineHeight: 1.6,
  },
  optionRow: {
    display: 'flex',
    gap: 8,
  },
  optionBtn: {
    flex: 1,
    background: 'rgba(245,240,232,0.03)',
    border: '1px solid rgba(245,240,232,0.1)',
    borderRadius: 2,
    padding: '10px 10px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.12s',
  },
  optionBtnActive: {
    background: 'rgba(201,168,76,0.1)',
    borderColor: 'rgba(201,168,76,0.4)',
  },
  optionBtnLabel: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    letterSpacing: '0.08em',
    color: 'rgba(245,240,232,0.8)',
    marginBottom: 3,
  },
  optionBtnNote: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 8,
    color: 'rgba(245,240,232,0.3)',
    letterSpacing: '0.04em',
  },
  canonBtn: {
    flex: 1,
    background: 'none',
    border: '1px solid',
    borderRadius: 2,
    padding: '8px 10px',
    cursor: 'pointer',
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    letterSpacing: '0.08em',
    textAlign: 'left',
    transition: 'all 0.12s',
  },
  error: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 9,
    color: '#B85C38',
    background: 'rgba(184,92,56,0.08)',
    border: '1px solid rgba(184,92,56,0.2)',
    borderRadius: 2,
    padding: '8px 12px',
    letterSpacing: '0.04em',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    padding: '16px 28px',
    borderTop: '1px solid rgba(201,168,76,0.1)',
    flexShrink: 0,
  },
  cancelBtn: {
    background: 'none',
    border: '1px solid rgba(245,240,232,0.1)',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    letterSpacing: '0.1em',
    color: 'rgba(245,240,232,0.4)',
    padding: '9px 18px',
    cursor: 'pointer',
  },
  createBtn: {
    background: '#C9A84C',
    border: 'none',
    borderRadius: 2,
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    letterSpacing: '0.12em',
    color: '#14100c',
    fontWeight: 600,
    padding: '9px 22px',
    transition: 'opacity 0.15s',
  },
};
