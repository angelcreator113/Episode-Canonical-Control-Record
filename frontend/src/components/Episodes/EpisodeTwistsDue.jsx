/**
 * Script tab › "This episode must cover" › Season twists due here (Evoni,
 * 2026-10-23): what the Season Plan's twists plant or pay off in this
 * episode (GET /episodes/:id/season-twists, services/seasonTwists
 * twistsForEpisode), each with its description. "Maybe in beat N" is only
 * a hint: the beat whose lines hold the twist's key words (lib/episodeScript
 * mentionedIn, the matcher the rest of the list uses); a plant is meant to
 * be subtle, so the words may never appear. Nothing is marked on its own:
 * "Mark planted" / "Mark paid off" is her call, and sets the twist's status
 * and the episode that did it; Undo takes it back, and paying off a twist
 * not planted yet asks first (Script tab audit 6, 2026-10-24).
 *
 * Props: episodeId, beats (the parsed script, for the hint).
 */
import { useEffect, useState } from 'react';
import { Route, Check } from 'lucide-react';
import api from '../../services/api';
import { mentionedIn } from '../../lib/episodeScript';
import './EpisodeTwistsDue.css';

const DONE = { plant: ['planted', 'paid_off'], payoff: ['paid_off'] };

/** The beat that may hold the twist: its title's key words, else its description's. */
export function twistHint(beats, twist) {
  return mentionedIn(beats, twist.title) ?? (twist.description ? mentionedIn(beats, twist.description) : null);
}

export default function EpisodeTwistsDue({ episodeId, beats = [] }) {
  const [due, setDue] = useState(null);
  // A read that failed says so, with Retry (Script tab audit 6, 2026-10-24:
  // it showed nothing, as if none were due).
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [marking, setMarking] = useState(null);
  const [failed, setFailed] = useState(null);

  useEffect(() => {
    if (!episodeId) return undefined;
    let live = true;
    setLoadFailed(false);
    Promise.resolve().then(() => api.get(`/api/v1/episodes/${episodeId}/season-twists`))
      .then((res) => { if (live) setDue({ plant: res.data?.plant || [], payoff: res.data?.payoff || [] }); })
      .catch((err) => {
        console.error('[EpisodeTwistsDue] the season twists were not loaded:', err);
        if (live) { setDue(null); setLoadFailed(true); }
      });
    return () => { live = false; };
  }, [episodeId, attempt]);

  if (loadFailed) {
    return (
      <div className="etd" data-testid="script-twists">
        <p className="etd-fail" role="alert" data-testid="script-twists-unread">
          Couldn&apos;t read twists.{' '}
          <button type="button" className="esp-btn is-small" data-testid="script-twists-retry" onClick={() => setAttempt((n) => n + 1)}>Retry</button>
        </p>
      </div>
    );
  }
  if (!due || (!due.plant.length && !due.payoff.length)) return null;

  // Mark it, or take the mark back (undo). Paying off a twist nobody has
  // planted asks first: the audience has nothing to connect it to.
  const mark = async (t, role, undo = false) => {
    const as = role === 'plant' ? 'planted' : 'paid_off';
    if (!undo && role === 'payoff' && t.status === 'planned'
      && !window.confirm(`"${t.title}" has not been planted yet. Mark it paid off anyway?`)) return;
    setMarking(t.id); setFailed(null);
    try {
      const res = await api.post(`/api/v1/episodes/${episodeId}/season-twists/${t.id}/mark`, undo ? { as, undo: true } : { as });
      setDue({ plant: res.data?.plant || [], payoff: res.data?.payoff || [] });
    } catch (err) {
      console.error('[EpisodeTwistsDue] mark failed:', err);
      setFailed({ id: t.id, text: err?.response?.data?.error || (undo ? 'Couldn’t undo it. Try again.' : 'Couldn’t mark it. Try again.') });
    } finally { setMarking(null); }
  };

  const row = (t, role) => {
    const done = DONE[role].includes(t.status);
    const hint = twistHint(beats, t);
    return (
      <li key={`${role}-${t.id}`} className={`etd-item${done ? ' is-done' : ''}`} data-testid={`script-twist-${role}-${t.id}`}>
        <span className="etd-head">
          <strong>{role === 'plant' ? 'Plant:' : 'Pay off:'}</strong> {t.title}
          {role === 'payoff' && t.planted_in && <span className="etd-meta"> · planted in episode {t.planted_in.episode_number}</span>}
        </span>
        {t.description && <span className="etd-desc">{t.description}</span>}
        {hint !== null && !done && <span className="etd-hint" data-testid={`script-twist-${role}-${t.id}-hint`}>Maybe in beat {hint} (its words are there; check it lands)</span>}
        <span className="etd-actions">
          {done
            ? (
              <>
                <span className="etd-done" data-testid={`script-twist-${role}-${t.id}-done`}><Check size={13} aria-hidden="true" /> {role === 'plant' ? 'Planted' : 'Paid off'}</span>
                {/* Undo the mark this row made (a paid-off plant is undone from its payoff first). */}
                {t.status === (role === 'plant' ? 'planted' : 'paid_off') && (
                  <button type="button" className="esp-btn is-small" data-testid={`script-twist-${role}-${t.id}-undo`} disabled={marking === t.id} onClick={() => mark(t, role, true)}>
                    {marking === t.id ? 'Undoing…' : 'Undo'}
                  </button>
                )}
              </>
            )
            : (
              <button type="button" className="esp-btn is-small" data-testid={`script-twist-${role}-${t.id}-mark`} disabled={marking === t.id} onClick={() => mark(t, role)}>
                {marking === t.id ? 'Marking…' : role === 'plant' ? 'Mark planted' : 'Mark paid off'}
              </button>
            )}
          {failed?.id === t.id && <span className="etd-fail" role="alert">{failed.text}</span>}
        </span>
      </li>
    );
  };

  return (
    <div className="etd" data-testid="script-twists">
      <h4 className="etd-title"><Route size={14} aria-hidden="true" /> Season twists due here</h4>
      <ul className="etd-list">
        {due.plant.map((t) => row(t, 'plant'))}
        {due.payoff.map((t) => row(t, 'payoff'))}
      </ul>
      <p className="etd-note">From the Season Plan. A plant stays subtle and unexplained; a payoff makes it land. The beat is only a hint from the twist&apos;s words. Mark it when the script does it.</p>
    </div>
  );
}
