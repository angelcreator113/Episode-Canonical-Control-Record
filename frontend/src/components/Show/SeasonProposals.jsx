/**
 * Season Plan › From the feed (Evoni, 2026-10-17: "as the feed characters
 * grow so does the story arc"; her ruling: proposals she approves). The
 * open proposal from services/seasonArcProposals: what moved on the feed,
 * what it would change in the season (phase themes, threads, slot
 * purposes) and why. She ticks what to keep; nothing changes until Accept.
 * A proposal is asked for when an episode is accepted, a Pulse storyline
 * pays off or followers jump, and with Check the feed now.
 *
 * Props: showId, api (the page's client), onApplied (reload the season).
 */
import { useCallback, useEffect, useState } from 'react';
import { Sparkles, TrendingUp, TrendingDown } from 'lucide-react';
import { atHandle } from '../../pages/feed/feedConstants';
import './SeasonProposals.css';

const KIND_LABEL = {
  phase_theme: (c) => `Phase ${c.phase}${c.phase_title ? `: ${c.phase_title}` : ''}`,
  thread_open: () => 'New story thread',
  thread_close: () => 'Close a story thread',
  slot_intention: (c) => `E${c.slot_number}'s purpose`,
};

function changeText(c) {
  if (c.kind === 'phase_theme') return [c.tagline && `Tagline: “${c.tagline}”`, c.emotional_arc && `Emotional arc: ${c.emotional_arc}`].filter(Boolean).join(' · ');
  if (c.kind === 'thread_open') return [c.title, c.description].filter(Boolean).join(': ');
  if (c.kind === 'thread_close') return c.thread_title;
  return c.story_purpose;
}

const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString() : n);

/** What moved on the feed, as short lines. */
export function signalLines(signals) {
  if (!signals) return [];
  const out = [];
  for (const f of signals.followers || []) out.push({ key: `f-${f.handle}`, up: f.change > 0, text: `${atHandle(f.handle)} ${f.change > 0 ? '+' : ''}${fmt(f.change)} followers` });
  for (const s of signals.states || []) out.push({ key: `s-${s.handle}`, text: `${atHandle(s.handle)} is ${String(s.to).replace(/_/g, ' ')}` });
  for (const s of signals.storylines || []) if (s.status === 'paid_off') out.push({ key: `p-${s.title}`, text: `“${s.title}” paid off` });
  for (const m of (signals.met || []).slice(0, 3)) out.push({ key: `m-${m.handle}`, text: `${atHandle(m.handle)} met Lala in E${m.episode_number}` });
  return out;
}

export default function SeasonProposals({ showId, api, onApplied }) {
  const [state, setState] = useState({ loading: true, open: null, recent: [] });
  const [keep, setKeep] = useState({});
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/api/v1/world/${showId}/season/proposals`);
      const open = r.data?.open || null;
      setState({ loading: false, open, recent: r.data?.recent || [] });
      setKeep(Object.fromEntries((open?.changes || []).map((_, i) => [i, true])));
    } catch (err) {
      console.error('[SeasonProposals] load failed:', err);
      setState({ loading: false, open: null, recent: [] });
    }
  }, [api, showId]);
  useEffect(() => { load(); }, [load]);

  const check = async () => {
    setBusy('check'); setNote(null);
    try {
      const r = await api.post(`/api/v1/world/${showId}/season/proposals`);
      const p = r.data?.proposal;
      if (!p) setNote(r.data?.skipped === 'no_season' ? 'Set up the season first.' : 'Nothing new on the feed.');
      else if (p.status === 'no_change') setNote(p.summary || 'The feed does not call for changes to the season right now.');
      await load();
    } catch (err) {
      console.error('[SeasonProposals] check failed:', err);
      setNote(err.response?.data?.error || err.message || 'Could not check the feed.');
    } finally { setBusy(null); }
  };

  const decide = async (action) => {
    const { open } = state;
    if (!open) return;
    setBusy(action); setNote(null);
    try {
      const chosen = Object.entries(keep).filter(([, v]) => v).map(([i]) => Number(i));
      const r = action === 'accept'
        ? await api.post(`/api/v1/world/${showId}/season/proposals/${open.id}/accept`, { changes: chosen })
        : await api.post(`/api/v1/world/${showId}/season/proposals/${open.id}/dismiss`);
      if (action === 'accept') {
        const applied = r.data?.applied || [];
        const done = applied.filter((a) => a.ok).length;
        const failed = applied.filter((a) => !a.ok && !a.skipped);
        setNote([`Applied ${done} ${done === 1 ? 'change' : 'changes'} to the season.`, ...failed.map((a) => a.error)].join(' '));
        onApplied?.();
      } else setNote('Dismissed. Nothing in the season changed.');
      await load();
    } catch (err) {
      console.error(`[SeasonProposals] ${action} failed:`, err);
      setNote(err.response?.data?.error || err.message || 'Could not save that.');
    } finally { setBusy(null); }
  };

  if (state.loading) return null;
  const { open } = state;
  const chosenCount = Object.values(keep).filter(Boolean).length;
  const moved = signalLines(open?.signals);

  return (
    <section className="sp-card" aria-labelledby="sp-title" data-testid="season-proposals">
      <header className="sp-head">
        <div>
          <h3 id="sp-title" className="sp-title"><Sparkles size={18} aria-hidden="true" /> From the feed</h3>
          <p className="sp-about">As the feed characters grow, the season can grow with them. Nothing changes until you accept it.</p>
        </div>
        <button type="button" className="sp-btn-soft" onClick={check} disabled={!!busy}>{busy === 'check' ? 'Reading the feed…' : 'Check the feed now'}</button>
      </header>

      {open ? (
        <div className="sp-open">
          {open.summary && <p className="sp-summary">{open.summary}</p>}
          {moved.length > 0 && (
            <ul className="sp-moved" aria-label="What moved on the feed">
              {moved.map((m) => (
                <li key={m.key}>
                  {m.up === true && <TrendingUp size={14} aria-hidden="true" />}
                  {m.up === false && <TrendingDown size={14} aria-hidden="true" />}
                  {m.text}
                </li>
              ))}
            </ul>
          )}
          <ul className="sp-changes">
            {open.changes.map((c, i) => (
              <li key={i} className="sp-change">
                <label className="sp-change-pick">
                  <input type="checkbox" checked={!!keep[i]} disabled={!!busy} onChange={(e) => setKeep((k) => ({ ...k, [i]: e.target.checked }))} />
                  <span className="sp-change-kind">{(KIND_LABEL[c.kind] || (() => c.kind))(c)}</span>
                </label>
                <p className="sp-change-text">{changeText(c)}</p>
                {c.why && <p className="sp-change-why"><strong>Why:</strong> {c.why}</p>}
              </li>
            ))}
          </ul>
          <div className="sp-actions">
            <button type="button" className="sp-btn" disabled={!!busy || !chosenCount} onClick={() => decide('accept')}>
              {busy === 'accept' ? 'Applying…' : `Accept ${chosenCount} of ${open.changes.length}`}
            </button>
            <button type="button" className="sp-btn-soft" disabled={!!busy} onClick={() => decide('dismiss')}>Dismiss</button>
          </div>
        </div>
      ) : (
        <p className="sp-empty">
          Nothing proposed right now. The season is checked against the feed when an episode is accepted, a Pulse storyline pays off, or a character’s followers jump.
        </p>
      )}
      {note && <p className="sp-note" role="status">{note}</p>}
    </section>
  );
}
