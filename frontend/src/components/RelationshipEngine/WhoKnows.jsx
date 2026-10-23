/**
 * WhoKnows — "Who knows" in the Inspector (Evoni, 2026-10-23: "each
 * relationship records who knows the truth of it, like character secrets
 * do, so the writers know who can mention it and who can't").
 *
 * The people who know (besides the two of them) as chips, added from the
 * cast and removed with ×; where everyone else stands: Secret, Rumoured or
 * Known. Each change saves at once (PUT /relationships/:id with known_by
 * and public_state; services/relationshipKnowers on the server).
 */
import { useEffect, useState } from 'react';
import { EyeOff, Ear, Eye, X } from 'lucide-react';
import apiClient from '../../services/api';
import { API, cname, sideName } from './tokens';
import './WhoKnows.css';

export const PUBLIC_STATES = [
  { v: 'secret',   l: 'Secret',   Icon: EyeOff, everyone: 'doesn’t know' },
  { v: 'rumoured', l: 'Rumoured', Icon: Ear,    everyone: 'has only heard talk' },
  { v: 'known',    l: 'Known',    Icon: Eye,    everyone: 'knows' },
];

export const saveWhoKnows = (relId, fields) =>
  apiClient.put(`${API}/relationships/${relId}`, fields).then(r => r.data?.relationship || null);

const keyOf = k => (k.registry_character_id ? `c:${k.registry_character_id}` : k.profile_id != null ? `p:${k.profile_id}` : `n:${k.name}`);

/** A knower's name: the cast member's, else the name it was saved with. */
export function knowerName(k, charById = {}) {
  if (k.registry_character_id) return charById[k.registry_character_id] ? cname(charById[k.registry_character_id]) : (k.name || 'Someone no longer in the cast');
  if (k.profile_id != null) {
    const linked = Object.values(charById).find(c => String(c.feed_profile_id) === String(k.profile_id));
    return linked ? cname(linked) : (k.name || `Feed profile #${k.profile_id}`);
  }
  return k.name || 'Someone';
}

export default function WhoKnows({ rel, charById = {}, onSaved }) {
  const [knownBy, setKnownBy] = useState(() => (Array.isArray(rel.known_by) ? rel.known_by : []));
  const [state, setState] = useState(rel.public_state || 'known');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setKnownBy(Array.isArray(rel.known_by) ? rel.known_by : []);
    setState(rel.public_state || 'known');
    setError(null);
    // A new relationship, or one saved elsewhere, resets what is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rel.id, rel.updated_at]);

  const save = async (fields, revert) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await saveWhoKnows(rel.id, fields);
      if (updated && onSaved) onSaved(updated);
    } catch (err) {
      console.error('[WhoKnows] save failed:', err);
      revert();
      setError(err.response?.data?.error || 'Could not save who knows. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const setKnowers = next => {
    const before = knownBy;
    setKnownBy(next);
    save({ known_by: next }, () => setKnownBy(before));
  };
  const pickState = v => {
    if (v === state) return;
    const before = state;
    setState(v);
    save({ public_state: v }, () => setState(before));
  };

  const pair = [rel.character_id_a, rel.character_id_b];
  const listed = new Set(knownBy.map(keyOf));
  const addable = Object.values(charById)
    .filter(c => !pair.includes(c.id) && !listed.has(`c:${c.id}`))
    .sort((a, b) => cname(a).localeCompare(cname(b)));
  const current = PUBLIC_STATES.find(s => s.v === state) || PUBLIC_STATES[2];
  const nameA = sideName(rel, 'a', charById);
  const nameB = sideName(rel, 'b', charById);

  return (
    <section className="re-know" aria-label="Who knows">
      <h3 className="re-know-title">Who knows</h3>

      <div className="re-know-states" role="radiogroup" aria-label="Where everyone else stands">
        {PUBLIC_STATES.map(({ v, l, Icon }) => (
          <button key={v} type="button" role="radio" aria-checked={state === v}
            className={`re-know-state is-${v} ${state === v ? 'is-on' : ''}`}
            disabled={saving} onClick={() => pickState(v)}>
            <Icon size={14} aria-hidden /> {l}
          </button>
        ))}
      </div>

      <p className="re-know-line">{nameA} and {nameB} know, of course.</p>
      <ul className="re-know-chips" aria-label="Also know">
        {knownBy.map(k => {
          const name = knowerName(k, charById);
          return (
            <li key={keyOf(k)} className="re-know-chip" title={k.how || undefined}>
              <span className="re-know-chip-name">{name}</span>
              <button type="button" className="re-know-chip-x" aria-label={`Remove ${name}`} disabled={saving}
                onClick={() => setKnowers(knownBy.filter(x => keyOf(x) !== keyOf(k)))}>
                <X size={12} aria-hidden />
              </button>
            </li>
          );
        })}
        {knownBy.length === 0 && <li className="re-know-none">Nobody else is listed.</li>}
      </ul>

      {addable.length > 0 && (
        <label className="re-know-add">
          <span className="re-know-add-label">Add someone who knows</span>
          <select value="" disabled={saving}
            onChange={e => { if (e.target.value) setKnowers([...knownBy, { registry_character_id: e.target.value }]); }}>
            <option value="">Choose from the cast…</option>
            {addable.map(c => <option key={c.id} value={c.id}>{cname(c)}</option>)}
          </select>
        </label>
      )}

      <p className={`re-know-everyone is-${current.v}`}>
        <strong>Everyone else:</strong> {current.everyone}
      </p>
      {error && <p className="re-know-error" role="alert">{error}</p>}
    </section>
  );
}
