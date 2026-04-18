/**
 * ActionRow — one-line editor for a single action. The UI adapts to the action
 * type (dropdown of allowlisted types + per-type field set). Anything not in
 * ALLOWED_ACTION_TYPES is rejected server-side, so the UI only exposes those four.
 */
import React from 'react';
import { X } from 'lucide-react';
import { ALLOWED_ACTION_TYPES } from '../../lib/phoneRuntime';

const TYPE_LABEL = {
  navigate: 'Navigate',
  set_state: 'Set state',
  show_toast: 'Show toast',
  complete_episode: 'Complete episode',
};

export default function ActionRow({ action, onChange, onRemove, screenOptions = [] }) {
  const patch = (next) => onChange({ ...action, ...next });

  const parseValue = (raw) => {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (raw === '') return '';
    const n = Number(raw);
    return Number.isFinite(n) && raw.trim() !== '' ? n : raw;
  };

  // Switching type resets other fields so stale params don't leak through.
  const setType = (type) => {
    if (type === 'navigate') onChange({ type, target: '' });
    else if (type === 'set_state') onChange({ type, key: '', value: true });
    else if (type === 'show_toast') onChange({ type, text: '', tone: 'info' });
    else if (type === 'complete_episode') onChange({ type });
  };

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      <select
        value={action.type || 'navigate'}
        onChange={e => setType(e.target.value)}
        style={{ padding: '6px 6px', fontSize: 11, border: '1px solid #e0d9ce', borderRadius: 5, fontFamily: "'DM Mono', monospace", background: '#fff', minWidth: 120 }}
      >
        {ALLOWED_ACTION_TYPES.map(t => (
          <option key={t} value={t}>{TYPE_LABEL[t]}</option>
        ))}
      </select>

      {action.type === 'navigate' && (
        <select
          value={action.target || ''}
          onChange={e => patch({ target: e.target.value })}
          style={{ flex: 1, minWidth: 140, padding: '6px 8px', fontSize: 11, border: '1px solid #e0d9ce', borderRadius: 5, fontFamily: "'DM Mono', monospace", background: '#fff' }}
        >
          <option value="">— pick a screen —</option>
          {screenOptions.map(s => (<option key={s.key} value={s.key}>{s.label}</option>))}
        </select>
      )}

      {action.type === 'set_state' && (
        <>
          <input
            value={action.key || ''}
            onChange={e => patch({ key: e.target.value })}
            placeholder="state key"
            style={{ flex: 1, minWidth: 120, padding: '6px 8px', fontSize: 11, border: '1px solid #e0d9ce', borderRadius: 5, fontFamily: "'DM Mono', monospace" }}
          />
          <input
            value={action.value === undefined || action.value === null ? '' : String(action.value)}
            onChange={e => patch({ value: parseValue(e.target.value) })}
            placeholder="value"
            style={{ width: 80, padding: '6px 8px', fontSize: 11, border: '1px solid #e0d9ce', borderRadius: 5, fontFamily: "'DM Mono', monospace" }}
          />
        </>
      )}

      {action.type === 'show_toast' && (
        <>
          <input
            value={action.text || ''}
            onChange={e => patch({ text: e.target.value })}
            placeholder="toast text"
            style={{ flex: 1, minWidth: 140, padding: '6px 8px', fontSize: 11, border: '1px solid #e0d9ce', borderRadius: 5 }}
          />
          <select
            value={action.tone || 'info'}
            onChange={e => patch({ tone: e.target.value })}
            style={{ padding: '6px 6px', fontSize: 11, border: '1px solid #e0d9ce', borderRadius: 5, fontFamily: "'DM Mono', monospace", background: '#fff' }}
          >
            <option value="info">info</option>
            <option value="success">success</option>
            <option value="warning">warning</option>
            <option value="error">error</option>
          </select>
        </>
      )}

      <button
        onClick={onRemove}
        aria-label="Remove action"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c66', padding: 4, minWidth: 24, minHeight: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <X size={12} />
      </button>
    </div>
  );
}
