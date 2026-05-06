import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';

const API = import.meta.env.VITE_API_URL || '/api/v1';

export const listPropertiesApi = () =>
  apiClient.get(`${API}/properties`).then((r) => r.data);
export const createPropertyApi = (payload) =>
  apiClient.post(`${API}/properties`, payload).then((r) => r.data);
export const addPropertyRoomApi = (propertyId, payload) =>
  apiClient.post(`${API}/properties/${propertyId}/rooms`, payload).then((r) => r.data);

const STYLE_PRESETS = [
  { id: 'modern-glam', label: 'Modern Glam', desc: 'Brushed gold, marble, velvet, crystal — feminine luxury', palette: ['#F5E6E0', '#E8D5E0', '#C9A96E', '#F7F0EA', '#9B7CB6'] },
  { id: 'minimalist-luxury', label: 'Minimalist Luxury', desc: 'Clean lines, matte black, white marble — restrained opulence', palette: ['#F5F3EF', '#2C2C2C', '#C4B5A0', '#E8E4DE', '#8B8178'] },
  { id: 'hollywood-regency', label: 'Hollywood Regency', desc: 'Chrome, black marble, jewel-tone velvet — old Hollywood drama', palette: ['#1A1A2E', '#E8C547', '#8B0000', '#F5F5F5', '#4A0E4E'] },
  { id: 'coastal-luxury', label: 'Coastal Luxury', desc: 'Light woods, white stone, ocean blues — breezy elegance', palette: ['#F7F5F0', '#6B9DAE', '#D4C5A9', '#E8F0F2', '#2C5F6E'] },
];

const ROOM_TEMPLATES = [
  { id: 'bedroom-master-rectangular', label: 'Master Bedroom — Rectangular', type: 'bedroom', desc: 'High ceilings, large windows, closet + en-suite access' },
  { id: 'bedroom-master-open', label: 'Master Suite — Open Plan', type: 'bedroom', desc: 'Grand open plan with sitting area and panoramic windows' },
  { id: 'bedroom-master-balcony', label: 'Master Bedroom — Balcony', type: 'bedroom', desc: 'Sliding glass walls opening to wraparound terrace' },
  { id: 'closet-walkin-large', label: 'Walk-in Closet — Large', type: 'closet', desc: 'Center island, floor-to-ceiling shelving, full-length mirror' },
  { id: 'closet-walkin-boutique', label: 'Walk-in Closet — Boutique', type: 'closet', desc: 'Glass display cases, seating area, chandelier' },
  { id: 'bathroom-ensuite-spa', label: 'En-Suite Bathroom — Spa', type: 'bathroom', desc: 'Freestanding tub, walk-in shower, double vanity' },
  { id: 'living-room-great', label: 'Great Room / Living Room', type: 'living_room', desc: 'Fireplace wall, large windows, open to kitchen' },
  { id: 'terrace-wraparound', label: 'Wraparound Terrace', type: 'terrace', desc: 'Glass railing, panoramic views, multiple seating zones' },
];

const PROPERTY_TYPES = ['penthouse', 'mansion', 'apartment', 'townhouse', 'villa', 'loft'];

