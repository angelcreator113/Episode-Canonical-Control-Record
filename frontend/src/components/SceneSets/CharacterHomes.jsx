/**
 * Characters' places on a scene set (Evoni, 2026-10-15: linking a venue to
 * a character as their home; "Lead character is Lala but other characters
 * have home sets"; step 3 of docs/VENUE_EVERYDAY_AND_EVENT_LOOKS_PLAN.md).
 *
 * Shows who this set belongs to ("Lala · home"), and links a character to
 * it as their home, closet or another place. The show's lead keeps her home
 * and closet as the show's defaults, so linking hers changes those
 * (onDefaultsChanged lets the page refresh its Default badges). The lead
 * is chosen here too. Reads and writes /shows/:showId/character-places.
 */
import { useCallback, useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import api from '../../services/api';
import './CharacterHomes.css';

const ROLE_LABELS = { home: 'home', closet: 'closet', other: 'place' };

// One read per show for every card on the page. Any change (here, on
// another card, or "Make default" on the page) clears the show's entry and
// tells every card of that show to read again.
const cache = new Map();
const CHANGED = 'character-places-changed';
export function clearCharacterPlacesCache() { cache.clear(); }
// next: the show's places as the write returned them (cached for every
// card); without it, every card reads them again.
export function notifyCharacterPlacesChanged(showId, next = undefined) {
  if (next) cache.set(showId, Promise.resolve(next));
  else cache.delete(showId);
  window.dispatchEvent(new CustomEvent(CHANGED, { detail: { showId } }));
}
function readPlaces(showId, fresh = false) {
  if (fresh || !cache.has(showId)) {
    cache.set(showId, api.get(`/api/v1/shows/${showId}/character-places`).then((res) => res.data?.data || null)
      .catch((err) => { cache.delete(showId); throw err; }));
  }
  return cache.get(showId);
}

export default function CharacterHomes({ set, onToast, onDefaultsChanged }) {
  const showId = set.show_id;
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ character_id: '', role: 'home', label: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (fresh = false) => {
    try {
      setData(await readPlaces(showId, fresh));
    } catch (err) {
      console.error('[CharacterHomes] load failed:', err);
    }
  }, [showId]);

  useEffect(() => { if (showId) load(); }, [showId, load]);
  useEffect(() => {
    const onChanged = (e) => { if (String(e.detail?.showId) === String(showId)) load(); };
    window.addEventListener(CHANGED, onChanged);
    return () => window.removeEventListener(CHANGED, onChanged);
  }, [showId, load]);

  if (!showId || !data) return null;

  const here = data.characters.flatMap((c) => c.places
    .filter((p) => String(p.scene_set_id) === String(set.id))
    .map((p) => ({ character: c, place: p })));

  const after = async (next, toast, leadDefaultsChanged) => {
    setData(next);
    notifyCharacterPlacesChanged(showId, next);
    if (leadDefaultsChanged) onDefaultsChanged?.(showId);
    onToast?.(toast);
  };

  const link = async () => {
    if (!form.character_id) return;
    setBusy(true);
    try {
      const res = await api.post(`/api/v1/shows/${showId}/character-places`, {
        character_id: form.character_id, scene_set_id: set.id, role: form.role, label: form.role === 'other' ? form.label : undefined,
      });
      const character = data.characters.find((c) => String(c.id) === String(form.character_id));
      await after(res.data?.data, `${set.name} is ${character?.name || 'the character'}'s ${ROLE_LABELS[form.role]}`,
        Boolean(character?.is_lead && form.role !== 'other'));
      setOpen(false);
      setForm({ character_id: '', role: 'home', label: '' });
    } catch (err) {
      console.error('[CharacterHomes] link failed:', err);
      onToast?.(err.response?.data?.error || 'Could not link the character', 'error');
    } finally {
      setBusy(false);
    }
  };

  const unlink = async ({ character, place }) => {
    setBusy(true);
    try {
      const res = await api.post(`/api/v1/shows/${showId}/character-places/unlink`, {
        character_id: character.id, scene_set_id: set.id, role: place.role,
      });
      await after(res.data?.data, `${set.name} is no longer ${character.name}'s ${ROLE_LABELS[place.role]}`,
        Boolean(character.is_lead && place.role !== 'other'));
    } catch (err) {
      console.error('[CharacterHomes] unlink failed:', err);
      onToast?.(err.response?.data?.error || 'Could not unlink the character', 'error');
    } finally {
      setBusy(false);
    }
  };

  const chooseLead = async (characterId) => {
    setBusy(true);
    try {
      await api.put(`/api/v1/shows/${showId}/lead-character`, { character_id: characterId || null });
      const next = await readPlaces(showId, true);
      setData(next);
      notifyCharacterPlacesChanged(showId, next);
      // A new lead brings her own home and closet as the show's defaults.
      onDefaultsChanged?.(showId);
      const lead = next?.characters.find((c) => c.is_lead);
      onToast?.(lead ? `${lead.name} is the show's lead` : 'The show has no lead');
    } catch (err) {
      console.error('[CharacterHomes] lead failed:', err);
      onToast?.(err.response?.data?.error || 'Could not set the lead', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ch" data-testid={`character-homes-${set.id}`} onClick={(e) => e.stopPropagation()}>
      <span className="ch-label">Characters' places</span>
      <div className="ch-chips">
        {here.map(({ character, place }) => (
          <span key={`${character.id}-${place.role}`} className="ch-chip" data-testid={`character-place-${character.id}`}>
            {character.name} · {place.role === 'other' && place.label ? place.label : ROLE_LABELS[place.role]}{character.is_lead ? ' (lead)' : ''}
            <button type="button" className="ch-x" aria-label={`Unlink ${character.name}`} disabled={busy} onClick={() => unlink({ character, place })}>
              <X size={11} aria-hidden="true" />
            </button>
          </span>
        ))}
        {here.length === 0 && <span className="ch-none">None yet</span>}
        <button type="button" className="ch-btn" onClick={() => setOpen((o) => !o)} data-testid={`character-homes-link-${set.id}`}>
          <Plus size={11} aria-hidden="true" /> Link a character
        </button>
      </div>

      {open && (
        <div className="ch-form" data-testid={`character-homes-form-${set.id}`}>
          {data.characters.length === 0 ? (
            <span className="ch-none">This show has no characters in its registry yet.</span>
          ) : (
            <>
              <select aria-label="Character" value={form.character_id} onChange={(e) => setForm((f) => ({ ...f, character_id: e.target.value }))}>
                <option value="">Character…</option>
                {data.characters.map((c) => <option key={c.id} value={c.id}>{c.name}{c.is_lead ? ' (lead)' : ''}</option>)}
              </select>
              <select aria-label="Role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                <option value="home">Home</option>
                <option value="closet">Closet</option>
                <option value="other">Other place</option>
              </select>
              {form.role === 'other' && (
                <input aria-label="Place name" placeholder="e.g. Studio" maxLength={80} value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
              )}
              <button type="button" className="ch-btn ch-btn-primary" disabled={busy || !form.character_id} onClick={link} data-testid={`character-homes-save-${set.id}`}>
                Link
              </button>
              <label className="ch-lead">
                Show's lead:{' '}
                <select aria-label="Show's lead" value={data.lead_character_id || ''} disabled={busy} onChange={(e) => chooseLead(e.target.value)}>
                  <option value="">None</option>
                  {data.characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            </>
          )}
        </div>
      )}
    </div>
  );
}
