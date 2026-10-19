/**
 * Admin › The Pulse › Uploads › Characters (Task #2921): each character's
 * profile photo (portrait_url) and cover photo (cover_url), saved on the
 * character record (RegistryCharacter; The Pulse spec §2 rule 3). The cast
 * is every registry's characters, as the Character Registry lists them.
 * Each is a row (Evoni's Uploads mock, 2026-10-17): the profile photo, the
 * name, role and when Lala meets them, and the cover; new characters are
 * made in the Character Registry.
 * Styles: styles/AdminPanel.css, PulseUploads.css (pu-*).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Plus, Users } from 'lucide-react';
import api from '../../services/api';
import PulseImageSpot, { UploadsHead } from './PulseImageSpot';
import { useReveals } from './PulseRevealContext';

const errorText = (err) => err?.response?.data?.error || err?.message || 'Something went wrong.';

export const characterPhotoApi = {
  list: () => api.get('/api/v1/character-registry/registries?limit=100').then((r) => {
    const seen = new Set();
    return (r.data?.registries || [])
      .flatMap((g) => g.characters || [])
      .filter((c) => c?.id && !seen.has(c.id) && seen.add(c.id))
      .sort((a, b) => String(a.display_name || '').localeCompare(String(b.display_name || '')));
  }),
  upload: (id, kind, file) => {
    const form = new FormData();
    form.append('image', file);
    return api.post(`/api/v1/character-registry/characters/${id}/photo?kind=${kind}`, form).then((r) => r.data);
  },
  remove: (id, kind) => api.delete(`/api/v1/character-registry/characters/${id}/photo?kind=${kind}`).then((r) => r.data),
};

const FROM = { guest: "guest list", post: 'first episode post' };

/**
 * When Lala meets the character (Task 2940; reveals, spec §5): derived from
 * an episode's guest list or the character's first episode post, or set by
 * Evoni; before then their profile and posts stay off The Pulse. Needs the
 * character linked to a Feed profile.
 */
