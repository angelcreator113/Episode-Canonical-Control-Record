/**
 * The audience poll on the public landing page (Task #3006; The Pulse spec
 * §11 "a public poll ('which look for <event>?')"; the read's §1 and §3,
 * docs/reads/2026-10-12-pulse-public-extras-read.md). One plain fetch of
 * GET /api/v1/public/polls (same origin, no auth): an open poll shows its
 * question and its options as buttons; a vote is POST /:id/vote, which the
 * server counts once per browser (its own cookie) and per IP. After a vote
 * it says thanks, and the browser remembers it (localStorage, as a
 * convenience; the server is the judge). A poll closed in the last week
 * shows its result. Text only: no images until website storage is live.
 * No poll, or a failed read, renders nothing.
 */
import { useEffect, useState } from 'react';

export const PUBLIC_POLLS_URL = '/api/v1/public/polls';
const votedKey = (pollId) => `pulse_voted:${pollId}`;

const remembered = (pollId) => {
  try { return window.localStorage.getItem(votedKey(pollId)) === '1'; } catch (err) { console.warn('[AudiencePoll] could not read the vote memory:', err.message); return false; }
};
const remember = (pollId) => {
  try { window.localStorage.setItem(votedKey(pollId), '1'); } catch (err) { console.warn('[AudiencePoll] could not keep the vote memory:', err.message); }
};

/** Open polls first, then the latest closed one. */
export async function fetchPublicPolls() {
  try {
    const res = await fetch(PUBLIC_POLLS_URL, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const body = await res.json();
    return Array.isArray(body?.polls) ? body.polls : [];
  } catch (err) {
    console.error('[AudiencePoll] the polls could not be read:', err.message);
    return [];
  }
}

/** The vote's outcome in words: 'thanks' | 'already' | 'closed' | 'not_ready' | 'failed'. */
export async function sendVote(pollId, optionId) {
  try {
    const res = await fetch(`${PUBLIC_POLLS_URL}/${encodeURIComponent(pollId)}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ option_id: optionId }),
    });
    if (res.ok) return 'thanks';
    if (res.status === 409) {
      const body = await res.json().catch(() => ({}));
      return /closed/i.test(body?.error || '') ? 'closed' : 'already';
    }
    if (res.status === 503) return 'not_ready';
    return 'failed';
  } catch (err) {
    console.error('[AudiencePoll] the vote could not be sent:', err.message);
    return 'failed';
  }
}

const MESSAGES = {
  thanks: 'Thanks for voting. Results when it closes.',
  already: "You've voted already. Results when it closes.",
  closed: 'This poll has just closed.',
  not_ready: 'Voting opens soon. Try again later.',
  failed: 'Your vote could not be sent. Try again.',
};

function Results({ poll }) {
  const total = poll.total || 0;
  return (
    <ul className="site-poll__results" data-testid="site-poll-results">
      {poll.options.map((o) => {
        const pct = total ? Math.round((o.votes / total) * 100) : 0;
        return (
          <li key={o.id}>
            <span className="site-poll__result-label">{o.label}</span>
            <span className="site-poll__bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
            <span className="site-poll__pct">{pct}%</span>
          </li>
        );
      })}
    </ul>
  );
}

export default function AudiencePoll() {
  const [polls, setPolls] = useState(null);
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPublicPolls().then((list) => { if (!cancelled) setPolls(list); });
    return () => { cancelled = true; };
  }, []);

  const poll = polls?.find((p) => p.status === 'open') || polls?.find((p) => p.status === 'closed') || null;
  useEffect(() => {
    if (poll?.status === 'open' && remembered(poll.id)) setState('already');
  }, [poll?.id, poll?.status]);
  if (!poll) return null;

  const vote = async (optionId) => {
    setBusy(true);
    const outcome = await sendVote(poll.id, optionId);
    if (outcome === 'thanks' || outcome === 'already') remember(poll.id);
    setState(outcome);
    setBusy(false);
  };
  const open = poll.status === 'open' && state !== 'closed';
  const done = state === 'thanks' || state === 'already';

  return (
    <section className="site-section site-poll" aria-labelledby="site-poll-heading" data-testid="site-poll">
      <div className="site-wrap site-poll__inner">
        <p className="site-eyebrow">{poll.status === 'open' ? 'Your vote' : 'The result'}</p>
        <h2 id="site-poll-heading">{poll.question}</h2>
        {poll.status === 'closed' ? <Results poll={poll} /> : (
          <>
            {open && !done && (
              <div className="site-poll__options" role="group" aria-label={poll.question}>
                {poll.options.map((o) => (
                  <button key={o.id} type="button" className="site-btn site-btn--outline" disabled={busy} onClick={() => vote(o.id)}>{o.label}</button>
                ))}
              </div>
            )}
            {state && <p className="site-poll__note" role="status">{MESSAGES[state]}</p>}
          </>
        )}
      </div>
    </section>
  );
}
