import React, { useState, useEffect, useCallback } from 'react';
import './WorldLocations.css';

const API = import.meta.env.VITE_API_URL || '/api/v1';

/* ═══════════════════════════════════════════════════════════════════════
   WorldLocations.jsx — Standalone locations page
   ═══════════════════════════════════════════════════════════════════════ */

export default function WorldLocations() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', location_type: 'interior', narrative_role: '' });
  const [editId, setEditId] = useState(null);
  const [toast, setToast] = useState(null);

  const flash = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const loadLocations = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/world/locations`);
      const d = await r.json();
      setLocations(d.locations || []);
    } catch (e) { console.error('loadLocations', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadLocations(); }, [loadLocations]);

  const seedInfrastructure = useCallback(async () => {
    try {
      const r = await fetch(`${API}/world/locations/seed-infrastructure`, { method: 'POST' });
      const d = await r.json();
      flash(`Seeded ${d.created || 0} locations`);
      loadLocations();
    } catch (e) { flash('Seed failed', 'error'); }
  }, [flash, loadLocations]);

  const saveLocation = useCallback(async () => {
    const method = editId ? 'PUT' : 'POST';
    const url = editId ? `${API}/world/locations/${editId}` : `${API}/world/locations`;
    try {
      await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      flash(editId ? 'Location updated' : 'Location created');
      setForm({ name: '', description: '', location_type: 'interior', narrative_role: '' });
      setEditId(null);
      loadLocations();
    } catch (e) { flash('Save failed', 'error'); }
  }, [editId, form, flash, loadLocations]);

  const deleteLocation = useCallback(async (id) => {
    try {
      await fetch(`${API}/world/locations/${id}`, { method: 'DELETE' });
      flash('Location deleted');
      loadLocations();
    } catch (e) { flash('Delete failed', 'error'); }
  }, [flash, loadLocations]);

  return (
    <div className="wl-page">
      <div className="wl-container">
        <div className="wl-header">
          <div>
            <h1 className="wl-title">World Locations</h1>
            <p className="wl-subtitle">Manage the places and spaces of your universe</p>
          </div>
          <button className="wl-btn wl-btn-outline" onClick={seedInfrastructure}>Seed Infrastructure</button>
        </div>

        {/* Create / Edit form */}
        <div className="wl-form-card">
          <div className="wl-form-heading">{editId ? 'Edit Location' : 'New Location'}</div>
          <div className="wl-form-grid">
            <input className="wl-input" placeholder="Name *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            <select className="wl-select" value={form.location_type} onChange={e => setForm(p => ({ ...p, location_type: e.target.value }))}>
              <option value="interior">Interior</option>
              <option value="exterior">Exterior</option>
              <option value="virtual">Virtual</option>
              <option value="transitional">Transitional</option>
            </select>
            <input className="wl-input" placeholder="Narrative Role" value={form.narrative_role} onChange={e => setForm(p => ({ ...p, narrative_role: e.target.value }))} />
            <textarea className="wl-input wl-textarea" placeholder="Description" rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="wl-form-actions">
            <button className="wl-btn wl-btn-primary" onClick={saveLocation} disabled={!form.name}>{editId ? 'Update' : 'Create'}</button>
            {editId && <button className="wl-btn wl-btn-ghost" onClick={() => { setEditId(null); setForm({ name: '', description: '', location_type: 'interior', narrative_role: '' }); }}>Cancel</button>}
          </div>
        </div>

        {/* Location grid */}
        {loading ? (
          <div className="wl-loading">Loading…</div>
        ) : locations.length === 0 ? (
          <div className="wl-empty">No locations yet — seed infrastructure or create one above.</div>
        ) : (
          <div className="wl-grid">
            {locations.map(loc => (
              <div key={loc.id} className="wl-card">
                <div className="wl-card-header">
                  <div>
                    <div className="wl-card-name">{loc.name}</div>
                    <div className="wl-card-meta">{loc.location_type}{loc.narrative_role ? ` · ${loc.narrative_role}` : ''}</div>
                  </div>
                  <div className="wl-card-actions">
                    <button className="wl-btn wl-btn-icon" onClick={() => { setEditId(loc.id); setForm({ name: loc.name, description: loc.description || '', location_type: loc.location_type || 'interior', narrative_role: loc.narrative_role || '' }); }}>✎</button>
                    <button className="wl-btn wl-btn-icon wl-btn-danger" onClick={() => deleteLocation(loc.id)}>✕</button>
                  </div>
                </div>
                {loc.description && <div className="wl-card-desc">{loc.description}</div>}
                {loc.sensory_details && (
                  <div className="wl-card-sensory">
                    {Object.entries(loc.sensory_details).filter(([,v]) => v).map(([k,v]) => (
                      <span key={k} className="wl-sensory-tag">{k}: {v}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`wl-toast ${toast.type === 'error' ? 'wl-toast-error' : ''}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
