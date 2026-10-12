/**
 * Admin › The Pulse › Polls (Task #3006; The Pulse spec §11 "Audience voting:
 * a public poll ('which look for <event>?') whose result is offered to Evoni
 * as a choice on the Style Page"; docs/reads/2026-10-12-pulse-public-extras-
 * read.md §2). Over /api/v1/pulse-polls (#3005):
 *   NewPoll   an event of the show, the question (default "Which look for
 *             <event>?"), 2-6 options: a label and its pieces from the show's
 *             wardrobe, or the event's planned outfit to start from; an
 *             optional closing time
 *   PollCard  status; a draft opens, an open poll closes; while open the
 *             votes so far, once closed each option's count
 * A note says when voting is off on the server (POLL_HASH_SALT not set).
 * The public card is components/site/AudiencePoll. Styles: AdminPanel.css
 * (pulse-poll-*).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../services/api';

const STATUS_WORDS = { draft: 'Draft', open: 'Open', closed: 'Closed' };
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;
const errorOf = (err, fallback) => err.response?.data?.error || fallback;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The wardrobe ids in an event's planned outfit (ids, or pieces with an id). */
export function plannedIds(event) {
  const list = Array.isArray(event?.outfit_pieces) ? event.outfit_pieces : [];
  return [...new Set(list.map((p) => (typeof p === 'string' ? p : p?.id || p?.wardrobe_id)).filter((id) => UUID_RE.test(String(id || ''))).map(String))];
}

const emptyOption = () => ({ label: '', wardrobe_ids: [] });

function OptionEditor({ index, option, wardrobe, planned, onChange, onRemove, canRemove }) {
  const nameOf = (id) => wardrobe.find((w) => String(w.id) === id)?.name || 'A piece';
  const add = (id) => { if (id && !option.wardrobe_ids.includes(id)) onChange({ ...option, wardrobe_ids: [...option.wardrobe_ids, id] }); };
  return (
    <li className="pulse-poll-option" data-testid="pulse-poll-option">
      <label>Option {index + 1}
        <input type="text" maxLength={200} value={option.label} placeholder="e.g. The pink set" onChange={(e) => onChange({ ...option, label: e.target.value })} />
      </label>
      {option.wardrobe_ids.length > 0 && (
        <ul className="pulse-poll-pieces">
          {option.wardrobe_ids.map((id) => (
            <li key={id}>
              {nameOf(id)}
              <button type="button" className="pulse-link-btn" aria-label={`Remove ${nameOf(id)}`}
                onClick={() => onChange({ ...option, wardrobe_ids: option.wardrobe_ids.filter((x) => x !== id) })}>×</button>
            </li>
          ))}
        </ul>
      )}
      <span className="pulse-poll-actions">
        <label className="pulse-poll-add">Add a piece
          <select value="" onChange={(e) => add(e.target.value)}>
            <option value="">Choose from the wardrobe</option>
            {wardrobe.map((w) => <option key={w.id} value={String(w.id)}>{w.name}</option>)}
          </select>
        </label>
        {planned.length > 0 && (
          <button type="button" className="pulse-link-btn" onClick={() => onChange({ ...option, wardrobe_ids: [...new Set([...option.wardrobe_ids, ...planned])] })}>
            Use the event&apos;s planned outfit
          </button>
        )}
        {canRemove && <button type="button" className="pulse-link-btn" onClick={onRemove}>Remove option</button>}
      </span>
    </li>
  );
}

