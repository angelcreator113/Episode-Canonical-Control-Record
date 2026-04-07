import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MapPin, Building2, Store, Home, Trees, Coffee, ShoppingBag, Music, Dumbbell, Palette, Sparkles, ChevronRight, Search, Plus, Pencil, Trash2, X } from 'lucide-react';
import './WorldLocations.css';

const API = import.meta.env.VITE_API_URL || '/api/v1';

const LOCATION_TYPES = [
  { value: 'city', label: 'City', icon: Building2 },
  { value: 'district', label: 'District / Neighborhood', icon: MapPin },
  { value: 'street', label: 'Street', icon: MapPin },
  { value: 'venue', label: 'Venue / Business', icon: Store },
  { value: 'property', label: 'Property / Home', icon: Home },
  { value: 'interior', label: 'Interior Space', icon: Building2 },
  { value: 'exterior', label: 'Exterior / Outdoor', icon: Trees },
  { value: 'landmark', label: 'Landmark', icon: Sparkles },
  { value: 'virtual', label: 'Virtual', icon: Sparkles },
  { value: 'transitional', label: 'Transitional', icon: ChevronRight },
];

const VENUE_TYPES = [
  'restaurant', 'club', 'bar', 'cafe', 'coffee_shop',
  'salon', 'spa', 'gallery', 'museum',
  'shopping_center', 'boutique', 'jewelry_store',
  'gym', 'yoga_studio',
  'recording_studio', 'photo_studio',
  'hotel', 'resort',
  'office', 'coworking',
  'park', 'beach', 'rooftop',
  'theater', 'cinema',
  'church', 'temple',
  'hospital', 'school',
  'airport', 'marina',
  'other',
];

const VENUE_ICONS = {
  restaurant: Store, club: Music, bar: Store, cafe: Coffee, coffee_shop: Coffee,
  salon: Sparkles, spa: Sparkles, gallery: Palette, museum: Palette,
  shopping_center: ShoppingBag, boutique: ShoppingBag, jewelry_store: ShoppingBag,
  gym: Dumbbell, yoga_studio: Dumbbell,
  default: Store,
};

const PROPERTY_TYPES = ['penthouse', 'mansion', 'apartment', 'townhouse', 'studio', 'villa', 'loft', 'cottage'];

function LocationIcon({ type, venueType, size = 14 }) {
  if (type === 'venue' && venueType) {
    const Icon = VENUE_ICONS[venueType] || VENUE_ICONS.default;
    return <Icon size={size} />;
  }
  const match = LOCATION_TYPES.find(t => t.value === type);
  const Icon = match?.icon || MapPin;
  return <Icon size={size} />;
}

