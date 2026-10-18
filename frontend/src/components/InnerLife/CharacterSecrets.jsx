/**
 * Secrets (Evoni, 2026-10-17, stage B: the revelation budget). What this
 * character keeps, who in the story knows each one, where the audience
 * stands, and what each story may do with it: keep it hidden, hint at it,
 * or reveal it. The Character Story Brief gives every writer the kept ones
 * (services/characterSecrets). Suggested ones wait here to be kept or
 * discarded; nothing reaches a writer until it is kept.
 *
 * The author edits; everyone else reads.
 */
import { useCallback, useEffect, useState } from 'react';
import { Sparkles, Plus } from 'lucide-react';
import apiClient from '../../services/api';
import { API_URL } from '../../config/api';

export const LAYERS = [['episode', 'Episode'], ['short_story', 'Short story'], ['chapter', 'Chapter book']];
export const PERMISSIONS = [['hidden', 'Keep hidden'], ['hint', 'Hint only'], ['reveal', 'May reveal']];
export const STATES = [['hidden', 'Not hinted yet'], ['hinted', 'Hinted'], ['revealed', 'Revealed']];
const SOURCE_LABELS = {
  want_architecture: 'What they want', hidden_want: 'Hidden want', core_desire: 'Desire', core_fear: 'Fear', core_wound: 'Wound',
  wound: 'Wound', truth_persona: 'Who they are underneath', dilemma: 'Dilemma', triggers: 'Triggers', de_forbidden_joy: 'Forbidden joy',
  self_narrative: 'Self-story', foreclosed_possibility: 'What they gave up on', living_state: 'Right now', other: 'Other',
};

const errorOf = (err, fallback) => err?.response?.data?.error || fallback;

