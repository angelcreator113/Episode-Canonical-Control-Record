import { useState, useEffect, useCallback } from 'react';

// ── Constants ─────────────────────────────────────────────────────────
const API = '/api/v1';

const CONNECTION_MODES = ['IRL', 'Online Only', 'Passing', 'Professional', 'One-sided'];

const LALA_CONNECTIONS = [
  { value: 'none',               label: 'No Lala connection' },
  { value: 'knows_lala',         label: 'Knows Lala directly' },
  { value: 'through_justwoman',  label: 'Knows JustAWoman, unaware of Lala' },
  { value: 'interacts_content',  label: 'Interacts with Lala content (unknowingly)' },
  { value: 'unaware',            label: 'Completely unaware of Lala' },
];

const STATUSES = ['Active', 'Past', 'One-sided', 'Complicated'];

const REL_PRESETS = [
  'Sister', 'Brother', 'Mother', 'Father',
  'Husband', 'Wife', 'Boyfriend', 'Girlfriend',
  'Best Friend', 'Friend', 'Acquaintance',
  'Stylist', 'Designer', 'Brand Contact',
  'Manager', 'Collaborator', 'Mentor',
  'Rival', 'Inspiration', 'Fan',
];

const TYPE_COLORS = {
  pressure:    '#ef4444',
  mirror:      '#a855f7',
  support:     '#14b8a6',
  shadow:      '#f97316',
  special:     '#C9A84C',
  protagonist: '#3b82f6',
};

const MODE_COLORS = {
  'IRL':           { bg: '#fef3c7', text: '#92400e', border: '#fbbf24' },
  'Online Only':   { bg: '#ede9fe', text: '#4c1d95', border: '#8b5cf6' },
  'Passing':       { bg: '#f3f4f6', text: '#374151', border: '#9ca3af' },
  'Professional':  { bg: '#dbeafe', text: '#1e3a8a', border: '#60a5fa' },
  'One-sided':     { bg: '#fce7f3', text: '#831843', border: '#ec4899' },
};

const STATUS_COLORS = {
  'Active':      { bg: '#dcfce7', text: '#14532d', border: '#22c55e' },
  'Past':        { bg: '#f3f4f6', text: '#4b5563', border: '#9ca3af' },
  'One-sided':   { bg: '#fef3c7', text: '#92400e', border: '#fbbf24' },
  'Complicated': { bg: '#fee2e2', text: '#7f1d1d', border: '#f87171' },
};

const GOLD = '#C9A84C';
const DARK = '#0d0b09';

// ── Helpers ───────────────────────────────────────────────────────────
function charDisplayName(c) {
  return c?.selected_name || c?.display_name || 'Unknown';
}

function getCharName(rel, side) {
  if (side === 'a') return rel.character_a_selected || rel.character_a_name || '?';
  return rel.character_b_selected || rel.character_b_name || '?';
}

function otherCharId(rel, focusId) {
  return rel.character_id_a === focusId ? rel.character_id_b : rel.character_id_a;
}

// ── Sub-components ─────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3200);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
      background: type === 'error' ? '#fee2e2' : '#f0fdf4',
      border: `1px solid ${type === 'error' ? '#f87171' : '#86efac'}`,
      color: type === 'error' ? '#7f1d1d' : '#14532d',
      padding: '10px 18px', borderRadius: 8,
      fontFamily: 'system-ui, sans-serif', fontSize: 14,
      boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span>{type === 'error' ? '✕' : '✓'}</span>
      <span>{message}</span>
    </div>
  );
}

function Badge({ label, colorSet }) {
  if (!colorSet) return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 500,
      padding: '2px 8px', borderRadius: 99,
      background: '#f3f4f6', color: '#374151',
      border: '1px solid #d1d5db',
    }}>{label}</span>
  );
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 500,
      padding: '2px 8px', borderRadius: 99,
      background: colorSet.bg, color: colorSet.text,
      border: `1px solid ${colorSet.border}`,
    }}>{label}</span>
  );
}

function LalaDot({ lala_connection }) {
  if (!lala_connection || lala_connection === 'none') return null;
  const label = LALA_CONNECTIONS.find(l => l.value === lala_connection)?.label || lala_connection;
  return (
    <span title={label} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, color: GOLD, fontWeight: 500,
    }}>
      ◈ Lala
    </span>
  );
}

