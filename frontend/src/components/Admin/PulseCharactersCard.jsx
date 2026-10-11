/**
 * Admin › The Pulse › Uploads › Characters (Task #2921): each character's
 * profile photo (portrait_url) and cover photo (cover_url), saved on the
 * character record (RegistryCharacter; The Pulse spec §2 rule 3). The cast
 * is every registry's characters, as the Character Registry lists them.
 * Styles: styles/AdminPanel.css.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import api from '../../services/api';
import PulseImageSpot from './PulseImageSpot';

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

function CharacterRow({ character, onChange }) {
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

  return (
    <article className="pulse-character" data-testid={`pulse-character-${character.id}`}>
      <h4>{character.icon ? `${character.icon} ` : ''}{name}</h4>
      <div className="pulse-character-spots">
        <PulseImageSpot label="Profile photo" url={character.portrait_url} alt={name} round busy={busy}
          onFile={upload('portrait')} onRemove={remove('portrait')} testId={`char-${character.id}-portrait`} />
        <PulseImageSpot label="Cover" url={character.cover_url} alt="" busy={busy}
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
    <section className="pulse-card" aria-labelledby="pulse-characters-heading" data-testid="pulse-characters">
      <h3 id="pulse-characters-heading">Characters</h3>
      <p className="pulse-hint">Saved on each character. A character without a profile photo shows their initial.</p>
      {error && <p className="pulse-error" role="alert">{error}</p>}
      {!characters && !error && <p className="pulse-hint"><Loader2 size={14} className="pulse-spin" aria-hidden="true" /> Loading the cast…</p>}
      {characters && (
        <>
          <label className="pulse-field">
            Search
            <input type="search" value={query} placeholder="A character's name" onChange={(e) => setQuery(e.target.value)} />
          </label>
          {characters.length === 0 && <p className="pulse-hint">No characters yet. They are made in the Character Registry.</p>}
          {characters.length > 0 && shown.length === 0 && <p className="pulse-hint">No character matches “{query.trim()}”.</p>}
          <div className="pulse-characters">
            {shown.map((c) => <CharacterRow key={c.id} character={c} onChange={replace} />)}
          </div>
        </>
      )}
    </section>
  );
}
