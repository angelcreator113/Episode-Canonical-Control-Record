/**
 * The Pulse › Messages (Task 2985; The Pulse spec §3 "Messages: Lala's DMs are
 * canon conversations, drafted in voice and approved like posts"). Lala's
 * conversations as they stand at the page's story moment: only live messages
 * at or before it (GET /api/v1/pulse-dms?at=…&profile_id=…, Task 2984), so
 * nothing shows before its story time and nothing behind the curtain (no
 * drafts, no gate, no topic). A list, then one conversation; on a phone one
 * column, with Back. Styles: SocialMediaPage.css (pl-msg-*).
 */
import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import api from '../../services/api';
import { Avatar } from './PulsePost';

const nameOf = (p) => p?.display_name || (p?.handle ? `@${p.handle}` : 'Someone');

/** The other one in a conversation, from Lala's side. */
export const otherOf = (thread, meId) => thread.profiles.find((p) => Number(p.id) !== Number(meId)) || thread.profiles[0] || {};

export default function PulseMessages({ show, lala, viewAt }) {
  const me = lala?.profile?.id ?? null;
  const [threads, setThreads] = useState(null);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    if (!show?.id || me == null) return undefined;
    let alive = true;
    setThreads(null);
    setError(null);
    // Always Lala's screen: the live conversation at the page's moment, never drafts.
    const at = viewAt || 'present';
    api.get(`/api/v1/pulse-dms?show_id=${encodeURIComponent(show.id)}&at=${encodeURIComponent(at)}&profile_id=${me}`)
      .then((res) => { if (alive) setThreads(Array.isArray(res.data?.threads) ? res.data.threads : []); })
      .catch((err) => {
        console.error('[ThePulse] messages could not be read:', err.response?.status || err.message);
        if (alive) setError('Messages could not be loaded.');
      });
    return () => { alive = false; };
  }, [show?.id, me, viewAt]);

  if (lala === false || (lala && me == null)) return <p className="pl-empty" data-testid="pl-msg-empty">No messages yet.</p>;
  if (error) return <p className="pl-empty" role="alert">{error}</p>;
  if (!threads) return <p className="pl-empty">Loading messages…</p>;
  if (threads.length === 0) return <p className="pl-empty" data-testid="pl-msg-empty">No messages yet.</p>;

  const open = threads.find((t) => t.id === openId) || null;
  if (open) {
    const other = otherOf(open, me);
    return (
      <section className="pl-msg-thread" aria-label={`Messages with ${nameOf(other)}`} data-testid="pl-msg-thread">
        <header className="pl-msg-head">
          <button type="button" className="pl-msg-back" onClick={() => setOpenId(null)}><ArrowLeft size={18} aria-hidden="true" /> Messages</button>
          <Avatar name={nameOf(other)} size={32} />
          <b>{nameOf(other)}</b>{other.handle && <span className="pl-msg-handle">@{other.handle}</span>}
        </header>
        <ol className="pl-msg-list">
          {open.messages.map((m) => (
            <li key={m.id} className={Number(m.sender_profile_id) === Number(me) ? 'pl-msg-bubble mine' : 'pl-msg-bubble'} data-testid="pl-msg-bubble">
              {m.text}
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <section className="pl-msg-inbox" aria-label="Messages" data-testid="pl-msg-inbox">
      <h2 className="pl-msg-title">Messages</h2>
      <ul className="pl-msg-threads">
        {threads.map((t) => {
          const other = otherOf(t, me);
          const last = t.messages[t.messages.length - 1];
          return (
            <li key={t.id}>
              <button type="button" className="pl-msg-row" onClick={() => setOpenId(t.id)} data-testid="pl-msg-row">
                <Avatar name={nameOf(other)} size={40} />
                <span className="pl-msg-row-text">
                  <b>{nameOf(other)}</b>
                  {last && <span className="pl-msg-preview">{Number(last.sender_profile_id) === Number(me) ? 'You: ' : ''}{last.text}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