export default function PropertyManager() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newProp, setNewProp] = useState({ name: '', property_type: 'penthouse', style_preset_id: 'modern-glam', description: '' });
  const [addingRoom, setAddingRoom] = useState(null);
  const [newRoom, setNewRoom] = useState({ name: '', template_id: '' });
  const [toast, setToast] = useState(null);

  const flash = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  const loadProperties = useCallback(async () => {
    try {
      const d = await listPropertiesApi();
      setProperties(d.data || []);
    } catch { setProperties([]); }
    setLoading(false);
  }, []);

  useEffect(() => { loadProperties(); }, [loadProperties]);

  const createProperty = async () => {
    if (!newProp.name) return;
    setCreating(true);
    try {
      const d = await createPropertyApi(newProp);
      if (d.success) { flash(`Property "${newProp.name}" created!`); setNewProp({ name: '', property_type: 'penthouse', style_preset_id: 'modern-glam', description: '' }); loadProperties(); }
      else flash(d.error || 'Failed', 'error');
    } catch (e) { flash(e.message, 'error'); }
    setCreating(false);
  };

  const addRoom = async (propertyId) => {
    if (!newRoom.name || !newRoom.template_id) return;
    try {
      const d = await addPropertyRoomApi(propertyId, newRoom);
      if (d.success) { flash(`Room "${newRoom.name}" added!`); setNewRoom({ name: '', template_id: '' }); setAddingRoom(null); loadProperties(); }
      else flash(d.error || 'Failed', 'error');
    } catch (e) { flash(e.message, 'error'); }
  };

  const selectedPreset = STYLE_PRESETS.find(p => p.id === newProp.style_preset_id);

  return (
    <div style={{ minHeight: '100dvh', background: '#fafafa', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 32px 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 600, margin: '0 0 4px', color: '#1a1a1a' }}>Property Manager</h1>
            <p style={{ fontSize: 14, color: '#999', margin: 0 }}>Create and manage HOME_BASE properties — multi-room homes for the LalaVerse</p>
          </div>
        </div>

        {/* Create Property form */}
        <div style={{ background: '#fff', borderRadius: 10, padding: 20, marginBottom: 28, border: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: '#333' }}>New Property</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <input value={newProp.name} onChange={e => setNewProp(p => ({ ...p, name: e.target.value }))} placeholder="Property Name (e.g. Lala's Penthouse)" style={{ padding: '8px 12px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6, fontSize: 13 }} />
            <select value={newProp.property_type} onChange={e => setNewProp(p => ({ ...p, property_type: e.target.value }))} style={{ padding: '8px 12px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6, fontSize: 13 }}>
              {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>

          {/* Style preset picker */}
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, textTransform: 'uppercase', color: '#B8962E', marginBottom: 8 }}>Style Guide</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginBottom: 12 }}>
            {STYLE_PRESETS.map(preset => (
              <div key={preset.id} onClick={() => setNewProp(p => ({ ...p, style_preset_id: preset.id }))}
                style={{ padding: '10px 12px', borderRadius: 8, border: newProp.style_preset_id === preset.id ? '2px solid #B8962E' : '1px solid #eee', cursor: 'pointer', background: newProp.style_preset_id === preset.id ? '#FAF7F0' : '#fff' }}>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>{preset.label}</div>
                <div style={{ fontSize: 10, color: '#888', marginBottom: 6 }}>{preset.desc}</div>
                <div style={{ display: 'flex', gap: 3 }}>
                  {preset.palette.map((c, i) => <div key={i} style={{ width: 16, height: 16, borderRadius: '50%', background: c, border: '1px solid #eee' }} />)}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={createProperty} disabled={!newProp.name || creating} style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#B8962E', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              {creating ? '⏳...' : '+ Create Property'}
            </button>
          </div>
        </div>

        {/* Properties list */}
        {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Loading...</div> :
          properties.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, background: '#FAF7F0', border: '1px solid #e8e0d0', borderRadius: 10 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏠</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No properties yet</div>
              <div style={{ fontSize: 13, color: '#666' }}>Create a property above to start building Lala's home.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {properties.map(prop => (
                <div key={prop.id} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 10, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#2C2C2C' }}>🏠 {prop.name}</h3>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                        {prop.metadata?.property_type || prop.property_type || 'property'}
                        {prop.metadata?.style_guide?.label && ` · ${prop.metadata.style_guide.label}`}
                      </div>
                    </div>
                    <button onClick={() => setAddingRoom(addingRoom === prop.id ? null : prop.id)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #B8962E', background: 'transparent', color: '#B8962E', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                      {addingRoom === prop.id ? '✕ Cancel' : '+ Add Room'}
                    </button>
                  </div>

                  {/* Rooms */}
                  {prop.childLocations?.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginBottom: 12 }}>
                      {prop.childLocations.map(room => {
                        const sceneSet = room.sceneSets?.[0];
                        return (
                          <div key={room.id} style={{ padding: 10, border: '1px solid #eee', borderRadius: 8, background: '#fafafa' }}>
                            {sceneSet?.base_still_url && (
                              <img src={sceneSet.base_still_url} alt={room.name} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6, marginBottom: 6 }} />
                            )}
                            <div style={{ fontWeight: 600, fontSize: 12 }}>{room.name}</div>
                            <div style={{ fontSize: 10, color: '#888' }}>{room.location_type}</div>
                            {sceneSet && (
                              <button onClick={() => navigate(`/scene-library`)} style={{ marginTop: 6, padding: '3px 8px', borderRadius: 4, border: '1px solid #ddd', background: '#fff', fontSize: 10, cursor: 'pointer' }}>
                                Open in Scene Studio
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add room form */}
                  {addingRoom === prop.id && (
                    <div style={{ padding: 12, background: '#FAF7F0', borderRadius: 8, border: '1px solid #e8e0d0' }}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, textTransform: 'uppercase', color: '#B8962E', marginBottom: 8 }}>Add Room</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                        <input value={newRoom.name} onChange={e => setNewRoom(p => ({ ...p, name: e.target.value }))} placeholder="Room name (e.g. Master Bedroom)" style={{ padding: '8px 12px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6, fontSize: 12 }} />
                        <select value={newRoom.template_id} onChange={e => setNewRoom(p => ({ ...p, template_id: e.target.value }))} style={{ padding: '8px 12px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6, fontSize: 12 }}>
                          <option value="">Select layout template</option>
                          {ROOM_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label} — {t.desc}</option>)}
                        </select>
                      </div>
                      <button onClick={() => addRoom(prop.id)} disabled={!newRoom.name || !newRoom.template_id} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#B8962E', color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                        + Add Room
                      </button>
                    </div>
                  )}

                  {!prop.childLocations?.length && addingRoom !== prop.id && (
                    <div style={{ fontSize: 12, color: '#999', fontStyle: 'italic' }}>No rooms yet — click "Add Room" to start building</div>
                  )}
                </div>
              ))}
            </div>
          )
        }
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: toast.type === 'error' ? '#c45a5a' : '#1a1a1a', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, zIndex: 9999 }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
