/**
 * AssetLibrariesTab.jsx
 * 
 * Hair Library + Makeup Library — lives in Producer Mode inside ShowWorldView.
 * Two sub-tabs side by side. Seed buttons. Add/edit/delete. Upload reference photo URL.
 * 
 * Props:
 *   showId — the current show's UUID
 */

import React, { useState, useEffect, useCallback } from 'react';

const API = '/api/v1/wardrobe';

const VIBE_TAGS = ['sleek', 'voluminous', 'protective', 'editorial', 'casual', 'glam', 'natural', 'cultural'];
const ERA_OPTIONS = ['foundation', 'glow_up', 'luxury', 'prime', 'legacy'];
const MOOD_TAGS = ['dramatic', 'soft-life', 'editorial', 'natural', 'glam', 'minimal'];
const OCCASION_TAGS = ['gala', 'awards', 'press', 'brunch', 'garden', 'date', 'dinner', 'editorial', 'everyday', 'filming', 'soiree', 'cocktail'];

// ── Shared helpers ─────────────────────────────────────────────────────────

function TagPills({ tags, color = '#6B4C82' }) {
  if (!tags?.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {tags.map(t => (
        <span key={t} style={{
          fontSize: 10, padding: '2px 8px', borderRadius: 20,
          background: '#f0f0fa', color: '#666', border: '1px solid #ddd',
        }}>{t}</span>
      ))}
    </div>
  );
}

function EraTag({ era }) {
  if (!era) return null;
  const colors = {
    foundation: '#4A7EA0', glow_up: '#A07E4A', luxury: '#7B5EA8',
    prime: '#4AA07E', legacy: '#A8883B',
  };
  return (
    <span style={{
      fontSize: 10, padding: '2px 8px', borderRadius: 20,
      background: '#f8f8f8', color: colors[era] || '#888',
      border: `1px solid ${colors[era] || '#ddd'}`,
      fontWeight: 700,
    }}>{era?.replace('_', ' ')}</span>
  );
}

function EmptyState({ label, onSeed, seeding }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 24px', color: '#999' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🗄️</div>
      <p style={{ fontSize: 14, marginBottom: 20 }}>No {label} yet.</p>
      <button
        onClick={onSeed}
        disabled={seeding}
        style={{
          background: seeding ? '#ddd' : '#6B4C82', color: '#fff',
          border: 'none', borderRadius: 6, padding: '10px 20px',
          fontSize: 13, cursor: seeding ? 'not-allowed' : 'pointer',
        }}
      >
        {seeding ? '⏳ Seeding…' : `✨ Seed Core ${label}`}
      </button>
    </div>
  );
}

// ── Hair Library ───────────────────────────────────────────────────────────

function HairCard({ item, onEdit, onDelete }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8,
      padding: '14px 16px', position: 'relative',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ color: '#1a1a1a', fontWeight: 700, fontSize: 14 }}>{item.name}</div>
          {item.color_state && (
            <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>🎨 {item.color_state}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <EraTag era={item.era_alignment} />
          {item.rendered_asset_url
            ? <span style={{ fontSize: 10, color: '#2a7a2a', background: '#e8f5e8', padding: '2px 8px', borderRadius: 20, border: '1px solid #b0d8b0' }}>RENDERED</span>
            : <span style={{ fontSize: 10, color: '#888', background: '#f5f5f5', padding: '2px 8px', borderRadius: 20 }}>REF ONLY</span>
          }
        </div>
      </div>

      <TagPills tags={item.vibe_tags} />

      {item.occasion_tags?.length > 0 && (
        <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {item.occasion_tags.map(t => (
            <span key={t} style={{ fontSize: 10, color: '#4A7EA0', background: '#e8f0fa', padding: '2px 6px', borderRadius: 4 }}>{t}</span>
          ))}
        </div>
      )}

      {item.career_echo_potential && (
        <div style={{ marginTop: 10, background: '#f0f0fa', border: '1px solid #d8d8f0', borderRadius: 6, padding: '8px 10px' }}>
          <span style={{ color: '#6060a0', fontSize: 11, fontStyle: 'italic' }}>✦ {item.career_echo_potential}</span>
        </div>
      )}

      {item.reference_photo_url && (
        <div style={{ marginTop: 10 }}>
          <img src={item.reference_photo_url} alt={item.name}
            style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 6, border: '1px solid #ddd' }}
            onError={e => e.target.style.display = 'none'}
          />
        </div>
      )}

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button onClick={() => onEdit(item)} style={editBtnStyle}>Edit</button>
        <button onClick={() => onDelete(item.id)} style={deleteBtnStyle}>Delete</button>
      </div>
    </div>
  );
}

