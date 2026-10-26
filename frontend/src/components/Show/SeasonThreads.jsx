/**
 * Story threads: the one threads list (Evoni, 2026-10-26: "How do we auto
 * create threads that make sense with the story" … "Let's let them open
 * themselves on new threads and build the threads list. I think that will
 * help things move along"; services/threadInbox).
 *
 * The show's threads, open and moved on first, closed folded away. Each
 * says where it came from ("From E3's script, beat 11", "From the Velour
 * Gala's seeds", "From a short story", "From the feed"), when it opened,
 * why it matters, its part of the season, its latest notes and the slots
 * that continue it. A thread that opened by itself is marked "New · opened
 * by itself" with Undo until Evoni keeps it (the seen mark). Each open
 * thread has a plan, the slot that carries it on and the one that pays it
 * off, which she changes, and "Make it a season twist" (the season twists,
 * prefilled from the plan). Suggestions that wait for her (a short story's,
 * the feed's) have Keep / Merge into… / Drop; what the check left out is
 * listed with the reason. Closing stays hers: Close and Reopen.
 *
 * Self-contained: props showId and, optionally, season (the season number;
 * ?season=N, the Season page's switcher). onChange hears every change.
 * compact leaves out the header's explanation (the What changed card).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { GitBranch, Undo2, Check, X, Sparkles, Shuffle, ChevronDown, AlertTriangle, Merge, Lock, Unlock } from 'lucide-react';
import api from '../../services/api';
import './SeasonThreads.css';

const errorOf = (err, fallback) => err?.response?.data?.error || fallback;
const day = (at) => {
  if (!at) return '';
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
const STATUS = { open: 'Open', advanced: 'Moved on', closed: 'Closed' };

/** The slot pickers: still to come, by label. */
function SlotSelect({ label, value, slots, onChange, after = null, testid }) {
  return (
    <label className="sth-field">
      <span className="sth-sublabel">{label}</span>
      <select value={value || ''} onChange={(e) => onChange(e.target.value || null)} data-testid={testid}>
        <option value="">Not chosen</option>
        {slots.filter((s) => after == null || s.slot_number > after).map((s) => (
          <option key={s.id} value={s.id}>{s.label}{s.phase ? ` · Part ${s.phase}` : ''}</option>
        ))}
      </select>
    </label>
  );
}

