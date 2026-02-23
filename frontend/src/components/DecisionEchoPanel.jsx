/**
 * DecisionEchoPanel.jsx
 * frontend/src/components/DecisionEchoPanel.jsx
 *
 * DECISION ECHO — plant now, surface later
 *
 * An echo is a moment planted in one chapter that must reverberate in
 * a later one. The reader won't name it. They'll just feel the story
 * knew where it was going.
 */

import { useState } from 'react';

const ECHOES_API = '/api/v1/storyteller/echoes';

// ════════════════════════════════════════════════════════════════════════
// PLANT ECHO BUTTON — shows on line action row
// ════════════════════════════════════════════════════════════════════════

export function PlantEchoButton({ line, chapters = [], bookId, onPlanted }) {
  const [open,        setOpen]        = useState(false);
  const [targetChapter, setTargetChapter] = useState('');
  const [note,        setNote]        = useState('');
  const [landingNote, setLandingNote] = useState('');
  const [saving,      setSaving]      = useState(false);

  async function handlePlant() {
    if (!targetChapter || !note.trim()) return;
    setSaving(true);
    try {
      await fetch(ECHOES_API, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id:                bookId,
          source_line_id:         line.id,
          source_line_content:    line.content,
          source_chapter_id:      line.chapter_id,
          target_chapter_id:      targetChapter,
          note:                   note.trim(),
          landing_note:           landingNote.trim() || null,
          status:                 'planted',
        }),
      });
      setOpen(false);
      setNote('');
      setLandingNote('');
      setTargetChapter('');
      onPlanted?.();
    } catch (err) {
      console.error('Failed to plant echo:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        style={st.plantBtn}
        onClick={() => setOpen(true)}
        title="This moment reverberates later \u2014 plant an echo"
      >
        \u27F3
      </button>

      {open && (
        <div style={st.plantOverlay} onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div style={st.plantModal}>
            <div style={st.plantHeader}>
              <div style={st.plantLabel}>PLANT ECHO</div>
              <button style={st.plantClose} onClick={() => setOpen(false)}>\u2715</button>
            </div>

            <div style={st.plantSourceLine}>
              "{line.content?.slice(0, 120)}{line.content?.length > 120 ? '\u2026' : ''}"
            </div>

            <div style={st.plantField}>
              <label style={st.fieldLabel}>REVERBERATES IN</label>
              <select
                style={st.select}
                value={targetChapter}
                onChange={e => setTargetChapter(e.target.value)}
              >
                <option value="">Select chapter\u2026</option>
                {chapters.map(ch => (
                  <option key={ch.id} value={ch.id}>{ch.title}</option>
                ))}
              </select>
            </div>

            <div style={st.plantField}>
              <label style={st.fieldLabel}>WHAT THIS PLANTS</label>
              <textarea
                style={st.textarea}
                placeholder="What moment, tension, or thread does this set up? e.g. 'The trust she builds here makes the betrayal in ch.7 land harder.'"
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={3}
              />
            </div>

            <div style={st.plantField}>
              <label style={st.fieldLabel}>HOW IT SHOULD LAND (optional)</label>
              <textarea
                style={st.textarea}
                placeholder="What should the reader feel when this echoes? e.g. 'A quiet recognition \u2014 not shock, just: of course.'"
                value={landingNote}
                onChange={e => setLandingNote(e.target.value)}
                rows={2}
              />
            </div>

            <div style={st.plantActions}>
              <button style={st.cancelBtn} onClick={() => setOpen(false)}>Cancel</button>
              <button
                style={{ ...st.confirmBtn, opacity: (!targetChapter || !note.trim() || saving) ? 0.5 : 1 }}
                onClick={handlePlant}
                disabled={!targetChapter || !note.trim() || saving}
              >
                {saving ? 'Planting\u2026' : 'Plant echo \u2192'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════
// INCOMING ECHOES — shows at top of chapter brief
// ════════════════════════════════════════════════════════════════════════

export function IncomingEchoes({ echoes = [], onMarkLanded }) {
  const [expanded, setExpanded] = useState(true);

  if (echoes.length === 0) return null;

  const pending = echoes.filter(e => e.status !== 'landed');
  const landed  = echoes.filter(e => e.status === 'landed');

  return (
    <div style={st.incomingPanel}>
      <div style={st.incomingHeader} onClick={() => setExpanded(!expanded)}>
        <div style={st.incomingLeft}>
          <div style={st.incomingLabel}>\u27F3 INCOMING ECHOES</div>
          <div style={st.incomingCount}>
            {pending.length} pending{landed.length > 0 ? ` \u00B7 ${landed.length} landed` : ''}
          </div>
        </div>
        <div style={st.incomingCaret}>{expanded ? '\u25B2' : '\u25BC'}</div>
      </div>

      {expanded && (
        <div style={st.incomingList}>
          {pending.map(echo => (
            <EchoCard key={echo.id} echo={echo} onMarkLanded={onMarkLanded} />
          ))}
          {landed.length > 0 && (
            <div style={st.landedSection}>
              <div style={st.landedLabel}>LANDED</div>
              {landed.map(echo => (
                <EchoCard key={echo.id} echo={echo} isLanded />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EchoCard({ echo, onMarkLanded, isLanded }) {
  return (
    <div style={{ ...st.echoCard, opacity: isLanded ? 0.5 : 1 }}>
      <div style={st.echoMeta}>
        <div style={st.echoSource}>
          Planted in: <span style={{ color: '#C9A84C' }}>{echo.source_chapter_title || 'earlier chapter'}</span>
        </div>
        {!isLanded && (
          <button style={st.landBtn} onClick={() => onMarkLanded?.(echo.id)}>
            Mark landed
          </button>
        )}
      </div>
      <div style={st.echoLine}>
        "{echo.source_line_content?.slice(0, 100)}{echo.source_line_content?.length > 100 ? '\u2026' : ''}"
      </div>
      <div style={st.echoNote}>{echo.note}</div>
      {echo.landing_note && (
        <div style={st.echoLanding}>
          <span style={{ color: '#C9A84C', fontFamily: 'DM Mono, monospace', fontSize: 7, letterSpacing: '0.1em' }}>SHOULD LAND AS: </span>
          {echo.landing_note}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// ECHO HEALTH PANEL — book-level view of all planted echoes
// ════════════════════════════════════════════════════════════════════════

export function EchoHealthPanel({ echoes = [], chapters = [] }) {
  const planted = echoes.filter(e => e.status === 'planted');
  const landed  = echoes.filter(e => e.status === 'landed');
  const orphaned = echoes.filter(e =>
    e.status === 'planted' &&
    !chapters.find(ch => ch.id === e.target_chapter_id)
  );

  if (echoes.length === 0) return null;

  return (
    <div style={st.healthPanel}>
      <div style={st.healthLabel}>\u27F3 ECHO HEALTH</div>
      <div style={st.healthStats}>
        <div style={st.healthStat}>
          <div style={{ ...st.healthNum, color: '#C9A84C' }}>{planted.length}</div>
          <div style={st.healthStatLabel}>planted</div>
        </div>
        <div style={st.healthStat}>
          <div style={{ ...st.healthNum, color: '#4A7C59' }}>{landed.length}</div>
          <div style={st.healthStatLabel}>landed</div>
        </div>
        {orphaned.length > 0 && (
          <div style={st.healthStat}>
            <div style={{ ...st.healthNum, color: '#B85C38' }}>{orphaned.length}</div>
            <div style={st.healthStatLabel}>no target</div>
          </div>
        )}
      </div>
      {orphaned.length > 0 && (
        <div style={st.orphanWarning}>
          {orphaned.length} echo{orphaned.length > 1 ? 's' : ''} planted but target chapter hasn't been created yet.
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const st = {
  // Plant button — inline on line actions
  plantBtn: {
    background: 'none', border: '1px solid rgba(201,168,76,0.25)',
    borderRadius: 2, cursor: 'pointer',
    color: 'rgba(201,168,76,0.5)', fontSize: 11,
    width: 24, height: 24, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.12s', padding: 0,
  },

  // Plant modal
  plantOverlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(14,10,8,0.5)',
    backdropFilter: 'blur(4px)',
    zIndex: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24,
  },
  plantModal: {
    background: 'white',
    border: '1px solid rgba(201,168,76,0.2)',
    borderRadius: 3, padding: 20,
    width: 480, maxWidth: '100%',
    display: 'flex', flexDirection: 'column', gap: 14,
    boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
  },
  plantHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  plantLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    letterSpacing: '0.2em', color: '#C9A84C',
  },
  plantClose: {
    background: 'none', border: 'none',
    color: 'rgba(30,25,20,0.3)', fontSize: 14, cursor: 'pointer',
  },
  plantSourceLine: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 13, fontStyle: 'italic',
    color: 'rgba(30,25,20,0.6)', lineHeight: 1.6,
    borderLeft: '2px solid rgba(201,168,76,0.4)', paddingLeft: 10,
  },
  plantField: { display: 'flex', flexDirection: 'column', gap: 5 },
  fieldLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 7.5,
    letterSpacing: '0.15em', color: 'rgba(30,25,20,0.3)',
  },
  select: {
    border: '1px solid rgba(30,25,20,0.15)', borderRadius: 2,
    padding: '7px 10px',
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 13, color: 'rgba(30,25,20,0.75)',
    background: 'white', outline: 'none',
  },
  textarea: {
    border: '1px solid rgba(30,25,20,0.12)', borderRadius: 2,
    padding: '8px 10px', resize: 'vertical',
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 13, fontStyle: 'italic',
    color: 'rgba(30,25,20,0.75)', lineHeight: 1.6,
    outline: 'none', background: 'white',
  },
  plantActions: {
    display: 'flex', justifyContent: 'flex-end', gap: 8,
  },
  cancelBtn: {
    background: 'none', border: '1px solid rgba(30,25,20,0.12)',
    borderRadius: 2, cursor: 'pointer',
    fontFamily: 'DM Mono, monospace', fontSize: 9,
    letterSpacing: '0.1em', color: 'rgba(30,25,20,0.4)',
    padding: '8px 14px',
  },
  confirmBtn: {
    background: '#C9A84C', border: 'none', borderRadius: 2,
    cursor: 'pointer',
    fontFamily: 'DM Mono, monospace', fontSize: 9,
    letterSpacing: '0.1em', color: 'white', fontWeight: 600,
    padding: '8px 16px', transition: 'opacity 0.12s',
  },

  // Incoming echoes panel
  incomingPanel: {
    border: '1px solid rgba(201,168,76,0.2)',
    borderRadius: 3, overflow: 'hidden',
    background: 'rgba(201,168,76,0.03)',
    marginBottom: 12,
  },
  incomingHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 12px', cursor: 'pointer',
  },
  incomingLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  incomingLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    letterSpacing: '0.15em', color: '#C9A84C',
  },
  incomingCount: {
    fontFamily: 'DM Mono, monospace', fontSize: 7.5,
    color: 'rgba(30,25,20,0.35)', letterSpacing: '0.06em',
  },
  incomingCaret: {
    fontFamily: 'DM Mono, monospace', fontSize: 7,
    color: 'rgba(30,25,20,0.2)',
  },
  incomingList: {
    padding: '0 12px 12px',
    display: 'flex', flexDirection: 'column', gap: 8,
    borderTop: '1px solid rgba(201,168,76,0.1)',
    paddingTop: 10,
  },

  // Echo card
  echoCard: {
    display: 'flex', flexDirection: 'column', gap: 5,
    padding: '8px 10px',
    background: 'white', border: '1px solid rgba(201,168,76,0.12)',
    borderRadius: 2,
  },
  echoMeta: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  echoSource: {
    fontFamily: 'DM Mono, monospace', fontSize: 7.5,
    color: 'rgba(30,25,20,0.35)', letterSpacing: '0.05em',
  },
  landBtn: {
    background: 'none', border: '1px solid rgba(74,124,89,0.3)',
    borderRadius: 2, cursor: 'pointer',
    fontFamily: 'DM Mono, monospace', fontSize: 7,
    letterSpacing: '0.1em', color: '#4A7C59',
    padding: '2px 8px',
  },
  echoLine: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 12, fontStyle: 'italic',
    color: 'rgba(30,25,20,0.55)', lineHeight: 1.5,
    borderLeft: '2px solid rgba(201,168,76,0.3)', paddingLeft: 8,
  },
  echoNote: {
    fontFamily: 'DM Mono, monospace', fontSize: 8,
    color: 'rgba(30,25,20,0.5)', letterSpacing: '0.03em', lineHeight: 1.5,
  },
  echoLanding: {
    fontFamily: 'DM Mono, monospace', fontSize: 7.5,
    color: 'rgba(30,25,20,0.4)', letterSpacing: '0.04em', lineHeight: 1.5,
    borderTop: '1px solid rgba(201,168,76,0.1)', paddingTop: 5, marginTop: 2,
  },

  // Landed section
  landedSection: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 },
  landedLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 7,
    letterSpacing: '0.15em', color: '#4A7C59',
  },

  // Health panel
  healthPanel: {
    border: '1px solid rgba(201,168,76,0.12)',
    borderRadius: 2, padding: '10px 12px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  healthLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 7.5,
    letterSpacing: '0.15em', color: '#C9A84C',
  },
  healthStats: { display: 'flex', gap: 16 },
  healthStat: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  healthNum: {
    fontFamily: "'Lora', 'Playfair Display', serif",
    fontSize: 22, lineHeight: 1,
  },
  healthStatLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 7,
    letterSpacing: '0.1em', color: 'rgba(30,25,20,0.3)',
  },
  orphanWarning: {
    fontFamily: 'DM Mono, monospace', fontSize: 7.5,
    color: '#B85C38', letterSpacing: '0.04em', lineHeight: 1.5,
  },
};
