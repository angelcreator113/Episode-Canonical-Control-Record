/**
 * CultureYear — the Culture tab's front page in the LalaVerse hub, to
 * Evoni's mock (2026-10-06): the year as twelve months with a dot for each
 * thing that happens in it, the chosen month's list, and the cultural
 * memory. The Culture page's own tabs (Events, Awards & Media, History)
 * stay below.
 *
 * Sources (lib/cultureYear): the cultural calendar (passed in, the page
 * already loads it), the show's own events by their date, the award shows
 * by their month, and for memory the outcomes the episode completion
 * writes into the Show Bible. A cultural event's "Make it an event" is the
 * page's auto-spawn (POST /calendar/events/:id/auto-spawn); a show event
 * opens its Event Package.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { yearMonths, yearSummary, memoryMoments, KIND_LABEL, BADGE_LABEL } from '../../lib/cultureYear';
import './CultureYear.css';

const DOTS = 5;
const plural = (n, one, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

export default function CultureYear({ calendar = [], loading = false, awards = [], showId, onCreateEvent, onOpen }) {
  // undefined while loading, null when it could not be read.
  const [library, setLibrary] = useState(undefined);
  const [memory, setMemory] = useState(null);
  const [month, setMonth] = useState(() => new Date().getMonth());

  useEffect(() => {
    let live = true;
    if (!showId) { setLibrary([]); return undefined; }
    setLibrary(undefined);
    api.get(`/api/v1/world/${showId}/events`)
      .then((r) => { if (live) setLibrary(r.data?.events || []); })
      .catch((err) => { console.error('[CultureYear] the show\'s events could not be read:', err?.response?.status || err?.message); if (live) setLibrary(null); });
    return () => { live = false; };
  }, [showId]);

  useEffect(() => {
    let live = true;
    api.get('/api/v1/franchise-brain/entries?category=narrative&status=active')
      .then((r) => { if (live) setMemory(memoryMoments(r.data?.data || r.data?.entries || [])); })
      .catch((err) => { console.error('[CultureYear] the cultural memory could not be read:', err?.response?.status || err?.message); if (live) setMemory(false); });
    return () => { live = false; };
  }, []);

  const months = useMemo(() => yearMonths({ calendar, library: library || [], awards }), [calendar, library, awards]);
  const summary = yearSummary({ calendar, library: library || [] });
  const current = months[month];

  return (
    <div className="cy" data-testid="culture-year">
      <section className="cy-card" aria-labelledby="cy-year-heading">
        <div className="cy-head">
          <h2 id="cy-year-heading" className="cy-title">The year</h2>
          <span className="cy-sub" data-testid="cy-summary">
            {(loading || library === undefined) ? 'Reading the calendar…' : `${plural(summary.library, 'event')} in the library · ${summary.placed.toLocaleString()} placed on the calendar · ${plural(summary.cultural, 'cultural moment')}`}
          </span>
        </div>
        <div className="cy-months" role="group" aria-label="Pick a month">
          {months.map((m) => (
            <button key={m.month} type="button" aria-pressed={month === m.month} aria-label={`${m.name}: ${plural(m.items.length, 'thing')} on the calendar`}
              className={`cy-month${month === m.month ? ' is-active' : ''}`} onClick={() => setMonth(m.month)}>
              <span className="cy-month-name">{m.short}</span>
              <span className="cy-dots" aria-hidden="true">
                {m.items.slice(0, DOTS).map((it) => <span key={it.key} className={`cy-dot is-${it.kind}`} />)}
                {m.items.length > DOTS && <span className="cy-more">+{m.items.length - DOTS}</span>}
              </span>
            </button>
          ))}
        </div>
        <div className="cy-legend" aria-hidden="true">
          {['event', 'micro', 'library', 'award'].map((k) => <span key={k}><span className={`cy-dot is-${k}`} />{KIND_LABEL[k]}</span>)}
        </div>
      </section>

      <div className="cy-cols">
        <section className="cy-card" aria-labelledby="cy-month-heading">
          <div className="cy-head">
            <h2 id="cy-month-heading" className="cy-title">{current.name}</h2>
            <span className="cy-sub">{plural(current.items.length, 'thing')} on the calendar</span>
          </div>
          {current.items.length === 0 ? (
            <p className="cy-note" data-testid="cy-month-empty">Nothing on the calendar in {current.name} yet. Add a cultural event under Events below, or give a show event a date in its Event Package.</p>
          ) : (
            <ul className="cy-items" data-testid="cy-month-items">
              {current.items.map((it) => (
                <li key={it.key} className={`cy-item is-${it.kind}`}>
                  <span className="cy-badge">
                    <span className="cy-badge-kind">{BADGE_LABEL[it.kind]}</span>
                    <span className="cy-badge-day">{it.day ?? '—'}</span>
                  </span>
                  <span className="cy-item-text">
                    <strong>{it.title}</strong>
                    {it.where && <span>{it.where}</span>}
                  </span>
                  {(it.kind === 'event' || it.kind === 'micro') && (
                    <button type="button" className="cy-action" onClick={() => onCreateEvent?.(calendar.find((c) => c.id === it.id))}>Make it an event →</button>
                  )}
                  {it.kind === 'library' && showId && <Link className="cy-action" to={`/shows/${showId}/events/${it.id}`}>Open the event →</Link>}
                  {it.kind === 'award' && <button type="button" className="cy-action" onClick={() => onOpen?.('awards')}>See the award →</button>}
                </li>
              ))}
            </ul>
          )}
          {library === null && showId && !loading && <p className="cy-note">The show's events could not be read just now; only the cultural calendar and the awards are shown.</p>}
        </section>

        <section className="cy-card cy-memory" aria-labelledby="cy-memory-heading">
          <h2 id="cy-memory-heading" className="cy-title">Cultural memory</h2>
          <p className="cy-note">What the world remembers: each completed episode's outcome, as the Show Bible records it.</p>
          {memory === null ? <p className="cy-note">Reading the memory…</p>
            : memory === false ? <p className="cy-note">The cultural memory could not be read just now.</p>
            : memory.length === 0 ? <p className="cy-note" data-testid="cy-memory-empty">Nothing remembered yet. It fills in as episodes are completed.</p>
            : (
              <ul className="cy-moments" data-testid="cy-memory">
                {memory.map((m) => (
                  <li key={m.id} className="cy-moment">
                    <span className="cy-remember">“Remember when…”</span>
                    <strong>{m.title}</strong>
                    {m.text && <span className="cy-moment-text">{m.text}</span>}
                    {m.when && <span className="cy-moment-when">{m.when}</span>}
                  </li>
                ))}
              </ul>
            )}
          <button type="button" className="cy-link" onClick={() => onOpen?.('history')}>How the world remembers →</button>
        </section>
      </div>
    </div>
  );
}
