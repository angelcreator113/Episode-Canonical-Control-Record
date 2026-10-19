/**
 * Admin › The Pulse › Voices (Task 2972; The Pulse spec §7 "Evoni's edits and
 * pinned posts become voice examples"). One card per posting character
 * (/api/v1/pulse-voices, Task 2967): their stage and whether their voice is
 * built, edited or needs a rebuild; Build or Rebuild; the habits as
 * editable fields; the examples, with Remove, and one added by hand. The
 * banned phrases the gate rejects are listed read-only. Posts are pinned as
 * examples from Review's cards (PinAsExample).
 * Approve voice (Task 3029; Evoni, 2026-10-12): the worker posts for a
 * character only once she approves the voice; her edits keep it, a rebuild
 * clears it.
 * Not posting yet (Evoni, 2026-10-17: "i have no way of choosing a
 * characters voice"): characters on the feed below the Active stage are
 * listed with their stage and Make Active, so their voice can be built.
 * Styles: AdminPanel.css (pulse-voices-*).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { atHandle } from '../../pages/feed/feedConstants';

const CASES = ['lowercase', 'sentence', 'mixed', 'caps for emphasis'];
const EMOJI = ['never', 'rarely', 'sometimes', 'often'];
const LENGTHS = ['short', 'medium', 'long'];
// How readily they post (services/pulseVoices TEMPERAMENTS; pulseEventPosting, pulseAmbient).
const TEMPERAMENTS = [
  ['oversharer', 'oversharer: posts about everything'],
  ['regular', 'regular'],
  ['lurker', 'lurker: mostly watches and comments'],
];
const errorOf = (err, fallback) => err.response?.data?.error || fallback;
const toList = (text) => String(text || '').split(',').map((s) => s.trim()).filter(Boolean);
const fromList = (list) => (Array.isArray(list) ? list.join(', ') : '');

/** The voice's state, in words. */
export function voiceState(row) {
  if (!row.voice) return { label: 'No voice yet', tone: 'none' };
  if (row.needs_rebuild) return { label: 'Profile changed: rebuild', tone: 'stale' };
  if (row.voice.status === 'edited') return { label: `Edited${row.voice.edited_by ? ` by ${row.voice.edited_by}` : ''}`, tone: 'ok' };
  return { label: 'Built', tone: 'ok' };
}