function HairForm({ initial, showId, onSave, onCancel }) {
  const [form, setForm] = useState({
    show_id: showId,
    name: '',
    vibe_tags: [],
    color_state: '',
    occasion_tags: [],
    reference_photo_url: '',
    career_echo_potential: '',
    era_alignment: '',
    notes: '',
    ...initial,
  });

  const toggleTag = (arr, tag) =>
    arr.includes(tag) ? arr.filter(t => t !== tag) : [...arr, tag];

  return (
    <div style={formOverlayStyle}>
      <div style={formPanelStyle}>
        <h3 style={{ color: '#1a1a1a', margin: '0 0 20px', fontSize: 16 }}>
          {initial?.id ? 'Edit Hair Style' : 'Add Hair Style'}
        </h3>

        <label style={labelStyle}>Name
          <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </label>

        <label style={labelStyle}>Color State
          <input style={inputStyle} placeholder="e.g. jet black, honey blonde balayage"
            value={form.color_state} onChange={e => setForm(f => ({ ...f, color_state: e.target.value }))} />
        </label>

        <label style={labelStyle}>Vibe Tags
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {VIBE_TAGS.map(t => (
              <button key={t} type="button"
                onClick={() => setForm(f => ({ ...f, vibe_tags: toggleTag(f.vibe_tags, t) }))}
                style={{ ...tagToggleStyle, ...(form.vibe_tags.includes(t) ? tagActiveStyle : {}) }}
              >{t}</button>
            ))}
          </div>
        </label>

        <label style={labelStyle}>Occasion Tags
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {OCCASION_TAGS.map(t => (
              <button key={t} type="button"
                onClick={() => setForm(f => ({ ...f, occasion_tags: toggleTag(f.occasion_tags, t) }))}
                style={{ ...tagToggleStyle, ...(form.occasion_tags.includes(t) ? tagActiveStyle : {}) }}
              >{t}</button>
            ))}
          </div>
        </label>

        <label style={labelStyle}>Era Alignment
          <select style={selectStyle} value={form.era_alignment}
            onChange={e => setForm(f => ({ ...f, era_alignment: e.target.value }))}>
            <option value="">—</option>
            {ERA_OPTIONS.map(e => <option key={e} value={e}>{e.replace('_', ' ')}</option>)}
          </select>
        </label>

        <label style={labelStyle}>Reference Photo URL
          <input style={inputStyle} placeholder="S3 URL"
            value={form.reference_photo_url}
            onChange={e => setForm(f => ({ ...f, reference_photo_url: e.target.value }))} />
        </label>

        <label style={labelStyle}>Career Echo Potential
          <textarea style={{ ...inputStyle, height: 70, resize: 'vertical' }}
            placeholder="How this look connects to JustAWoman's journey or franchise mythology…"
            value={form.career_echo_potential}
            onChange={e => setForm(f => ({ ...f, career_echo_potential: e.target.value }))} />
        </label>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={() => onSave(form)} style={saveBtnStyle}>Save</button>
          <button onClick={onCancel} style={cancelBtnStyle}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Makeup Library ─────────────────────────────────────────────────────────

function MakeupCard({ item, onEdit, onDelete }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ color: '#1a1a1a', fontWeight: 700, fontSize: 14 }}>{item.name}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {item.mood_tag && (
              <span style={{ fontSize: 11, color: '#8B7020', background: '#faf5e0', padding: '2px 8px', borderRadius: 20 }}>
                {item.mood_tag}
              </span>
            )}
            {item.occasion_tag && (
              <span style={{ fontSize: 11, color: '#888' }}>{item.occasion_tag}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <EraTag era={item.era_alignment} />
          {item.rendered_face_state_url
            ? <span style={{ fontSize: 10, color: '#2a7a2a', background: '#e8f5e8', padding: '2px 8px', borderRadius: 20, border: '1px solid #b0d8b0' }}>RENDERED</span>
            : <span style={{ fontSize: 10, color: '#888', background: '#f5f5f5', padding: '2px 8px', borderRadius: 20 }}>REF ONLY</span>
          }
        </div>
      </div>

      {item.event_types?.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
          {item.event_types.map(t => (
            <span key={t} style={{ fontSize: 10, color: '#4A7EA0', background: '#e8f0fa', padding: '2px 6px', borderRadius: 4 }}>{t}</span>
          ))}
        </div>
      )}

      {item.career_echo_potential && (
        <div style={{ marginTop: 10, background: '#f0f0fa', border: '1px solid #d8d8f0', borderRadius: 6, padding: '8px 10px' }}>
          <span style={{ color: '#6060a0', fontSize: 11, fontStyle: 'italic' }}>✦ {item.career_echo_potential}</span>
        </div>
      )}

      {item.reference_photo_url && (
        <img src={item.reference_photo_url} alt={item.name}
          style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 6, border: '1px solid #ddd', marginTop: 10 }}
          onError={e => e.target.style.display = 'none'}
        />
      )}

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button onClick={() => onEdit(item)} style={editBtnStyle}>Edit</button>
        <button onClick={() => onDelete(item.id)} style={deleteBtnStyle}>Delete</button>
      </div>
    </div>
  );
}

