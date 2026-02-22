/**
 * PNOS Character Registry Page
 * Dark-themed character management with role types, name selection,
 * personality matrices, and accept/decline/finalize workflow.
 * Location: frontend/src/pages/CharacterRegistryPage.jsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import './CharacterRegistryPage.css';

const API = '/api/v1/character-registry';

/* ------------------------------------------------------------------ */
/*  Toast helper                                                       */
/* ------------------------------------------------------------------ */
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return <div className={`cr-toast ${type || ''}`}>{message}</div>;
}

/* ------------------------------------------------------------------ */
/*  Appearance mode labels                                             */
/* ------------------------------------------------------------------ */
const MODE_LABELS = {
  on_page: 'On Page',
  composite: 'Composite',
  observed: 'Observed',
  invisible: 'Invisible',
  brief: 'Brief',
};

/* ================================================================== */
/*  MAIN COMPONENT                                                     */
/* ================================================================== */
export default function CharacterRegistryPage() {
  // ---------- state ----------
  const [registries, setRegistries] = useState([]);
  const [activeRegistry, setActiveRegistry] = useState(null);
  const [activeCharKey, setActiveCharKey] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [editingChar, setEditingChar] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const showToast = useCallback((message, type = '') => {
    setToast({ message, type, key: Date.now() });
  }, []);

  /* ---------- fetch registries ---------- */
  const fetchRegistries = useCallback(async () => {
    try {
      const res = await fetch(`${API}/registries`);
      const data = await res.json();
      if (data.success) setRegistries(data.registries || []);
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
        // Also update in list
        setRegistries(prev => prev.map(r => r.id === id ? data.registry : r));
      }
    } catch (e) {
      console.error('Failed to fetch registry', e);
    }
  }, []);

  useEffect(() => { fetchRegistries(); }, [fetchRegistries]);

  /* ---------- create registry ---------- */
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
        showToast('Registry created', 'success');
        await fetchRegistries();
        setActiveRegistry(data.registry);
        setActiveCharKey('overview');
      }
    } catch (e) {
      showToast('Failed to create registry', 'error');
    }
  };

  /* ---------- seed Book 1 characters ---------- */
  const seedBook1 = async () => {
    if (!activeRegistry) return;
    try {
      const res = await fetch(`${API}/registries/${activeRegistry.id}/seed-book1`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(`Seeded ${data.seeded} characters`, 'success');
        await fetchRegistry(activeRegistry.id);
      } else {
        showToast(data.error || 'Seed failed', 'error');
      }
    } catch (e) {
      showToast('Failed to seed characters', 'error');
    }
  };

  /* ---------- select name ---------- */
  const selectName = async (charId, name) => {
    try {
      const res = await fetch(`${API}/characters/${charId}/select-name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Name selected: ${name}`, 'success');
        await fetchRegistry(activeRegistry.id);
      }
    } catch (e) {
      showToast('Failed to select name', 'error');
    }
  };

  /* ---------- edit character ---------- */
  const startEdit = (char) => {
    setEditForm({
      display_name: char.display_name || '',
      subtitle: char.subtitle || '',
      icon: char.icon || '',
      role_type: char.role_type || 'special',
      role_label: char.role_label || '',
      appearance_mode: char.appearance_mode || 'on_page',
      core_belief: char.core_belief || '',
      pressure_type: char.pressure_type || '',
      pressure_quote: char.pressure_quote || '',
      personality: char.personality || '',
      job_options: char.job_options || '',
      description: char.description || '',
    });
    setEditingChar(true);
  };

  const cancelEdit = () => {
    setEditingChar(false);
    setEditForm({});
  };

  const saveEdit = async (charId) => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/characters/${charId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Character updated', 'success');
        setEditingChar(false);
        setEditForm({});
        await fetchRegistry(activeRegistry.id);
      } else {
        showToast(data.error || 'Save failed', 'error');
      }
    } catch (e) {
      showToast('Failed to save character', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ---------- set status ---------- */
  const setCharStatus = async (charId, status) => {
    try {
      const res = await fetch(`${API}/characters/${charId}/set-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Character ${status}`, 'success');
        await fetchRegistry(activeRegistry.id);
      } else {
        showToast(data.error || 'Failed', 'error');
      }
    } catch (e) {
      showToast('Failed to update status', 'error');
    }
  };

  /* ---------- derived ---------- */
  const characters = activeRegistry?.characters || [];
  const sorted = [...characters].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const activeChar = activeCharKey !== 'overview'
    ? sorted.find(c => c.character_key === activeCharKey)
    : null;

  const statusCounts = {
    draft: sorted.filter(c => c.status === 'draft').length,
    accepted: sorted.filter(c => c.status === 'accepted').length,
    declined: sorted.filter(c => c.status === 'declined').length,
    finalized: sorted.filter(c => c.status === 'finalized').length,
  };

  /* ================================================================ */
  /*  REGISTRY LIST VIEW (no active registry)                          */
  /* ================================================================ */
  if (!activeRegistry) {
    return (
      <div className="cr-page">
        <div className="cr-registry-list">
          <h1>Character Registries</h1>
          <p className="cr-subtitle">PNOS narrative character management</p>

          {loading && <div className="cr-loading">Loading registries…</div>}

          {!loading && registries.length === 0 && (
            <div className="cr-empty">
              <div className="cr-empty-icon">◈</div>
              <p>No registries yet</p>
              <p style={{ fontSize: 12, color: 'var(--ink-faint)' }}>Create one to begin defining characters</p>
            </div>
          )}

          {registries.map(r => (
            <div
              key={r.id}
              className="cr-registry-item"
              onClick={() => { setActiveRegistry(r); setActiveCharKey('overview'); }}
            >
              <div className="cr-registry-item-left">
                <h3>{r.title || 'Untitled'}</h3>
                <p>{r.book_tag || 'no tag'} · {r.status || 'draft'}</p>
              </div>
              <div className="cr-registry-item-right">
                <div className="count">{r.characters?.length || 0}</div>
                characters
              </div>
            </div>
          ))}

          <button className="cr-create-btn" onClick={createRegistry}>
            + New Character Registry
          </button>
        </div>

        {toast && <Toast key={toast.key} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  /* ================================================================ */
  /*  REGISTRY DETAIL (with sidebar + main)                            */
  /* ================================================================ */
  return (
    <div className="cr-page">
      <div className="cr-layout">
        {/* ===== INTERNAL SIDEBAR ===== */}
        <aside className="cr-sidebar">
          <div className="cr-sidebar-header">
            <div className="cr-sidebar-brand">PNOS / Character Registry</div>
            <h2 className="cr-sidebar-title">{activeRegistry.title || 'Untitled'}</h2>
            <div className="cr-sidebar-book-tag">{activeRegistry.book_tag || ''}</div>
          </div>

          <nav className="cr-sidebar-nav">
            {/* Overview */}
            <button
              className={`cr-nav-item ${activeCharKey === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveCharKey('overview')}
            >
              <span className="cr-nav-icon">⊞</span>
              <span className="cr-nav-label">Overview</span>
            </button>

            <div className="cr-nav-divider" />

            {/* Character list */}
            {sorted.map(c => (
              <button
                key={c.id}
                className={`cr-nav-item ${activeCharKey === c.character_key ? 'active' : ''}`}
                onClick={() => setActiveCharKey(c.character_key)}
              >
                <span className="cr-nav-icon">{c.icon || '○'}</span>
                <span className="cr-nav-label">{c.display_name}</span>
                <span className={`cr-nav-dot ${c.status}`} />
              </button>
            ))}
          </nav>

          <div className="cr-sidebar-footer">
            <button className="cr-sidebar-btn" onClick={() => { setActiveRegistry(null); setActiveCharKey('overview'); }}>
              ← Back
            </button>
            {sorted.length === 0 && (
              <button className="cr-sidebar-btn primary" onClick={seedBook1}>
                Seed Book 1
              </button>
            )}
          </div>
        </aside>

        {/* ===== MAIN CONTENT ===== */}
        <main className="cr-main">
          {/* Top breadcrumb */}
          <div className="cr-topbar">
            <div className="cr-topbar-breadcrumb">
              PNOS &nbsp;/&nbsp; <span>Character Registry</span> &nbsp;/&nbsp; {activeRegistry.title}
            </div>
          </div>

          {activeCharKey === 'overview' ? (
            /* ---------- OVERVIEW ---------- */
            <>
              <div className="cr-overview-header">
                <h1>{activeRegistry.title}</h1>
                <p className="cr-subtitle">{activeRegistry.description}</p>
                {activeRegistry.core_rule && (
                  <div className="cr-core-rule">
                    <strong>Core Rule:</strong> {activeRegistry.core_rule}
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="cr-stats">
                <div className="cr-stat">
                  <span className="cr-stat-count">{sorted.length}</span> Characters
                </div>
                <div className="cr-stat draft">
                  <span className="cr-stat-count">{statusCounts.draft}</span> Draft
                </div>
                <div className="cr-stat accepted">
                  <span className="cr-stat-count">{statusCounts.accepted}</span> Accepted
                </div>
                <div className="cr-stat finalized">
                  <span className="cr-stat-count">{statusCounts.finalized}</span> Finalized
                </div>
                {statusCounts.declined > 0 && (
                  <div className="cr-stat declined">
                    <span className="cr-stat-count">{statusCounts.declined}</span> Declined
                  </div>
                )}
              </div>

              {/* Character grid */}
              {sorted.length === 0 ? (
                <div className="cr-empty">
                  <div className="cr-empty-icon">◈</div>
                  <p>No characters in this registry</p>
                  <button className="cr-create-btn" onClick={seedBook1} style={{ maxWidth: 340, margin: '16px auto' }}>
                    Seed Book 1 Characters
                  </button>
                </div>
              ) : (
                <div className="cr-grid">
                  {sorted.map(c => (
                    <div
                      key={c.id}
                      className={`cr-card role-${c.role_type} ${c.character_key === 'the-algorithm' ? 'algorithm-card' : ''}`}
                      onClick={() => setActiveCharKey(c.character_key)}
                    >
                      <div className="cr-card-top">
                        <span className="cr-card-icon">{c.icon || '○'}</span>
                        <span className={`cr-card-status ${c.status}`}>{c.status}</span>
                      </div>
                      <h3 className="cr-card-name">{c.display_name}</h3>
                      <p className="cr-card-subtitle">{c.subtitle}</p>
                      <span className={`cr-card-role ${c.role_type}`}>
                        {c.role_label || c.role_type}
                      </span>
                      {c.pressure_quote && (
                        <p className="cr-card-quote">{c.pressure_quote}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : activeChar ? (
            /* ---------- CHARACTER DETAIL ---------- */
            <div className="cr-detail">
              {editingChar ? (
                /* ===== EDIT MODE ===== */
                <>
                  <div className="cr-edit-header">
                    <h2>Edit Character</h2>
                    <div className="cr-edit-header-actions">
                      <button className="cr-action-btn" onClick={cancelEdit}>Cancel</button>
                      <button className="cr-action-btn accept" onClick={() => saveEdit(activeChar.id)} disabled={saving}>
                        {saving ? 'Saving…' : '✓ Save'}
                      </button>
                    </div>
                  </div>

                  <div className="cr-edit-form">
                    <div className="cr-edit-row">
                      <CrField label="Display Name" value={editForm.display_name} onChange={v => setEditForm(f => ({ ...f, display_name: v }))} />
                      <CrField label="Icon" value={editForm.icon} onChange={v => setEditForm(f => ({ ...f, icon: v }))} small />
                    </div>
                    <CrField label="Subtitle" value={editForm.subtitle} onChange={v => setEditForm(f => ({ ...f, subtitle: v }))} />

                    <div className="cr-edit-row">
                      <CrSelect label="Role Type" value={editForm.role_type} onChange={v => setEditForm(f => ({ ...f, role_type: v }))}
                        options={[
                          { value: 'pressure', label: 'Pressure' },
                          { value: 'mirror', label: 'Mirror' },
                          { value: 'support', label: 'Support' },
                          { value: 'shadow', label: 'Shadow' },
                          { value: 'special', label: 'Special' },
                        ]}
                      />
                      <CrField label="Role Label" value={editForm.role_label} onChange={v => setEditForm(f => ({ ...f, role_label: v }))} />
                    </div>

                    <CrSelect label="Appearance Mode" value={editForm.appearance_mode} onChange={v => setEditForm(f => ({ ...f, appearance_mode: v }))}
                      options={[
                        { value: 'on_page', label: 'On Page' },
                        { value: 'composite', label: 'Composite' },
                        { value: 'observed', label: 'Observed' },
                        { value: 'invisible', label: 'Invisible' },
                        { value: 'brief', label: 'Brief' },
                      ]}
                    />

                    <CrTextArea label="Core Belief" value={editForm.core_belief} onChange={v => setEditForm(f => ({ ...f, core_belief: v }))} rows={2} />
                    <CrField label="Pressure Type" value={editForm.pressure_type} onChange={v => setEditForm(f => ({ ...f, pressure_type: v }))} />
                    <CrTextArea label="Pressure Quote" value={editForm.pressure_quote} onChange={v => setEditForm(f => ({ ...f, pressure_quote: v }))} rows={2} />
                    <CrField label="Personality" value={editForm.personality} onChange={v => setEditForm(f => ({ ...f, personality: v }))} hint="Comma-separated traits" />
                    <CrField label="Job Options" value={editForm.job_options} onChange={v => setEditForm(f => ({ ...f, job_options: v }))} />
                    <CrTextArea label="Description" value={editForm.description} onChange={v => setEditForm(f => ({ ...f, description: v }))} rows={4} />
                  </div>
                </>
              ) : (
                /* ===== READ MODE ===== */
                <>
              <div className="cr-detail-header">
                <div className="cr-detail-icon">{activeChar.icon || '○'}</div>
                <div className="cr-detail-meta">
                  <h2>{activeChar.display_name}</h2>
                  <p className="cr-subtitle">{activeChar.subtitle}</p>
                  <div className="cr-detail-badges">
                    <span className={`cr-badge role-${activeChar.role_type}`}>
                      {activeChar.role_label || activeChar.role_type}
                    </span>
                    <span className="cr-badge mode">
                      {MODE_LABELS[activeChar.appearance_mode] || activeChar.appearance_mode}
                    </span>
                    <span className={`cr-card-status ${activeChar.status}`} style={{ marginLeft: 4 }}>
                      {activeChar.status}
                    </span>
                  </div>
                </div>
                {activeChar.status !== 'finalized' && (
                  <button className="cr-action-btn edit" onClick={() => startEdit(activeChar)} style={{ marginLeft: 'auto' }}>
                    ✎ Edit
                  </button>
                )}
              </div>

              {/* Core Belief */}
              {activeChar.core_belief && (
                <div className="cr-section">
                  <div className="cr-section-label">Core Belief</div>
                  <div className="cr-section-content">
                    <p>{activeChar.core_belief}</p>
                  </div>
                </div>
              )}

              {/* Pressure Quote */}
              {activeChar.pressure_quote && (
                <div className="cr-section">
                  <div className="cr-section-label">Pressure / Quote</div>
                  <div className="cr-quote">{activeChar.pressure_quote}</div>
                </div>
              )}

              {/* Pressure Type */}
              {activeChar.pressure_type && (
                <div className="cr-section">
                  <div className="cr-section-label">Pressure Type</div>
                  <div className="cr-section-content">
                    <p>{activeChar.pressure_type}</p>
                  </div>
                </div>
              )}

              {/* Personality */}
              {activeChar.personality && (
                <div className="cr-section">
                  <div className="cr-section-label">Personality</div>
                  <div className="cr-pills">
                    {activeChar.personality.split(',').map((trait, i) => (
                      <span key={i} className="cr-pill">{trait.trim()}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Job Options */}
              {activeChar.job_options && (
                <div className="cr-section">
                  <div className="cr-section-label">Job Options</div>
                  <div className="cr-section-content">
                    <p>{activeChar.job_options}</p>
                  </div>
                </div>
              )}

              {/* Description */}
              {activeChar.description && (
                <div className="cr-section">
                  <div className="cr-section-label">Description</div>
                  <div className="cr-section-content">
                    <p>{activeChar.description}</p>
                  </div>
                </div>
              )}

              {/* Name Selection */}
              {activeChar.name_options && Array.isArray(activeChar.name_options) && activeChar.name_options.length > 0 && (
                <div className="cr-section">
                  <div className="cr-section-label">Name Selection</div>
                  <div className="cr-name-options">
                    {activeChar.name_options.map((name, i) => (
                      <button
                        key={i}
                        className={`cr-name-btn ${activeChar.selected_name === name ? 'selected' : ''} ${activeChar.status === 'finalized' ? 'disabled' : ''}`}
                        onClick={() => {
                          if (activeChar.status !== 'finalized') selectName(activeChar.id, name);
                        }}
                        disabled={activeChar.status === 'finalized'}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Personality Matrix */}
              {activeChar.personality_matrix && Array.isArray(activeChar.personality_matrix) && activeChar.personality_matrix.length > 0 && (
                <div className="cr-section">
                  <div className="cr-section-label">Personality Matrix</div>
                  <table className="cr-matrix">
                    <thead>
                      <tr>
                        <th>Dimension</th>
                        <th>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeChar.personality_matrix.map((row, i) => (
                        <tr key={i}>
                          <td>{row.dimension}</td>
                          <td>{row.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Actions */}
              <div className="cr-actions">
                {activeChar.status !== 'finalized' && (
                  <>
                    {activeChar.status !== 'accepted' && (
                      <button className="cr-action-btn accept" onClick={() => setCharStatus(activeChar.id, 'accepted')}>
                        ✓ Accept
                      </button>
                    )}
                    {activeChar.status !== 'declined' && (
                      <button className="cr-action-btn decline" onClick={() => setCharStatus(activeChar.id, 'declined')}>
                        ✗ Decline
                      </button>
                    )}
                    {activeChar.status === 'accepted' && (
                      <button className="cr-action-btn finalize" onClick={() => setCharStatus(activeChar.id, 'finalized')}>
                        ◆ Finalize
                      </button>
                    )}
                  </>
                )}
                {activeChar.status === 'finalized' && (
                  <span style={{ color: 'var(--gold)', fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: 1 }}>
                    ◆ FINALIZED — LOCKED
                  </span>
                )}
              </div>
                </>
              )}
            </div>
          ) : (
            <div className="cr-empty">
              <p>Character not found</p>
            </div>
          )}
        </main>
      </div>

      {toast && <Toast key={toast.key} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

/* ================================================================== */
/*  Edit form field components                                         */
/* ================================================================== */

function CrField({ label, value, onChange, hint, small }) {
  return (
    <div className={`cr-edit-field ${small ? 'small' : ''}`}>
      <label className="cr-edit-label">{label}</label>
      <input
        className="cr-edit-input"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={label}
      />
      {hint && <span className="cr-edit-hint">{hint}</span>}
    </div>
  );
}

function CrSelect({ label, value, onChange, options }) {
  return (
    <div className="cr-edit-field">
      <label className="cr-edit-label">{label}</label>
      <select
        className="cr-edit-input cr-edit-select"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function CrTextArea({ label, value, onChange, rows = 3 }) {
  return (
    <div className="cr-edit-field">
      <label className="cr-edit-label">{label}</label>
      <textarea
        className="cr-edit-input cr-edit-textarea"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={label}
      />
    </div>
  );
}