/** Whether the worker may post for the character, in words. */
export function approvalState(voice) {
  if (!voice) return null;
  if (!voice.approved_at) return { approved: false, label: 'Waiting for your approval: not posting yet' };
  const when = new Date(voice.approved_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return { approved: true, label: `Approved${voice.approved_by ? ` by ${voice.approved_by}` : ''} on ${when}` };
}

/**
 * What a character's stage lets them do (Evoni, 2026-10-12): Active posts;
 * Alive also talks in DMs, moves relationships and reacts to events.
 */
export function stageText(depthLevel) {
  if (depthLevel === 'alive') return 'Alive: posts, and also talks, relates and reacts to events';
  if (depthLevel === 'active') return 'Active: posts only. Alive also talks, relates and reacts to events';
  return depthLevel || '';
}

/** The editable habits as form strings, and back. */
export const habitsToForm = (h = {}) => ({
  case: h.case || 'sentence',
  punctuation: h.punctuation || '',
  emoji_use: h.emoji?.use || 'rarely',
  emoji_favorites: fromList(h.emoji?.favorites),
  sentence_length: h.sentence_length || 'short',
  temperament: h.temperament || 'regular',
  topics: fromList(h.topics),
  never_says: fromList(h.never_says),
  signature_phrases: fromList(h.signature_phrases),
});
export const formToHabits = (f) => ({
  case: f.case,
  punctuation: f.punctuation.trim(),
  emoji: { use: f.emoji_use, favorites: toList(f.emoji_favorites) },
  sentence_length: f.sentence_length,
  temperament: f.temperament,
  topics: toList(f.topics),
  never_says: toList(f.never_says),
  signature_phrases: toList(f.signature_phrases),
});

function HabitsForm({ voice, onSaved }) {
  const initial = habitsToForm(voice.habits);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const changed = JSON.stringify(form) !== JSON.stringify(initial);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await api.put(`/api/v1/pulse-voices/${voice.id}`, { habits: formToHabits(form) });
      onSaved(res.data.voice);
    } catch (err) {
      console.error('[PulseVoices] saving the habits failed:', err.response?.status || err.message);
      setError(errorOf(err, 'Saving the habits failed.'));
    } finally { setBusy(false); }
  };
  const id = (k) => `pv-${voice.id}-${k}`;
  return (
    <form className="pulse-voices-habits" onSubmit={save} data-testid="pulse-voices-habits">
      <label htmlFor={id('case')}>Case</label>
      <select id={id('case')} value={form.case} onChange={set('case')}>{CASES.map((v) => <option key={v} value={v}>{v}</option>)}</select>
      <label htmlFor={id('length')}>Sentence length</label>
      <select id={id('length')} value={form.sentence_length} onChange={set('sentence_length')}>{LENGTHS.map((v) => <option key={v} value={v}>{v}</option>)}</select>
      <label htmlFor={id('temperament')}>Temperament</label>
      <select id={id('temperament')} value={form.temperament} onChange={set('temperament')}>{TEMPERAMENTS.map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select>
      <label htmlFor={id('emoji')}>Emoji</label>
      <select id={id('emoji')} value={form.emoji_use} onChange={set('emoji_use')}>{EMOJI.map((v) => <option key={v} value={v}>{v}</option>)}</select>
      <label htmlFor={id('fav')}>Favourite emoji</label>
      <input id={id('fav')} value={form.emoji_favorites} onChange={set('emoji_favorites')} placeholder="separate with commas" />
      <label htmlFor={id('punct')}>Punctuation</label>
      <input id={id('punct')} value={form.punctuation} onChange={set('punctuation')} />
      <label htmlFor={id('topics')}>Topics</label>
      <input id={id('topics')} value={form.topics} onChange={set('topics')} placeholder="separate with commas" />
      <label htmlFor={id('never')}>Never says</label>
      <input id={id('never')} value={form.never_says} onChange={set('never_says')} placeholder="separate with commas" />
      <label htmlFor={id('sig')}>Signature phrases</label>
      <input id={id('sig')} value={form.signature_phrases} onChange={set('signature_phrases')} placeholder="separate with commas" />
      <span className="pulse-voices-actions">
        <button type="submit" className="pulse-voices-btn" disabled={busy || !changed}>Save habits</button>
      </span>
      {error && <p className="pulse-voices-error" role="alert">{error}</p>}
    </form>
  );
}

function Examples({ voice, onChange }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const act = async (label, call) => {
    setBusy(true); setError(null);
    try { const res = await call(); onChange(res.data.voice); return true; }
    catch (err) { console.error(`[PulseVoices] ${label} failed:`, err.response?.status || err.message); setError(errorOf(err, `${label} failed.`)); return false; }
    finally { setBusy(false); }
  };
  const add = async (e) => {
    e.preventDefault();
    if (await act('Adding the example', () => api.post(`/api/v1/pulse-voices/${voice.id}/examples`, { text: text.trim(), kind: 'edit' }))) setText('');
  };
  const examples = voice.examples || [];
  return (
    <div className="pulse-voices-examples">
      <h4>Examples ({examples.length})</h4>
      {examples.length === 0 && <p className="pulse-voices-muted">No examples yet. Pin posts from Review, or write one in their voice below.</p>}
      <ul data-testid="pulse-voices-examples">
        {examples.map((ex) => (
          <li key={ex.id}>
            <span className="pulse-voices-kind">{ex.kind === 'pinned' ? 'Pinned' : 'Yours'}</span>
            <span className="pulse-voices-text">{ex.text}</span>
            <button type="button" className="pulse-voices-link" disabled={busy}
              onClick={() => act('Removing the example', () => api.delete(`/api/v1/pulse-voices/${voice.id}/examples/${ex.id}`))}>Remove</button>
          </li>
        ))}
      </ul>
      <form className="pulse-voices-add" onSubmit={add}>
        <label htmlFor={`pv-${voice.id}-add`}>Write one in their voice</label>
        <textarea id={`pv-${voice.id}-add`} rows={2} maxLength={600} value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="pulse-voices-btn" disabled={busy || !text.trim()}>Add example</button>
      </form>
      {error && <p className="pulse-voices-error" role="alert">{error}</p>}
    </div>
  );
}

