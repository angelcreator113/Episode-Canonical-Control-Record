/**
 * Visual Memory, phase 3 (Evoni, 2026-10-19; services/mediaVariations,
 * POST /api/v1/media/:id/variations, GET /api/v1/media/:id/family):
 *
 *   MakeVariation   keep the picture, change one thing: an object, the action,
 *                   the time of day, the weather, the framing, or add an
 *                   approved character. Face, wardrobe, location and props
 *                   can be locked (all locked but what is changing). One
 *                   image call. The new picture is a private draft beside the
 *                   original, with what to check; Approve (with who may see
 *                   it) or Discard. The original never changes.
 *   PictureFamily   the original and every variation made from it.
 *
 * A picture is not a story fact: a variation never records that anything happened.
 */
import { useState, useEffect, useCallback } from 'react';
import { Wand2, Lock, Unlock, Check, Trash2, GitBranch, Search } from 'lucide-react';
import api from '../../services/api';
import './MakeVariation.css';

const errorText = (err, fallback) => err?.response?.data?.error || fallback;

export const KINDS = Object.freeze([
  ['object', 'An object', 'a tea cup instead of the bread bowl'],
  ['action', 'What they are doing', 'reading instead of kneading'],
  ['time', 'The time of day', 'early morning'],
  ['weather', 'The weather', 'rain on the window'],
  ['framing', 'The framing', 'a close-up from the side'],
  ['add_character', 'Add a character', 'sitting at the table'],
]);
export const LOCKS = Object.freeze([['face', 'Face'], ['wardrobe', 'Wardrobe'], ['location', 'Location'], ['props', 'Props']]);
// The lock that is the thing being changed starts unlocked.
const UNLOCKED_FOR = { object: 'props' };
const VISIBILITY_WORDS = { private: 'Only me', internal: 'The studio', public: 'Public (can go on The Pulse)' };

const locksFor = (kind) => LOCKS.map(([k]) => k).filter((k) => k !== UNLOCKED_FOR[kind]);