function ThreadCard({ t, slots, busy, act, showId, onTwist }) {
  const [carry, setCarry] = useState(t.plan?.carry?.id || null);
  const [payoff, setPayoff] = useState(t.plan?.payoff?.id || null);
  const [twisting, setTwisting] = useState(false);
  const [twistTitle, setTwistTitle] = useState(t.title);
  useEffect(() => { setCarry(t.plan?.carry?.id || null); setPayoff(t.plan?.payoff?.id || null); }, [t.plan?.carry?.id, t.plan?.payoff?.id]);
  const carryNumber = slots.find((s) => s.id === carry)?.slot_number ?? null;
  const planChanged = (carry || null) !== (t.plan?.carry?.id || null) || (payoff || null) !== (t.plan?.payoff?.id || null);
  const closed = t.status === 'closed';
  const isNew = t.opened_by_itself && !t.seen;
  const base = `/api/v1/world/${showId}/season/threads/${t.id}`;
  return (
    <li className={`sth-thread${isNew ? ' is-new' : ''}${closed ? ' is-closed' : ''}`} data-testid={`sth-thread-${t.id}`}>
      <div className="sth-thread-head">
        <p className="sth-title">{t.title}</p>
        <p className="sth-chips">
          {isNew && <span className="sth-chip is-new" data-testid="sth-new">New · opened by itself</span>}
          <span className={`sth-chip is-${t.status}`}>{STATUS[t.status] || t.status}</span>
          {t.part && <span className="sth-chip">Part {t.part.phase}: {t.part.title}</span>}
        </p>
      </div>
      <p className="sth-meta">
        <span>{t.origin?.label}</span>
        {t.opened_at && <span>· opened {day(t.opened_at)}</span>}
        {t.status === 'advanced' && t.advanced_episode_number != null && <span>· moved on in E{t.advanced_episode_number}</span>}
        {closed && t.closed_at && <span>· closed {day(t.closed_at)}</span>}
      </p>
      {t.why && <p className="sth-why"><strong>Why it matters:</strong> {t.why}</p>}
      {t.description && !t.why && <p className="sth-why">{t.description}</p>}
      {t.notes.length > 0 && (
        <ul className="sth-notes" aria-label="Latest notes">
          {t.notes.map((n) => (
            <li key={n.key} className="sth-note">
              <span className="sth-note-text">{n.text}{n.label && <span className="sth-note-from"> {n.label}{n.at ? `, ${day(n.at)}` : ''}</span>}</span>
              {n.can_undo && (
                <button type="button" className="sth-btn-soft is-small" disabled={busy} onClick={() => act(() => api.post(`${base}/notes/${n.key}/undo`), 'The note was not undone.')}
                  aria-label={`Undo the note: ${n.text}`}>
                  <Undo2 size={13} aria-hidden="true" /> Undo
                </button>
              )}
            </li>
          ))}
          {t.notes_count > t.notes.length && <li className="sth-note-more">{t.notes_count - t.notes.length} earlier note{t.notes_count - t.notes.length === 1 ? '' : 's'}</li>}
        </ul>
      )}
      <p className="sth-meta">
        {t.slots.length ? <>Continued in {t.slots.map((s) => s.label).join(', ')}</> : !closed && 'No episode continues it yet.'}
        {t.twists.length > 0 && <span> · Twist{t.twists.length > 1 ? 's' : ''}: {t.twists.map((x) => x.title).join(', ')}</span>}
      </p>

      {!closed && t.plan !== null && (
        <div className="sth-plan" data-testid="sth-plan">
          <p className="sth-sublabel">{t.plan?.by === 'evoni' ? 'Your plan' : 'Suggested plan'} <span className="sth-hint">(change it any time)</span></p>
          <div className="sth-plan-row">
            <SlotSelect label="Carries on in" value={carry} slots={slots} onChange={setCarry} testid="sth-carry" />
            <SlotSelect label="Pays off in" value={payoff} slots={slots} onChange={setPayoff} after={carryNumber} testid="sth-payoff" />
            {planChanged && (
              <button type="button" className="sth-btn" disabled={busy} onClick={() => act(() => api.put(`${base}/plan`, { carry_slot_id: carry, payoff_slot_id: payoff }), 'The plan was not saved.')}>
                <Check size={14} aria-hidden="true" /> Save plan
              </button>
            )}
          </div>
        </div>
      )}

      {twisting && (
        <div className="sth-twist" data-testid="sth-twist-form">
          <label className="sth-field is-wide">
            <span className="sth-sublabel">The twist</span>
            <input type="text" value={twistTitle} onChange={(e) => setTwistTitle(e.target.value)} />
          </label>
          <div className="sth-plan-row">
            <SlotSelect label="Planted in" value={carry} slots={slots} onChange={setCarry} />
            <SlotSelect label="Paid off in" value={payoff} slots={slots} onChange={setPayoff} after={carryNumber} />
          </div>
          <div className="sth-actions">
            <button type="button" className="sth-btn" disabled={busy || !carry || !twistTitle.trim()}
              onClick={async () => {
                const ok = await act(() => api.put(`/api/v1/world/${showId}/season/twists`, {
                  title: twistTitle.trim(), description: t.why || t.description || null, plant_slot_id: carry, payoff_slot_id: payoff || null, thread_ids: [t.id],
                }), 'The twist was not added.', 'Added to the season twists.');
                if (ok) { setTwisting(false); onTwist?.(t); }
              }}>
              <Shuffle size={14} aria-hidden="true" /> Add the twist
            </button>
            <button type="button" className="sth-btn-soft" onClick={() => setTwisting(false)}>Cancel</button>
          </div>
          {!carry && <p className="sth-hint">Choose the episode that plants it.</p>}
        </div>
      )}

      <div className="sth-actions">
        {t.can_undo && (
          <button type="button" className="sth-btn-soft" disabled={busy} data-testid="sth-undo"
            onClick={() => act(() => api.post(`${base}/undo`), 'It was not undone.', `Undone: ${t.title}`)}>
            <Undo2 size={14} aria-hidden="true" /> Undo
          </button>
        )}
        {isNew && (
          <button type="button" className="sth-btn-soft" disabled={busy}
            onClick={() => act(() => api.post(`/api/v1/world/${showId}/season/threads/seen`, { thread_ids: [t.id] }), 'It was not kept.')}>
            <Check size={14} aria-hidden="true" /> Keep
          </button>
        )}
        {!closed && !twisting && slots.length > 1 && (
          <button type="button" className="sth-btn-soft" disabled={busy} onClick={() => { setTwistTitle(t.title); setTwisting(true); }}>
            <Shuffle size={14} aria-hidden="true" /> Make it a season twist
          </button>
        )}
        {!closed ? (
          <button type="button" className="sth-btn-soft" disabled={busy}
            onClick={() => window.confirm(`Close "${t.title}"? You can reopen it later.`) && act(() => api.post(`${base}/close`), 'It was not closed.')}>
            <Lock size={14} aria-hidden="true" /> Close
          </button>
        ) : (
          <button type="button" className="sth-btn-soft" disabled={busy}
            onClick={() => window.confirm(`Reopen "${t.title}"? Its history is kept.`) && act(() => api.post(`${base}/reopen`), 'It was not reopened.')}>
            <Unlock size={14} aria-hidden="true" /> Reopen
          </button>
        )}
      </div>
    </li>
  );
}