function NewPoll({ showId, events, wardrobe, onCreated }) {
  const [open, setOpen] = useState(false);
  const [eventId, setEventId] = useState('');
  const [question, setQuestion] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [options, setOptions] = useState([emptyOption(), emptyOption()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const event = events.find((e) => e.id === eventId) || null;
  const planned = useMemo(() => plannedIds(event), [event]);
  const ready = eventId && options.length >= MIN_OPTIONS && options.every((o) => o.label.trim());

  const reset = () => { setEventId(''); setQuestion(''); setClosesAt(''); setOptions([emptyOption(), emptyOption()]); setError(null); };
  const create = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true); setError(null);
    try {
      await api.post('/api/v1/pulse-polls', {
        show_id: showId, world_event_id: eventId,
        ...(question.trim() ? { question: question.trim() } : {}),
        ...(closesAt ? { closes_at: new Date(closesAt).toISOString() } : {}),
        options: options.map((o) => ({ label: o.label.trim(), wardrobe_ids: o.wardrobe_ids })),
      });
      reset();
      setOpen(false);
      onCreated?.();
    } catch (err) {
      console.error('[PulsePolls] creating the poll failed:', err.response?.status || err.message);
      setError(errorOf(err, 'Creating the poll failed.'));
    } finally { setBusy(false); }
  };

  if (!open) return <button type="button" className="pulse-btn" onClick={() => setOpen(true)}>New poll</button>;
  return (
    <form className="pulse-poll-new" onSubmit={create} data-testid="pulse-poll-new">
      <label>Event
        <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
          <option value="">Choose an event</option>
          {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>
      </label>
      <label>Question
        <input type="text" maxLength={500} value={question} onChange={(e) => setQuestion(e.target.value)}
          placeholder={event ? `Which look for ${event.name}?` : 'Which look for <event>?'} />
      </label>
      <ol className="pulse-poll-options">
        {options.map((o, i) => (
          <OptionEditor key={i} index={i} option={o} wardrobe={wardrobe} planned={planned}
            canRemove={options.length > MIN_OPTIONS}
            onChange={(next) => setOptions((list) => list.map((x, j) => (j === i ? next : x)))}
            onRemove={() => setOptions((list) => list.filter((_, j) => j !== i))} />
        ))}
      </ol>
      {options.length < MAX_OPTIONS && (
        <button type="button" className="pulse-link-btn" onClick={() => setOptions((list) => [...list, emptyOption()])}>Add an option</button>
      )}
      <label>Closes (optional)
        <input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
      </label>
      <span className="pulse-poll-actions">
        <button type="submit" className="pulse-btn" disabled={busy || !ready}>Save as draft</button>
        <button type="button" className="pulse-link-btn" disabled={busy} onClick={() => { reset(); setOpen(false); }}>Cancel</button>
      </span>
      {error && <p className="pulse-error" role="alert">{error}</p>}
    </form>
  );
}

export function PollCard({ poll, eventName, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const act = async (label, path) => {
    setBusy(true); setError(null);
    try { await api.post(`/api/v1/pulse-polls/${poll.id}/${path}`, {}); onChange?.(); } catch (err) {
      console.error(`[PulsePolls] ${label} failed:`, err.response?.status || err.message);
      setError(errorOf(err, `${label} failed.`));
    } finally { setBusy(false); }
  };
  const closed = poll.status === 'closed';
  return (
    <li className="pulse-poll-card" data-testid="pulse-poll-card">
      <div className="pulse-poll-head">
        <b>{poll.question}</b>
        <span className={`pulse-poll-status pulse-poll-status-${poll.status}`}>{STATUS_WORDS[poll.status] || poll.status}</span>
      </div>
      {eventName && <p className="pulse-hint">About {eventName}.</p>}
      {poll.status === 'open' && (
        <p className="pulse-hint" data-testid="pulse-poll-so-far">
          {poll.total === 1 ? '1 vote so far' : `${poll.total} votes so far`}{poll.closes_at ? ` · closes ${new Date(poll.closes_at).toLocaleString()}` : ''}
        </p>
      )}
      <ul className="pulse-poll-list">
        {poll.options.map((o) => (
          <li key={o.id}>
            <span>{o.label}</span>
            <span className="pulse-hint">{o.wardrobe_ids.length === 1 ? '1 piece' : `${o.wardrobe_ids.length} pieces`}</span>
            {closed && <b className="pulse-poll-count">{o.votes === 1 ? '1 vote' : `${o.votes} votes`}</b>}
          </li>
        ))}
      </ul>
      {closed && <p className="pulse-hint">{poll.total === 1 ? '1 vote in all.' : `${poll.total} votes in all.`}</p>}
      <span className="pulse-poll-actions">
        {poll.status === 'draft' && <button type="button" className="pulse-btn" disabled={busy} onClick={() => act('Opening the poll', 'open')}>Open</button>}
        {poll.status === 'open' && <button type="button" className="pulse-btn" disabled={busy} onClick={() => act('Closing the poll', 'close')}>Close</button>}
      </span>
      {error && <p className="pulse-error" role="alert">{error}</p>}
    </li>
  );
}

export default function PulsePolls({ showId }) {
  const [data, setData] = useState(null);
  const [events, setEvents] = useState([]);
  const [wardrobe, setWardrobe] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/api/v1/pulse-polls?show_id=${encodeURIComponent(showId)}`);
      setData(res.data);
      setError(null);
    } catch (err) {
      console.error('[PulsePolls] the polls could not be read:', err.response?.status || err.message);
      setError('The polls could not be loaded.');
    }
  }, [showId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    let alive = true;
    api.get(`/api/v1/world/${encodeURIComponent(showId)}/events`)
      .then((res) => { if (alive) setEvents(Array.isArray(res.data?.events) ? res.data.events : []); })
      .catch((err) => console.error('[PulsePolls] the events could not be read:', err.response?.status || err.message));
    api.get(`/api/v1/wardrobe?show_id=${encodeURIComponent(showId)}&limit=200&sortBy=name&sortOrder=ASC`)
      .then((res) => { if (alive) setWardrobe(Array.isArray(res.data?.data) ? res.data.data : []); })
      .catch((err) => console.error('[PulsePolls] the wardrobe could not be read:', err.response?.status || err.message));
    return () => { alive = false; };
  }, [showId]);

  const eventName = (id) => events.find((e) => e.id === id)?.name || null;
  const polls = Array.isArray(data?.polls) ? data.polls : [];

  return (
    <section className="pulse-poll" aria-labelledby="pulse-poll-heading" data-testid="pulse-poll">
      <h3 id="pulse-poll-heading">Polls</h3>
      <p className="pulse-hint">Ask the audience which look for an event. The result is a suggestion: you choose on the Style Page. Open polls show on the public site.</p>
      {data && data.voting_ready === false && (
        <p className="pulse-error" role="status" data-testid="pulse-poll-not-ready">Voting is off on the server until POLL_HASH_SALT is set. Polls can still be made and opened.</p>
      )}
      {error && <p className="pulse-error" role="alert">{error}</p>}
      {!data && !error && <p className="pulse-hint">Loading the polls…</p>}
      {data && (
        <>
          <NewPoll showId={showId} events={events} wardrobe={wardrobe} onCreated={load} />
          {polls.length === 0 ? <p className="pulse-hint" data-testid="pulse-poll-empty">No polls yet.</p> : (
            <ul className="pulse-poll-cards">
              {polls.map((p) => <PollCard key={p.id} poll={p} eventName={eventName(p.world_event_id)} onChange={load} />)}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