export function VoiceCard({ row, onVoice, unmet = false, onReload = null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const state = voiceState(row);
  const approval = approvalState(row.voice);
  const setApproved = async (yes) => {
    setBusy(true); setError(null);
    try {
      const res = await api.post(`/api/v1/pulse-voices/${row.voice.id}/${yes ? 'approve' : 'unapprove'}`);
      onVoice(row.registry_character_id, res.data.voice);
    } catch (err) {
      console.error('[PulseVoices] changing the approval failed:', err.response?.status || err.message);
      setError(errorOf(err, yes ? 'Approving the voice failed.' : 'Withdrawing the approval failed.'));
    } finally { setBusy(false); }
  };
  // A public figure Lala knows of before they meet (Evoni, 2026-10-16).
  const setKnownOf = async (on) => {
    setBusy(true); setError(null);
    try {
      await api.put(`/api/v1/pulse-voices/${row.registry_character_id}/known-of`, { known_of: on });
      if (onReload) await onReload();
    } catch (err) {
      console.error('[PulseVoices] changing known-of failed:', err.response?.status || err.message);
      setError(errorOf(err, 'Saving that failed.'));
    } finally { setBusy(false); }
  };
  const meets = row.meets_in != null ? `Meets Lala in Episode ${row.meets_in}` : 'Meets Lala later in the story';
  const knownOf = row.met === false && row.known_of;
  const build = async () => {
    if (row.voice?.status === 'edited' && !window.confirm('Rebuilding replaces your edits to the habits. The examples stay. Rebuild?')) return;
    if (row.voice?.approved_at && !window.confirm('A rebuilt voice needs your approval again before automated posting. Rebuild?')) return;
    setBusy(true); setError(null);
    try {
      const res = await api.post(`/api/v1/pulse-voices/${row.registry_character_id}/build`);
      onVoice(row.registry_character_id, res.data.voice, false);
      setOpen(true);
    } catch (err) {
      console.error('[PulseVoices] building the voice failed:', err.response?.status || err.message);
      setError(errorOf(err, 'Building the voice failed.'));
    } finally { setBusy(false); }
  };
  return (
    <li className="pulse-voices-card" data-testid="pulse-voices-card">
      <div className="pulse-voices-head">
        {row.portrait_url ? <img className="pulse-voices-photo" src={row.portrait_url} alt="" /> : <span className="pulse-voices-photo pulse-voices-initial" aria-hidden="true">{(row.display_name || '?')[0]}</span>}
        <span className="pulse-voices-who">
          <b>{row.display_name}</b> <span className="pulse-voices-muted">{atHandle(row.handle)}</span>
          <span className="pulse-voices-muted" data-testid="pulse-voices-stage">{stageText(row.depth_level)}</span>
          {unmet && <span className="pulse-voices-muted" data-testid="pulse-voices-meets">{meets}</span>}
          {knownOf && (
            <span className="pulse-voices-muted" data-testid="pulse-voices-known-of">
              Known of: a public figure. {meets}; their public posts show before then. DMs, replies to Lala and relationship moves wait until they meet.
            </span>
          )}
          <span className={`pulse-voices-state pulse-voices-state-${state.tone}`} data-testid="pulse-voices-state">{state.label}</span>
          {approval && (
            <span className={`pulse-voices-state pulse-voices-state-${approval.approved ? 'ok' : 'stale'}`} data-testid="pulse-voices-approval">{approval.label}</span>
          )}
        </span>
      </div>
      <span className="pulse-voices-actions">
        <button type="button" className="pulse-voices-btn" disabled={busy} onClick={build}>{busy ? 'Building…' : row.voice ? 'Rebuild' : 'Build voice'}</button>
        {row.voice && !approval.approved && (
          <button type="button" className="pulse-voices-btn" disabled={busy || row.needs_rebuild}
            title={row.needs_rebuild ? 'Rebuild first: the profile changed' : undefined} onClick={() => setApproved(true)}>Approve voice</button>
        )}
        {row.voice && approval.approved && (
          <button type="button" className="pulse-voices-link" disabled={busy} onClick={() => setApproved(false)}>Withdraw approval</button>
        )}
        {unmet && onReload && (
          <button type="button" className="pulse-voices-link" disabled={busy} onClick={() => setKnownOf(true)}>Lala knows of them (public figure)</button>
        )}
        {knownOf && onReload && (
          <button type="button" className="pulse-voices-link" disabled={busy} onClick={() => setKnownOf(false)}>Not a public figure</button>
        )}
        {row.voice && (
          <button type="button" className="pulse-voices-link" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? 'Hide voice' : 'Show voice'}</button>
        )}
      </span>
      {error && <p className="pulse-voices-error" role="alert">{error}</p>}
      {open && row.voice && (
        <div className="pulse-voices-body">
          <HabitsForm key={`${row.voice.id}-${row.voice.built_at}-${row.voice.edited_at}`} voice={row.voice} onSaved={(v) => onVoice(row.registry_character_id, v)} />
          <Examples voice={row.voice} onChange={(v) => onVoice(row.registry_character_id, v)} />
        </div>
      )}
    </li>
  );
}