/** A search over characters to add. */
function CharacterPick({ value, onPick }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setFound([]); return undefined; }
    let live = true;
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/api/v1/media/taggables?q=${encodeURIComponent(term)}`);
        if (live) setFound((data.items || []).filter((i) => i.entity_type === 'character'));
      } catch (err) {
        console.error('[MakeVariation] the character search failed:', err);
        if (live) setFound([]);
      }
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [q]);
  return (
    <div className="mv-pick">
      <label className="mv-label">
        <span><Search size={13} aria-hidden /> Who to add{value ? `: ${value.name}` : ''}</span>
        <input className="mv-input" type="search" value={q} placeholder="A name" onChange={(e) => setQ(e.target.value)} />
      </label>
      {found.length > 0 && (
        <ul className="mv-found" aria-label="Characters">
          {found.map((f) => (
            <li key={f.entity_id}>
              <button type="button" className="mv-found-btn" onClick={() => { onPick({ id: f.entity_id, name: f.name }); setQ(''); setFound([]); }}>{f.name}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The new draft beside its original: what to check, Approve or Discard. */
function Made({ original, made, review, onDone }) {
  const [visibility, setVisibility] = useState('internal');
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const approve = async () => {
    setBusy(true); setError(null);
    try {
      await api.put(`/api/v1/media/${made.id}`, { status: 'approved', visibility });
      setState('approved'); onDone?.();
    } catch (err) {
      console.error('[MakeVariation] approving failed:', err);
      setError(errorText(err, 'It was not approved. Try again.'));
    } finally { setBusy(false); }
  };
  const discard = async () => {
    setBusy(true); setError(null);
    try {
      await api.delete(`/api/v1/media/${made.id}`);
      setState('discarded'); onDone?.();
    } catch (err) {
      console.error('[MakeVariation] discarding failed:', err);
      setError(errorText(err, 'It was not discarded. Try again.'));
    } finally { setBusy(false); }
  };
  return (
    <div className="mv-made" data-testid="mv-made">
      <div className="mv-pair">
        <figure><img src={original.url} alt={original.caption || 'The original'} /><figcaption>The original</figcaption></figure>
        <figure><img src={made.url} alt={made.caption || 'The variation'} /><figcaption>The variation · made from the original</figcaption></figure>
      </div>
      {review?.reasons?.length > 0 && (
        <div className="mv-review">
          <p className="mv-muted">Before you approve it, check:</p>
          <ul>{review.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
      {state === 'approved' && <p className="mv-note" role="status">Approved. It is in the library with its tags.</p>}
      {state === 'discarded' && <p className="mv-note" role="status">Discarded. The original is unchanged.</p>}
      {!state && (
        <div className="mv-row">
          <label className="mv-label"><span>Who may see it</span>
            <select className="mv-input" value={visibility} onChange={(e) => setVisibility(e.target.value)} disabled={busy}>
              {Object.entries(VISIBILITY_WORDS).map(([v, w]) => <option key={v} value={v}>{w}</option>)}
            </select>
          </label>
          <button type="button" className="mv-btn" disabled={busy} onClick={approve}><Check size={14} aria-hidden /> Approve</button>
          <button type="button" className="mv-btn is-quiet" disabled={busy} onClick={discard}><Trash2 size={14} aria-hidden /> Discard</button>
        </div>
      )}
      {error && <p className="mv-error" role="alert">{error}</p>}
    </div>
  );
}

export function MakeVariation({ asset, onMade, startOpen = false }) {
  const [open, setOpen] = useState(startOpen);
  const [kind, setKind] = useState('object');
  const [text, setText] = useState('');
  const [who, setWho] = useState(null);
  const [locks, setLocks] = useState(locksFor('object'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [made, setMade] = useState(null);

  const pickKind = (k) => { setKind(k); setLocks(locksFor(k)); };
  const toggle = (l) => setLocks((list) => (list.includes(l) ? list.filter((x) => x !== l) : [...list, l]));
  const ready = kind === 'add_character' ? Boolean(who) : text.trim().length > 0;
  const hint = KINDS.find(([k]) => k === kind)?.[2];

  const make = async () => {
    setBusy(true); setError(null); setMade(null);
    try {
      const { data } = await api.post(`/api/v1/media/${asset.id}/variations`, {
        change: { kind, text: text.trim(), ...(kind === 'add_character' ? { character_id: who.id } : {}) }, locks,
      });
      setMade({ asset: data.asset, review: data.review });
      onMade?.();
    } catch (err) {
      console.error('[MakeVariation] the variation was not made:', err);
      setError(errorText(err, 'The variation was not made. Try again.'));
    } finally { setBusy(false); }
  };

  if (!open) {
    return <button type="button" className="mv-btn is-quiet" onClick={() => setOpen(true)} data-testid="mv-open"><Wand2 size={14} aria-hidden /> Make a variation</button>;
  }
  return (
    <section className="mv" data-testid="make-variation" aria-label="Make a variation">
      <label className="mv-label"><span>Change</span>
        <select className="mv-input" value={kind} onChange={(e) => pickKind(e.target.value)} disabled={busy}>
          {KINDS.map(([k, w]) => <option key={k} value={k}>{w}</option>)}
        </select>
      </label>
      {kind === 'add_character' && <CharacterPick value={who} onPick={setWho} />}
      <label className="mv-label"><span>{kind === 'add_character' ? 'Where, doing what (optional)' : 'To what'}</span>
        <input className="mv-input" value={text} maxLength={300} placeholder={hint} onChange={(e) => setText(e.target.value)} disabled={busy} />
      </label>
      <div className="mv-locks" role="group" aria-label="Locks">
        {LOCKS.map(([l, w]) => {
          const on = locks.includes(l);
          const fixed = UNLOCKED_FOR[kind] === l;
          return (
            <button key={l} type="button" className={on ? 'mv-lock is-on' : 'mv-lock'} aria-pressed={on} disabled={busy || fixed} onClick={() => toggle(l)}
              title={fixed ? 'This is what is changing' : undefined}>
              {on ? <Lock size={12} aria-hidden /> : <Unlock size={12} aria-hidden />} {w}
            </button>
          );
        })}
      </div>
      <p className="mv-muted">One image call, within today's image budget. The original never changes; the variation is saved as a private draft.</p>
      <div className="mv-row">
        <button type="button" className="mv-btn" disabled={busy || !ready} onClick={make} data-testid="mv-make">{busy ? 'Making it…' : 'Make it'}</button>
        <button type="button" className="mv-btn is-quiet" disabled={busy} onClick={() => setOpen(false)}>Close</button>
      </div>
      {error && <p className="mv-error" role="alert">{error}</p>}
      {made && <Made original={asset} made={made.asset} review={made.review} onDone={onMade} />}
    </section>
  );
}

export function PictureFamily({ assetId }) {
  const [family, setFamily] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/v1/media/${assetId}/family`);
      setFamily(data);
    } catch (err) {
      console.error('[MakeVariation] the family could not be read:', err);
      setError(errorText(err, 'Its variations could not be loaded.'));
    }
  }, [assetId]);
  useEffect(() => { load(); }, [load]);
  if (error) return <p className="mv-error" role="alert">{error}</p>;
  if (!Array.isArray(family?.items) || family.items.length < 2) return null;
  return (
    <section className="mv-family" data-testid="picture-family" aria-label="Its variations">
      <h5 className="mv-title"><GitBranch size={14} aria-hidden /> The original and its variations ({family.items.length})</h5>
      <ul className="mv-family-list">
        {family.items.map((a) => (
          <li key={a.id} className={a.id === assetId ? 'mv-family-item is-here' : 'mv-family-item'}>
            <img src={a.url} alt={a.caption || ''} loading="lazy" />
            <span className="mv-muted">
              {a.parent_asset_id ? `Variation${a.generation?.kind ? ` (${a.generation.kind.replace('_', ' ')})` : ''}` : 'The original'}
              {a.status !== 'approved' ? ' · draft' : ''}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default MakeVariation;
