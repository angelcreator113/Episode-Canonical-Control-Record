/**
 * Viewer teaser (Task #2386; Evoni's P12, 2026-09-30): "Each episode has a
 * viewer teaser, separate from the event description (guest copy, rule
 * 12): mystery-driven, never revealing the outcome, the hook in the first
 * 150 characters. It's auto-drafted at Start Episode from the event's
 * concept and description, labelled Auto-drafted, and editable.
 * Distribution drafts platform copy from the teaser."
 *
 * Labels follow doctrine rule 14: "Auto-drafted · from event" while the
 * teaser equals the Start Episode draft (teaser_drafted), "Edited" once it
 * differs, "Missing" when empty. The editor shows a live counter and where
 * the first 150 characters (the hook) end.
 *
 * Saves through onUpdate({ teaser }) — EpisodeDetail's handleUpdateEpisode,
 * PUT /api/v1/episodes/:id.
 */
import { useEffect, useState } from 'react';
import { Sparkles, Pencil, CircleAlert } from 'lucide-react';
import {
  TEASER_HOOK_CHARS, teaserStateOf, teaserStateLabel, splitTeaserHook, teaserCounter,
} from '../../utils/episodeTeaser';
import './EpisodeTeaserSection.css';

const ICONS = { auto_drafted: Sparkles, edited: Pencil, missing: CircleAlert };

export default function EpisodeTeaserSection({ episode, onUpdate }) {
  const saved = typeof episode?.teaser === 'string' ? episode.teaser : '';
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!editing) setValue(saved);
  }, [saved, editing]);

  const state = teaserStateOf(episode);
  const label = teaserStateLabel(state);
  const Icon = ICONS[state];

  const save = async () => {
    if (typeof onUpdate !== 'function') return;
    setSaving(true);
    setError(null);
    try {
      await onUpdate({ teaser: value });
      setEditing(false);
    } catch (err) {
      console.error('[EpisodeTeaserSection] teaser save failed:', err);
      setError(err?.response?.data?.error || err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const { hook, rest } = splitTeaserHook(editing ? value : saved);

  return (
    <section className={`ets is-${state}`} data-testid="episode-teaser">
      <header className="ets-head">
        <h3 className="ets-title">Viewer teaser</h3>
        {label && (
          <span className="ets-state" data-testid="episode-teaser-state">
            {Icon && <Icon size={11} aria-hidden="true" />} {label}
          </span>
        )}
        {!editing && (
          <button type="button" className="ets-btn" onClick={() => { setValue(saved); setEditing(true); }} data-testid="episode-teaser-edit">
            <Pencil size={12} aria-hidden="true" /> {saved ? 'Edit' : 'Write teaser'}
          </button>
        )}
      </header>
      <p className="ets-note">
        What viewers read. Mystery-driven, never reveals the outcome, hook in the first {TEASER_HOOK_CHARS} characters. Distribution drafts platform copy from it.
      </p>

      {editing ? (
        <div className="ets-edit">
          <label className="ets-sr" htmlFor={`ets-input-${episode?.id || 'new'}`}>Viewer teaser</label>
          <textarea
            id={`ets-input-${episode?.id || 'new'}`}
            className="ets-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={4}
            placeholder="The question this episode raises, without its answer…"
            data-testid="episode-teaser-input"
          />
          <div className="ets-counter" data-testid="episode-teaser-counter">{teaserCounter(value)}</div>
          {value && (
            <p className="ets-preview" data-testid="episode-teaser-preview">
              <span className="ets-hook">{hook}</span>
              {rest && <span className="ets-rest" aria-label="after the hook">{rest}</span>}
            </p>
          )}
          {error && <p className="ets-error" role="alert">{error}</p>}
          <div className="ets-actions">
            <button type="button" className="ets-btn" onClick={() => { setEditing(false); setError(null); }} disabled={saving}>Cancel</button>
            <button type="button" className="ets-btn ets-btn-primary" onClick={save} disabled={saving} data-testid="episode-teaser-save">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : saved ? (
        <p className="ets-text" data-testid="episode-teaser-text">
          <span className="ets-hook">{hook}</span>
          {rest && <span className="ets-rest">{rest}</span>}
        </p>
      ) : (
        <p className="ets-empty" data-testid="episode-teaser-empty">No teaser yet. Start Episode drafts one when the AI draft succeeds; this episode has none.</p>
      )}
    </section>
  );
}
