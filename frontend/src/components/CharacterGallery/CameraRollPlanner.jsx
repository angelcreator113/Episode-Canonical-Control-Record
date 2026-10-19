/**
 * The camera-roll planner (Evoni, 2026-10-19: "photographs should have a
 * purpose. Give each character a believable camera roll"). ADMIN only.
 *
 * "Plan their camera roll" asks for moments from their life (one AI call,
 * POST /api/v1/camera-roll/characters/:id/plan); each proposed moment says
 * what is happening, why the photo exists, who took it, where and when, and
 * whether their face is in it. Evoni keeps, edits or drops each one; only
 * kept moments become photos ("Make kept photos", one image call each,
 * against the daily image budget). Nothing is spent until she says so.
 */
import { useState } from 'react';
import { Sparkles, Check, Pencil, X, Camera, RotateCcw } from 'lucide-react';
import api from '../../services/api';

export const PURPOSE_WORDS = {
  posted: 'Posted on The Pulse',
  private: 'Kept just for them',
  sent: 'Sent to a friend',
  work: 'Work proof',
  memory: 'A memory',
  screenshot: 'A screenshot',
};
export const TAKEN_BY_WORDS = {
  selfie: 'Selfie',
  mirror: 'Mirror selfie',
  friend: 'Taken by a friend',
  timer: 'On a timer',
  photographer: 'A photographer',
};
export const ALBUMS = [
  { key: 'everyday', label: 'Everyday Life' },
  { key: 'work', label: 'Work & Projects' },
  { key: 'travel', label: 'Travel & Places' },
  { key: 'events', label: 'Events' },
  { key: 'social', label: 'Social' },
  { key: 'fashion', label: 'Fashion & Wardrobe' },
  { key: 'objects', label: 'Objects & Details' },
];
const OUTFIT_WORDS = { at_home: 'At home', going_out: 'Going out', work: 'Work', event: 'Event', none: 'Not in it' };
const STATUS_WORDS = { proposed: 'Proposed', kept: 'Kept', failed: 'Not made', made: 'Made' };

const errorText = (err, fallback) => err?.response?.data?.error || fallback;

