/**
 * LalaSceneDetection.jsx
 * frontend/src/components/LalaSceneDetection.jsx
 *
 * Displays all lala_emergence_scenes for a book.
 * Shown in the Book Editor as a "✦ Lala" tab.
 */

import { useState, useEffect } from 'react';
import api from '../services/api';

const LALA_API = '/api/v1/lala-scenes';

const CANON_TIERS = [
  { value: 'proto',   label: 'Proto',   desc: 'First glimpse — a thought, a voice',  color: '#C9A84C' },
  { value: 'named',   label: 'Named',   desc: 'Lala gets a name',                    color: '#A78BFA' },
  { value: 'speaks',  label: 'Speaks',  desc: 'Lala has a full line of dialogue',     color: '#60A5FA' },
  { value: 'arrives', label: 'Arrives', desc: 'Lala becomes a character',             color: '#34D399' },
];

export default function LalaSceneDetection({ bookId }) {
  const [scenes,     setScenes]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [backfilling, setBackfilling] = useState(false);
  const [toast,      setToast]      = useState(null);
  const [expanded,   setExpanded]   = useState(null);

  useEffect(() => {
    if (bookId) load();
  }, [bookId]);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }

  async function load() {
    setLoading(true);
    try {
      const res  = await api.get(`${LALA_API}/book/${bookId}`);
      setScenes(res.data?.scenes || []);
    } catch (err) {
      console.error('LalaSceneDetection load error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function backfill() {
    setBackfilling(true);
    try {
      const res  = await api.post(`${LALA_API}/backfill/${bookId}`);
      const data = res.data;

      if (data.logged > 0) {
        showToast(`✦ ${data.logged} Lala moment${data.logged > 1 ? 's' : ''} logged`);
        await load();
      } else if (data.detected > 0) {
        showToast(`Already logged — ${data.detected} moment${data.detected > 1 ? 's' : ''} on record`);
      } else {
        showToast('No Lala lines detected in current manuscript', 'info');
      }
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error');
    } finally {
      setBackfilling(false);
    }
  }

  async function updateScene(sceneId, updates) {
    try {
      const res  = await api.put(`${LALA_API}/${sceneId}`, updates);
      const data = res.data;

      setScenes(prev => prev.map(s =>
        s.id === sceneId ? { ...s, ...data.scene } : s
      ));

      if (updates.confirmed) showToast('✦ Moment confirmed as canonical');
      if (updates.franchise_anchor) showToast('✦ Franchise anchor set');
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error');
    }
  }

  const confirmed   = scenes.filter(s => s.confirmed);
  const unconfirmed = scenes.filter(s => !s.confirmed);

  return (
    <div style={s.shell}>

      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.headerLabel}>LALA EMERGENCE</div>
          <div style={s.headerSub}>
            {scenes.length === 0
              ? 'No moments logged yet'
              : `${scenes.length} moment${scenes.length > 1 ? 's' : ''} · ${confirmed.length} confirmed`
            }
          </div>
        </div>
        <button
          style={{ ...s.backfillBtn, opacity: backfilling ? 0.6 : 1 }}
          onClick={backfill}
          disabled={backfilling}
          type='button'
        >
          {backfilling ? 'Scanning…' : 'Scan manuscript'}
        </button>
      </div>

      {/* Empty state */}
      {!loading && scenes.length === 0 && (
        <div style={s.emptyState}>
          <div style={s.emptyGlyph}>✦</div>
          <div style={s.emptyText}>
            No Lala moments logged yet.
          </div>
          <div style={s.emptySub}>
            Click "Scan manuscript" to detect Lala's voice in your approved lines. The Chapter 1 moment will be found.
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={s.loadingRow}>
          <div style={s.loadingDot} />
          <div style={s.loadingDot} />
          <div style={s.loadingDot} />
        </div>
      )}

      {/* Unconfirmed scenes */}
      {unconfirmed.length > 0 && (
        <div style={s.group}>
          <div style={s.groupLabel}>PENDING REVIEW</div>
          {unconfirmed.map(scene => (
            <SceneCard
              key={scene.id}
              scene={scene}
              expanded={expanded === scene.id}
              onExpand={() => setExpanded(expanded === scene.id ? null : scene.id)}
              onUpdate={(updates) => updateScene(scene.id, updates)}
            />
          ))}
        </div>
      )}

      {/* Confirmed scenes */}
      {confirmed.length > 0 && (
        <div style={s.group}>
          <div style={s.groupLabel}>CONFIRMED CANONICAL</div>
          {confirmed.map(scene => (
            <SceneCard
              key={scene.id}
              scene={scene}
              expanded={expanded === scene.id}
              onExpand={() => setExpanded(expanded === scene.id ? null : scene.id)}
              onUpdate={(updates) => updateScene(scene.id, updates)}
            />
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          ...s.toast,
          background: toast.type === 'error' ? '#B85C38'
                    : toast.type === 'info'  ? '#4A6B8B'
                    : '#4A7C59',
        }}>
          {toast.msg}
        </div>
      )}

    </div>
  );
}

// ── Scene Card ─────────────────────────────────────────────────────────────

function SceneCard({ scene, expanded, onExpand, onUpdate }) {
  const [notes,    setNotes]    = useState(scene.notes    || '');
  const [context,  setContext]  = useState(scene.emotional_context || '');
  const [tier,     setTier]     = useState(scene.canon_tier || 'proto');
  const [savingNotes, setSavingNotes] = useState(false);

  const tierInfo = CANON_TIERS.find(t => t.value === tier) || CANON_TIERS[0];
  const preview  = (scene.line_content || '').slice(0, 100);

  async function saveNotes() {
    setSavingNotes(true);
    await onUpdate({ notes, emotional_context: context, canon_tier: tier });
    setSavingNotes(false);
  }

  return (
    <div style={{
      ...sc.card,
      borderLeft: `3px solid ${scene.confirmed ? '#C9A84C' : 'rgba(201,168,76,0.25)'}`,
    }}>

      {/* Card header */}
      <div style={sc.cardHeader} onClick={onExpand}>
        <div style={sc.cardHeaderLeft}>
          <div style={{ ...sc.tierBadge, color: tierInfo.color, borderColor: `${tierInfo.color}30` }}>
            {tierInfo.label}
          </div>
          {scene.franchise_anchor && (
            <div style={sc.anchorBadge}>⚓ Anchor</div>
          )}
        </div>
        <div style={sc.cardMeta}>
          <span style={sc.chapterRef}>
            {scene.chapter_title || 'Chapter'}{scene.line_order != null ? ` · line ${scene.line_order + 1}` : ''}
          </span>
          <span style={sc.expandBtn}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Line preview */}
      <div style={sc.linePreview}>
        "{preview}{scene.line_content?.length > 100 ? '…' : ''}"
      </div>

      {/* Status row */}
      <div style={sc.statusRow}>
        <span style={{
          ...sc.statusBadge,
          background: scene.confirmed ? 'rgba(201,168,76,0.08)' : 'rgba(255,255,255,0.04)',
          color: scene.confirmed ? '#C9A84C' : 'rgba(245,240,232,0.3)',
          borderColor: scene.confirmed ? 'rgba(201,168,76,0.25)' : 'rgba(245,240,232,0.1)',
        }}>
          {scene.confirmed ? '✦ Confirmed' : '○ Pending'}
        </span>
        <span style={sc.detectionMethod}>
          {scene.detection_method === 'backfill' ? 'retroactive' : scene.detection_method}
        </span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={sc.expandedBody}>
          <div style={sc.fullLineLabel}>Full line</div>
          <div style={sc.fullLine}>{scene.line_content}</div>

          <div style={sc.fieldLabel}>Emotional context</div>
          <textarea
            style={sc.textarea}
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="What's happening in the manuscript at this moment? What pushed Lala's voice through?"
            rows={3}
          />

          <div style={sc.fieldLabel}>Canon tier</div>
          <div style={sc.tierRow}>
            {CANON_TIERS.map(t => (
              <button
                key={t.value}
                style={{
                  ...sc.tierBtn,
                  borderColor: tier === t.value ? t.color : 'rgba(245,240,232,0.1)',
                  color:       tier === t.value ? t.color : 'rgba(245,240,232,0.35)',
                  background:  tier === t.value ? `${t.color}10` : 'transparent',
                }}
                onClick={() => setTier(t.value)}
                type='button'
              >
                {t.label}
              </button>
            ))}
          </div>
          <div style={sc.tierDesc}>{tierInfo.desc}</div>

          <div style={sc.fieldLabel}>Notes</div>
          <textarea
            style={sc.textarea}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any notes on this moment for the franchise record…"
            rows={2}
          />

          <div style={sc.actions}>
            <button
              style={{ ...sc.saveBtn, opacity: savingNotes ? 0.6 : 1 }}
              onClick={saveNotes}
              disabled={savingNotes}
              type='button'
            >
              {savingNotes ? 'Saving…' : 'Save notes'}
            </button>

            {!scene.confirmed && (
              <button
                style={sc.confirmBtn}
                onClick={() => onUpdate({ confirmed: true })}
                type='button'
              >
                ✦ Confirm as canonical
              </button>
            )}

            {scene.confirmed && !scene.franchise_anchor && (
              <button
                style={sc.anchorBtn}
                onClick={() => onUpdate({ franchise_anchor: true })}
                type='button'
              >
                ⚓ Set franchise anchor
              </button>
            )}

            {scene.confirmed && scene.franchise_anchor && (
              <div style={sc.anchorSet}>
                ⚓ Franchise anchor — locked
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const GOLD  = '#C9A84C';

const s = {
  shell: {
    display:       'flex',
    flexDirection: 'column',
    gap:           0,
    padding:       '0 0 32px',
    position:      'relative',
  },
  header: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    padding:        '16px 16px 12px',
    borderBottom:   '1px solid rgba(201,168,76,0.1)',
    marginBottom:   8,
  },
  headerLeft: {
    display:       'flex',
    flexDirection: 'column',
    gap:           3,
  },
  headerLabel: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      8,
    letterSpacing: '0.22em',
    color:         GOLD,
  },
  headerSub: {
    fontFamily: 'DM Mono, monospace',
    fontSize:   9,
    color:      'rgba(245,240,232,0.25)',
  },
  backfillBtn: {
    background:    'rgba(201,168,76,0.07)',
    border:        '1px solid rgba(201,168,76,0.2)',
    borderRadius:  3,
    fontFamily:    'DM Mono, monospace',
    fontSize:      8,
    letterSpacing: '0.1em',
    color:         GOLD,
    padding:       '6px 12px',
    cursor:        'pointer',
    transition:    'opacity 0.12s',
  },
  emptyState: {
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    gap:           8,
    padding:       '40px 24px',
    textAlign:     'center',
  },
  emptyGlyph: {
    fontSize: 24,
    color:    'rgba(201,168,76,0.3)',
  },
  emptyText: {
    fontFamily:    "'Playfair Display', serif",
    fontSize:      14,
    fontStyle:     'italic',
    color:         'rgba(245,240,232,0.4)',
  },
  emptySub: {
    fontFamily:  'DM Mono, monospace',
    fontSize:    9,
    color:       'rgba(245,240,232,0.2)',
    lineHeight:  1.6,
    letterSpacing: '0.04em',
    maxWidth:    260,
  },
  loadingRow: {
    display:        'flex',
    justifyContent: 'center',
    gap:            6,
    padding:        '32px 0',
  },
  loadingDot: {
    width:        5,
    height:       5,
    borderRadius: '50%',
    background:   'rgba(201,168,76,0.4)',
  },
  group: {
    padding: '8px 0 0',
  },
  groupLabel: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      7,
    letterSpacing: '0.22em',
    color:         'rgba(245,240,232,0.2)',
    padding:       '4px 16px 8px',
  },
  toast: {
    position:  'fixed',
    bottom:    24,
    right:     24,
    color:     '#fff',
    fontSize:  11,
    fontFamily: 'DM Mono, monospace',
    letterSpacing: '0.06em',
    fontWeight: 600,
    padding:   '9px 16px',
    borderRadius: 3,
    zIndex:    9999,
    pointerEvents: 'none',
  },
};

const sc = {
  card: {
    margin:        '0 12px 8px',
    background:    'rgba(255,255,255,0.02)',
    border:        '1px solid rgba(245,240,232,0.06)',
    borderRadius:  4,
    overflow:      'hidden',
  },
  cardHeader: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'center',
    padding:        '10px 12px 6px',
    cursor:         'pointer',
  },
  cardHeaderLeft: {
    display: 'flex',
    gap:     6,
    alignItems: 'center',
  },
  tierBadge: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      8,
    letterSpacing: '0.14em',
    border:        '1px solid',
    borderRadius:  2,
    padding:       '2px 7px',
  },
  anchorBadge: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      8,
    letterSpacing: '0.08em',
    color:         'rgba(245,240,232,0.35)',
    border:        '1px solid rgba(245,240,232,0.1)',
    borderRadius:  2,
    padding:       '2px 7px',
  },
  cardMeta: {
    display:     'flex',
    alignItems:  'center',
    gap:         8,
  },
  chapterRef: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      8,
    color:         'rgba(245,240,232,0.25)',
    letterSpacing: '0.06em',
  },
  expandBtn: {
    fontFamily: 'DM Mono, monospace',
    fontSize:   8,
    color:      'rgba(245,240,232,0.2)',
  },
  linePreview: {
    fontFamily:  "'Playfair Display', serif",
    fontSize:    12,
    fontStyle:   'italic',
    color:       GOLD,
    padding:     '2px 12px 8px',
    lineHeight:  1.5,
    opacity:     0.85,
  },
  statusRow: {
    display:     'flex',
    alignItems:  'center',
    gap:         8,
    padding:     '0 12px 10px',
  },
  statusBadge: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      7,
    letterSpacing: '0.12em',
    border:        '1px solid',
    borderRadius:  2,
    padding:       '2px 7px',
  },
  detectionMethod: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      7,
    color:         'rgba(245,240,232,0.15)',
    letterSpacing: '0.06em',
  },
  expandedBody: {
    borderTop: '1px solid rgba(245,240,232,0.06)',
    padding:   '12px 12px 14px',
    display:   'flex',
    flexDirection: 'column',
    gap:       10,
  },
  fullLineLabel: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      7,
    letterSpacing: '0.18em',
    color:         'rgba(245,240,232,0.2)',
  },
  fullLine: {
    fontFamily:  "'Playfair Display', serif",
    fontSize:    13,
    fontStyle:   'italic',
    color:       GOLD,
    lineHeight:  1.6,
    padding:     '6px 10px',
    background:  'rgba(201,168,76,0.04)',
    border:      '1px solid rgba(201,168,76,0.1)',
    borderRadius: 3,
  },
  fieldLabel: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      7,
    letterSpacing: '0.18em',
    color:         'rgba(245,240,232,0.2)',
    marginTop:     2,
  },
  textarea: {
    background:  'rgba(255,255,255,0.04)',
    border:      '1px solid rgba(245,240,232,0.1)',
    borderRadius: 3,
    fontFamily:  'DM Mono, monospace',
    fontSize:    9,
    letterSpacing: '0.03em',
    color:       'rgba(245,240,232,0.7)',
    padding:     '8px 10px',
    lineHeight:  1.5,
    resize:      'vertical',
    outline:     'none',
    width:       '100%',
    boxSizing:   'border-box',
  },
  tierRow: {
    display: 'flex',
    gap:     6,
    flexWrap: 'wrap',
  },
  tierBtn: {
    background:    'transparent',
    border:        '1px solid',
    borderRadius:  2,
    fontFamily:    'DM Mono, monospace',
    fontSize:      8,
    letterSpacing: '0.1em',
    padding:       '4px 10px',
    cursor:        'pointer',
    transition:    'all 0.12s',
  },
  tierDesc: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      8,
    color:         'rgba(245,240,232,0.2)',
    letterSpacing: '0.04em',
    marginTop:     -4,
  },
  actions: {
    display:   'flex',
    gap:       8,
    flexWrap:  'wrap',
    marginTop: 4,
    paddingTop: 8,
    borderTop: '1px solid rgba(245,240,232,0.06)',
  },
  saveBtn: {
    background:    'none',
    border:        '1px solid rgba(245,240,232,0.15)',
    borderRadius:  3,
    fontFamily:    'DM Mono, monospace',
    fontSize:      8,
    letterSpacing: '0.1em',
    color:         'rgba(245,240,232,0.4)',
    padding:       '6px 12px',
    cursor:        'pointer',
    transition:    'opacity 0.12s',
  },
  confirmBtn: {
    background:    'rgba(201,168,76,0.1)',
    border:        '1px solid rgba(201,168,76,0.3)',
    borderRadius:  3,
    fontFamily:    'DM Mono, monospace',
    fontSize:      8,
    letterSpacing: '0.1em',
    color:         GOLD,
    padding:       '6px 14px',
    cursor:        'pointer',
  },
  anchorBtn: {
    background:    'rgba(255,255,255,0.04)',
    border:        '1px solid rgba(245,240,232,0.15)',
    borderRadius:  3,
    fontFamily:    'DM Mono, monospace',
    fontSize:      8,
    letterSpacing: '0.08em',
    color:         'rgba(245,240,232,0.4)',
    padding:       '6px 12px',
    cursor:        'pointer',
  },
  anchorSet: {
    fontFamily:    'DM Mono, monospace',
    fontSize:      8,
    letterSpacing: '0.1em',
    color:         'rgba(245,240,232,0.25)',
    padding:       '6px 0',
    alignSelf:     'center',
  },
};
