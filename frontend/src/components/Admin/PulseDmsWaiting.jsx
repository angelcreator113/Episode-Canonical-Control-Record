/**
 * Admin › The Pulse › Review › DMs (Task 2985; The Pulse spec §3 "Lala's DMs
 * are canon conversations, drafted in voice and approved like posts"; Evoni,
 * 2026-10-12: every message waits in Review). Over /api/v1/pulse-dms
 * (Task 2984):
 *   DmThread           a conversation: what it is about, its messages in
 *                      order, each draft with the gate's result (GateResult)
 *                      and Approve, Edit (approve with new words), Reject;
 *                      "Draft the next message" queues it (the posting
 *                      engine drafts it, under the daily cap)
 *   StartConversation  pick a character with a voice, who writes first, a
 *                      story moment and what it is about; it queues the
 *                      first message
 * Nothing here shows on The Pulse. Styles: PulseReviewPost.css (prv-dm-*).
 */
import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { GateResult } from './PulseReviewPost';

const errorOf = (err, fallback) => err.response?.data?.error || fallback;
const handleOf = (p) => (p?.handle ? `@${p.handle}` : `profile ${p?.id ?? '?'}`);

/** The draft messages waiting in a list of conversations. */
export const draftsIn = (threads) => (threads || []).reduce((n, t) => n + t.messages.filter((m) => m.status === 'draft').length, 0);

/** What queuing told us: queued, and whether the engine is on to draft it. */
const queuedNote = (engineOn) => (engineOn
  ? 'Queued. The posting engine drafts it next; it will wait here.'
  : 'Queued. The posting engine is off, so it is drafted once the engine is on (Engine tab).');

function DraftMessage({ message, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(message.text);
  const act = async (action, label, body = {}) => {
    setBusy(true); setError(null);
    try {
      await api.put(`/api/v1/pulse-dms/messages/${message.id}`, { action, ...body });
      setEditing(false);
      onChange?.();
    } catch (err) {
      console.error(`[PulseDms] ${label} failed:`, err.response?.status || err.message);
      setError(errorOf(err, `${label} failed.`));
    } finally { setBusy(false); }
  };
  return (
    <div className="prv-dm-draft" data-testid="prv-dm-draft">
      <GateResult gate={message.gate} />
      {editing ? (
        <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) act('edit', 'Saving the edit', { text: text.trim() }); }}>
          <label className="prv-num-field prv-num-reason">The message
            <textarea rows={3} value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} />
          </label>
          <span className="prv-actions">
            <button type="submit" className="prv-btn" disabled={busy || !text.trim()}>Save and approve</button>
            <button type="button" className="prv-link-btn" disabled={busy} onClick={() => { setEditing(false); setText(message.text); }}>Cancel</button>
          </span>
        </form>
      ) : (
        <span className="prv-actions">
          <button type="button" className="prv-btn" disabled={busy} onClick={() => act('approve', 'Approve')}>Approve</button>
          <button type="button" className="prv-link-btn" disabled={busy} onClick={() => setEditing(true)}>Edit</button>
          <button type="button" className="prv-link-btn" disabled={busy} onClick={() => act('reject', 'Reject')}>Reject</button>
        </span>
      )}
      {error && <p className="prv-error" role="alert">{error}</p>}
    </div>
  );
}

export function DmThread({ thread, onChange }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [error, setError] = useState(null);
  const byId = new Map(thread.profiles.map((p) => [Number(p.id), p]));
  const next = async () => {
    setBusy(true); setError(null); setNote(null);
    try {
      const res = await api.post(`/api/v1/pulse-dms/${thread.id}/next`, {});
      setNote(queuedNote(res.data?.engine_on));
    } catch (err) {
      console.error('[PulseDms] queuing the next message failed:', err.response?.status || err.message);
      setError(errorOf(err, 'Queuing the next message failed.'));
    } finally { setBusy(false); }
  };
  return (
    <li className="prv-dm" data-testid="prv-dm-thread">
      <div className="prv-num-head"><b>{thread.profiles.map(handleOf).join(' ↔ ')}</b></div>
      {thread.topic && <p className="prv-muted">About: {thread.topic}</p>}
      <ol className="prv-dm-messages">
        {thread.messages.map((m) => (
          <li key={m.id} className={m.status === 'draft' ? 'prv-dm-message prv-dm-is-draft' : 'prv-dm-message'} data-testid="prv-dm-message">
            <span><b>{handleOf(byId.get(Number(m.sender_profile_id)))}</b>{m.status === 'draft' && <span className="prv-num-flag">Draft</span>}</span>
            <p className="prv-num-text">{m.text}</p>
            {m.status === 'draft' && <DraftMessage message={m} onChange={onChange} />}
          </li>
        ))}
      </ol>
      <span className="prv-actions">
        <button type="button" className="prv-link-btn" disabled={busy} onClick={next}>Draft the next message</button>
      </span>
      {note && <p className="prv-muted" role="status">{note}</p>}
      {error && <p className="prv-error" role="alert">{error}</p>}
    </li>
  );
}

