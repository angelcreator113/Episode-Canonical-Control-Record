/**
 * CharacterRegistryPage — The cast (Evoni's mock, 2026-10-08)
 *
 * Lala; the people in her world, who are her LalaVerse feed profiles, each
 * linked to a character; and the characters left from the old system,
 * waiting for Evoni's call (lib/theCast). Works in a chosen registry (the
 * active show's by default; audit IA-05: never the first one the API
 * returned); quick create goes into it.
 *
 * The old system's Archive is the registry's soft delete. Keep, Match to
 * feed person, the Kept and Archived tabs and episode counts need routes
 * that don't exist yet and come next; they show disabled, not pretend.
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import useActiveShow from '../hooks/useActiveShow';
import { findLala, feedPeople, oldSystem, sameNames, sameNameNote } from '../lib/theCast';
import './TheCast.css';

const ROLE_CONFIG = {
  protagonist: { color: '#B8962E', bg: '#FAF7F0', icon: '👑', label: 'Protagonist' },
  pressure: { color: '#dc2626', bg: '#fef2f2', icon: '🔥', label: 'Pressure' },
  mirror: { color: '#6366f1', bg: '#eef2ff', icon: '🪞', label: 'Mirror' },
  support: { color: '#16a34a', bg: '#f0fdf4', icon: '🤝', label: 'Support' },
  shadow: { color: '#1e293b', bg: '#f1f5f9', icon: '🌑', label: 'Shadow' },
  special: { color: '#ec4899', bg: '#fdf2f8', icon: '✦', label: 'Special' },
};

const ROLE_LABEL = Object.fromEntries(Object.entries(ROLE_CONFIG).map(([k, v]) => [k, v.label]));
const NEXT = 'Comes next: this needs a route the registry does not have yet.';


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
  const [profiles, setProfiles] = useState([]);
  const [picked, setPicked] = useState(() => new Set());
  const [archiving, setArchiving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ display_name: '', role_type: 'pressure', icon: '👤' });
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => { loadCharacters(); loadProfiles(); }, []);

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

  // Lala's world: the LalaVerse feed profiles, each with its linked character.
  const loadProfiles = async () => {
    try {
      const res = await api.get('/api/v1/social-profiles?feed_layer=lalaverse&limit=100');
      setProfiles(res.data?.profiles || []);
    } catch (err) { console.error('[CharacterRegistryPage] feed profiles load failed:', err); setProfiles([]); }
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

  const lala = findLala(characters);
  const people = feedPeople(profiles, allCharacters);
  const old = oldSystem(characters, profiles, lala);
  const twins = sameNames(old);
  const protagonists = characters.filter((c) => c.role_type === 'protagonist').length;
  const pickedOld = old.filter((c) => picked.has(c.id));
  const togglePick = (id) => setPicked((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  // Archive is the registry's soft delete; bringing one back is not on this page yet, so ask first.
  const archive = async (chars) => {
    if (!chars.length) return;
    const names = chars.length === 1 ? chars[0].display_name : `${chars.length} characters`;
    if (!window.confirm(`Archive ${names}? They leave the pickers. Bringing them back isn't on this page yet.`)) return;
    setArchiving(true);
    try {
      if (chars.length === 1) await api.delete(`/api/v1/character-registry/characters/${chars[0].id}`);
      else await api.post('/api/v1/character-registry/characters/bulk-delete', { ids: chars.map((c) => c.id) });
      setPicked(new Set());
      showToast(`Archived ${names}`);
      loadCharacters();
    } catch (err) {
      console.error('[CharacterRegistryPage] archive failed:', err);
      showToast('Archive failed: ' + (err.response?.data?.error || err.message));
    } finally { setArchiving(false); }
  };

  if (loading) return <div className="cast-loading">Loading the cast…</div>;

  return (
    <div className="cast">
      {toast && <div role="status" className="cast-toast">{toast}</div>}

      {/* Header */}
      <header className="cast-card cast-head">
        <div className="cast-head-text">
          <h1 className="cast-title">The cast</h1>
          <p className="cast-lede">The people in Lala's world are her feed profiles. Everyone else here is from the old system and waits for your call.</p>
          <p className="cast-note" data-testid="registry-count">
            {characters.length} character{characters.length !== 1 ? 's' : ''}{registry ? ` in ${registry.title}` : registries.length > 1 ? ` across ${registries.length} registries` : ''}
          </p>
        </div>
        <div className="cast-stats">
          <div className="cast-stat is-lavender"><strong>{people.length}</strong><span>feed people</span></div>
          <div className="cast-stat is-gold"><strong>{old.length}</strong><span>old to review</span></div>
        </div>
        <div className="cast-head-actions">
          {registries.length > 1 && (
            <select aria-label="Registry" data-testid="registry-select" className="cast-select" value={registryId || ''} onChange={(e) => selectRegistry(e.target.value)}>
              <option value="">All registries</option>
              {registries.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          )}
          <button type="button" onClick={openCreate} data-testid="new-character" className="cast-btn-primary">+ New character</button>
        </div>
      </header>

      {/* Lala */}
      {lala && (
        <section className="cast-card cast-lala" aria-label="Lala" data-testid="cast-lala">
          <div className="cast-avatar is-lala" aria-hidden="true">{(lala.display_name || 'L').charAt(0)}</div>
          <div className="cast-lala-text">
            <div className="cast-kicker">Protagonist</div>
            <h2 className="cast-lala-name">{lala.display_name}</h2>
            <p className="cast-note">{people.length} {people.length === 1 ? 'person' : 'people'} in her world</p>
          </div>
          {lala.role_type !== 'protagonist' && (
            <p className="cast-lala-warn" data-testid="cast-lala-role">
              <strong>Role says "{ROLE_LABEL[lala.role_type] || lala.role_type}".</strong> Lala should be the show's one Protagonist; that filter shows {protagonists} today.
            </p>
          )}
          <button type="button" className="cast-btn-lavender" onClick={() => navigate(`/character/${lala.id}`)}>Open Lala</button>
        </section>
      )}

      {/* Lala's world */}
      <section className="cast-world" aria-labelledby="cast-world-heading">
        <div className="cast-section-head">
          <h2 id="cast-world-heading" className="cast-h2">Lala's world</h2>
          <span className="cast-note">{people.length} feed {people.length === 1 ? 'person' : 'people'}, each one a character</span>
          <Link to="/feed" className="cast-link">Open in Lala's Feed</Link>
        </div>
        {people.length === 0 ? (
          <p className="cast-note">No LalaVerse feed profiles yet. They are made in Lala's Feed.</p>
        ) : (
          <ul className="cast-people" data-testid="cast-people">
            {people.map((p) => (
              <li key={p.id}>
                <Link className="cast-person" to={p.characterId ? `/character/${p.characterId}` : '/feed'}>
                  <span className="cast-avatar" aria-hidden="true">{p.name.charAt(0).toUpperCase()}</span>
                  <span className="cast-person-text">
                    <strong>{p.name}</strong>
                    {p.handle && <span>@{p.handle.replace(/^@/, '')}</span>}
                  </span>
                  <span className="cast-chips">
                    {p.archetype && <span className="cast-chip is-lavender">{p.archetype}</span>}
                    {!p.characterId && <span className="cast-chip is-gold">No character yet</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* From the old system */}
      <section className="cast-card cast-old" aria-labelledby="cast-old-heading">
        <div className="cast-section-head">
          <h2 id="cast-old-heading" className="cast-h2">From the old system</h2>
          <span className="cast-note">{old.length} character{old.length !== 1 ? 's' : ''}</span>
          <div className="cast-tabs" role="group" aria-label="Old-system characters">
            <button type="button" className="cast-tab is-on" aria-pressed="true">To review</button>
            <button type="button" className="cast-tab" disabled title={NEXT}>Kept</button>
            <button type="button" className="cast-tab" disabled title={NEXT}>Archived</button>
          </div>
        </div>
        {old.length === 0 ? (
          <p className="cast-note">Nothing left to review.</p>
        ) : (<>
          <div className="cast-bulk">
            <p><strong>Not used any more?</strong> Select them and archive in one go. Archived characters leave the pickers.</p>
            <button type="button" className="cast-btn-primary" disabled={!pickedOld.length || archiving} onClick={() => archive(pickedOld)}>
              Archive selected{pickedOld.length ? ` (${pickedOld.length})` : ''}
            </button>
          </div>
          <ul className="cast-rows" data-testid="cast-old">
            {old.map((c) => (
              <li key={c.id} className="cast-row">
                <input type="checkbox" className="cast-check" aria-label={`Select ${c.display_name}`} checked={picked.has(c.id)} onChange={() => togglePick(c.id)} />
                <button type="button" className="cast-row-name" onClick={() => navigate(`/character/${c.id}`)}><span>{c.display_name}</span></button>
                <span className={`cast-role is-${c.role_type || 'pressure'}`}>{ROLE_LABEL[c.role_type] || 'Pressure'}</span>
                <span className="cast-row-note">{twins[c.id] ? <span className="cast-twin">{sameNameNote(twins[c.id], c.display_name)}</span> : null}</span>
                <span className="cast-row-actions">
                  <button type="button" className="cast-btn-soft" disabled title={NEXT}>Match to feed person</button>
                  <button type="button" className="cast-btn-soft" disabled title={NEXT}>Keep</button>
                  <button type="button" className="cast-btn-archive" disabled={archiving} onClick={() => archive([c])}>Archive</button>
                </span>
              </li>
            ))}
          </ul>
        </>)}
        <p className="cast-note">Keep, Match to feed person and the Kept and Archived tabs come next.</p>
      </section>

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
