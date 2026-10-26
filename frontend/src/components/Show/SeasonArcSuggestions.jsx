/**
 * "Arc suggestions" under the Cast tab's cards (Evoni, 2026-10-26, Season
 * page round 3 AI buttons). A button she presses: one AI call (POST
 * .../season/ai/arc-suggestions, services/seasonAiHelpers) reads who
 * appears where, the relationship changes, the slots and the twists, and
 * suggests changes ("Truthville appears in E2 and E11 but nothing between:
 * add a beat in Part 2?"). Nothing is saved until she accepts one:
 *
 *   Story purpose  Accept adds it to that slot beside its own purposes
 *                  (the slot's existing save path, saveIntention)
 *   Twist          Accept adds it to the season's twists (seasonTwists)
 *   Note           anything else: Copy, never a write
 *
 * Skip drops a suggestion from the list. Props: api, showId, season (a
 * past season's number, from the switcher), onApplied (reload the roadmap).
 */
import { useState } from 'react';
import { Sparkles, Check, Copy, X } from 'lucide-react';
import { aiErrorText, seasonQuery } from '../../lib/seasonAi';
import './SeasonArcSuggestions.css';

const KIND_LABEL = { purpose: 'Story purpose', twist: 'Twist', note: 'Note' };

function where(s) {
  if (s.kind === 'purpose') return `E${s.slot_number}`;
  if (s.kind === 'twist') return `E${s.slot_number}${s.payoff_slot_number ? ` → E${s.payoff_slot_number}` : ''}`;
  return null;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('[SeasonArcSuggestions] copy failed:', err);
    return false;
  }
}

function Suggestion({ s, onAccept, onSkip }) {
  const [state, setState] = useState({ busy: false, done: null, error: null, copied: false });
  const accept = async () => {
    setState({ busy: true, done: null, error: null, copied: false });
    try {
      setState({ busy: false, done: await onAccept(s), error: null, copied: false });
    } catch (err) {
      console.error('[SeasonArcSuggestions] accept failed:', err);
      setState({ busy: false, done: null, error: aiErrorText(err, 'It could not be applied. Try again.'), copied: false });
    }
  };
  const copy = async () => {
    const ok = await copyText(`${s.text}${s.why ? ` (${s.why})` : ''}`);
    setState((st) => ({ ...st, copied: ok, error: ok ? null : 'Copy did not work here; select the text instead.' }));
  };
  const at = where(s);
  return (
    <li className={`sarc-item is-${s.kind}${state.done ? ' is-done' : ''}`} data-testid={`szn-arc-suggestion-${s.kind}`}>
      <p className="sarc-kind">{KIND_LABEL[s.kind] || 'Note'}{at ? <span className="sarc-at"> · {at}</span> : null}</p>
      {s.kind === 'twist' && s.title && s.title !== s.text && <p className="sarc-title">{s.title}</p>}
      <p className="sarc-text">{s.text}</p>
      {s.why && <p className="sarc-why">{s.why}</p>}
      {s.cannot_apply && <p className="sarc-why">{s.cannot_apply}</p>}
      {state.done ? (
        <p className="sarc-done" role="status"><Check size={14} aria-hidden="true" /> {state.done}</p>
      ) : (
        <div className="sarc-actions">
          {s.kind === 'note' ? (
            <button type="button" className="sarc-btn" onClick={copy} data-testid="szn-arc-copy">
              <Copy size={14} aria-hidden="true" /> {state.copied ? 'Copied' : 'Copy'}
            </button>
          ) : (
            <button type="button" className="sarc-btn" onClick={accept} disabled={state.busy} data-testid="szn-arc-accept">
              <Check size={14} aria-hidden="true" /> {state.busy ? 'Adding…' : 'Accept'}
            </button>
          )}
          <button type="button" className="sarc-btn is-quiet" onClick={onSkip} disabled={state.busy} data-testid="szn-arc-skip">
            <X size={14} aria-hidden="true" /> Skip
          </button>
        </div>
      )}
      {state.error && <p className="sarc-error" role="alert">{state.error}</p>}
    </li>
  );
}

export default function SeasonArcSuggestions({ api, showId, season = null, onApplied = null }) {
  const [state, setState] = useState({ busy: false, list: null, error: null });
  const base = `/api/v1/world/${showId}/season/ai/arc-suggestions`;

  const ask = async () => {
    setState({ busy: true, list: null, error: null });
    try {
      const res = await api.post(`${base}${seasonQuery(season)}`);
      setState({ busy: false, list: (res.data?.suggestions || []).map((s, i) => ({ ...s, key: i })), error: null });
    } catch (err) {
      console.error('[SeasonArcSuggestions] suggestions failed:', err);
      setState({ busy: false, list: null, error: aiErrorText(err, 'No arc suggestions could be made. Try again.') });
    }
  };
  const accept = async (s) => {
    const res = await api.post(`${base}/accept`, s);
    if (onApplied) onApplied();
    return res.data?.applied || 'Added.';
  };
  const skip = (key) => setState((st) => ({ ...st, list: st.list.filter((s) => s.key !== key) }));

  return (
    <section className="szn-card sarc" aria-labelledby="sarc-title" data-testid="szn-arc-suggestions">
      <header className="sarc-head">
        <h2 id="sarc-title" className="sarc-heading"><Sparkles size={18} aria-hidden="true" /> Arc suggestions</h2>
        <button type="button" className="sarc-btn" onClick={ask} disabled={state.busy} data-testid="szn-arc-ask">
          <Sparkles size={14} aria-hidden="true" /> {state.busy ? 'Reading the cast…' : state.list ? 'Suggest again' : 'Suggest arc changes'}
        </button>
      </header>
      {!state.list && !state.error && !state.busy && (
        <p className="sarc-muted">Reads who appears where and what changed between them, and suggests who to bring back or whose arc to move. Nothing is saved until you accept one.</p>
      )}
      {state.error && <p className="sarc-error" role="alert" data-testid="szn-arc-error">{state.error}</p>}
      {state.list && state.list.length === 0 && <p className="sarc-muted" data-testid="szn-arc-empty">No suggestions left.</p>}
      {state.list && state.list.length > 0 && (
        <ul className="sarc-list">
          {state.list.map((s) => <Suggestion key={s.key} s={s} onAccept={accept} onSkip={() => skip(s.key)} />)}
        </ul>
      )}
    </section>
  );
}
