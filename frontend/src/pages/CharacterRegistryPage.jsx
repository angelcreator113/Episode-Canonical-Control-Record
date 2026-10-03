/**
 * CharacterRegistryPage — Clean character hub
 *
 * Browse a registry's characters in a grid (the active show's by default;
 * audit IA-05: a chosen registry, never the first one the API returned),
 * quick create into it, click to view profile.
 * Replaces the 5,750-line monolith with a focused, maintainable page.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import useActiveShow from '../hooks/useActiveShow';

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


/**
 * Which registry the page works in (audit IA-05, 2026-10-03): the one the
 * URL names (?registry=), else the active show's, else the only one; null
 * is "all registries", a read-only view. Quick create never falls back to
 * the first registry the API returned.
 */
export function chooseRegistry(registries, { urlRegistryId = null, showId = null } = {}) {
  if (!registries?.length) return null;
  const byUrl = urlRegistryId && registries.find((r) => String(r.id) === String(urlRegistryId));
  if (byUrl) return byUrl.id;
  const byShow = showId && registries.find((r) => String(r.show_id || '') === String(showId));
  if (byShow) return byShow.id;
  return registries.length === 1 ? registries[0].id : null;
}

export const characterKeyFor = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/**
 * An existing character the new one would duplicate, in this registry: the
 * same name (case aside) or the same key. Link or open it instead.
 */
export function duplicateIn(registry, name) {
  const wanted = name.trim().toLowerCase();
  const key = characterKeyFor(name);
  return (registry?.characters || []).find((c) => (c.display_name || '').trim().toLowerCase() === wanted || c.character_key === key) || null;
}

export default function CharacterRegistryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showId: activeShowId, loaded: showsLoaded } = useActiveShow();
  const [registries, setRegistries] = useState([]);
  const [allCharacters, setAllCharacters] = useState([]);
  // The registry in view (null: all, read-only); the one a new character goes into.
  const [registryId, setRegistryId] = useState(null);
  const [createRegistryId, setCreateRegistryId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ display_name: '', role_type: 'pressure', icon: '👤' });
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => { loadCharacters(); }, []);

  // The Feed's "Registry →" link names a character: open its profile.
  const linkedCharacterId = searchParams.get('character');
  useEffect(() => {
    if (linkedCharacterId) navigate(`/character/${linkedCharacterId}`, { replace: true });
  }, [linkedCharacterId, navigate]);

  const loadCharacters = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/v1/character-registry/registries?limit=50');
      const regs = res.data?.registries || [];
      setRegistries(regs);
      setAllCharacters(regs.flatMap(r => (r.characters || []).map(c => ({ ...c, registry_id: r.id, registry_name: r.title }))));
    } catch (err) { console.error('[CharacterRegistryPage] registries load failed:', err); setAllCharacters([]); }
    finally { setLoading(false); }
  };

  // Once the registries and the active show are known, settle the registry
  // in view; the URL keeps it so a link or Back lands on the same one.
  const urlRegistryId = searchParams.get('registry');
  useEffect(() => {
    if (loading || !showsLoaded) return;
    setRegistryId(chooseRegistry(registries, { urlRegistryId, showId: activeShowId }));
  }, [loading, showsLoaded, registries, urlRegistryId, activeShowId]);
  const selectRegistry = (id) => {
    setRegistryId(id || null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set('registry', id); else next.delete('registry');
      return next;
    }, { replace: true });
  };
  const registry = registries.find((r) => r.id === registryId) || null;
  const characters = registryId ? allCharacters.filter((c) => c.registry_id === registryId) : allCharacters;
  const openCreate = () => { setCreateRegistryId(registryId); setShowCreate(true); };
  const createRegistry = registries.find((r) => r.id === createRegistryId) || null;
  const duplicate = createRegistry && createForm.display_name.trim() ? duplicateIn(createRegistry, createForm.display_name) : null;

  const handleCreate = async () => {
    if (!createForm.display_name.trim()) return;
    // Never the first registry the API returned: the chosen one, or none.
    if (!createRegistry) { showToast('Choose the registry this character belongs to'); return; }
    if (duplicate) { showToast(`${duplicate.display_name} already exists in ${createRegistry.title}`); return; }
    setCreating(true);
    try {
      await api.post(`/api/v1/character-registry/registries/${createRegistry.id}/characters`, {
        ...createForm, character_key: characterKeyFor(createForm.display_name),
      });
      setShowCreate(false);
      setCreateForm({ display_name: '', role_type: 'pressure', icon: '👤' });
      loadCharacters();
      showToast(`Character created in ${createRegistry.title}`);
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
      {toast && <div role="status" style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: '#EAF5F3', color: '#2F7F76', border: '1px solid #2F7F76', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 500 }}>{toast}</div>}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a1a2e' }}>Characters</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }} data-testid="registry-count">
            {characters.length} character{characters.length !== 1 ? 's' : ''}{registry ? ` in ${registry.title}` : registries.length > 1 ? ` across ${registries.length} registries` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {registries.length > 1 && (
            <select aria-label="Registry" data-testid="registry-select" value={registryId || ''} onChange={(e) => selectRegistry(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${registryId ? '#2F7F76' : '#C06E87'}`, fontSize: 12, background: '#fff', color: '#2C2C2C' }}>
              <option value="">All registries</option>
              {registries.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          )}
          <button onClick={openCreate} data-testid="new-character" style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#B8962E', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ New Character</button>
        </div>
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
          {!search && <button onClick={openCreate} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#B8962E', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}>+ Create Character</button>}
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
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700 }} data-testid="create-title">New Character{createRegistry ? ` in ${createRegistry.title}` : ''}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* The registry is chosen here, never assumed (audit IA-05). */}
              {(registries.length > 1 || !createRegistry) && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 3 }}>Registry</label>
                  <select aria-label="Registry for the new character" data-testid="create-registry" value={createRegistryId || ''} onChange={(e) => setCreateRegistryId(e.target.value || null)}
                    style={{ width: '100%', padding: '8px 12px', border: `1px solid ${createRegistry ? '#2F7F76' : '#C06E87'}`, borderRadius: 6, fontSize: 13, background: '#fff' }}>
                    <option value="" disabled>Choose a registry…</option>
                    {registries.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 3 }}>Name</label>
                <input value={createForm.display_name} onChange={e => setCreateForm({ ...createForm, display_name: e.target.value })} placeholder="Character name..." autoFocus aria-label="Name" style={{ width: '100%', padding: '8px 12px', border: `1px solid ${duplicate ? '#C06E87' : '#e2e8f0'}`, borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
                {duplicate && (
                  <div role="alert" data-testid="create-duplicate" style={{ marginTop: 6, padding: '6px 10px', borderRadius: 6, background: '#FBEFF3', border: '1px solid #C06E87', fontSize: 12, color: '#2C2C2C' }}>
                    {duplicate.display_name} already exists in {createRegistry.title}. <button type="button" onClick={() => navigate(`/character/${duplicate.id}`)} style={{ background: 'none', border: 'none', color: '#2F7F76', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 12 }}>Open it →</button>
                  </div>
                )}
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
              <button onClick={handleCreate} data-testid="create-submit" disabled={creating || !createForm.display_name.trim() || !createRegistry || Boolean(duplicate)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#B8962E', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{creating ? '⏳' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