/** "2026-03-14" → "14 Mar 2026"; anything else as given. */
export function storyDate(value) {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!m) return String(value);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(m[3])} ${months[Number(m[2]) - 1] || m[2]} ${m[1]}`;
}

function MomentEdit({ moment, onSaved, onCancel }) {
  const [form, setForm] = useState({
    moment: moment.moment || '',
    purpose: moment.purpose || 'private',
    taken_by: moment.taken_by || 'selfie',
    album: moment.album || 'everyday',
    place_text: moment.place_text || '',
    story_date: moment.story_date ? String(moment.story_date).slice(0, 10) : '',
    shows_face: !!moment.shows_face,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    if (!form.moment.trim()) { setError('Say what is happening in the photo.'); return; }
    setBusy(true); setError(null);
    try {
      await api.patch(`/api/v1/camera-roll/moments/${moment.id}`, { ...form, moment: form.moment.trim(), story_date: form.story_date || null });
      onSaved();
    } catch (err) {
      console.error('[CameraRollPlanner] the moment could not be saved:', err);
      setError(errorText(err, 'That did not save. Try again.'));
      setBusy(false);
    }
  };
  return (
    <form className="cr-edit" onSubmit={save} aria-label="Edit this moment">
      <label className="cr-label">What is happening
        <textarea className="cr-input" rows={2} value={form.moment} onChange={set('moment')} />
      </label>
      <div className="cr-edit-row">
        <label className="cr-label">Why it exists
          <select className="cr-input" value={form.purpose} onChange={set('purpose')}>
            {Object.entries(PURPOSE_WORDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="cr-label">Who took it
          <select className="cr-input" value={form.taken_by} onChange={set('taken_by')}>
            {Object.entries(TAKEN_BY_WORDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="cr-label">Album
          <select className="cr-input" value={form.album} onChange={set('album')}>
            {ALBUMS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </label>
      </div>
      <div className="cr-edit-row">
        <label className="cr-label">Where
          <input className="cr-input" value={form.place_text} onChange={set('place_text')} />
        </label>
        <label className="cr-label">When (story date)
          <input className="cr-input" type="date" value={form.story_date} onChange={set('story_date')} />
        </label>
        <label className="cr-check">
          <input type="checkbox" checked={form.shows_face} onChange={set('shows_face')} /> Their face is in it
        </label>
      </div>
      {error && <p className="gal-error" role="alert">{error}</p>}
      <div className="cr-actions">
        <button type="submit" className="cr-btn" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" className="cr-btn is-quiet" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}

function MomentCard({ moment, busy, onAction, onEdited }) {
  const [editing, setEditing] = useState(false);
  const when = storyDate(moment.story_date);
  return (
    <li className={`cr-card is-${moment.status}`} data-testid={`moment-${moment.id}`}>
      <div className="cr-card-top">
        <span className={`cr-status is-${moment.status}`}>{STATUS_WORDS[moment.status] || moment.status}</span>
        <span className="cr-chip">{moment.shows_face ? 'Their face' : 'No face'}</span>
      </div>
      {editing ? (
        <MomentEdit moment={moment} onSaved={() => { setEditing(false); onEdited(); }} onCancel={() => setEditing(false)} />
      ) : (
        <>
          <p className="cr-moment">{moment.moment}</p>
          <dl className="cr-facts">
            <div><dt>Why</dt><dd>{PURPOSE_WORDS[moment.purpose] || moment.purpose}</dd></div>
            <div><dt>Taken by</dt><dd>{TAKEN_BY_WORDS[moment.taken_by] || moment.taken_by}</dd></div>
            {moment.place_text && <div><dt>Where</dt><dd>{moment.place_text}</dd></div>}
            {when && <div><dt>When</dt><dd>{when}</dd></div>}
            {moment.outfit && moment.outfit !== 'none' && <div><dt>Wearing</dt><dd>{OUTFIT_WORDS[moment.outfit] || moment.outfit}</dd></div>}
          </dl>
          {moment.status === 'failed' && moment.error && <p className="gal-error" role="alert">{moment.error}</p>}
          <div className="cr-actions">
            {moment.status === 'proposed' && (
              <button type="button" className="cr-btn" disabled={busy} onClick={() => onAction(moment, 'keep')}><Check size={14} aria-hidden /> Keep</button>
            )}
            {(moment.status === 'kept' || moment.status === 'failed') && (
              <button type="button" className="cr-btn" disabled={busy} onClick={() => onAction(moment, 'make')}>
                {moment.status === 'failed' ? <><RotateCcw size={14} aria-hidden /> Try again</> : <><Camera size={14} aria-hidden /> Make this photo</>}
              </button>
            )}
            <button type="button" className="cr-btn is-quiet" disabled={busy} onClick={() => setEditing(true)}><Pencil size={14} aria-hidden /> Edit</button>
            <button type="button" className="cr-btn is-quiet" disabled={busy} onClick={() => onAction(moment, 'drop')}><X size={14} aria-hidden /> Drop</button>
          </div>
        </>
      )}
    </li>
  );
}

export default function CameraRollPlanner({ characterId, name, target, moments = [], photoCount = 0, onChanged }) {
  const [idea, setIdea] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const open = moments.filter((m) => ['proposed', 'kept', 'failed'].includes(m.status));
  // Their camera-roll photos; a moment made into a photo is one of them.
  const made = Math.max(photoCount, moments.filter((m) => m.status === 'made').length);
  const kept = moments.filter((m) => m.status === 'kept').length;
  const planned = moments.filter((m) => m.status !== 'dropped').length;
  const count = Math.max(1, (target || 6) - planned);

  const run = async (fn, fallback) => {
    setBusy(true); setError(null); setNote(null);
    try {
      const out = await fn();
      if (out) setNote(out);
      await onChanged?.();
    } catch (err) {
      console.error('[CameraRollPlanner] the camera roll call failed:', err);
      setError(errorText(err, fallback));
    } finally { setBusy(false); }
  };

  const plan = () => run(async () => {
    const body = { count };
    if (idea.trim()) body.idea = idea.trim();
    const { data } = await api.post(`/api/v1/camera-roll/characters/${characterId}/plan`, body);
    const n = (data?.data?.moments || []).length;
    setIdea('');
    return `${n} moment${n === 1 ? '' : 's'} proposed. Keep the ones that belong in their life.`;
  }, 'The moments could not be planned. Try again.');

  const act = (moment, action) => run(async () => {
    await api.post(`/api/v1/camera-roll/moments/${moment.id}/${action}`);
    return action === 'make' ? 'The photo was made.' : null;
  }, action === 'make' ? 'The photo could not be made. Try again.' : 'That did not work. Try again.');

  const makeKept = () => run(async () => {
    const { data } = await api.post(`/api/v1/camera-roll/characters/${characterId}/make-kept`);
    const r = data?.data || {};
    const parts = [`${r.made || 0} photo${r.made === 1 ? '' : 's'} made`];
    if (r.failed) parts.push(`${r.failed} not made`);
    if (r.stopped_for_budget) parts.push('stopped at the daily image budget');
    return `${parts.join(', ')}.`;
  }, 'The photos could not be made. Try again.');

  return (
    <section className="gal-panel cr" aria-labelledby="cr-h" data-testid="camera-roll-planner">
      <header className="gal-panel-head">
        <div>
          <h4 id="cr-h" className="gal-panel-title"><Sparkles size={18} aria-hidden /> Their camera roll</h4>
          <p className="gal-muted">
            {made} of {target} photos made. Every photo is a moment from {name}&rsquo;s life, with a reason it exists and who took it.
          </p>
        </div>
      </header>
      <div className="cr-plan">
        <label className="cr-label">An idea for these moments (optional)
          <input className="cr-input" value={idea} placeholder="e.g. her first week at the bakery" onChange={(e) => setIdea(e.target.value)} />
        </label>
        <button type="button" className="cr-btn" disabled={busy} onClick={plan}>
          <Sparkles size={14} aria-hidden /> {busy ? 'Working…' : `Plan their camera roll (${count})`}
        </button>
      </div>
      {error && <p className="gal-error" role="alert">{error}</p>}
      {note && <p className="gal-muted" role="status">{note}</p>}
      {open.length > 0 && (
        <ul className="cr-list" aria-label="Planned moments">
          {open.map((m) => <MomentCard key={m.id} moment={m} busy={busy} onAction={act} onEdited={onChanged} />)}
        </ul>
      )}
      {kept > 0 && (
        <div className="cr-make">
          <button type="button" className="cr-btn" disabled={busy} onClick={makeKept}><Camera size={14} aria-hidden /> Make kept photos ({kept})</button>
          <p className="gal-muted">Each photo is one image call, counted against the daily image budget. Making stops when the budget is reached; nothing else is spent.</p>
        </div>
      )}
    </section>
  );
}