function MakeupForm({ initial, showId, onSave, onCancel }) {
  const [form, setForm] = useState({
    show_id: showId, name: '', mood_tag: '', occasion_tag: '',
    event_types: [], reference_photo_url: '', career_echo_potential: '',
    era_alignment: '', notes: '', ...initial,
  });

  const toggleEvt = tag =>
    setForm(f => ({
      ...f,
      event_types: f.event_types.includes(tag)
        ? f.event_types.filter(t => t !== tag)
        : [...f.event_types, tag],
    }));

  return (
    <div style={formOverlayStyle}>
      <div style={formPanelStyle}>
        <h3 style={{ color: '#1a1a1a', margin: '0 0 20px', fontSize: 16 }}>
          {initial?.id ? 'Edit Makeup Look' : 'Add Makeup Look'}
        </h3>

        <label style={labelStyle}>Name
          <input style={inputStyle} placeholder="e.g. Velour Gala Face"
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={labelStyle}>Mood Tag
            <select style={selectStyle} value={form.mood_tag}
              onChange={e => setForm(f => ({ ...f, mood_tag: e.target.value }))}>
              <option value="">—</option>
              {MOOD_TAGS.map(m => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label style={labelStyle}>Primary Occasion
            <input style={inputStyle} placeholder="e.g. gala"
              value={form.occasion_tag} onChange={e => setForm(f => ({ ...f, occasion_tag: e.target.value }))} />
          </label>
        </div>

        <label style={labelStyle}>Compatible Event Types
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {OCCASION_TAGS.map(t => (
              <button key={t} type="button"
                onClick={() => toggleEvt(t)}
                style={{ ...tagToggleStyle, ...(form.event_types.includes(t) ? tagActiveStyle : {}) }}
              >{t}</button>
            ))}
          </div>
        </label>

        <label style={labelStyle}>Era Alignment
          <select style={selectStyle} value={form.era_alignment}
            onChange={e => setForm(f => ({ ...f, era_alignment: e.target.value }))}>
            <option value="">—</option>
            {ERA_OPTIONS.map(e => <option key={e} value={e}>{e.replace('_', ' ')}</option>)}
          </select>
        </label>

        <label style={labelStyle}>Reference Photo URL
          <input style={inputStyle} placeholder="S3 URL"
            value={form.reference_photo_url}
            onChange={e => setForm(f => ({ ...f, reference_photo_url: e.target.value }))} />
        </label>

        <label style={labelStyle}>Career Echo Potential
          <textarea style={{ ...inputStyle, height: 70, resize: 'vertical' }}
            value={form.career_echo_potential}
            onChange={e => setForm(f => ({ ...f, career_echo_potential: e.target.value }))} />
        </label>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={() => onSave(form)} style={saveBtnStyle}>Save</button>
          <button onClick={onCancel} style={cancelBtnStyle}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function AssetLibrariesTab({ showId }) {
  const [tab, setTab] = useState('hair');
  const [hairItems, setHairItems] = useState([]);
  const [makeupItems, setMakeupItems] = useState([]);
  const [hairForm, setHairForm] = useState(null);    // null | {} | item
  const [makeupForm, setMakeupForm] = useState(null);
  const [seeding, setSeeding] = useState(null);
  const [loadingHair, setLoadingHair] = useState(false);
  const [loadingMakeup, setLoadingMakeup] = useState(false);

  const loadHair = useCallback(async () => {
    if (!showId) return;
    setLoadingHair(true);
    try {
      const res = await fetch(`${API}/hair/${showId}`);
      const data = await res.json();
      setHairItems(data.items || []);
    } catch (e) { console.error(e); }
    finally { setLoadingHair(false); }
  }, [showId]);

  const loadMakeup = useCallback(async () => {
    if (!showId) return;
    setLoadingMakeup(true);
    try {
      const res = await fetch(`${API}/makeup/${showId}`);
      const data = await res.json();
      setMakeupItems(data.items || []);
    } catch (e) { console.error(e); }
    finally { setLoadingMakeup(false); }
  }, [showId]);

  useEffect(() => { loadHair(); loadMakeup(); }, [loadHair, loadMakeup]);

  // Hair CRUD
  const saveHair = async (form) => {
    const method = form.id ? 'PUT' : 'POST';
    const url = form.id ? `${API}/hair/${form.id}` : `${API}/hair`;
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setHairForm(null);
    loadHair();
  };

  const deleteHair = async (id) => {
    if (!window.confirm('Delete this hair style?')) return;
    await fetch(`${API}/hair/${id}`, { method: 'DELETE' });
    loadHair();
  };

  const seedHair = async () => {
    setSeeding('hair');
    try {
      await fetch(`${API}/hair/seed/${showId}`, { method: 'POST' });
      loadHair();
    } finally { setSeeding(null); }
  };

  // Makeup CRUD
  const saveMakeup = async (form) => {
    const method = form.id ? 'PUT' : 'POST';
    const url = form.id ? `${API}/makeup/${form.id}` : `${API}/makeup`;
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setMakeupForm(null);
    loadMakeup();
  };

  const deleteMakeup = async (id) => {
    if (!window.confirm('Delete this makeup look?')) return;
    await fetch(`${API}/makeup/${id}`, { method: 'DELETE' });
    loadMakeup();
  };

  const seedMakeup = async () => {
    setSeeding('makeup');
    try {
      await fetch(`${API}/makeup/seed/${showId}`, { method: 'POST' });
      loadMakeup();
    } finally { setSeeding(null); }
  };

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', padding: 24 }}>

      {/* Forms */}
      {hairForm && (
        <HairForm
          initial={hairForm?.id ? hairForm : {}}
          showId={showId}
          onSave={saveHair}
          onCancel={() => setHairForm(null)}
        />
      )}
      {makeupForm && (
        <MakeupForm
          initial={makeupForm?.id ? makeupForm : {}}
          showId={showId}
          onSave={saveMakeup}
          onCancel={() => setMakeupForm(null)}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ color: '#1a1a1a', fontSize: 20, fontWeight: 700, margin: 0 }}>Asset Libraries</h2>
          <p style={{ color: '#888', fontSize: 13, margin: '4px 0 0' }}>
            JustAWoman's hairstyles and makeup looks — source truth for Lala's digital twin
          </p>
        </div>
        <button
          onClick={() => tab === 'hair' ? setHairForm({}) : setMakeupForm({})}
          style={{ background: '#6B4C82', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 18px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
        >
          + Add {tab === 'hair' ? 'Hair Style' : 'Makeup Look'}
        </button>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden', width: 'fit-content' }}>
        {['hair', 'makeup'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 28px', border: 'none', cursor: 'pointer',
            background: tab === t ? '#6B4C82' : 'transparent',
            color: tab === t ? '#fff' : '#888', fontSize: 13, fontWeight: tab === t ? 700 : 400,
          }}>
            {t === 'hair' ? '💇 Hair Library' : '💄 Makeup Library'}
            <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7 }}>
              ({t === 'hair' ? hairItems.length : makeupItems.length})
            </span>
          </button>
        ))}
      </div>

      {/* Hair grid */}
      {tab === 'hair' && (
        loadingHair ? (
          <div style={{ color: '#999', padding: 40, textAlign: 'center' }}>Loading…</div>
        ) : hairItems.length === 0 ? (
          <EmptyState label="Hair Styles" onSeed={seedHair} seeding={seeding === 'hair'} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {hairItems.map(item => (
              <HairCard key={item.id} item={item} onEdit={setHairForm} onDelete={deleteHair} />
            ))}
          </div>
        )
      )}

      {/* Makeup grid */}
      {tab === 'makeup' && (
        loadingMakeup ? (
          <div style={{ color: '#999', padding: 40, textAlign: 'center' }}>Loading…</div>
        ) : makeupItems.length === 0 ? (
          <EmptyState label="Makeup Looks" onSeed={seedMakeup} seeding={seeding === 'makeup'} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {makeupItems.map(item => (
              <MakeupCard key={item.id} item={item} onEdit={setMakeupForm} onDelete={deleteMakeup} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

// ── Shared styles ──────────────────────────────────────────────────────────

const labelStyle = { display: 'flex', flexDirection: 'column', gap: 6, color: '#555', fontSize: 12, fontWeight: 600, marginBottom: 14 };
const inputStyle = { background: '#fff', border: '1px solid #d0d0d0', borderRadius: 6, color: '#1a1a1a', padding: '8px 12px', fontSize: 13 };
const selectStyle = { background: '#fff', border: '1px solid #d0d0d0', borderRadius: 6, color: '#1a1a1a', padding: '8px 12px', fontSize: 13 };
const saveBtnStyle = { flex: 1, background: '#6B4C82', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const cancelBtnStyle = { flex: 1, background: '#f0f0f0', color: '#666', border: '1px solid #ddd', borderRadius: 6, padding: '10px 0', fontSize: 13, cursor: 'pointer' };
const editBtnStyle = { background: '#e8f0fa', color: '#3A6A8A', border: '1px solid #c0d8e8', borderRadius: 4, padding: '4px 12px', fontSize: 12, cursor: 'pointer' };
const deleteBtnStyle = { background: '#fae8e8', color: '#b33', border: '1px solid #e8c0c0', borderRadius: 4, padding: '4px 12px', fontSize: 12, cursor: 'pointer' };
const tagToggleStyle = { background: '#f5f5f5', color: '#888', border: '1px solid #ddd', borderRadius: 20, padding: '4px 12px', fontSize: 11, cursor: 'pointer' };
const tagActiveStyle = { background: '#f0ecf6', color: '#5a3a7a', borderColor: '#c0b0d8' };
const formOverlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const formPanelStyle = { background: '#fff', border: '1px solid #ddd', borderRadius: 12, padding: 28, width: 580, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' };
