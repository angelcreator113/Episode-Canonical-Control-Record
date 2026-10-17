/**
 * Release calendar (Evoni, 2026-10-17: "Yes I want them all"): the show's
 * scheduled drafts on the days they go out, the next five weeks
 * (GET /feed-posts/release-calendar, services/postRelease). Drag a post to
 * another day, or pick it and choose "Move here" (a phone has no drag): it
 * keeps its hour. A day that breaks the story order says what it breaks,
 * and waits for "Move anyway". Styles: PulseReviewPost.css.
 */
import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { atHandle } from '../../pages/feed/feedConstants';
import { StoryProblems, tzOffset } from './PulseReviewPost';

const DAYS = 35;
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayLabel = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const timeLabel = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** The post's release time moved to `day` (a local date), keeping its hour and minute. */
export function onDay(iso, day) {
  const from = new Date(iso);
  const to = new Date(day);
  to.setHours(from.getHours(), from.getMinutes(), 0, 0);
  return to;
}

export default function PulseReleaseCalendar({ showId, refreshKey = 0, onChange }) {
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState(null);
  const [picked, setPicked] = useState(null);
  const [refused, setRefused] = useState(null); // { postId, at, problems }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/api/v1/feed-posts/release-calendar?show_id=${encodeURIComponent(showId)}`);
      setPosts(Array.isArray(res.data?.posts) ? res.data.posts : []);
      setError(null);
    } catch (err) {
      console.error('[PulseReleaseCalendar] the calendar could not be read:', err.response?.status || err.message);
      setError('The release calendar could not be read.');
    }
  }, [showId]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const move = async (postId, day, anyway = false) => {
    const post = posts.find((p) => p.post_id === postId);
    if (!post) return;
    const at = refused && anyway ? refused.at : onDay(post.release_at, day);
    if (!anyway && at.getTime() <= Date.now()) { setError('That day has passed: pick a later one.'); return; }
    setBusy(true); setError(null);
    try {
      await api.put(`/api/v1/feed-posts/${postId}/release-time`, { mode: 'schedule', at: at.toISOString(), tz_offset: tzOffset(), anyway });
      setPicked(null); setRefused(null);
      await load();
      onChange?.();
    } catch (err) {
      const problems = err.response?.status === 409 ? err.response?.data?.problems : null;
      if (Array.isArray(problems) && problems.length) {
        console.error('[PulseReleaseCalendar] that day breaks the story order:', problems.length);
        setRefused({ postId, at, problems });
      } else {
        console.error('[PulseReleaseCalendar] the post could not be moved:', err.response?.status || err.message);
        setError(err.response?.data?.error || 'The post could not be moved.');
      }
    } finally { setBusy(false); }
  };

  if (error && !posts) return <p className="prv-error" role="alert">{error}</p>;
  if (!posts) return <p className="prv-muted">Loading the release calendar…</p>;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: DAYS }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i));
  const byDay = new Map();
  for (const p of posts) {
    const k = dayKey(new Date(p.release_at));
    byDay.set(k, [...(byDay.get(k) || []), p]);
  }
  // Days with posts; every day while one is picked or dragged, to move it to.
  const busyDays = days.filter((d) => byDay.has(dayKey(d)) || picked);

  return (
    <div className="prv-calendar" data-testid="prv-release-calendar">
      {posts.length === 0 && <p className="prv-muted">Nothing scheduled in the next five weeks.</p>}
      {picked && <p className="prv-muted">Choose a day for it: “Move here”. <button type="button" className="prv-link-btn" onClick={() => setPicked(null)}>Cancel</button></p>}
      {refused && (
        <div className="prv-calendar-refused" data-testid="prv-calendar-refused">
          <StoryProblems problems={refused.problems} testId="prv-calendar-problems" />
          <span className="prv-actions">
            <button type="button" className="prv-link-btn" disabled={busy} onClick={() => move(refused.postId, null, true)}>Move anyway</button>
            <button type="button" className="prv-link-btn" onClick={() => setRefused(null)}>Keep it where it was</button>
          </span>
        </div>
      )}
      {error && <p className="prv-error" role="alert">{error}</p>}
      <ol className="prv-calendar-days">
        {busyDays.map((d) => {
          const k = dayKey(d);
          const list = byDay.get(k) || [];
          return (
            <li key={k} className="prv-calendar-day" data-testid="prv-calendar-day" data-day={k}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) move(id, d); }}>
              <span className="prv-calendar-date">{dayLabel(d)}</span>
              {list.map((p) => (
                <button key={p.post_id} type="button" draggable data-testid="prv-calendar-post"
                  className={`prv-calendar-post${picked === p.post_id ? ' prv-calendar-picked' : ''}${p.post_weight === 'load_bearing' ? ' prv-calendar-load' : ''}`}
                  onDragStart={(e) => { e.dataTransfer.setData('text/plain', p.post_id); setPicked(p.post_id); }}
                  onClick={() => setPicked(picked === p.post_id ? null : p.post_id)}
                  aria-pressed={picked === p.post_id}>
                  <b>{timeLabel(p.release_at)}</b> {atHandle(p.handle)}{p.story ? ` · ${p.story}` : ''}
                  <span className="prv-calendar-text">{p.text}</span>
                </button>
              ))}
              {picked && !list.some((p) => p.post_id === picked) && (
                <button type="button" className="prv-link-btn" disabled={busy} onClick={() => move(picked, d)}>Move here</button>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
