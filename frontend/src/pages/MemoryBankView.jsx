/**
 * MemoryBankView.jsx
 *
 * "The Field of Meaning" — A structured memory explorer for the PNOS
 * Storyteller system. Replaces the old flat-list MemoryBankPanel with
 * a 2-column layout: type clusters (left) + selected memory detail (right).
 *
 * Features:
 *   - Memories organized by type cluster (Beliefs, Relationships, Goals, …)
 *   - 4-tier truth status: Canon 🔒 | Confirmed ✓ | Interpreted ~ | Candidate ?
 *   - Tension surface — detects contradictions within the same character + type
 *   - Intelligent filters: uncertain, high-confidence candidates, tensions, by character
 *   - Detail panel: full info, edit, confirm, protect, dismiss
 *   - Evolution timeline placeholder (for future history tracking)
 *
 * Usage:
 *   <MemoryBankView bookId={book.id} />
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import './MemoryBankView.css';

// ── Constants ──────────────────────────────────────────────────────────────

const API = '/api/v1/memories';

const TYPE_META = {
  belief:         { label: 'Beliefs',         color: '#C9A84C', icon: '◇' },
  relationship:   { label: 'Relationships',   color: '#7B5EA7', icon: '◈' },
  goal:           { label: 'Goals',           color: '#4A7C59', icon: '▹' },
  transformation: { label: 'Transformations', color: '#2A7A6A', icon: '⟳' },
  preference:     { label: 'Preferences',     color: '#2563A8', icon: '·' },
  event:          { label: 'Events',          color: '#5A6E3A', icon: '○' },
  constraint:     { label: 'Constraints',     color: '#B85C38', icon: '▫' },
};

const TYPE_ORDER = ['belief', 'relationship', 'goal', 'transformation', 'preference', 'event', 'constraint'];

const STATUS_META = {
  canon:       { icon: '🔒', label: 'Canon',       color: '#4A7C59' },
  confirmed:   { icon: '✓',  label: 'Confirmed',   color: '#2563A8' },
  interpreted: { icon: '~',  label: 'Interpreted',  color: '#C9A84C' },
  candidate:   { icon: '?',  label: 'Candidate',    color: '#888'    },
};

const CHARACTER_TYPE_COLORS = {
  pressure: '#B85C38',
  mirror:   '#7B5EA7',
  support:  '#2A7A6A',
  shadow:   '#C97A2A',
  special:  '#C9A84C',
};

// ── Helpers ────────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status, data });
  return data;
}

/** Derive 4-tier truth status from model fields */
function getStatus(memory) {
  if (memory.confirmed && memory.protected) return 'canon';
  if (memory.confirmed) return 'confirmed';
  if (!memory.confirmed && (memory.confidence || 0) >= 0.6) return 'interpreted';
  return 'candidate';
}

function confidenceLabel(value) {
  const pct = Math.round((value || 0) * 100);
  if (pct >= 80) return { label: 'High', cls: 'high' };
  if (pct >= 60) return { label: 'Med', cls: 'medium' };
  return { label: 'Low', cls: 'low' };
}

function getCharColor(memory) {
  if (!memory) return '#888';
  const type = memory.character_type || memory.character?.role_type;
  return CHARACTER_TYPE_COLORS[type] || '#888';
}

// ── Tension Detection ──────────────────────────────────────────────────────

/**
 * Find potential contradictions: memories of the same character + type
 * where one is confirmed and another is not, or where statements diverge.
 * Simple heuristic: group by (character_id, type), flag groups with > 1 memory
 * that have conflicting confirmed states.
 */
