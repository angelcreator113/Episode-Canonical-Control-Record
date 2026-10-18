/**
 * Admin › The Pulse › Storylines (Task 2989; The Pulse spec §4 "Storylines —
 * long-running threads the system plants and pays off across posts
 * (planner)"). Over /api/v1/pulse-storylines:
 *   NewStoryline   a title, a premise, and (optionally) the show thread it
 *                  follows (never copied)
 *   StorylineCard  its beats on a story-time line (moment, plant / build /
 *                  payoff, who posts, what the post does, and where it is:
 *                  planned, queued, drafted with its post live or in Review);
 *                  add a beat (a story moment, a character with a voice);
 *                  remove a planned one; Suggest beats (one AI call, nothing
 *                  saved: Keep or Bin each; the handles the premise names
 *                  lead); Drop the storyline
 * Beats are drafted by the posting engine when their moment comes; a payoff
 * always waits in Review. Styles: AdminPanel.css (pulse-story-*).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { useReveals } from './PulseRevealContext';
import { storyMoments, storyLabel } from '../../lib/storyClock';
import { atHandle } from '../../pages/feed/feedConstants';

const KIND_WORDS = { plant: 'Plant', build: 'Build', payoff: 'Payoff' };
const STATUS_WORDS = { planned: 'Planned', running: 'Running', paid_off: 'Paid off', dropped: 'Dropped' };
const errorOf = (err, fallback) => err.response?.data?.error || fallback;

/** Where a beat is, in words. */
export function beatState(beat) {
  if (beat.status === 'drafted') {
    if (!beat.post) return 'Drafted';
    return beat.post.status === 'live' ? 'Posted' : 'Drafted, waiting in Review';
  }
  if (beat.status === 'queued') return 'Queued for the engine';
  if (beat.status === 'skipped') return 'Skipped';
  return 'Planned';
}

function BeatForm({ initial = null, moments, people, busy, onSubmit, onCancel, submitLabel = 'Add beat' }) {
  const [form, setForm] = useState({
    kind: initial?.kind || 'plant',
    story_order: initial?.story_order != null ? String(initial.story_order) : '',
    poster_profile_id: initial?.poster_profile_id != null ? String(initial.poster_profile_id) : '',
    brief: initial?.brief || '',
  });
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const ready = form.story_order !== '' && form.poster_profile_id !== '' && form.brief.trim();
  return (
    <form className="pulse-story-beat-form" data-testid="pulse-story-beat-form"
      onSubmit={(e) => { e.preventDefault(); if (ready) onSubmit({ kind: form.kind, story_order: Number(form.story_order), poster_profile_id: Number(form.poster_profile_id), brief: form.brief.trim() }); }}>
      <label>Kind
        <select value={form.kind} onChange={set('kind')}>
          {Object.entries(KIND_WORDS).map(([k, w]) => <option key={k} value={k}>{w}</option>)}
        </select>
      </label>
      <label>Story moment
        <select value={form.story_order} onChange={set('story_order')}>
          <option value="">Choose a moment</option>
          {moments.map((m) => <option key={m.order} value={m.order}>{m.label}</option>)}
        </select>
      </label>
      <label>Who posts
        <select value={form.poster_profile_id} onChange={set('poster_profile_id')}>
          <option value="">Choose a character</option>
          {people.map((c) => <option key={c.registry_character_id} value={c.social_profile_id}>{c.display_name} ({atHandle(c.handle)})</option>)}
        </select>
      </label>
      <label className="pulse-story-wide">What the post does
        <input type="text" maxLength={500} value={form.brief} onChange={set('brief')} placeholder="e.g. notices a familiar silhouette in a shop window" />
      </label>
      <span className="pulse-story-actions">
        <button type="submit" className="pulse-btn" disabled={busy || !ready}>{submitLabel}</button>
        {onCancel && <button type="button" className="pulse-link-btn" disabled={busy} onClick={onCancel}>Cancel</button>}
      </span>
    </form>
  );
}

