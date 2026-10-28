// frontend/src/pages/TeleprompterRemote.jsx
// The teleprompter's phone remote (Teleprompter batch 3; Evoni, 2026-10-20):
// /teleprompter/remote#<token>. A public page, outside the sign-in and the
// app's layout: it is reached only by scanning the QR code on the desktop
// teleprompter (or typing its code), so it has no Sidebar entry. The token
// is the only key: it is read from the URL's fragment (never sent to a
// server in the address) and sent in the X-Remote-Token header. Big buttons
// play, pause, change speed and beat and text size, and start or stop a take
// when the desktop is in Read & record; the desktop shows its own review
// screen after a take, and nothing is saved from here. It shows what the
// desktop is doing (Teleprompter audit 10, 2026-10-24): REC or PAUSED,
// "Reviewing the take" while the review is open, a Start take that waits
// until the desktop can record, and "Stop & review" for a running take.
// "Record on this phone" (Rig mode; Evoni, 2026-10-28): the phone behind the
// beam-splitter glass records the take itself (PhoneRecorder) while the
// prompter under the glass scrolls; the state is read every 0.7 seconds
// while it records (for the beat markers), with how old it was and the
// round trip, so a marker lands as close as the connection allows.

import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, Rabbit, Turtle, ChevronLeft, ChevronRight, Circle, Square, Smartphone, AlertTriangle, Video } from 'lucide-react';
import { phoneApi, tokenFrom, expiryText, REMOTE_GONE, REMOTE_NOT_READY } from '../lib/teleprompterRemoteApi';
import { POLL_MS } from '../hooks/useTeleprompterRemote';
import PhoneRecorder from '../components/Teleprompter/PhoneRecorder';
import './TeleprompterRemote.css';

export const STATE_POLL_MS = 1500;

const readHash = () => {
  try { return tokenFrom(window.location.hash || ''); } catch (err) { console.error('[TeleprompterRemote] address not read:', err); return ''; }
};

const PACING = { steady: 'Steady scroll', lines: 'Pace by line times', voice: 'Follow my voice' };

