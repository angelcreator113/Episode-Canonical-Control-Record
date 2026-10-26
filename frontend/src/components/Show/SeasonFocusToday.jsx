/**
 * "Focus for today" at the top of the daily update's "The season" (Evoni,
 * 2026-10-26, Season page round 3 AI buttons). A button she presses: one
 * short AI call (POST /season-ai/focus, services/seasonAiHelpers) reads
 * the Needs attention items of each show's season in progress (the same
 * items the lists under it show) and answers with one line. Nothing is
 * saved; Dismiss hides it.
 *
 * Props: api, seasons ([{ show_id, show, season_number, title, items }],
 * collected by SeasonAttentionDigest), loading (true while a list is still
 * being read).
 */
import { useState } from 'react';
import { Target, X } from 'lucide-react';
import { attentionPayload, aiErrorText } from '../../lib/seasonAi';
import './SeasonFocusToday.css';

export default function SeasonFocusToday({ api, seasons = [], loading = false }) {
  const [state, setState] = useState({ busy: false, line: null, error: null });
  const withItems = (seasons || []).filter((s) => (s.items || []).length);

  const ask = async () => {
    setState({ busy: true, line: null, error: null });
    try {
      const body = { seasons: withItems.map((s) => ({ show: s.show, season_number: s.season_number, title: s.title, items: attentionPayload(s.items).slice(0, 8) })) };
      const res = await api.post('/api/v1/season-ai/focus', body);
      setState({ busy: false, line: res.data?.line || '', error: null });
    } catch (err) {
      console.error('[SeasonFocusToday] focus failed:', err);
      setState({ busy: false, line: null, error: aiErrorText(err, 'No focus could be picked. Try again.') });
    }
  };
  const dismiss = () => setState({ busy: false, line: null, error: null });

  if (state.line || state.error) {
    return (
      <div className={`sfocus-card${state.error ? ' is-error' : ''}`} role={state.error ? 'alert' : 'status'} data-testid="du-focus-answer">
        <Target size={18} aria-hidden="true" className="sfocus-icon" />
        <p className="sfocus-line">{state.error || state.line}</p>
        <button type="button" className="sfocus-close" onClick={dismiss} aria-label="Dismiss" data-testid="du-focus-dismiss"><X size={16} aria-hidden="true" /></button>
      </div>
    );
  }
  return (
    <div className="sfocus" data-testid="du-focus">
      <button type="button" className="sfocus-btn" onClick={ask} disabled={state.busy || loading || !withItems.length} data-testid="du-focus-ask">
        <Target size={14} aria-hidden="true" /> {state.busy ? 'Picking…' : 'Focus for today'}
      </button>
      {!loading && !withItems.length && <span className="sfocus-muted">Nothing needs attention today.</span>}
    </div>
  );
}