export function StorylineCard({ line, threads, moments, people, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const [adding, setAdding] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const thread = threads.find((t) => t.id === line.show_story_thread_id) || null;
  const open = line.status === 'planned' || line.status === 'running';
  const act = async (label, call) => {
    setBusy(true); setError(null); setNote(null);
    try { const out = await call(); onChange?.(); return out; } catch (err) {
      console.error(`[PulseStorylines] ${label} failed:`, err.response?.status || err.message);
      setError(errorOf(err, `${label} failed.`));
      return null;
    } finally { setBusy(false); }
  };
  const addBeat = async (body) => {
    const res = await act('Adding the beat', () => api.post(`/api/v1/pulse-storylines/${line.id}/beats`, body));
    if (res) {
      setAdding(false);
      if (res.data?.queued) setNote(res.data.engine_on ? 'Its moment has come: queued for the engine.' : 'Its moment has come: queued; the posting engine drafts it once it is on.');
    }
    return res;
  };
  const suggest = async () => {
    setBusy(true); setError(null);
    try {
      const res = await api.post(`/api/v1/pulse-storylines/${line.id}/suggest`, {});
      setSuggestions(Array.isArray(res.data?.suggestions) ? res.data.suggestions : []);
    } catch (err) {
      console.error('[PulseStorylines] suggesting beats failed:', err.response?.status || err.message);
      setError(errorOf(err, 'Suggesting beats failed.'));
    } finally { setBusy(false); }
  };
  const keep = async (s, i) => {
    const res = await addBeat({ kind: s.kind, story_order: s.story_order, poster_profile_id: s.poster_profile_id, brief: s.brief });
    if (res) setSuggestions((list) => list.filter((_, j) => j !== i));
  };

  return (
    <li className="pulse-story-card" data-testid="pulse-story-card">
      <div className="pulse-story-head">
        <b>{line.title}</b>
        <span className="pulse-story-status">{STATUS_WORDS[line.status] || line.status}</span>
      </div>
      {line.premise && <p className="pulse-story-premise">{line.premise}</p>}
      {thread && <p className="pulse-hint">Follows the thread “{thread.title}”.</p>}
      {line.beats.length === 0 ? <p className="pulse-hint">No beats yet.</p> : (
        <ol className="pulse-story-beats">
          {line.beats.map((b) => (
            <li key={b.id} className="pulse-story-beat" data-testid="pulse-story-beat">
              <span className="pulse-story-when">{b.label || storyLabel(b.story_order)}</span>
              <span className={`pulse-story-kind pulse-story-kind-${b.kind}`}>{KIND_WORDS[b.kind] || b.kind}</span>
              <span className="pulse-story-what">{atHandle(b.handle)}: {b.brief}</span>
              <span className="pulse-story-state">{beatState(b)}</span>
              {b.status === 'planned' && open && (
                <button type="button" className="pulse-link-btn" disabled={busy}
                  onClick={() => act('Removing the beat', () => api.delete(`/api/v1/pulse-storylines/${line.id}/beats/${b.id}`))}>Remove</button>
              )}
            </li>
          ))}
        </ol>
      )}
      {open && (adding ? (
        <BeatForm moments={moments} people={people} busy={busy} onSubmit={addBeat} onCancel={() => setAdding(false)} />
      ) : (
        <span className="pulse-story-actions">
          <button type="button" className="pulse-btn" disabled={busy} onClick={() => setAdding(true)}>Add a beat</button>
          <button type="button" className="pulse-link-btn" disabled={busy} onClick={suggest}>Suggest beats</button>
          <button type="button" className="pulse-link-btn" disabled={busy}
            onClick={() => act('Dropping the storyline', () => api.put(`/api/v1/pulse-storylines/${line.id}`, { status: 'dropped' }))}>Drop</button>
        </span>
      ))}
      {suggestions && (
        <div className="pulse-story-suggestions" data-testid="pulse-story-suggestions">
          {suggestions.length === 0 ? <p className="pulse-hint">No suggestions came back.</p> : (
            <ol>
              {suggestions.map((s, i) => (
                <li key={`${s.kind}-${s.story_order}-${i}`} data-testid="pulse-story-suggestion">
                  <span>{storyLabel(s.story_order)} · {KIND_WORDS[s.kind]} · {atHandle(s.handle)}: {s.brief}</span>
                  <span className="pulse-story-actions">
                    <button type="button" className="pulse-btn" disabled={busy} onClick={() => keep(s, i)}>Keep</button>
                    <button type="button" className="pulse-link-btn" disabled={busy} onClick={() => setSuggestions((list) => list.filter((_, j) => j !== i))}>Bin</button>
                  </span>
                </li>
              ))}
            </ol>
          )}
          <button type="button" className="pulse-link-btn" onClick={() => setSuggestions(null)}>Close suggestions</button>
        </div>
      )}
      {note && <p className="pulse-hint" role="status">{note}</p>}
      {error && <p className="pulse-error" role="alert">{error}</p>}
    </li>
  );
}

function NewStoryline({ showId, threads, onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', premise: '', thread: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const create = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setBusy(true); setError(null);
    try {
      await api.post('/api/v1/pulse-storylines', {
        show_id: showId, title: form.title.trim(),
        ...(form.premise.trim() ? { premise: form.premise.trim() } : {}),
        ...(form.thread ? { show_story_thread_id: form.thread } : {}),
      });
      setForm({ title: '', premise: '', thread: '' });
      setOpen(false);
      onCreated?.();
    } catch (err) {
      console.error('[PulseStorylines] creating the storyline failed:', err.response?.status || err.message);
      setError(errorOf(err, 'Creating the storyline failed.'));
    } finally { setBusy(false); }
  };
  if (!open) return <button type="button" className="pulse-btn" onClick={() => setOpen(true)}>New storyline</button>;
  return (
    <form className="pulse-story-new" onSubmit={create} data-testid="pulse-story-new">
      <label>Title<input type="text" maxLength={200} value={form.title} onChange={set('title')} /></label>
      <label className="pulse-story-wide">Premise<textarea rows={2} maxLength={4000} value={form.premise} onChange={set('premise')} /></label>
      <p className="pulse-hint pulse-story-wide">Name the characters it is about by handle (@name): Suggest beats gives them most beats, and the rest to creators whose audience overlaps theirs.</p>
      <label>Follows a show thread (optional)
        <select value={form.thread} onChange={set('thread')}>
          <option value="">None</option>
          {threads.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
      </label>
      <span className="pulse-story-actions">
        <button type="submit" className="pulse-btn" disabled={busy || !form.title.trim()}>Create storyline</button>
        <button type="button" className="pulse-link-btn" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
      </span>
      {error && <p className="pulse-error" role="alert">{error}</p>}
    </form>
  );
}

export default function PulseStorylines({ showId }) {
  const ctx = useReveals();
  const [data, setData] = useState(null);
  const [people, setPeople] = useState([]);
  const [error, setError] = useState(null);
  const moments = useMemo(() => storyMoments(ctx?.episodes || []), [ctx?.episodes]);
  const lines = data?.storylines || [];

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/api/v1/pulse-storylines?show_id=${encodeURIComponent(showId)}`);
      setData(res.data);
      setError(null);
    } catch (err) {
      console.error('[PulseStorylines] the storylines could not be read:', err.response?.status || err.message);
      setError('The storylines could not be loaded.');
    }
  }, [showId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    let alive = true;
    api.get(`/api/v1/pulse-voices?show_id=${encodeURIComponent(showId)}`)
      .then((res) => { if (alive) setPeople((res.data?.characters || []).filter((c) => c.voice)); })
      .catch((err) => console.error('[PulseStorylines] the characters could not be read:', err.response?.status || err.message));
    return () => { alive = false; };
  }, [showId]);

  return (
    <section className="pulse-story" aria-labelledby="pulse-story-heading" data-testid="pulse-story">
      <h3 id="pulse-story-heading">Storylines</h3>
      <p className="pulse-hint">Threads planted and paid off across posts. Each beat is drafted by the posting engine when its story moment comes; a payoff always waits for you in Review.</p>
      {error && <p className="pulse-error" role="alert">{error}</p>}
      {!data && !error && <p className="pulse-hint">Loading the storylines…</p>}
      {data && (
        <>
          <NewStoryline showId={showId} threads={data.threads || []} onCreated={load} />
          {people.length === 0 && <p className="pulse-hint">No character has a voice yet. Build one in Voices before adding beats.</p>}
          {lines.length === 0 ? <p className="pulse-hint" data-testid="pulse-story-empty">No storylines yet.</p> : (
            <ul className="pulse-story-list">
              {lines.map((line) => (
                <StorylineCard key={line.id} line={line} threads={data.threads || []} moments={moments} people={people} onChange={load} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