function detectTensions(memories) {
  const groups = {};
  for (const m of memories) {
    if (!m.character_id) continue;
    const key = `${m.character_id}::${m.type}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  }

  const tensions = [];
  for (const [key, group] of Object.entries(groups)) {
    if (group.length < 2) continue;
    const hasConfirmed = group.some(g => g.confirmed);
    const hasUnconfirmed = group.some(g => !g.confirmed);
    // Tension: same character + type has both confirmed and unconfirmed memories
    // Or: multiple confirmed memories of same type (potential evolution/contradiction)
    const confirmedCount = group.filter(g => g.confirmed).length;
    if ((hasConfirmed && hasUnconfirmed) || confirmedCount > 1) {
      const [charId, type] = key.split('::');
      tensions.push({
        character_id: charId,
        type,
        character_name: group[0].character_name || 'Unknown',
        memories: group.sort((a, b) => (a.confirmed === b.confirmed ? 0 : a.confirmed ? -1 : 1)),
      });
    }
  }
  return tensions;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Main Component
// ═══════════════════════════════════════════════════════════════════════════

export default function MemoryBankView({ bookId, showId }) {
  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [selectedId, setSelectedId]   = useState(null);
  const [expandedTypes, setExpandedTypes] = useState(() => new Set(TYPE_ORDER));
  const [activeFilter, setActiveFilter]   = useState('all');
  const [charFilter, setCharFilter]       = useState('');
  const [tensionsOpen, setTensionsOpen]   = useState(true);
  const [editing, setEditing]             = useState(false);
  const [editText, setEditText]           = useState('');
  const [saving, setSaving]               = useState(false);
  const [extracting, setExtracting]       = useState(false);
  const [extractMsg, setExtractMsg]       = useState('');
  const [registryCharacters, setRegistryCharacters] = useState([]);
  const [confirmCharId, setConfirmCharId] = useState(null);

  // ── Load registry characters ───────────────────────────────────

  useEffect(() => {
    fetch('/api/v1/character-registry/registries')
      .then(r => r.json())
      .then(d => {
        const chars = d.registries?.flatMap(r => r.characters || []) || [];
        setRegistryCharacters(chars.map(c => ({ id: c.id, name: c.display_name || c.name, type: c.role_type || c.type })));
      })
      .catch(() => {});
  }, []);

  // ── Load memories ──────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiFetch(`/books/${bookId}/memories/pending`);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => { load(); }, [load]);

  // ── Derived data ───────────────────────────────────────────────

  const memories = useMemo(() => {
    if (!data?.memories) return [];
    return data.memories.map(m => {
      // Flatten nested character object from Sequelize include
      const char = m.character || {};
      return {
        ...m,
        character_name: m.character_name || char.display_name || char.name || null,
        character_type: m.character_type || char.role_type || char.type || null,
        _status: getStatus(m),
        _conf: confidenceLabel(m.confidence),
      };
    });
  }, [data]);

  // Unique characters across all memories
  const characters = useMemo(() => {
    const map = new Map();
    for (const m of memories) {
      if (m.character_id && m.character_name) {
        if (!map.has(m.character_id)) {
          map.set(m.character_id, { id: m.character_id, name: m.character_name, type: m.character_type });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [memories]);

  // Apply filters
  const filtered = useMemo(() => {
    let list = memories;

    // Character filter
    if (charFilter) {
      list = list.filter(m => m.character_id === charFilter);
    }

    // Status / smart filters
    switch (activeFilter) {
      case 'canon':
        list = list.filter(m => m._status === 'canon');
        break;
      case 'confirmed':
        list = list.filter(m => m._status === 'confirmed');
        break;
      case 'interpreted':
        list = list.filter(m => m._status === 'interpreted');
        break;
      case 'candidate':
        list = list.filter(m => m._status === 'candidate');
        break;
      case 'uncertain':
        list = list.filter(m => (m.confidence || 0) < 0.6 && !m.confirmed);
        break;
      case 'high-candidate':
        list = list.filter(m => !m.confirmed && (m.confidence || 0) >= 0.75);
        break;
      default:
        break;
    }

    return list;
  }, [memories, activeFilter, charFilter]);

  // Group by type
  const clusters = useMemo(() => {
    const map = {};
    for (const type of TYPE_ORDER) map[type] = [];
    for (const m of filtered) {
      const bucket = map[m.type] || map['event']; // fallback
      bucket.push(m);
    }
    return map;
  }, [filtered]);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts = { canon: 0, confirmed: 0, interpreted: 0, candidate: 0 };
    for (const m of memories) counts[m._status]++;
    return counts;
  }, [memories]);

  // Tensions
  const tensions = useMemo(() => detectTensions(memories), [memories]);

  // Selected memory
  const selected = useMemo(
    () => memories.find(m => m.id === selectedId) || null,
    [memories, selectedId]
  );

  // ── Actions ────────────────────────────────────────────────────

  const handleConfirm = async (memoryId, characterId) => {
    if (saving) return;
    const charId = characterId || confirmCharId;
    if (!charId) {
      console.error('Confirm failed: no character selected');
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/memories/${memoryId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ character_id: charId }),
      });
      setConfirmCharId(null);
      await load();
    } catch (err) {
      console.error('Confirm failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDismiss = async (memoryId) => {
    if (saving) return;
    if (!window.confirm('Dismiss this memory? This cannot be undone.')) return;
    setSaving(true);
    try {
      await apiFetch(`/memories/${memoryId}/dismiss`, { method: 'POST' });
      if (selectedId === memoryId) setSelectedId(null);
      await load();
    } catch (err) {
      console.error('Dismiss failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      await apiFetch(`/memories/${selected.id}`, {
        method: 'PUT',
        body: JSON.stringify({ statement: editText }),
      });
      setEditing(false);
      await load();
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleProtect = async (memoryId) => {
    if (saving) return;
    setSaving(true);
    try {
      await apiFetch(`/memories/${memoryId}`, {
        method: 'PUT',
        body: JSON.stringify({ protected: true }),
      });
      await load();
    } catch (err) {
      console.error('Protect failed:', err);
    } finally {
      setSaving(false);
    }
  };

  // ── Batch Extract All ──────────────────────────────────────────

  const handleExtractAll = async () => {
    if (extracting) return;
    setExtracting(true);
    setExtractMsg('Extracting memories from approved lines…');
    try {
      const result = await apiFetch(`/books/${bookId}/extract-all`, { method: 'POST' });
      const msg = result.extracted > 0
        ? `Extracted ${result.extracted} memories from ${result.total_lines} lines.`
        : result.message || 'No new memories to extract.';
      setExtractMsg(msg);
      await load(); // refresh the memory list
    } catch (err) {
      setExtractMsg(`Extraction failed: ${err.message}`);
    } finally {
      setExtracting(false);
      // Clear message after 6 seconds
      setTimeout(() => setExtractMsg(''), 6000);
    }
  };

  const toggleCluster = (type) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const startEdit = () => {
    if (!selected) return;
    setEditText(selected.statement);
    setEditing(true);
  };

  // ── Render ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="mb-root">
        <div className="mb-loading">
          <span className="mb-loading-text">
            Loading memories
            <span className="mb-loading-dots">
              <span className="mb-loading-dot" />
              <span className="mb-loading-dot" />
              <span className="mb-loading-dot" />
            </span>
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-root">
        <div className="mb-error">
          <p className="mb-error-text">{error}</p>
        </div>
      </div>
    );
  }

  if (memories.length === 0) {
    return (
      <div className="mb-root">
        <div className="mb-empty">
          <div className="mb-empty-icon">◇</div>
          <div className="mb-empty-title">No memories yet</div>
          <div className="mb-empty-text">
            Approve lines in the manuscript to begin extracting<br />
            character memories. Each approved line surfaces beliefs,<br />
            goals, relationships, and constraints.
          </div>
          <button
            className="mb-extract-btn"
            onClick={handleExtractAll}
            disabled={extracting}
          >
            {extracting ? 'Extracting…' : '◇ Extract from Approved Lines'}
          </button>
          {extractMsg && <div className="mb-extract-msg">{extractMsg}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-root">

      {/* ── Truth State Legend ── */}
      <div className="mb-legend">
        <div className="mb-legend-title">Memory Bank</div>
        {Object.entries(STATUS_META).map(([key, meta]) => (
          <div className="mb-legend-item" key={key}>
            <span className="mb-legend-icon">{meta.icon}</span>
            <span>{meta.label}</span>
            <span className="mb-legend-count">{statusCounts[key]}</span>
          </div>
        ))}
        <button
          className="mb-extract-btn-sm"
          onClick={handleExtractAll}
          disabled={extracting}
          title="Extract memories from any approved lines that haven't been processed yet"
        >
          {extracting ? '…' : '◇ Extract'}
        </button>
        {extractMsg && <div className="mb-extract-msg">{extractMsg}</div>}
      </div>

      {/* ── Filter Bar ── */}
      <div className="mb-filters">
        {[
          { key: 'all', label: 'All' },
          { key: 'canon', label: 'Canon' },
          { key: 'confirmed', label: 'Confirmed' },
          { key: 'interpreted', label: 'Interpreted' },
          { key: 'candidate', label: 'Candidates' },
        ].map(f => (
          <button
            key={f.key}
            className={`mb-filter-btn ${activeFilter === f.key ? 'active' : ''}`}
            onClick={() => setActiveFilter(f.key)}
          >
            {f.label}
          </button>
        ))}

        <div className="mb-filter-sep" />

        {[
          { key: 'uncertain', label: 'Uncertain' },
          { key: 'high-candidate', label: 'High Candidates' },
        ].map(f => (
          <button
            key={f.key}
            className={`mb-filter-btn ${activeFilter === f.key ? 'active' : ''}`}
            onClick={() => setActiveFilter(f.key)}
          >
            {f.label}
          </button>
        ))}

        {characters.length > 0 && (
          <>
            <div className="mb-filter-sep" />
            <select
              className="mb-char-select"
              value={charFilter}
              onChange={e => setCharFilter(e.target.value)}
            >
              <option value="">All Characters</option>
              {characters.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* ── Body: Clusters + Detail ── */}
      <div className="mb-body">

        {/* Left: Memory Clusters */}
        <div className="mb-clusters">
          {TYPE_ORDER.map(type => {
            const items = clusters[type];
            if (items.length === 0) return null;
            const meta = TYPE_META[type];
            const isOpen = expandedTypes.has(type);

            return (
              <div className="mb-cluster" key={type}>
                <div
                  className="mb-cluster-header"
                  onClick={() => toggleCluster(type)}
                >
                  <span className="mb-cluster-dot" style={{ background: meta.color }} />
                  <span className="mb-cluster-name">{meta.label}</span>
                  <span className="mb-cluster-count">{items.length}</span>
                  <span className={`mb-cluster-arrow ${isOpen ? 'open' : ''}`}>▶</span>
                </div>

                {isOpen && (
                  <div className="mb-cluster-body">
                    {items.map(m => (
                      <MemoryRow
                        key={m.id}
                        memory={m}
                        isSelected={selectedId === m.id}
                        onClick={() => {
                          setSelectedId(m.id);
                          setEditing(false);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Tension Surface */}
          {tensions.length > 0 && (
            <div className="mb-tensions">
              <div className="mb-tensions-header" onClick={() => setTensionsOpen(o => !o)}>
                <span className="mb-tensions-icon">⚡</span>
                <span className="mb-tensions-label">Tensions</span>
                <span className="mb-tensions-count">{tensions.length}</span>
                <span className={`mb-cluster-arrow ${tensionsOpen ? 'open' : ''}`}>▶</span>
              </div>

              {tensionsOpen && tensions.map((t, i) => (
                <div
                  key={i}
                  className={`mb-tension-pair ${selectedId && t.memories.some(m => m.id === selectedId) ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedId(t.memories[0].id);
                    setEditing(false);
                  }}
                >
                  <div className="mb-tension-type">
                    {t.character_name} · {TYPE_META[t.type]?.label || t.type}
                  </div>
                  <div className="mb-tension-vs">
                    {t.memories.slice(0, 3).map(m => (
                      <div key={m.id} className="mb-tension-item">
                        {m.statement.length > 80 ? m.statement.slice(0, 80) + '…' : m.statement}
                      </div>
                    ))}
                    {t.memories.length > 3 && (
                      <div className="mb-tension-item" style={{ fontStyle: 'italic', opacity: 0.6 }}>
                        +{t.memories.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Detail Panel */}
        <div className="mb-detail">
          {!selected ? (
            <div className="mb-detail-empty">
              <div className="mb-detail-empty-icon">◇</div>
              <div className="mb-detail-empty-text">
                Select a memory to view<br />its full detail
              </div>
            </div>
          ) : (
            <DetailPanel
              memory={selected}
              editing={editing}
              editText={editText}
              setEditText={setEditText}
              saving={saving}
              onStartEdit={startEdit}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={() => setEditing(false)}
              onConfirm={() => handleConfirm(selected.id, confirmCharId)}
              onDismiss={() => handleDismiss(selected.id)}
              onProtect={() => handleProtect(selected.id)}
              registryCharacters={registryCharacters}
              confirmCharId={confirmCharId}
              setConfirmCharId={setConfirmCharId}
            />
          )}
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
//  Sub-Components
// ═══════════════════════════════════════════════════════════════════════════

/** Single memory row in a cluster */
function MemoryRow({ memory, isSelected, onClick }) {
  const status = STATUS_META[memory._status];
  return (
    <div
      className={`mb-memory-row status-${memory._status} ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <span className="mb-memory-status" style={{ color: status.color }}>
        {status.icon}
      </span>
      <div className="mb-memory-content">
        <p className="mb-memory-statement">
          {memory.statement.length > 100
            ? memory.statement.slice(0, 100) + '…'
            : memory.statement}
        </p>
        <div className="mb-memory-meta">
          {memory.character_name && (
            <span className="mb-memory-char">
              <span className="mb-memory-char-dot" style={{ background: getCharColor(memory) }} />
              {memory.character_name}
            </span>
          )}
          <span className={`mb-memory-confidence ${memory._conf.cls}`}>
            {memory._conf.label}
          </span>
          {memory.chapter_title && (
            <span className="mb-memory-chapter">
              {memory.chapter_title}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}


/** Full detail panel for the selected memory */
function DetailPanel({
  memory, editing, editText, setEditText, saving,
  onStartEdit, onSaveEdit, onCancelEdit,
  onConfirm, onDismiss, onProtect,
  registryCharacters, confirmCharId, setConfirmCharId,
}) {
  const status = STATUS_META[memory._status];
  const typeMeta = TYPE_META[memory.type] || { label: memory.type, color: '#888' };
  const conf = confidenceLabel(memory.confidence);
  const pct = Math.round((memory.confidence || 0) * 100);

  return (
    <div className="mb-detail-card">
      {/* Status + Type row */}
      <div className="mb-detail-status-row">
        <span className={`mb-detail-status-badge ${memory._status}`}>
          {status.icon} {status.label}
        </span>
        <span
          className="mb-detail-type-badge"
          style={{ color: typeMeta.color, background: `${typeMeta.color}12`, border: `1px solid ${typeMeta.color}25` }}
        >
          {typeMeta.label}
        </span>
      </div>

      {/* Statement */}
      {editing ? (
        <textarea
          className="mb-detail-statement-edit"
          value={editText}
          onChange={e => setEditText(e.target.value)}
          autoFocus
        />
      ) : (
        <p className="mb-detail-statement">{memory.statement}</p>
      )}

      {/* Character */}
      {memory.character_name && (
        <div className="mb-detail-section">
          <div className="mb-detail-section-label">Character</div>
          <div className="mb-detail-char">
            <span className="mb-detail-char-dot" style={{ background: getCharColor(memory) }} />
            <span className="mb-detail-section-value">{memory.character_name}</span>
          </div>
        </div>
      )}

      {/* Confidence */}
      <div className="mb-detail-section">
        <div className="mb-detail-section-label">Confidence</div>
        <div className="mb-detail-confidence-bar">
          <div className="mb-detail-confidence-track">
            <div
              className="mb-detail-confidence-fill"
              style={{
                width: `${pct}%`,
                background: conf.cls === 'high' ? '#5a9a5a' : conf.cls === 'medium' ? '#a08a5c' : '#b05040',
              }}
            />
          </div>
          <span className={`mb-detail-confidence-label mb-memory-confidence ${conf.cls}`}>
            {pct}%
          </span>
        </div>
      </div>

      {/* Source */}
      {(memory.chapter_title || memory.line_content_preview) && (
        <div className="mb-detail-section">
          <div className="mb-detail-section-label">Source</div>
          <div className="mb-detail-source">
            {memory.chapter_title && (
              <span className="mb-detail-source-chapter">{memory.chapter_title}</span>
            )}
            {memory.line_content_preview && (
              <span className="mb-detail-source-line">"{memory.line_content_preview}"</span>
            )}
          </div>
        </div>
      )}

      {/* Tags */}
      {memory.tags && memory.tags.length > 0 && (
        <div className="mb-detail-section">
          <div className="mb-detail-section-label">Tags</div>
          <div className="mb-detail-tags">
            {memory.tags.map(t => (
              <span key={t} className="mb-detail-tag">{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mb-detail-section">
        <div className="mb-detail-section-label">Actions</div>
        <div className="mb-detail-actions">
          {editing ? (
            <>
              <button className="mb-action-btn primary" onClick={onSaveEdit} disabled={saving}>
                {saving ? 'Saving…' : '✓ Save'}
              </button>
              <button className="mb-action-btn" onClick={onCancelEdit}>Cancel</button>
            </>
          ) : (
            <>
              <button className="mb-action-btn" onClick={onStartEdit}>
                ✎ Edit
              </button>

              {!memory.confirmed && (
                <div className="mb-confirm-flow">
                  {/* Character picker */}
                  {registryCharacters.length > 0 && (
                    <div className="mb-confirm-char-picker">
                      <div className="mb-detail-section-label" style={{ marginBottom: 6 }}>Assign to character</div>
                      <div className="mb-confirm-char-grid">
                        {registryCharacters.map(char => {
                          const typeColor = CHARACTER_TYPE_COLORS[char.type] || '#888';
                          const isSelected = confirmCharId === char.id;
                          return (
                            <button
                              key={char.id}
                              className={`mb-confirm-char-chip ${isSelected ? 'selected' : ''}`}
                              style={{
                                borderColor: isSelected ? typeColor : 'rgba(26,21,16,0.12)',
                                background: isSelected ? `${typeColor}14` : 'transparent',
                                color: isSelected ? typeColor : 'rgba(26,21,16,0.55)',
                              }}
                              onClick={() => setConfirmCharId(char.id)}
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
                    </div>
                  )}
                  <button
                    className="mb-action-btn primary"
                    onClick={onConfirm}
                    disabled={saving || !confirmCharId}
                    style={{ opacity: !confirmCharId ? 0.5 : 1 }}
                  >
                    {saving ? '…' : `✓ Confirm${confirmCharId ? '' : ' (select character)'}`}
                  </button>
                </div>
              )}

              {memory.confirmed && !memory.protected && (
                <button
                  className="mb-action-btn protect"
                  onClick={onProtect}
                  disabled={saving}
                >
                  🔒 Protect
                </button>
              )}

              {!memory.confirmed && (
                <button
                  className="mb-action-btn danger"
                  onClick={onDismiss}
                  disabled={saving}
                >
                  ✕ Dismiss
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Protected notice */}
      {memory.protected && (
        <div style={{
          fontFamily: 'var(--st-mono, "DM Mono", monospace)',
          fontSize: 10,
          color: '#4A7C59',
          letterSpacing: '0.08em',
          marginTop: 6,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}>
          🔒 This memory is protected and cannot be overwritten by AI extraction.
        </div>
      )}
    </div>
  );
}