/** "Pin as voice example" on a Review post card: adds the post's text to its poster's examples. */
export function PinAsExample({ postId }) {
  const [state, setState] = useState(null);
  const pin = async () => {
    setState({ busy: true });
    try {
      const res = await api.post('/api/v1/pulse-voices/pin', { post_id: postId });
      setState({ done: `Pinned to ${atHandle(res.data.handle)}'s voice.` });
    } catch (err) {
      console.error('[PulseVoices] pinning the post failed:', err.response?.status || err.message);
      setState({ error: errorOf(err, 'Pinning failed.') });
    }
  };
  if (state?.done) return <span className="prv-muted" role="status">{state.done}</span>;
  return (
    <>
      <button type="button" className="prv-link-btn" disabled={state?.busy} onClick={pin}>Pin as voice example</button>
      {state?.error && <span className="prv-error" role="alert">{state.error}</span>}
    </>
  );
}

const STAGE_NAMES = { sparked: 'Sparked', breathing: 'Breathing', active: 'Active', alive: 'Alive' };

/** A character on the feed below Active: their stage, Make Active, and their page. */
export function NotPostingRow({ row, onReload }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const makeActive = async () => {
    setBusy(true); setError(null);
    try {
      await api.put(`/api/v1/character-registry/characters/${row.registry_character_id}`, { depth_level: 'active' });
      if (onReload) await onReload();
    } catch (err) {
      console.error('[PulseVoices] making a character Active failed:', err.response?.status || err.message);
      setError(errorOf(err, 'Could not change their stage.'));
      setBusy(false);
    }
  };
  return (
    <li className="pulse-voices-card" data-testid="pulse-voices-below-row">
      <div className="pulse-voices-head">
        <span className="pulse-voices-who">
          <b>{row.display_name}</b> {row.handle && <span className="pulse-voices-muted">{atHandle(row.handle)}</span>}
          <span className="pulse-voices-muted">Stage: {STAGE_NAMES[row.depth_level] || 'not set'}</span>
        </span>
      </div>
      <span className="pulse-voices-actions">
        <button type="button" className="pulse-voices-btn" disabled={busy} onClick={makeActive}>{busy ? 'Moving…' : 'Make Active'}</button>
        <Link to={`/character/${row.registry_character_id}`}>Open their page</Link>
      </span>
      {error && <span className="pulse-voices-error" role="alert">{error}</span>}
    </li>
  );
}

