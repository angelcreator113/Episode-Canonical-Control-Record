/**
 * When an item on The Pulse is revealed, set where Evoni already works on it
 * (Task 2940; The Pulse spec §5; Evoni, 2026-10-11: teasers are blurred).
 * Closed, it says when the item reveals ("Reveals: During Ep 3") or that it
 * always shows. Open, it picks what the reveal hangs on (an episode, the
 * item's event, or a set story time), the moment (Announced, Invitation
 * sent, Lala arrives, During, After the episode) and what shows before it
 * ("First look", blurred, or hidden). Saves through PulseRevealProvider;
 * outside one it renders nothing. Styles: styles/AdminPanel.css (pulse-reveal-*).
 */
import React, { useId, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useReveals } from './PulseRevealContext';

export const MOMENTS = [
  { key: 'announced', label: 'Announced' },
  { key: 'invitation_sent', label: 'Invitation sent' },
  { key: 'lala_arrives', label: 'Lala arrives' },
  { key: 'during', label: 'During' },
  { key: 'after', label: 'After the episode' },
];
// A set story time: a phase of an episode (services/storyClock.js PHASES).
export const STORY_PHASES = [
  { key: 'before_episode', label: 'Before' },
  ...MOMENTS.slice(0, 3).map((m) => ({ key: m.key, label: m.label })),
  { key: 'during_episode', label: 'During' },
  { key: 'after_episode', label: 'After' },
  { key: 'next_day', label: 'The day after' },
  { key: 'week_later', label: 'A week after' },
];

const errorText = (err) => err.response?.data?.error || err.message || 'The reveal could not be saved.';

/**
 * type: post | image | event; id: the item's id; kind: an image's kind;
 * eventId: the item's own event (an event's id, or a post's event), offered
 * as what the reveal hangs on; label: what the item is, for screen readers.
 */
export default function RevealPicker({ type, id, kind = null, eventId = null, label = 'this item' }) {
  const ctx = useReveals();
  const formId = useId();
  const current = ctx?.revealOf(type, id, kind) || null;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [anchor, setAnchor] = useState('episode');
  const [episodeId, setEpisodeId] = useState('');
  const [moment, setMoment] = useState('during');
  const [storyEpisode, setStoryEpisode] = useState('');
  const [storyPhase, setStoryPhase] = useState('after_episode');
  const [mode, setMode] = useState('teaser');
  if (!ctx) return null;

  // The form starts from the saved reveal (it may load after the picker mounts).
  const toggle = () => {
    if (!open) {
      setAnchor(current?.moment === 'story_time' ? 'story_time' : (current?.event_id || (!current && eventId) ? 'event' : 'episode'));
      setEpisodeId(current?.episode_id || '');
      setMoment(current && current.moment !== 'story_time' ? current.moment : 'during');
      setMode(current?.mode || 'teaser');
      setNote(null);
    }
    setOpen((v) => !v);
  };

  const episodes = ctx.episodes;
  const canSave = anchor === 'event' ? Boolean(eventId || current?.event_id)
    : anchor === 'episode' ? Boolean(episodeId) : Boolean(storyEpisode);

  const run = async (fn) => {
    setBusy(true);
    setNote(null);
    try { await fn(); setOpen(false); } catch (err) {
      console.error(`[RevealPicker] ${type} ${id} failed:`, err.response?.status || err.message);
      setNote(errorText(err));
    } finally { setBusy(false); }
  };
  const save = () => run(() => {
    const body = { item_type: type, item_id: String(id), mode };
    if (kind) body.image_kind = kind;
    if (anchor === 'story_time') {
      const ep = episodes.find((e) => e.id === storyEpisode);
      Object.assign(body, { moment: 'story_time', at: `ep:${ep.episode_number}:${storyPhase}` });
    } else if (anchor === 'event') {
      Object.assign(body, { moment, event_id: eventId || current.event_id });
    } else {
      Object.assign(body, { moment, episode_id: episodeId });
    }
    return ctx.save(body);
  });
  const clear = () => run(() => ctx.clear(current.id));

  return (
    <div className="pulse-reveal" data-testid={`reveal-${type}-${id}`}>
      <p className="pulse-reveal-status">
        {current
          ? <><EyeOff size={14} aria-hidden="true" /> Reveals: {current.label || 'not placed yet'} · {current.mode === 'hidden' ? 'hidden before' : 'first look before'}</>
          : <><Eye size={14} aria-hidden="true" /> Always shown</>}
        {' '}
        <button type="button" className="pulse-link-btn" aria-expanded={open} aria-controls={formId}
          aria-label={`${current ? 'Change' : 'Set'} the reveal for ${label}`} onClick={toggle}>
          {current ? 'Change' : 'Set reveal'}
        </button>
      </p>
      {open && (
        <div className="pulse-reveal-form" id={formId}>
          <fieldset>
            <legend>Hangs on</legend>
            {(eventId || current?.event_id) && (
              <label><input type="radio" name={`${formId}-anchor`} checked={anchor === 'event'} onChange={() => setAnchor('event')} /> Its event</label>
            )}
            <label><input type="radio" name={`${formId}-anchor`} checked={anchor === 'episode'} onChange={() => setAnchor('episode')} /> An episode</label>
            <label><input type="radio" name={`${formId}-anchor`} checked={anchor === 'story_time'} onChange={() => setAnchor('story_time')} /> A set story time</label>
          </fieldset>
          {anchor === 'episode' && (
            <label className="pulse-field">
              Episode
              <select value={episodeId} onChange={(e) => setEpisodeId(e.target.value)}>
                <option value="">Choose an episode</option>
                {episodes.map((ep) => <option key={ep.id} value={ep.id}>Ep {ep.episode_number}{ep.title ? ` · ${ep.title}` : ''}</option>)}
              </select>
            </label>
          )}
          {anchor !== 'story_time' ? (
            <label className="pulse-field">
              Moment
              <select value={moment} onChange={(e) => setMoment(e.target.value)}>
                {MOMENTS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </label>
          ) : (
            <div className="pulse-reveal-row">
              <label className="pulse-field">
                Episode
                <select value={storyEpisode} onChange={(e) => setStoryEpisode(e.target.value)}>
                  <option value="">Choose an episode</option>
                  {episodes.map((ep) => <option key={ep.id} value={ep.id}>Ep {ep.episode_number}{ep.title ? ` · ${ep.title}` : ''}</option>)}
                </select>
              </label>
              <label className="pulse-field">
                When
                <select value={storyPhase} onChange={(e) => setStoryPhase(e.target.value)}>
                  {STORY_PHASES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </label>
            </div>
          )}
          <fieldset>
            <legend>Before then</legend>
            <label><input type="radio" name={`${formId}-mode`} checked={mode === 'teaser'} onChange={() => setMode('teaser')} /> First look (blurred)</label>
            <label><input type="radio" name={`${formId}-mode`} checked={mode === 'hidden'} onChange={() => setMode('hidden')} /> Hidden</label>
          </fieldset>
          <div className="pulse-actions">
            <button type="button" className="pulse-btn primary" disabled={busy || !canSave} onClick={save}>
              {busy && <Loader2 size={14} className="pulse-spin" aria-hidden="true" />} Save reveal
            </button>
            {current && <button type="button" className="pulse-btn" disabled={busy} onClick={clear}>Always show</button>}
            <button type="button" className="pulse-btn" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
      {note && <p className="pulse-error" role="alert">{note}</p>}
    </div>
  );
}
