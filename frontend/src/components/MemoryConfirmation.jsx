/**
 * MemoryConfirmation.jsx
 *
 * Two parts:
 *   1. <MemoryCard />        — inline card that appears below an approved line
 *   2. <MemoryBankPanel />   — right-sidebar tab showing all memories for a book
 *
 * Usage in StorytellerPage.jsx:
 *
 *   import { MemoryCard, MemoryBankPanel } from './MemoryConfirmation';
 *
 *   // After a line is approved, trigger extraction and show the card:
 *   <MemoryCard
 *     lineId={line.id}
 *     characters={registryCharacters}   // array of { id, name, type }
 *     onConfirmed={(memory) => { ... }}
 *     onDismissed={(memoryId) => { ... }}
 *   />
 *
 *   // In the right panel:
 *   <MemoryBankPanel bookId={book.id} />
 */

import { useState, useEffect, useCallback } from 'react';

// ── Constants ──────────────────────────────────────────────────────────────

const API = '/api/v1/memories';

const TYPE_META = {
  goal:           { label: 'Goal',           color: '#4A7C59', bg: 'rgba(74,124,89,0.10)'   },
  preference:     { label: 'Preference',     color: '#2563A8', bg: 'rgba(37,99,168,0.10)'   },
  relationship:   { label: 'Relationship',   color: '#7B5EA7', bg: 'rgba(123,94,167,0.10)'  },
  belief:         { label: 'Belief',         color: '#C9A84C', bg: 'rgba(201,168,76,0.10)'  },
  event:          { label: 'Event',          color: '#5A6E3A', bg: 'rgba(90,110,58,0.10)'   },
  constraint:     { label: 'Constraint',     color: '#B85C38', bg: 'rgba(184,92,56,0.10)'   },
  transformation: { label: 'Transformation', color: '#2A7A6A', bg: 'rgba(42,122,106,0.10)'  },
};

const CHARACTER_TYPE_COLORS = {
  pressure: '#B85C38',
  mirror:   '#7B5EA7',
  support:  '#2A7A6A',
  shadow:   '#C97A2A',
  special:  '#C9A84C',
};

// ── Shared fetch helpers ───────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status, data });
  return data;
}

// ── Confidence label (word instead of bar) ────────────────────────────────

function ConfidenceLabel({ value }) {
  const pct = Math.round((value || 0) * 100);
  const label = pct >= 80 ? 'High' : pct >= 60 ? 'Medium' : 'Low';
  const color = pct >= 80 ? '#5a9a5a' : pct >= 60 ? '#a08a5c' : '#b05040';
  return (
    <span style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      fontSize: 11, color, fontWeight: 500, letterSpacing: '0.04em',
    }}>
      {label} confidence
    </span>
  );
}

// Keep ConfidenceBar for panel view
function ConfidenceBar({ value }) {
  const pct = Math.round((value || 0) * 100);
  const color = pct >= 80 ? '#5a9a5a' : pct >= 60 ? '#a08a5c' : '#b05040';
  return (
    <span style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      fontSize: 11, color, fontWeight: 500, letterSpacing: '0.04em',
    }}>
      {pct >= 80 ? 'High' : pct >= 60 ? 'Medium' : 'Low'}
    </span>
  );
}

// ── Type badge ─────────────────────────────────────────────────────────────

function TypeBadge({ type, size = 'sm' }) {
  const meta = TYPE_META[type] || { label: type, color: '#888', bg: 'rgba(0,0,0,0.06)' };
  return (
    <span style={{
      display: 'inline-block',
      background: meta.bg,
      color: meta.color,
      border: `1px solid ${meta.color}33`,
      borderRadius: 2,
      fontFamily: 'DM Mono, monospace',
      fontSize: size === 'sm' ? 11 : 12,
      fontWeight: 500,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      padding: size === 'sm' ? '2px 6px' : '3px 8px',
    }}>
      {meta.label}
    </span>
  );
}

// ── MemoryCard ─────────────────────────────────────────────────────────────
// Appears inline below an approved line.
// Handles: extraction trigger, per-memory confirm/edit/dismiss.