export default function WorldLocations() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [toast, setToast] = useState(null);

  const emptyForm = {
    name: '', description: '', location_type: 'venue', narrative_role: '',
    street_address: '', city: '', district: '', venue_type: '', property_type: '',
    parent_location_id: '',
    venue_details: { hours: '', price_level: '', capacity: '', dress_code: '', vibe_tags: [] },
  };
  const [form, setForm] = useState(emptyForm);

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

  const filtered = useMemo(() => {
    let list = locations;
    if (filterType) list = list.filter(l => l.location_type === filterType);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        l.name?.toLowerCase().includes(q) ||
        l.description?.toLowerCase().includes(q) ||
        l.district?.toLowerCase().includes(q) ||
        l.city?.toLowerCase().includes(q) ||
        l.street_address?.toLowerCase().includes(q) ||
        l.venue_type?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [locations, filterType, search]);

  // Group by hierarchy: cities > districts > venues/properties
  const grouped = useMemo(() => {
    const cities = filtered.filter(l => l.location_type === 'city');
    const districts = filtered.filter(l => l.location_type === 'district');
    const venues = filtered.filter(l => l.location_type === 'venue');
    const properties = filtered.filter(l => l.location_type === 'property');
    const others = filtered.filter(l => !['city', 'district', 'venue', 'property'].includes(l.location_type));
    return { cities, districts, venues, properties, others };
  }, [filtered]);

  const seedInfrastructure = useCallback(async () => {
    try {
      const r = await fetch(`${API}/world/locations/seed-infrastructure`, { method: 'POST' });
      const d = await r.json();
      flash(`Seeded ${d.created || 0} locations`);
      loadLocations();
    } catch { flash('Seed failed', 'error'); }
  }, [flash, loadLocations]);

  const saveLocation = useCallback(async () => {
    const method = editId ? 'PUT' : 'POST';
    const url = editId ? `${API}/world/locations/${editId}` : `${API}/world/locations`;
    const payload = { ...form };
    // Clean empty strings
    if (!payload.street_address) delete payload.street_address;
    if (!payload.city) delete payload.city;
    if (!payload.district) delete payload.district;
    if (!payload.venue_type) delete payload.venue_type;
    if (!payload.property_type) delete payload.property_type;
    if (!payload.parent_location_id) delete payload.parent_location_id;
    if (payload.venue_details && !payload.venue_details.hours && !payload.venue_details.price_level) {
      delete payload.venue_details;
    }
    try {
      await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      flash(editId ? 'Location updated' : 'Location created');
      setForm(emptyForm);
      setEditId(null);
      setShowForm(false);
      loadLocations();
    } catch { flash('Save failed', 'error'); }
  }, [editId, form, flash, loadLocations]);

  const deleteLocation = useCallback(async (id) => {
    if (!confirm('Delete this location?')) return;
    try {
      await fetch(`${API}/world/locations/${id}`, { method: 'DELETE' });
      flash('Location deleted');
      loadLocations();
    } catch { flash('Delete failed', 'error'); }
  }, [flash, loadLocations]);

  const startEdit = (loc) => {
    setEditId(loc.id);
    setForm({
      name: loc.name || '',
      description: loc.description || '',
      location_type: loc.location_type || 'venue',
      narrative_role: loc.narrative_role || '',
      street_address: loc.street_address || '',
      city: loc.city || '',
      district: loc.district || '',
      venue_type: loc.venue_type || '',
      property_type: loc.property_type || '',
      parent_location_id: loc.parent_location_id || '',
      venue_details: loc.venue_details || { hours: '', price_level: '', capacity: '', dress_code: '', vibe_tags: [] },
    });
    setShowForm(true);
  };

  const parentOptions = useMemo(() => {
    return locations.filter(l => ['city', 'district', 'property', 'street'].includes(l.location_type));
  }, [locations]);

  const renderCard = (loc) => (
    <div key={loc.id} className="wl-card">
      <div className="wl-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="wl-card-icon">
            <LocationIcon type={loc.location_type} venueType={loc.venue_type} />
          </div>
          <div>
            <div className="wl-card-name">{loc.name}</div>
            <div className="wl-card-meta">
              {loc.location_type}
              {loc.venue_type && ` · ${loc.venue_type.replace('_', ' ')}`}
              {loc.property_type && ` · ${loc.property_type}`}
              {loc.narrative_role && ` · ${loc.narrative_role}`}
            </div>
          </div>
        </div>
        <div className="wl-card-actions">
          <button className="wl-btn wl-btn-icon" onClick={() => startEdit(loc)} title="Edit"><Pencil size={12} /></button>
          <button className="wl-btn wl-btn-icon wl-btn-danger" onClick={() => deleteLocation(loc.id)} title="Delete"><Trash2 size={12} /></button>
        </div>
      </div>

      {/* Address line */}
      {(loc.street_address || loc.district || loc.city) && (
        <div className="wl-card-address">
          <MapPin size={10} />
          {[loc.street_address, loc.district, loc.city].filter(Boolean).join(', ')}
        </div>
      )}

      {loc.description && <div className="wl-card-desc">{loc.description}</div>}

      {/* Venue details */}
      {loc.venue_details && (
        <div className="wl-card-venue-details">
          {loc.venue_details.price_level && <span className="wl-tag">{'$'.repeat(parseInt(loc.venue_details.price_level) || 1)}</span>}
          {loc.venue_details.dress_code && <span className="wl-tag">{loc.venue_details.dress_code}</span>}
          {loc.venue_details.capacity && <span className="wl-tag">Cap: {loc.venue_details.capacity}</span>}
          {loc.venue_details.hours && <span className="wl-tag">{loc.venue_details.hours}</span>}
          {(loc.venue_details.vibe_tags || []).map(t => <span key={t} className="wl-tag wl-tag-vibe">{t}</span>)}
        </div>
      )}

      {/* Scene sets linked */}
      {loc.sceneSets?.length > 0 && (
        <div className="wl-card-scenes">
          {loc.sceneSets.map(ss => (
            <span key={ss.id} className="wl-tag wl-tag-scene">{ss.name}</span>
          ))}
        </div>
      )}
    </div>
  );

  const renderSection = (title, items, icon) => {
    if (items.length === 0) return null;
    const Icon = icon;
    return (
      <div className="wl-section" key={title}>
        <div className="wl-section-header">
          <Icon size={14} /> <span>{title}</span>
          <span className="wl-section-count">{items.length}</span>
        </div>
        <div className="wl-grid">
          {items.map(renderCard)}
        </div>
      </div>
    );
  };

  return (
    <div className="wl-page">
      <div className="wl-container">
        {/* Header */}
        <div className="wl-header">
          <div>
            <h1 className="wl-title">World Locations</h1>
            <p className="wl-subtitle">Streets, districts, venues, properties — every place in the LalaVerse</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="wl-btn wl-btn-outline" onClick={seedInfrastructure}>Seed Infrastructure</button>
            <button className="wl-btn wl-btn-primary" onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm); }}>
              <Plus size={14} /> Add Location
            </button>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="wl-toolbar">
          <div className="wl-search-wrap">
            <Search size={14} className="wl-search-icon" />
            <input className="wl-search" placeholder="Search locations..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="wl-filter-chips">
            <button className={`wl-filter-chip ${!filterType ? 'active' : ''}`} onClick={() => setFilterType('')}>All ({locations.length})</button>
            {LOCATION_TYPES.filter(t => locations.some(l => l.location_type === t.value)).map(t => {
              const count = locations.filter(l => l.location_type === t.value).length;
              return (
                <button key={t.value} className={`wl-filter-chip ${filterType === t.value ? 'active' : ''}`} onClick={() => setFilterType(t.value)}>
                  {t.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Create / Edit form (slide-down) */}
        {showForm && (
          <div className="wl-form-card">
            <div className="wl-form-header">
              <span className="wl-form-heading">{editId ? 'Edit Location' : 'New Location'}</span>
              <button className="wl-btn wl-btn-icon" onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm); }}><X size={14} /></button>
            </div>

            <div className="wl-form-grid">
              <input className="wl-input" placeholder="Name *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />

              <select className="wl-select" value={form.location_type} onChange={e => setForm(p => ({ ...p, location_type: e.target.value }))}>
                {LOCATION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>

              {/* Parent location */}
              <select className="wl-select" value={form.parent_location_id} onChange={e => setForm(p => ({ ...p, parent_location_id: e.target.value }))}>
                <option value="">Parent Location (optional)</option>
                {parentOptions.map(p => <option key={p.id} value={p.id}>{p.name} ({p.location_type})</option>)}
              </select>

              <input className="wl-input" placeholder="Narrative Role (e.g. sanctuary, battleground)" value={form.narrative_role} onChange={e => setForm(p => ({ ...p, narrative_role: e.target.value }))} />
            </div>

            {/* Address fields */}
            <div className="wl-form-section-label">Address</div>
            <div className="wl-form-grid">
              <input className="wl-input" placeholder="Street Address (e.g. 742 Ocean Drive)" value={form.street_address} onChange={e => setForm(p => ({ ...p, street_address: e.target.value }))} />
              <input className="wl-input" placeholder="District / Neighborhood (e.g. South Beach)" value={form.district} onChange={e => setForm(p => ({ ...p, district: e.target.value }))} />
              <input className="wl-input" placeholder="City (e.g. Miami)" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
            </div>

            {/* Venue-specific fields */}
            {form.location_type === 'venue' && (
              <>
                <div className="wl-form-section-label">Venue Details</div>
                <div className="wl-form-grid">
                  <select className="wl-select" value={form.venue_type} onChange={e => setForm(p => ({ ...p, venue_type: e.target.value }))}>
                    <option value="">Venue Type</option>
                    {VENUE_TYPES.map(v => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
                  </select>
                  <select className="wl-select" value={form.venue_details?.price_level || ''} onChange={e => setForm(p => ({ ...p, venue_details: { ...p.venue_details, price_level: e.target.value } }))}>
                    <option value="">Price Level</option>
                    <option value="1">$ — Budget</option>
                    <option value="2">$$ — Moderate</option>
                    <option value="3">$$$ — Upscale</option>
                    <option value="4">$$$$ — Luxury</option>
                    <option value="5">$$$$$ — Ultra</option>
                  </select>
                  <input className="wl-input" placeholder="Capacity (e.g. 200)" value={form.venue_details?.capacity || ''} onChange={e => setForm(p => ({ ...p, venue_details: { ...p.venue_details, capacity: e.target.value } }))} />
                  <input className="wl-input" placeholder="Dress Code (e.g. Black Tie)" value={form.venue_details?.dress_code || ''} onChange={e => setForm(p => ({ ...p, venue_details: { ...p.venue_details, dress_code: e.target.value } }))} />
                  <input className="wl-input" placeholder="Hours (e.g. 6PM - 2AM)" value={form.venue_details?.hours || ''} onChange={e => setForm(p => ({ ...p, venue_details: { ...p.venue_details, hours: e.target.value } }))} />
                </div>
              </>
            )}

            {/* Property-specific fields */}
            {form.location_type === 'property' && (
              <>
                <div className="wl-form-section-label">Property Details</div>
                <div className="wl-form-grid">
                  <select className="wl-select" value={form.property_type} onChange={e => setForm(p => ({ ...p, property_type: e.target.value }))}>
                    <option value="">Property Type</option>
                    {PROPERTY_TYPES.map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
                  </select>
                </div>
              </>
            )}

            <div className="wl-form-section-label">Description</div>
            <textarea className="wl-input wl-textarea" placeholder="Describe this location..." rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />

            <div className="wl-form-actions">
              <button className="wl-btn wl-btn-primary" onClick={saveLocation} disabled={!form.name}>
                {editId ? 'Update Location' : 'Create Location'}
              </button>
              <button className="wl-btn wl-btn-ghost" onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm); }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Location grid — grouped by type */}
        {loading ? (
          <div className="wl-loading">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="wl-empty">
            {search || filterType ? 'No matching locations.' : 'No locations yet — seed infrastructure or add one above.'}
          </div>
        ) : (
          <>
            {renderSection('Cities', grouped.cities, Building2)}
            {renderSection('Districts & Neighborhoods', grouped.districts, MapPin)}
            {renderSection('Venues & Businesses', grouped.venues, Store)}
            {renderSection('Properties & Homes', grouped.properties, Home)}
            {renderSection('Other Locations', grouped.others, MapPin)}
          </>
        )}
      </div>

      {toast && (
        <div className={`wl-toast ${toast.type === 'error' ? 'wl-toast-error' : ''}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
