/**
 * WorldFoundation — Map + Locations + Loop
 * Merges: WorldInfrastructure + WorldLocations
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import usePageData from '../hooks/usePageData';
import { EditItemModal, PageEditContext, EditableList, usePageEdit } from '../components/EditItemModal';
import PushToBrain from '../components/PushToBrain';
import DreamMap from '../components/DreamMap';
import { DREAM_CITIES, UNIVERSITIES, CORPORATIONS, WORLD_LAYERS } from '../data/dreamCities';

const API = import.meta.env.VITE_API_URL || '/api/v1';
const DEFAULTS = { DREAM_CITIES, UNIVERSITIES, CORPORATIONS, WORLD_LAYERS };

const TABS = [
  { key: 'map', label: 'The Map' },
  { key: 'locations', label: 'Locations' },
  { key: 'loop', label: 'The Loop' },
];

const LOCATION_TYPES = [
  { value: 'city', label: 'City' }, { value: 'district', label: 'District' },
  { value: 'street', label: 'Street' }, { value: 'venue', label: 'Venue / Business' },
  { value: 'property', label: 'Property / Home' }, { value: 'interior', label: 'Interior Space' },
  { value: 'exterior', label: 'Exterior / Outdoor' }, { value: 'landmark', label: 'Landmark' },
  { value: 'virtual', label: 'Virtual' }, { value: 'transitional', label: 'Transitional' },
];

const VENUE_TYPES = ['restaurant','club','bar','cafe','salon','spa','gallery','museum','boutique','gym','hotel','office','park','rooftop','theater','other'];
const PROPERTY_TYPES = ['penthouse','mansion','apartment','townhouse','studio','villa','loft','cottage'];

const tabStyle = (active) => ({
  padding: '8px 16px', fontSize: 12, fontWeight: 600, fontFamily: "'DM Mono', monospace",
  background: active ? '#2C2C2C' : 'transparent', color: active ? '#fff' : '#888',
  border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer',
});

const cardStyle = { background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: 14, marginBottom: 8 };
const labelStyle = { fontSize: 10, fontWeight: 600, color: '#B8962E', fontFamily: "'DM Mono', monospace", marginBottom: 4 };
const inputStyle = { padding: '7px 10px', borderRadius: 6, border: '1px solid #e0d9ce', fontSize: 12, width: '100%', boxSizing: 'border-box' };

export default function WorldFoundation() {
  const [tab, setTab] = useState('map');
  const [editItem, setEditItem] = useState(null);
  const { data, updateItem, addItem, removeItem, saving } = usePageData('world_infrastructure', DEFAULTS);

  // Location state
  const [locations, setLocations] = useState([]);
  const [locLoading, setLocLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [toast, setToast] = useState(null);
  const [selectedLoc, setSelectedLoc] = useState(null);
  const emptyForm = { name: '', description: '', location_type: 'venue', narrative_role: '', street_address: '', city: '', district: '', venue_type: '', property_type: '', parent_location_id: '', venue_details: { hours: '', price_level: '', capacity: '', dress_code: '', vibe_tags: [] } };
  const [form, setForm] = useState(emptyForm);

  const flash = useCallback((msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); }, []);

  const loadLocations = useCallback(async () => {
    setLocLoading(true);
    try { const r = await fetch(`${API}/world/locations`); const d = await r.json(); setLocations(d.locations || []); }
    catch (e) { console.error('loadLocations', e); }
    finally { setLocLoading(false); }
  }, []);

  useEffect(() => { loadLocations(); }, [loadLocations]);

  const filtered = useMemo(() => {
    let list = locations;
    if (filterType) list = list.filter(l => l.location_type === filterType);
    if (search) { const q = search.toLowerCase(); list = list.filter(l => [l.name, l.description, l.district, l.city, l.venue_type].some(f => (f || '').toLowerCase().includes(q))); }
    return list;
  }, [locations, filterType, search]);

  const grouped = useMemo(() => ({
    cities: filtered.filter(l => l.location_type === 'city'),
    districts: filtered.filter(l => l.location_type === 'district'),
    venues: filtered.filter(l => l.location_type === 'venue'),
    properties: filtered.filter(l => l.location_type === 'property'),
    others: filtered.filter(l => !['city','district','venue','property'].includes(l.location_type)),
  }), [filtered]);

  const saveLocation = useCallback(async () => {
    const method = editId ? 'PUT' : 'POST';
    const url = editId ? `${API}/world/locations/${editId}` : `${API}/world/locations`;
    try {
      await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      flash(editId ? 'Updated' : 'Created');
      setForm(emptyForm); setEditId(null); setShowForm(false); loadLocations();
    } catch { flash('Save failed', 'error'); }
  }, [editId, form, flash, loadLocations]);

  const deleteLocation = useCallback(async (id) => {
    if (!confirm('Delete this location?')) return;
    try { await fetch(`${API}/world/locations/${id}`, { method: 'DELETE' }); flash('Deleted'); loadLocations(); }
    catch { flash('Delete failed', 'error'); }
  }, [flash, loadLocations]);

  const seedInfra = useCallback(async () => {
    try { const r = await fetch(`${API}/world/locations/seed-infrastructure`, { method: 'POST' }); const d = await r.json(); flash(`Seeded ${d.created || 0} locations`); loadLocations(); }
    catch { flash('Seed failed', 'error'); }
  }, [flash, loadLocations]);

  const startEdit = (loc) => {
    setEditId(loc.id);
    setForm({ name: loc.name || '', description: loc.description || '', location_type: loc.location_type || 'venue', narrative_role: loc.narrative_role || '', street_address: loc.street_address || '', city: loc.city || '', district: loc.district || '', venue_type: loc.venue_type || '', property_type: loc.property_type || '', parent_location_id: loc.parent_location_id || '', venue_details: loc.venue_details || emptyForm.venue_details });
    setShowForm(true);
  };

  // Profile counts by city (for map)
  const [profileCounts, setProfileCounts] = useState([]);
  useEffect(() => {
    fetch('/api/v1/social-profiles/analytics/composition?feed_layer=lalaverse')
      .then(r => r.json()).then(d => {
        const cities = d.cities || {};
        setProfileCounts(Object.entries(cities).map(([city, count]) => ({ city, count })));
      }).catch(() => {});
  }, []);

  return (
    <PageEditContext.Provider value={{ data, setEditItem, removeItem }}>
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#2C2C2C', margin: 0 }}>World Foundation</h1>
          <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>The DREAM map — cities, locations, venues, and how the world connects</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {saving && <span style={{ fontSize: 11, color: '#B8962E' }}>Saving...</span>}
          <PushToBrain pageName="world_infrastructure" data={data} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e8e0d0' }}>
        {TABS.map(t => <button key={t.key} onClick={() => setTab(t.key)} style={tabStyle(tab === t.key)}>{t.label}</button>)}
      </div>

      {/* ── MAP TAB ── */}
      {tab === 'map' && (
        <div>
          <DreamMap locations={locations} profiles={profileCounts} onSelectLocation={loc => setSelectedLoc(loc)} />

          {/* Selected location detail */}
          {selectedLoc && (
            <div style={{ ...cardStyle, marginTop: 16, borderLeft: '3px solid #B8962E' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#2C2C2C' }}>{selectedLoc.name}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{selectedLoc.location_type}{selectedLoc.venue_type ? ` · ${selectedLoc.venue_type}` : ''}{selectedLoc.city ? ` · ${selectedLoc.city}` : ''}</div>
                </div>
                <button onClick={() => setSelectedLoc(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#999' }}>x</button>
              </div>
              {selectedLoc.description && <p style={{ fontSize: 12, color: '#666', margin: '8px 0', lineHeight: 1.5 }}>{selectedLoc.description}</p>}
              {selectedLoc.sceneSets?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={labelStyle}>SCENE SETS ({selectedLoc.sceneSets.length})</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {selectedLoc.sceneSets.map(ss => (
                      <div key={ss.id} style={{ width: 80 }}>
                        {ss.base_still_url ? <img src={ss.base_still_url} alt={ss.name} style={{ width: 80, height: 52, objectFit: 'cover', borderRadius: 6, border: '1px solid #eee' }} /> : <div style={{ width: 80, height: 52, borderRadius: 6, background: '#f0eee8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#aaa' }}>No image</div>}
                        <div style={{ fontSize: 9, color: '#666', marginTop: 2 }}>{ss.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedLoc.events?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={labelStyle}>EVENTS HERE ({selectedLoc.events.length})</div>
                  {selectedLoc.events.slice(0, 3).map(ev => <div key={ev.id} style={{ fontSize: 11, color: '#666', padding: '2px 0' }}>{ev.name} · <span style={{ color: '#999' }}>{ev.event_type}</span></div>)}
                </div>
              )}
            </div>
          )}

          {/* City cards below map */}
          <div style={{ marginTop: 24 }}>
            <div style={labelStyle}>DREAM CITIES</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {(data.DREAM_CITIES || DREAM_CITIES).map(c => (
                <div key={c.key} style={{ ...cardStyle, borderTop: `3px solid ${c.color}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 18 }}>{c.icon}</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: c.color, fontFamily: "'DM Mono', monospace" }}>{c.letter}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2C2C2C', marginTop: 4 }}>{c.name}</div>
                  <div style={{ fontSize: 10, color: c.color, fontFamily: "'DM Mono', monospace" }}>{c.subtitle}</div>
                  <p style={{ fontSize: 11, color: '#666', margin: '6px 0 0', lineHeight: 1.4 }}>{c.energy}</p>
                  <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                    {c.majorEvents.map(e => <span key={e} style={{ fontSize: 9, padding: '2px 6px', background: c.color + '15', color: c.color, borderRadius: 4 }}>{e}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Universities & Corporations */}
          <div style={{ marginTop: 24 }}>
            <div style={labelStyle}>UNIVERSITIES</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
              {(data.UNIVERSITIES || UNIVERSITIES).map(u => (
                <div key={u.name} style={{ ...cardStyle, borderLeft: `3px solid ${u.color}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{u.icon} {u.name}</div>
                  <div style={{ fontSize: 10, color: u.color }}>{u.city} · {u.specialization}</div>
                  <div style={{ display: 'flex', gap: 3, marginTop: 4, flexWrap: 'wrap' }}>
                    {u.programs.map(p => <span key={p} style={{ fontSize: 9, padding: '1px 5px', background: u.color + '12', color: u.color, borderRadius: 3 }}>{p}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <div style={labelStyle}>CORPORATIONS</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
              {(data.CORPORATIONS || CORPORATIONS).map(c => (
                <div key={c.name} style={{ ...cardStyle, borderTop: `3px solid ${c.color}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{c.icon} {c.name}</div>
                  <div style={{ fontSize: 10, color: c.color }}>{c.industry}</div>
                  <p style={{ fontSize: 11, color: '#666', margin: '4px 0 0', lineHeight: 1.4 }}>{c.knownFor}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── LOCATIONS TAB ── */}
      {tab === 'locations' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <input placeholder="Search locations..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, maxWidth: 300 }} />
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={seedInfra} style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, background: '#FAF7F0', border: '1px solid #e8e0d0', borderRadius: 6, cursor: 'pointer', color: '#666' }}>Seed Infrastructure</button>
              <button onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm); }} style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, background: '#2C2C2C', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>+ Add Location</button>
            </div>
          </div>

          {/* Type filters */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
            <button onClick={() => setFilterType('')} style={{ padding: '4px 10px', fontSize: 10, borderRadius: 12, border: '1px solid #e8e0d0', background: !filterType ? '#2C2C2C' : '#fff', color: !filterType ? '#fff' : '#666', cursor: 'pointer', fontWeight: 600 }}>All ({locations.length})</button>
            {LOCATION_TYPES.filter(t => locations.some(l => l.location_type === t.value)).map(t => {
              const ct = locations.filter(l => l.location_type === t.value).length;
              return <button key={t.value} onClick={() => setFilterType(t.value)} style={{ padding: '4px 10px', fontSize: 10, borderRadius: 12, border: '1px solid #e8e0d0', background: filterType === t.value ? '#2C2C2C' : '#fff', color: filterType === t.value ? '#fff' : '#666', cursor: 'pointer', fontWeight: 600 }}>{t.label} ({ct})</button>;
            })}
          </div>

          {/* Create/Edit form */}
          {showForm && (
            <div style={{ ...cardStyle, marginBottom: 16, background: '#FAF7F0', border: '1px solid #e8e0d0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{editId ? 'Edit Location' : 'New Location'}</span>
                <button onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>x</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input style={inputStyle} placeholder="Name *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                <select style={inputStyle} value={form.location_type} onChange={e => setForm(p => ({ ...p, location_type: e.target.value }))}>
                  {LOCATION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <input style={inputStyle} placeholder="City (e.g. Dazzle District)" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
                <input style={inputStyle} placeholder="District" value={form.district} onChange={e => setForm(p => ({ ...p, district: e.target.value }))} />
                <input style={inputStyle} placeholder="Street Address" value={form.street_address} onChange={e => setForm(p => ({ ...p, street_address: e.target.value }))} />
                <input style={inputStyle} placeholder="Narrative Role" value={form.narrative_role} onChange={e => setForm(p => ({ ...p, narrative_role: e.target.value }))} />
                {form.location_type === 'venue' && <select style={inputStyle} value={form.venue_type} onChange={e => setForm(p => ({ ...p, venue_type: e.target.value }))}><option value="">Venue Type</option>{VENUE_TYPES.map(v => <option key={v} value={v}>{v}</option>)}</select>}
                {form.location_type === 'property' && <select style={inputStyle} value={form.property_type} onChange={e => setForm(p => ({ ...p, property_type: e.target.value }))}><option value="">Property Type</option>{PROPERTY_TYPES.map(v => <option key={v} value={v}>{v}</option>)}</select>}
              </div>
              <textarea style={{ ...inputStyle, marginTop: 8, resize: 'vertical' }} rows={2} placeholder="Description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                <button onClick={saveLocation} disabled={!form.name} style={{ padding: '6px 14px', fontSize: 11, fontWeight: 600, background: '#2C2C2C', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>{editId ? 'Update' : 'Create'}</button>
                <button onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm); }} style={{ padding: '6px 14px', fontSize: 11, fontWeight: 600, background: '#fff', color: '#666', border: '1px solid #e8e0d0', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Location cards */}
          {locLoading ? <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>Loading...</div> : filtered.length === 0 ? <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>{search || filterType ? 'No matching locations.' : 'No locations yet — seed infrastructure or add one above.'}</div> : (
            <>
              {[['Cities', grouped.cities], ['Districts', grouped.districts], ['Venues', grouped.venues], ['Properties', grouped.properties], ['Other', grouped.others]].map(([title, items]) => items.length > 0 && (
                <div key={title} style={{ marginBottom: 16 }}>
                  <div style={{ ...labelStyle, marginBottom: 6 }}>{title.toUpperCase()} ({items.length})</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                    {items.map(loc => (
                      <div key={loc.id} style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#2C2C2C' }}>{loc.name}</div>
                            <div style={{ fontSize: 10, color: '#888' }}>{loc.location_type}{loc.venue_type ? ` · ${loc.venue_type}` : ''}{loc.city ? ` · ${loc.city}` : ''}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => startEdit(loc)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#B8962E' }}>Edit</button>
                            <button onClick={() => deleteLocation(loc.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#dc2626' }}>Del</button>
                          </div>
                        </div>
                        {loc.description && <p style={{ fontSize: 11, color: '#666', margin: '4px 0 0', lineHeight: 1.4 }}>{loc.description.slice(0, 100)}{loc.description.length > 100 ? '...' : ''}</p>}
                        {loc.sceneSets?.length > 0 && <div style={{ fontSize: 9, color: '#7ab3d4', marginTop: 4, fontWeight: 600 }}>{loc.sceneSets.length} scene set{loc.sceneSets.length > 1 ? 's' : ''}</div>}
                        {loc.events?.length > 0 && <div style={{ fontSize: 9, color: '#B8962E', marginTop: 2, fontWeight: 600 }}>{loc.events.length} event{loc.events.length > 1 ? 's' : ''}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── LOOP TAB ── */}
      {tab === 'loop' && (
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#2C2C2C', margin: '0 0 4px' }}>How the Entire World Connects</h2>
          <p style={{ fontSize: 12, color: '#888', margin: '0 0 20px' }}>The infrastructure of LalaVerse operates as a single interconnected system.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {(data.WORLD_LAYERS || WORLD_LAYERS).map((l, i, arr) => (
              <React.Fragment key={l.layer}>
                <div style={{ ...cardStyle, borderTop: `3px solid ${l.color}`, minWidth: 160, flex: '1 1 160px' }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{l.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2C2C2C' }}>{l.layer}</div>
                  <p style={{ fontSize: 11, color: '#666', margin: '4px 0', lineHeight: 1.4 }}>{l.whatItDoes}</p>
                  <div style={{ fontSize: 10, color: l.color, fontWeight: 600 }}>{l.feedsInto}</div>
                </div>
                {i < arr.length - 1 && <span style={{ fontSize: 20, color: '#ccc' }}>→</span>}
              </React.Fragment>
            ))}
          </div>
          <div style={{ ...cardStyle, marginTop: 20, background: '#FAF7F0', border: '1px solid #e8e0d0', textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#B8962E', fontFamily: "'DM Mono', monospace" }}>THE LOOP</div>
            <p style={{ fontSize: 12, color: '#555', margin: '6px 0 0', lineHeight: 1.5 }}>Creators influence cultural events. Cultural events get covered by media networks. Media networks are amplified by algorithms. Algorithms build communities. Communities create the demand that makes creators. <strong>The loop completes and accelerates.</strong></p>
          </div>
        </div>
      )}

      {editItem && <EditItemModal item={editItem.item} title={`Edit ${editItem.key}`} onSave={(updated) => { if (editItem.index === -1) addItem(editItem.key, updated); else updateItem(editItem.key, editItem.index, updated); setEditItem(null); }} onCancel={() => setEditItem(null)} />}
    </div>
    {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, zIndex: 9999, background: toast.type === 'error' ? '#fee' : '#e8f5e9', color: toast.type === 'error' ? '#c44' : '#2e7d32', border: `1px solid ${toast.type === 'error' ? '#fcc' : '#c8e6c9'}` }}>{toast.msg}</div>}
    </PageEditContext.Provider>
  );
}
