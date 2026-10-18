/**
 * Known for: what a character is known for on The Pulse, their content type
 * (Evoni, 2026-10-17: "sometimes a persons content can be different than
 * what they do for work and these things make people interesting";
 * services/characterContentType). One of the Society tab's archetypes, kept
 * on their feed profile, shown next to their job. Suggest reads their
 * character file and proposes one; nothing is saved until Evoni keeps it or
 * picks another. The gap between their job and their content (the
 * suggestion's "Job vs content" line, or her own words) is kept on the
 * character: the story and chapter writers use it as a hook (idea 1).
 *
 * A type that changes over time (idea 2, 2026-10-18): changing an existing
 * type asks whether it is a rebrand (they change now, in the story: the
 * Pulse judges earlier posts by the old type) or a correction (they were
 * always this), and why. The change goes into their fact history.
 */
import { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import { API_URL } from '../../config/api';
import './KnownFor.css';

export const getContentTypeApi = (id) =>
  apiClient.get(`${API_URL}/cast/characters/${id}/content-type`);
export const putContentTypeApi = (id, body) =>
  apiClient.put(`${API_URL}/cast/characters/${id}/content-type`, body);
export const suggestContentTypeApi = (id) =>
  apiClient.post(`${API_URL}/cast/characters/${id}/content-type/suggest`);

export default function KnownFor({ characterId }) {
  const [data, setData] = useState(null);
  const [choice, setChoice] = useState(null);
  const [gap, setGap] = useState('');
  const [rebrand, setRebrand] = useState(false);
  const [reason, setReason] = useState('');
  const [suggestion, setSuggestion] = useState(null);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);

  useEffect(() => {
    let live = true;
    getContentTypeApi(characterId)
      .then((res) => { if (live) setData(res.data); })
      .catch((err) => {
        console.error('[KnownFor] load failed:', err);
        if (live) setData({ error: err.response?.data?.error || 'Could not load what they are known for.' });
      });
    return () => { live = false; };
  }, [characterId]);

  const save = async (name) => {
    setBusy('save');
    setNote(null);
    try {
      const changing = Boolean(data?.current?.name) && (name || null) !== data.current.name;
      const res = await putContentTypeApi(characterId, {
        name: name || null, gap: gap.trim() || null,
        ...(changing ? { rebrand, reason: reason.trim() || null } : {}),
      });
      setData(res.data);
      setChoice(null);
      setSuggestion(null);
      setNote({ kind: 'ok', text: changing ? (rebrand ? 'Saved as a rebrand at this point in the story.' : 'Saved as a correction.') : 'Saved.' });
      setRebrand(false);
      setReason('');
    } catch (err) {
      console.error('[KnownFor] save failed:', err);
      setNote({ kind: 'error', text: err.response?.data?.error || 'Could not save it.' });
    } finally {
      setBusy(null);
    }
  };

  const suggest = async () => {
    setBusy('suggest');
    setNote(null);
    try {
      const res = await suggestContentTypeApi(characterId);
      setSuggestion(res.data?.suggestion || null);
      setChoice(res.data?.suggestion?.name || '');
      setGap(res.data?.suggestion?.tension || data?.gap || '');
    } catch (err) {
      console.error('[KnownFor] suggest failed:', err);
      setNote({ kind: 'error', text: err.response?.data?.error || 'Could not suggest one.' });
    } finally {
      setBusy(null);
    }
  };

  if (!data) return <p className="ch-note">Loading what they are known for…</p>;
  if (data.error) return <p className="ch-note" role="alert">{data.error}</p>;
  if (!data.profile) return null;
  const current = data.current;
  const picking = choice !== null;
  const picked = (data.list || []).find((a) => a.name === choice) || null;
  const open = (name) => { setChoice(name); setGap(data.gap || ''); setRebrand(false); setReason(''); };
  const changing = picking && Boolean(current?.name) && (choice || null) !== current.name;

  return (
    <div className="kf" data-testid="ch-known-for">
      <div className="kf-head">
        <span className="kf-label">Known for on The Pulse</span>
        <span className="kf-value">{current ? current.name : <span className="ch-note">Not set</span>}</span>
      </div>
      {current?.content && !picking && <p className="ch-note">{current.content}</p>}
      {data.occupation && !picking && (
        <p className="ch-note kf-job">Their job is {data.occupation}. What they post can be different from what they do for work.</p>
      )}
      {data.gap && !picking && <p className="kf-tension" data-testid="kf-gap">Job vs content: {data.gap}</p>}
      {picking ? (
        <div className="kf-pick">
          {suggestion && (
            <div className="kf-suggestion" role="status">
              <p><strong>Suggested: {suggestion.name}.</strong> {suggestion.why}</p>
              {suggestion.differs_from_job && suggestion.tension && <p className="kf-tension">Job vs content: {suggestion.tension}</p>}
            </div>
          )}
          <label className="kf-select">Content type
            <select value={choice} onChange={(e) => setChoice(e.target.value)}>
              <option value="">Not set</option>
              {(data.list || []).map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
            </select>
          </label>
          {picked?.content && <p className="ch-note">{picked.content}</p>}
          {changing && (
            <fieldset className="kf-change" data-testid="kf-change">
              <legend>From {current.name} to {choice || 'none'}</legend>
              <label className="kf-radio">
                <input type="radio" name="kf-change" checked={rebrand} onChange={() => setRebrand(true)} />
                A rebrand: they change now, in the story. Their earlier posts stay {current.name}.
              </label>
              <label className="kf-radio">
                <input type="radio" name="kf-change" checked={!rebrand} onChange={() => setRebrand(false)} />
                A correction: they were always this.
              </label>
              <label className="kf-select">Why
                <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500}
                  placeholder={rebrand ? 'What made them change (it goes on their history)' : 'Optional'} />
              </label>
            </fieldset>
          )}
          <label className="kf-select">Job vs content: what the gap says about them
            <textarea rows={2} value={gap} onChange={(e) => setGap(e.target.value)} maxLength={600} placeholder="Optional. The story and chapter writers use it as a hook." />
          </label>
          <span className="ch-facts-row">
            <button type="button" className="ch-btn" disabled={!!busy} onClick={() => save(choice)}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
            <button type="button" className="ch-btn-soft" disabled={!!busy} onClick={() => { setChoice(null); setSuggestion(null); setGap(''); }}>Cancel</button>
          </span>
        </div>
      ) : (
        <span className="ch-facts-row">
          <button type="button" className="ch-btn-soft" disabled={!!busy} onClick={() => open(current?.name || '')}>{current ? 'Change' : 'Choose'}</button>
          <button type="button" className="ch-btn-soft" disabled={!!busy} onClick={suggest}>
            {busy === 'suggest' ? 'Reading their file…' : 'Suggest what they’re known for'}
          </button>
        </span>
      )}
      {note && <p className={note.kind === 'error' ? 'ch-note is-error' : 'ch-note'} role={note.kind === 'error' ? 'alert' : 'status'}>{note.text}</p>}
    </div>
  );
}