export function StartConversation({ showId, onStarted }) {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState(null);
  const [lalaId, setLalaId] = useState(null);
  const [form, setForm] = useState({ other: '', first: 'lala', at: '', topic: '' });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || people) return undefined;
    let alive = true;
    const id = encodeURIComponent(showId);
    Promise.all([api.get(`/api/v1/pulse-voices?show_id=${id}`), api.get(`/api/v1/social-profiles/lala?show_id=${id}`)])
      .then(([voices, lala]) => {
        if (!alive) return;
        const me = lala.data?.data?.profile?.id ?? null;
        setLalaId(me);
        setPeople((voices.data?.characters || []).filter((c) => c.voice && Number(c.social_profile_id) !== Number(me)));
      })
      .catch((err) => {
        console.error('[PulseDms] the characters could not be read:', err.response?.status || err.message);
        if (alive) { setPeople([]); setError('The characters could not be loaded.'); }
      });
    return () => { alive = false; };
  }, [open, people, showId]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const atOk = form.at.trim() === '' || /^\d{1,6}$/.test(form.at.trim());
  const ready = lalaId != null && form.other && atOk;
  const start = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true); setError(null); setNote(null);
    const other = Number(form.other);
    try {
      const res = await api.post('/api/v1/pulse-dms', {
        show_id: showId, profile_a_id: lalaId, profile_b_id: other,
        sender_profile_id: form.first === 'lala' ? lalaId : other,
        ...(form.at.trim() ? { story_order: Number(form.at.trim()) } : {}),
        ...(form.topic.trim() ? { topic: form.topic.trim() } : {}),
      });
      setNote(queuedNote(res.data?.engine_on));
      setForm({ other: '', first: 'lala', at: '', topic: '' });
      onStarted?.();
    } catch (err) {
      console.error('[PulseDms] starting the conversation failed:', err.response?.status || err.message);
      setError(errorOf(err, 'Starting the conversation failed.'));
    } finally { setBusy(false); }
  };

  if (!open) {
    return (
      <>
        <button type="button" className="prv-btn" onClick={() => setOpen(true)}>Start a conversation</button>
        {note && <p className="prv-muted" role="status">{note}</p>}
      </>
    );
  }
  return (
    <form className="prv-dm-start" onSubmit={start} data-testid="prv-dm-start">
      {!people ? <p className="prv-muted">Loading the characters…</p> : (
        <>
          <label className="prv-num-field">With
            <select value={form.other} onChange={set('other')}>
              <option value="">Choose a character</option>
              {people.map((c) => <option key={c.registry_character_id} value={c.social_profile_id}>{c.display_name} (@{c.handle})</option>)}
            </select>
          </label>
          {people.length === 0 && <p className="prv-muted">No character has a voice yet. Build one in Voices.</p>}
          <label className="prv-num-field">Who writes first
            <select value={form.first} onChange={set('first')}>
              <option value="lala">Lala</option>
              <option value="other">Them</option>
            </select>
          </label>
          <label className="prv-num-field">Story moment (optional; the present when empty)
            <input type="text" inputMode="numeric" value={form.at} onChange={set('at')} placeholder="e.g. 17" />
          </label>
          <label className="prv-num-field prv-num-reason">What it is about
            <input type="text" maxLength={1000} value={form.topic} onChange={set('topic')} />
          </label>
        </>
      )}
      <span className="prv-actions">
        <button type="submit" className="prv-btn" disabled={busy || !ready}>Queue the first message</button>
        <button type="button" className="prv-link-btn" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
      </span>
      {!atOk && <p className="prv-error" role="alert">The story moment is a whole number.</p>}
      {note && <p className="prv-muted" role="status">{note}</p>}
      {error && <p className="prv-error" role="alert">{error}</p>}
    </form>
  );
}

/** The conversations with drafts waiting. */
export default function PulseDmsWaiting({ threads, onChange }) {
  const waiting = (threads || []).filter((t) => t.messages.some((m) => m.status === 'draft'));
  return (
    <>
      <p className="prv-muted">Every message, Lala's and theirs, waits here. Approve, edit or reject it; only approved messages show on The Pulse.</p>
      <ul className="prv-plain">{waiting.map((t) => <DmThread key={t.id} thread={t} onChange={onChange} />)}</ul>
    </>
  );
}
