/**
 * ConditionRow — one-line editor for a single {key, op, value} condition.
 * Intentionally flat (no tree operators) in v1 to keep creators and AI aligned.
 *
 * Free-form `key` input; autocomplete + registry integration arrives in PR3.
 * `value` input adapts by op: hidden for exists/not_exists, bool toggle for eq-on-bool,
 * plain text otherwise.
 */
import React from 'react';
import { X } from 'lucide-react';
import { CONDITION_OPS } from '../../lib/phoneRuntime';

const OP_LABELS = {
  eq: '=', neq: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤', exists: 'exists', not_exists: 'not set',
};

export default function ConditionRow({ condition, onChange, onRemove }) {
  const needsValue = condition.op !== 'exists' && condition.op !== 'not_exists';

  const patchField = (field, val) => onChange({ ...condition, [field]: val });

  const parseValue = (raw) => {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (raw === '') return '';
    const n = Number(raw);
    return Number.isFinite(n) && raw.trim() !== '' ? n : raw;
  };

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        value={condition.key || ''}
        onChange={e => patchField('key', e.target.value)}
        placeholder="state key (e.g. talked_to_ex)"
        style={{ flex: 1, minWidth: 140, padding: '6px 8px', fontSize: 11, border: '1px solid #e0d9ce', borderRadius: 5, fontFamily: "'DM Mono', monospace" }}
      />
      <select
        value={condition.op || 'eq'}
        onChange={e => patchField('op', e.target.value)}
        style={{ padding: '6px 6px', fontSize: 11, border: '1px solid #e0d9ce', borderRadius: 5, fontFamily: "'DM Mono', monospace", background: '#fff' }}
      >
        {CONDITION_OPS.map(op => (
          <option key={op} value={op}>{OP_LABELS[op]}</option>
        ))}
      </select>
      {needsValue && (
        <input
          value={condition.value === undefined || condition.value === null ? '' : String(condition.value)}
          onChange={e => patchField('value', parseValue(e.target.value))}
          placeholder="value"
          style={{ width: 90, padding: '6px 8px', fontSize: 11, border: '1px solid #e0d9ce', borderRadius: 5, fontFamily: "'DM Mono', monospace" }}
        />
      )}
      <button
        onClick={onRemove}
        aria-label="Remove condition"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c66', padding: 4, minWidth: 24, minHeight: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <X size={12} />
      </button>
    </div>
  );
}