function TypeBar({ type }) {
  const color = TYPE_COLORS[type] || '#9ca3af';
  return (
    <span style={{
      display: 'inline-block', width: 3, height: 14,
      borderRadius: 2, background: color,
      flexShrink: 0,
    }} />
  );
}

// ── Main Page ──────────────────────────────────────────────────────────
export default function RelationshipMap() {
  const [characters, setCharacters]     = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [selectedChar, setSelectedChar] = useState(null);
  const [showForm, setShowForm]         = useState(false);
  const [editRel, setEditRel]           = useState(null);
  const [loading, setLoading]           = useState(true);
  const [toast, setToast]               = useState(null);

  // form state
  const emptyForm = {
    character_id_a:  '',
    character_id_b:  '',
    relationship_type: '',
    relTypeCustom:   '',
    connection_mode: 'IRL',
    lala_connection: 'none',
    status:          'Active',
    notes:           '',
  };
  const [form, setForm] = useState(emptyForm);

  // ── fetch ────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [cRes, rRes] = await Promise.all([
        fetch(`${API}/character-registry/registries`).then(r => r.json()),
        fetch(`${API}/relationships`).then(r => r.json()),
      ]);

      // Characters live nested inside registries
      const allChars = [];
      (cRes.registries || []).forEach(reg => {
        (reg.characters || reg.registry_characters || []).forEach(c => allChars.push(c));
      });
      setCharacters(allChars);
      setRelationships(rRes.relationships || []);
    } catch (e) {
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── toast ────────────────────────────────────────────────────────────
  function showToast(message, type = 'success') {
    setToast({ message, type });
  }

  // ── filtered relationships for selected character ─────────────────────
  const visibleRelationships = selectedChar
    ? relationships.filter(
        r => r.character_id_a === selectedChar.id || r.character_id_b === selectedChar.id
      )
    : relationships;

  // ── save (create or update) ───────────────────────────────────────────
  async function handleSave() {
    const relType = form.relationship_type === '__custom__'
      ? form.relTypeCustom.trim()
      : form.relationship_type.trim();

    if (!relType) return showToast('Relationship type is required', 'error');

    if (!editRel && (!form.character_id_a || !form.character_id_b)) {
      return showToast('Both characters are required', 'error');
    }

    const payload = {
      relationship_type: relType,
      connection_mode:  form.connection_mode,
      lala_connection:  form.lala_connection,
      status:           form.status,
      notes:            form.notes,
    };

    if (!editRel) {
      payload.character_id_a = form.character_id_a;
      payload.character_id_b = form.character_id_b;
    }

    const url    = editRel ? `${API}/relationships/${editRel.id}` : `${API}/relationships`;
    const method = editRel ? 'PUT' : 'POST';

    try {
      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) return showToast(data.error || 'Save failed', 'error');

      showToast(editRel ? 'Relationship updated' : 'Relationship added');
      setShowForm(false);
      setEditRel(null);
      setForm(emptyForm);
      fetchAll();
    } catch (e) {
      showToast('Save failed', 'error');
    }
  }

  async function handleDelete(relId) {
    try {
      await fetch(`${API}/relationships/${relId}`, { method: 'DELETE' });
      showToast('Relationship removed');
      fetchAll();
    } catch (e) {
      showToast('Delete failed', 'error');
    }
  }

  function openEdit(rel) {
    setForm({
      character_id_a:  rel.character_id_a,
      character_id_b:  rel.character_id_b,
      relationship_type: rel.relationship_type,
      relTypeCustom:   '',
      connection_mode: rel.connection_mode,
      lala_connection: rel.lala_connection,
      status:          rel.status,
      notes:           rel.notes || '',
    });
    setEditRel(rel);
    setShowForm(true);
  }

  // ── styles ────────────────────────────────────────────────────────────
  const S = {
    page: {
      minHeight: '100vh',
      background: '#faf9f7',
      fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
      color: '#1c1917',
    },
    header: {
      background: '#fff',
      borderBottom: '1px solid #e5e0d8',
      padding: '20px 32px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    },
    headerLeft: { display: 'flex', flexDirection: 'column', gap: 2 },
    headerTitle: {
      fontSize: 20, fontWeight: 700, color: DARK,
      fontFamily: "'Cormorant Garamond', serif",
      letterSpacing: '-0.3px', margin: 0,
    },
    headerSub: { fontSize: 13, color: '#78716c', margin: 0 },
    addBtn: {
      background: GOLD, color: '#fff',
      border: 'none', borderRadius: 8,
      padding: '9px 18px', fontSize: 14, fontWeight: 600,
      cursor: 'pointer', letterSpacing: '0.2px',
    },
    layout: {
      display: 'flex', gap: 0,
      maxWidth: 1200, margin: '0 auto',
    },
    sidebar: {
      width: 240, flexShrink: 0,
      borderRight: '1px solid #e5e0d8',
      background: '#fff',
      minHeight: 'calc(100vh - 65px)',
      overflowY: 'auto',
    },
    sidebarTitle: {
      fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: '#78716c',
      padding: '18px 16px 8px',
      fontFamily: "'DM Mono', monospace",
    },
    sidebarItem: (active) => ({
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '9px 16px', cursor: 'pointer',
      background: active ? '#fef9ec' : 'transparent',
      borderLeft: active ? `3px solid ${GOLD}` : '3px solid transparent',
      fontSize: 13,
      color: active ? DARK : '#57534e',
      fontWeight: active ? 600 : 400,
      transition: 'background 0.1s',
    }),
    main: {
      flex: 1, padding: '28px 32px',
    },
    sectionLabel: {
      fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: '#78716c',
      marginBottom: 16,
      fontFamily: "'DM Mono', monospace",
    },
    relCard: {
      background: '#fff', border: '1px solid #e5e0d8',
      borderRadius: 10, padding: '16px 20px',
      marginBottom: 10,
      display: 'flex', flexDirection: 'column', gap: 10,
    },
    relCardTop: {
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 8,
    },
    relNames: {
      display: 'flex', alignItems: 'center', gap: 8,
      fontSize: 14, fontWeight: 600, color: DARK,
      flexWrap: 'wrap',
    },
    relType: {
      display: 'inline-block',
      fontSize: 12, fontWeight: 600,
      color: GOLD,
      padding: '1px 0',
    },
    relMeta: {
      display: 'flex', flexWrap: 'wrap', gap: 6,
      alignItems: 'center',
    },
    relActions: {
      display: 'flex', gap: 8, alignItems: 'center',
    },
    editBtn: {
      background: 'transparent', border: `1px solid ${GOLD}`,
      color: GOLD, borderRadius: 6,
      padding: '4px 12px', fontSize: 12, cursor: 'pointer',
    },
    delBtn: {
      background: 'transparent', border: '1px solid #fca5a5',
      color: '#ef4444', borderRadius: 6,
      padding: '4px 12px', fontSize: 12, cursor: 'pointer',
    },
    notes: {
      fontSize: 12, color: '#78716c',
      fontStyle: 'italic', marginTop: 2,
      fontFamily: "'Lora', serif",
    },
    // form modal
    overlay: {
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.25)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    modal: {
      background: '#fff', borderRadius: 12,
      width: '100%', maxWidth: 520,
      maxHeight: '90vh', overflowY: 'auto',
      padding: 28,
      boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
    },
    modalTitle: {
      fontSize: 17, fontWeight: 700, color: DARK,
      fontFamily: "'Cormorant Garamond', serif",
      marginBottom: 20,
    },
    fieldGroup: { marginBottom: 16 },
    label: {
      display: 'block', fontSize: 12, fontWeight: 600,
      color: '#57534e', marginBottom: 5, letterSpacing: '0.03em',
      fontFamily: "'DM Mono', monospace",
    },
    input: {
      width: '100%', padding: '8px 12px',
      border: '1px solid #d1cbc3', borderRadius: 7,
      fontSize: 13, color: DARK, background: '#faf9f7',
      outline: 'none', boxSizing: 'border-box',
    },
    select: {
      width: '100%', padding: '8px 12px',
      border: '1px solid #d1cbc3', borderRadius: 7,
      fontSize: 13, color: DARK, background: '#faf9f7',
      outline: 'none', boxSizing: 'border-box',
    },
    textarea: {
      width: '100%', padding: '8px 12px',
      border: '1px solid #d1cbc3', borderRadius: 7,
      fontSize: 13, color: DARK, background: '#faf9f7',
      outline: 'none', boxSizing: 'border-box',
      fontFamily: "'Lora', serif",
      resize: 'vertical', minHeight: 72,
    },
    formActions: {
      display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24,
    },
    cancelBtn: {
      background: 'transparent', border: '1px solid #d1cbc3',
      color: '#57534e', borderRadius: 7,
      padding: '9px 20px', fontSize: 13, cursor: 'pointer',
    },
    saveBtn: {
      background: GOLD, color: '#fff',
      border: 'none', borderRadius: 7,
      padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    },
    emptyState: {
      textAlign: 'center', padding: '60px 20px',
      color: '#78716c',
    },
    emptyIcon: { fontSize: 36, marginBottom: 12, opacity: 0.4 },
    emptyTitle: { fontSize: 15, fontWeight: 600, color: '#44403c', marginBottom: 6 },
    emptyDesc: { fontSize: 13 },
    divider: {
      fontSize: 14, color: '#9ca3af', fontWeight: 400, margin: '0 4px',
    },
  };

  // ── render ────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>

      {/* Header */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <p style={S.headerTitle}>Relationship Map</p>
          <p style={S.headerSub}>
            {relationships.length} relationship{relationships.length !== 1 ? 's' : ''} across {characters.length} characters
          </p>
        </div>
        <button style={S.addBtn} onClick={() => {
          setEditRel(null);
          setForm(emptyForm);
          setShowForm(true);
        }}>
          + Add Relationship
        </button>
      </div>

      <div style={S.layout}>

        {/* Sidebar — character list */}
        <div style={S.sidebar}>
          <div style={S.sidebarTitle}>Characters</div>

          {/* All view */}
          <div
            style={S.sidebarItem(!selectedChar)}
            onClick={() => setSelectedChar(null)}
          >
            <span style={{ fontSize: 15 }}>◎</span>
            <span>All relationships</span>
          </div>

          {characters.map(c => {
            const relCount = relationships.filter(
              r => r.character_id_a === c.id || r.character_id_b === c.id
            ).length;
            return (
              <div
                key={c.id}
                style={S.sidebarItem(selectedChar?.id === c.id)}
                onClick={() => setSelectedChar(c)}
              >
                <TypeBar type={c.role_type} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {charDisplayName(c)}
                </span>
                {relCount > 0 && (
                  <span style={{ fontSize: 11, color: '#a8a29e', flexShrink: 0 }}>{relCount}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Main content */}
        <div style={S.main}>
          {loading ? (
            <div style={S.emptyState}>
              <div style={S.emptyIcon}>⟳</div>
              <div style={S.emptyTitle}>Loading…</div>
            </div>
          ) : visibleRelationships.length === 0 ? (
            <div style={S.emptyState}>
              <div style={S.emptyIcon}>◈</div>
              <div style={S.emptyTitle}>
                {selectedChar ? `No relationships for ${charDisplayName(selectedChar)} yet` : 'No relationships yet'}
              </div>
              <div style={S.emptyDesc}>
                Add the first relationship to start mapping the world of LalaVerse.
              </div>
            </div>
          ) : (
            <>
              <div style={S.sectionLabel}>
                {selectedChar ? `${charDisplayName(selectedChar)}'s Relationships` : 'All Relationships'}
                &nbsp;·&nbsp;{visibleRelationships.length}
              </div>

              {visibleRelationships.map(rel => (
                <div key={rel.id} style={S.relCard}>
                  <div style={S.relCardTop}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {/* Names row */}
                      <div style={S.relNames}>
                        <span>{getCharName(rel, 'a')}</span>
                        <span style={S.divider}>—</span>
                        <span>{getCharName(rel, 'b')}</span>
                        <span style={{ marginLeft: 4 }}>
                          <span style={S.relType}>{rel.relationship_type}</span>
                        </span>
                      </div>

                      {/* Badges row */}
                      <div style={S.relMeta}>
                        <Badge
                          label={rel.connection_mode}
                          colorSet={MODE_COLORS[rel.connection_mode]}
                        />
                        <Badge
                          label={rel.status}
                          colorSet={STATUS_COLORS[rel.status]}
                        />
                        <LalaDot lala_connection={rel.lala_connection} />
                      </div>

                      {/* Notes */}
                      {rel.notes && (
                        <div style={S.notes}>"{rel.notes}"</div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={S.relActions}>
                      <button style={S.editBtn} onClick={() => openEdit(rel)}>Edit</button>
                      <button style={S.delBtn} onClick={() => handleDelete(rel.id)}>✕</button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showForm && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) { setShowForm(false); setEditRel(null); } }}>
          <div style={S.modal}>
            <div style={S.modalTitle}>
              {editRel ? 'Edit Relationship' : 'Add Relationship'}
            </div>

            {/* Characters — only shown on create */}
            {!editRel && (
              <>
                <div style={S.fieldGroup}>
                  <label style={S.label}>Character A</label>
                  <select
                    style={S.select}
                    value={form.character_id_a}
                    onChange={e => setForm(f => ({ ...f, character_id_a: e.target.value }))}
                  >
                    <option value="">Select character…</option>
                    {characters.map(c => (
                      <option key={c.id} value={c.id}>{charDisplayName(c)}</option>
                    ))}
                  </select>
                </div>

                <div style={S.fieldGroup}>
                  <label style={S.label}>Character B</label>
                  <select
                    style={S.select}
                    value={form.character_id_b}
                    onChange={e => setForm(f => ({ ...f, character_id_b: e.target.value }))}
                  >
                    <option value="">Select character…</option>
                    {characters
                      .filter(c => c.id !== form.character_id_a)
                      .map(c => (
                        <option key={c.id} value={c.id}>{charDisplayName(c)}</option>
                      ))}
                  </select>
                </div>
              </>
            )}

            {/* Relationship type */}
            <div style={S.fieldGroup}>
              <label style={S.label}>Relationship Type</label>
              <select
                style={S.select}
                value={REL_PRESETS.includes(form.relationship_type) ? form.relationship_type : (form.relationship_type ? '__custom__' : '')}
                onChange={e => {
                  const v = e.target.value;
                  if (v === '__custom__') {
                    setForm(f => ({ ...f, relationship_type: '__custom__' }));
                  } else {
                    setForm(f => ({ ...f, relationship_type: v, relTypeCustom: '' }));
                  }
                }}
              >
                <option value="">Select type…</option>
                {REL_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
                <option value="__custom__">Custom…</option>
              </select>

              {(form.relationship_type === '__custom__' ||
                (!REL_PRESETS.includes(form.relationship_type) && form.relationship_type && form.relationship_type !== '__custom__')) && (
                <input
                  style={{ ...S.input, marginTop: 8 }}
                  placeholder="e.g. Brand ambassador, Ghostwriter…"
                  value={form.relTypeCustom || (form.relationship_type !== '__custom__' ? form.relationship_type : '')}
                  onChange={e => {
                    const v = e.target.value;
                    setForm(f => ({ ...f, relTypeCustom: v, relationship_type: '__custom__' }));
                  }}
                />
              )}
            </div>

            {/* Connection mode */}
            <div style={S.fieldGroup}>
              <label style={S.label}>How They Know Each Other</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {CONNECTION_MODES.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, connection_mode: m }))}
                    style={{
                      padding: '6px 14px', borderRadius: 99,
                      fontSize: 12, fontWeight: 500,
                      cursor: 'pointer',
                      border: form.connection_mode === m
                        ? `2px solid ${GOLD}` : '1px solid #d1cbc3',
                      background: form.connection_mode === m ? '#fef9ec' : '#faf9f7',
                      color: form.connection_mode === m ? '#92400e' : '#57534e',
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Lala connection */}
            <div style={S.fieldGroup}>
              <label style={S.label}>Connection to Lala</label>
              <select
                style={S.select}
                value={form.lala_connection}
                onChange={e => setForm(f => ({ ...f, lala_connection: e.target.value }))}
              >
                {LALA_CONNECTIONS.map(l => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div style={S.fieldGroup}>
              <label style={S.label}>Relationship Status</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {STATUSES.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, status: s }))}
                    style={{
                      padding: '6px 14px', borderRadius: 99,
                      fontSize: 12, fontWeight: 500,
                      cursor: 'pointer',
                      border: form.status === s
                        ? `2px solid ${STATUS_COLORS[s]?.border || GOLD}`
                        : '1px solid #d1cbc3',
                      background: form.status === s
                        ? (STATUS_COLORS[s]?.bg || '#fef9ec')
                        : '#faf9f7',
                      color: form.status === s
                        ? (STATUS_COLORS[s]?.text || DARK)
                        : '#57534e',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div style={S.fieldGroup}>
              <label style={S.label}>Notes (optional)</label>
              <textarea
                style={S.textarea}
                placeholder="Context, backstory, how this relationship affects the narrative…"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <div style={S.formActions}>
              <button style={S.cancelBtn} onClick={() => { setShowForm(false); setEditRel(null); setForm(emptyForm); }}>
                Cancel
              </button>
              <button style={S.saveBtn} onClick={handleSave}>
                {editRel ? 'Save Changes' : 'Add Relationship'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