export function MemoryCard({ lineId, characters = [], onConfirmed, onDismissed }) {
  const [memories, setMemories]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [error, setError]           = useState(null);
  // Per-memory confirm state: { [memoryId]: { open, selectedCharId, editedStatement, saving } }
  const [confirmState, setConfirmState] = useState({});

  // Load existing memories for this line (may already exist)
  const loadMemories = useCallback(async () => {
    try {
      const data = await apiFetch(`/lines/${lineId}/memories`);
      setMemories(data.memories || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [lineId]);

  useEffect(() => { loadMemories(); }, [loadMemories]);

  // Auto-extract if no memories exist yet
  useEffect(() => {
    if (!loading && memories.length === 0 && !extracting) {
      handleExtract();
    }
  }, [loading, memories.length]);

  async function handleExtract() {
    setExtracting(true);
    setError(null);
    try {
      const data = await apiFetch(`/lines/${lineId}/extract`, {
        method: 'POST',
        body: JSON.stringify({ character_context: 'Book 1: Before Lala. PNOS characters.' }),
      });
      setMemories(data.memories || []);
    } catch (err) {
      if (err.status === 409) {
        // Already extracted — reload
        await loadMemories();
      } else {
        setError(err.message);
      }
    } finally {
      setExtracting(false);
    }
  }

  function openConfirm(memoryId, currentStatement) {
    setConfirmState(prev => ({
      ...prev,
      [memoryId]: {
        open: true,
        selectedCharId: characters[0]?.id || '',
        editedStatement: currentStatement,
        saving: false,
      },
    }));
  }

  function closeConfirm(memoryId) {
    setConfirmState(prev => ({ ...prev, [memoryId]: { ...prev[memoryId], open: false } }));
  }

  function updateConfirm(memoryId, field, value) {
    setConfirmState(prev => ({
      ...prev,
      [memoryId]: { ...prev[memoryId], [field]: value },
    }));
  }

  async function handleConfirm(memory) {
    const state = confirmState[memory.id];
    if (!state?.selectedCharId) return;

    updateConfirm(memory.id, 'saving', true);
    try {
      const data = await apiFetch(`/memories/${memory.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          character_id: state.selectedCharId,
          statement: state.editedStatement !== memory.statement ? state.editedStatement : undefined,
        }),
      });
      setMemories(prev => prev.map(m => m.id === memory.id ? data.memory : m));
      closeConfirm(memory.id);
      onConfirmed?.(data.memory);
    } catch (err) {
      setError(err.message);
      updateConfirm(memory.id, 'saving', false);
    }
  }

  async function handleDismiss(memoryId) {
    try {
      await apiFetch(`/memories/${memoryId}/dismiss`, { method: 'POST' });
      setMemories(prev => prev.filter(m => m.id !== memoryId));
      onDismissed?.(memoryId);
    } catch (err) {
      setError(err.message);
    }
  }

  const pending   = memories.filter(m => !m.confirmed);
  const confirmed = memories.filter(m => m.confirmed);

  if (loading || extracting) {
    return (
      <div style={styles.cardShell}>
        <div style={styles.cardHeader}>
          <span style={styles.cardHeaderDot} />
          <span style={styles.cardHeaderLabel}>
            {extracting ? 'Extracting memories…' : 'Loading…'}
          </span>
          <LoadingDots />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...styles.cardShell, borderLeftColor: '#B85C38' }}>
        <div style={styles.cardHeader}>
          <span style={{ ...styles.cardHeaderDot, background: '#B85C38' }} />
          <span style={{ ...styles.cardHeaderLabel, color: '#B85C38' }}>Memory extraction error</span>
        </div>
        <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#B85C38', padding: '0 0 12px 0' }}>
          {error}
        </p>
        <button style={styles.btnGhost} onClick={handleExtract}>Retry extraction</button>
      </div>
    );
  }

  if (memories.length === 0) {
    return (
      <div style={{ ...styles.cardShell, borderLeftColor: 'rgba(26,21,16,0.12)' }}>
        <div style={styles.cardHeader}>
          <span style={{ ...styles.cardHeaderDot, background: 'rgba(26,21,16,0.2)' }} />
          <span style={{ ...styles.cardHeaderLabel, color: 'rgba(26,21,16,0.4)' }}>
            No memories extracted from this line
          </span>
        </div>
        <button style={styles.btnGhost} onClick={handleExtract}>Re-run extraction</button>
      </div>
    );
  }

  return (
    <div style={styles.cardShell}>
      {/* Header */}
      <div style={styles.cardHeader}>
        <span style={styles.cardHeaderDot} />
        <span style={styles.cardHeaderLabel}>
          {pending.length > 0
            ? `${pending.length} memory candidate${pending.length > 1 ? 's' : ''} — awaiting confirmation`
            : `${confirmed.length} memory confirmed`}
        </span>
        {pending.length > 0 && (
          <span style={styles.cardHeaderBadge}>{pending.length} pending</span>
        )}
      </div>

      {/* Memory rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {memories.map(memory => {
          const cs = confirmState[memory.id] || {};
          return (
            <div key={memory.id}>
              {/* Memory row */}
              <div style={{
                ...styles.memoryRow,
                background: memory.confirmed
                  ? 'rgba(74,124,89,0.04)'
                  : cs.open ? 'rgba(201,168,76,0.06)' : 'transparent',
              }}>
                {/* Left: type + statement */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <TypeBadge type={memory.type} />
                    {memory.confirmed && (
                      <span style={{ fontSize: 12, color: '#5a9a5a' }}>✓</span>
                    )}
                    {memory.protected && (
                      <span style={{ fontSize: 12, color: '#666' }}>🔒</span>
                    )}
                  </div>
                  <p style={styles.memoryStatement}>{memory.statement}</p>
                  <ConfidenceLabel value={memory.confidence} />
                  {memory.tags?.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                      {memory.tags.slice(0, 3).map(tag => (
                        <span key={tag} style={styles.tag}>{tag}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: actions */}
                {!memory.confirmed && (
                  <div style={styles.memoryActions}>
                    <button
                      style={styles.btnConfirm}
                      onClick={() => cs.open ? closeConfirm(memory.id) : openConfirm(memory.id, memory.statement)}
                    >
                      {cs.open ? 'Cancel' : 'Confirm →'}
                    </button>
                    <button style={styles.btnDismiss} onClick={() => handleDismiss(memory.id)}>
                      Dismiss
                    </button>
                  </div>
                )}
                {memory.confirmed && (
                  <div style={styles.memoryActions}>
                    <span style={{ fontSize: 12, color: '#5a9a5a' }}>✓</span>
                  </div>
                )}
              </div>

              {/* Confirm panel — expands inline */}
              {cs.open && !memory.confirmed && (
                <ConfirmPanel
                  memory={memory}
                  state={cs}
                  characters={characters}
                  onUpdate={(field, val) => updateConfirm(memory.id, field, val)}
                  onConfirm={() => handleConfirm(memory)}
                  onCancel={() => closeConfirm(memory.id)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ConfirmPanel ───────────────────────────────────────────────────────────
// The two-step inline confirmation form.

function ConfirmPanel({ memory, state, characters, onUpdate, onConfirm, onCancel }) {
  const selectedChar = characters.find(c => c.id === state.selectedCharId);

  return (
    <div style={styles.confirmPanel}>
      <div style={styles.confirmPanelInner}>

        {/* Step label */}
        <div style={styles.confirmStep}>
          <span style={styles.confirmStepNum}>Step 1</span>
          <span style={styles.confirmStepLabel}>Review the memory statement</span>
        </div>

        {/* Editable statement */}
        <textarea
          value={state.editedStatement}
          onChange={e => onUpdate('editedStatement', e.target.value)}
          style={styles.statementEditor}
          rows={3}
        />
        {state.editedStatement !== memory.statement && (
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#7B5EA7', margin: '4px 0 0', letterSpacing: '0.08em' }}>
            🔒 Your edit will be protected — the system won't overwrite it
          </p>
        )}

        {/* Step 2 — character assignment */}
        <div style={{ ...styles.confirmStep, marginTop: 16 }}>
          <span style={styles.confirmStepNum}>Step 2</span>
          <span style={styles.confirmStepLabel}>Assign to a character</span>
        </div>

        <div style={styles.charGrid}>
          {characters.map(char => {
            const typeColor = CHARACTER_TYPE_COLORS[char.type] || '#888';
            const isSelected = state.selectedCharId === char.id;
            return (
              <button
                key={char.id}
                onClick={() => onUpdate('selectedCharId', char.id)}
                style={{
                  ...styles.charChip,
                  borderColor: isSelected ? typeColor : 'rgba(26,21,16,0.12)',
                  background: isSelected ? `${typeColor}14` : 'transparent',
                  color: isSelected ? typeColor : 'rgba(26,21,16,0.55)',
                }}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: typeColor, display: 'inline-block', flexShrink: 0,
                }} />
                {char.name}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div style={styles.confirmActions}>
          <button
            style={{
              ...styles.btnPrimary,
              opacity: !state.selectedCharId || state.saving ? 0.5 : 1,
              cursor: !state.selectedCharId || state.saving ? 'not-allowed' : 'pointer',
            }}
            onClick={onConfirm}
            disabled={!state.selectedCharId || state.saving}
          >
            {state.saving ? 'Saving…' : `✓ Confirm · Save to ${selectedChar?.name || 'Character'}`}
          </button>
          <button style={styles.btnGhost} onClick={onCancel}>Cancel</button>
        </div>

        <p style={styles.confirmNote}>
          Confirming saves this memory to the Character Registry and marks it available for narrative synthesis.
          Inferred memories that are not confirmed remain inert.
        </p>
      </div>
    </div>
  );
}

// ── MemoryBankPanel ────────────────────────────────────────────────────────
// Right-panel tab. Shows all memories across the book — confirmed + inferred.

export function MemoryBankPanel({ bookId }) {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all'); // 'all' | 'confirmed' | 'inferred'
  const [error, setError]       = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const result = await apiFetch(`/books/${bookId}/memories/pending`);
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [bookId]);

  if (loading) return <PanelShell><PanelLoading /></PanelShell>;
  if (error)   return <PanelShell><p style={styles.panelError}>{error}</p></PanelShell>;
  if (!data)   return null;

  const memories = (data.memories || []).filter(m => {
    if (filter === 'confirmed') return m.confirmed;
    if (filter === 'inferred')  return !m.confirmed;
    return true;
  });

  return (
    <PanelShell>
      {/* Header */}
      <div style={styles.panelHeader}>
        <div style={styles.panelTitle}>Memory Bank</div>
        <div style={styles.panelMeta}>
          <span style={{ color: '#4A7C59' }}>{data.confirmed_count} confirmed</span>
          <span style={{ color: 'rgba(245,240,232,0.3)' }}>·</span>
          <span style={{ color: '#C9A84C' }}>{data.inferred_count} inferred</span>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={styles.filterTabs}>
        {['all', 'confirmed', 'inferred'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              ...styles.filterTab,
              color: filter === f ? '#C9A84C' : 'rgba(245,240,232,0.3)',
              borderBottom: filter === f ? '1px solid #C9A84C' : '1px solid transparent',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Memory list */}
      {memories.length === 0 ? (
        <p style={styles.panelEmpty}>
          {filter === 'confirmed'
            ? 'No confirmed memories yet. Approve lines and confirm the extracted candidates.'
            : filter === 'inferred'
            ? 'No unconfirmed memories. All extracted memories have been reviewed.'
            : 'No memories extracted yet. Approve a line to begin.'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {memories.map(memory => (
            <PanelMemoryItem key={memory.id} memory={memory} />
          ))}
        </div>
      )}
    </PanelShell>
  );
}

function PanelMemoryItem({ memory }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      style={styles.panelItem}
      onClick={() => setExpanded(e => !e)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
        <TypeBadge type={memory.type} size="xs" />
        <span style={{
          fontFamily: 'DM Mono, monospace', fontSize: 11,
          color: memory.confirmed ? '#4A7C59' : '#C9A84C',
          letterSpacing: '0.1em', marginLeft: 'auto', flexShrink: 0,
        }}>
          {memory.confirmed ? '✓ CONFIRMED' : '◌ INFERRED'}
        </span>
      </div>
      <p style={styles.panelItemStatement}>
        {expanded ? memory.statement : memory.statement.slice(0, 72) + (memory.statement.length > 72 ? '…' : '')}
      </p>
      {expanded && (
        <>
          <ConfidenceBar value={memory.confidence} />
          <div style={{ marginTop: 6 }}>
            {memory.tags?.map(t => <span key={t} style={styles.tagDark}>{t}</span>)}
          </div>
          {memory.chapter_title && (
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'rgba(245,240,232,0.35)', marginTop: 5 }}>
              from: {memory.chapter_title}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────

function PanelShell({ children }) {
  return <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 0 }}>{children}</div>;
}

function PanelLoading() {
  return (
    <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'rgba(245,240,232,0.4)', letterSpacing: '0.1em' }}>
      Loading memories…
    </p>
  );
}

function LoadingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', marginLeft: 6 }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 4, height: 4, borderRadius: '50%', background: '#C9A84C',
          display: 'inline-block',
          animation: 'pulse 1.2s ease-in-out infinite',
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
    </span>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = {
  cardShell: {
    margin: '4px 0 8px 0',
    borderLeft: '2px solid rgba(0,0,0,0.08)',
    paddingLeft: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  cardHeader: {
    display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10,
  },
  cardHeaderDot: {
    width: 5, height: 5, borderRadius: '50%', background: '#a08a5c', flexShrink: 0,
  },
  cardHeaderLabel: {
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontSize: 11,
    color: '#666', letterSpacing: '0.06em', textTransform: 'uppercase',
  },
  cardHeaderBadge: {
    marginLeft: 'auto', background: 'rgba(0,0,0,0.04)',
    border: '1px solid rgba(0,0,0,0.08)', borderRadius: 2,
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontSize: 11,
    color: '#666', padding: '2px 6px', letterSpacing: '0.04em',
  },
  memoryRow: {
    display: 'flex', gap: 12, padding: '10px 10px 10px 0',
    borderBottom: '1px solid rgba(26,21,16,0.05)',
    borderRadius: 2, transition: 'background 0.15s',
  },
  memoryStatement: {
    fontFamily: "'Playfair Display', serif", fontSize: 13,
    color: '#1A1510', lineHeight: 1.6, margin: '0 0 6px',
  },
  memoryActions: {
    display: 'flex', flexDirection: 'column', gap: 4,
    flexShrink: 0, alignItems: 'flex-end', paddingTop: 2,
  },
  tag: {
    fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '0.06em',
    background: 'rgba(26,21,16,0.06)', borderRadius: 2,
    color: 'rgba(26,21,16,0.5)', padding: '1px 5px',
  },
  tagDark: {
    fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '0.06em',
    background: 'rgba(245,240,232,0.08)', borderRadius: 2,
    color: 'rgba(245,240,232,0.45)', padding: '1px 5px',
    display: 'inline-block', marginRight: 3,
  },

  // Confirm panel
  confirmPanel: {
    background: 'rgba(201,168,76,0.04)',
    border: '1px solid rgba(201,168,76,0.15)',
    borderRadius: '0 0 3px 3px',
    marginBottom: 2,
    overflow: 'hidden',
    animation: 'slideDown 0.2s ease',
  },
  confirmPanelInner: { padding: '14px 16px 16px' },
  confirmStep: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  confirmStepNum: {
    fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '0.16em',
    textTransform: 'uppercase', color: '#C9A84C',
    background: 'rgba(201,168,76,0.12)', borderRadius: 2,
    padding: '2px 6px',
  },
  confirmStepLabel: {
    fontFamily: 'DM Mono, monospace', fontSize: 11, color: 'rgba(26,21,16,0.5)',
    letterSpacing: '0.06em',
  },
  statementEditor: {
    width: '100%', fontFamily: "'Playfair Display', serif", fontSize: 13,
    color: '#1A1510', lineHeight: 1.65,
    background: 'rgba(245,240,232,0.8)', border: '1px solid rgba(26,21,16,0.12)',
    borderRadius: 2, padding: '8px 10px', resize: 'vertical',
    outline: 'none', boxSizing: 'border-box',
  },
  charGrid: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  charChip: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    border: '1px solid', borderRadius: 2,
    fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '0.06em',
    padding: '4px 10px', cursor: 'pointer', background: 'transparent',
    transition: 'all 0.12s',
  },
  confirmActions: { display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' },
  confirmNote: {
    fontFamily: 'DM Mono, monospace', fontSize: 11,
    color: 'rgba(26,21,16,0.4)', lineHeight: 1.5, marginTop: 10,
    letterSpacing: '0.04em',
  },

  // Buttons
  btnConfirm: {
    border: '1px solid rgba(201,168,76,0.3)', background: 'rgba(201,168,76,0.08)',
    borderRadius: 2, fontFamily: 'DM Mono, monospace', fontSize: 11,
    letterSpacing: '0.1em', textTransform: 'uppercase',
    color: '#C9A84C', padding: '4px 10px', cursor: 'pointer',
    whiteSpace: 'nowrap', transition: 'all 0.12s',
  },
  btnDismiss: {
    border: 'none', background: 'none',
    fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '0.08em',
    color: 'rgba(26,21,16,0.4)', cursor: 'pointer', padding: '4px 6px',
    transition: 'color 0.12s',
  },
  btnPrimary: {
    background: '#C9A84C', color: '#1A1510',
    border: 'none', borderRadius: 2,
    fontFamily: 'DM Mono, monospace', fontSize: 11,
    fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase',
    padding: '8px 16px', transition: 'opacity 0.15s',
  },
  btnGhost: {
    background: 'rgba(26,21,16,0.06)', color: 'rgba(26,21,16,0.5)',
    border: '1px solid rgba(26,21,16,0.1)', borderRadius: 2,
    fontFamily: 'DM Mono, monospace', fontSize: 11,
    letterSpacing: '0.08em', padding: '8px 14px', cursor: 'pointer',
  },

  // Panel (right sidebar)
  panelHeader: { marginBottom: 10 },
  panelTitle: {
    fontFamily: "'Playfair Display', serif", fontSize: 15,
    color: 'rgba(245,240,232,0.88)', fontStyle: 'italic', marginBottom: 4,
  },
  panelMeta: {
    display: 'flex', gap: 6, alignItems: 'center',
    fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '0.08em',
  },
  filterTabs: { display: 'flex', gap: 0, marginBottom: 12 },
  filterTab: {
    background: 'none', border: 'none', borderBottom: '1px solid transparent',
    fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '0.12em',
    textTransform: 'uppercase', padding: '4px 10px 4px 0',
    cursor: 'pointer', transition: 'all 0.12s',
  },
  panelItem: {
    padding: '10px 0', borderBottom: '1px solid rgba(245,240,232,0.06)',
    cursor: 'pointer', transition: 'background 0.12s',
  },
  panelItemStatement: {
    fontFamily: "'Playfair Display', serif", fontSize: 13,
    color: 'rgba(245,240,232,0.78)', lineHeight: 1.5, margin: '3px 0 0',
  },
  panelEmpty: {
    fontFamily: 'DM Mono, monospace', fontSize: 11,
    color: 'rgba(245,240,232,0.35)', letterSpacing: '0.06em', lineHeight: 1.6,
  },
  panelError: {
    fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#B85C38',
  },
};

// ── CSS keyframes (inject once) ────────────────────────────────────────────
// Add to your global stylesheet or inject via a <style> tag in the parent component

export const MEMORY_STYLES = `
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50%       { opacity: 1;   transform: scale(1);   }
}
`;