function Waiting({ w, open, busy, decide }) {
  const [into, setInto] = useState(w.suggest_into || '');
  return (
    <li className="sth-thread is-waiting" data-testid={`sth-waiting-${w.source}`}>
      <div className="sth-thread-head">
        <p className="sth-title">{w.title}</p>
        <p className="sth-chips">
          <span className="sth-chip">{w.source === 'feed' ? 'Feed' : 'Short story'}</span>
          {w.part && <span className="sth-chip">Part {w.part.phase}: {w.part.title}</span>}
        </p>
      </div>
      <p className="sth-meta"><span>{w.label}</span>{w.created_at && <span>· {day(w.created_at)}</span>}</p>
      {w.why && <p className="sth-why"><strong>Why it matters:</strong> {w.why}</p>}
      {w.note && <p className="sth-why">{w.note}</p>}
      {w.suggest_into && <p className="sth-hint">Looks like the same storyline as “{open.find((t) => t.id === w.suggest_into)?.title}”.</p>}
      <div className="sth-actions">
        <button type="button" className="sth-btn" disabled={busy} onClick={() => decide(w, 'keep')}><Check size={14} aria-hidden="true" /> Keep</button>
        <label className="sth-field is-merge">
          <span className="sth-sr">Merge into</span>
          <select value={into} onChange={(e) => setInto(e.target.value)} aria-label={`Merge "${w.title}" into`}>
            <option value="">Merge into…</option>
            {open.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </label>
        {into && <button type="button" className="sth-btn-soft" disabled={busy} onClick={() => decide(w, 'merge', into)}><Merge size={14} aria-hidden="true" /> Merge</button>}
        <button type="button" className="sth-btn-soft" disabled={busy} onClick={() => decide(w, 'drop')}><X size={14} aria-hidden="true" /> Drop</button>
      </div>
    </li>
  );
}

export default function SeasonThreads({ showId, season = null, onChange, compact = false }) {
  const base = `/api/v1/world/${showId}/season/threads`;
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`${base}/inbox`, { params: season ? { season } : undefined });
      setData(res.data);
    } catch (err) {
      console.error('[SeasonThreads] load failed:', err);
      setNote({ error: true, text: errorOf(err, 'The threads could not be loaded.') });
      setData((d) => d || { threads: [], waiting: [], left_out: [], season: null, unchecked_seeds: 0 });
    }
  }, [base, season]);
  useEffect(() => { load(); }, [load]);

  const act = useCallback(async (fn, failed, done) => {
    setBusy(true); setNote(null);
    try {
      const res = await fn();
      if (done) setNote({ text: done });
      await load();
      onChange?.();
      return res?.data || true;
    } catch (err) {
      console.error('[SeasonThreads] request failed:', err);
      setNote({ error: true, text: errorOf(err, failed) });
      return null;
    } finally { setBusy(false); }
  }, [load, onChange]);

  const decide = (w, action, into = null) => act(
    () => api.post(`${base}/suggestions/decide`, { source: w.source, id: w.id, index: w.index, action, into }),
    'That was not saved.', action === 'keep' ? `Kept: ${w.title}` : action === 'merge' ? 'Merged as a note.' : `Dropped: ${w.title}`);

  const { live, closed, fresh, slots } = useMemo(() => {
    const threads = data?.threads || [];
    const liveList = threads.filter((t) => t.status !== 'closed');
    return {
      live: [...liveList.filter((t) => t.opened_by_itself && !t.seen), ...liveList.filter((t) => !(t.opened_by_itself && !t.seen))],
      closed: threads.filter((t) => t.status === 'closed'),
      fresh: liveList.filter((t) => t.opened_by_itself && !t.seen),
      slots: (data?.season?.slots || []).filter((s) => !s.done),
    };
  }, [data]);

  if (!data) return <section className="sth" aria-busy="true"><p className="sth-hint">Loading the threads…</p></section>;
  const waiting = data.waiting || [];
  const leftOut = data.left_out || [];

  return (
    <section className={`sth${compact ? ' is-compact' : ''}`} aria-labelledby="sth-title" data-testid="season-threads">
      <header className="sth-head">
        <GitBranch size={18} aria-hidden="true" className="sth-icon" />
        <h3 id="sth-title" className="sth-heading">Story threads</h3>
        <span className="sth-count">{live.length} open</span>
      </header>
      {!compact && (
        <p className="sth-hint">
          New threads open by themselves from finished scripts and event seeds, once they fit the story so far. Undo any you don't want; only you close a thread.
          A short story's threads and the feed's wait below for you.
        </p>
      )}
      {note && <p className={`sth-note-line${note.error ? ' is-error' : ''}`} role="status">{note.text}</p>}
      {data.needs_migration && (
        <p className="sth-warn"><AlertTriangle size={14} aria-hidden="true" /> Threads can't open by themselves yet: the database update for this list hasn't run.</p>
      )}
      {data.unchecked_seeds > 0 && (
        <div className="sth-banner">
          <span>{data.unchecked_seeds} event seed{data.unchecked_seeds === 1 ? '' : 's'} not read yet.</span>
          <button type="button" className="sth-btn-soft" disabled={busy} onClick={() => act(() => api.post(`${base}/inbox/seeds`, {}, { timeout: 120000 }), 'The seeds were not read.', 'Read the event seeds.')}>
            <Sparkles size={14} aria-hidden="true" /> {busy ? 'Reading…' : 'Read them now'}
          </button>
        </div>
      )}
      {fresh.length > 1 && (
        <div className="sth-banner">
          <span>{fresh.length} threads opened by themselves since you last looked.</span>
          <button type="button" className="sth-btn-soft" disabled={busy} onClick={() => act(() => api.post(`${base}/seen`, { thread_ids: fresh.map((t) => t.id) }), 'They were not kept.')}>
            <Check size={14} aria-hidden="true" /> Keep them all
          </button>
        </div>
      )}

      {live.length === 0 ? <p className="sth-hint">No open threads yet.</p> : (
        <ul className="sth-list" aria-label="Open threads">
          {live.map((t) => <ThreadCard key={t.id} t={t} slots={slots} busy={busy} act={act} showId={showId} />)}
        </ul>
      )}

      {waiting.length > 0 && (
        <section className="sth-group" aria-label="Waiting for you" data-testid="sth-waiting">
          <h4 className="sth-group-title">Waiting for you <span className="sth-count">{waiting.length}</span></h4>
          <ul className="sth-list">
            {waiting.map((w) => <Waiting key={`${w.source}-${w.id}-${w.index ?? ''}`} w={w} open={live} busy={busy} decide={decide} />)}
          </ul>
        </section>
      )}

      {leftOut.length > 0 && (
        <details className="sth-group" data-testid="sth-left-out" open={!compact}>
          <summary className="sth-group-title">Left out <span className="sth-count">{leftOut.length}</span> <ChevronDown size={14} aria-hidden="true" /></summary>
          <ul className="sth-list">
            {leftOut.map((x) => (
              <li key={`${x.kind}-${x.id}-${x.index ?? ''}`} className="sth-thread is-left-out">
                <p className="sth-title">{x.title}</p>
                <p className="sth-meta"><span>{x.label}</span>{x.at && <span>· {day(x.at)}</span>}</p>
                <p className="sth-why"><strong>{x.undone ? 'Undone:' : 'Why it was left out:'}</strong> {x.reason}</p>
                <div className="sth-actions">
                  <button type="button" className="sth-btn-soft" disabled={busy}
                    onClick={() => (x.kind === 'thread'
                      ? act(() => api.post(`${base}/${x.id}/restore`), 'It was not kept.', `Kept: ${x.title}`)
                      : decide(x, 'keep'))}>
                    <Check size={14} aria-hidden="true" /> Keep it after all
                  </button>
                  {x.kind === 'suggestion' && <button type="button" className="sth-btn-soft" disabled={busy} onClick={() => decide(x, 'drop')}><X size={14} aria-hidden="true" /> Drop</button>}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}

      {closed.length > 0 && (
        <details className="sth-group" data-testid="sth-closed">
          <summary className="sth-group-title">Closed <span className="sth-count">{closed.length}</span> <ChevronDown size={14} aria-hidden="true" /></summary>
          <ul className="sth-list">
            {closed.map((t) => <ThreadCard key={t.id} t={t} slots={slots} busy={busy} act={act} showId={showId} />)}
          </ul>
        </details>
      )}
    </section>
  );
}
