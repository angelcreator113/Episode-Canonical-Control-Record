/**
 * CharacterRegistryPage — Clean character hub
 *
 * Browse all characters in a grid, quick create, click to view profile.
 * Replaces the 5,750-line monolith with a focused, maintainable page.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const ROLE_CONFIG = {
  protagonist: { color: '#B8962E', bg: '#FAF7F0', icon: '👑', label: 'Protagonist' },
  pressure: { color: '#dc2626', bg: '#fef2f2', icon: '🔥', label: 'Pressure' },
  mirror: { color: '#6366f1', bg: '#eef2ff', icon: '🪞', label: 'Mirror' },
  support: { color: '#16a34a', bg: '#f0fdf4', icon: '🤝', label: 'Support' },
  shadow: { color: '#1e293b', bg: '#f1f5f9', icon: '🌑', label: 'Shadow' },
  special: { color: '#ec4899', bg: '#fdf2f8', icon: '✦', label: 'Special' },
};

const DEPTH_CONFIG = {
  sparked: { color: '#f59e0b', label: 'Sparked', pct: 25 },
  breathing: { color: '#6366f1', label: 'Breathing', pct: 50 },
  active: { color: '#16a34a', label: 'Active', pct: 75 },
  alive: { color: '#B8962E', label: 'Alive', pct: 100 },
};

export default function CharacterRegistryPage() {
  const navigate = useNavigate();
  const [registries, setRegistries] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ display_name: '', role_type: 'pressure', icon: '👤' });
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => { loadCharacters(); }, []);

  const loadCharacters = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/v1/character-registry/registries?limit=50');
      const regs = res.data?.registries || [];
      setRegistries(regs);
      setCharacters(regs.flatMap(r => (r.characters || []).map(c => ({ ...c, registry_id: r.id, registry_name: r.name }))));
    } catch { setCharacters([]); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!createForm.display_name.trim()) return;
    setCreating(true);
    try {
      const registryId = registries[0]?.id;
      if (!registryId) { showToast('No registry found'); setCreating(false); return; }
      await api.post(`/api/v1/character-registry/registries/${registryId}/characters`, {
        ...createForm, character_key: createForm.display_name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      });
      setShowCreate(false);
      setCreateForm({ display_name: '', role_type: 'pressure', icon: '👤' });
      loadCharacters();
      showToast('Character created');
    } catch (err) { showToast('Failed: ' + (err.response?.data?.error || err.message)); }
    finally { setCreating(false); }
  };

  const filtered = characters.filter(c => {
    if (roleFilter !== 'all' && c.role_type !== roleFilter) return false;
    if (search && !(c.display_name || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const roleCounts = {};
  characters.forEach(c => { roleCounts[c.role_type] = (roleCounts[c.role_type] || 0) + 1; });

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading characters...</div>;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 24px' }}>
      {toast && <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: '#E8F5E9', color: '#16a34a', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 500 }}>{toast}</div>}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a1a2e' }}>Characters</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>{characters.length} character{characters.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#B8962E', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ New Character</button>
      </div>

      {/* Role Filter + Search */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setRoleFilter('all')} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: roleFilter === 'all' ? '#1a1a2e' : '#f1f5f9', color: roleFilter === 'all' ? '#fff' : '#64748b', border: 'none' }}>All ({characters.length})</button>
          {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
            <button key={key} onClick={() => setRoleFilter(roleFilter === key ? 'all' : key)} style={{
              padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              background: roleFilter === key ? cfg.bg : '#f8f8f8', color: roleFilter === key ? cfg.color : '#94a3b8',
              border: `1px solid ${roleFilter === key ? cfg.color + '40' : 'transparent'}`,
            }}>{cfg.icon} {cfg.label} ({roleCounts[key] || 0})</button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, outline: 'none', flex: '0 1 250px' }} />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
          <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#1a1a2e' }}>{search ? 'No characters found' : 'No characters yet'}</h3>
          {!search && <button onClick={() => setShowCreate(true)} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#B8962E', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}>+ Create Character</button>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {filtered.map(char => {
            const role = ROLE_CONFIG[char.role_type] || ROLE_CONFIG.pressure;
            const depth = DEPTH_CONFIG[char.depth_level] || null;
            return (
              <div key={char.id} onClick={() => navigate(`/character/${char.id}`)} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}>
                <div style={{ height: 4, background: role.color }} />
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: role.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{char.icon || role.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{char.display_name}</div>
                      {char.subtitle && <div style={{ fontSize: 11, color: '#94a3b8' }}>{char.subtitle}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                    <span style={{ padding: '2px 8px', background: role.bg, borderRadius: 4, fontSize: 9, fontWeight: 700, color: role.color }}>{role.icon} {role.label}</span>
                    {char.status !== 'draft' && <span style={{ padding: '2px 8px', background: '#f1f5f9', borderRadius: 4, fontSize: 9, color: '#64748b' }}>{char.status}</span>}
                  </div>
                  {char.core_belief && <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', lineHeight: 1.4, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>"{char.core_belief}"</div>}
                  {depth && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
                        <span style={{ color: depth.color, fontWeight: 600 }}>{depth.label}</span>
                        <span style={{ color: '#94a3b8' }}>{depth.pct}%</span>
                      </div>
                      <div style={{ height: 3, background: '#f1f5f9', borderRadius: 2 }}><div style={{ height: '100%', width: `${depth.pct}%`, background: depth.color, borderRadius: 2 }} /></div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowCreate(false)}>
          <div style={{ background: '#fff', borderRadius: 14, width: '90vw', maxWidth: 450, padding: 24 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }}>New Character</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 3 }}>Name</label>
                <input value={createForm.display_name} onChange={e => setCreateForm({ ...createForm, display_name: e.target.value })} placeholder="Character name..." autoFocus style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 3 }}>Role</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.entries(ROLE_CONFIG).filter(([k]) => k !== 'protagonist').map(([key, cfg]) => (
                    <button key={key} onClick={() => setCreateForm({ ...createForm, role_type: key })} style={{
                      padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      background: createForm.role_type === key ? cfg.bg : '#f8f8f8', color: createForm.role_type === key ? cfg.color : '#94a3b8',
                      border: `1px solid ${createForm.role_type === key ? cfg.color + '40' : '#e2e8f0'}`,
                    }}>{cfg.icon} {cfg.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 3 }}>Icon</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['👤', '👩', '👨', '🧑', '👸', '🦹', '🧠', '💀', '🌟', '🔮'].map(icon => (
                    <button key={icon} onClick={() => setCreateForm({ ...createForm, icon })} style={{
                      width: 36, height: 36, borderRadius: 8, border: createForm.icon === icon ? '2px solid #B8962E' : '1px solid #e2e8f0',
                      background: createForm.icon === icon ? '#FAF7F0' : '#fff', fontSize: 18, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{icon}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleCreate} disabled={creating || !createForm.display_name.trim()} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#B8962E', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{creating ? '⏳' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
