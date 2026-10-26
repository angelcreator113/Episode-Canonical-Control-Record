/**
 * "What should I do next?" under the Season page's health line (Evoni,
 * 2026-10-26, Season page round 3 AI buttons). A button she presses: one
 * short AI call (POST .../season/ai/next-step, services/seasonAiHelpers)
 * turns the Needs attention items the page already shows into two or three
 * plain sentences ("Lock E3's thumbnail today; E7 needs an event, and
 * Fabric and Form fits it best."). Nothing is saved; Dismiss hides it.
 *
 * Props: api, showId, items (lib/seasonAttention attentionItems).
 */
import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { attentionPayload, aiErrorText } from '../../lib/seasonAi';
import './SeasonNextStep.css';

export default function SeasonNextStep({ api, showId, items = [] }) {
  const [state, setState] = useState({ busy: false, sentences: null, error: null });
  if (!(items || []).length) return null;

  const ask = async () => {
    setState({ busy: true, sentences: null, error: null });
    try {
      const res = await api.post(`/api/v1/world/${showId}/season/ai/next-step`, { items: attentionPayload(items) });
      setState({ busy: false, sentences: res.data?.sentences || [], error: null });
    } catch (err) {
      console.error('[SeasonNextStep] next step failed:', err);
      setState({ busy: false, sentences: null, error: aiErrorText(err, 'No next step could be suggested. Try again.') });
    }
  };
  const dismiss = () => setState({ busy: false, sentences: null, error: null });

  const open = state.sentences || state.error;
  return (
    <div className="snext" data-testid="szn-next-step">
      {!open && (
        <button type="button" className="snext-btn" onClick={ask} disabled={state.busy} data-testid="szn-next-step-ask">
          <Sparkles size={14} aria-hidden="true" /> {state.busy ? 'Thinking…' : 'What should I do next?'}
        </button>
      )}
      {open && (
        <div className={`snext-card${state.error ? ' is-error' : ''}`} role={state.error ? 'alert' : 'status'} data-testid="szn-next-step-answer">
          <div className="snext-text">
            {state.error ? <p className="snext-p">{state.error}</p> : state.sentences.map((s, i) => <p key={i} className="snext-p">{s}</p>)}
            {!state.error && <p className="snext-foot">A suggestion from the Needs attention list. Nothing was changed.</p>}
          </div>
          <button type="button" className="snext-close" onClick={dismiss} aria-label="Dismiss" data-testid="szn-next-step-dismiss">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
