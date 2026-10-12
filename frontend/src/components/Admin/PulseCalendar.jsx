/**
 * Admin › The Pulse › Calendar (Task 2988; The Pulse spec §4 "Calendar —
 * every post, reveal and event on one story-time calendar"). One read,
 * GET /api/v1/pulse-calendar (read only): the show's story moments in order,
 * grouped by episode, each row counting its posts (drafts apart), reveals,
 * events, closeness changes and DMs; Show opens the row's items. Each row
 * links to The Pulse as of that moment (/pulse?at=, Task 2941), and to
 * Review when something there waits. Events keep their date as written.
 * Styles: AdminPanel.css (pulse-cal-*).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

const REVIEW = '/admin?tab=pulse&sub=review';
const REVEAL_WORDS = { post: 'Post', image: 'Image', event: 'Event', character: 'Character' };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The row's counts in words: "2 posts (1 draft) · 1 reveal · 1 event". */
export function countsLine(m) {
  const parts = [];
  const drafts = m.posts.filter((p) => p.status === 'draft').length;
  if (m.posts.length) parts.push(`${plural(m.posts.length, 'post')}${drafts ? ` (${plural(drafts, 'draft')})` : ''}`);
  if (m.reveals.length) parts.push(plural(m.reveals.length, 'reveal'));
  if (m.events.length) parts.push(plural(m.events.length, 'event'));
  if (m.closeness.length) parts.push(plural(m.closeness.length, 'closeness change'));
  if ((m.dms || []).length) parts.push(plural(m.dms.length, 'DM'));
  return parts.join(' · ');
}

/** Moments grouped by episode: [{ episode, moments }], the backstory as episode 0. */
export function byEpisode(moments) {
  const groups = new Map();
  for (const m of moments) {
    const ep = Math.floor(m.order / 10);
    if (!groups.has(ep)) groups.set(ep, []);
    groups.get(ep).push(m);
  }
  return [...groups].map(([episode, list]) => ({ episode, moments: list }));
}

const waits = (m) => m.posts.some((p) => p.status === 'draft') || m.closeness.some((c) => c.status === 'proposed')
  || (m.dms || []).some((d) => d.status === 'draft');

function MomentRow({ m }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="pulse-cal-row" data-testid="pulse-cal-row">
      <div className="pulse-cal-head">
        <b className="pulse-cal-label">{m.label}</b>
        <span className="pulse-cal-counts">{countsLine(m)}</span>
        <span className="pulse-cal-actions">
          <button type="button" className="pulse-link-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? 'Hide' : 'Show'}</button>
          <Link to={`/pulse?at=${m.order}`}>See The Pulse then</Link>
          {waits(m) && <Link to={REVIEW}>Review</Link>}
        </span>
      </div>
      {open && (
        <ul className="pulse-cal-items" data-testid="pulse-cal-items">
          {m.events.map((ev) => (
            <li key={`e-${ev.id}`}><span className="pulse-cal-kind">Event</span> {ev.name}{ev.date ? ` · ${ev.date}` : ''}{ev.time ? ` ${ev.time}` : ''}{ev.venue ? ` · ${ev.venue}` : ''}</li>
          ))}
          {m.posts.map((p) => (
            <li key={`p-${p.id}`}>
              <span className="pulse-cal-kind">{p.status === 'draft' ? 'Draft' : 'Post'}</span> @{p.poster_handle}{p.text ? `: ${p.text}` : ''}
            </li>
          ))}
          {m.reveals.map((r) => (
            <li key={`r-${r.id}`}><span className="pulse-cal-kind">Reveal</span> {REVEAL_WORDS[r.item_type] || r.item_type}{r.image_kind ? ` (${r.image_kind.replace(/_/g, ' ')})` : ''} revealed{r.mode === 'teaser' ? ' (a first look before)' : ''}</li>
          ))}
          {m.closeness.map((c) => (
            <li key={`c-${c.id}`}><span className="pulse-cal-kind">Closeness</span> @{c.a} ↔ @{c.b} {c.delta > 0 ? '+' : ''}{Math.round(c.delta * 100)}{c.status === 'proposed' ? ' (waiting)' : ''}</li>
          ))}
          {(m.dms || []).map((d) => (
            <li key={`d-${d.id}`}><span className="pulse-cal-kind">{d.status === 'draft' ? 'DM draft' : 'DM'}</span> @{d.sender}: {d.text}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function PulseCalendar({ showId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    api.get(`/api/v1/pulse-calendar?show_id=${encodeURIComponent(showId)}`)
      .then((res) => { if (alive) setData(res.data); })
      .catch((err) => {
        console.error('[PulseCalendar] the calendar could not be read:', err.response?.status || err.message);
        if (alive) setError('The calendar could not be loaded.');
      });
    return () => { alive = false; };
  }, [showId]);

  const groups = useMemo(() => byEpisode(data?.moments || []), [data]);

  return (
    <section className="pulse-cal" aria-labelledby="pulse-cal-heading" data-testid="pulse-cal">
      <h3 id="pulse-cal-heading">Calendar</h3>
      <p className="pulse-hint">Every post, reveal and event in story time, moment by moment. Drafts and changes waiting for you are marked.</p>
      {error && <p className="pulse-error" role="alert">{error}</p>}
      {!data && !error && <p className="pulse-hint">Loading the calendar…</p>}
      {data && groups.length === 0 && <p className="pulse-hint" data-testid="pulse-cal-empty">Nothing in story time yet.</p>}
      {groups.map((g) => (
        <section key={g.episode} className="pulse-cal-episode" aria-label={g.episode === 0 ? 'Backstory' : `Episode ${g.episode}`}>
          <h4>{g.episode === 0 ? 'Backstory' : `Episode ${g.episode}`}</h4>
          <ul className="pulse-cal-rows">{g.moments.map((m) => <MomentRow key={m.order} m={m} />)}</ul>
        </section>
      ))}
      {data && (data.unplaced?.posts > 0 || data.unplaced?.reveals > 0) && (
        <p className="pulse-hint" data-testid="pulse-cal-unplaced">
          Not in story time yet: {[data.unplaced.posts ? plural(data.unplaced.posts, 'post') : null, data.unplaced.reveals ? plural(data.unplaced.reveals, 'reveal') : null].filter(Boolean).join(' and ')}.
        </p>
      )}
    </section>
  );
}