function MeetsLala({ met, name, onChanged }) {
  const ctx = useReveals();
  const [open, setOpen] = useState(false);
  const [episodeId, setEpisodeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  if (!ctx || met === undefined) return null; // undefined: not read yet
  if (!met) return <p className="pulse-met" data-testid="pulse-met">Not linked to a Pulse profile, so not on The Pulse yet.</p>;
  const run = async (fn) => {
    setBusy(true); setNote(null);
    try { await fn(); setOpen(false); await onChanged(); } catch (err) {
      console.error(`[PulseCharacters] meeting ${met.profile_id} failed:`, err.response?.status || err.message);
      setNote(err.response?.data?.error || 'That could not be saved.');
    } finally { setBusy(false); }
  };
  const save = () => run(() => api.put('/api/v1/pulse-reveals', {
    show_id: ctx.showId, item_type: 'character', item_id: String(met.profile_id), episode_id: episodeId, moment: 'during', mode: 'hidden',
  }));
  const reset = () => run(() => api.delete(`/api/v1/pulse-reveals/${met.set.id}`));
  const text = met.set
    ? (met.episode_number != null ? `Meets Lala in Ep ${met.episode_number} (set)` : 'Meets Lala: set, episode not placed yet')
    : met.derived ? `Meets Lala in Ep ${met.derived.episode_number} (from the ${FROM[met.derived.from] || 'episodes'})`
      : 'Has not met Lala yet: no guest list or episode post names them.';
  return (
    <div className="pulse-reveal">
      <p className="pulse-met" data-testid="pulse-met">
        {text}{' '}
        <button type="button" className="pulse-link-btn" aria-expanded={open} aria-label={`Set when Lala meets ${name}`} onClick={() => setOpen((v) => !v)}>Set</button>
        {met.set && met.derived && (
          <>{' '}<button type="button" className="pulse-link-btn" disabled={busy} onClick={reset}>Reset to Ep {met.derived.episode_number}</button></>
        )}
        {met.set && !met.derived && (
          <>{' '}<button type="button" className="pulse-link-btn" disabled={busy} onClick={reset}>Clear</button></>
        )}
      </p>
      {open && (
        <div className="pulse-reveal-form">
          <label className="pulse-field">
            Lala meets {name} in
            <select value={episodeId} onChange={(e) => setEpisodeId(e.target.value)}>
              <option value="">Choose an episode</option>
              {ctx.episodes.map((ep) => <option key={ep.id} value={ep.id}>Ep {ep.episode_number}{ep.title ? ` · ${ep.title}` : ''}</option>)}
            </select>
          </label>
          <div className="pulse-actions">
            <button type="button" className="pulse-btn primary" disabled={busy || !episodeId} onClick={save}>Save</button>
            <button type="button" className="pulse-btn" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
      {note && <p className="pulse-error" role="alert">{note}</p>}
    </div>
  );
}

function CharacterRow({ character, onChange, met, onMetChanged }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const name = character.display_name || 'Unnamed character';

  const run = async (fn) => {
    setBusy(true);
    setNote(null);
    try {
      onChange({ ...character, ...(await fn()) });
    } catch (err) {
      console.error(`[PulseCharacters] ${character.id} action failed:`, err);
      setNote(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const upload = (kind) => (file) => run(async () => {
    const res = await characterPhotoApi.upload(character.id, kind, file);
    return kind === 'portrait' ? { portrait_url: res.portrait_url } : { cover_url: res.cover_url };
  });
  const remove = (kind) => () => run(async () => {
    await characterPhotoApi.remove(character.id, kind);
    return kind === 'portrait' ? { portrait_url: null } : { cover_url: null };
  });

  const role = character.role_label || (character.role_type ? character.role_type.replace(/_/g, ' ') : null);
  return (
    <article className="pulse-character pu-character" data-testid={`pulse-character-${character.id}`}>
      <div className="pu-character-portrait">
        <PulseImageSpot label="Profile photo" url={character.portrait_url} alt={name} round overlay busy={busy}
          onFile={upload('portrait')} onRemove={remove('portrait')} testId={`char-${character.id}-portrait`} />
      </div>
      <div className="pu-character-text">
        <h4>{character.icon ? `${character.icon} ` : ''}{name}{role && <span className="pu-role">{role}</span>}</h4>
        <MeetsLala met={met} name={name} onChanged={onMetChanged} />
      </div>
      <div className="pu-character-cover">
        <PulseImageSpot label="Cover" url={character.cover_url} alt="" overlay busy={busy}
          onFile={upload('cover')} onRemove={remove('cover')} testId={`char-${character.id}-cover`} />
      </div>
      {busy && <p className="pulse-hint"><Loader2 size={14} className="pulse-spin" aria-hidden="true" /> Saving…</p>}
      {note && <p className="pulse-error" role="alert">{note}</p>}
    </article>
  );
}

export default function PulseCharactersCard() {
  const [characters, setCharacters] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const reveals = useReveals();
  const showId = reveals?.showId;
  const [met, setMet] = useState(null); // registry character id → its "meets Lala" row; null until read

  const loadMet = useCallback(async () => {
    if (!showId) return;
    try {
      const res = await api.get(`/api/v1/pulse-reveals/met?show_id=${encodeURIComponent(showId)}`);
      setMet(new Map((res.data?.met || []).filter((m) => m.registry_character_id).map((m) => [m.registry_character_id, m])));
    } catch (err) {
      console.error('[PulseCharacters] when Lala meets each character could not be read:', err.response?.status || err.message);
    }
  }, [showId]);
  useEffect(() => { loadMet(); }, [loadMet]);

  useEffect(() => {
    let alive = true;
    characterPhotoApi.list()
      .then((list) => { if (alive) setCharacters(list); })
      .catch((err) => {
        console.error('[PulseCharacters] the cast could not be read:', err);
        if (alive) setError('The characters could not be loaded.');
      });
    return () => { alive = false; };
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (characters || []).filter((c) => !q || String(c.display_name || '').toLowerCase().includes(q));
  }, [characters, query]);
  const replace = (next) => setCharacters((list) => list.map((c) => (c.id === next.id ? next : c)));

  return (
    <section className="pulse-card pu-card" aria-labelledby="pulse-characters-heading" data-testid="pulse-characters">
      <UploadsHead Icon={Users} id="pulse-characters-heading" title="Characters"
        hint="Each character's profile photo and cover, saved on the character. Without a profile photo, they show their initial.">
        <Link className="pu-add-btn" to="/character-registry"><Plus size={16} aria-hidden="true" />Add in the Registry</Link>
      </UploadsHead>
      {error && <p className="pulse-error" role="alert">{error}</p>}
      {!characters && !error && <p className="pulse-hint"><Loader2 size={14} className="pulse-spin" aria-hidden="true" /> Loading the cast…</p>}
      {characters && (
        <>
          <label className="pulse-field pu-search">
            Search
            <input type="search" value={query} placeholder="A character's name" onChange={(e) => setQuery(e.target.value)} />
          </label>
          {characters.length === 0 && <p className="pulse-hint">No characters yet. They are made in the Character Registry.</p>}
          {characters.length > 0 && shown.length === 0 && <p className="pulse-hint">No character matches “{query.trim()}”.</p>}
          <div className="pulse-characters pu-characters">
            {shown.map((c) => <CharacterRow key={c.id} character={c} onChange={replace} met={met ? (met.get(c.id) || null) : undefined} onMetChanged={loadMet} />)}
          </div>
        </>
      )}
    </section>
  );
}