function Secret({ secret, cast, isAuthor, busy, onChange, onRetire }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(secret.text);
  const [where, setWhere] = useState(secret.where || '');
  const known = new Set(secret.known_by);
  const toggleKnown = (id) => onChange({ known_by: known.has(id) ? secret.known_by.filter((k) => k !== id) : [...secret.known_by, id] });

  if (!isAuthor) {
    return (
      <li className="il-secret" data-testid={`il-secret-${secret.id}`}>
        <p className="il-secret-text">{secret.text}</p>
        <p className="il-note">
          {STATES.find(([k]) => k === secret.state)?.[1]} · {secret.known_by_people.length ? `Known to ${secret.known_by_people.map((p) => p.name).join(', ')}` : 'No one else knows'}
        </p>
      </li>
    );
  }

  return (
    <li className="il-secret" data-testid={`il-secret-${secret.id}`}>
      {editing ? (
        <div className="il-field">
          <label className="il-label" htmlFor={`il-secret-text-${secret.id}`}>The secret</label>
          <textarea id={`il-secret-text-${secret.id}`} rows={2} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="il-actions">
            <button type="button" className="il-btn" disabled={busy || !text.trim()} onClick={async () => { if (await onChange({ text })) setEditing(false); }}>Save</button>
            <button type="button" className="il-btn-soft" onClick={() => { setText(secret.text); setEditing(false); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="il-secret-head">
          <p className="il-secret-text">{secret.text}</p>
          <button type="button" className="il-btn-soft" onClick={() => setEditing(true)}>Edit</button>
        </div>
      )}
      {secret.source_field && <span className="il-badge is-gold">From: {SOURCE_LABELS[secret.source_field] || secret.source_field}</span>}

      <div className="il-secret-grid">
        {LAYERS.map(([key, label]) => (
          <label key={key} className="il-field">
            <span className="il-label">{label}</span>
            <select value={secret.permissions[key]} disabled={busy} onChange={(e) => onChange({ permissions: { [key]: e.target.value } })}>
              {PERMISSIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
        ))}
        <label className="il-field">
          <span className="il-label">The audience</span>
          <select value={secret.state} disabled={busy} onChange={(e) => onChange({ state: e.target.value })}>
            {STATES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      </div>
      {secret.state !== 'hidden' && (
        <label className="il-field">
          <span className="il-label">Where</span>
          <input type="text" value={where} placeholder="Episode 4, the gala" onChange={(e) => setWhere(e.target.value)}
            onBlur={() => { if (where !== (secret.where || '')) onChange({ where }); }} />
        </label>
      )}

      <div className="il-field">
        <span className="il-label">Known to</span>
        {cast.length ? (
          <div className="il-chips" role="group" aria-label="Known to">
            {cast.map((p) => (
              <button key={p.id} type="button" className={`il-chip${known.has(p.id) ? ' is-on' : ''}`} aria-pressed={known.has(p.id)} disabled={busy} onClick={() => toggleKnown(p.id)}>
                {p.name}
              </button>
            ))}
          </div>
        ) : <p className="il-note">No one else is in their registry yet.</p>}
        {!known.size && <p className="il-note">No one else knows. Only the people who know can act on it or bring it up.</p>}
      </div>

      <div className="il-actions">
        <button type="button" className="il-btn-soft" disabled={busy} onClick={onRetire}>Retire</button>
      </div>
    </li>
  );
}

export default function CharacterSecrets({ character, isAuthor }) {
  const base = `${API_URL}/cast/characters/${character.id}/secrets`;
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  const [draft, setDraft] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get(base);
      setData({ secrets: res.data?.secrets || [], cast: res.data?.cast || [] });
    } catch (err) {
      console.error('[CharacterSecrets] load failed:', err);
      setNote({ error: true, text: errorOf(err, 'Their secrets could not be loaded.') });
      setData({ secrets: [], cast: [] });
    }
  }, [base]);
  useEffect(() => { load(); }, [load]);

  const replace = (secret) => setData((d) => ({ ...d, secrets: d.secrets.map((s) => (s.id === secret.id ? secret : s)) }));
  const drop = (id) => setData((d) => ({ ...d, secrets: d.secrets.filter((s) => s.id !== id) }));

  const run = async (key, fn, failed) => {
    setBusy(key); setNote(null);
    try { await fn(); return true; } catch (err) {
      console.error('[CharacterSecrets] save failed:', err);
      setNote({ error: true, text: errorOf(err, failed) });
      return false;
    } finally { setBusy(null); }
  };
  const change = (id, patch) => run(id, async () => replace((await apiClient.put(`${base}/${id}`, patch)).data.secret), 'That change was not saved.');
  const retire = (id) => run(id, async () => { await apiClient.put(`${base}/${id}`, { status: 'retired' }); drop(id); }, 'It was not retired.');
  const keep = (id) => change(id, { status: 'confirmed' });
  const discard = (id) => run(id, async () => { await apiClient.delete(`${base}/${id}`); drop(id); }, 'It was not discarded.');
  const add = () => run('add', async () => {
    const res = await apiClient.post(base, { text: draft });
    setData((d) => ({ ...d, secrets: [...d.secrets.filter((s) => s.status === 'confirmed'), res.data.secret, ...d.secrets.filter((s) => s.status !== 'confirmed')] }));
    setDraft('');
  }, 'The secret was not added.');
  const suggest = () => run('suggest', async () => {
    const res = await apiClient.post(`${base}/suggest`);
    const added = res.data?.added || [];
    setData((d) => ({ ...d, secrets: [...d.secrets, ...added] }));
    setNote({ text: added.length ? `${added.length} suggested below. Keep the ones that are true.` : 'Nothing new to suggest.' });
  }, 'The suggestion did not come back.');

  if (!data) return <p className="il-note" role="status">Loading their secrets…</p>;
  const kept = data.secrets.filter((s) => s.status === 'confirmed');
  const candidates = data.secrets.filter((s) => s.status === 'candidate');

  return (
    <div className="il-secrets">
      {note && <p className={`il-note${note.error ? ' is-error' : ''}`} role="status">{note.text}</p>}

      {kept.length ? (
        <ul className="il-secret-list" aria-label="Their secrets">
          {kept.map((s) => (
            <Secret key={s.id} secret={s} cast={data.cast} isAuthor={isAuthor} busy={busy === s.id}
              onChange={(patch) => change(s.id, patch)} onRetire={() => retire(s.id)} />
          ))}
        </ul>
      ) : <p className="il-note">No secrets kept yet. Every story keeps their private truth as subtext until one is.</p>}

      {isAuthor && candidates.length > 0 && (
        <section className="il-secret-candidates" aria-labelledby="il-secret-cand-h" data-testid="il-secret-candidates">
          <h4 id="il-secret-cand-h" className="il-subject-title">Suggested</h4>
          <ul className="il-secret-list">
            {candidates.map((s) => (
              <li key={s.id} className="il-secret is-candidate" data-testid={`il-secret-${s.id}`}>
                <p className="il-secret-text">{s.text}</p>
                {s.source_field && <span className="il-badge is-gold">From: {SOURCE_LABELS[s.source_field] || s.source_field}</span>}
                <div className="il-actions">
                  <button type="button" className="il-btn" disabled={busy === s.id} onClick={() => keep(s.id)}>Keep</button>
                  <button type="button" className="il-btn-soft" disabled={busy === s.id} onClick={() => discard(s.id)}>Discard</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isAuthor && (
        <div className="il-secret-add">
          <label className="il-field">
            <span className="il-label">Add a secret</span>
            <textarea rows={2} value={draft} placeholder="She sold her mother's ring to pay for the launch." onChange={(e) => setDraft(e.target.value)} />
          </label>
          <div className="il-actions">
            <button type="button" className="il-btn" disabled={!draft.trim() || !!busy} onClick={add}><Plus size={14} aria-hidden="true" /> Add</button>
            <button type="button" className="il-btn-soft" disabled={!!busy} onClick={suggest}>
              <Sparkles size={14} aria-hidden="true" /> {busy === 'suggest' ? 'Reading their inner life…' : 'Suggest secrets'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
