/**
 * CharacterRegistryPage — The cast (Evoni's mock, 2026-10-08; restyled
 * pink-and-gold 2026-10-16)
 *
 * Lala, and the people in her world: her LalaVerse feed profiles, each
 * linked to a character (lib/theCast). Works in a chosen registry (the
 * active show's by default; audit IA-05: never the first one the API
 * returned); quick create goes into it.
 *
 * The old-system section (review, Keep, Match, Archived) is off the page
 * (Evoni, 2026-10-16: "get rid of the old system stuff"). Its characters
 * stay archived in the registry; nothing was deleted. A live character no
 * feed profile names (one just made with New character, say) is listed
 * under "More characters", plainly, so it never vanishes. Episode counts
 * come from routes/castRoutes.js (/api/v1/cast/review).
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import useActiveShow from '../hooks/useActiveShow';
import { Crown, Plus, Sparkles, UserPlus, Users, ChevronRight, Radio } from 'lucide-react';
import { chooseRegistry, findLala, feedPeople, oldSystem, otherProtagonists } from '../lib/theCast';
import CastFacts from '../components/Cast/CastFacts';
import CastFlagLog from '../components/Cast/CastFlagLog';
import CastCrossCheck from '../components/Cast/CastCrossCheck';
import CastMakeForMe from '../components/Cast/CastMakeForMe';
import './TheCast.css';

const ROLE_CONFIG = {
  protagonist: { color: '#B8962E', bg: '#FAF7F0', icon: '👑', label: 'Protagonist' },
  pressure: { color: '#dc2626', bg: '#fef2f2', icon: '🔥', label: 'Pressure' },
  mirror: { color: '#6366f1', bg: '#eef2ff', icon: '🪞', label: 'Mirror' },
  support: { color: '#16a34a', bg: '#f0fdf4', icon: '🤝', label: 'Support' },
  shadow: { color: '#1e293b', bg: '#f1f5f9', icon: '🌑', label: 'Shadow' },
  special: { color: '#ec4899', bg: '#fdf2f8', icon: '✦', label: 'Special' },
};

const episodesLabel = (n) => (n > 0 ? `${n} episode${n === 1 ? '' : 's'}` : 'No episodes');


// Which registry the page works in: lib/theCast (the LalaVerse Overview counts the same way).
export { chooseRegistry };

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
  // Episode counts per character (GET /api/v1/cast/review).
  const [review, setReview] = useState(null);
  const [crossingId, setCrossingId] = useState(null); // the feed person whose character is being made
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ display_name: '', role_type: 'pressure', icon: '👤' });
  const [creating, setCreating] = useState(false);
  // "Make one for me" (Evoni, 2026-10-19; components/Cast/CastMakeForMe).
  const [showMake, setShowMake] = useState(false);
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
  // Every page of them: one page of 100 cut people off past it (the
  // LalaVerse cap is 200, and the real-world profiles Lala follows share the
  // pages). An archived profile is not in her world.
  const loadProfiles = async () => {
    try {
      const all = [];
      for (let page = 1; page <= 10; page += 1) {
        const res = await api.get(`/api/v1/social-profiles?feed_layer=lalaverse&limit=100&page=${page}`);
        const batch = res.data?.profiles || [];
        all.push(...batch);
        if (batch.length < 100) break;
      }
      setProfiles(all.filter((p) => p && p.status !== 'archived'));
    } catch (err) { console.error('[CharacterRegistryPage] feed profiles load failed:', err); setProfiles([]); }
  };

  // "Create character" on a feed person with none (Task #3201; the cast read
  // §3.2): the Feed's Cross (POST /social-profiles/:id/cross) makes the
  // character in the active show's registry and links it by feed_profile_id.
  const createCharacterFor = async (person) => {
    setCrossingId(person.id);
    try {
      const res = await api.post(`/api/v1/social-profiles/${person.id}/cross`, activeShowId ? { show_id: activeShowId } : {});
      showToast(res.data?.registry_character ? `Character created for ${person.name}` : (res.data?.registry_note || `No character was created for ${person.name}`));
      await Promise.all([loadProfiles(), loadCharacters()]);
    } catch (err) {
      console.error('[CharacterRegistryPage] create character failed:', err);
      showToast('Failed: ' + (err.response?.data?.message || err.response?.data?.error || err.message));
    } finally { setCrossingId(null); }
  };

  // Episode counts for the registry in view, or for every registry in "All registries".
  const loadReview = async (id) => {
    const ids = id ? [id] : registries.map((r) => r.id);
    if (!ids.length) { setReview(null); return; }
    try {
      const all = await Promise.all(ids.map((rid) => api.get(`/api/v1/cast/review?registry_id=${rid}`)));
      setReview({ counts: Object.assign({}, ...all.map((res) => res.data?.episode_counts || {})) });
    } catch (err) { console.error('[CharacterRegistryPage] cast review load failed:', err); setReview(null); }
  };
  useEffect(() => { loadReview(registryId); }, [registryId, registries]);

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
  // Lala is the Protagonist whatever her stored role (Task #3199); anyone
  // else tagged Protagonist is flagged.
  const alsoProtagonist = otherProtagonists(characters, lala);
  const episodes = (id) => review?.counts?.[id];
  // Live characters in view that no feed profile names, Lala aside.
  const more = oldSystem(characters, profiles, lala);
  const withCharacter = people.filter((p) => p.characterId).length;
  const inEpisodes = people.filter((p) => p.characterId && episodes(p.characterId) > 0).length;
  const portraitOf = (c) => c?.portrait_url || null;

  if (loading) return <div className="cast-loading">Loading the cast…</div>;

  return (
    <div className="cast">
      {toast && <div role="status" className="cast-toast">{toast}</div>}

      {/* Banner */}
      <header className="cast-banner">
        <div className="cast-banner-left">
          <span className="cast-brand">LalaVerse</span>
          <div className="cast-head-text">
            <h1 className="cast-title">The Cast</h1>
            <div className="cast-tagline">Lala · Her World · Her People</div>
            <p className="cast-banner-note" data-testid="registry-count">
              {characters.length} character{characters.length !== 1 ? 's' : ''}{registry ? ` in ${registry.title}` : registries.length > 1 ? ` across ${registries.length} registries` : ''}
            </p>
          </div>
        </div>
        <div className="cast-head-actions">
          {registries.length > 1 && (
            <select aria-label="Registry" data-testid="registry-select" className="cast-select" value={registryId || ''} onChange={(e) => selectRegistry(e.target.value)}>
              <option value="">All registries</option>
              {registries.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          )}
          <button type="button" onClick={openCreate} data-testid="new-character" className="cast-btn-new">
            <Plus size={18} aria-hidden /> New character
          </button>
          <button type="button" onClick={() => setShowMake(true)} data-testid="make-for-me" className="cast-btn-new">
            <Sparkles size={18} aria-hidden /> Make one for me
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="cast-stats" role="list" aria-label="The cast at a glance">
        <div className="cast-stat is-pink" role="listitem"><Users size={20} aria-hidden /><strong>{people.length}</strong><span>in her world</span></div>
        <div className="cast-stat is-lavender" role="listitem"><UserPlus size={20} aria-hidden /><strong>{withCharacter}</strong><span>with a character</span></div>
        <div className="cast-stat is-gold" role="listitem"><Sparkles size={20} aria-hidden /><strong>{review ? inEpisodes : '–'}</strong><span>in an episode</span></div>
      </div>

      {/* Lala */}
      {lala && (
        <section className="cast-lala" aria-label="Lala" data-testid="cast-lala">
          <div className="cast-lala-portrait">
            {portraitOf(lala)
              ? <img src={portraitOf(lala)} alt="" />
              : <span className="cast-lala-initial" aria-hidden="true">{(lala.display_name || 'L').charAt(0)}</span>}
            <span className="cast-lala-crown" aria-hidden="true"><Crown size={18} /></span>
          </div>
          <div className="cast-lala-text">
            <div className="cast-kicker">Protagonist</div>
            <h2 className="cast-lala-name">{lala.display_name}</h2>
            <p className="cast-note">{people.length} {people.length === 1 ? 'person' : 'people'} in her world</p>
            {alsoProtagonist.length > 0 && (
              <p className="cast-lala-warn" data-testid="cast-other-protagonists">
                <strong>Lala is the show&apos;s one Protagonist.</strong> Also tagged Protagonist: {alsoProtagonist.map((c) => c.display_name || c.character_key).join(', ')}.
              </p>
            )}
          </div>
          <button type="button" className="cast-btn-primary" onClick={() => navigate(`/character/${lala.id}`)}>
            Open Lala <ChevronRight size={16} aria-hidden />
          </button>
        </section>
      )}

      {/* Lala's world */}
      <section className="cast-world" aria-labelledby="cast-world-heading">
        <div className="cast-section-head">
          <h2 id="cast-world-heading" className="cast-h2">Lala&apos;s world</h2>
          <span className="cast-note">{people.length} feed {people.length === 1 ? 'person' : 'people'}, each one a character</span>
          <Link to="/pulse" className="cast-link"><Radio size={15} aria-hidden /> Open in The Pulse</Link>
        </div>
        {people.length === 0 ? (
          <p className="cast-note cast-empty">No LalaVerse feed profiles yet. They are made in Lala&apos;s Feed.</p>
        ) : (
          <ul className="cast-people" data-testid="cast-people">
            {people.map((p) => (
              <li key={p.id} className="cast-person-card">
                <Link className="cast-person" to={p.characterId ? `/character/${p.characterId}` : `/pulse?profile=${p.id}`}>
                  <span className="cast-person-cover" aria-hidden="true">
                    {portraitOf(p.character)
                      ? <img src={portraitOf(p.character)} alt="" />
                      : <span className="cast-avatar">{p.name.charAt(0).toUpperCase()}</span>}
                  </span>
                  <span className="cast-person-text">
                    <strong>{p.name}</strong>
                    {p.handle && <span>@{p.handle.replace(/^@/, '')}</span>}
                    {p.realName && p.realName !== p.name && <span className="cast-real-name">{p.realName}</span>}
                  </span>
                  <span className="cast-chips">
                    {p.archetype && <span className="cast-chip is-lavender">{p.archetype}</span>}
                    {!p.characterId && <span className="cast-chip is-gold">No character yet</span>}
                    {p.characterId && episodes(p.characterId) > 0 && <span className="cast-chip is-green">In {episodesLabel(episodes(p.characterId))}</span>}
                  </span>
                </Link>
                {/* With no registry, Cross would mark the profile crossed and make no character. */}
                {!p.characterId && (
                  <button type="button" className="cast-btn-soft cast-person-create" data-testid="cast-create-character"
                    disabled={crossingId === p.id || registries.length === 0}
                    title={registries.length === 0 ? 'No character registry to add this person to yet' : undefined}
                    onClick={() => createCharacterFor(p)}>
                    {crossingId === p.id ? 'Creating…' : 'Create character'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* More characters: live ones no feed profile names */}
      {more.length > 0 && (
        <section className="cast-world" aria-labelledby="cast-more-heading">
          <div className="cast-section-head">
            <h2 id="cast-more-heading" className="cast-h2">More characters</h2>
            <span className="cast-note">{more.length} not in Lala&apos;s feed</span>
          </div>
          <ul className="cast-people" data-testid="cast-more">
            {more.map((c) => {
              const role = ROLE_CONFIG[c.role_type];
              const n = episodes(c.id);
              return (
                <li key={c.id} className="cast-person-card">
                  <Link className="cast-person" to={`/character/${c.id}`}>
                    <span className="cast-person-cover" aria-hidden="true">
                      {portraitOf(c)
                        ? <img src={portraitOf(c)} alt="" />
                        : <span className="cast-avatar">{(c.display_name || '?').charAt(0).toUpperCase()}</span>}
                    </span>
                    <span className="cast-person-text"><strong>{c.display_name}</strong></span>
                    <span className="cast-chips">
                      {role && <span className="cast-chip is-lavender">{role.label}</span>}
                      {n > 0 && <span className="cast-chip is-green">In {episodesLabel(n)}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* The cast rollout: every character's facts, findings and voice (Evoni, 2026-10-17). */}
      <CastFacts registryIds={registryId ? [registryId] : registries.map((r) => r.id)} />
      <CastFlagLog registryIds={registryId ? [registryId] : registries.map((r) => r.id)} />
      <CastCrossCheck registryIds={registryId ? [registryId] : registries.map((r) => r.id)} />

      {showMake && (
        <CastMakeForMe
          registries={registries}
          registryId={registryId}
          onClose={() => setShowMake(false)}
          onKept={(c, reg) => { showToast(`${c?.display_name || 'The character'} was made in ${reg?.title || 'the registry'}`); loadCharacters(); loadProfiles(); }}
          // Edit: the proposal in the New character form, prefilled (it saves through the form, with no Pulse profile).
          onEdit={(p, reg) => {
            const { pulse: _pulse, world: _world, ...fields } = p;
            setShowMake(false);
            setCreateRegistryId(reg?.id || registryId);
            setCreateForm({ role_type: 'pressure', icon: '👤', ...fields });
            setShowCreate(true);
          }}
        />
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="cast-modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="cast-modal" role="dialog" aria-modal="true" aria-labelledby="cast-create-title" onClick={e => e.stopPropagation()}>
            <h3 id="cast-create-title" className="cast-modal-title" data-testid="create-title">New Character{createRegistry ? ` in ${createRegistry.title}` : ''}</h3>
            <div className="cast-form">
              {/* The registry is chosen here, never assumed (audit IA-05). */}
              {(registries.length > 1 || !createRegistry) && (
                <div>
                  <label className="cast-label" htmlFor="cast-create-registry">Registry</label>
                  <select id="cast-create-registry" aria-label="Registry for the new character" data-testid="create-registry"
                    className={`cast-input${createRegistry ? '' : ' is-wanting'}`}
                    value={createRegistryId || ''} onChange={(e) => setCreateRegistryId(e.target.value || null)}>
                    <option value="" disabled>Choose a registry…</option>
                    {registries.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="cast-label" htmlFor="cast-create-name">Name</label>
                <input id="cast-create-name" className={`cast-input${duplicate ? ' is-wanting' : ''}`} value={createForm.display_name}
                  onChange={e => setCreateForm({ ...createForm, display_name: e.target.value })} placeholder="Character name..." autoFocus aria-label="Name" />
                {duplicate && (
                  <div role="alert" data-testid="create-duplicate" className="cast-dup">
                    {duplicate.display_name} already exists in {createRegistry.title}. <button type="button" className="cast-dup-open" onClick={() => navigate(`/character/${duplicate.id}`)}>Open it →</button>
                  </div>
                )}
              </div>
              <div>
                <span className="cast-label">Role</span>
                <div className="cast-pick-row">
                  {Object.entries(ROLE_CONFIG).filter(([k]) => k !== 'protagonist').map(([key, cfg]) => (
                    <button key={key} type="button" aria-pressed={createForm.role_type === key}
                      className={`cast-pick${createForm.role_type === key ? ' is-on' : ''}`}
                      onClick={() => setCreateForm({ ...createForm, role_type: key })}>{cfg.icon} {cfg.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <span className="cast-label">Icon</span>
                <div className="cast-pick-row">
                  {['👤', '👩', '👨', '🧑', '👸', '🦹', '🧠', '💀', '🌟', '🔮'].map(icon => (
                    <button key={icon} type="button" aria-pressed={createForm.icon === icon} aria-label={`Icon ${icon}`}
                      className={`cast-pick cast-pick-icon${createForm.icon === icon ? ' is-on' : ''}`}
                      onClick={() => setCreateForm({ ...createForm, icon })}>{icon}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="cast-modal-actions">
              <button type="button" className="cast-btn-soft" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="button" className="cast-btn-primary" onClick={handleCreate} data-testid="create-submit" disabled={creating || !createForm.display_name.trim() || !createRegistry || Boolean(duplicate)}>{creating ? 'Creating…' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
