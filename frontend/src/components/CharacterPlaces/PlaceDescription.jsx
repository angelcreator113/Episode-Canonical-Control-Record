/**
 * "Write from their profile" on a Home, Closet or Place of work card
 * (Evoni, 2026-10-17: "when creating the description for the characters
 * homes can we use the information from their profiles?"). One AI call
 * (POST /cast/characters/:id/places/describe) writes the set's description
 * from their city, home location, price range, class, style and the gap
 * between the life they show and the one they live. The facts it used are
 * shown under the text, and those it lacked are named. Nothing is saved
 * until "Use this description" (PUT /scene-sets/:id); a description the set
 * already has is shown next to it, never replaced unasked.
 *
 * Sixth audit: the place's role is sent, so the lead's home that is also her
 * closet is described as the card it is on; ids carry the role, as the same
 * set can be on two cards; a place of work warns that a venue's set and its
 * description are shared with every event held there.
 */
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import api from '../../services/api';

export default function PlaceDescription({ characterId, setId, setName, role, onNote }) {
  const [busy, setBusy] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);

  const write = async () => {
    setBusy('write');
    setError(null);
    try {
      const res = await api.post(`/api/v1/cast/characters/${characterId}/places/describe`, { scene_set_id: setId, role });
      const data = res.data?.data || null;
      setDraft(data ? { ...data, text: data.description } : null);
    } catch (err) {
      console.error('[PlaceDescription] writing failed:', err);
      setError(err.response?.data?.error || 'Could not write the description');
    } finally { setBusy(null); }
  };

  const use = async () => {
    setBusy('save');
    setError(null);
    try {
      await api.put(`/api/v1/scene-sets/${setId}`, { canonical_description: draft.text });
      onNote?.({ text: `${setName}'s description saved` });
      setDraft(null);
    } catch (err) {
      console.error('[PlaceDescription] saving failed:', err);
      setError(err.response?.data?.error || 'Could not save the description');
    } finally { setBusy(null); }
  };

  if (!draft) {
    return (
      <div className="cpl-describe">
        <button type="button" className="cpl-btn is-soft is-small" disabled={busy === 'write'} onClick={write} data-testid={`place-describe-${role}-${setId}`}>
          <Sparkles size={14} aria-hidden="true" /> {busy === 'write' ? 'Reading their profile…' : 'Write from their profile'}
        </button>
        {error && <p className="cpl-note is-error" role="alert">{error}</p>}
      </div>
    );
  }
  return (
    <div className="cpl-describe is-open" data-testid={`place-describe-draft-${role}-${setId}`}>
      <label className="cpl-describe-label" htmlFor={`place-describe-text-${role}-${setId}`}>From their profile{draft.gap ? ' · shown vs real' : ''}</label>
      <textarea id={`place-describe-text-${role}-${setId}`} className="cpl-input cpl-describe-text" rows={6} value={draft.text}
        onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))} data-testid={`place-describe-text-${role}-${setId}`} />
      {draft.used?.length > 0 && (
        <ul className="cpl-describe-used" aria-label="What it was written from" data-testid={`place-describe-used-${role}-${setId}`}>
          {draft.used.map((u) => <li key={u.label}><strong>{u.label}:</strong> {u.value}</li>)}
        </ul>
      )}
      {draft.missing?.length > 0 && (
        <p className="cpl-note" data-testid={`place-describe-missing-${role}-${setId}`}>
          Not on their profile yet: {draft.missing.join(', ')}. Add them and write it again for a closer fit.
        </p>
      )}
      {role === 'work' && (
        <p className="cpl-note" data-testid={`place-describe-shared-${role}-${setId}`}>
          A place of work is often a venue&rsquo;s set: its description is the one every event held there is written from.
        </p>
      )}
      {draft.current && (
        <details className="cpl-describe-current">
          <summary>The description it has now</summary>
          <p>{draft.current}</p>
        </details>
      )}
      <span className="cpl-row">
        <button type="button" className="cpl-btn is-small" disabled={busy !== null || !draft.text.trim()} onClick={use} data-testid={`place-describe-use-${role}-${setId}`}>
          {busy === 'save' ? 'Saving…' : draft.current ? 'Replace it with this' : 'Use this description'}
        </button>
        <button type="button" className="cpl-btn is-soft is-small" disabled={busy !== null} onClick={write}>{busy === 'write' ? 'Writing…' : 'Write it again'}</button>
        <button type="button" className="cpl-btn is-soft is-small" disabled={busy !== null} onClick={() => { setDraft(null); setError(null); }}>Cancel</button>
      </span>
      {error && <p className="cpl-note is-error" role="alert">{error}</p>}
    </div>
  );
}