export default function PulseVoices({ showId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    try {
      const res = await api.get(`/api/v1/pulse-voices?show_id=${encodeURIComponent(showId)}`);
      setData(res.data); setError(null);
    } catch (err) {
      console.error('[PulseVoices] the voices could not be read:', err.response?.status || err.message);
      setError('The voices could not be loaded.');
    }
  }, [showId]);
  useEffect(() => { load(); }, [load]);

  const onVoice = (characterId, voice, needsRebuild) => setData((d) => {
    const update = (list) => (list || []).map((r) => (r.registry_character_id === characterId
      ? { ...r, voice, ...(needsRebuild !== undefined ? { needs_rebuild: needsRebuild } : {}) } : r));
    return { ...d, characters: update(d.characters), not_met: update(d.not_met) };
  });

  if (error) return <p className="pulse-voices-error" role="alert">{error}</p>;
  if (!data) return <p className="pulse-voices-muted">Loading the voices…</p>;
  const rows = data.characters || [];
  const notMet = data.not_met || [];
  const below = data.not_posting || [];
  return (
    <div className="pulse-voices" data-testid="pulse-voices">
      <p className="pulse-voices-muted">Characters at the Active or Alive stage with a Feed profile, whom Lala has met or knows of (a public figure). Active characters post; Alive characters also talk in DMs, move relationships and react to events. A voice is built from their public face only; private feelings never go in.</p>
      {rows.length === 0
        ? <p className="pulse-voices-muted" data-testid="pulse-voices-empty">{notMet.length
          ? 'No posting characters yet: Lala has not met anyone below at the story clock\'s present.'
          : below.length
            ? 'No posting characters yet: the people on the feed below are not at the Active stage. Make one Active to build their voice.'
            : 'No posting characters yet. A character posts once they reach the Active stage with a Feed profile.'}</p>
        : <ul className="pulse-voices-list">{rows.map((r) => <VoiceCard key={r.registry_character_id} row={r} onVoice={onVoice} onReload={load} />)}</ul>}
      {notMet.length > 0 && (
        <section className="pulse-voices-unmet" data-testid="pulse-voices-unmet" aria-labelledby="pulse-voices-unmet-h">
          {/* Heading renamed (Evoni, 2026-10-19). Since 2026-10-18 they post whether or not Lala has met them (pulseVoices); only reactions to Lala's events and storylines with her wait for the meeting. */}
          <h3 id="pulse-voices-unmet-h" className="pulse-voices-unmet-h">Not in Lala&rsquo;s world yet ({notMet.length})</h3>
          <p className="pulse-voices-muted">Build and approve their voice now. They post on The Pulse already; reacting to Lala&rsquo;s events and storylines with her wait until they meet.</p>
          <ul className="pulse-voices-list">{notMet.map((r) => <VoiceCard key={r.registry_character_id} row={r} onVoice={onVoice} onReload={load} unmet />)}</ul>
        </section>
      )}
      {below.length > 0 && (
        <section className="pulse-voices-unmet" data-testid="pulse-voices-below" aria-labelledby="pulse-voices-below-h">
          <h3 id="pulse-voices-below-h" className="pulse-voices-unmet-h">On the feed, not posting yet ({below.length})</h3>
          <p className="pulse-voices-muted">Their stage is below Active, so they have no voice and do not post. Make Active to give them one: they then appear above, where you build and approve their voice.</p>
          <ul className="pulse-voices-list">{below.map((r) => <NotPostingRow key={r.registry_character_id} row={r} onReload={load} />)}</ul>
        </section>
      )}
      <details className="pulse-voices-banned" data-testid="pulse-voices-banned">
        <summary>Phrases the gate rejects ({(data.banned_phrases || []).length})</summary>
        <p>{(data.banned_phrases || []).join(' · ')}</p>
      </details>
    </div>
  );
}