export default function TeleprompterRemote({ pollMs = STATE_POLL_MS }) {
  const [token, setToken] = useState(readHash);
  const [typed, setTyped] = useState('');
  const [state, setState] = useState(null);
  const [expires, setExpires] = useState(null);
  const [phase, setPhase] = useState(token ? 'connecting' : 'code'); // code | connecting | live | gone | unavailable
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(null);
  // Record on this phone: open, and recording (the state is read faster then).
  const [recOpen, setRecOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  // How old the last state was and the round trip that fetched it (beat markers).
  const [lag, setLag] = useState(null);

  useEffect(() => {
    const onHash = () => { const t = readHash(); if (t) { setToken(t); setPhase('connecting'); } };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const read = useCallback((r) => {
    if (r.ok) {
      setState(r.data?.state || null);
      if (r.rttMs != null) setLag({ ageMs: r.data?.state_age_ms ?? null, rttMs: r.rttMs });
      if (r.data?.expires_at) setExpires(r.data.expires_at);
      setPhase('live');
      setError(null);
      return true;
    }
    if (r.status === 410 || r.status === 401 || r.status === 404) { setPhase('gone'); return false; }
    if (r.status === 409 && r.code === 'MIGRATION_PENDING') { setPhase('unavailable'); return false; }
    setError(r.error || 'The teleprompter did not answer. Trying again…');
    return false;
  }, []);

  // What the desktop is doing, every 1.5 seconds while connected.
  useEffect(() => {
    if (!token || phase === 'gone' || phase === 'unavailable' || phase === 'code') return undefined;
    let live = true;
    const tick = () => {
      const t0 = Date.now();
      return phoneApi.state(token).then((r) => { if (live) read({ ...r, rttMs: Date.now() - t0 }); });
    };
    tick();
    const t = window.setInterval(tick, recording ? Math.min(pollMs, POLL_MS) : pollMs);
    return () => { live = false; window.clearInterval(t); };
  }, [token, phase, pollMs, read, recording]);

  // The recorder's commands go even while a button press is on its way.
  const sendRef = useRef(null);
  const sendNow = useCallback(async (command) => {
    if (!sendRef.current) return;
    const r = await phoneApi.send(sendRef.current, command);
    if (r.ok && r.data?.state) setState(r.data.state);
    if (!r.ok) console.error('[TeleprompterRemote] command not sent:', command, r.status, r.error);
  }, []);
  sendRef.current = token;

  const send = async (command) => {
    if (!token || sending) return;
    setSending(command);
    try {
      const r = await phoneApi.send(token, command);
      if (r.ok) { if (r.data?.state) setState(r.data.state); setError(null); } else read(r);
    } finally {
      setSending(null);
    }
  };

  const submitCode = (e) => {
    e.preventDefault();
    const t = tokenFrom(typed);
    if (!t) return;
    try { window.history.replaceState(null, '', `#${t}`); } catch (err) { console.error('[TeleprompterRemote] address not updated:', err); }
    setToken(t);
    setPhase('connecting');
  };

  const running = !!state?.running;
  const deskRecording = !!state?.recording;
  const canTake = !!state?.recordMode;
  const paused = deskRecording && !!state?.paused;
  const reviewing = !!state?.reviewing;
  // Start waits until the desktop can record (camera ready, no take in review).
  const startBlocked = reviewing || !state?.canRecord;
  const btn = (command, label, Icon, extra = '', blocked = false) => (
    <button type="button" className={`tpr-btn ${extra}`} data-testid={`tpr-${command}`} disabled={phase !== 'live' || !!sending || blocked} onClick={() => send(command)}>
      <Icon size={26} aria-hidden="true" /><span>{label}</span>
    </button>
  );

  return (
    <main className="tpr-page" data-testid="tpr-page">
      <header className="tpr-head">
        <h1 className="tpr-h1"><Smartphone size={22} aria-hidden="true" /> Teleprompter remote</h1>
        {phase === 'live' && expires && <p className="tpr-sub" data-testid="tpr-expiry">{expiryText(expires)}</p>}
      </header>

      {phase === 'code' && (
        <form className="tpr-card" onSubmit={submitCode}>
          <label className="tpr-label" htmlFor="tpr-code">Type the code from the teleprompter</label>
          <input id="tpr-code" className="tpr-input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} data-testid="tpr-code" />
          <button type="submit" className="tpr-btn is-primary" disabled={!typed.trim()} data-testid="tpr-connect">Connect</button>
          <p className="tpr-hint">Or scan the QR code on the teleprompter with your phone&apos;s camera.</p>
        </form>
      )}

      {phase === 'gone' && (
        <section className="tpr-card is-gone" role="alert" data-testid="tpr-gone">
          <AlertTriangle size={22} aria-hidden="true" />
          <p className="tpr-msg">Session ended or expired.</p>
          <p className="tpr-hint">{REMOTE_GONE}</p>
        </section>
      )}
      {phase === 'unavailable' && (
        <section className="tpr-card is-gone" role="alert" data-testid="tpr-unavailable"><p className="tpr-msg">{REMOTE_NOT_READY}</p></section>
      )}

      {(phase === 'live' || phase === 'connecting') && (
        <>
          <section className="tpr-status" aria-live="polite" data-testid="tpr-status">
            {phase === 'connecting' ? <p className="tpr-msg">Connecting…</p> : (
              <>
                <p className="tpr-state" data-testid="tpr-state">
                  {paused ? <span className="tpr-rec" data-testid="tpr-paused">PAUSED · take paused</span>
                    : deskRecording ? <span className="tpr-rec"><span className="tpr-dot" aria-hidden="true" /> Recording{state?.scope === 'episode' ? ' · whole episode' : ''}</span>
                      : state?.phoneTake ? <span className="tpr-rec" data-testid="tpr-phone-take"><span className="tpr-dot" aria-hidden="true" /> Recording on this phone</span>
                      : reviewing ? <span data-testid="tpr-reviewing">Reviewing the take on the teleprompter</span>
                        : running ? 'Running' : 'Paused'}
                </p>
                {state?.beat != null && <p className="tpr-detail" data-testid="tpr-beat">Beat {state.beat}{state.beatName ? ` · ${state.beatName}` : ''}</p>}
                <p className="tpr-detail">
                  {state?.pacing ? PACING[state.pacing] : 'Waiting for the teleprompter'}
                  {state?.pacing === 'lines' && state?.pace != null ? ` · ×${Number(state.pace).toFixed(1)}` : ''}
                  {state?.pacing === 'steady' && state?.speed != null ? ` · speed ${state.speed}` : ''}
                  {state?.size != null ? ` · text ${state.size}` : ''}
                </p>
              </>
            )}
          </section>
          {error && <p className="tpr-error" role="alert">{error}</p>}

          {phase === 'live' && (
            <button type="button" className={`tpr-btn is-wide tpr-rec-toggle${recOpen ? ' is-on' : ''}`} data-testid="tpr-record-here" aria-pressed={recOpen}
              disabled={recording} onClick={() => setRecOpen((v) => !v)}>
              <Video size={24} aria-hidden="true" /><span>{recOpen ? 'Recording on this phone' : 'Record on this phone'}</span>
            </button>
          )}
          {recOpen && phase === 'live' && <PhoneRecorder state={state} lag={lag} send={sendNow} onRecording={setRecording} />}

          {!recording && (
          <div className="tpr-pad">
            <button type="button" className="tpr-btn is-primary is-play" data-testid="tpr-toggle" disabled={phase !== 'live' || !!sending} onClick={() => send('toggle')}>
              {running ? <Pause size={32} aria-hidden="true" /> : <Play size={32} aria-hidden="true" />}
              <span>{running ? 'Pause' : 'Play'}</span>
            </button>
            {btn('slower', 'Slower', Turtle)}
            {btn('faster', 'Faster', Rabbit)}
            {btn('prev_beat', 'Prev beat', ChevronLeft)}
            {btn('next_beat', 'Next beat', ChevronRight)}
            <button type="button" className="tpr-btn" data-testid="tpr-smaller" disabled={phase !== 'live' || !!sending} onClick={() => send('smaller')}><span className="tpr-aa" aria-hidden="true">A-</span><span>Text smaller</span></button>
            <button type="button" className="tpr-btn" data-testid="tpr-bigger" disabled={phase !== 'live' || !!sending} onClick={() => send('bigger')}><span className="tpr-aa" aria-hidden="true">A+</span><span>Text bigger</span></button>
            {canTake && !recOpen && (deskRecording
              ? btn('record_stop', 'Stop & review', Square, 'is-rec is-wide')
              : btn('record_start', 'Start take', Circle, 'is-rec is-wide', startBlocked))}
          </div>
          )}
          {canTake && !recOpen && !deskRecording && reviewing && phase === 'live' && <p className="tpr-hint" data-testid="tpr-review-hint">Save, retake or discard the take on the teleprompter, then start the next one here.</p>}
          {!canTake && !recOpen && phase === 'live' && <p className="tpr-hint">Turn on Read &amp; record on the teleprompter to start and stop takes from here, or tap Record on this phone to film with this phone.</p>}
        </>
      )}
    </main>
  );
}
